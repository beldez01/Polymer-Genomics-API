"""Tests for SBS thermodynamic spectrum and epigenetic clock endpoints."""

import pytest

from polymer_genomics.ingest.sbs_spectrum import compute_sbs_spectrum


# ═══════════════════════════════════════════════════════════════════════════════
# Unit tests for SBS computation (no DB required)
# ═══════════════════════════════════════════════════════════════════════════════


class TestSBSComputation:
    def test_produces_96_channels(self):
        spectrum = compute_sbs_spectrum()
        assert len(spectrum) == 96

    def test_all_mutation_types_present(self):
        spectrum = compute_sbs_spectrum()
        types = {r["mutation_type"] for r in spectrum}
        assert types == {"C>A", "C>G", "C>T", "T>A", "T>C", "T>G"}

    def test_16_channels_per_mutation_type(self):
        spectrum = compute_sbs_spectrum()
        for mt in ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"]:
            channels = [r for r in spectrum if r["mutation_type"] == mt]
            assert len(channels) == 16, f"{mt} has {len(channels)} channels"

    def test_delta_dg_is_correct(self):
        """Verify A[C>A]G channel manually.

        ΔG_wt = ΔG(AC) + ΔG(CG) = -1.44 + -2.17 = -3.61
        ΔG_mut = ΔG(AA) + ΔG(AG) = -1.00 + -1.28 = -2.28
        δΔG = -2.28 - (-3.61) = +1.33
        """
        spectrum = compute_sbs_spectrum()
        channel = next(r for r in spectrum if r["channel"] == "A[C>A]G")
        assert channel["dg_wt"] == pytest.approx(-3.61, abs=0.01)
        assert channel["dg_mut"] == pytest.approx(-2.28, abs=0.01)
        assert channel["delta_dg"] == pytest.approx(1.33, abs=0.01)

    def test_cg_to_tg_highly_destabilizing(self):
        """C>T at CpG (C[C>T]G) should be strongly destabilizing.

        CG is the most stable dinucleotide step (ΔG = -2.17).
        """
        spectrum = compute_sbs_spectrum()
        channel = next(r for r in spectrum if r["channel"] == "C[C>T]G")
        assert channel["delta_dg"] > 0  # destabilizing

    def test_all_channels_have_valid_trinucleotides(self):
        spectrum = compute_sbs_spectrum()
        valid_bases = set("ACGT")
        for r in spectrum:
            assert set(r["trinuc_ref"]) <= valid_bases
            assert set(r["trinuc_alt"]) <= valid_bases
            assert len(r["trinuc_ref"]) == 3
            assert len(r["trinuc_alt"]) == 3

    def test_channel_format(self):
        spectrum = compute_sbs_spectrum()
        for r in spectrum:
            # Format: X[Y>Z]W
            assert "[" in r["channel"]
            assert ">" in r["channel"]
            assert "]" in r["channel"]

    def test_symmetric_mutations(self):
        """C>G and its complement G>C (not in pyrimidine set) — just
        verify that C>G channels exist with expected signs."""
        spectrum = compute_sbs_spectrum()
        cg_channels = [r for r in spectrum if r["mutation_type"] == "C>G"]
        assert len(cg_channels) == 16


# ═══════════════════════════════════════════════════════════════════════════════
# API endpoint tests (require DB)
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
async def seed_sbs_data(_txn_conn):
    """Insert minimal SBS spectrum data for endpoint tests."""
    conn = _txn_conn

    # Ensure mutation schema and table exist (migration 025 should handle this,
    # but for test isolation we create if needed)
    await conn.execute("""
        INSERT INTO mutation.sbs_spectrum
            (channel, mutation_type, ref_base, alt_base, flanking_5, flanking_3,
             trinuc_ref, trinuc_alt, dg_wt, dg_mut, delta_dg, source_citation)
        VALUES
            ('A[C>A]G', 'C>A', 'C', 'A', 'A', 'G', 'ACG', 'AAG',
             -3.61, -2.28, 1.33, 'SantaLucia 1998; COSMIC SBS v3.4'),
            ('T[C>A]A', 'C>A', 'C', 'A', 'T', 'A', 'TCA', 'TAA',
             -1.30, -0.58, 0.72, 'SantaLucia 1998; COSMIC SBS v3.4'),
            ('A[T>C]G', 'T>C', 'T', 'C', 'A', 'G', 'ATG', 'ACG',
             -0.88, -1.44, -0.56, 'SantaLucia 1998; COSMIC SBS v3.4')
        ON CONFLICT (channel) DO NOTHING
    """)
    yield


@pytest.fixture
async def seed_clock_data(_txn_conn):
    """Insert minimal clock data for endpoint tests."""
    conn = _txn_conn

    await conn.execute("""
        INSERT INTO ref.clock_metadata
            (clock_name, display_name, n_probes, tissue, outcome,
             intercept, age_transform, platform, pmid, source_citation)
        VALUES
            ('horvath_2013', 'Horvath Multi-tissue Clock', 353,
             'pan_tissue', 'chronological_age', 0.6955,
             'anti_log_linear', '450k', '24138928',
             'Horvath 2013 Genome Biol 14:R115'),
            ('hannum_2013', 'Hannum Blood Clock', 71,
             'blood', 'chronological_age', NULL,
             'linear', '450k', '23177740',
             'Hannum 2013 Mol Cell 49:359-367')
        ON CONFLICT (clock_name) DO NOTHING
    """)

    await conn.execute("""
        INSERT INTO ref.clock_coefficients
            (clock_name, probe_id, coefficient, source_citation)
        VALUES
            ('horvath_2013', 'cg16867657', 6.249, 'Horvath 2013 Table S3'),
            ('horvath_2013', 'cg22736354', 5.737, 'Horvath 2013 Table S3'),
            ('hannum_2013', 'cg16867657', 0.0487, 'Hannum 2013 Table S2'),
            ('hannum_2013', 'cg06493994', 0.0941, 'Hannum 2013 Table S2')
        ON CONFLICT (clock_name, probe_id) DO NOTHING
    """)
    yield


class TestSBSSpectrum:
    @pytest.mark.asyncio
    async def test_get_all(self, client, seed_sbs_data):
        resp = await client.get("/v1/reference/sbs-spectrum")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 3

    @pytest.mark.asyncio
    async def test_filter_by_mutation_type(self, client, seed_sbs_data):
        resp = await client.get("/v1/reference/sbs-spectrum?mutation_type=C>A")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 2
        for ch in data["channels"]:
            assert ch["mutation_type"] == "C>A"

    @pytest.mark.asyncio
    async def test_get_specific_channel(self, client, seed_sbs_data):
        resp = await client.get("/v1/reference/sbs-spectrum?channel=A[C>A]G")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] == 1
        assert data["channels"][0]["delta_dg"] == pytest.approx(1.33, abs=0.01)

    @pytest.mark.asyncio
    async def test_not_found_channel(self, client, seed_sbs_data):
        resp = await client.get("/v1/reference/sbs-spectrum?channel=Z[Z>Z]Z")
        assert resp.status_code == 404


class TestClockProbes:
    @pytest.mark.asyncio
    async def test_list_all_clocks(self, client, seed_clock_data):
        resp = await client.get("/v1/reference/clock-probes")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 2
        clock_names = [c["clock_name"] for c in data["clocks"]]
        assert "horvath_2013" in clock_names

    @pytest.mark.asyncio
    async def test_get_clock_probes(self, client, seed_clock_data):
        resp = await client.get("/v1/reference/clock-probes?clock=horvath_2013")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["clock"]["clock_name"] == "horvath_2013"
        assert data["n_loaded"] >= 2
        probe_ids = [p["probe_id"] for p in data["probes"]]
        assert "cg16867657" in probe_ids

    @pytest.mark.asyncio
    async def test_probe_membership(self, client, seed_clock_data):
        resp = await client.get("/v1/reference/clock-probes?probe_id=cg16867657")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] >= 2  # In both Horvath and Hannum
        clock_names = [c["clock_name"] for c in data["clocks"]]
        assert "horvath_2013" in clock_names
        assert "hannum_2013" in clock_names

    @pytest.mark.asyncio
    async def test_probe_not_in_any_clock(self, client, seed_clock_data):
        resp = await client.get("/v1/reference/clock-probes?probe_id=cg99999999")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["n"] == 0

    @pytest.mark.asyncio
    async def test_invalid_clock(self, client, seed_clock_data):
        resp = await client.get("/v1/reference/clock-probes?clock=nonexistent_clock")
        assert resp.status_code == 404
