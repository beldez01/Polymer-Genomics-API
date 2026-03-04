

async def test_proximity_basic(client, seed_gene_data, seed_genomic_data):
    """Gene + radius returns envelope with expanded region and data."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=5000&layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("complete", "truncated")
    assert body["coordinate_system"] == "1-based_closed"
    assert "cpg_sites" in body["data"]
    assert body["query"]["gene_symbol"] == "VAC14"
    assert body["query"]["radius"] == 5000
    assert "gene_bounds" in body["query"]
    assert body["query"]["gene_bounds"]["chr"] == "chr16"


async def test_proximity_gene_bounds(client, seed_gene_data):
    """Gene bounds reflect the min/max of gene features."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=0")
    assert resp.status_code == 200
    body = resp.json()
    bounds = body["query"]["gene_bounds"]
    # Seed: start_pos=70699000 (0-based) -> API start=70699001
    # Seed: end_pos=70706000 (0-based half-open) -> API end=70706000
    assert bounds["start"] == 70699001
    assert bounds["end"] == 70706000
    assert bounds["width"] == 7000


async def test_proximity_radius_zero(client, seed_gene_data, seed_genomic_data):
    """radius=0 returns gene body exactly."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=0&layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    region = body["query"]["region"]
    bounds = body["query"]["gene_bounds"]
    assert region["start"] == bounds["start"]
    assert region["end"] == bounds["end"]


async def test_proximity_expanded_region(client, seed_gene_data):
    """Expanded region should be gene body ± radius."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=1000")
    assert resp.status_code == 200
    body = resp.json()
    region = body["query"]["region"]
    bounds = body["query"]["gene_bounds"]
    assert region["start"] == bounds["start"] - 1000
    assert region["end"] == bounds["end"] + 1000


async def test_proximity_gene_not_found(client, seed_layers):
    """Unknown gene returns 404."""
    resp = await client.get("/v1/query?build=hg38&gene=FAKEGENE&radius=5000")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


async def test_proximity_invalid_build(client):
    """Invalid build returns 400."""
    resp = await client.get("/v1/query?build=hg99&gene=VAC14&radius=5000")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_proximity_layers_filter(client, seed_gene_data, seed_genomic_data, seed_probe_data):
    """layers parameter filters to only requested layers."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=5000&layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    layer_keys = [lr["layer_key"] for lr in body["layers_resolved"]]
    assert "cpg_sites" in layer_keys
    # probe layer should not be included when not requested
    assert "probe_epic_v2" not in layer_keys


async def test_proximity_layers_resolved(client, seed_gene_data, seed_genomic_data):
    """Response includes layers_resolved metadata."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=5000&layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["layers_resolved"]) >= 1
    lr = body["layers_resolved"][0]
    assert "layer_key" in lr
    assert "version" in lr
    assert "layer_id" in lr
    assert "content_hash" in lr


async def test_proximity_large_radius(client, seed_gene_data):
    """Large radius works without error (doesn't exceed chr bounds)."""
    resp = await client.get("/v1/query?build=hg38&gene=VAC14&radius=1000000")
    assert resp.status_code == 200
    body = resp.json()
    region = body["query"]["region"]
    # Start should not go below 1 (1-based)
    assert region["start"] >= 1
