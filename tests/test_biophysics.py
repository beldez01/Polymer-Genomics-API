"""Tests for the biophysics computation module (pure Python, no DB)."""

import pytest

from polymer_genomics.biophysics import (
    compute_all,
    compute_contextual,
    compute_extinction,
    compute_form_propensity,
    compute_groove_profile,
    compute_structural,
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
    def test_cg_z_form_matches_zhunt_value(self):
        """CG has the lowest Z-Hunt AS-AS penalty (0.66 kcal/mol)."""
        result = compute_form_propensity("CG")
        assert result["per_step"][0]["z_form_propensity"] == 0.66

    def test_cg_alternation_includes_gc_penalty(self):
        """Alternating CG includes GC steps, which are strongly Z-unfavorable."""
        result = compute_form_propensity("CGCGCG")
        assert result["summary"]["total_z_penalty"] == 10.38

    def test_aa_z_unfavorable(self):
        """AA has a high Z-Hunt penalty (4.4 kcal/mol)."""
        result = compute_form_propensity("AA")
        assert result["per_step"][0]["z_form_propensity"] == 4.4

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


# ── Structural Parameters ─────────────────────────────────────────────────


class TestComputeStructuralParams:
    def test_cg_twist(self):
        result = compute_structural("ACGT")
        assert result["per_step"][1]["twist"] == pytest.approx(29.8, abs=0.1)

    def test_cg_roll(self):
        result = compute_structural("ACGT")
        assert result["per_step"][1]["roll"] == pytest.approx(3.5, abs=0.1)

    def test_aa_deformability(self):
        result = compute_structural("AAAA")
        assert result["per_step"][0]["deformability"] == 5

    def test_cg_deformability(self):
        result = compute_structural("ACGT")
        assert result["per_step"][1]["deformability"] == 43

    def test_step_count(self):
        result = compute_structural("ACGTACGT")
        assert len(result["per_step"]) == 7
        assert result["summary"]["n_steps"] == 7

    def test_empty_sequence(self):
        result = compute_structural("A")
        assert result["per_step"] == []
        assert result["summary"]["n_steps"] == 0

    def test_summary_means(self):
        result = compute_structural("ACGT")
        assert "mean_twist" in result["summary"]
        assert "mean_deformability" in result["summary"]


# ── Contextual Features ───────────────────────────────────────────────────


class TestComputeContextualFeatures:
    def test_bubble_propensity_weak_region(self):
        # TA steps are weakest (-0.58 kcal/mol), high bubble propensity
        seq = "TATATATATATA"
        result = compute_contextual(seq, window=5)
        steps_with_bp = [s for s in result["per_step"] if "bubble_propensity" in s]
        assert all(s["bubble_propensity"] > 0.5 for s in steps_with_bp)

    def test_bubble_propensity_stable_region(self):
        # GC steps are strongest (-2.24 kcal/mol)
        seq = "GCGCGCGCGCGC"
        result = compute_contextual(seq, window=5)
        steps_with_bp = [s for s in result["per_step"] if "bubble_propensity" in s]
        assert all(s["bubble_propensity"] < 0.2 for s in steps_with_bp)

    def test_context_deviation_anchor(self):
        # G in weak AT context should be an anchor (negative deviation = stronger than context)
        seq = "AAAAAGAAAAA"
        result = compute_contextual(seq, window=5)
        # AG step at position 4 or GA step at position 5 should have negative deviation
        g_adjacent = [s for s in result["per_step"] if s["position"] in (4, 5)]
        assert any(s["context_deviation"] < 0 for s in g_adjacent)

    def test_context_deviation_vulnerability(self):
        # A in strong GC context should be a vulnerability (positive deviation)
        seq = "GGGGGAGGGGG"
        result = compute_contextual(seq, window=5)
        a_adjacent = [s for s in result["per_step"] if s["position"] in (4, 5)]
        assert any(s["context_deviation"] > 0 for s in a_adjacent)

    def test_output_length(self):
        seq = "ACGTACGTACGT"
        result = compute_contextual(seq, window=3)
        assert len(result["per_step"]) == 11
        assert result["summary"]["n_steps"] == 11

    def test_empty_sequence(self):
        result = compute_contextual("A", window=5)
        assert result["per_step"] == []
        assert result["summary"]["n_steps"] == 0

    def test_summary_fields(self):
        result = compute_contextual("ACGTACGT", window=3)
        assert "mean_bubble_propensity" in result["summary"]
        assert "max_bubble_propensity" in result["summary"]
        assert "mean_flexibility" in result["summary"]
        assert "window" in result["summary"]
