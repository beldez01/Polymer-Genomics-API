"""Unit tests for melting domain and mutation dG computation."""

from polymer_genomics.ingest.melting_domains import (
    compute_bubble_propensity,
    compute_melting_width,
    compute_cooperativity,
    compute_sbs_ddg,
    compute_all_tracks,
    _nn_dg,
)


# ── NN parameter tests ──────────────────────────────────────────────────────

def test_nn_dg_known_pair():
    """GC should have a known dG value."""
    dg = _nn_dg("GC")
    assert dg < 0  # stacking is stabilizing


def test_nn_dg_complement_pair():
    """Reverse complement should give same parameters."""
    dg_aa = _nn_dg("AA")
    dg_tt = _nn_dg("TT")
    assert abs(dg_aa - dg_tt) < 1e-6


def test_nn_dg_invalid_returns_zero():
    """Non-ACGT bases should return 0."""
    assert _nn_dg("NX") == 0.0


# ── Bubble propensity tests ─────────────────────────────────────────────────

def test_at_rich_sequence_melts_easier():
    """AT-rich regions should have higher bubble propensity at 37C."""
    at_rich = "AATATATAATATATAAT" * 60
    gc_rich = "GCGCGCGCGCGCGCGC" * 60
    assert compute_bubble_propensity(at_rich) > compute_bubble_propensity(gc_rich)


def test_bubble_propensity_range():
    """Bubble propensity should be in [0, 1]."""
    seq = "ACGTACGTACGTACGT" * 60
    bp = compute_bubble_propensity(seq)
    assert 0.0 <= bp <= 1.0


def test_bubble_propensity_short_seq():
    """Should handle very short sequences gracefully."""
    bp = compute_bubble_propensity("A")
    assert bp == 0.0


# ── Melting width tests ──────────────────────────────────────────────────────

def test_gc_rich_has_sharper_transition():
    """GC-rich regions melt cooperatively (narrow width)."""
    at_rich = "AATATATAATATATAAT" * 60
    gc_rich = "GCGCGCGCGCGCGCGC" * 60
    # GC-rich should have a narrower melting transition
    assert compute_melting_width(gc_rich) <= compute_melting_width(at_rich)


def test_melting_width_positive():
    """Melting width should be positive."""
    seq = "ACGTACGTACGTACGT" * 60
    w = compute_melting_width(seq)
    assert w > 0


# ── Cooperativity tests ─────────────────────────────────────────────────────

def test_cooperativity_positive():
    """Cooperativity parameter should always be positive."""
    seq = "ACGTACGTACGTACGT" * 60
    sigma = compute_cooperativity(seq)
    assert sigma > 0


def test_cooperativity_gc_effect():
    """Higher GC should give lower sigma (more cooperative)."""
    at_rich = "AATATATAATATATAAT" * 60
    gc_rich = "GCGCGCGCGCGCGCGC" * 60
    assert compute_cooperativity(gc_rich) < compute_cooperativity(at_rich)


# ── SBS mutation dG tests ───────────────────────────────────────────────────

def test_sbs_ddg_returns_four_channels():
    """Should return dG perturbation for 4 SBS channels."""
    seq = "ACGTACGTACGTACGT" * 60
    result = compute_sbs_ddg(seq)
    assert set(result.keys()) == {"c_to_a", "c_to_g", "c_to_t", "t_to_a"}


def test_sbs_ddg_values_are_nonnegative():
    """Mean |delta-delta-G| should be non-negative."""
    seq = "ACGTACGTACGTACGT" * 60
    result = compute_sbs_ddg(seq)
    for v in result.values():
        assert v >= 0.0


def test_cpg_context_c_to_t_is_larger():
    """CpG-rich sequences should have higher C>T dG perturbation."""
    cpg_rich = "CGCGCGCGCGCGCGCG" * 60
    at_rich = "AATATATAATATATAAT" * 60
    r_cpg = compute_sbs_ddg(cpg_rich)
    r_at = compute_sbs_ddg(at_rich)
    assert r_cpg["c_to_t"] > r_at["c_to_t"]


# ── Integration: compute_all_tracks ──────────────────────────────────────────

def test_compute_all_tracks_keys():
    """Should return all 7 track values."""
    seq = "ACGTACGTACGTACGT" * 60
    result = compute_all_tracks(seq)
    expected_keys = {
        "melting_cooperativity", "bubble_propensity", "melting_width",
        "sbs_c_to_a_ddg", "sbs_c_to_g_ddg", "sbs_c_to_t_ddg", "sbs_t_to_a_ddg",
    }
    assert set(result.keys()) == expected_keys


def test_compute_all_tracks_all_finite():
    """All values should be finite numbers."""
    import math
    seq = "ACGTACGTACGTACGT" * 60
    result = compute_all_tracks(seq)
    for k, v in result.items():
        assert math.isfinite(v), f"{k} = {v} is not finite"
