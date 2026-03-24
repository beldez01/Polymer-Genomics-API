"""External validation benchmark harness for Polymer Genomics.

Runs 100 questions against the Polymer Genomics API via MCP tools and scores
answers against ground truth. Produces accuracy report by category and domain.

Usage:
    # Run all questions against the live API (requires MCP server running)
    uv run python scripts/benchmark_harness.py

    # Run specific categories
    uv run python scripts/benchmark_harness.py --category factual
    uv run python scripts/benchmark_harness.py --category hallucination_trap

    # Dry run (print questions without calling API)
    uv run python scripts/benchmark_harness.py --dry-run

    # Output results as JSON
    uv run python scripts/benchmark_harness.py --output results.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import httpx

# ── Configuration ────────────────────────────────────────────────────────────

API_BASE = os.environ.get("POLYMER_API_BASE", "https://api.polymerbio.org")
API_KEY = os.environ.get("POLYMER_API_KEY", "")

QUESTIONS_FILE = Path(__file__).parent.parent / "polymer_genomics_external_validation_benchmark_100_questions.json"


# ── API Client ───────────────────────────────────────────────────────────────

async def api_call(client: httpx.AsyncClient, method: str, path: str, **kwargs) -> dict:
    """Make an authenticated API call."""
    headers = {"X-API-Key": API_KEY} if API_KEY else {}
    url = f"{API_BASE}{path}"

    if method == "GET":
        resp = await client.get(url, headers=headers, params=kwargs.get("params"), timeout=60)
    elif method == "POST":
        resp = await client.post(url, headers=headers, json=kwargs.get("json"), timeout=60)
    else:
        raise ValueError(f"Unknown method: {method}")

    if resp.status_code != 200:
        return {"error": resp.status_code, "detail": resp.text[:500]}
    return resp.json()


# ── Question Handlers ────────────────────────────────────────────────────────
# Each handler takes a question dict and returns the API's answer as a string.
# The handlers know which API endpoints to call based on the question domain.

async def handle_nn_thermodynamics(client: httpx.AsyncClient, q: dict) -> str:
    """Answer nearest-neighbor thermodynamics questions."""
    data = await api_call(client, "GET", "/v1/reference/nn-parameters", params={"duplex_type": "dna_dna"})
    if "error" in data:
        return f"API error: {data}"
    params = data.get("data", {}).get("parameters", [])
    return json.dumps(params, indent=2)


async def handle_gene_coordinates(client: httpx.AsyncClient, q: dict) -> str:
    """Answer gene coordinate questions by looking up genes."""
    # Extract gene name from question
    question = q["question"]
    for gene in ["TP53", "BRCA1", "BRCA2", "TTN", "SRY", "ALB", "HBB", "INS", "EGFR", "MYC"]:
        if gene in question.upper():
            data = await api_call(client, "GET", f"/v1/genes/hg38/{gene}")
            if "error" in data:
                return f"API error: {data}"
            return json.dumps(data.get("data", {}), indent=2)[:5000]
    # GENCODE stats question
    if "protein-coding" in question.lower() and "gencode" in question.lower():
        data = await api_call(client, "GET", "/v1/layers", params={"build": "hg38"})
        return json.dumps(data, indent=2)[:3000]
    return "Could not determine which gene to look up from question."


async def handle_gene_expression(client: httpx.AsyncClient, q: dict) -> str:
    """Answer expression questions."""
    question = q["question"]
    for gene in ["ALB", "HBB", "INS", "TTN", "TP53", "ACTB", "GAPDH", "CDH1", "CD19", "MYH7", "KRT14"]:
        if gene in question.upper():
            data = await api_call(client, "GET", f"/v1/expression/hg38/{gene}")
            if "error" in data:
                return f"API error: {data}"
            return json.dumps(data.get("data", {}), indent=2)[:3000]
    return "Could not determine which gene to look up."


async def handle_constraint(client: httpx.AsyncClient, q: dict) -> str:
    """Answer gnomAD constraint questions."""
    question = q["question"]
    for gene in ["TP53", "BRCA1", "BRCA2", "SCN1A", "TTN", "PCSK9", "MECP2", "PTEN", "MYC", "LMNA", "CFTR", "TET2", "DNMT3A", "SOX9"]:
        if gene in question.upper():
            data = await api_call(client, "GET", f"/v1/gene-constraint/hg38/{gene}")
            if "error" in data:
                return f"API error: {data}"
            return json.dumps(data.get("data", {}), indent=2)
    return "Could not determine which gene to look up."


async def handle_probes(client: httpx.AsyncClient, q: dict) -> str:
    """Answer methylation probe questions."""
    question = q["question"]
    # Extract probe ID
    import re
    probe_match = re.search(r'cg\d{7,8}', question)
    if probe_match:
        probe_id = probe_match.group()
        data = await api_call(client, "GET", f"/v1/probes/hg38/{probe_id}")
        if "error" in data:
            return f"API error: {data}"
        return json.dumps(data.get("data", {}), indent=2)
    # Platform count question
    data = await api_call(client, "GET", "/v1/layers", params={"build": "hg38"})
    return json.dumps(data, indent=2)[:3000]


async def handle_clocks(client: httpx.AsyncClient, q: dict) -> str:
    """Answer epigenetic clock questions."""
    question = q["question"].lower()
    for clock in ["horvath_2013", "hannum_2013", "phenoage_2018", "grimage_2019", "dunedinpace_2022"]:
        if clock.replace("_", " ").replace("2013", "").replace("2018", "").replace("2019", "").replace("2022", "").strip() in question:
            data = await api_call(client, "GET", "/v1/reference/clock-probes", params={"clock": clock})
            if "error" in data:
                return f"API error: {data}"
            clock_data = data.get("data", {})
            # Truncate probe list for readability
            if "probes" in clock_data and len(clock_data["probes"]) > 10:
                clock_data["probes_sample"] = clock_data["probes"][:5]
                clock_data["probes"] = f"[{len(clock_data['probes'])} probes total, showing first 5]"
            return json.dumps(clock_data, indent=2)
    # Check for specific probe in clock
    import re
    probe_match = re.search(r'cg\d{7,8}', question)
    if probe_match:
        data = await api_call(client, "GET", "/v1/reference/clock-probes", params={"probe_id": probe_match.group()})
        return json.dumps(data.get("data", {}), indent=2)
    return "Could not determine which clock to query."


async def handle_physical_constants(client: httpx.AsyncClient, q: dict) -> str:
    """Answer DNA structure/mechanics questions."""
    data = await api_call(client, "GET", "/v1/reference/physical-constants")
    if "error" in data:
        return f"API error: {data}"
    return json.dumps(data.get("data", {}), indent=2)[:5000]


async def handle_amino_acids(client: httpx.AsyncClient, q: dict) -> str:
    """Answer amino acid property questions."""
    data = await api_call(client, "GET", "/v1/reference/amino-acid-properties")
    if "error" in data:
        return f"API error: {data}"
    return json.dumps(data.get("data", {}), indent=2)[:5000]


async def handle_repeats(client: httpx.AsyncClient, q: dict) -> str:
    """Answer repeat element questions."""
    data = await api_call(client, "GET", "/v1/layers", params={"build": "hg38"})
    return json.dumps(data, indent=2)[:3000]


async def handle_regulatory(client: httpx.AsyncClient, q: dict) -> str:
    """Answer regulatory element questions."""
    data = await api_call(client, "GET", "/v1/layers", params={"build": "hg38"})
    return json.dumps(data, indent=2)[:3000]


async def handle_gene_sets(client: httpx.AsyncClient, q: dict) -> str:
    """Answer MSigDB/Reactome questions."""
    question = q["question"]
    for gene in ["TP53", "MYC", "CDKN1A", "VEGFA", "BCL2", "ESR1", "CCND1", "HIF1A", "TGFB1", "MTOR", "TNF",
                 "EGFR", "BRCA1", "IL6", "AKT1", "NOTCH1", "BAX", "MDM2", "GADD45A"]:
        if gene in question.upper():
            # Try gene sets first
            gs_data = await api_call(client, "GET", f"/v1/gene-sets/hg38/{gene}")
            pw_data = await api_call(client, "GET", f"/v1/gene-pathways/hg38/{gene}")
            result = {}
            if "error" not in gs_data:
                result["gene_sets"] = gs_data.get("data", {})
            if "error" not in pw_data:
                pw = pw_data.get("data", {})
                if "pathways" in pw and len(pw["pathways"]) > 20:
                    pw["pathways"] = pw["pathways"][:20]
                    pw["pathways_truncated"] = True
                result["pathways"] = pw
            return json.dumps(result, indent=2)[:5000]
    return "Could not determine which gene to look up."


async def handle_dinucleotide(client: httpx.AsyncClient, q: dict) -> str:
    """Answer dinucleotide property questions."""
    data = await api_call(client, "GET", "/v1/reference/dinucleotide-properties")
    if "error" in data:
        return f"API error: {data}"
    return json.dumps(data.get("data", {}), indent=2)[:5000]


async def handle_sbs(client: httpx.AsyncClient, q: dict) -> str:
    """Answer SBS mutation spectrum questions."""
    data = await api_call(client, "GET", "/v1/reference/sbs-spectrum")
    if "error" in data:
        return f"API error: {data}"
    return json.dumps(data.get("data", {}), indent=2)[:5000]


async def handle_biophysics(client: httpx.AsyncClient, q: dict) -> str:
    """Answer biophysics computation questions."""
    # Try to find a region in the question
    import re
    region_match = re.search(r'chr\d+:\d+-\d+', q["question"])
    if region_match:
        region = region_match.group()
        data = await api_call(client, "GET", f"/v1/biophysics/hg38/{region}")
        return json.dumps(data.get("data", {}), indent=2)[:5000]
    return "Could not extract a genomic region from the question."


async def handle_generic(client: httpx.AsyncClient, q: dict) -> str:
    """Fallback handler — return platform summary."""
    data = await api_call(client, "GET", "/v1/layers", params={"build": "hg38"})
    return json.dumps(data, indent=2)[:3000]


# Domain → handler mapping
DOMAIN_HANDLERS = {
    "nearest_neighbor_thermodynamics": handle_nn_thermodynamics,
    "gene_coordinates_structure": handle_gene_coordinates,
    "gene_expression_patterns": handle_gene_expression,
    "constraint_population_genetics": handle_constraint,
    "methylation_array_probes": handle_probes,
    "epigenetic_clocks": handle_clocks,
    "dna_structure_mechanics": handle_physical_constants,
    "amino_acid_properties": handle_amino_acids,
    "repeat_elements": handle_repeats,
    "regulatory_elements": handle_regulatory,
}


def get_handler(domain: str):
    """Get the appropriate handler for a domain."""
    if domain in DOMAIN_HANDLERS:
        return DOMAIN_HANDLERS[domain]
    # Reasoning and hallucination trap questions — route by content
    if "hallmark" in domain or "pathway" in domain or "reactome" in domain or "signature" in domain:
        return handle_gene_sets
    if "clock" in domain:
        return handle_clocks
    if "probe" in domain or "methylation" in domain or "ewas" in domain:
        return handle_probes
    if "sbs" in domain or "mutation" in domain:
        return handle_sbs
    if "constraint" in domain or "gnomad" in domain:
        return handle_constraint
    if "expression" in domain or "housekeeping" in domain:
        return handle_gene_expression
    if "biophysic" in domain or "thermodynamic" in domain or "fragility" in domain or "stacking" in domain:
        return handle_biophysics
    if "gene" in domain or "variant" in domain or "coordinate" in domain:
        return handle_gene_coordinates
    if "amino" in domain or "protein" in domain:
        return handle_amino_acids
    if "repeat" in domain or "line1" in domain or "ancient" in domain:
        return handle_repeats
    if "regulat" in domain or "crispr" in domain or "chromatin" in domain or "accessibility" in domain:
        return handle_regulatory
    if "g4" in domain or "non_b" in domain:
        return handle_dinucleotide
    return handle_generic


# ── Main Runner ──────────────────────────────────────────────────────────────

async def run_benchmark(
    questions: list[dict],
    category_filter: str | None = None,
    dry_run: bool = False,
) -> list[dict]:
    """Run all questions and collect API responses."""
    results = []

    if category_filter:
        questions = [q for q in questions if q["category"] == category_filter]

    print(f"\n{'='*70}")
    print(f"POLYMER GENOMICS EXTERNAL VALIDATION BENCHMARK")
    print(f"{'='*70}")
    print(f"Questions: {len(questions)}")
    print(f"API: {API_BASE}")
    print(f"Auth: {'Yes' if API_KEY else 'No (set POLYMER_API_KEY)'}")
    print()

    async with httpx.AsyncClient() as client:
        for i, q in enumerate(questions):
            qid = q["id"]
            domain = q["domain"]
            category = q["category"]

            print(f"[{i+1}/{len(questions)}] {qid} ({category}/{domain})")

            if dry_run:
                results.append({
                    **q,
                    "api_response": "(dry run)",
                    "response_time_ms": 0,
                })
                continue

            handler = get_handler(domain)
            t0 = time.time()
            try:
                api_response = await handler(client, q)
            except Exception as e:
                api_response = f"ERROR: {e}"
            elapsed = (time.time() - t0) * 1000

            results.append({
                **q,
                "api_response": api_response,
                "response_time_ms": round(elapsed, 1),
            })

            # Rate limit
            await asyncio.sleep(0.2)

    return results


def print_report(results: list[dict]):
    """Print summary report."""
    print(f"\n{'='*70}")
    print("BENCHMARK RESULTS")
    print(f"{'='*70}\n")

    # By category
    cats = {}
    for r in results:
        cat = r["category"]
        if cat not in cats:
            cats[cat] = {"total": 0, "errors": 0, "times": []}
        cats[cat]["total"] += 1
        if "ERROR" in str(r.get("api_response", "")) or "error" in str(r.get("api_response", "")):
            cats[cat]["errors"] += 1
        cats[cat]["times"].append(r.get("response_time_ms", 0))

    for cat, stats in sorted(cats.items()):
        avg_time = sum(stats["times"]) / len(stats["times"]) if stats["times"] else 0
        print(f"  {cat:25s}: {stats['total']:3d} questions, {stats['errors']:2d} API errors, avg {avg_time:.0f}ms")

    # By domain
    print(f"\n  {'Domain':<45s} {'Count':>5s} {'Errors':>6s}")
    print(f"  {'-'*45} {'-'*5} {'-'*6}")
    domains = {}
    for r in results:
        d = r["domain"]
        if d not in domains:
            domains[d] = {"total": 0, "errors": 0}
        domains[d]["total"] += 1
        if "ERROR" in str(r.get("api_response", "")) or "error" in str(r.get("api_response", "")):
            domains[d]["errors"] += 1

    for d, stats in sorted(domains.items(), key=lambda x: -x[1]["total"]):
        print(f"  {d:<45s} {stats['total']:>5d} {stats['errors']:>6d}")

    # Overall timing
    times = [r.get("response_time_ms", 0) for r in results if r.get("response_time_ms", 0) > 0]
    if times:
        print(f"\n  Timing: mean={sum(times)/len(times):.0f}ms, "
              f"median={sorted(times)[len(times)//2]:.0f}ms, "
              f"max={max(times):.0f}ms")

    print(f"\n  NOTE: API response data saved. Manual scoring against ground truth")
    print(f"  is required — compare api_response vs correct_answer for each question.")


def main():
    parser = argparse.ArgumentParser(description="Polymer Genomics external validation benchmark")
    parser.add_argument("--category", choices=["factual", "reasoning", "hallucination_trap"])
    parser.add_argument("--dry-run", action="store_true", help="Print questions without API calls")
    parser.add_argument("--output", default=None, help="Save results to JSON file")
    parser.add_argument("--questions", default=str(QUESTIONS_FILE), help="Path to questions JSON")
    args = parser.parse_args()

    with open(args.questions) as f:
        questions = json.load(f)

    results = asyncio.run(run_benchmark(questions, args.category, args.dry_run))

    print_report(results)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n  Results saved to: {args.output}")


if __name__ == "__main__":
    main()
