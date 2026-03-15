

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


# ---------------------------------------------------------------------------
# fields= parameter tests
# ---------------------------------------------------------------------------


async def test_region_fields_filter(client, seed_genomic_data):
    """fields= should filter mcols to only requested fields."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&fields=gc_content"
    )
    assert resp.status_code == 200
    body = resp.json()
    mcols = body["data"]["cpg_sites"]["mcols"]
    assert "gc_content" in mcols
    assert "context" not in mcols
    assert "island_id" not in mcols


async def test_region_fields_multiple(client, seed_genomic_data):
    """Multiple fields= values should all be returned."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&fields=gc_content,context"
    )
    assert resp.status_code == 200
    body = resp.json()
    mcols = body["data"]["cpg_sites"]["mcols"]
    assert set(mcols.keys()) == {"gc_content", "context"}


async def test_region_fields_nonexistent(client, seed_genomic_data):
    """Requesting a nonexistent field should return empty mcols, not error."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&fields=nonexistent_field"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["cpg_sites"]["mcols"] == {}
    # Coordinates should still be present
    assert body["data"]["cpg_sites"]["n"] > 0


async def test_region_fields_in_query_metadata(client, seed_genomic_data):
    """fields_requested should appear in query metadata."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&fields=gc_content"
    )
    body = resp.json()
    assert "fields_requested" in body["query"]
    assert body["query"]["fields_requested"] == ["gc_content"]


async def test_region_no_fields_returns_all(client, seed_genomic_data):
    """Without fields=, all mcols should be returned."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites"
    )
    body = resp.json()
    assert "fields_requested" not in body["query"]
    mcols = body["data"]["cpg_sites"]["mcols"]
    assert len(mcols) >= 3  # context, gc_content, island_id


# ---------------------------------------------------------------------------
# Cursor pagination tests
# ---------------------------------------------------------------------------


async def test_region_cursor_pagination(client, seed_genomic_data):
    """With limit=1, response should include pagination with next_cursor."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=1"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "truncated"
    assert "pagination" in body
    assert "cpg_sites" in body["pagination"]
    assert "next_cursor" in body["pagination"]["cpg_sites"]
    assert body["pagination"]["cpg_sites"]["has_more"] is True


async def test_region_cursor_continuation(client, seed_genomic_data):
    """Using cursor from page 1 should return subsequent results."""
    # Page 1: get first result
    resp1 = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=1"
    )
    body1 = resp1.json()
    cursor = body1["pagination"]["cpg_sites"]["next_cursor"]
    first_start = body1["data"]["cpg_sites"]["ranges"]["start"][0]

    # Page 2: use cursor
    resp2 = await client.get(
        f"/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=1&cursor={cursor}"
    )
    assert resp2.status_code == 200
    body2 = resp2.json()
    second_start = body2["data"]["cpg_sites"]["ranges"]["start"][0]

    # Second page should have a later position
    assert second_start > first_start


async def test_region_cursor_full_traversal(client, seed_genomic_data):
    """Paginating through all results should yield all 3 seed rows."""
    all_starts = []
    url = "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=1"

    for _ in range(5):  # Safety limit
        resp = await client.get(url)
        body = resp.json()
        starts = body["data"]["cpg_sites"]["ranges"]["start"]
        all_starts.extend(starts)
        pagination = body.get("pagination", {})
        cpg_page = pagination.get("cpg_sites", {})
        if not cpg_page.get("next_cursor"):
            break
        cursor = cpg_page["next_cursor"]
        url = f"/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=1&cursor={cursor}"

    assert len(all_starts) == 3  # 3 seed CpG sites


async def test_region_no_cursor_no_pagination(client, seed_genomic_data):
    """When all results fit in one page, no pagination key should appear."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&limit=100"
    )
    body = resp.json()
    assert body["status"] == "complete"
    assert body.get("pagination") is None


async def test_region_invalid_cursor(client, seed_genomic_data):
    """Invalid cursor should return 400."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70700000?layers=cpg_sites&cursor=not_valid_base64!!!"
    )
    assert resp.status_code == 400
