"""Score benchmark results against ground truth answers.

Reads the JSON output from benchmark_harness.py and scores each question
by checking whether the API response contains the correct answer.

Scoring methods:
- Factual: extract key values from correct_answer, check if they appear in api_response
- Reasoning: check if key terms/values from correct_answer appear in api_response
- Hallucination trap: check if the API correctly returns error/not-found for invalid queries

Usage:
    uv run python scripts/benchmark_scorer.py
    uv run python scripts/benchmark_scorer.py --results-dir /path/to/results
    uv run python scripts/benchmark_scorer.py --verbose
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


# ── Value Extraction ─────────────────────────────────────────────────────────

def extract_numbers(text: str) -> list[float]:
    """Extract all numeric values from text."""
    # Match numbers like -2.24, 0.532, 50.0, 19396, 1e-29, etc.
    matches = re.findall(r'-?\d+\.?\d*(?:[eE][+-]?\d+)?', str(text))
    result = []
    for m in matches:
        try:
            result.append(float(m))
        except ValueError:
            pass
    return result


def extract_key_terms(answer: str) -> list[str]:
    """Extract important terms from a correct answer for fuzzy matching."""
    terms = []

    # Gene names (uppercase, 2-10 chars)
    terms.extend(re.findall(r'\b[A-Z][A-Z0-9]{1,9}\b', answer))

    # Probe IDs
    terms.extend(re.findall(r'cg\d{7,8}', answer))

    # Chromosome names
    terms.extend(re.findall(r'chr(?:omosome)?\s*\d+|chr[XYM]', answer, re.IGNORECASE))

    # Pathway IDs
    terms.extend(re.findall(r'R-HSA-\d+', answer))

    # Specific keywords
    keywords = [
        "reverse strand", "minus strand", "forward strand", "plus strand",
        "liver", "whole_blood", "pancreas", "muscle", "brain", "heart",
        "island", "shore", "shelf", "open_sea", "n_shore", "s_shore",
        "PLS", "pELS", "dELS", "CTCF",
        "Alu", "LINE", "SINE", "LTR",
        "450K", "450k", "EPIC", "EPICv2",
        "does not exist", "not a valid", "no such",
        "Kyte-Doolittle", "Wimley-White", "Eisenberg",
        "SantaLucia", "Horvath", "Hannum", "PhenoAge", "GrimAge", "DunedinPACE",
    ]
    for kw in keywords:
        if kw.lower() in answer.lower():
            terms.append(kw)

    return list(set(terms))


def numbers_match(expected: float, actual: float, tolerance: float = 0.05) -> bool:
    """Check if two numbers match within relative tolerance."""
    if expected == 0:
        return abs(actual) < 0.01
    return abs(expected - actual) / abs(expected) < tolerance


# ── Scoring Functions ────────────────────────────────────────────────────────

def score_factual(q: dict) -> dict:
    """Score a factual question by checking if key values appear in the API response."""
    correct = q["correct_answer"]
    response = str(q.get("api_response", ""))
    domain = q["domain"]

    if "ERROR" in response or "API error" in response:
        return {"score": 0, "max_score": 1, "reason": "API error — harness routing failure", "status": "error"}

    # Extract expected numbers from correct answer
    expected_nums = extract_numbers(correct)
    found_nums = extract_numbers(response)

    # Extract expected terms
    expected_terms = extract_key_terms(correct)

    # Check number matches
    num_matches = 0
    num_total = len(expected_nums)
    matched_values = []
    missed_values = []

    for exp in expected_nums:
        matched = False
        for act in found_nums:
            if numbers_match(exp, act):
                matched = True
                matched_values.append(f"{exp}")
                break
        if not matched:
            missed_values.append(f"{exp}")
        num_matches += int(matched)

    # Check term matches
    term_matches = 0
    term_total = len(expected_terms)
    matched_terms = []
    missed_terms = []

    for term in expected_terms:
        if term.lower() in response.lower():
            term_matches += 1
            matched_terms.append(term)
        else:
            missed_terms.append(term)

    # Overall score
    total_checks = num_total + term_total
    total_matched = num_matches + term_matches

    if total_checks == 0:
        # No extractable values — can't auto-score
        return {"score": None, "max_score": 1, "reason": "No extractable values for auto-scoring", "status": "manual"}

    score = total_matched / total_checks

    status = "pass" if score >= 0.7 else ("partial" if score >= 0.3 else "fail")

    return {
        "score": round(score, 3),
        "max_score": 1,
        "status": status,
        "num_matches": f"{num_matches}/{num_total}",
        "term_matches": f"{term_matches}/{term_total}",
        "matched_values": matched_values[:5],
        "missed_values": missed_values[:5],
        "matched_terms": matched_terms[:5],
        "missed_terms": missed_terms[:5],
        "reason": f"{'Values: ' + ', '.join(matched_values[:3]) if matched_values else 'No values matched'}"
    }


def score_reasoning(q: dict) -> dict:
    """Score a reasoning question by checking if key data is present in the response."""
    correct = q["correct_answer"]
    response = str(q.get("api_response", ""))

    if "ERROR" in response or "API error" in response:
        return {"score": 0, "max_score": 1, "reason": "API error", "status": "error"}

    # For reasoning questions, check if the API returned relevant data
    # (the actual reasoning is done by the AI agent, not the API)
    expected_terms = extract_key_terms(correct)
    expected_nums = extract_numbers(correct)

    # Check what fraction of expected data is in the response
    data_present = 0
    data_total = 0

    for term in expected_terms:
        data_total += 1
        if term.lower() in response.lower():
            data_present += 1

    for num in expected_nums[:5]:  # Cap at 5 numbers
        data_total += 1
        found_nums = extract_numbers(response)
        if any(numbers_match(num, f) for f in found_nums):
            data_present += 1

    if data_total == 0:
        return {"score": None, "max_score": 1, "reason": "No extractable data for auto-scoring", "status": "manual"}

    score = data_present / data_total
    status = "data_available" if score >= 0.3 else "data_missing"

    return {
        "score": round(score, 3),
        "max_score": 1,
        "status": status,
        "data_coverage": f"{data_present}/{data_total}",
        "reason": f"API returned {data_present}/{data_total} expected data points"
    }


def score_hallucination_trap(q: dict) -> dict:
    """Score a hallucination trap question.

    For these questions, we check whether the API correctly handles
    invalid inputs, nonexistent entities, etc.
    """
    correct = q["correct_answer"]
    response = str(q.get("api_response", ""))
    domain = q["domain"]

    # For nonexistent entities, the API SHOULD return an error or "not found"
    if domain in ("nonexistent_entity", "nonexistent_probe"):
        if any(term in response.lower() for term in ["not found", "error", "404", "does not exist", "not_found"]):
            return {"score": 1, "max_score": 1, "status": "pass",
                    "reason": "API correctly returned not-found for nonexistent entity"}
        else:
            return {"score": 0, "max_score": 1, "status": "fail",
                    "reason": "API did NOT flag nonexistent entity"}

    # For confirmation bias traps, check if the API data contradicts the wrong premise
    if domain == "confirmation_bias":
        # The API should return the CORRECT value, which differs from the wrong one in the question
        expected_nums = extract_numbers(correct)
        found_nums = extract_numbers(response)
        if expected_nums and found_nums:
            if any(numbers_match(exp, act) for exp in expected_nums for act in found_nums):
                return {"score": 1, "max_score": 1, "status": "pass",
                        "reason": "API returned correct value (contradicting wrong premise)"}
        return {"score": 0.5, "max_score": 1, "status": "partial",
                "reason": "Could not verify if API contradicts premise"}

    # For assembly confusion, check if the API handles coordinate correctly
    if domain == "assembly_confusion":
        # API should return valid data for the correct build
        if "error" not in response.lower() or "not found" in response.lower():
            return {"score": 0.5, "max_score": 1, "status": "partial",
                    "reason": "API responded — manual check needed for coordinate correctness"}
        return {"score": 0, "max_score": 1, "status": "fail",
                "reason": "API error on assembly question"}

    # For other trap types, the API returns data — the AGENT needs to interpret correctly
    # We can only check that the API returned relevant data
    if "error" in response.lower() and "api error" in response.lower():
        return {"score": 0, "max_score": 1, "status": "error",
                "reason": "API error — harness routing failure"}

    # Check if the response contains data relevant to the question
    expected_terms = extract_key_terms(correct)
    term_present = sum(1 for t in expected_terms if t.lower() in response.lower())

    if len(expected_terms) > 0 and term_present / len(expected_terms) >= 0.3:
        return {"score": 0.7, "max_score": 1, "status": "data_available",
                "reason": f"API returned relevant data ({term_present}/{len(expected_terms)} key terms) — agent interpretation needed"}
    else:
        return {"score": 0.3, "max_score": 1, "status": "partial",
                "reason": "API returned data but key terms not found — manual review needed"}


# ── Main Scorer ──────────────────────────────────────────────────────────────

def score_question(q: dict) -> dict:
    """Score a single question based on its category."""
    category = q["category"]
    if category == "factual":
        return score_factual(q)
    elif category == "reasoning":
        return score_reasoning(q)
    elif category == "hallucination_trap":
        return score_hallucination_trap(q)
    return {"score": None, "max_score": 1, "status": "unknown", "reason": f"Unknown category: {category}"}


def main():
    parser = argparse.ArgumentParser(description="Score benchmark results")
    parser.add_argument("--results-dir", default=".", help="Directory containing benchmark_results_*.json files")
    parser.add_argument("--verbose", action="store_true", help="Print per-question details")
    parser.add_argument("--output", default=None, help="Save scored results to JSON")
    args = parser.parse_args()

    results_dir = Path(args.results_dir)

    # Load all result files
    all_results = []
    for cat in ["factual", "reasoning", "hallucination"]:
        path = results_dir / f"benchmark_results_{cat}.json"
        if path.exists():
            with open(path) as f:
                all_results.extend(json.load(f))
            print(f"Loaded: {path.name}")

    if not all_results:
        print("No result files found. Run benchmark_harness.py first.")
        sys.exit(1)

    print(f"\nTotal questions: {len(all_results)}")

    # Score each question
    scored = []
    for q in all_results:
        result = score_question(q)
        scored.append({**q, "scoring": result})

    # ── Report ───────────────────────────────────────────────────────────
    print(f"\n{'='*70}")
    print("BENCHMARK SCORING REPORT")
    print(f"{'='*70}\n")

    # By category
    cat_stats: dict[str, dict] = {}
    for s in scored:
        cat = s["category"]
        if cat not in cat_stats:
            cat_stats[cat] = {"total": 0, "pass": 0, "partial": 0, "fail": 0, "error": 0, "manual": 0, "scores": []}
        cat_stats[cat]["total"] += 1
        status = s["scoring"]["status"]
        if status in cat_stats[cat]:
            cat_stats[cat][status] += 1
        score = s["scoring"]["score"]
        if score is not None:
            cat_stats[cat]["scores"].append(score)

    print(f"  {'Category':<25s} {'Total':>5s} {'Pass':>5s} {'Part':>5s} {'Fail':>5s} {'Err':>5s} {'Mean':>6s}")
    print(f"  {'-'*25} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*5} {'-'*6}")
    for cat in ["factual", "reasoning", "hallucination_trap"]:
        if cat in cat_stats:
            st = cat_stats[cat]
            mean_score = sum(st["scores"]) / len(st["scores"]) if st["scores"] else 0
            print(f"  {cat:<25s} {st['total']:>5d} {st['pass']:>5d} {st['partial']:>5d} "
                  f"{st['fail']:>5d} {st['error']:>5d} {mean_score:>5.1%}")

    # By domain (factual only)
    print(f"\n  FACTUAL BREAKDOWN BY DOMAIN:")
    print(f"  {'Domain':<45s} {'Score':>6s} {'Status'}")
    print(f"  {'-'*45} {'-'*6} {'-'*10}")

    factual = [s for s in scored if s["category"] == "factual"]
    domain_groups: dict[str, list] = {}
    for s in factual:
        d = s["domain"]
        if d not in domain_groups:
            domain_groups[d] = []
        domain_groups[d].append(s)

    for domain in sorted(domain_groups.keys()):
        items = domain_groups[domain]
        scores = [s["scoring"]["score"] for s in items if s["scoring"]["score"] is not None]
        statuses = [s["scoring"]["status"] for s in items]
        mean = sum(scores) / len(scores) if scores else 0
        pass_count = statuses.count("pass")
        fail_count = statuses.count("fail")
        err_count = statuses.count("error")
        print(f"  {domain:<45s} {mean:>5.1%} {pass_count}P/{fail_count}F/{err_count}E")

    # Verbose per-question output
    if args.verbose:
        print(f"\n{'='*70}")
        print("PER-QUESTION DETAILS")
        print(f"{'='*70}\n")
        for s in scored:
            sc = s["scoring"]
            score_str = f"{sc['score']:.1%}" if sc["score"] is not None else "N/A"
            print(f"  {s['id']:5s} [{sc['status']:>14s}] {score_str:>5s} | {s['domain']}")
            if args.verbose:
                print(f"         Q: {s['question'][:100]}...")
                print(f"         Expected: {s['correct_answer'][:100]}...")
                print(f"         Reason: {sc['reason']}")
                if sc.get("missed_values"):
                    print(f"         Missing values: {sc['missed_values']}")
                if sc.get("missed_terms"):
                    print(f"         Missing terms: {sc['missed_terms']}")
                print()

    # Overall summary
    all_scores = [s["scoring"]["score"] for s in scored if s["scoring"]["score"] is not None]
    all_statuses = [s["scoring"]["status"] for s in scored]

    print(f"\n{'='*70}")
    print("OVERALL SUMMARY")
    print(f"{'='*70}")
    print(f"  Questions scored:  {len(scored)}")
    print(f"  Mean score:        {sum(all_scores)/len(all_scores):.1%}" if all_scores else "  Mean score: N/A")
    print(f"  Pass (≥70%):       {all_statuses.count('pass')}")
    print(f"  Partial (30-70%):  {all_statuses.count('partial')}")
    print(f"  Data available:    {all_statuses.count('data_available')}")
    print(f"  Fail (<30%):       {all_statuses.count('fail')}")
    print(f"  API errors:        {all_statuses.count('error')}")
    print(f"  Manual review:     {all_statuses.count('manual')}")

    if args.output:
        with open(args.output, "w") as f:
            json.dump(scored, f, indent=2)
        print(f"\n  Scored results saved to: {args.output}")


if __name__ == "__main__":
    main()
