

async def test_region_query_basic(client, seed_genomic_data):
    resp = await client.get("/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] in ("complete", "truncated")
    assert body["coordinate_system"] == "1-based_closed"
    assert "cpg_sites" in body["data"]
    assert len(body["layers_resolved"]) >= 1


async def test_region_query_coordinate_convention(client, seed_genomic_data):
    """Verify returned coords are 1-based closed."""
    resp = await client.get("/v1/regions/hg38/chr16:70699930-70699932?layers=cpg_sites")
    body = resp.json()
    if body["data"]["cpg_sites"]["n"] > 0:
        starts = body["data"]["cpg_sites"]["ranges"]["start"]
        # All starts should be >= 70699930 (1-based, inclusive)
        assert all(s >= 70699930 for s in starts)


async def test_region_query_0based(client, seed_genomic_data):
    """0-based query should return same results as equivalent 1-based."""
    resp_1based = await client.get("/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites")
    resp_0based = await client.get(
        "/v1/regions/hg38/chr16:70699929-70700000?layers=cpg_sites&coords=0based"
    )
    assert resp_1based.json()["data"] == resp_0based.json()["data"]


async def test_region_query_truncated(client, seed_genomic_data):
    """With limit=1 and 3 seed rows, status should be 'truncated'."""
    resp = await client.get("/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "truncated"
    assert body["data"]["cpg_sites"]["n"] == 1


async def test_region_too_large(client):
    resp = await client.get("/v1/regions/hg38/chr1:1-20000000?layers=cpg_sites")
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "REGION_TOO_LARGE"


async def test_region_invalid_build(client):
    resp = await client.get("/v1/regions/hg99/chr1:1-1000?layers=cpg_sites")
    assert resp.status_code == 400
