"""Tests for gene expression (GTEx v10) endpoint and region query."""

import pytest


# ---------------------------------------------------------------------------
# Detail endpoint: GET /v1/genes/{build}/{symbol}/expression
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_expression_lookup_basic(client, seed_expression_data):
    resp = await client.get("/v1/genes/hg38/VAC14/expression")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert body["coordinate_system"] == "1-based_closed"
    assert body["query"]["build"] == "hg38"
    assert body["query"]["symbol"] == "VAC14"
    data = body["data"]
    assert data["identity"]["gene_symbol"] == "VAC14"
    assert data["identity"]["gene_id"] == "ENSG00000130164"


@pytest.mark.anyio
async def test_expression_lookup_tissues(client, seed_expression_data):
    resp = await client.get("/v1/genes/hg38/VAC14/expression")
    body = resp.json()
    tissues = body["data"]["tissues"]
    assert isinstance(tissues, list)
    assert len(tissues) == 54
    # Check sorted by TPM descending
    tpm_values = [t["tpm"] for t in tissues if t["tpm"] is not None]
    assert tpm_values == sorted(tpm_values, reverse=True)
    # Highest tissue should be kidney_cortex
    assert tissues[0]["tissue"] == "kidney_cortex"
    assert tissues[0]["tpm"] == pytest.approx(42.3)


@pytest.mark.anyio
async def test_expression_lookup_summary(client, seed_expression_data):
    resp = await client.get("/v1/genes/hg38/VAC14/expression")
    summary = resp.json()["data"]["summary"]
    assert summary["median_tpm"] == pytest.approx(8.5)
    assert summary["max_tpm"] == pytest.approx(42.3)
    assert summary["max_tissue"] == "kidney_cortex"
    assert summary["n_tissues_detected"] == 48


@pytest.mark.anyio
async def test_expression_lookup_coordinates(client, seed_expression_data):
    """Verify coordinate conversion: db [70699000, 70706000) → API [70699001, 70706000]."""
    resp = await client.get("/v1/genes/hg38/VAC14/expression")
    coords = resp.json()["data"]["coordinates"]
    assert coords["seqname"] == "chr16"
    assert coords["start"] == 70699001  # db start + 1
    assert coords["end"] == 70706000   # db end unchanged
    assert coords["width"] == 7000
    assert coords["strand"] == "+"


@pytest.mark.anyio
async def test_expression_not_found(client, seed_layers):
    resp = await client.get("/v1/genes/hg38/FAKEGENE/expression")
    assert resp.status_code == 404
    assert resp.json()["detail"]["error"]["code"] == "NOT_FOUND"


@pytest.mark.anyio
async def test_expression_invalid_build(client):
    resp = await client.get("/v1/genes/hg99/VAC14/expression")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


@pytest.mark.anyio
async def test_expression_case_insensitive(client, seed_expression_data):
    """Gene symbol lookup is case-insensitive."""
    resp = await client.get("/v1/genes/hg38/vac14/expression")
    assert resp.status_code == 200
    assert resp.json()["data"]["identity"]["gene_symbol"] == "VAC14"


@pytest.mark.anyio
async def test_expression_layer_resolved(client, seed_expression_data):
    resp = await client.get("/v1/genes/hg38/VAC14/expression")
    body = resp.json()
    assert len(body["layers_resolved"]) == 1
    layer = body["layers_resolved"][0]
    assert layer["layer_key"] == "gtex_v10"
    assert layer["status"] == "ok"


# ---------------------------------------------------------------------------
# Region query: expression data via TRACK_REGISTRY
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_expression_region_query(client, seed_expression_data):
    """Region query with layers=gtex_v10 returns expression summary per gene."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70706000",
        params={"layers": "gtex_v10"},
    )
    assert resp.status_code == 200
    body = resp.json()
    # Find expression layer in response
    found = False
    for layer_key, layer_data in body["data"].items():
        if "expression" in layer_key or "gtex" in layer_key:
            found = True
            assert layer_data["class"] == "GRanges"
            assert layer_data["n"] >= 1
            assert "gene_symbol" in layer_data["mcols"]
            assert "median_tpm" in layer_data["mcols"]
            assert "max_tissue" in layer_data["mcols"]
            break
    assert found, f"Expression data not found in region response. Keys: {list(body['data'].keys())}"
