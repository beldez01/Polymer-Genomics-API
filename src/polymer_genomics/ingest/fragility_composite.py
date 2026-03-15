"""Composite fragility score computation.

Combines non-B DNA density, curvature, stacking instability, and breakpoint
proximity into a single fragility score per 1kb window.

F(x) = 0.35*nonb + 0.25*curvature + 0.25*stacking + 0.15*bp_proximity

Each component is normalized to [0,1] using per-chromosome percentile rank.
"""

from __future__ import annotations

import math


# ── Weights ──────────────────────────────────────────────────────────────────

WEIGHTS = {
    "nonb": 0.35,
    "curvature": 0.25,
    "stacking": 0.25,
    "bp_prox": 0.15,
}

# Breakpoint proximity decay: half-life at 500kb
BP_DECAY_HALFLIFE = 500_000  # bp


def normalize_component(values: list[float]) -> list[float]:
    """Normalize values to [0, 1] using min-max scaling.

    Returns list of same length with values in [0, 1].
    Handles edge case where all values are identical (returns all 0.0).
    """
    if not values:
        return []
    vmin = min(values)
    vmax = max(values)
    span = vmax - vmin
    if span == 0:
        return [0.0] * len(values)
    return [(v - vmin) / span for v in values]


def compute_breakpoint_proximity(
    start: int,
    end: int,
    breakpoints: list[tuple[int, int]],
) -> float:
    """Compute proximity score to nearest breakpoint.

    Uses exponential decay: score = exp(-d * ln(2) / half_life)
    where d = distance to nearest breakpoint edge.

    Returns value in [0, 1] where 1 = at breakpoint, 0 = far away.
    """
    if not breakpoints:
        return 0.0

    mid = (start + end) // 2
    min_dist = float("inf")

    for bp_start, bp_end in breakpoints:
        if bp_start <= mid <= bp_end:
            return 1.0  # inside breakpoint
        dist = min(abs(mid - bp_start), abs(mid - bp_end))
        min_dist = min(min_dist, dist)

    decay = math.log(2) / BP_DECAY_HALFLIFE
    return math.exp(-decay * min_dist)


def compute_fragility_score(
    nonb: float,
    curvature: float,
    stacking: float,
    bp_prox: float,
) -> float:
    """Weighted composite fragility score. All inputs should be [0,1]."""
    return (
        WEIGHTS["nonb"] * nonb
        + WEIGHTS["curvature"] * curvature
        + WEIGHTS["stacking"] * stacking
        + WEIGHTS["bp_prox"] * bp_prox
    )


def classify_fragility(score: float) -> str:
    """Classify fragility score into qualitative category."""
    if score >= 0.8:
        return "extreme"
    if score >= 0.6:
        return "high"
    if score >= 0.3:
        return "moderate"
    return "low"
