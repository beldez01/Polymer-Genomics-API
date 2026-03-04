"""Tests for regulatory elements (ENCODE cCREs V4) via region query."""

import pytest


@pytest.mark.anyio
async def test_regulatory_region_query(client, seed_regulatory_data):
    """Region query with layers=encode_ccre_v4 returns cCRE elements."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70703000",
        params={"layers": "encode_ccre_v4"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"

    layer_data = body["data"]["encode_ccre_v4"]
    assert layer_data["class"] == "GRanges"
    assert layer_data["n"] == 3
    assert "accession" in layer_data["mcols"]
    assert "encode_label" in layer_data["mcols"]
    assert "z_score" in layer_data["mcols"]


@pytest.mark.anyio
async def test_regulatory_granges_structure(client, seed_regulatory_data):
    """Verify GRanges structure and 1-based closed coordinates."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70703000",
        params={"layers": "encode_ccre_v4"},
    )
    layer_data = resp.json()["data"]["encode_ccre_v4"]

    # 0-based [70699500, 70699800) -> 1-based [70699501, 70699800]
    assert layer_data["ranges"]["start"][0] == 70699501
    assert layer_data["ranges"]["end"][0] == 70699800
    assert layer_data["ranges"]["width"][0] == 300
    assert layer_data["strand"] == ["*", "*", "*"]


@pytest.mark.anyio
async def test_regulatory_mcols_content(client, seed_regulatory_data):
    """Verify mcols contain correct classification data."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70703000",
        params={"layers": "encode_ccre_v4"},
    )
    mcols = resp.json()["data"]["encode_ccre_v4"]["mcols"]

    assert mcols["accession"] == ["EH38E0000001", "EH38E0000002", "EH38E0000003"]
    assert mcols["encode_label"] == ["pELS", "PLS", "dELS"]
    assert mcols["ccre_class"] == ["pELS,CTCF-bound", "PLS,CTCF-bound", "dELS"]
    assert mcols["score"] == [488, 759, 179]
    assert mcols["z_score"][0] == pytest.approx(4.88, abs=0.01)


@pytest.mark.anyio
async def test_regulatory_partial_overlap(client, seed_regulatory_data):
    """Query that only overlaps some cCREs returns correct subset."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70700001-70700500",
        params={"layers": "encode_ccre_v4"},
    )
    layer_data = resp.json()["data"]["encode_ccre_v4"]
    assert layer_data["n"] == 1
    assert layer_data["mcols"]["accession"] == ["EH38E0000002"]
    assert layer_data["mcols"]["encode_label"] == ["PLS"]


@pytest.mark.anyio
async def test_regulatory_no_overlap(client, seed_regulatory_data):
    """Query outside cCRE range returns empty GRanges."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70710001-70720000",
        params={"layers": "encode_ccre_v4"},
    )
    layer_data = resp.json()["data"]["encode_ccre_v4"]
    assert layer_data["n"] == 0


@pytest.mark.anyio
async def test_regulatory_layer_resolved(client, seed_regulatory_data):
    """Layer metadata is included in response."""
    resp = await client.get(
        "/v1/regions/hg38/chr16:70699001-70703000",
        params={"layers": "encode_ccre_v4"},
    )
    body = resp.json()
    layers = body["layers_resolved"]
    ccre_layer = [l for l in layers if l["layer_key"] == "encode_ccre_v4"]
    assert len(ccre_layer) == 1
    assert ccre_layer[0]["status"] == "ok"
