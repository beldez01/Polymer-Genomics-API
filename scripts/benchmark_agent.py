"""AI Agent Benchmark: Polymer Genomics API truthfulness evaluation.

Runs each benchmark question through Claude in two conditions:
  A) WITH API data (from benchmark_harness.py output) — tests tool-augmented accuracy
  B) WITHOUT API data (parametric knowledge only) — tests baseline hallucination rate

Then scores both answers against ground truth.

Usage:
    # Run full benchmark (both conditions, all categories)
    ANTHROPIC_API_KEY=sk-... uv run python scripts/benchmark_agent.py

    # Run specific category
    ANTHROPIC_API_KEY=sk-... uv run python scripts/benchmark_agent.py --category factual

    # Resume from a specific question
    ANTHROPIC_API_KEY=sk-... uv run python scripts/benchmark_agent.py --start-from A20
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

import httpx

# ── Configuration ────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-20250514"  # Use Sonnet for cost efficiency on 100 questions × 2 conditions

RESULTS_DIR = Path(__file__).parent.parent


# ── Claude API Client ────────────────────────────────────────────────────────

async def ask_claude(
    client: httpx.AsyncClient,
    question: str,
    api_data: str | None = None,
    system_prompt: str = "",
) -> str:
    """Send a question to Claude and get the answer."""

    if api_data:
        user_content = (
            f"You are answering a genomics benchmark question. You have access to data from "
            f"the Polymer Genomics API (a curated genomic reference database). Use the API data "
            f"below to answer accurately. If the data doesn't contain the answer, say so.\n\n"
            f"## API Data\n```json\n{api_data[:15000]}\n```\n\n"
            f"## Question\n{question}\n\n"
            f"Answer concisely and precisely. Include specific numerical values where relevant. "
            f"If the question contains a false premise or asks about something that doesn't exist, "
            f"say so explicitly."
        )
    else:
        user_content = (
            f"Answer this genomics question from your training knowledge. "
            f"Be precise — include specific numerical values, coordinates, and identifiers. "
            f"If you're unsure, say so rather than guessing.\n\n"
            f"## Question\n{question}\n\n"
            f"Answer concisely."
        )

    body = {
        "model": MODEL,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": user_content}],
    }
    if system_prompt:
        body["system"] = system_prompt

    resp = await client.post(
        ANTHROPIC_API_URL,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json=body,
        timeout=60,
    )

    if resp.status_code != 200:
        return f"[CLAUDE_ERROR: {resp.status_code} {resp.text[:200]}]"

    data = resp.json()
    return data["content"][0]["text"]


# ── Scoring ──────────────────────────────────────────────────────────────────

def extract_numbers(text: str) -> list[float]:
    """Extract numeric values from text."""
    matches = re.findall(r'-?\d+\.?\d*(?:[eE][+-]?\d+)?', str(text))
    result = []
    for m in matches:
        try:
            v = float(m)
            if abs(v) < 1e12:  # skip unreasonable numbers
                result.append(v)
        except ValueError:
            pass
    return result


def numbers_match(expected: float, actual: float, tolerance: float = 0.05) -> bool:
    """Check if two numbers match within tolerance."""
    if expected == 0:
        return abs(actual) < 0.01
    if abs(expected) < 0.01:
        return abs(expected - actual) < 0.01
    return abs(expected - actual) / max(abs(expected), 0.001) < tolerance


def score_answer(question: dict, answer: str) -> dict:
    """Score an agent's answer against ground truth."""
    correct = question["correct_answer"]
    category = question["category"]
    answer_lower = answer.lower()
    correct_lower = correct.lower()

    # Extract key values from correct answer
    expected_nums = extract_numbers(correct)
    found_nums = extract_numbers(answer)

    # Number matching
    num_matched = 0
    num_details = []
    for exp in expected_nums:
        matched = any(numbers_match(exp, act) for act in found_nums)
        num_matched += int(matched)
        num_details.append({"expected": exp, "found": matched})

    # Key term matching
    key_terms = []
    # Gene names
    key_terms.extend(re.findall(r'\b[A-Z][A-Z0-9]{1,9}\b', correct))
    # Probe IDs
    key_terms.extend(re.findall(r'cg\d{7,8}', correct))
    # Important biological terms
    bio_terms = [
        "liver", "blood", "pancreas", "muscle", "brain", "heart", "kidney",
        "reverse strand", "minus strand", "forward strand", "plus strand",
        "island", "shore", "shelf", "open sea",
        "does not exist", "not valid", "nonsensical", "incorrect premise",
        "not a", "cannot", "no such",
    ]
    for bt in bio_terms:
        if bt in correct_lower:
            key_terms.append(bt)

    key_terms = list(set(key_terms))
    term_matched = sum(1 for t in key_terms if t.lower() in answer_lower)

    # Hallucination detection for trap questions
    is_trap = category == "hallucination_trap"
    trap_keywords = ["does not exist", "not valid", "nonsensical", "incorrect", "no such",
                     "not a real", "cannot", "the premise is wrong", "this is not"]

    if is_trap:
        # Check if the answer correctly identifies the trap
        correct_identifies_trap = any(kw in correct_lower for kw in trap_keywords)
        answer_identifies_trap = any(kw in answer_lower for kw in trap_keywords)

        if correct_identifies_trap:
            if answer_identifies_trap:
                return {"score": 1.0, "status": "pass", "reason": "Correctly identified trap/invalid premise",
                        "num_match": f"{num_matched}/{len(expected_nums)}", "term_match": f"{term_matched}/{len(key_terms)}"}
            else:
                return {"score": 0.0, "status": "hallucinated", "reason": "Failed to identify trap — hallucinated an answer",
                        "num_match": f"{num_matched}/{len(expected_nums)}", "term_match": f"{term_matched}/{len(key_terms)}"}

    # Overall score
    total = len(expected_nums) + len(key_terms)
    matched = num_matched + term_matched

    if total == 0:
        # Can't auto-score
        return {"score": None, "status": "manual_review", "reason": "No extractable values for auto-scoring",
                "num_match": "0/0", "term_match": "0/0"}

    score = matched / total
    if score >= 0.7:
        status = "pass"
    elif score >= 0.3:
        status = "partial"
    else:
        status = "fail"

    return {
        "score": round(score, 3),
        "status": status,
        "reason": f"Matched {matched}/{total} (nums: {num_matched}/{len(expected_nums)}, terms: {term_matched}/{len(key_terms)})",
        "num_match": f"{num_matched}/{len(expected_nums)}",
        "term_match": f"{term_matched}/{len(key_terms)}",
    }


# ── Main Runner ──────────────────────────────────────────────────────────────

async def run_benchmark(
    questions: list[dict],
    api_results: list[dict],
    category_filter: str | None = None,
    start_from: str | None = None,
) -> list[dict]:
    """Run all questions through Claude in both conditions."""

    # Build API data lookup
    api_lookup = {r["id"]: r.get("api_response", "") for r in api_results}

    if category_filter:
        questions = [q for q in questions if q["category"] == category_filter]

    if start_from:
        idx = next((i for i, q in enumerate(questions) if q["id"] == start_from), 0)
        questions = questions[idx:]

    print(f"\n{'='*70}")
    print(f"POLYMER GENOMICS AI AGENT BENCHMARK")
    print(f"{'='*70}")
    print(f"Questions: {len(questions)}")
    print(f"Model: {MODEL}")
    print(f"Conditions: A (with API data) vs B (parametric only)")
    print()

    results = []

    async with httpx.AsyncClient() as client:
        for i, q in enumerate(questions):
            qid = q["id"]
            print(f"[{i+1}/{len(questions)}] {qid} ({q['category']}/{q['domain']})")

            api_data = api_lookup.get(qid, "")

            # Condition A: WITH API data
            t0 = time.time()
            answer_a = await ask_claude(client, q["question"], api_data=api_data)
            time_a = (time.time() - t0) * 1000

            # Rate limit
            await asyncio.sleep(1.0)

            # Condition B: WITHOUT API data (parametric only)
            t0 = time.time()
            answer_b = await ask_claude(client, q["question"], api_data=None)
            time_b = (time.time() - t0) * 1000

            # Score both
            score_a = score_answer(q, answer_a)
            score_b = score_answer(q, answer_b)

            status_a = score_a["status"]
            status_b = score_b["status"]
            sa = f"{score_a['score']:.0%}" if score_a["score"] is not None else "N/A"
            sb = f"{score_b['score']:.0%}" if score_b["score"] is not None else "N/A"

            improvement = ""
            if score_a["score"] is not None and score_b["score"] is not None:
                diff = score_a["score"] - score_b["score"]
                if diff > 0.1:
                    improvement = " ⬆ API helped"
                elif diff < -0.1:
                    improvement = " ⬇ API hurt?"
                else:
                    improvement = " ➡ same"

            print(f"         A={sa:>4s} ({status_a:>12s})  B={sb:>4s} ({status_b:>12s}){improvement}")

            results.append({
                "id": qid,
                "category": q["category"],
                "domain": q["domain"],
                "question": q["question"],
                "correct_answer": q["correct_answer"],
                "answer_with_api": answer_a,
                "answer_without_api": answer_b,
                "score_with_api": score_a,
                "score_without_api": score_b,
                "time_with_api_ms": round(time_a, 1),
                "time_without_api_ms": round(time_b, 1),
            })

            # Rate limit between questions
            await asyncio.sleep(0.5)

    return results


def print_report(results: list[dict]):
    """Print comparison report."""
    print(f"\n{'='*70}")
    print("AI AGENT BENCHMARK — FINAL REPORT")
    print(f"{'='*70}\n")

    # Overall
    scores_a = [r["score_with_api"]["score"] for r in results if r["score_with_api"]["score"] is not None]
    scores_b = [r["score_without_api"]["score"] for r in results if r["score_without_api"]["score"] is not None]

    mean_a = sum(scores_a) / len(scores_a) if scores_a else 0
    mean_b = sum(scores_b) / len(scores_b) if scores_b else 0

    print(f"  OVERALL ACCURACY:")
    print(f"    With Polymer Genomics API:  {mean_a:.1%}  (n={len(scores_a)})")
    print(f"    Without API (parametric):   {mean_b:.1%}  (n={len(scores_b)})")
    print(f"    Improvement:                {mean_a - mean_b:+.1%}")

    # Pass rates
    pass_a = sum(1 for r in results if r["score_with_api"]["status"] == "pass")
    pass_b = sum(1 for r in results if r["score_without_api"]["status"] == "pass")
    print(f"\n  PASS RATES (≥70% match):")
    print(f"    With API:     {pass_a}/{len(results)} ({pass_a/len(results):.0%})")
    print(f"    Without API:  {pass_b}/{len(results)} ({pass_b/len(results):.0%})")

    # Hallucination rates (for trap questions)
    traps = [r for r in results if r["category"] == "hallucination_trap"]
    if traps:
        hall_a = sum(1 for r in traps if r["score_with_api"]["status"] == "hallucinated")
        hall_b = sum(1 for r in traps if r["score_without_api"]["status"] == "hallucinated")
        print(f"\n  HALLUCINATION RATES (trap questions):")
        print(f"    With API:     {hall_a}/{len(traps)} ({hall_a/len(traps):.0%})")
        print(f"    Without API:  {hall_b}/{len(traps)} ({hall_b/len(traps):.0%})")

    # By category
    print(f"\n  BY CATEGORY:")
    print(f"  {'Category':<25s} {'With API':>10s} {'Without':>10s} {'Delta':>8s}")
    print(f"  {'-'*25} {'-'*10} {'-'*10} {'-'*8}")
    for cat in ["factual", "reasoning", "hallucination_trap"]:
        cat_results = [r for r in results if r["category"] == cat]
        if not cat_results:
            continue
        sa = [r["score_with_api"]["score"] for r in cat_results if r["score_with_api"]["score"] is not None]
        sb = [r["score_without_api"]["score"] for r in cat_results if r["score_without_api"]["score"] is not None]
        ma = sum(sa) / len(sa) if sa else 0
        mb = sum(sb) / len(sb) if sb else 0
        print(f"  {cat:<25s} {ma:>9.1%} {mb:>9.1%} {ma-mb:>+7.1%}")

    # By domain (factual)
    factual = [r for r in results if r["category"] == "factual"]
    if factual:
        print(f"\n  FACTUAL DOMAIN BREAKDOWN:")
        print(f"  {'Domain':<40s} {'With API':>10s} {'Without':>10s} {'Delta':>8s}")
        print(f"  {'-'*40} {'-'*10} {'-'*10} {'-'*8}")

        domains: dict[str, list] = {}
        for r in factual:
            d = r["domain"]
            if d not in domains:
                domains[d] = []
            domains[d].append(r)

        for domain in sorted(domains.keys()):
            items = domains[domain]
            sa = [r["score_with_api"]["score"] for r in items if r["score_with_api"]["score"] is not None]
            sb = [r["score_without_api"]["score"] for r in items if r["score_without_api"]["score"] is not None]
            ma = sum(sa) / len(sa) if sa else 0
            mb = sum(sb) / len(sb) if sb else 0
            print(f"  {domain:<40s} {ma:>9.1%} {mb:>9.1%} {ma-mb:>+7.1%}")

    # Biggest wins (API helped most)
    scorable = [r for r in results
                if r["score_with_api"]["score"] is not None and r["score_without_api"]["score"] is not None]
    scorable.sort(key=lambda r: (r["score_with_api"]["score"] - r["score_without_api"]["score"]), reverse=True)

    print(f"\n  TOP 5 — API HELPED MOST:")
    for r in scorable[:5]:
        delta = r["score_with_api"]["score"] - r["score_without_api"]["score"]
        print(f"    {r['id']:5s} {delta:+.0%}  A={r['score_with_api']['score']:.0%} B={r['score_without_api']['score']:.0%}  {r['domain']}")

    print(f"\n  TOP 5 — API HELPED LEAST:")
    for r in scorable[-5:]:
        delta = r["score_with_api"]["score"] - r["score_without_api"]["score"]
        print(f"    {r['id']:5s} {delta:+.0%}  A={r['score_with_api']['score']:.0%} B={r['score_without_api']['score']:.0%}  {r['domain']}")


def main():
    parser = argparse.ArgumentParser(description="AI Agent benchmark — with vs without API")
    parser.add_argument("--category", choices=["factual", "reasoning", "hallucination_trap"])
    parser.add_argument("--start-from", default=None, help="Resume from question ID (e.g., A20)")
    parser.add_argument("--output", default="benchmark_agent_results.json")
    parser.add_argument("--questions", default=str(RESULTS_DIR / "polymer_genomics_external_validation_benchmark_100_questions.json"))
    parser.add_argument("--results-dir", default=str(RESULTS_DIR), help="Dir with benchmark_results_*.json")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ERROR: Set ANTHROPIC_API_KEY environment variable")
        sys.exit(1)

    # Load questions
    with open(args.questions) as f:
        questions = json.load(f)

    # Load API results from harness
    api_results = []
    results_dir = Path(args.results_dir)
    for cat in ["factual", "reasoning", "hallucination"]:
        path = results_dir / f"benchmark_results_{cat}.json"
        if path.exists():
            with open(path) as f:
                api_results.extend(json.load(f))
            print(f"Loaded API data: {path.name}")

    results = asyncio.run(run_benchmark(questions, api_results, args.category, args.start_from))

    print_report(results)

    output_path = results_dir / args.output
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n  Full results saved to: {output_path}")


if __name__ == "__main__":
    main()
