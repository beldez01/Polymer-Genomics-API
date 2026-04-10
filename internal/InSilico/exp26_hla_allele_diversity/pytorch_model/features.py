"""Per-position biophysical feature computation.

For each dinucleotide step in a DNA sequence, computes 15 biophysical features
using published nearest-neighbor parameters. Vectorized NumPy implementation.

Parameters sourced from:
- SantaLucia 1998 (stacking thermodynamics)
- Olson et al. 1998 (DNA step geometry)
- Karas et al. 2021 / Bansal lab (groove widths, form propensities)
"""
from __future__ import annotations

import numpy as np

# ---------------------------------------------------------------
# Dinucleotide enumeration
# ---------------------------------------------------------------
DINUCLEOTIDES = [a + b for a in "ACGT" for b in "ACGT"]
DINUC_TO_IDX = {d: i for i, d in enumerate(DINUCLEOTIDES)}

# ---------------------------------------------------------------
# Nearest-neighbor stacking thermodynamics (SantaLucia 1998)
# dG37 in kcal/mol, dH in kcal/mol, dS in cal/(mol*K)
# ---------------------------------------------------------------
STACKING_DG37 = {
    "AA": -1.00, "AC": -1.44, "AG": -1.28, "AT": -0.88,
    "CA": -1.45, "CC": -1.84, "CG": -2.17, "CT": -1.28,
    "GA": -1.30, "GC": -2.24, "GG": -1.84, "GT": -1.44,
    "TA": -0.58, "TC": -1.30, "TG": -1.45, "TT": -1.00,
}

STACKING_DH = {
    "AA": -7.9,  "AC": -8.4,  "AG": -7.8,  "AT": -7.2,
    "CA": -8.5,  "CC": -8.0,  "CG": -10.6, "CT": -7.8,
    "GA": -8.2,  "GC": -9.8,  "GG": -8.0,  "GT": -8.4,
    "TA": -7.2,  "TC": -8.2,  "TG": -8.5,  "TT": -7.9,
}

STACKING_DS = {
    "AA": -22.2, "AC": -22.4, "AG": -21.0, "AT": -20.4,
    "CA": -22.7, "CC": -19.9, "CG": -27.2, "CT": -21.0,
    "GA": -22.2, "GC": -24.4, "GG": -19.9, "GT": -22.4,
    "TA": -21.3, "TC": -22.2, "TG": -22.7, "TT": -22.2,
}

# ---------------------------------------------------------------
# DNA step geometry (Olson et al. 1998, Table 2, B-DNA)
# Units: degrees (twist, roll, tilt) and angstroms (shift, slide, rise)
# ---------------------------------------------------------------
TWIST = {
    "AA": 35.1, "AC": 31.5, "AG": 31.9, "AT": 29.3,
    "CA": 37.3, "CC": 32.9, "CG": 36.1, "CT": 31.9,
    "GA": 36.3, "GC": 33.6, "GG": 32.9, "GT": 31.5,
    "TA": 37.8, "TC": 36.3, "TG": 37.3, "TT": 35.1,
}

ROLL = {
    "AA": 0.7,  "AC": 0.7,  "AG": 4.5,  "AT": 0.0,
    "CA": 4.7,  "CC": 3.6,  "CG": 5.4,  "CT": 4.5,
    "GA": 1.9,  "GC": 0.3,  "GG": 3.6,  "GT": 0.7,
    "TA": 3.3,  "TC": 1.9,  "TG": 4.7,  "TT": 0.7,
}

TILT = {
    "AA": -1.4, "AC": -0.1, "AG": -1.7, "AT": 0.0,
    "CA": 0.5,  "CC": 0.0,  "CG": 0.0,  "CT": -1.7,
    "GA": -1.5, "GC": 0.0,  "GG": 0.0,  "GT": -0.1,
    "TA": 0.0,  "TC": -1.5, "TG": 0.5,  "TT": -1.4,
}

SHIFT = {
    "AA": -0.03, "AC": -0.13, "AG": 0.09,  "AT": 0.00,
    "CA": 0.09,  "CC": 0.05,  "CG": 0.00,  "CT": 0.09,
    "GA": -0.28, "GC": 0.00,  "GG": 0.05,  "GT": -0.13,
    "TA": 0.00,  "TC": -0.28, "TG": 0.09,  "TT": -0.03,
}

SLIDE = {
    "AA": -0.08, "AC": -0.58, "AG": -0.25, "AT": -0.59,
    "CA": 0.53,  "CC": -0.22, "CG": 0.41,  "CT": -0.25,
    "GA": 0.09,  "GC": 0.05,  "GG": -0.22, "GT": -0.58,
    "TA": 0.05,  "TC": 0.09,  "TG": 0.53,  "TT": -0.08,
}

RISE = {
    "AA": 3.27, "AC": 3.36, "AG": 3.34, "AT": 3.31,
    "CA": 3.33, "CC": 3.39, "CG": 3.39, "CT": 3.34,
    "GA": 3.38, "GC": 3.40, "GG": 3.39, "GT": 3.36,
    "TA": 3.42, "TC": 3.38, "TG": 3.33, "TT": 3.27,
}

# ---------------------------------------------------------------
# Groove widths (angstroms, B-DNA canonical values from Bansal & Bhattacharyya)
# ---------------------------------------------------------------
MAJOR_GROOVE = {
    "AA": 11.4, "AC": 11.7, "AG": 11.7, "AT": 11.0,
    "CA": 11.9, "CC": 11.9, "CG": 12.1, "CT": 11.7,
    "GA": 11.7, "GC": 11.9, "GG": 11.9, "GT": 11.7,
    "TA": 11.2, "TC": 11.7, "TG": 11.9, "TT": 11.4,
}

MINOR_GROOVE = {
    "AA": 3.7, "AC": 4.3, "AG": 4.3, "AT": 3.2,
    "CA": 4.5, "CC": 4.8, "CG": 4.9, "CT": 4.3,
    "GA": 4.3, "GC": 4.8, "GG": 4.8, "GT": 4.3,
    "TA": 3.9, "TC": 4.3, "TG": 4.5, "TT": 3.7,
}

# ---------------------------------------------------------------
# Form propensities (dimensionless, relative to B-form)
# ---------------------------------------------------------------
A_FORM = {
    "AA": 0.20, "AC": 0.35, "AG": 0.25, "AT": 0.10,
    "CA": 0.25, "CC": 0.45, "CG": 0.50, "CT": 0.25,
    "GA": 0.25, "GC": 0.60, "GG": 0.45, "GT": 0.35,
    "TA": 0.10, "TC": 0.25, "TG": 0.25, "TT": 0.20,
}

# Z-form propensity is high only for alternating purine-pyrimidine,
# especially CpG and GpC dinucleotides
Z_FORM = {
    "AA": 0.00, "AC": 0.10, "AG": 0.00, "AT": 0.05,
    "CA": 0.10, "CC": 0.00, "CG": 0.80, "CT": 0.00,
    "GA": 0.00, "GC": 0.60, "GG": 0.00, "GT": 0.10,
    "TA": 0.05, "TC": 0.00, "TG": 0.10, "TT": 0.00,
}

# ---------------------------------------------------------------
# Build lookup matrix: [16, 15]
# ---------------------------------------------------------------
def _build_lookup_matrix() -> np.ndarray:
    matrix = np.zeros((16, 15), dtype=np.float32)
    for dinuc, idx in DINUC_TO_IDX.items():
        matrix[idx, 0] = STACKING_DG37[dinuc]
        matrix[idx, 1] = STACKING_DH[dinuc]
        matrix[idx, 2] = STACKING_DS[dinuc]
        matrix[idx, 3] = TWIST[dinuc]
        matrix[idx, 4] = ROLL[dinuc]
        matrix[idx, 5] = TILT[dinuc]
        matrix[idx, 6] = SHIFT[dinuc]
        matrix[idx, 7] = SLIDE[dinuc]
        matrix[idx, 8] = RISE[dinuc]
        matrix[idx, 9] = MAJOR_GROOVE[dinuc]
        matrix[idx, 10] = MINOR_GROOVE[dinuc]
        matrix[idx, 11] = A_FORM[dinuc]
        matrix[idx, 12] = Z_FORM[dinuc]
        matrix[idx, 13] = 1.0 if dinuc == "CG" else 0.0
        # purine-pyrimidine alternation (R-Y or Y-R)
        a, b = dinuc[0], dinuc[1]
        is_R = lambda x: x in "AG"
        is_Y = lambda x: x in "CT"
        matrix[idx, 14] = 1.0 if (is_R(a) and is_Y(b)) or (is_Y(a) and is_R(b)) else 0.0
    return matrix


_LOOKUP = _build_lookup_matrix()

# ---------------------------------------------------------------
# Base-to-index mapping
# ---------------------------------------------------------------
_BASE_TO_IDX = {"A": 0, "C": 1, "G": 2, "T": 3}


def compute_per_position(sequence: str) -> np.ndarray:
    """Compute per-dinucleotide-step biophysical features for a DNA sequence.

    Parameters
    ----------
    sequence : str
        DNA sequence (ACGT, case-insensitive). Length L.

    Returns
    -------
    np.ndarray
        Feature tensor of shape [L-1, 15] and dtype float32.

    Raises
    ------
    ValueError
        If the sequence contains characters outside {A, C, G, T}.
    """
    seq_upper = sequence.upper()
    n = len(seq_upper)
    if n < 2:
        return np.zeros((0, 15), dtype=np.float32)

    # Convert bases to indices
    try:
        base_indices = np.fromiter(
            (_BASE_TO_IDX[b] for b in seq_upper),
            dtype=np.int64,
            count=n,
        )
    except KeyError as e:
        raise ValueError(
            f"Sequence contains invalid base: {e}. Expected only A/C/G/T."
        )

    # Build dinucleotide indices: each step i uses base[i] * 4 + base[i+1]
    dinuc_indices = base_indices[:-1] * 4 + base_indices[1:]
    # Lookup features: [L-1, 15]
    return _LOOKUP[dinuc_indices]
