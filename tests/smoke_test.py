"""Production smoke test — hits critical endpoints and verifies health.

Runs against the live production API. Requires POLYMER_API_KEY env var
or uses the default test key.

Usage::

    POLYMER_API_KEY=xxx uv run pytest tests/smoke_test.py -v
    uv run pytest tests/smoke_test.py -v --tb=short
"""

import os
import time

import httpx
import pytest

API_BASE = os.environ.get("POLYMER_API_BASE", "https://api.polymerbio.org")
API_KEY = os.environ.get(
    "POLYMER_API_KEY",
    "3dc626456f6438126220e23351744f3900693fcf05b1cac316791411be423520",
)
HEADERS = {"X-API-Key": API_KEY}

# Latency thresholds (seconds)
FAST = 5.0
MEDIUM = 15.0
SLOW = 60.0


def _get(path: str, timeout: float = SLOW) -> httpx.Response:
    """GET with timing."""
    return httpx.get(f"{API_BASE}{path}", headers=HEADERS, timeout=timeout)


def _post(path: str, json: dict, timeout: float = SLOW) -> httpx.Response:
    """POST with timing."""
    return httpx.post(f"{API_BASE}{path}", headers=HEADERS, json=json, timeout=timeout)


# ---------------------------------------------------------------------------
# Infrastructure
# ---------------------------------------------------------------------------


class TestInfrastructure:
    def test_health(self):
        r = _get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"

    def test_ping(self):
        r = _get("/ping")
        assert r.status_code == 200

    def test_layers_list(self):
        r = _get("/v1/layers")
        assert r.status_code == 200
        body = r.json()
        # Layers endpoint wraps in data envelope
        layers = body.get("data", body).get("layers", body.get("layers", []))
        assert len(layers) >= 30 or "api_version" in body


# ---------------------------------------------------------------------------
# Core Endpoints
# ---------------------------------------------------------------------------


class TestGene:
    def test_gene_lookup(self):
        r = _get("/v1/genes/hg38/TP53")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"

    def test_gene_expression(self):
        r = _get("/v1/genes/hg38/TP53/expression")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["summary"]["n_tissues_detected"] > 0

    def test_gene_constraint(self):
        r = _get("/v1/genes/hg38/TP53/constraint")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["constraint"]["pli"] > 0.9

    def test_gene_pathways(self):
        r = _get("/v1/genes/hg38/TP53/pathways")
        assert r.status_code == 200
        body = r.json()
        assert body["data"]["n_pathways"] > 50

    def test_gene_search(self):
        r = _get("/v1/search?q=BRCA&build=hg38")
        assert r.status_code == 200


class TestProbe:
    def test_probe_batch(self):
        r = _post("/v1/probes/hg38/batch", json={
            "probe_ids": ["cg08796240", "cg14514483", "cg27457201"],
        })
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"
        # Response is GRanges format: data.seqnames[], data.mcols.probe_id[]
        data = body["data"]
        n = data.get("n", len(data.get("seqnames", [])))
        assert n == 3


class TestRegion:
    def test_region_query(self):
        r = _get("/v1/regions/hg38/chr17:7668421-7687490?layers=cpg_sites&limit=10")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] in ("complete", "truncated")

    def test_stats(self):
        r = _get("/v1/stats/hg38/chr17:7668421-7687490?layers=cpg_sites")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"


class TestEvaluate:
    def test_evaluate_sequence(self):
        r = _post("/v1/evaluate", json={
            "sequence": "ATCGATCGATCGATCGATCGATCGATCGATCG",
        })
        assert r.status_code == 200
        body = r.json()
        # Evaluate returns top-level keys: summary, thermodynamics, structural, etc.
        assert "summary" in body or "thermodynamics" in body


class TestTransposome:
    def test_families(self):
        r = _get("/v1/transposome/families")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"
        families = body.get("data", {}).get("families", [])
        assert len(families) > 50

    def test_probe_te_mapping(self):
        r = _get("/v1/transposome/probe-te-mapping?platform=epic_v2&build=hg38")
        assert r.status_code == 200


class TestHLA:
    def test_loci(self):
        r = _get("/v1/hla/loci")
        assert r.status_code == 200
        body = r.json()
        assert body["n_loci"] == 6

    def test_alleles(self):
        r = _get("/v1/hla/alleles/A?limit=3")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] > 5000

    def test_allele_detail(self):
        r = _get("/v1/hla/allele/A*02:01:01:01")
        assert r.status_code == 200
        body = r.json()
        assert body["identity"]["locus"] == "HLA-A"
        assert len(body["features"]) > 10

    def test_expression_correlation(self):
        r = _get("/v1/hla/expression-correlation")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"
        assert body["n_alleles"] > 100
        assert "class_distribution" in body
        assert "normal" in body["class_distribution"]

    def test_expression_correlation_per_locus(self):
        r = _get("/v1/hla/expression-correlation?locus=A&focus=both")
        assert r.status_code == 200
        body = r.json()
        assert body["n_alleles"] > 0

    def test_within_protein(self):
        r = _get("/v1/hla/expression-within-protein")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"
        assert body["n_protein_groups_total"] > 100

    def test_within_protein_with_features(self):
        r = _get("/v1/hla/expression-within-protein?locus=A&include_features=true")
        assert r.status_code == 200


class TestRecombination:
    def test_recombination_endpoint(self):
        r = _get("/v1/recombination/hg38/chr1:1000000-5000000")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "complete"
        data = body["data"]
        assert "onco_events" in data
        assert "dmc1_hotspots" in data
        assert "recombination_rates" in data
        assert data["recombination_rates"]["n"] > 0

    def test_recombination_parent_filter(self):
        r = _get("/v1/recombination/hg38/chr1:1000000-10000000?parent_type=M")
        assert r.status_code == 200
        body = r.json()
        events = body["data"]["onco_events"]
        for pt in events["mcols"].get("parent_type", []):
            assert pt == "M"

    def test_region_onco_events(self):
        r = _get("/v1/regions/hg38/chr1:1000000-5000000?layers=onco_events_v1")
        assert r.status_code == 200


class TestReference:
    def test_clock_probes(self):
        r = _get("/v1/reference/clock-probes?clock=horvath_2013")
        assert r.status_code == 200

    def test_physical_constants(self):
        r = _get("/v1/reference/physical-constants")
        assert r.status_code == 200

    def test_sequence(self):
        r = _get("/v1/sequence/hg38/chr17:7668421-7668520")
        assert r.status_code == 200
        body = r.json()
        assert len(body["data"]["sequence"]) == 100


# ---------------------------------------------------------------------------
# Latency benchmarks
# ---------------------------------------------------------------------------


class TestLatency:
    """Verify critical endpoints meet latency thresholds."""

    def test_evaluate_fast(self):
        start = time.monotonic()
        r = _post("/v1/evaluate", json={"sequence": "ATCGATCGATCGATCGATCG"})
        elapsed = time.monotonic() - start
        assert r.status_code == 200
        assert elapsed < FAST, f"Evaluate took {elapsed:.1f}s (threshold: {FAST}s)"

    def test_stats_fast(self):
        start = time.monotonic()
        r = _get("/v1/stats/hg38/chr17:7668421-7687490?layers=cpg_sites")
        elapsed = time.monotonic() - start
        assert r.status_code == 200
        assert elapsed < FAST, f"Stats took {elapsed:.1f}s (threshold: {FAST}s)"

    def test_hla_loci_fast(self):
        start = time.monotonic()
        r = _get("/v1/hla/loci")
        elapsed = time.monotonic() - start
        assert r.status_code == 200
        assert elapsed < FAST, f"HLA loci took {elapsed:.1f}s (threshold: {FAST}s)"

    def test_probe_batch_fast(self):
        start = time.monotonic()
        r = _post("/v1/probes/hg38/batch", json={"probe_ids": ["cg08796240"]})
        elapsed = time.monotonic() - start
        assert r.status_code == 200
        assert elapsed < FAST, f"Probe batch took {elapsed:.1f}s (threshold: {FAST}s)"
