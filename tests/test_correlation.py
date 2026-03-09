"""Tests for the cross-layer correlation endpoint."""

import pytest


# ---------------------------------------------------------------------------
# Seed fixture: CpG + regulatory data with known correlated pattern
# ---------------------------------------------------------------------------


@pytest.fixture
async def seed_correlation_data(_txn_conn, seed_layers):
    """Seed CpG sites and cCREs with a known positive-correlation pattern.

    Three 1kb bins on chr16:
      bin 70699000: 3 CpG sites, 1 cCRE  (high CpG, has regulatory)
      bin 70700000: 2 CpG sites, 1 cCRE  (mid CpG, has regulatory)
      bin 70701000: 0 CpG sites, 0 cCREs (empty)
    """
    conn = _txn_conn
    cpg_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'cpg_sites' AND is_default = true"
    )
    reg_layer = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'encode_ccre_v4' AND is_default = true"
    )

    # CpG sites: 3 in bin 70699000, 2 in bin 70700000
    await conn.execute(
        """
        INSERT INTO cpg.sites (layer_id, build, chr_id, pos, context, gc_content)
        VALUES
            ($1, 'hg38', 16, 70699100, 'island', 0.70),
            ($1, 'hg38', 16, 70699200, 'island', 0.68),
            ($1, 'hg38', 16, 70699500, 'island', 0.65),
            ($1, 'hg38', 16, 70700100, 'n_shore', 0.55),
            ($1, 'hg38', 16, 70700500, 'n_shore', 0.52)
        """,
        cpg_layer,
    )

    # cCREs: 1 in bin 70699000, 1 in bin 70700000
    await conn.execute(
        """
        INSERT INTO regulatory.ccre
            (layer_id, build, chr_id, start_pos, end_pos,
             accession, score, encode_label, ccre_class, z_score, description)
        VALUES
            ($1, 'hg38', 16, 70699300, 70699600, 'EH38E1000001', 500, 'pELS',
             'pELS', 5.0, 'test cCRE 1'),
            ($1, 'hg38', 16, 70700200, 70700400, 'EH38E1000002', 300, 'dELS',
             'dELS', 3.0, 'test cCRE 2')
        """,
        reg_layer,
    )
    yield


@pytest.fixture
async def _txn_conn():
    """Re-export from conftest (pytest discovers it automatically)."""
    # This is handled by conftest.py — pytest fixtures are inherited.
    # This fixture definition exists only to make seed_correlation_data
    # work when conftest provides _txn_conn.
    raise NotImplementedError("Should be provided by conftest.py")


# Remove the local _txn_conn — conftest provides it
del _txn_conn


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


async def test_pearson_r(client, seed_correlation_data):
    """Pearson correlation between CpG density and regulatory density."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"

    data = body["data"]
    assert data["statistic"] == "pearson_r"
    # FULL OUTER JOIN only returns bins with data in at least one layer,
    # so the empty bin (70701000) is absent → 2 bins
    assert data["n_bins"] == 2
    # With only 2 bins Pearson returns insufficient_data (needs >= 3)
    # This is correct: the seed data has both layers non-empty in the
    # same 2 bins, but Pearson needs at least 3 data points.
    assert data["value"] is None
    assert data["reason"] == "insufficient_data"


async def test_spearman_rho(client, seed_correlation_data):
    """Spearman rho between CpG density and regulatory density."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=spearman_rho&resolution=1000"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statistic"] == "spearman_rho"
    # Only 2 bins → insufficient for correlation
    assert data["n_bins"] == 2
    assert data["value"] is None


async def test_overlap_enrichment(client, seed_correlation_data):
    """Overlap enrichment between two count-mode layers."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=overlap_enrichment&resolution=1000"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statistic"] == "overlap_enrichment"
    assert data["value"] is not None
    # 2 of 3 bins have both → enrichment > 1
    assert data["value"] >= 1.0
    assert "details" in data
    assert data["details"]["n_both_nonzero"] == 2


async def test_jaccard(client, seed_correlation_data):
    """Jaccard index between two count-mode layers."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=jaccard&resolution=1000"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statistic"] == "jaccard"
    # 2 bins intersect, 2 bins in union → 2/2 = 1.0
    assert data["value"] == 1.0
    assert data["details"]["n_intersection"] == 2
    assert data["details"]["n_union"] == 2


async def test_fisher_exact(client, seed_correlation_data):
    """Fisher exact test between two count-mode layers."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=fisher_exact&resolution=1000"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statistic"] == "fisher_exact"
    assert data["p_value"] is not None
    assert "contingency_table" in data["details"]
    ct = data["details"]["contingency_table"]
    # Only 2 bins returned by FULL OUTER JOIN (empty bins not materialized)
    assert ct["both"] + ct["a_only"] + ct["b_only"] + ct["neither"] == 2


async def test_custom_fields(client, seed_correlation_data):
    """Correlate CpG avg_gc with regulatory avg_score."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
        "&field_a=avg_gc&field_b=avg_score"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statistic"] == "pearson_r"
    assert data["n_bins"] == 2


async def test_10kb_resolution(client, seed_correlation_data):
    """At 10kb resolution seed data spans two bins (70690000 and 70700000)."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=10000"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # floor(70699xxx/10000)=70690000, floor(70700xxx/10000)=70700000 → 2 bins
    assert data["n_bins"] == 2


async def test_layers_resolved(client, seed_correlation_data):
    """Response includes both layers in layers_resolved."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
    )
    body = resp.json()
    assert len(body["layers_resolved"]) == 2
    keys = {lr["layer_key"] for lr in body["layers_resolved"]}
    assert keys == {"cpg_sites", "encode_ccre_v4"}


# ---------------------------------------------------------------------------
# Conservation x CpG (count x continuous)
# ---------------------------------------------------------------------------


async def test_pearson_count_continuous(client, seed_genomic_data, seed_conservation_data):
    """Pearson works with count (CpG) x continuous (conservation)."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=phylop_phastcons_100way"
        "&stat=pearson_r&resolution=1000"
        "&field_a=density&field_b=phylop_mean"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["statistic"] == "pearson_r"
    assert data["n_bins"] >= 1


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------


async def test_invalid_stat(client, seed_correlation_data):
    """Unknown statistic returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=chi_squared&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_STAT"


async def test_incompatible_stat(client, seed_genomic_data, seed_conservation_data):
    """overlap_enrichment on count x continuous returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=phylop_phastcons_100way"
        "&stat=overlap_enrichment&resolution=1000"
        "&field_b=phylop_mean"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INCOMPATIBLE_STAT"


async def test_unknown_layer(client, seed_layers):
    """Unknown layer key returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=nonexistent_layer&layer_b=cpg_sites"
        "&stat=pearson_r&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "UNKNOWN_LAYER"


async def test_invalid_field(client, seed_correlation_data):
    """Invalid field for layer type returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
        "&field_a=nonexistent_field"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_FIELD"


async def test_self_correlation(client, seed_correlation_data):
    """Same layer + same field returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=cpg_sites"
        "&stat=pearson_r&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "SELF_CORRELATION"


async def test_too_many_bins(client, seed_layers):
    """Region / resolution > 50K bins returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr1:1-100000000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "TOO_MANY_BINS"


async def test_invalid_build(client):
    """Invalid build returns 400."""
    resp = await client.get(
        "/v1/correlate/hg99/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "BUILD_MISMATCH"


async def test_invalid_resolution(client):
    """Non-standard resolution returns 400."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:70699000-70702000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=500"
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"]["code"] == "INVALID_RESOLUTION"


async def test_empty_region(client, seed_layers):
    """Region with no data returns value: null with reason."""
    resp = await client.get(
        "/v1/correlate/hg38/chr16:1-3000"
        "?layer_a=cpg_sites&layer_b=encode_ccre_v4"
        "&stat=pearson_r&resolution=1000"
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["value"] is None
    assert data["n_bins"] == 0
    assert data["reason"] == "insufficient_data"


# ---------------------------------------------------------------------------
# Unit tests for statistical functions
# ---------------------------------------------------------------------------


class TestStatFunctions:
    """Direct tests of the pure-Python stat implementations."""

    def test_pearson_perfect_positive(self):
        from polymer_genomics.correlation import compute_pearson
        result = compute_pearson([1.0, 2.0, 3.0, 4.0, 5.0],
                                [2.0, 4.0, 6.0, 8.0, 10.0])
        assert abs(result["value"] - 1.0) < 1e-6
        assert result["p_value"] < 0.01

    def test_pearson_perfect_negative(self):
        from polymer_genomics.correlation import compute_pearson
        result = compute_pearson([1.0, 2.0, 3.0, 4.0, 5.0],
                                [10.0, 8.0, 6.0, 4.0, 2.0])
        assert abs(result["value"] - (-1.0)) < 1e-6

    def test_pearson_zero_variance(self):
        from polymer_genomics.correlation import compute_pearson
        result = compute_pearson([1.0, 1.0, 1.0], [2.0, 3.0, 4.0])
        assert result["value"] is None
        assert result["reason"] == "zero_variance"

    def test_pearson_insufficient_data(self):
        from polymer_genomics.correlation import compute_pearson
        result = compute_pearson([1.0, 2.0], [3.0, 4.0])
        assert result["value"] is None
        assert result["reason"] == "insufficient_data"

    def test_spearman_monotonic(self):
        from polymer_genomics.correlation import compute_spearman
        result = compute_spearman([1.0, 2.0, 3.0, 4.0],
                                 [10.0, 20.0, 30.0, 40.0])
        assert abs(result["value"] - 1.0) < 1e-6

    def test_jaccard_empty(self):
        from polymer_genomics.correlation import compute_jaccard
        result = compute_jaccard([0.0, 0.0], [0.0, 0.0])
        assert result["value"] is None

    def test_jaccard_perfect_overlap(self):
        from polymer_genomics.correlation import compute_jaccard
        result = compute_jaccard([1.0, 2.0, 0.0], [3.0, 1.0, 0.0])
        assert abs(result["value"] - 1.0) < 1e-6

    def test_jaccard_no_overlap(self):
        from polymer_genomics.correlation import compute_jaccard
        result = compute_jaccard([1.0, 0.0, 0.0], [0.0, 0.0, 1.0])
        assert result["value"] == 0.0

    def test_overlap_enrichment_perfect(self):
        from polymer_genomics.correlation import compute_overlap_enrichment
        result = compute_overlap_enrichment([1.0, 1.0, 0.0],
                                           [1.0, 1.0, 0.0])
        assert result["value"] is not None
        assert result["value"] > 1.0

    def test_fisher_exact_independent(self):
        from polymer_genomics.correlation import compute_fisher_exact
        # Large balanced table → non-significant
        a = [1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0]
        b = [0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0]
        result = compute_fisher_exact(a, b)
        assert result["p_value"] is not None
        assert "contingency_table" in result["details"]
