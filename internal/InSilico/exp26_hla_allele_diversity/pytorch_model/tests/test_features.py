"""Tests for per-position biophysical feature computation."""
import numpy as np
import pytest

from internal.InSilico.exp26_hla_allele_diversity.pytorch_model.features import (
    compute_per_position,
    DINUCLEOTIDES,
    STACKING_DG37,
)


def test_dinucleotide_coverage():
    """All 16 dinucleotides are defined."""
    assert len(DINUCLEOTIDES) == 16
    assert set(DINUCLEOTIDES) == {
        a + b for a in "ACGT" for b in "ACGT"
    }


def test_stacking_dg37_santalucia_values():
    """Stacking dG37 matches SantaLucia 1998 published values.

    Reference: SantaLucia J. (1998). PNAS 95:1460-1465.
    Values are in kcal/mol at 37C, 1M NaCl.
    """
    # Known values from SantaLucia 1998 Table 1
    assert STACKING_DG37["AA"] == pytest.approx(-1.00, abs=0.01)
    assert STACKING_DG37["AT"] == pytest.approx(-0.88, abs=0.01)
    assert STACKING_DG37["GC"] == pytest.approx(-2.24, abs=0.01)
    assert STACKING_DG37["CG"] == pytest.approx(-2.17, abs=0.01)


def test_compute_per_position_shape():
    """Output tensor has shape [L-1, 15] for sequence of length L."""
    seq = "ACGTACGTACGT"  # length 12
    result = compute_per_position(seq)
    assert result.shape == (11, 15)


def test_compute_per_position_cpg_indicator():
    """CpG dinucleotides flagged correctly at position index 13."""
    seq = "ACGTCGACGT"  # length 10, CG at positions 1-2, 4-5, 7-8
    result = compute_per_position(seq)
    # CpG indicator is column 13 (zero-indexed)
    cpg_col = result[:, 13]
    # Dinucleotides: AC, CG, GT, TC, CG, GA, AC, CG, GT
    # CG is at indices 1, 4, 7
    expected = np.zeros(9)
    expected[[1, 4, 7]] = 1.0
    np.testing.assert_array_equal(cpg_col, expected)


def test_compute_per_position_handles_lowercase():
    """Sequence is case-insensitive."""
    upper = compute_per_position("ACGTACGT")
    lower = compute_per_position("acgtacgt")
    np.testing.assert_array_equal(upper, lower)


def test_compute_per_position_rejects_invalid_bases():
    """N, U, and other non-ACGT bases raise ValueError."""
    with pytest.raises(ValueError, match="invalid"):
        compute_per_position("ACGTN")
