"""Tests for the biophysical reference constants endpoints."""

import pytest


# ── Seed fixture ────────────────────────────────────────────────────────────


@pytest.fixture
async def seed_reference_data(_txn_conn):
    """Insert minimal reference data for endpoint tests."""
    conn = _txn_conn

    # Catalog
    await conn.execute("""
        INSERT INTO reference.catalog
            (table_name, display_name, description, source_citation, row_count)
        VALUES
            ('nn_thermodynamics', 'NN Thermodynamics',
             'Test NN params', 'SantaLucia 1998', 2),
            ('amino_acid_properties', 'Amino Acid Properties',
             'Test AA props', 'Kyte-Doolittle 1982', 1)
        ON CONFLICT (table_name) DO NOTHING
    """)

    # NN thermodynamics — 2 rows
    await conn.execute("""
        INSERT INTO reference.nn_thermodynamics
            (duplex_type, dinucleotide, delta_h, delta_s, delta_g_37, source_citation)
        VALUES
            ('dna_dna', 'CG', -10.6, -27.2, -2.17, 'SantaLucia 1998'),
            ('dna_dna', 'AA', -7.9, -22.2, -1.0, 'SantaLucia 1998')
        ON CONFLICT (duplex_type, dinucleotide) DO NOTHING
    """)

    # Dinucleotide properties — 1 row
    await conn.execute("""
        INSERT INTO reference.dinucleotide_properties
            (dinucleotide, extinction_coeff_260, a_form_propensity, z_form_propensity,
             major_groove_width, major_groove_depth, minor_groove_width, minor_groove_depth,
             source_citation)
        VALUES
            ('CG', 18000, 0.85, 0.0, 11.2, 8.5, 5.5, 7.5, 'Test sources')
        ON CONFLICT (dinucleotide) DO NOTHING
    """)

    # Amino acid — 1 row
    await conn.execute("""
        INSERT INTO reference.amino_acid_properties
            (one_letter, three_letter, full_name, mw_da, volume_a3, sasa_a2,
             kd_hydrophobicity, ww_hydrophobicity, eisenberg_hydrophobicity,
             pka_side_chain, charge_at_ph7, ecpa_b20, source_citation)
        VALUES
            ('W', 'Trp', 'Tryptophan', 186.21, 228, 255,
             -0.9, 1.85, 0.81, NULL, 0.0, 74.3, 'Test sources')
        ON CONFLICT (one_letter) DO NOTHING
    """)

    # Physical constants — 1 row
    await conn.execute("""
        INSERT INTO reference.physical_constants
            (name, symbol, value, units, category, description, context, source_citation)
        VALUES
            ('lp_bdna_physiological_nm', 'Lp', 50.0, 'nm', 'mechanics',
             'Persistence length of bare B-DNA', '150 mM NaCl, 37°C',
             'Hagerman 1988')
        ON CONFLICT (name) DO NOTHING
    """)

    yield


# ── NN Parameters ───────────────────────────────────────────────────────────


class TestNNParameters:
    @pytest.mark.asyncio
    async def test_get_all_dna_dna(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/nn-parameters?duplex_type=dna_dna")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 2
        dinucs = [p["dinucleotide"] for p in data["parameters"]]
        assert "CG" in dinucs

    @pytest.mark.asyncio
    async def test_get_specific_dinucleotide(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/nn-parameters?duplex_type=dna_dna&dinucleotide=CG")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] == 1
        assert data["parameters"][0]["delta_g_37"] == pytest.approx(-2.17, abs=0.01)

    @pytest.mark.asyncio
    async def test_invalid_duplex_type(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/nn-parameters?duplex_type=invalid")
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_not_found_dinucleotide(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/nn-parameters?duplex_type=dna_dna&dinucleotide=ZZ")
        assert resp.status_code == 404


# ── Dinucleotide Properties ─────────────────────────────────────────────────


class TestDinucleotideProperties:
    @pytest.mark.asyncio
    async def test_get_all(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/dinucleotide-properties")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 1

    @pytest.mark.asyncio
    async def test_filter_extinction(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/dinucleotide-properties?property_set=extinction")
        assert resp.status_code == 200
        props = resp.json()["data"]["properties"]
        assert len(props) >= 1
        for p in props:
            assert "extinction_coeff_260" in p
            assert "major_groove_width" not in p

    @pytest.mark.asyncio
    async def test_invalid_property_set(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/dinucleotide-properties?property_set=invalid")
        assert resp.status_code == 400


# ── Amino Acid Properties ──────────────────────────────────────────────────


class TestAminoAcidProperties:
    @pytest.mark.asyncio
    async def test_get_trp(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/amino-acid-properties?residue=W")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] == 1
        aa = data["amino_acids"][0]
        assert aa["mw_da"] == pytest.approx(186.21, abs=0.1)
        assert aa["ecpa_b20"] == pytest.approx(74.3, abs=0.1)

    @pytest.mark.asyncio
    async def test_scale_kd(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/amino-acid-properties?residue=W&scale=kd")
        assert resp.status_code == 200
        aa = resp.json()["data"]["amino_acids"][0]
        assert "kd_hydrophobicity" in aa
        assert "ww_hydrophobicity" not in aa

    @pytest.mark.asyncio
    async def test_not_found(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/amino-acid-properties?residue=Z")
        assert resp.status_code == 404


# ── Physical Constants ──────────────────────────────────────────────────────


class TestPhysicalConstants:
    @pytest.mark.asyncio
    async def test_get_by_name(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/physical-constants?name=lp_bdna_physiological_nm")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] == 1
        assert data["constants"][0]["value"] == 50.0
        assert data["constants"][0]["units"] == "nm"

    @pytest.mark.asyncio
    async def test_filter_by_category(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/physical-constants?category=mechanics")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 1

    @pytest.mark.asyncio
    async def test_not_found(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/physical-constants?name=nonexistent")
        assert resp.status_code == 404


# ── Envelope format ─────────────────────────────────────────────────────────


class TestEnvelopeFormat:
    @pytest.mark.asyncio
    async def test_envelope_structure(self, client, seed_reference_data):
        resp = await client.get("/v1/reference/nn-parameters?duplex_type=dna_dna")
        body = resp.json()
        assert body["status"] == "complete"
        assert body["coordinate_system"] == "1-based_closed"
        assert body["layers_resolved"] == []
        assert "timing" in body
        assert "query_time_ms" in body["timing"]
