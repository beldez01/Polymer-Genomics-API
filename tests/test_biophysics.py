"""Tests for the biophysics computation module (pure Python, no DB)."""

import pytest

from polymer_genomics.biophysics import (
    compute_all,
    compute_extinction,
    compute_form_propensity,
    compute_groove_profile,
    compute_thermodynamics,
)


# ── Thermodynamics ──────────────────────────────────────────────────────────


class TestComputeThermodynamics:
    def test_cg_step_santalucia(self):
        """CG dinucleotide ΔG₃₇ should be -2.17 kcal/mol (SantaLucia 1998)."""
        result = compute_thermodynamics("CG")
        assert len(result["per_step"]) == 1
        step = result["per_step"][0]
        assert step["dinucleotide"] == "CG"
        assert step["delta_g_37"] == -2.17

    def test_cumulative_dg(self):
        """Cumulative ΔG should equal sum of per-step values."""
        result = compute_thermodynamics("ACGT", salt_mm=1000.0)
        steps = result["per_step"]
        assert len(steps) == 3
        cum = sum(s["delta_g_salt"] for s in steps)
        assert abs(steps[-1]["cumulative_dg"] - cum) < 0.01

    def test_salt_correction_physiological(self):
        """Lower salt should give less negative ΔG (less stable)."""
        r_1m = compute_thermodynamics("ACGTACGT", salt_mm=1000.0)
        r_150mm = compute_thermodynamics("ACGTACGT", salt_mm=150.0)
        # At lower salt, total ΔG should be less negative (less stable)
        assert r_150mm["summary"]["total_delta_g_salt"] > r_1m["summary"]["total_delta_g_salt"]

    def test_at_1m_no_correction(self):
        """At 1M NaCl, salt-corrected ΔG should equal standard ΔG₃₇."""
        result = compute_thermodynamics("CG", salt_mm=1000.0)
        step = result["per_step"][0]
        # At 1M, ln(1.0) = 0, so correction is zero (small rounding diff OK)
        assert step["delta_g_salt"] == pytest.approx(step["delta_g_37"], abs=0.02)

    def test_empty_sequence(self):
        """Single base should return empty profile."""
        result = compute_thermodynamics("A")
        assert result["per_step"] == []
        assert result["summary"]["n_steps"] == 0

    def test_gc_rich_more_stable(self):
        """GC-rich sequence should have more negative total ΔG than AT-rich."""
        gc_rich = compute_thermodynamics("GCGCGCGC", salt_mm=1000.0)
        at_rich = compute_thermodynamics("ATATATAT", salt_mm=1000.0)
        assert gc_rich["summary"]["total_delta_g_37"] < at_rich["summary"]["total_delta_g_37"]

    def test_summary_fields(self):
        result = compute_thermodynamics("ACGT")
        s = result["summary"]
        assert "n_steps" in s
        assert "total_delta_h" in s
        assert "total_delta_s" in s
        assert "total_delta_g_37" in s
        assert "total_delta_g_salt" in s
        assert "mean_delta_g_per_step" in s
        assert s["n_steps"] == 3


# ── Extinction ──────────────────────────────────────────────────────────────


class TestComputeExtinction:
    def test_basic(self):
        result = compute_extinction("ACGT")
        assert len(result["per_step"]) == 3
        assert "total_extinction_260" in result["summary"]

    def test_known_dinuc(self):
        """AA extinction should be 27400 (Tataurov 2008)."""
        result = compute_extinction("AA")
        assert result["per_step"][0]["extinction_260"] == 27400

    def test_empty(self):
        result = compute_extinction("A")
        assert result["per_step"] == []


# ── Form Propensity ─────────────────────────────────────────────────────────


class TestComputeFormPropensity:
    def test_cg_z_form_zero(self):
        """CG has Z-form propensity = 0.0 (most Z-favorable, Ho 1986)."""
        result = compute_form_propensity("CG")
        assert result["per_step"][0]["z_form_propensity"] == 0.0

    def test_cg_alternating_z_favorable(self):
        """Alternating CG should have low total Z-penalty."""
        result = compute_form_propensity("CGCGCG")
        assert result["summary"]["total_z_penalty"] < 3.0

    def test_aa_z_unfavorable(self):
        """AA has highest Z-form penalty (3.0)."""
        result = compute_form_propensity("AA")
        assert result["per_step"][0]["z_form_propensity"] == 3.0

    def test_a_form_gc_rich(self):
        """GG step has high A-form propensity (0.92)."""
        result = compute_form_propensity("GG")
        assert result["per_step"][0]["a_form_propensity"] == 0.92


# ── Groove Profile ──────────────────────────────────────────────────────────


class TestComputeGrooveProfile:
    def test_basic_dimensions(self):
        result = compute_groove_profile("ACGT")
        assert len(result["per_step"]) == 3
        for step in result["per_step"]:
            assert "major_groove_width" in step
            assert "minor_groove_width" in step

    def test_at_minor_groove_narrow(self):
        """AT step has narrower minor groove (4.8 Å) than average."""
        result = compute_groove_profile("AT")
        assert result["per_step"][0]["minor_groove_width"] == 4.8

    def test_summary_means(self):
        result = compute_groove_profile("ACGT")
        s = result["summary"]
        assert "mean_major_groove_width" in s
        assert "mean_minor_groove_width" in s
        assert s["mean_major_groove_width"] > 10.0  # B-DNA major groove ~11 Å


# ── Compute All ─────────────────────────────────────────────────────────────


class TestComputeAll:
    def test_returns_all_properties(self):
        result = compute_all("ACGTACGT")
        assert "thermodynamics" in result
        assert "extinction" in result
        assert "form_propensity" in result
        assert "groove" in result

    def test_salt_passthrough(self):
        result = compute_all("ACGT", salt_mm=150.0)
        assert result["thermodynamics"]["summary"]["salt_mm"] == 150.0
