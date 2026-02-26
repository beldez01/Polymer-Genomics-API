import pytest


async def test_gene_lookup_basic(client, seed_gene_data):
    resp = await client.get("/v1/genes/hg38/VAC14")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"
    assert body["data"]["class"] == "GRanges"
    assert body["data"]["n"] == 3


async def test_gene_lookup_coordinate_convention(client, seed_gene_data):
    """Returned coordinates must be 1-based closed (start = db+1, end = db)."""
    resp = await client.get("/v1/genes/hg38/VAC14")
    body = resp.json()
    data = body["data"]
    # Seed: start_pos=70699000 (0-based) -> API start=70699001 (1-based)
    assert data["ranges"]["start"][0] == 70699001
    assert data["ranges"]["end"][0] == 70700000
    assert data["ranges"]["width"][0] == 1000


async def test_gene_lookup_mcols(client, seed_gene_data):
    """Verify mcols contain gene metadata."""
    resp = await client.get("/v1/genes/hg38/VAC14")
    body = resp.json()
    mcols = body["data"]["mcols"]
    assert "gene_symbol" in mcols
    assert "gene_id" in mcols
    assert "transcript_id" in mcols
    assert "feature_type" in mcols
    assert mcols["gene_symbol"] == ["VAC14", "VAC14", "VAC14"]
    assert mcols["feature_type"] == ["exon", "intron", "exon"]


async def test_gene_lookup_query_echo(client, seed_gene_data):
    """Envelope should echo back the query parameters."""
    resp = await client.get("/v1/genes/hg38/VAC14")
    body = resp.json()
    assert body["query"]["build"] == "hg38"
    assert body["query"]["gene_symbol"] == "VAC14"


async def test_gene_lookup_layers_resolved(client, seed_gene_data):
    """Should resolve the gene_model layer."""
    resp = await client.get("/v1/genes/hg38/VAC14")
    body = resp.json()
    assert len(body["layers_resolved"]) == 1
    assert body["layers_resolved"][0]["layer_key"] == "gencode_v44"


async def test_gene_not_found(client, seed_layers):
    resp = await client.get("/v1/genes/hg38/FAKEGENE")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


async def test_gene_invalid_build(client):
    resp = await client.get("/v1/genes/hg99/VAC14")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"
