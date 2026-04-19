"""Acceptance test for the Formal Claim IR schema (v1.1).

Loads the hand-encoded Exp 17 fixture and validates it through pydantic.
If this test fails, the schema and the fixture have drifted and one of them
must be updated. Fixture is the ground truth for M0; schema is the ground
truth thereafter.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from polymer_genomics.formal_claims import (
    SCHEMA_VERSION,
    CVSplitOp,
    DataDerivedConstant,
    EstimatorOp,
    FormalClaim,
    LayerRef,
)

FIXTURES_DIR = (
    Path(__file__).resolve().parents[1]
    / "internal"
    / "epistemic_os"
    / "fixtures"
)


def _load(name: str) -> dict:
    with open(FIXTURES_DIR / name) as f:
        return json.load(f)


def test_schema_version_constant() -> None:
    assert SCHEMA_VERSION == "v1.1"


def test_exp17_fixture_validates() -> None:
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    assert claim.schema_version == "v1.1"
    assert claim.exp_number == 17
    assert claim.conclusion.outcome == "strong_positive"


def test_exp17_provenance_state_is_local_rds() -> None:
    """v1.1 patch 7: LayerRef.provenance_state must round-trip."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    for premise in claim.premises:
        assert isinstance(premise.source, LayerRef)
        assert premise.source.provenance_state == "local_rds"


def test_exp17_data_derived_threshold_parses() -> None:
    """v1.1 patch 4: the top-quartile threshold is a first-class DataDerivedConstant,
    not an opaque string."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    binarize = next(op for op in claim.operations if op.id == "o_binarize_top_quartile")
    # predicate is a CmpExpr; rhs is a DataDerivedConstant
    rhs = binarize.predicate.rhs  # type: ignore[union-attr]
    assert isinstance(rhs, DataDerivedConstant)
    assert rhs.fn == "quantile"
    assert rhs.col == "co_rate_avg"
    assert rhs.params == {"q": 0.75, "na_rm": True}


def test_exp17_cv_split_is_first_class_operation() -> None:
    """v1.1 patch 5: CV fold construction is its own Operation kind."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    cv_ops = [op for op in claim.operations if isinstance(op, CVSplitOp)]
    assert len(cv_ops) == 1
    assert cv_ops[0].scheme.kind == "k_fold_by_chromosome"
    assert cv_ops[0].scheme.k == 5
    assert cv_ops[0].scheme.seed == 42


def test_exp17_estimators_use_feature_sets() -> None:
    """v1.1 patch 3: estimator features are FeatureSet objects, not strings."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    est_ops = [op for op in claim.operations if isinstance(op, EstimatorOp)]
    assert len(est_ops) == 3
    labels = {op.estimator.features.label for op in est_ops if op.estimator.features}
    assert labels == {
        "gc_only",
        "all_24_biophysics_including_gc",
        "biophysics_minus_gc",
    }
    # M2 should subtract gc_content from M1
    m2 = next(op for op in est_ops if op.id == "o_rf_m2_biophysics_minus_gc")
    assert m2.estimator.features.label == "biophysics_minus_gc"
    assert m2.estimator.features.parent == "all_24_biophysics_including_gc"
    assert m2.estimator.features.exclude == ["gc_content"]


def test_exp17_impl_is_r_not_python() -> None:
    """v1.1 patch 2: impl supports namespace-prefixed R references."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    est_ops = [op for op in claim.operations if isinstance(op, EstimatorOp)]
    for op in est_ops:
        assert op.estimator.impl.startswith("R::")


def test_exp17_categorical_statistic_value() -> None:
    """v1.1 patch 1: Statistic.value accepts strings for categorical outputs."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    top = next(s for s in claim.statistics if s.id == "s_top_feature")
    assert top.value == "quantization_map"
    assert top.evidence_class == "S"


def test_exp17_composite_confidence_block() -> None:
    """v1.1 patch 6: claim-level confidence has its own block."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    cc = claim.conclusion.composite_confidence
    assert cc is not None
    assert cc.procedure == "bootstrap"
    assert cc.impl == "R::boot::boot"
    assert cc.n_resamples == 1000
    # interval and prob_inference_holds are null until evaluate.py fills them
    assert cc.interval is None
    assert cc.prob_inference_holds is None


def test_exp17_inference_rule_structure() -> None:
    """Sanity-check the three-conjunct inference licensing the strong-positive."""
    claim = FormalClaim.model_validate(_load("exp17_formal_claim.json"))
    root = claim.inference.expression
    assert root.kind == "and"  # type: ignore[union-attr]
    assert len(root.terms) == 3  # type: ignore[union-attr]
    # At least one conjunct compares an AUROC to the pre-registered 0.05 threshold
    assert any(
        t.kind == "cmp"  # type: ignore[union-attr]
        and t.lhs.stat_id == "s_delta_auroc_m1_m0"
        and t.rhs == 0.05
        for t in root.terms  # type: ignore[union-attr]
    )


def test_extra_fields_are_rejected() -> None:
    """The base model forbids extras so fixture typos surface loudly."""
    bad = _load("exp17_formal_claim.json")
    bad["unexpected_field"] = "should fail"
    with pytest.raises(Exception):  # pydantic.ValidationError
        FormalClaim.model_validate(bad)
