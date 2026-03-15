"""Tests for the statistical summary endpoint (GET /v1/stats/{build}/{region})."""


async def test_stats_basic(client, seed_genomic_data):
    """Stats endpoint should return count + density for CpG sites."""
    resp = await client.get("/v1/stats/hg38/chr16:70699930-70700000?layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert "cpg_sites" in body["data"]
    cpg = body["data"]["cpg_sites"]
    assert "count" in cpg
    assert "density" in cpg
    assert cpg["count"] == 3  # 3 seed CpG rows
    assert cpg["density"] > 0


async def test_stats_conservation_continuous(client, seed_conservation_data):
    """Continuous layers should return mean/median/sd/min/max/percentiles."""
    resp = await client.get(
        "/v1/stats/hg38/chr16:70699000-70702000?layers=phylop_phastcons_100way"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "phylop_phastcons_100way" in body["data"]
    layer = body["data"]["phylop_phastcons_100way"]
    # Should have stats for at least phylop_mean
    assert "phylop_mean" in layer
    stats = layer["phylop_mean"]
    assert stats["n"] == 3  # 3 seed conservation bins
    for key in ("mean", "sd", "min", "max", "p25", "median", "p75"):
        assert key in stats, f"Missing {key} in stats"


async def test_stats_fields_filter(client, seed_conservation_data):
    """fields= should limit which fields get stats."""
    resp = await client.get(
        "/v1/stats/hg38/chr16:70699000-70702000?layers=phylop_phastcons_100way&fields=phylop_mean"
    )
    assert resp.status_code == 200
    body = resp.json()
    layer = body["data"]["phylop_phastcons_100way"]
    assert "phylop_mean" in layer
    assert "phastcons_mean" not in layer
    assert "phylop_max" not in layer


async def test_stats_region_length(client, seed_genomic_data):
    """Query metadata should include region_length_bp."""
    resp = await client.get("/v1/stats/hg38/chr16:70699930-70700000?layers=cpg_sites")
    body = resp.json()
    assert body["query"]["region_length_bp"] == 71  # 1-based closed: 70700000 - 70699930 + 1 = 71


async def test_stats_invalid_build(client):
    resp = await client.get("/v1/stats/hg99/chr1:1-1000?layers=cpg_sites")
    assert resp.status_code == 400


async def test_stats_empty_region(client, seed_genomic_data):
    """Stats on a region with no data should return count=0 or n=0."""
    resp = await client.get("/v1/stats/hg38/chr16:1-100?layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    if "cpg_sites" in body["data"]:
        assert body["data"]["cpg_sites"]["count"] == 0


async def test_stats_timing(client, seed_genomic_data):
    """Response should include timing information."""
    resp = await client.get("/v1/stats/hg38/chr16:70699930-70700000?layers=cpg_sites")
    body = resp.json()
    assert "timing" in body
    assert "query_time_ms" in body["timing"]
    assert "db_time_ms" in body["timing"]


async def test_stats_fields_in_metadata(client, seed_conservation_data):
    """fields_requested should appear in query metadata when fields= is used."""
    resp = await client.get(
        "/v1/stats/hg38/chr16:70699000-70702000?layers=phylop_phastcons_100way&fields=phylop_mean,phastcons_mean"
    )
    body = resp.json()
    assert "fields_requested" in body["query"]
    assert set(body["query"]["fields_requested"]) == {"phastcons_mean", "phylop_mean"}
