"""Tests for the conservation scores layer (PhyloP/PhastCons 100-way, 1kb bins)."""

import pytest


# ---------------------------------------------------------------------------
# Region query tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_conservation_region_query(client, seed_conservation_data):
    """Region query returns conservation scores for overlapping 1kb bins."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70701500",
        params={"layers": "phylop_phastcons_100way"},
    )
    assert resp.status_code == 200
    body = resp.json()
    cons = body["data"]["phylop_phastcons_100way"]
    assert cons["n"] >= 2  # at least 2 of our 3 bins overlap


@pytest.mark.asyncio
async def test_conservation_granges_structure(client, seed_conservation_data):
    """Conservation results follow GRanges format."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70701500",
        params={"layers": "phylop_phastcons_100way"},
    )
    body = resp.json()
    cons = body["data"]["phylop_phastcons_100way"]
    assert cons["class"] == "GRanges"
    assert "start" in cons["ranges"]
    assert "end" in cons["ranges"]
    assert "width" in cons["ranges"]
    assert all(s == "chr16" for s in cons["seqnames"])
    assert all(s == "*" for s in cons["strand"])


@pytest.mark.asyncio
async def test_conservation_mcols(client, seed_conservation_data):
    """Conservation mcols contain phylop and phastcons metrics."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70701500",
        params={"layers": "phylop_phastcons_100way"},
    )
    body = resp.json()
    mcols = body["data"]["phylop_phastcons_100way"]["mcols"]
    assert "phylop_mean" in mcols
    assert "phylop_max" in mcols
    assert "phastcons_mean" in mcols
    assert "phastcons_max" in mcols
    # Check values are numeric (from seed data)
    for val in mcols["phylop_mean"]:
        assert isinstance(val, (int, float))


@pytest.mark.asyncio
async def test_conservation_coordinates_1based(client, seed_conservation_data):
    """Conservation coordinates are 1-based closed in API response."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70701000",
        params={"layers": "phylop_phastcons_100way"},
    )
    body = resp.json()
    cons = body["data"]["phylop_phastcons_100way"]
    if cons["n"] > 0:
        # DB stores 0-based half-open [70699000, 70700000)
        # API returns 1-based closed [70699001, 70700000]
        starts = cons["ranges"]["start"]
        ends = cons["ranges"]["end"]
        widths = cons["ranges"]["width"]
        for s, e, w in zip(starts, ends, widths):
            assert w == e - s + 1
            assert s >= 1


@pytest.mark.asyncio
async def test_conservation_no_overlap(client, seed_conservation_data):
    """Region with no conservation bins returns n=0."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:1-1000",
        params={"layers": "phylop_phastcons_100way"},
    )
    assert resp.status_code == 200
    body = resp.json()
    cons = body["data"]["phylop_phastcons_100way"]
    assert cons["n"] == 0


@pytest.mark.asyncio
async def test_conservation_layer_resolved(client, seed_conservation_data):
    """Conservation layer appears in layers_resolved."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699930-70701500",
        params={"layers": "phylop_phastcons_100way"},
    )
    body = resp.json()
    resolved = body["layers_resolved"]
    keys = [lr["layer_key"] for lr in resolved]
    assert "phylop_phastcons_100way" in keys
