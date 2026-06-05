"""Differentiation potential = Shannon entropy of branch-fate probabilities."""
from __future__ import annotations

import numpy as np


def differentiation_potential(fate_probs) -> np.ndarray:
    """Row-wise Shannon entropy (natural log) of fate-probability rows.

    Each row is normalized to sum to 1 first. Returns a 1-D array, one value
    per row: high (HSC, many possible fates) -> low (committed).
    """
    p = np.asarray(fate_probs, dtype=float)
    if p.ndim == 1:
        p = p[None, :]
    row_sums = p.sum(axis=1, keepdims=True)
    p = np.divide(p, row_sums, out=np.zeros_like(p), where=row_sums > 0)
    with np.errstate(divide="ignore", invalid="ignore"):
        terms = np.where(p > 0, -p * np.log(p), 0.0)
    return terms.sum(axis=1)
