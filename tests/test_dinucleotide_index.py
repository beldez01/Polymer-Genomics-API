"""Tests for the dinucleotide index module."""

import numpy as np
import pytest

from polymer_genomics.dinucleotide_index import (
    DINUC_ORDER,
    dinuc_index_to_values,
    sequence_to_dinuc_index,
)


class TestDinucIndex:
    def test_known_sequence(self):
        idx = sequence_to_dinuc_index("ACGT")
        # AC=0*4+1=1, CG=1*4+2=6, GT=2*4+3=11
        assert list(idx) == [1, 6, 11]

    def test_n_handling(self):
        idx = sequence_to_dinuc_index("ANGT")
        assert idx[0] == 255  # AN contains N
        assert idx[1] == 255  # NG contains N
        assert idx[2] == 11   # GT is valid

    def test_roundtrip_dg37(self):
        seq = "GCGCATAT"
        idx = sequence_to_dinuc_index(seq)
        dg_lut = np.array([
            -1.00, -1.44, -1.28, -0.88,  # AA AC AG AT
            -1.45, -1.84, -2.17, -1.28,  # CA CC CG CT
            -1.30, -2.24, -1.84, -1.44,  # GA GC GG GT
            -0.58, -1.30, -1.45, -1.00,  # TA TC TG TT
        ])
        values = dinuc_index_to_values(idx, dg_lut)
        # GC step: idx=2*4+1=9, dg=-2.24
        assert values[0] == pytest.approx(-2.24, abs=0.01)

    def test_dinuc_order(self):
        assert DINUC_ORDER[0] == "AA"
        assert DINUC_ORDER[6] == "CG"
        assert DINUC_ORDER[15] == "TT"
        assert len(DINUC_ORDER) == 16

    def test_all_16_dinucs(self):
        seq = "AACAGATCACCCGCTGAGCGGGTTATCTGTT"
        idx = sequence_to_dinuc_index(seq)
        # Should contain various valid indices, none 255
        assert all(v < 16 for v in idx)

    def test_empty_gives_empty(self):
        idx = sequence_to_dinuc_index("A")
        assert len(idx) == 0

    def test_invalid_values_nan(self):
        idx = np.array([0, 255, 15], dtype=np.uint8)
        lut = np.arange(16, dtype=float)
        values = dinuc_index_to_values(idx, lut)
        assert values[0] == 0.0
        assert np.isnan(values[1])
        assert values[2] == 15.0
