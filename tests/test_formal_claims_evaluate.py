"""Acceptance tests for the FormalClaim evaluator (M2 v0.1).

Covers:
  * Inference-tree walker (AND/OR/NOT/CMP, three-valued logic)
  * StatRef transforms (abs / neg / log)
  * Stat-vs-stat cmp rhs (the exp17 M2>=M1 conjunct)
  * All encoded fixtures evaluate without landing on PENDING
  * Verdict aligns with fixture ``outcome``:
      positive / strong_positive / qualified_positive → LICENSED
      negative                                        → REJECTED
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from polymer_genomics.formal_claims import (
    FormalClaim,
    evaluate,
    walk_fixtures,
)
from polymer_genomics.formal_claims.evaluate import (
    _apply_transform,
    _eval_cmp,
    _resolve_stat_ref,
    _stat_numeric,
)
from polymer_genomics.formal_claims.schema import (
    InferenceAnd,
    InferenceCmp,
    InferenceNot,
    InferenceOr,
    Statistic,
    StatRef,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
EXP17 = REPO_ROOT / "internal" / "epistemic_os" / "fixtures" / "exp17_formal_claim.json"


# ---------------------------------------------------------------------------
# Unit tests — helpers
# ---------------------------------------------------------------------------


def _stat(stat_id: str, value: float | int | str | bool) -> Statistic:
    return Statistic(
        id=stat_id,
        produced_by="_test_op",
        name=f"stat_{stat_id}",
        value=value,
        evidence_class="S",
    )


def test_stat_numeric_handles_int_float_and_string() -> None:
    """Numeric stats return float; string stats return None; missing stats return None.

    Note: pydantic's StatValue union coerces Python ``True``/``False`` into
    ``1.0``/``0.0`` before :class:`Statistic` is ever instantiated, so the
    bool-exclusion branch of ``_stat_numeric`` is defensive-only and
    unreachable through the normal fixture path.
    """
    assert _stat_numeric(_stat("a", 0.5)) == 0.5
    assert _stat_numeric(_stat("b", 3)) == 3.0
    assert _stat_numeric(_stat("c", "feature_x")) is None
    assert _stat_numeric(None) is None


def test_apply_transform_abs_neg_log() -> None:
    assert _apply_transform(-0.7, "abs") == 0.7
    assert _apply_transform(0.7, "neg") == -0.7
    assert _apply_transform(2.718281828, "log") == pytest.approx(1.0, abs=1e-6)
    assert _apply_transform(None, "abs") is None
    assert _apply_transform(0.5, None) == 0.5
    assert _apply_transform(-1.0, "log") is None  # guarded: log of non-positive


def test_resolve_stat_ref_applies_transform() -> None:
    stat_map = {"rho": _stat("rho", -0.711)}
    val = _resolve_stat_ref(StatRef(stat_id="rho", transform="abs"), stat_map)
    assert val == pytest.approx(0.711)


def test_eval_cmp_six_operators() -> None:
    assert _eval_cmp(1.0, "<", 2.0) is True
    assert _eval_cmp(2.0, "<=", 2.0) is True
    assert _eval_cmp(2.0, "=", 2.0) is True
    assert _eval_cmp(2.0, "!=", 2.0) is False
    assert _eval_cmp(2.0, ">", 1.0) is True
    assert _eval_cmp(1.0, ">=", 1.0) is True
    assert _eval_cmp(None, ">", 1.0) is None
    assert _eval_cmp(1.0, ">", None) is None


# ---------------------------------------------------------------------------
# Unit tests — three-valued logic
# ---------------------------------------------------------------------------


def _cmp(stat_id: str, op: str, rhs: float | StatRef, transform: str | None = None) -> InferenceCmp:
    return InferenceCmp(lhs=StatRef(stat_id=stat_id, transform=transform), op=op, rhs=rhs)


def _build_claim(stats: list[Statistic], root_expr) -> FormalClaim:
    """Minimal hand-built FormalClaim just for inference evaluation tests."""
    from polymer_genomics.formal_claims.schema import (
        CmpExpr,
        Conclusion,
        Confidence,
        InferenceRule,
        LayerRef,
        Premise,
        ProjectOp,
        ScopeBlock,
    )

    layer = LayerRef(layer="_test", version="v0", provenance_state="unknown")
    premise = Premise(
        id="p_test",
        source=layer,
        predicate=CmpExpr(col="x", op="=", rhs=1),
        content_hash="blake3-_",
    )
    op = ProjectOp(id="o_test", inputs=["p_test"], cols=["x"])
    return FormalClaim(
        id="sha256-_",
        title="_test",
        posted_at="2026-01-01",
        api_version="0.x",
        data_version="polymer-db@_",
        version="1.0.0",
        premises=[premise],
        operations=[op],
        statistics=stats,
        inference=InferenceRule(expression=root_expr, justification="_"),
        conclusion=Conclusion(
            assertion="_",
            scope=ScopeBlock(layers=[layer]),
            confidence=Confidence(type="frequentist"),
            outcome="positive",
        ),
    )


def test_and_three_valued_logic() -> None:
    # True AND True ⇒ True
    claim = _build_claim(
        [_stat("a", 1.0), _stat("b", 1.0)],
        InferenceAnd(terms=[_cmp("a", ">", 0.0), _cmp("b", ">", 0.0)]),
    )
    assert evaluate(claim).verdict == "LICENSED"

    # True AND False ⇒ False
    claim = _build_claim(
        [_stat("a", 1.0), _stat("b", 1.0)],
        InferenceAnd(terms=[_cmp("a", ">", 0.0), _cmp("b", ">", 5.0)]),
    )
    assert evaluate(claim).verdict == "REJECTED"

    # True AND (unknown stat) ⇒ PENDING
    claim = _build_claim(
        [_stat("a", 1.0)],
        InferenceAnd(terms=[_cmp("a", ">", 0.0), _cmp("missing", ">", 0.0)]),
    )
    assert evaluate(claim).verdict == "PENDING"

    # False AND (unknown stat) ⇒ REJECTED (short-circuit)
    claim = _build_claim(
        [_stat("a", 1.0)],
        InferenceAnd(terms=[_cmp("a", ">", 5.0), _cmp("missing", ">", 0.0)]),
    )
    assert evaluate(claim).verdict == "REJECTED"


def test_or_three_valued_logic() -> None:
    # True OR (unknown) ⇒ LICENSED (short-circuit)
    claim = _build_claim(
        [_stat("a", 1.0)],
        InferenceOr(terms=[_cmp("a", ">", 0.0), _cmp("missing", ">", 0.0)]),
    )
    assert evaluate(claim).verdict == "LICENSED"

    # False OR (unknown) ⇒ PENDING
    claim = _build_claim(
        [_stat("a", 1.0)],
        InferenceOr(terms=[_cmp("a", ">", 5.0), _cmp("missing", ">", 0.0)]),
    )
    assert evaluate(claim).verdict == "PENDING"


def test_not_negates_and_propagates_null() -> None:
    claim = _build_claim(
        [_stat("a", 1.0)],
        InferenceNot(term=_cmp("a", ">", 0.0)),
    )
    assert evaluate(claim).verdict == "REJECTED"

    claim = _build_claim(
        [_stat("a", 1.0)],
        InferenceNot(term=_cmp("missing", ">", 0.0)),
    )
    assert evaluate(claim).verdict == "PENDING"


def test_abs_transform_in_cmp() -> None:
    # |rho| > 0.6 with rho = -0.711 ⇒ LICENSED
    claim = _build_claim(
        [_stat("rho", -0.711)],
        _cmp("rho", ">", 0.6, transform="abs"),
    )
    result = evaluate(claim)
    assert result.verdict == "LICENSED"
    assert len(result.conjuncts) == 1
    assert result.conjuncts[0].lhs_transform == "abs"
    assert result.conjuncts[0].lhs_value == pytest.approx(0.711)


def test_stat_vs_stat_rhs() -> None:
    # s_auroc_m2 >= s_auroc_m1 with 0.827 >= 0.824 ⇒ LICENSED
    claim = _build_claim(
        [_stat("s_auroc_m2", 0.827), _stat("s_auroc_m1", 0.824)],
        _cmp("s_auroc_m2", ">=", StatRef(stat_id="s_auroc_m1")),
    )
    result = evaluate(claim)
    assert result.verdict == "LICENSED"
    assert result.conjuncts[0].rhs_stat_id == "s_auroc_m1"
    assert result.conjuncts[0].rhs_value == pytest.approx(0.824)


# ---------------------------------------------------------------------------
# Corpus-level tests
# ---------------------------------------------------------------------------


def _load(path: Path) -> FormalClaim:
    return FormalClaim.model_validate(json.loads(path.read_text()))


def test_exp17_canonical_licenses() -> None:
    claim = _load(EXP17)
    result = evaluate(claim)
    assert result.verdict == "LICENSED"
    assert len(result.conjuncts) == 3
    # The load-bearing stat-vs-stat conjunct (s_auroc_m2 >= s_auroc_m1)
    stat_vs_stat = [c for c in result.conjuncts if c.rhs_stat_id is not None]
    assert len(stat_vs_stat) == 1
    assert stat_vs_stat[0].lhs_stat_id == "s_auroc_m2"
    assert stat_vs_stat[0].rhs_stat_id == "s_auroc_m1"
    assert stat_vs_stat[0].result is True


def test_every_encoded_fixture_evaluates_without_pending() -> None:
    fixtures = walk_fixtures(REPO_ROOT)
    assert len(fixtures) >= 30, f"Expected >=30 fixtures, found {len(fixtures)}"

    pending: list[str] = []
    for fixture_path in fixtures:
        claim = _load(fixture_path)
        result = evaluate(claim)
        if result.verdict == "PENDING":
            pending.append(f"{fixture_path.name} (stats referenced but unresolved)")

    assert not pending, "Fixtures landed on PENDING:\n  " + "\n  ".join(pending)


def test_positive_outcomes_all_license() -> None:
    """Every positive / strong_positive / qualified_positive fixture licenses.

    Convention 6 in CLAIMS_ENCODING_CONTINUATION.md: qualified_positive
    fixtures encode the downgraded inference threshold, so the qualified
    claim is what the tree tests and it should license.
    """
    fixtures = walk_fixtures(REPO_ROOT)
    mismatches: list[str] = []
    for fixture_path in fixtures:
        claim = _load(fixture_path)
        if claim.conclusion.outcome not in (
            "positive",
            "strong_positive",
            "qualified_positive",
        ):
            continue
        result = evaluate(claim)
        if result.verdict != "LICENSED":
            mismatches.append(
                f"{fixture_path.name}: outcome={claim.conclusion.outcome} "
                f"but verdict={result.verdict}"
            )

    assert not mismatches, "Positive outcomes that failed to license:\n  " + "\n  ".join(
        mismatches
    )


def test_direct_falsification_fixtures_reject() -> None:
    """``*_FALSIFIED`` fixtures directly test the falsified hypothesis and should REJECT.

    Contrast with ``recomb_neg_isochore_rediscovery_falsified``, a
    meta-supersession where the inference rule licenses "the prior was
    wrong" and the outcome tag marks what is being superseded. Those are
    expected to LICENSE despite ``outcome == "negative"``.
    """
    fixtures = walk_fixtures(REPO_ROOT)
    falsifications = [f for f in fixtures if "FALSIFIED" in f.name]
    assert falsifications, "Expected at least one *_FALSIFIED fixture"

    mismatches: list[str] = []
    for fixture_path in falsifications:
        claim = _load(fixture_path)
        result = evaluate(claim)
        if result.verdict != "REJECTED":
            mismatches.append(
                f"{fixture_path.name}: verdict={result.verdict} (expected REJECTED)"
            )

    assert not mismatches, "Falsification fixtures that did not REJECT:\n  " + "\n  ".join(
        mismatches
    )


def test_negative_outcomes_are_either_reject_or_meta_supersession() -> None:
    """Every ``outcome == negative`` fixture is either directly falsified (REJECT)
    or a meta-supersession of a prior framing (LICENSE). Nothing else."""
    fixtures = walk_fixtures(REPO_ROOT)
    surprises: list[str] = []
    for fixture_path in fixtures:
        claim = _load(fixture_path)
        if claim.conclusion.outcome != "negative":
            continue
        result = evaluate(claim)
        if result.verdict not in ("REJECTED", "LICENSED"):
            surprises.append(
                f"{fixture_path.name}: verdict={result.verdict}"
            )

    assert not surprises, "Negative fixtures with unexpected verdict:\n  " + "\n  ".join(
        surprises
    )


def test_evaluation_result_payload_shape() -> None:
    claim = _load(EXP17)
    result = evaluate(claim)
    dumped = result.model_dump()

    # Stable keys for the viewer-side consumer
    expected_keys = {
        "claim_id",
        "schema_version",
        "verdict",
        "conjuncts",
        "materialized",
        "drift",
        "materialization_status",
        "materialization_error",
        "evaluated_at",
        "api_version",
        "data_version",
        "evaluator_version",
    }
    assert set(dumped.keys()) == expected_keys
    assert dumped["materialization_status"] == "skipped_pinned_only"
    assert dumped["materialized"] is None
    assert dumped["drift"] is None


def test_materialization_mode_marks_not_implemented() -> None:
    """Passing an api_client today records the skip, not a hard failure."""
    claim = _load(EXP17)
    sentinel = object()  # any non-None stand-in
    result = evaluate(claim, api_client=sentinel)
    assert result.materialization_status == "skipped_ineligible"
    assert result.materialization_error is not None
    assert "v0.2" in result.materialization_error
    # inference verdict is still computed from pinned stats
    assert result.verdict == "LICENSED"
