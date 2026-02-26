import pytest


async def test_search_prefix_match(client, seed_gene_data):
    resp = await client.get("/v1/search?q=VAC&build=hg38")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    results = body["results"]
    assert any(r["gene_symbol"] == "VAC14" for r in results)
    assert all(r["type"] == "gene" for r in results)


async def test_search_exact_match(client, seed_gene_data):
    resp = await client.get("/v1/search?q=VAC14&build=hg38")
    body = resp.json()
    assert body["total"] >= 1
    assert body["results"][0]["gene_symbol"] == "VAC14"


async def test_search_case_insensitive(client, seed_gene_data):
    """ILIKE should match regardless of case."""
    resp = await client.get("/v1/search?q=vac&build=hg38")
    body = resp.json()
    assert body["total"] >= 1
    assert any(r["gene_symbol"] == "VAC14" for r in body["results"])


async def test_search_no_results(client, seed_gene_data):
    resp = await client.get("/v1/search?q=ZZZZZ&build=hg38")
    body = resp.json()
    assert body["total"] == 0
    assert body["results"] == []


async def test_search_query_too_short(client):
    resp = await client.get("/v1/search?q=A&build=hg38")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "QUERY_TOO_SHORT"


async def test_search_missing_query(client):
    resp = await client.get("/v1/search?build=hg38")
    assert resp.status_code == 422  # FastAPI validation error for missing required param


async def test_search_invalid_build(client):
    resp = await client.get("/v1/search?q=VAC&build=hg99")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_search_limit_20(client, seed_gene_data):
    """Search should return at most 20 results."""
    resp = await client.get("/v1/search?q=VA&build=hg38")
    body = resp.json()
    assert len(body["results"]) <= 20
