#!/usr/bin/env python3
"""PolymerBench v3 — Full Benchmark Runner.

Tests 100 genomics questions with and without Polymer API data.
Uses Claude Sonnet for evaluation (fast, cheap).

Usage:
    ANTHROPIC_API_KEY=sk-... python run_benchmark_v3.py
"""
import json
import os
import sys
import time
from pathlib import Path

import anthropic
import httpx

# ── Config ──────────────────────────────────────────────────────────
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
POLYMER_KEY = os.environ.get("POLYMER_API_KEY", "")
POLYMER_BASE = os.environ.get("POLYMER_API_BASE", "https://api.polymerbio.org")
MODEL = "claude-sonnet-4-20250514"
QUESTIONS_PATH = Path(__file__).parent / "v2_archive" / "polymer_genomics_external_validation_benchmark_100_questions.json"
OUTPUT_PATH = Path(__file__).parent / "benchmark_v3_results.json"

# ── API call mapping ────────────────────────────────────────────────
# Maps (domain, question_id) to the API call that should answer it
def get_api_call(domain: str, qid: str, question: str) -> tuple[str, dict]:
    """Return (endpoint_path, params) for the relevant API call."""
    # Extract gene/probe from question text (simple heuristics)
    q = question.upper()

    if domain == "nearest_neighbor_thermodynamics":
        return "/v1/reference/nn-parameters", {}

    elif domain == "gene_coordinates_structure":
        for gene in ["TP53", "BRCA1", "TTN", "SRY"]:
            if gene in q:
                return f"/v1/genes/hg38/{gene}", {}
        return "/v1/layers/hg38", {}

    elif domain == "gene_expression_patterns":
        for gene in ["ALB", "HBB", "INS", "MYOD1", "CD19"]:
            if gene in q:
                return f"/v1/genes/hg38/{gene}/expression", {}
        return "/v1/layers/hg38", {}

    elif domain == "epigenetic_clocks":
        if "HORVATH" in q:
            return "/v1/reference/clock-probes", {"clock": "horvath"}
        elif "HANNUM" in q:
            return "/v1/reference/clock-probes", {"clock": "hannum"}
        elif "PHENOAGE" in q or "LEVINE" in q:
            return "/v1/reference/clock-probes", {"clock": "pheno_age"}
        elif "GRIMAGE" in q:
            return "/v1/reference/clock-probes", {"clock": "grim_age"}
        elif "DUNEDINPACE" in q:
            return "/v1/reference/clock-probes", {"clock": "dunedin_pace"}
        elif "PAN-TISSUE" in q or "BLOOD" in q:
            return "/v1/reference/clock-probes", {"clock": "horvath"}
        return "/v1/reference/clock-probes", {}

    elif domain == "methylation_array_probes":
        # Look for cg probe IDs
        import re
        probes = re.findall(r'cg\d+', question.lower())
        if probes:
            return f"/v1/probes/hg38/{probes[0]}", {}
        return "/v1/layers/hg38", {}

    elif domain == "dna_structure_mechanics":
        return "/v1/reference/physical-constants", {}

    elif domain == "constraint_population_genetics":
        for gene in ["TP53", "BRCA1", "TTN", "PTEN", "MYC"]:
            if gene in q:
                return f"/v1/genes/hg38/{gene}/constraint", {}
        return "/v1/layers/hg38", {}

    elif domain == "regulatory_elements":
        return "/v1/layers/hg38", {}

    elif domain == "repeat_elements":
        return "/v1/reference/physical-constants", {}

    elif domain == "amino_acid_properties":
        return "/v1/reference/amino-acid-properties", {}

    return "/v1/layers/hg38", {}


def fetch_api(client: httpx.Client, path: str, params: dict) -> dict:
    """Call Polymer API, return response or error."""
    try:
        resp = client.get(path, params=params)
        if resp.status_code == 200:
            data = resp.json()
            # Truncate large responses to avoid token waste
            text = json.dumps(data)
            if len(text) > 8000:
                text = text[:8000] + "\n... [truncated]"
            return {"status": "ok", "code": 200, "data": text}
        else:
            return {"status": "error", "code": resp.status_code, "data": resp.text[:500]}
    except httpx.TimeoutException:
        return {"status": "timeout", "code": 0, "data": "Request timed out"}
    except Exception as e:
        return {"status": "exception", "code": 0, "data": str(e)[:300]}


def ask_claude(client, question, api_context):
    """Ask Claude a question, optionally with API context. Returns (answer, time_ms)."""
    if api_context:
        system = (
            "You are a genomics expert. Answer the question using the API data provided. "
            "If the API data contains an error or doesn't address the question, "
            "answer from your training knowledge instead — do NOT refuse to answer. "
            "Be concise and precise. Give the specific value or fact requested."
        )
        user_msg = f"API data:\n{api_context}\n\nQuestion: {question}"
    else:
        system = (
            "You are a genomics expert. Answer the question from your knowledge. "
            "Be concise and precise. Give the specific value or fact requested. "
            "If you're unsure, give your best estimate rather than refusing."
        )
        user_msg = question

    start = time.monotonic()
    resp = client.messages.create(
        model=MODEL,
        max_tokens=500,
        system=system,
        messages=[{"role": "user", "content": user_msg}],
    )
    elapsed = (time.monotonic() - start) * 1000
    return resp.content[0].text, elapsed


def score_answer(answer: str, correct: str) -> dict:
    """Score an answer against ground truth using keyword/number matching."""
    import re

    answer_lower = answer.lower()
    correct_lower = correct.lower()

    # Extract numbers from correct answer
    correct_nums = re.findall(r'[-+]?\d*\.?\d+', correct_lower)
    # Extract key terms (words > 3 chars, not common)
    stop = {"the", "and", "for", "with", "that", "this", "from", "have", "been", "more", "than", "most", "kcal", "mol"}
    correct_terms = [w for w in re.findall(r'[a-z][a-z0-9_]+', correct_lower) if len(w) > 3 and w not in stop]

    matched_nums = []
    missed_nums = []
    for n in correct_nums:
        if n in answer_lower:
            matched_nums.append(n)
        else:
            missed_nums.append(n)

    matched_terms = []
    missed_terms = []
    for t in correct_terms:
        if t in answer_lower:
            matched_terms.append(t)
        else:
            missed_terms.append(t)

    total = len(correct_nums) + len(correct_terms)
    matched = len(matched_nums) + len(matched_terms)

    if total == 0:
        score = 1.0 if any(w in answer_lower for w in correct_lower.split()) else 0.0
    else:
        score = matched / total

    status = "pass" if score >= 0.8 else "partial" if score > 0 else "fail"

    return {
        "score": round(score, 3),
        "status": status,
        "num_match": f"{len(matched_nums)}/{len(correct_nums)}",
        "term_match": f"{len(matched_terms)}/{len(correct_terms)}",
        "matched_nums": matched_nums,
        "missed_nums": missed_nums,
        "matched_terms": matched_terms,
        "missed_terms": missed_terms,
    }


def main():
    if not ANTHROPIC_KEY:
        print("ERROR: Set ANTHROPIC_API_KEY", file=sys.stderr)
        sys.exit(1)
    if not POLYMER_KEY:
        print("ERROR: Set POLYMER_API_KEY", file=sys.stderr)
        sys.exit(1)

    with open(QUESTIONS_PATH) as f:
        questions = json.load(f)

    print(f"PolymerBench v3 — {len(questions)} questions")
    print(f"Model: {MODEL}")
    print(f"API: {POLYMER_BASE}")
    print(f"{'='*70}")

    polymer_client = httpx.Client(
        base_url=POLYMER_BASE,
        headers={"X-API-Key": POLYMER_KEY},
        timeout=65.0,
    )
    claude_client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    results = []
    with_total = 0.0
    without_total = 0.0
    api_ok = 0
    api_fail = 0

    for i, q in enumerate(questions):
        qid = q["id"]
        domain = q["domain"]
        category = q["category"]
        question = q["question"]
        correct = q["correct_answer"]

        # Step 1: Fetch API data
        path, params = get_api_call(domain, qid, question)
        api_result = fetch_api(polymer_client, path, params)

        if api_result["status"] == "ok":
            api_ok += 1
            api_context = api_result["data"]
        else:
            api_fail += 1
            api_context = json.dumps({"error": api_result["status"], "detail": api_result["data"]})

        # Step 2: Ask Claude WITH API data
        try:
            answer_with, time_with = ask_claude(claude_client, question, api_context)
        except Exception as e:
            answer_with = f"Error: {e}"
            time_with = 0

        # Step 3: Ask Claude WITHOUT API data
        try:
            answer_without, time_without = ask_claude(claude_client, question, None)
        except Exception as e:
            answer_without = f"Error: {e}"
            time_without = 0

        # Step 4: Score both
        score_with = score_answer(answer_with, correct)
        score_without = score_answer(answer_without, correct)

        with_total += score_with["score"]
        without_total += score_without["score"]

        # Determine delta
        delta = score_with["score"] - score_without["score"]
        delta_icon = "+" if delta > 0 else "-" if delta < 0 else "="

        api_icon = "OK" if api_result["status"] == "ok" else "ERR"
        print(f"  {qid:5s} [{category:20s}] API:{api_icon:3s}  with={score_with['score']:.2f}  without={score_without['score']:.2f}  {delta_icon}  ({domain})")

        results.append({
            "id": qid,
            "category": category,
            "domain": domain,
            "question": question,
            "correct_answer": correct,
            "api_status": api_result["status"],
            "api_code": api_result["code"],
            "answer_with_api": answer_with,
            "answer_without_api": answer_without,
            "score_with_api": score_with,
            "score_without_api": score_without,
            "time_with_api_ms": round(time_with, 1),
            "time_without_api_ms": round(time_without, 1),
        })

    polymer_client.close()

    # ── Summary ──────────────────────────────────────────────────────
    n = len(questions)
    print(f"\n{'='*70}")
    print(f"RESULTS")
    print(f"  API availability:  {api_ok}/{n} ({api_ok/n*100:.1f}%)")
    print(f"  With API:          {with_total:.1f}/{n} ({with_total/n*100:.1f}%)")
    print(f"  Without API:       {without_total:.1f}/{n} ({without_total/n*100:.1f}%)")
    print(f"  Delta:             {with_total - without_total:+.1f} points")
    print()

    # Count improvements
    improved = sum(1 for r in results if r["score_with_api"]["score"] > r["score_without_api"]["score"])
    degraded = sum(1 for r in results if r["score_with_api"]["score"] < r["score_without_api"]["score"])
    same = sum(1 for r in results if r["score_with_api"]["score"] == r["score_without_api"]["score"])
    print(f"  Improved by API:   {improved}/{n}")
    print(f"  Degraded by API:   {degraded}/{n}")
    print(f"  Same:              {same}/{n}")
    print()

    # By category
    for cat in ["factual", "hallucination_trap", "reasoning"]:
        cat_results = [r for r in results if r["category"] == cat]
        if cat_results:
            cat_with = sum(r["score_with_api"]["score"] for r in cat_results)
            cat_without = sum(r["score_without_api"]["score"] for r in cat_results)
            cn = len(cat_results)
            print(f"  {cat:25s}  with={cat_with:.1f}/{cn} ({cat_with/cn*100:.1f}%)  without={cat_without:.1f}/{cn} ({cat_without/cn*100:.1f}%)")

    # v2 comparison
    print(f"\n  v2 COMPARISON:")
    print(f"  v2 with API:    40.1/100")
    print(f"  v2 without API: 46.5/100")
    print(f"  v3 with API:    {with_total:.1f}/100")
    print(f"  v3 without API: {without_total:.1f}/100")

    # Save results
    output = {
        "benchmark_version": "v3",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model": MODEL,
        "api_base": POLYMER_BASE,
        "summary": {
            "total": n,
            "api_ok": api_ok,
            "api_fail": api_fail,
            "score_with_api": round(with_total, 3),
            "score_without_api": round(without_total, 3),
            "delta": round(with_total - without_total, 3),
            "improved": improved,
            "degraded": degraded,
            "same": same,
        },
        "results": results,
    }
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
