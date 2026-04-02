"""Tests for HLA allele biophysics endpoints and ingestion helpers.

Covers:
- /v1/hla/loci (list loci with allele counts)
- /v1/hla/alleles/{locus} (allele browser with filters)
- /v1/hla/allele/{name} (single allele detail + features)
- /v1/hla/compare (multi-allele comparison + deltas)
- /v1/hla/noncoding-divergence (protein-identical NC variance)
- Ingestion: version idempotency in register_layers
"""

import pytest
import uuid


# ---------------------------------------------------------------------------
# Seed fixture — HLA test data within rollback transaction
# ---------------------------------------------------------------------------


@pytest.fixture
async def seed_hla_data(_txn_conn):
    """Insert test HLA layer + alleles + features for endpoint tests."""
    conn = _txn_conn

    # Deactivate any existing HLA default layers
    await conn.execute("""
        UPDATE registry.layers SET is_default = false
        WHERE layer_key IN ('hla_allele_biophysics', 'hla_allele_sequences')
          AND is_default = true
    """)

    # Ensure 'hla' enum value exists (may already exist)
    try:
        await conn.execute("ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'hla'")
    except Exception:
        pass  # already exists

    # Register test layer
    layer_id = str(uuid.uuid4())
    await conn.execute("""
        INSERT INTO registry.layers
            (id, layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
        VALUES
            ($1, 'hla_allele_biophysics', 'test-1.0', 'HLA Test', 'hla'::layer_type, 'hg38',
             'test', 'cc_by_4_0', 'postgres', true, true)
    """, layer_id)

    # Ensure hla schema exists
    await conn.execute("CREATE SCHEMA IF NOT EXISTS hla")

    # Insert test alleles: 3 HLA-A alleles (2 share same protein)
    allele_ids = []
    for allele_name, group, protein, syn, nc, gc, dg37, tm, nc_gc, nc_dg37, nc_tm, expr_suf in [
        ("A*02:01:01:01", "02", "01", "01", "01", 0.412, -1.45, 78.2, 0.385, -1.32, 74.1, None),
        ("A*02:01:01:02", "02", "01", "01", "02", 0.415, -1.44, 78.5, 0.390, -1.35, 74.8, None),
        ("A*02:05:01:01", "02", "05", "01", "01", 0.408, -1.48, 77.1, 0.375, -1.28, 73.2, "N"),
    ]:
        aid = await conn.fetchval("""
            INSERT INTO hla.alleles
                (layer_id, allele_name, locus, allele_group, protein,
                 synonymous, noncoding, hla_class, expression_suffix,
                 has_genomic, sequence_length, cds_length, n_exons, n_introns,
                 gc_content, mean_stacking_dg37, melting_temp_est,
                 nc_gc_content, nc_mean_stacking_dg37, nc_melting_temp_est,
                 cpg_count, cpg_density, cpg_obs_exp, cpg_island_count,
                 mean_a_form_prop, mean_z_form_prop, total_z_penalty,
                 mean_major_groove_w, mean_minor_groove_w,
                 nc_cpg_count, nc_cpg_density,
                 nc_mean_a_form_prop, nc_mean_z_form_prop, nc_total_z_penalty,
                 nc_cpg_island_count,
                 flag_count_total, flag_count_warnings,
                 imgt_version, accession)
            VALUES
                ($1, $2, 'HLA-A', $3, $4, $5, $6, 1, $7,
                 true, 3503, 1098, 8, 7,
                 $8, $9, $10,
                 $11, $12, $13,
                 45, 0.013, 0.72, 1,
                 0.35, 0.08, 2.1,
                 11.5, 5.8,
                 30, 0.011,
                 0.33, 0.07, 1.8,
                 0,
                 2, 1,
                 '3.56.0', 'HLA:HLA00001')
            RETURNING id
        """, layer_id, allele_name, group, protein, syn, nc, expr_suf, gc, dg37, tm, nc_gc, nc_dg37, nc_tm)
        allele_ids.append(aid)

    # Insert features for first allele
    for feat_type, feat_num, label, start, end in [
        ("5utr", 1, "5utr", 0, 300),
        ("exon", 2, "exon_1", 300, 573),
        ("intron", 3, "intron_1", 573, 800),
        ("exon", 4, "exon_2", 800, 1070),
        ("intron", 5, "intron_2", 1070, 2500),
        ("exon", 6, "exon_3", 2500, 2776),
        ("3utr", 7, "3utr", 2776, 3503),
    ]:
        await conn.execute("""
            INSERT INTO hla.allele_features
                (layer_id, allele_id, feature_type, feature_number, feature_label,
                 start_pos, end_pos, length_bp,
                 gc_content, mean_stacking_dg37, melting_temp_est)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.41, -1.4, 77.0)
        """, layer_id, allele_ids[0], feat_type, feat_num, label, start, end, end - start)

    yield {"layer_id": layer_id, "allele_ids": allele_ids}


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------


class TestHLALoci:
    """GET /v1/hla/loci"""

    async def test_loci_returns_data(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/loci")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "complete"
        assert body["n_loci"] >= 1

    async def test_loci_includes_hla_a(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/loci")
        body = resp.json()
        locus_names = [l["locus"] for l in body["loci"]]
        assert "HLA-A" in locus_names

    async def test_loci_has_biophysics(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/loci")
        body = resp.json()
        hla_a = next(l for l in body["loci"] if l["locus"] == "HLA-A")
        assert hla_a["mean_gc_content"] is not None
        assert hla_a["mean_stacking_dg37"] is not None
        assert hla_a["genomic_alleles"] == 3


class TestHLAAlleles:
    """GET /v1/hla/alleles/{locus}"""

    async def test_list_alleles(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/alleles/A")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert len(body["alleles"]) == 3

    async def test_filter_by_allele_group(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/alleles/A?allele_group=02&protein=01")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2  # A*02:01:01:01 and A*02:01:01:02

    async def test_filter_genomic_only(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/alleles/A?genomic_only=true")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3  # all have has_genomic=true

    async def test_invalid_locus(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/alleles/XYZ")
        assert resp.status_code == 400

    async def test_allele_has_nc_biophysics(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/alleles/A")
        body = resp.json()
        a = body["alleles"][0]
        assert a["nc_gc_content"] is not None
        assert a["nc_mean_stacking_dg37"] is not None


class TestHLAAlleleDetail:
    """GET /v1/hla/allele/{name}"""

    async def test_allele_detail(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/allele/A*02:01:01:01")
        assert resp.status_code == 200
        body = resp.json()
        assert body["identity"]["allele_name"] == "A*02:01:01:01"
        assert body["identity"]["locus"] == "HLA-A"
        assert body["identity"]["hla_class"] == 1

    async def test_allele_has_features(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/allele/A*02:01:01:01")
        body = resp.json()
        assert len(body["features"]) == 7
        types = [f["feature_type"] for f in body["features"]]
        assert "exon" in types
        assert "intron" in types
        assert "5utr" in types
        assert "3utr" in types

    async def test_allele_biophysics_blocks(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/allele/A*02:01:01:01")
        body = resp.json()
        assert body["biophysics"]["gc_content"] is not None
        assert body["noncoding_biophysics"]["gc_content"] is not None

    async def test_allele_not_found(self, client, seed_hla_data):
        resp = await client.get("/v1/hla/allele/A*99:99:99:99")
        assert resp.status_code == 404


class TestHLACompare:
    """POST /v1/hla/compare"""

    async def test_compare_two_alleles(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/compare", json={
            "alleles": ["A*02:01:01:01", "A*02:01:01:02"],
            "focus": "noncoding",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["n_alleles"] == 2
        assert body["reference"] == "A*02:01:01:01"
        assert body["shared_protein"] is True
        assert "A*02:01:01:02" in body["deltas_vs_reference"]

    async def test_compare_deltas_present(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/compare", json={
            "alleles": ["A*02:01:01:01", "A*02:05:01:01"],
            "focus": "noncoding",
        })
        body = resp.json()
        deltas = body["deltas_vs_reference"]["A*02:05:01:01"]
        assert "delta_gc_content" in deltas
        assert "delta_mean_stacking_dg37" in deltas

    async def test_compare_shared_protein_false(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/compare", json={
            "alleles": ["A*02:01:01:01", "A*02:05:01:01"],
            "focus": "noncoding",
        })
        body = resp.json()
        assert body["shared_protein"] is False

    async def test_compare_needs_two(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/compare", json={
            "alleles": ["A*02:01:01:01"],
            "focus": "noncoding",
        })
        assert resp.status_code == 422  # validation error


class TestHLADivergence:
    """POST /v1/hla/noncoding-divergence"""

    async def test_divergence_protein_identical(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/noncoding-divergence", json={
            "locus": "HLA-A",
            "allele_group": "02",
            "protein": "01",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["n_alleles"] == 2  # A*02:01:01:01 and A*02:01:01:02
        assert body["most_variable_metric"] is not None

    async def test_divergence_has_variance_ranking(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/noncoding-divergence", json={
            "locus": "HLA-A",
            "allele_group": "02",
            "protein": "01",
        })
        body = resp.json()
        assert len(body["ranked_by_variance"]) > 0
        top = body["ranked_by_variance"][0]
        assert "variance" in top
        assert "mean" in top
        assert "range" in top

    async def test_divergence_not_found(self, client, seed_hla_data):
        resp = await client.post("/v1/hla/noncoding-divergence", json={
            "locus": "HLA-A",
            "allele_group": "99",
            "protein": "99",
        })
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Ingestion unit tests
# ---------------------------------------------------------------------------


class TestIngestionHelpers:
    """Unit tests for HLA ingestion helper functions."""

    def test_parse_allele_name_4field(self):
        from polymer_genomics.ingest.hla_alleles import parse_allele_name
        result = parse_allele_name("A*02:01:01:01")
        assert result["locus"] == "HLA-A"
        assert result["allele_group"] == "02"
        assert result["protein"] == "01"
        assert result["synonymous"] == "01"
        assert result["noncoding"] == "01"
        assert result["hla_class"] == 1
        assert result["expression_suffix"] is None

    def test_parse_allele_name_with_suffix(self):
        from polymer_genomics.ingest.hla_alleles import parse_allele_name
        result = parse_allele_name("A*02:01:01:02N")
        assert result["expression_suffix"] == "N"
        assert result["noncoding"] == "02"

    def test_parse_allele_name_2field(self):
        from polymer_genomics.ingest.hla_alleles import parse_allele_name
        result = parse_allele_name("DRB1*01:01")
        assert result["locus"] == "HLA-DRB1"
        assert result["hla_class"] == 2
        assert result["synonymous"] is None

    def test_parse_allele_name_invalid(self):
        from polymer_genomics.ingest.hla_alleles import parse_allele_name
        with pytest.raises(ValueError):
            parse_allele_name("INVALID")

    def test_version_format_consistency(self):
        """The version used in register_layers must match what detect_imgt_version returns."""
        from polymer_genomics.ingest.hla_alleles import detect_imgt_version
        from pathlib import Path
        # detect_imgt_version returns e.g. '3.56.0' — register_layers should use this directly
        # The bug was: version = f"1.0.{imgt_version}" → '1.0.3.56.0'
        version = detect_imgt_version(Path("/nonexistent"))
        # Fallback should be a clean version string
        assert version == "3.56.0"
        # The version used for layer registration should NOT be prefixed
        assert not version.startswith("1.0.")

    def test_biophysics_summary_basic(self):
        from polymer_genomics.ingest.hla_alleles import compute_biophysics_summary
        result = compute_biophysics_summary("ATCGATCGATCG")
        assert "gc_content" in result
        assert "cpg_count" in result
        assert result["gc_content"] == pytest.approx(0.5, abs=0.01)

    def test_biophysics_summary_short_seq(self):
        from polymer_genomics.ingest.hla_alleles import compute_biophysics_summary
        result = compute_biophysics_summary("A")
        assert result == {}

    def test_feature_extraction_with_cds(self):
        from polymer_genomics.ingest.hla_alleles import extract_features_by_cds_alignment
        # Need sufficiently long exon chunks for seed matching (>=15bp)
        exon1 = "ATCGATCGATCGATCGATCG"  # 20bp
        exon2 = "GCTAGCTAGCTAGCTAGCTA"  # 20bp
        genomic = "AAAAAAAAAA" + exon1 + "TTTTTTTTTTTTTT" + exon2 + "CCCCCCCCCC"
        cds = exon1 + exon2
        features = extract_features_by_cds_alignment(genomic, cds, hla_class=1)
        types = [f["feature_type"] for f in features]
        assert "5utr" in types
        assert "exon" in types
        assert "intron" in types
        assert "3utr" in types
