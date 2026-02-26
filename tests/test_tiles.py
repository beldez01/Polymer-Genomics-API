"""Tests for tile endpoints: pure tile math + integration tests."""

import pytest


# --- Pure tile math tests (no DB) ---


class TestTileMath:
    """Pure unit tests for tile math functions — no DB required."""

    def test_tile_to_region_basic(self):
        from polymer_genomics.routers.tiles import tile_to_region

        result = tile_to_region("chr16", 70699, 1000)
        assert result == {"chr": "chr16", "start": 70699000, "end": 70700000}

    def test_tile_to_region_index_zero(self):
        from polymer_genomics.routers.tiles import tile_to_region

        result = tile_to_region("chr1", 0, 1000)
        assert result == {"chr": "chr1", "start": 0, "end": 1000}

    def test_tile_to_region_large_resolution(self):
        from polymer_genomics.routers.tiles import tile_to_region

        result = tile_to_region("chrX", 5, 1000000)
        assert result == {"chr": "chrX", "start": 5000000, "end": 6000000}

    def test_tile_to_region_10kb(self):
        from polymer_genomics.routers.tiles import tile_to_region

        result = tile_to_region("chr2", 100, 10000)
        assert result == {"chr": "chr2", "start": 1000000, "end": 1010000}

    def test_region_to_tiles_single_tile(self):
        from polymer_genomics.routers.tiles import region_to_tiles

        result = region_to_tiles(70699000, 70700000, 1000)
        assert result == [70699]

    def test_region_to_tiles_multiple(self):
        from polymer_genomics.routers.tiles import region_to_tiles

        result = region_to_tiles(70699000, 70701000, 1000)
        assert result == [70699, 70700]

    def test_region_to_tiles_partial_overlap(self):
        """Region that starts mid-tile and ends mid-tile."""
        from polymer_genomics.routers.tiles import region_to_tiles

        result = region_to_tiles(70699500, 70700500, 1000)
        assert result == [70699, 70700]

    def test_region_to_tiles_exact_boundary(self):
        """End exactly on tile boundary: [70699000, 70700000) -> tile 70699 only."""
        from polymer_genomics.routers.tiles import region_to_tiles

        result = region_to_tiles(70699000, 70700000, 1000)
        assert result == [70699]

    def test_region_to_tiles_single_base(self):
        """A 1-base region should map to exactly 1 tile."""
        from polymer_genomics.routers.tiles import region_to_tiles

        result = region_to_tiles(70699929, 70699930, 1000)
        assert result == [70699]

    def test_region_to_tiles_100kb(self):
        from polymer_genomics.routers.tiles import region_to_tiles

        result = region_to_tiles(0, 300000, 100000)
        assert result == [0, 1, 2]

    def test_valid_resolutions_set(self):
        from polymer_genomics.routers.tiles import VALID_RESOLUTIONS

        assert VALID_RESOLUTIONS == {1000, 10000, 100000, 1000000}

    def test_invalid_resolution_not_in_set(self):
        from polymer_genomics.routers.tiles import VALID_RESOLUTIONS

        assert 500 not in VALID_RESOLUTIONS
        assert 5000 not in VALID_RESOLUTIONS
        assert 2000000 not in VALID_RESOLUTIONS

    def test_tile_to_region_roundtrip(self):
        """tile_to_region -> region_to_tiles should recover the original index."""
        from polymer_genomics.routers.tiles import region_to_tiles, tile_to_region

        region = tile_to_region("chr16", 70699, 1000)
        tiles = region_to_tiles(region["start"], region["end"], 1000)
        assert tiles == [70699]


# --- Integration tests (require DB + client) ---


async def test_tile_basic(client, seed_genomic_data):
    """A tile covering the seed CpG data should return features."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/70699?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert "cpg_sites" in body["data"]
    assert body["data"]["cpg_sites"]["n"] == 3
    assert "tile" in body
    assert body["tile"]["index"] == 70699
    assert body["tile"]["resolution"] == 1000
    assert body["tile"]["start"] == 70699000
    assert body["tile"]["end"] == 70700000


async def test_tile_empty(client, seed_genomic_data):
    """A tile in a region with no data returns 200 with empty data."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/0?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["cpg_sites"]["n"] == 0


async def test_tile_cache_control(client, seed_genomic_data):
    """Tile responses should have Cache-Control headers when layers have content_hash."""
    from tests.conftest import _admin_connect

    # Set a content_hash on the cpg_sites layer so cache headers fire
    conn = await _admin_connect()
    await conn.execute(
        "UPDATE registry.layers SET content_hash = 'abc123' WHERE layer_key = 'cpg_sites'"
    )
    await conn.close()

    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/70699?layers=cpg_sites"
    )
    assert resp.status_code == 200
    cc = resp.headers.get("cache-control", "")
    assert "public" in cc
    assert "immutable" in cc

    # Clean up
    conn = await _admin_connect()
    await conn.execute(
        "UPDATE registry.layers SET content_hash = NULL WHERE layer_key = 'cpg_sites'"
    )
    await conn.close()


async def test_tile_no_cache_control_without_content_hash(client, seed_genomic_data):
    """When layers have no content_hash, no Cache-Control header is set."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/70699?layers=cpg_sites"
    )
    assert resp.status_code == 200
    cc = resp.headers.get("cache-control", "")
    assert "immutable" not in cc


async def test_tile_invalid_resolution(client, seed_genomic_data):
    """Non-standard resolution should return 400."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/500/70699?layers=cpg_sites"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_RESOLUTION"


async def test_tile_invalid_build(client):
    """Invalid build should return 400."""
    resp = await client.get(
        "/v1/tiles/hg99/chr16/tile/1000/70699?layers=cpg_sites"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_tile_invalid_chromosome(client, seed_layers):
    """Invalid chromosome should return 400."""
    resp = await client.get(
        "/v1/tiles/hg38/chrZZ/tile/1000/0?layers=cpg_sites"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_CHROMOSOME"


async def test_tile_10kb_resolution(client, seed_genomic_data):
    """10kb tile covering seed data."""
    # seed data at pos 70699929..70699960 -> tile index at 10kb = 7069
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/10000/7069?layers=cpg_sites"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["cpg_sites"]["n"] == 3
    assert body["tile"]["resolution"] == 10000
    assert body["tile"]["start"] == 70690000
    assert body["tile"]["end"] == 70700000


async def test_tile_metadata_present(client, seed_genomic_data):
    """Tile metadata should include chr, index, resolution, start, end."""
    resp = await client.get(
        "/v1/tiles/hg38/chr16/tile/1000/70699?layers=cpg_sites"
    )
    body = resp.json()
    tile = body["tile"]
    assert tile["chr"] == "chr16"
    assert tile["index"] == 70699
    assert tile["resolution"] == 1000
    assert tile["start"] == 70699000
    assert tile["end"] == 70700000
