import pytest
from polymer_genomics.variant_physics import compute_variant_deltas, apply_variant


def test_snv_delta_thermodynamics():
    # GC-rich context where C>A disrupts stacking significantly
    ref = "GCGCGCGCGC"  # all GC steps: strong stacking
    alt = "GCGCGAGCGC"  # pos 5: C>A breaks the GC run
    result = compute_variant_deltas(ref, alt, variant_pos=5)
    assert "thermodynamics" in result
    thermo = result["thermodynamics"]
    assert "delta_dg37" in thermo
    assert "delta_tm" in thermo
    assert thermo["delta_dg37"] != 0.0
    assert isinstance(thermo["delta_dg37"], float)


def test_synonymous_variant_zero_delta():
    seq = "ACGTACGTACGACGTACGTAC"
    result = compute_variant_deltas(seq, seq, variant_pos=10)
    assert result["thermodynamics"]["delta_dg37"] == 0.0
    assert result["thermodynamics"]["delta_tm"] == 0.0


def test_structural_deltas_present():
    ref = "ACGTACGTACGACGTACGTAC"
    alt = "ACGTACGTACTACGTACGTAC"
    result = compute_variant_deltas(ref, alt, variant_pos=10)
    struct = result["structural"]
    assert "delta_mean_roll" in struct
    assert "delta_mean_twist" in struct
    assert "delta_mean_rise" in struct


def test_cpg_creation():
    ref = "ACGTACGTACAGGCGTACGTA"
    alt = "ACGTACGTACCGGCGTACGTA"
    result = compute_variant_deltas(ref, alt, variant_pos=10)
    assert result["cpg_impact"]["impact"] == "cpg_created"


def test_cpg_destruction():
    ref = "ACGTACGTACCGACGTACGTA"
    alt = "ACGTACGTACAGACGTACGTA"
    result = compute_variant_deltas(ref, alt, variant_pos=10)
    assert result["cpg_impact"]["impact"] == "cpg_destroyed"


def test_apply_variant_snv():
    ref = "ACGTACGT"
    result = apply_variant(ref, 3, "T", "G")
    assert result == "ACGGACGT"


def test_apply_variant_insertion():
    ref = "ACGTACGT"
    result = apply_variant(ref, 3, "T", "TCC")
    assert result == "ACGTCCACGT"


def test_apply_variant_deletion():
    ref = "ACGTACGT"
    result = apply_variant(ref, 3, "TAC", "T")
    assert result == "ACGTGT"


def test_apply_variant_mismatch_raises():
    ref = "ACGTACGT"
    with pytest.raises(ValueError, match="Reference mismatch"):
        apply_variant(ref, 3, "G", "A")


def test_nucleosome_disruption_score():
    ref = "ACGTACGTACGACGTACGTAC"
    alt = "ACGTACGTACTACGTACGTAC"
    result = compute_variant_deltas(ref, alt, variant_pos=10)
    assert "nucleosome" in result
    assert "disruption_score" in result["nucleosome"]
    assert isinstance(result["nucleosome"]["disruption_score"], float)
    assert "interpretation" in result["nucleosome"]


def test_mechanism_summary():
    ref = "GCGCGCGCGC"
    alt = "GCGCGAGCGC"
    result = compute_variant_deltas(ref, alt, variant_pos=5)
    assert "mechanism" in result
    assert isinstance(result["mechanism"], list)
    assert len(result["mechanism"]) >= 1
    assert all(isinstance(m, str) for m in result["mechanism"])


def test_motif_changes_structure():
    ref = "ACGTACGTACGACGTACGTAC"
    alt = "ACGTACGTACTACGTACGTAC"
    result = compute_variant_deltas(ref, alt, variant_pos=10)
    assert "changes" in result["motifs"]
    assert "n_changes" in result["motifs"]
    assert isinstance(result["motifs"]["changes"], list)
