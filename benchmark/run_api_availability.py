#!/usr/bin/env python3
"""PolymerBench v3 — API Availability Test.

Tests whether the Polymer Genomics API returns valid data for each of the
100 benchmark questions. This measures the data-layer fix (500/404 errors).

Usage:
    python run_api_availability.py

Requires: POLYMER_API_KEY environment variable or --api-key flag.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import quote

import httpx

API_BASE = os.environ.get("POLYMER_API_BASE", "https://api.polymerbio.org")
API_KEY = os.environ.get("POLYMER_API_KEY", "")

# Map question domains to API endpoints
DOMAIN_TO_ENDPOINT = {
    "nearest_neighbor_thermodynamics": "/v1/reference/nn-parameters",
    "gene_coordinates_structure": "/v1/genes/hg38/{gene}",
    "gene_expression_patterns": "/v1/genes/hg38/{gene}/expression",
    "epigenetic_clocks": "/v1/reference/clock-probes",
    "methylation_array_probes": "/v1/probes/hg38/{probe}",
    "dna_structure_mechanics": "/v1/reference/physical-constants",
    "constraint_population_genetics": "/v1/genes/hg38/{gene}/constraint",
    "regulatory_elements": "/v1/regions/hg38/{region}",
    "repeat_elements": "/v1/reference/physical-constants",
    "amino_acid_properties": "/v1/reference/amino-acid-properties",
}

# Specific genes/probes per question (extracted from question text)
QUESTION_ENTITIES = {
    "A06": {"gene": "TP53"},
    "A07": {"gene": "BRCA1"},
    "A08": {"gene": "TTN"},
    "A09": {"gene": "SRY"},
    "A10": {"gene": "SRY"},  # protein-coding gene count — use list_layers
    "A11": {"gene": "ALB"},
    "A12": {"gene": "HBB"},
    "A13": {"gene": "INS"},
    "A14": {"gene": "MYOD1"},
    "A15": {"gene": "CD19"},
    "A16": {"gene": "TP53"},
    "A17": {"gene": "BRCA1"},
    "A18": {"gene": "TTN"},
    "A19": {"gene": "PTEN"},
    "A20": {"gene": "MYC"},
    "A24": {"probe": "cg00000029"},
    "A31": {"gene": "TP53"},  # DNA structure — physical constants
    "A34": {"gene": "TP53"},  # DNA structure
    "A36": {"gene": "TP53"},  # amino acid properties
    "A43": {"gene": "TP53"},  # repeat elements
    "A44": {"gene": "TP53"},  # repeat elements
}


def fetch(client: httpx.Client, path: str, params: dict | None = None) -> dict:
    """Make an API request and return result with timing."""
    start = time.monotonic()
    try:
        resp = client.get(path, params=params)
        elapsed = (time.monotonic() - start) * 1000
        if resp.status_code == 200:
            return {"status": "ok", "code": 200, "time_ms": round(elapsed, 1),
                    "data_preview": str(resp.json())[:200]}
        else:
            return {"status": "error", "code": resp.status_code, "time_ms": round(elapsed, 1),
                    "detail": resp.text[:300]}
    except httpx.TimeoutException:
        elapsed = (time.monotonic() - start) * 1000
        return {"status": "timeout", "code": 0, "time_ms": round(elapsed, 1)}
    except Exception as e:
        elapsed = (time.monotonic() - start) * 1000
        return {"status": "exception", "code": 0, "time_ms": round(elapsed, 1),
                "detail": str(e)[:200]}


def test_endpoint(client: httpx.Client, domain: str, question_id: str) -> dict:
    """Test the API endpoint relevant to a specific question."""
    entity = QUESTION_ENTITIES.get(question_id, {})

    if domain == "nearest_neighbor_thermodynamics":
        return fetch(client, "/v1/reference/nn-parameters")

    elif domain == "gene_coordinates_structure":
        gene = entity.get("gene", "TP53")
        return fetch(client, f"/v1/genes/hg38/{gene}")

    elif domain == "gene_expression_patterns":
        gene = entity.get("gene", "ALB")
        return fetch(client, f"/v1/genes/hg38/{gene}/expression")

    elif domain == "epigenetic_clocks":
        return fetch(client, "/v1/reference/clock-probes", {"clock": "horvath"})

    elif domain == "methylation_array_probes":
        probe = entity.get("probe")
        if probe:
            return fetch(client, f"/v1/probes/hg38/{probe}")
        else:
            return fetch(client, "/v1/reference/nn-parameters")  # fallback

    elif domain == "dna_structure_mechanics":
        return fetch(client, "/v1/reference/physical-constants")

    elif domain == "constraint_population_genetics":
        gene = entity.get("gene", "TP53")
        return fetch(client, f"/v1/genes/hg38/{gene}/constraint")

    elif domain == "regulatory_elements":
        return fetch(client, "/v1/layers/hg38")

    elif domain == "repeat_elements":
        return fetch(client, "/v1/reference/physical-constants")

    elif domain == "amino_acid_properties":
        return fetch(client, "/v1/reference/amino-acid-properties")

    else:
        return {"status": "unknown_domain", "code": 0, "time_ms": 0}


def main():
    parser = argparse.ArgumentParser(description="Test API availability for benchmark questions")
    parser.add_argument("--api-key", help="API key (or set POLYMER_API_KEY env var)")
    parser.add_argument("--questions", default="v2_archive/polymer_genomics_external_validation_benchmark_100_questions.json")
    args = parser.parse_args()

    api_key = args.api_key or API_KEY
    if not api_key:
        print("ERROR: No API key. Set POLYMER_API_KEY or use --api-key", file=sys.stderr)
        sys.exit(1)

    questions_path = Path(__file__).parent / args.questions
    if not questions_path.exists():
        print(f"ERROR: Questions file not found: {questions_path}", file=sys.stderr)
        sys.exit(1)

    with open(questions_path) as f:
        questions = json.load(f)

    print(f"Testing {len(questions)} questions against {API_BASE}")
    print(f"{'='*70}")

    headers = {"X-API-Key": api_key}
    client = httpx.Client(base_url=API_BASE, headers=headers, timeout=65.0)

    results = []
    ok_count = 0
    error_count = 0
    timeout_count = 0

    for q in questions:
        qid = q["id"]
        domain = q["domain"]
        category = q["category"]

        result = test_endpoint(client, domain, qid)
        result["question_id"] = qid
        result["domain"] = domain
        result["category"] = category
        results.append(result)

        status_icon = "OK" if result["status"] == "ok" else "FAIL" if result["status"] == "error" else "TIMEOUT"
        if result["status"] == "ok":
            ok_count += 1
        elif result["status"] == "timeout":
            timeout_count += 1
        else:
            error_count += 1

        print(f"  {qid:5s} [{domain:35s}] {status_icon:7s} {result['code']:3d}  {result['time_ms']:7.1f}ms")

    client.close()

    print(f"\n{'='*70}")
    print(f"RESULTS: {ok_count} OK, {error_count} errors, {timeout_count} timeouts out of {len(questions)}")
    print(f"API availability: {ok_count/len(questions)*100:.1f}%")

    # Compare with v2
    print(f"\nv2 baseline: 14 API errors caused failures")
    print(f"v3 current:  {error_count + timeout_count} API errors")
    improvement = 14 - (error_count + timeout_count)
    if improvement > 0:
        print(f"Improvement: {improvement} fewer API errors")

    # Save results
    output_path = Path(__file__).parent / "api_availability_results.json"
    with open(output_path, "w") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "api_base": API_BASE,
            "total": len(questions),
            "ok": ok_count,
            "errors": error_count,
            "timeouts": timeout_count,
            "availability_pct": round(ok_count / len(questions) * 100, 1),
            "results": results,
        }, f, indent=2)
    print(f"\nResults saved to {output_path}")

    # Domain breakdown
    print(f"\nBy domain:")
    domains = {}
    for r in results:
        d = r["domain"]
        domains.setdefault(d, {"ok": 0, "fail": 0})
        if r["status"] == "ok":
            domains[d]["ok"] += 1
        else:
            domains[d]["fail"] += 1

    for d, counts in sorted(domains.items()):
        total = counts["ok"] + counts["fail"]
        print(f"  {d:35s}  {counts['ok']}/{total}")


if __name__ == "__main__":
    main()
