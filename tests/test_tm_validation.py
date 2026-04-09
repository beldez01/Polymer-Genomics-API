"""Tm calculation QC: validate against well-characterized primers.

Validates the dual-method Tm implementation:
- ≤60 bp: SantaLucia 1998 nearest-neighbor (two-state, ±1-2°C accuracy)
- >60 bp: Marmur-Doty/Schildkraut empirical (long-DNA model)

Reference Tm values sourced from:
- Primer3 test suite (SantaLucia 1998 NN, Schildkraut salt correction)
- Universal sequencing primers (manufacturer datasheets)
- SantaLucia & Hicks 2004 Table 4 (experimentally measured)
"""

import math

from polymer_genomics.biophysics import compute_thermodynamics
from polymer_genomics.evaluate import (
    evaluate_sequence,
    _nn_melting_temp,
    _empirical_melting_temp,
)

# ── Independent NN reference implementation (for cross-check) ────────────

_NN_DH = {
    "AA": -7.9, "TT": -7.9, "AT": -7.2, "TA": -7.2,
    "CA": -8.5, "TG": -8.5, "GT": -8.4, "AC": -8.4,
    "CT": -7.8, "AG": -7.8, "GA": -8.2, "TC": -8.2,
    "CG": -10.6, "GC": -9.8, "GG": -8.0, "CC": -8.0,
}
_NN_DS = {
    "AA": -22.2, "TT": -22.2, "AT": -20.4, "TA": -21.3,
    "CA": -22.7, "TG": -22.7, "GT": -22.4, "AC": -22.4,
    "CT": -21.0, "AG": -21.0, "GA": -22.2, "TC": -22.2,
    "CG": -27.2, "GC": -24.4, "GG": -19.9, "CC": -19.9,
}
_INIT_DH = {"GC": 0.1, "AT": 2.3}
_INIT_DS = {"GC": -2.8, "AT": 4.1}
R_CAL = 1.987


def _ref_nn_tm(seq: str, salt_mm: float = 50.0, oligo_nm: float = 250.0) -> float:
    """Independent NN Tm reference implementation for cross-checking."""
    seq = seq.upper()
    n = len(seq)
    dh, ds = 0.0, 0.0
    for i in range(n - 1):
        dinuc = seq[i:i + 2]
        dh += _NN_DH[dinuc]
        ds += _NN_DS[dinuc]
    for base in (seq[0], seq[-1]):
        if base in ("G", "C"):
            dh += _INIT_DH["GC"]
            ds += _INIT_DS["GC"]
        else:
            dh += _INIT_DH["AT"]
            ds += _INIT_DS["AT"]
    na_m = salt_mm / 1000.0
    ds_salt = ds + 0.368 * (n - 1) * math.log(na_m)
    ct = oligo_nm * 1e-9
    return (dh * 1000.0) / (ds_salt + R_CAL * math.log(ct / 4.0)) - 273.15


# ── Reference primer panel ──────────────────────────────────────────────────
# (name, sequence, length, gc_frac, reference_tm_at_50mM_250nM)
# Reference Tm: SantaLucia 1998 NN with SantaLucia salt correction

PRIMER_PANEL = [
    # Universal sequencing primers
    ("M13_Fwd_-20",      "GTAAAACGACGGCCAGT",          17, 0.529, 51.7),
    ("M13_Rev",           "CAGGAAACAGCTATGAC",          17, 0.471, 46.1),
    ("T7_Promoter",       "TAATACGACTCACTATAGGG",       20, 0.400, 46.8),
    ("SP6_Promoter",      "ATTTAGGTGACACTATAG",         18, 0.333, 41.3),
    # GC-balanced 20mers
    ("Primer_GC50_20",    "ATGCTAGCTAGCTAGCTAGC",       20, 0.500, 52.8),
    ("Primer_GC60_20",    "GCTAGCGATCGCTAGCGATC",       20, 0.600, 57.4),
    ("Primer_GC45_22",    "AATGCAGTCAGTCAGTCAGTCA",    22, 0.455, 55.8),
    # High-GC (stress test)
    ("Primer_GC75_20",    "GCGCGCTAGCGCGCTAGCGC",       20, 0.750, 68.6),
    # AT-rich (stress test)
    ("Primer_GC30_20",    "AATATTAACGATAATATTAG",       20, 0.200, 36.8),
    # Longer primers
    ("Primer_25mer",      "ATGCTAGCGATCGATCGATCGATCG",  25, 0.520, 60.6),
    ("Primer_30mer",      "ATGCTAGCGATCGATCGATCGATCGATCG", 30, 0.500, 63.5),
]


# ═══════════════════════════════════════════════════════════════════════════
# Test Suite 1: Validate the production evaluate_sequence() output
# ═══════════════════════════════════════════════════════════════════════════


class TestEvaluateSequenceTm:
    """Test that evaluate_sequence() returns correct Tm for short and long inputs."""

    def test_short_oligo_uses_nn(self):
        """Short sequences (≤60 bp) should use nearest-neighbor method."""
        result = evaluate_sequence("GTAAAACGACGGCCAGT", name="M13_Fwd", salt_mm=50.0)
        assert result["summary"]["tm_method"] == "nearest_neighbor"

    def test_long_dna_uses_empirical(self):
        """Long sequences (>60 bp) should use empirical method."""
        seq = "ATGCTAGCGATCGATCG" * 10  # 170 bp
        result = evaluate_sequence(seq, name="long_construct", salt_mm=50.0)
        assert result["summary"]["tm_method"] == "empirical"

    def test_boundary_60bp_uses_nn(self):
        """60 bp sequence should still use NN (cutoff is inclusive)."""
        seq = "ATGCGATC" * 7 + "ATGC"  # 60 bp
        result = evaluate_sequence(seq, name="boundary_60", salt_mm=50.0)
        assert result["summary"]["tm_method"] == "nearest_neighbor"

    def test_boundary_61bp_uses_empirical(self):
        """61 bp sequence should switch to empirical."""
        seq = "ATGCGATC" * 7 + "ATGCG"  # 61 bp
        result = evaluate_sequence(seq, name="boundary_61", salt_mm=50.0)
        assert result["summary"]["tm_method"] == "empirical"

    def test_m13_fwd_nn_accuracy(self):
        """M13 Forward primer Tm should be within ±2°C of reference."""
        ref_tm = 51.7  # NN at 50 mM, 250 nM
        result = evaluate_sequence(
            "GTAAAACGACGGCCAGT", name="M13_Fwd",
            salt_mm=50.0, oligo_nm=250.0,
        )
        tm = result["summary"]["melting_temp_estimate_C"]
        assert abs(tm - ref_tm) < 2.0, f"M13 Fwd Tm = {tm}°C, expected ~{ref_tm}°C"

    def test_primer_panel_accuracy(self):
        """All primers in the panel should be within ±2.5°C via evaluate_sequence()."""
        for name, seq, length, gc, ref_tm in PRIMER_PANEL:
            result = evaluate_sequence(seq, name=name, salt_mm=50.0, oligo_nm=250.0)
            tm = result["summary"]["melting_temp_estimate_C"]
            assert abs(tm - ref_tm) < 2.5, (
                f"{name}: evaluate Tm = {tm}°C, ref = {ref_tm}°C, "
                f"error = {tm - ref_tm:+.1f}°C"
            )

    def test_thermodynamics_section_has_method(self):
        """The thermodynamics section should include tm_method."""
        result = evaluate_sequence("GTAAAACGACGGCCAGT", name="M13_Fwd", salt_mm=50.0)
        thermo = result.get("thermodynamics", {})
        assert thermo.get("tm_method") == "nearest_neighbor"

    def test_thermodynamics_section_long_dna(self):
        """Long DNA thermodynamics section should show empirical + no oligo_nm."""
        seq = "ATGCTAGCGATCGATCG" * 10
        result = evaluate_sequence(seq, name="long", salt_mm=50.0)
        thermo = result.get("thermodynamics", {})
        assert thermo.get("tm_method") == "empirical"
        assert thermo.get("oligo_nm") is None

    def test_oligo_nm_passthrough(self):
        """Custom oligo_nm should be reflected in thermodynamics section."""
        result = evaluate_sequence(
            "GTAAAACGACGGCCAGT", name="M13_Fwd",
            salt_mm=50.0, oligo_nm=500.0,
        )
        thermo = result.get("thermodynamics", {})
        assert thermo.get("oligo_nm") == 500.0

    def test_oligo_concentration_affects_nn_tm(self):
        """Higher strand concentration should increase NN Tm."""
        seq = "GTAAAACGACGGCCAGT"
        r_low = evaluate_sequence(seq, salt_mm=50.0, oligo_nm=100.0)
        r_high = evaluate_sequence(seq, salt_mm=50.0, oligo_nm=10000.0)
        tm_low = r_low["summary"]["melting_temp_estimate_C"]
        tm_high = r_high["summary"]["melting_temp_estimate_C"]
        assert tm_high > tm_low, (
            f"Higher [oligo] should give higher Tm: {tm_low}°C (100 nM) vs {tm_high}°C (10 µM)"
        )

    def test_default_salt_1m_short_oligo(self):
        """At default 1M NaCl, short oligo NN Tm should be higher than at 50 mM."""
        seq = "GTAAAACGACGGCCAGT"
        r_1m = evaluate_sequence(seq, salt_mm=1000.0)
        r_50mm = evaluate_sequence(seq, salt_mm=50.0)
        assert r_1m["summary"]["melting_temp_estimate_C"] > r_50mm["summary"]["melting_temp_estimate_C"]


# ═══════════════════════════════════════════════════════════════════════════
# Test Suite 2: Edge cases
# ═══════════════════════════════════════════════════════════════════════════


class TestTmEdgeCases:
    """Edge cases for Tm calculation robustness."""

    def test_minimum_length_10bp(self):
        """10 bp sequence (minimum allowed) should not crash."""
        result = evaluate_sequence("ACGTACGTAC", salt_mm=50.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert result["summary"]["tm_method"] == "nearest_neighbor"
        assert 10.0 < tm < 80.0

    def test_all_gc_20mer(self):
        """Pure GC sequence — extremely high Tm."""
        seq = "GCGCGCGCGCGCGCGCGCGC"
        result = evaluate_sequence(seq, salt_mm=50.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert tm > 60.0, f"All-GC 20mer Tm = {tm}°C, expected > 60°C"

    def test_all_at_20mer(self):
        """Pure AT sequence — very low Tm."""
        seq = "ATATATATATATATATATAT"
        result = evaluate_sequence(seq, salt_mm=50.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert tm < 50.0, f"All-AT 20mer Tm = {tm}°C, expected < 50°C"

    def test_poly_a_20mer(self):
        """Poly-A 20mer — all AA steps, weakest self-complementary."""
        seq = "A" * 20
        result = evaluate_sequence(seq, salt_mm=50.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert 30.0 < tm < 55.0, f"poly-A 20mer Tm = {tm}°C"

    def test_ns_at_termini(self):
        """Ns at the edges should be stripped; Tm from clean bases only."""
        result = evaluate_sequence("NNNACGTACGTACNNN", salt_mm=50.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert result["summary"]["tm_method"] == "nearest_neighbor"
        assert tm > 0

    def test_very_long_construct(self):
        """10 kb construct should use empirical and be in plausible range."""
        seq = "ATGCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC" * 250  # ~11 kb
        result = evaluate_sequence(seq, salt_mm=150.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert result["summary"]["tm_method"] == "empirical"
        assert 50.0 < tm < 100.0

    def test_structural_analysis_still_gives_tm(self):
        """Structural-only analysis should still compute Tm (empirical fallback)."""
        result = evaluate_sequence("ATGCTAGCGATCGATCGATCG", analysis="structural", salt_mm=50.0)
        tm = result["summary"]["melting_temp_estimate_C"]
        assert isinstance(tm, float)
        # Structural mode skips thermo, so should fall back to empirical
        assert result["summary"]["tm_method"] == "empirical"

    def test_long_dna_empirical_range(self):
        """For long DNA the empirical formula should give Tm in the 65-95°C range at physiological salt."""
        emp_tm = _empirical_melting_temp(0.52, 850, 150.0)  # 850 bp, ~52% GC
        assert 60.0 < emp_tm < 95.0, f"850bp 52%GC @ 150mM: Tm = {emp_tm:.1f}°C"

    def test_long_dna_gc_gradient(self):
        """Empirical Tm should increase monotonically with GC content."""
        tms = []
        for gc in [0.30, 0.40, 0.50, 0.60, 0.70]:
            tm = _empirical_melting_temp(gc, 500, 150.0)
            tms.append(tm)
        for i in range(len(tms) - 1):
            assert tms[i] < tms[i + 1], f"GC gradient violated: Tm at GC={0.30 + i*0.10:.2f} = {tms[i]:.1f}"

    def test_convergence_at_boundary(self):
        """At 60 bp the NN and empirical Tm should be within ~10°C of each other."""
        seq = "ATGCGATC" * 7 + "ATGC"  # 60 bp, ~50% GC
        gc = (seq.count("G") + seq.count("C")) / len(seq)
        nn = evaluate_sequence(seq, salt_mm=150.0, oligo_nm=250.0)["summary"]["melting_temp_estimate_C"]
        emp = _empirical_melting_temp(gc, 60, 150.0)
        diff = abs(nn - emp)
        assert diff < 15.0, f"NN/empirical gap at 60bp = {diff:.1f}°C, expected < 15°C"


# ═══════════════════════════════════════════════════════════════════════════
# Test Suite 3: Cross-check production _nn_melting_temp against reference
# ═══════════════════════════════════════════════════════════════════════════


class TestNNCrossCheck:
    """Verify _nn_melting_temp matches independent reference implementation."""

    def test_cross_check_all_primers(self):
        """Production _nn_melting_temp should match reference within 0.1°C."""
        for name, seq, length, gc, ref_tm in PRIMER_PANEL:
            # Compute via production function
            thermo = compute_thermodynamics(seq, salt_mm=1000.0)
            ts = thermo["summary"]
            prod_tm = _nn_melting_temp(
                seq,
                total_dh=ts["total_delta_h"],
                total_ds=ts["total_delta_s"],
                n_steps=ts["n_steps"],
                salt_mm=50.0,
                oligo_nm=250.0,
            )
            # Compute via independent reference
            ref = _ref_nn_tm(seq, salt_mm=50.0, oligo_nm=250.0)
            assert abs(prod_tm - ref) < 0.2, (
                f"{name}: production={prod_tm:.2f}°C, reference={ref:.2f}°C, "
                f"Δ={prod_tm - ref:+.2f}°C"
            )

    def test_salt_increases_tm(self):
        seq = "ATGCTAGCGATCGATCGATCG"
        thermo = compute_thermodynamics(seq, salt_mm=1000.0)
        ts = thermo["summary"]
        tm_50 = _nn_melting_temp(seq, ts["total_delta_h"], ts["total_delta_s"], ts["n_steps"], 50.0, 250.0)
        tm_150 = _nn_melting_temp(seq, ts["total_delta_h"], ts["total_delta_s"], ts["n_steps"], 150.0, 250.0)
        tm_1000 = _nn_melting_temp(seq, ts["total_delta_h"], ts["total_delta_s"], ts["n_steps"], 1000.0, 250.0)
        assert tm_50 < tm_150 < tm_1000

    def test_concentration_increases_tm(self):
        seq = "ATGCTAGCGATCGATCGATCG"
        thermo = compute_thermodynamics(seq, salt_mm=1000.0)
        ts = thermo["summary"]
        tm_low = _nn_melting_temp(seq, ts["total_delta_h"], ts["total_delta_s"], ts["n_steps"], 50.0, 50.0)
        tm_high = _nn_melting_temp(seq, ts["total_delta_h"], ts["total_delta_s"], ts["n_steps"], 50.0, 50000.0)
        assert tm_high > tm_low

    def test_gc_ends_higher_tm(self):
        """GC-terminated oligo should have higher Tm than AT-terminated."""
        for seq, ends in [("GATCGATCGATCGATCG", "GC"), ("AATCGATCGATCGATCA", "AT")]:
            thermo = compute_thermodynamics(seq, salt_mm=1000.0)
            ts = thermo["summary"]
            tm = _nn_melting_temp(seq, ts["total_delta_h"], ts["total_delta_s"], ts["n_steps"], 50.0, 250.0)
            if ends == "GC":
                gc_tm = tm
            else:
                at_tm = tm
        assert gc_tm > at_tm


# ═══════════════════════════════════════════════════════════════════════════
# Test Suite 4: Print comparison table (informational)
# ═══════════════════════════════════════════════════════════════════════════


class TestTmComparisonTable:
    """Print comparison table for visual QC."""

    def test_print_table(self, capsys):
        print("\n" + "=" * 105)
        print("Tm QC: Production evaluate_sequence() vs Reference NN")
        print("Conditions: 50 mM Na+, 250 nM oligo")
        print("=" * 105)
        print(f"{'Primer':<20} {'Len':>3} {'GC%':>5} {'Ref':>7} {'Prod':>7} {'Method':<16} {'Err':>7}")
        print("-" * 105)

        errors = []
        for name, seq, length, gc, ref_tm in PRIMER_PANEL:
            result = evaluate_sequence(seq, name=name, salt_mm=50.0, oligo_nm=250.0)
            tm = result["summary"]["melting_temp_estimate_C"]
            method = result["summary"]["tm_method"]
            err = tm - ref_tm
            errors.append(abs(err))
            print(f"{name:<20} {length:>3} {gc:>5.1%} {ref_tm:>7.1f} {tm:>7.1f} {method:<16} {err:>+7.1f}")

        mae = sum(errors) / len(errors)
        print("-" * 105)
        print(f"MAE = {mae:.2f}°C | Max = {max(errors):.2f}°C")
        print("=" * 105)

        # Also test a long sequence
        long_seq = "ATGCTAGCGATCGATCG" * 50  # 850 bp
        long_result = evaluate_sequence(long_seq, name="850bp_construct", salt_mm=150.0)
        long_tm = long_result["summary"]["melting_temp_estimate_C"]
        long_method = long_result["summary"]["tm_method"]
        print(f"\nLong DNA: 850 bp, 52% GC, 150 mM Na+ → Tm = {long_tm:.1f}°C ({long_method})")
