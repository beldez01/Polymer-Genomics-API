"""Unit tests for composite fragility score computation."""

from polymer_genomics.ingest.fragility_composite import (
    normalize_component,
    compute_breakpoint_proximity,
    compute_fragility_score,
    classify_fragility,
)


def test_normalize_component_range():
    values = [0.1, 0.5, 0.9, 0.2, 0.8]
    normed = normalize_component(values)
    assert all(0.0 <= v <= 1.0 for v in normed)
    assert normed[0] == 0.0  # min maps to 0
    assert normed[2] == 1.0  # max maps to 1


def test_normalize_component_identical():
    values = [0.5, 0.5, 0.5]
    normed = normalize_component(values)
    assert normed == [0.0, 0.0, 0.0]


def test_normalize_component_empty():
    assert normalize_component([]) == []


def test_breakpoint_proximity_at_breakpoint():
    bp = [(1000000, 2000000)]
    score = compute_breakpoint_proximity(1500000, 1501000, bp)
    assert score == 1.0  # inside breakpoint


def test_breakpoint_proximity_decays():
    bp = [(1000000, 2000000)]
    near = compute_breakpoint_proximity(999000, 1000000, bp)
    far = compute_breakpoint_proximity(5000000, 5001000, bp)
    assert near > far


def test_breakpoint_proximity_no_breakpoints():
    assert compute_breakpoint_proximity(1000, 2000, []) == 0.0


def test_fragility_score_range():
    score = compute_fragility_score(nonb=0.5, curvature=0.3, stacking=0.7, bp_prox=0.1)
    assert 0.0 <= score <= 1.0


def test_fragility_score_weights_sum():
    # All components at 1.0 should give 1.0
    score = compute_fragility_score(nonb=1.0, curvature=1.0, stacking=1.0, bp_prox=1.0)
    assert abs(score - 1.0) < 1e-6


def test_fragility_score_all_zero():
    score = compute_fragility_score(nonb=0.0, curvature=0.0, stacking=0.0, bp_prox=0.0)
    assert score == 0.0


def test_classify_fragility():
    assert classify_fragility(0.1) == "low"
    assert classify_fragility(0.4) == "moderate"
    assert classify_fragility(0.7) == "high"
    assert classify_fragility(0.9) == "extreme"


def test_classify_fragility_boundaries():
    assert classify_fragility(0.3) == "moderate"
    assert classify_fragility(0.6) == "high"
    assert classify_fragility(0.8) == "extreme"
