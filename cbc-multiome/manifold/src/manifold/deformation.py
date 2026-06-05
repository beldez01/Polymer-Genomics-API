"""Inert (P0) deformation algebra: H = H_base + sum_k beta_k * D_k.

In P0 the basis is empty so apply_deformation returns a copy of H_base.
P1 fills `basis` with methylation/TET2 fields and fits `coefficients`.
"""
from __future__ import annotations

import numpy as np


def apply_deformation(H_base, deformation: dict) -> np.ndarray:
    """Return H_base + sum(beta_k * D_k). Empty basis -> a copy of H_base."""
    H = np.array(H_base, dtype=float, copy=True)
    basis = deformation.get("basis", []) or []
    coeffs = deformation.get("coefficients", []) or []
    if len(basis) != len(coeffs):
        raise ValueError(
            f"basis ({len(basis)}) and coefficients ({len(coeffs)}) length mismatch"
        )
    for beta, D in zip(coeffs, basis):
        H = H + float(beta) * np.asarray(D, dtype=float)
    return H
