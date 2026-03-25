"""End-to-end integration tests exercising the full API round-trip.

These tests seed data via the shared conftest fixtures and query every
public endpoint, verifying response shape, coordinate conventions,
truncation signals, and cross-endpoint consistency.
"""

from unittest.mock import patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MOCK_SEQUENCE = "ATCGATCGATCG"


def _mock_get_sequence(build, chr_name, start, end):
    """Return a deterministic mock sequence of the requested length."""
    length = end - start
    full = (MOCK_SEQUENCE * ((length // len(MOCK_SEQUENCE)) + 1))[:length]
    return full


# ---------------------------------------------------------------------------
# 1. Full round-trip: seed data -> query API -> verify response shape
# ---------------------------------------------------------------------------


async def test_full_roundtrip_region_query(client, seed_genomic_data):
    """Seed CpG data, query the region endpoint, verify GRanges structure."""
    resp = await client.get("/v1/regions/hg38/chr16:70699920-70700000?layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()

    # Envelope fields
    assert body["status"] in ("complete", "truncated")
    assert body["coordinate_system"] == "1-based_closed"
    assert "query" in body
    assert "layers_resolved" in body
    assert "data" in body
    assert "timing" in body

    # Query echo
    assert body["query"]["build"] == "hg38"
    assert body["query"]["region"]["chr"] == "chr16"

    # Layer resolution
    assert len(body["layers_resolved"]) >= 1
    resolved_keys = [lr["layer_key"] for lr in body["layers_resolved"]]
    assert "cpg_sites" in resolved_keys

    # Data shape: GRanges
    cpg = body["data"]["cpg_sites"]
    assert cpg["class"] == "GRanges"
    assert cpg["n"] == 3
    assert len(cpg["seqnames"]) == 3
    assert all(s == "chr16" for s in cpg["seqnames"])
    assert len(cpg["ranges"]["start"]) == 3
    assert len(cpg["ranges"]["end"]) == 3
    assert len(cpg["ranges"]["width"]) == 3
    assert len(cpg["strand"]) == 3
    assert "context" in cpg["mcols"]
    assert "gc_content" in cpg["mcols"]

    # Coordinates are 1-based closed (pos 70699929 in DB -> start 70699930 in API)
    assert cpg["ranges"]["start"][0] == 70699930


# ---------------------------------------------------------------------------
# 2. Coordinate round-trip (Contract 1 CI invariant):
#    1-based and 0-based queries return equivalent results
# ---------------------------------------------------------------------------


async def test_coordinate_roundtrip_1based_vs_0based(client, seed_genomic_data):
    """1-based chr16:70699930-70700000 and 0-based chr16:70699929-70700000
    must return the same data payload."""
    resp_1 = await client.get("/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites")
    resp_0 = await client.get(
        "/v1/regions/hg38/chr16:70699929-70700000?layers=cpg_sites&coords=0based"
    )
    assert resp_1.status_code == 200
    assert resp_0.status_code == 200
    assert resp_1.json()["data"] == resp_0.json()["data"]


async def test_coordinate_roundtrip_all_returned_are_1based(client, seed_genomic_data):
    """Regardless of input coordinate system, returned coordinates are always 1-based closed."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699929-70700000?layers=cpg_sites&coords=0based"
    )
    body = resp.json()
    assert body["coordinate_system"] == "1-based_closed"
    # DB stores pos=70699929 (0-based), API returns start=70699930 (1-based)
    starts = body["data"]["cpg_sites"]["ranges"]["start"]
    assert all(s >= 70699930 for s in starts)


# ---------------------------------------------------------------------------
# 3. Multi-layer region query: request multiple layers, verify all present
# ---------------------------------------------------------------------------


async def test_multi_layer_region_query(client, seed_genomic_data, seed_gene_data, seed_probe_data):
    """Request cpg_sites + gencode_v44 + probe_epic_v2 in a single region query."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699000-70706000?layers=cpg_sites,gencode_v44,probe_epic_v2"
    )
    assert resp.status_code == 200
    body = resp.json()

    # All three layers should be resolved
    resolved_keys = {lr["layer_key"] for lr in body["layers_resolved"]}
    assert "cpg_sites" in resolved_keys
    assert "gencode_v44" in resolved_keys
    assert "probe_epic_v2" in resolved_keys

    # All three layers present in data
    assert "cpg_sites" in body["data"]
    assert "gencode_v44" in body["data"]
    assert "probe_epic_v2" in body["data"]

    # Each layer has GRanges structure with n >= 1
    for key in ("cpg_sites", "gencode_v44", "probe_epic_v2"):
        layer_data = body["data"][key]
        assert layer_data["class"] == "GRanges"
        assert layer_data["n"] >= 1


# ---------------------------------------------------------------------------
# 4. Truncation signal: seed > limit, verify status == "truncated"
# ---------------------------------------------------------------------------


async def test_truncation_signal(client, seed_genomic_data):
    """With limit=1 and 3 seed rows, the response must signal truncation."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699920-70700000?layers=cpg_sites&limit=1"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "truncated"
    assert body["data"]["cpg_sites"]["n"] == 1


async def test_complete_status_when_not_truncated(client, seed_genomic_data):
    """With no limit and only 3 seed rows, status should be 'complete'."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699920-70700000?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert body["data"]["cpg_sites"]["n"] == 3


# ---------------------------------------------------------------------------
# 5. Sequence endpoint (mock pyfaidx, verify structure)
# ---------------------------------------------------------------------------


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_e2e_roundtrip(mock_fn, client):
    """Full round-trip for the sequence endpoint with mocked FASTA."""
    resp = await client.get("/v1/sequence/hg38/chr16:70699930-70700000")
    assert resp.status_code == 200
    body = resp.json()
    data = body["data"]

    # Structure
    assert data["build"] == "hg38"
    assert data["chr"] == "chr16"
    assert data["start"] == 70699930
    assert data["end"] == 70700000
    assert body["coordinate_system"] == "1-based_closed"
    assert data["length"] == 71  # 1-based closed: 70700000 - 70699930 + 1
    assert len(data["sequence"]) == 71
    assert "timing" in body
    assert "query_time_ms" in body["timing"]


@patch("polymer_genomics.routers.sequence.get_sequence", side_effect=_mock_get_sequence)
async def test_sequence_coordinate_conversion_e2e(mock_fn, client):
    """1-based and 0-based queries to sequence endpoint produce identical length."""
    resp_1 = await client.get("/v1/sequence/hg38/chr16:70699930-70700000")
    resp_0 = await client.get("/v1/sequence/hg38/chr16:70699929-70700000?coords=0based")
    assert resp_1.status_code == 200
    assert resp_0.status_code == 200
    assert resp_1.json()["data"]["length"] == resp_0.json()["data"]["length"]


# ---------------------------------------------------------------------------
# 6. Gene endpoint: lookup gene by symbol, verify features returned
# ---------------------------------------------------------------------------


async def test_gene_e2e_roundtrip(client, seed_gene_data):
    """Look up VAC14, verify full GRanges structure and feature types."""
    resp = await client.get("/v1/genes/hg38/VAC14")
    assert resp.status_code == 200
    body = resp.json()

    # Envelope
    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"
    assert body["query"]["build"] == "hg38"
    assert body["query"]["gene_symbol"] == "VAC14"

    # Layer
    assert len(body["layers_resolved"]) == 1
    assert body["layers_resolved"][0]["layer_key"] == "gencode_v44"

    # Data: 3 features (exon, intron, exon)
    data = body["data"]
    assert data["class"] == "GRanges"
    assert data["n"] == 3
    assert data["mcols"]["feature_type"] == ["exon", "intron", "exon"]
    assert data["mcols"]["gene_symbol"] == ["VAC14", "VAC14", "VAC14"]
    assert data["mcols"]["gene_id"] == ["ENSG00000130164"] * 3
    assert data["mcols"]["transcript_id"] == ["ENST00000355500"] * 3

    # Coordinate convention: DB start_pos=70699000 (0-based) -> API start=70699001
    assert data["ranges"]["start"][0] == 70699001
    assert data["ranges"]["end"][0] == 70700000
    assert data["ranges"]["width"][0] == 1000


async def test_gene_not_found_e2e(client, seed_layers):
    """Looking up a non-existent gene returns 404 with NOT_FOUND code."""
    resp = await client.get("/v1/genes/hg38/NONEXISTENTGENE")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# 7. Probe endpoint: GET single + POST batch
# ---------------------------------------------------------------------------


async def test_probe_get_e2e_roundtrip(client, seed_probe_data):
    """GET a single probe, verify full structure including crossmap."""
    resp = await client.get("/v1/probes/hg38/cg08796240")
    assert resp.status_code == 200
    body = resp.json()

    # Envelope
    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"
    assert body["query"]["probe_id"] == "cg08796240"

    # Probe data
    probe = body["data"]["probe"]
    assert probe["probe_id"] == "cg08796240"
    assert probe["seqname"] == "chr16"
    assert probe["start"] == 70699930  # DB pos=70699929 -> API start=70699930
    assert probe["end"] == 70699930
    assert probe["width"] == 1
    assert probe["gene_symbol"] == "VAC14"
    assert probe["cpg_context"] == "island"

    # Crossmap
    crossmap = body["data"]["crossmap"]
    assert len(crossmap) == 1
    assert crossmap[0]["dst_platform"] == "epic_v1"
    assert crossmap[0]["confidence"] == 1.0


async def test_probe_post_batch_e2e_roundtrip(client, seed_probe_data):
    """POST a batch of probe IDs, verify GRanges response with all probes."""
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": ["cg08796240", "cg14514483", "cg27457201"]},
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["status"] == "complete"
    assert body["data"]["class"] == "GRanges"
    assert body["data"]["n"] == 3

    # Ordered by chr_id, pos
    assert body["data"]["mcols"]["probe_id"] == [
        "cg08796240", "cg14514483", "cg27457201"
    ]

    # 1-based coordinate convention
    assert body["data"]["ranges"]["start"][0] == 70699930
    assert body["data"]["ranges"]["width"][0] == 1


async def test_probe_batch_partial_match_e2e(client, seed_probe_data):
    """Batch with mix of real and non-existent probes returns only the matches."""
    resp = await client.post(
        "/v1/probes/hg38/batch",
        json={"probe_ids": ["cg08796240", "cg99999999"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["n"] == 1
    assert body["data"]["mcols"]["probe_id"] == ["cg08796240"]


# ---------------------------------------------------------------------------
# 8. Search endpoint: substring match
# ---------------------------------------------------------------------------


async def test_search_e2e_prefix_match(client, seed_gene_data):
    """Search for 'VAC' returns VAC14 among results."""
    resp = await client.get("/v1/search?q=VAC&build=hg38")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] >= 1
    symbols = [r["gene_symbol"] for r in body["results"]]
    assert "VAC14" in symbols
    assert all(r["type"] == "gene" for r in body["results"])


async def test_search_e2e_case_insensitive(client, seed_gene_data):
    """Search is case-insensitive (ILIKE)."""
    resp = await client.get("/v1/search?q=vac14&build=hg38")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] >= 1
    assert body["results"][0]["gene_symbol"] == "VAC14"


async def test_search_e2e_no_results(client, seed_gene_data):
    """Search for a non-existent gene returns empty results."""
    resp = await client.get("/v1/search?q=ZZZZZ&build=hg38")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] == 0
    assert body["results"] == []


# ---------------------------------------------------------------------------
# 9. Tiles endpoint: valid tile request
# ---------------------------------------------------------------------------


async def test_tile_e2e_roundtrip(client, seed_genomic_data):
    """Request a 1kb tile covering seed CpG data and verify full structure."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/70699?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()

    # Envelope
    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"

    # Tile metadata
    assert "tile" in body
    tile = body["tile"]
    assert tile["chr"] == "chr16"
    assert tile["index"] == 70699
    assert tile["resolution"] == 1000
    assert tile["start"] == 70699000
    assert tile["end"] == 70700000

    # Data
    assert "cpg_sites" in body["data"]
    assert body["data"]["cpg_sites"]["n"] == 3
    assert body["data"]["cpg_sites"]["class"] == "GRanges"


async def test_tile_e2e_empty_region(client, seed_genomic_data):
    """Tile in a region with no data returns 200 with n=0."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/0?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["cpg_sites"]["n"] == 0


async def test_tile_e2e_10kb_resolution(client, seed_genomic_data):
    """10kb tile covering seed data."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/10000/7069?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["cpg_sites"]["n"] == 3
    assert body["tile"]["resolution"] == 10000


# ---------------------------------------------------------------------------
# 10. Layer listing: list, filter by build
# ---------------------------------------------------------------------------


async def test_layer_list_e2e(client, seed_layers):
    """List all active layers returns the seeded layers."""
    resp = await client.get("/v1/layers")
    assert resp.status_code == 200
    body = resp.json()["data"]
    keys = [l["layer_key"] for l in body["layers"]]
    assert "probe_epic_v2" in keys
    assert "cpg_sites" in keys
    assert "gencode_v44" in keys


async def test_layer_list_filter_by_build_e2e(client, seed_layers):
    """Filter layers by build=hg38 returns all seeded layers."""
    resp = await client.get("/v1/layers?build=hg38")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert len(body["layers"]) >= 3
    assert all(l["build"] == "hg38" for l in body["layers"])


async def test_layer_list_filter_by_type_e2e(client, seed_layers):
    """Filter layers by type=probe returns only probe layers."""
    resp = await client.get("/v1/layers?type=probe&build=hg38")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert len(body["layers"]) >= 1
    assert all(l["type"] == "probe" for l in body["layers"])


async def test_layer_get_by_key_e2e(client, seed_layers):
    """Get a single layer by key returns full metadata."""
    resp = await client.get("/v1/layers/cpg_sites")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["layer_key"] == "cpg_sites"
    assert body["version"] == "1.0"
    assert body["type"] == "cpg"
    assert body["build"] == "hg38"


# ---------------------------------------------------------------------------
# 11. Aggregation endpoint
# ---------------------------------------------------------------------------


async def test_aggregation_e2e_roundtrip(client, seed_genomic_data):
    """Aggregate CpG sites into 1kb bins, verify structure and counts."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70699000-70701000?layers=cpg_sites&resolution=1000"
    )
    assert resp.status_code == 200
    body = resp.json()

    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"
    assert "cpg_sites" in body["data"]

    cpg = body["data"]["cpg_sites"]
    assert cpg["resolution"] == 1000
    assert cpg["n_bins"] >= 1

    # All 3 seed sites are in the 70699000 bin
    bins = cpg["bins"]
    bin_70699 = [b for b in bins if b["bin_start"] == 70699000]
    assert len(bin_70699) == 1
    assert bin_70699[0]["count"] == 3
    assert "density" in bin_70699[0]
    assert "avg_gc" in bin_70699[0]


async def test_aggregation_e2e_gene_layer(client, seed_gene_data):
    """Aggregation on gene_model layer produces count/density (no avg_gc)."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70699000-70707000?layers=gencode_v44&resolution=1000"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "gencode_v44" in body["data"]
    gene_data = body["data"]["gencode_v44"]
    assert gene_data["n_bins"] >= 1
    for b in gene_data["bins"]:
        assert "count" in b
        assert "density" in b


async def test_aggregation_e2e_10kb_bins(client, seed_genomic_data):
    """10kb bin groups all 3 seed sites into one bin."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70690000-70700000?layers=cpg_sites&resolution=10000"
    )
    assert resp.status_code == 200
    body = resp.json()
    cpg = body["data"]["cpg_sites"]
    assert cpg["resolution"] == 10000
    assert len(cpg["bins"]) == 1
    assert cpg["bins"][0]["count"] == 3


# ---------------------------------------------------------------------------
# 12. Health endpoint (no seed data required)
# ---------------------------------------------------------------------------


async def test_health_e2e(client):
    """Health endpoint returns ok with version."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert body["db"] == "ok"


# ---------------------------------------------------------------------------
# 13. Cross-endpoint consistency: gene region matches gene features
# ---------------------------------------------------------------------------


async def test_cross_endpoint_gene_region_consistency(
    client, seed_genomic_data, seed_gene_data, seed_probe_data
):
    """The region endpoint with gencode_v44 layer should return the same
    features as the gene endpoint for VAC14."""
    # Gene endpoint
    gene_resp = await client.get("/v1/genes/hg38/VAC14")
    assert gene_resp.status_code == 200
    gene_body = gene_resp.json()

    # Region endpoint covering VAC14 locus
    region_resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70706000?layers=gencode_v44"
    )
    assert region_resp.status_code == 200
    region_body = region_resp.json()
    region_gene = region_body["data"]["gencode_v44"]

    # Both should return 3 features
    assert gene_body["data"]["n"] == 3
    assert region_gene["n"] == 3

    # Feature types match
    assert gene_body["data"]["mcols"]["feature_type"] == region_gene["mcols"]["feature_type"]

    # Coordinates match
    assert gene_body["data"]["ranges"]["start"] == region_gene["ranges"]["start"]
    assert gene_body["data"]["ranges"]["end"] == region_gene["ranges"]["end"]


# ---------------------------------------------------------------------------
# 14. Cross-endpoint consistency: probe in region
# ---------------------------------------------------------------------------


async def test_cross_endpoint_probe_in_region(client, seed_genomic_data, seed_probe_data):
    """Probes from the probe endpoint should appear at the same positions
    as probe features from the region endpoint."""
    # Single probe lookup
    probe_resp = await client.get("/v1/probes/hg38/cg08796240")
    assert probe_resp.status_code == 200
    probe_start = probe_resp.json()["data"]["probe"]["start"]

    # Region query with probe layer
    region_resp = await client.get(
        "/v1/regions/hg38/chr16:70699920-70700000?layers=probe_epic_v2"
    )
    assert region_resp.status_code == 200
    region_probes = region_resp.json()["data"]["probe_epic_v2"]

    # The probe's start should appear in the region's probe starts
    assert probe_start in region_probes["ranges"]["start"]


# ---------------------------------------------------------------------------
# 15. Envelope timing fields present across endpoints
# ---------------------------------------------------------------------------


async def test_timing_present_on_region(client, seed_genomic_data):
    """Region endpoint includes timing fields."""
    resp = await client.get("/v1/regions/hg38/chr16:70699920-70700000?layers=cpg_sites")
    body = resp.json()
    assert "timing" in body
    assert "query_time_ms" in body["timing"]
    assert "db_time_ms" in body["timing"]
    assert body["timing"]["query_time_ms"] >= 0
    assert body["timing"]["db_time_ms"] >= 0


async def test_timing_present_on_genes(client, seed_gene_data):
    """Gene endpoint includes timing fields."""
    resp = await client.get("/v1/genes/hg38/VAC14")
    body = resp.json()
    assert "timing" in body
    assert "query_time_ms" in body["timing"]
    assert "db_time_ms" in body["timing"]


async def test_timing_present_on_probes(client, seed_probe_data):
    """Probe endpoint includes timing fields."""
    resp = await client.get("/v1/probes/hg38/cg08796240")
    body = resp.json()
    assert "timing" in body
    assert "query_time_ms" in body["timing"]
    assert "db_time_ms" in body["timing"]
