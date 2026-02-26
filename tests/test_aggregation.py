"""Tests for aggregation endpoint."""


async def test_aggregation_basic(client, seed_genomic_data):
    """Aggregate CpG sites into 1kb bins."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70699000-70701000?layers=cpg_sites&resolution=1000"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert "cpg_sites" in body["data"]
    cpg = body["data"]["cpg_sites"]
    assert cpg["resolution"] == 1000
    assert cpg["n_bins"] >= 1
    # All 3 seed sites are in the 70699000 bin
    bins = cpg["bins"]
    bin_70699 = [b for b in bins if b["bin_start"] == 70699000]
    assert len(bin_70699) == 1
    assert bin_70699[0]["count"] == 3
    assert abs(bin_70699[0]["density"] - 0.003) < 0.0001


async def test_aggregation_avg_gc(client, seed_genomic_data):
    """Aggregation for CpG layer includes avg_gc."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70699000-70701000?layers=cpg_sites&resolution=1000"
    )
    body = resp.json()
    bins = body["data"]["cpg_sites"]["bins"]
    bin_70699 = [b for b in bins if b["bin_start"] == 70699000][0]
    # avg of 0.62, 0.61, 0.55 = 0.5933...
    assert abs(bin_70699["avg_gc"] - 0.5933) < 0.01


async def test_aggregation_empty_region(client, seed_genomic_data):
    """Region with no data returns empty bins."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:1-1000?layers=cpg_sites&resolution=1000"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["cpg_sites"]["n_bins"] == 0
    assert body["data"]["cpg_sites"]["bins"] == []


async def test_aggregation_invalid_resolution(client, seed_genomic_data):
    """Non-standard resolution should return 400."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70699000-70701000?layers=cpg_sites&resolution=500"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_RESOLUTION"


async def test_aggregation_invalid_build(client):
    """Invalid build returns 400."""
    resp = await client.get(
        "/v1/aggregation/hg99/chr16:70699000-70701000?layers=cpg_sites&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_aggregation_invalid_region(client):
    """Malformed region returns 400."""
    resp = await client.get(
        "/v1/aggregation/hg38/badregion?layers=cpg_sites&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_REGION"


async def test_aggregation_gene_layer(client, seed_gene_data):
    """Aggregation works for gene_model layers (count/density only, no avg_gc)."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70699000-70707000?layers=gencode_v44&resolution=1000"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "gencode_v44" in body["data"]
    gene_data = body["data"]["gencode_v44"]
    assert gene_data["n_bins"] >= 1
    # Each bin should have count and density
    for b in gene_data["bins"]:
        assert "count" in b
        assert "density" in b


async def test_aggregation_10kb(client, seed_genomic_data):
    """10kb resolution groups all 3 sites into one bin."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr16:70690000-70700000?layers=cpg_sites&resolution=10000"
    )
    assert resp.status_code == 200
    body = resp.json()
    cpg = body["data"]["cpg_sites"]
    assert cpg["resolution"] == 10000
    bins = cpg["bins"]
    assert len(bins) == 1
    assert bins[0]["count"] == 3


async def test_aggregation_region_too_large(client):
    """Region exceeding max should return 400."""
    resp = await client.get(
        "/v1/aggregation/hg38/chr1:1-20000000?layers=cpg_sites&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "REGION_TOO_LARGE"
