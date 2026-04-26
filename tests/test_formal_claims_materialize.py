"""Tests for the evaluator v0.2 materialization framework.

Covers:
  * Eligibility gate: accepts ``fly_postgres`` / ``canonical_db`` premises,
    rejects others with a readable reason.
  * Dispatch registry: longest-prefix match, ``None`` handlers surface as
    ``unsupported_impl``, unknown prefixes surface as ``no_handler``.
  * Identity handler: copies pinned to computed, drift abs/rel == 0.
  * Status resolution: ``complete`` / ``partial`` / ``skipped_ineligible``.
  * End-to-end via ``evaluate(claim, api_client=...)`` — drift records
    flow through to the :class:`EvaluationResult`.
"""

from __future__ import annotations

import pytest

from polymer_genomics.formal_claims import (
    EVALUATOR_VERSION,
    evaluate,
    FormalClaim,
)
from polymer_genomics.formal_claims.materialize import (
    EligibilityResult,
    MaterializationRun,
    check_eligibility,
    materialize_claim,
    register_handler,
)
from polymer_genomics.formal_claims.schema import (
    CmpExpr,
    Conclusion,
    Confidence,
    EstimatorOp,
    EstimatorSpec,
    FeatureSet,
    InferenceAnd,
    InferenceCmp,
    InferenceRule,
    LayerRef,
    Premise,
    ScopeBlock,
    Statistic,
    StatRef,
)


# ---------------------------------------------------------------------------
# Helpers — build a minimal, valid FormalClaim with whatever we need to test
# ---------------------------------------------------------------------------


def _layer(provenance: str = "fly_postgres") -> LayerRef:
    return LayerRef(layer="unit_test_layer", version="1.0.0", provenance_state=provenance)  # type: ignore[arg-type]


def _minimal_claim(
    *,
    provenance: str = "fly_postgres",
    impls: list[str] | None = None,
    produced_stats: list[Statistic] | None = None,
    inference_conjunct_threshold: float = 0.0,
) -> FormalClaim:
    layer = _layer(provenance)
    premise = Premise(
        id="p0",
        source=layer,
        predicate=CmpExpr(col="chr", op="=", rhs="chr1"),
        content_hash="sha256:unit_test",
    )
    # One dummy estimator op per impl so dispatch routing can be exercised.
    ops: list[EstimatorOp] = []
    stats: list[Statistic] = list(produced_stats or [])
    for i, impl in enumerate(impls or []):
        op_id = f"op_{i}"
        ops.append(
            EstimatorOp(
                id=op_id,
                inputs=["p0"],
                estimator=EstimatorSpec(
                    name=f"est_{i}",
                    impl=impl,
                    version="1.0.0",
                    features=FeatureSet(label="_"),
                ),
            )
        )
        # Each op produces one stat named stat_{i}.
        stats.append(
            Statistic(
                id=f"stat_{i}",
                produced_by=op_id,
                name=f"pinned_{i}",
                value=0.5 + i * 0.1,
                evidence_class="S",
            )
        )

    # Inference: stat_0 >= threshold (if present), else trivially true via 1 > 0.
    if stats:
        inference_expr = InferenceCmp(
            lhs=StatRef(stat_id=stats[0].id),
            op=">=",
            rhs=inference_conjunct_threshold,
        )
    else:
        stats.append(
            Statistic(
                id="const",
                produced_by="_",
                name="const",
                value=1.0,
                evidence_class="S",
            )
        )
        inference_expr = InferenceCmp(
            lhs=StatRef(stat_id="const"), op=">", rhs=0.0
        )

    return FormalClaim(
        id="sha256:unit_test",
        title="unit test claim",
        posted_at="2026-04-22",
        api_version="1.1.0",
        data_version="2026-04-22",
        version="0.0.1",
        premises=[premise],
        operations=ops,
        statistics=stats,
        inference=InferenceRule(
            expression=InferenceAnd(terms=[inference_expr]),
            justification="unit test",
        ),
        conclusion=Conclusion(
            assertion="unit test",
            scope=ScopeBlock(layers=[layer]),
            confidence=Confidence(type="frequentist"),
            outcome="positive",
        ),
    )


# ---------------------------------------------------------------------------
# Eligibility gate
# ---------------------------------------------------------------------------


def test_eligibility_accepts_fly_postgres() -> None:
    claim = _minimal_claim(provenance="fly_postgres")
    gate = check_eligibility(claim)
    assert isinstance(gate, EligibilityResult)
    assert gate.ok is True
    assert gate.reasons == ()


def test_eligibility_accepts_canonical_db() -> None:
    claim = _minimal_claim(provenance="canonical_db")
    assert check_eligibility(claim).ok is True


def test_eligibility_rejects_local_rds_with_readable_reason() -> None:
    claim = _minimal_claim(provenance="local_rds")
    gate = check_eligibility(claim)
    assert gate.ok is False
    assert any("local_rds" in r for r in gate.reasons)


# ---------------------------------------------------------------------------
# Dispatch + identity handler
# ---------------------------------------------------------------------------


def test_identity_handler_materializes_with_zero_drift() -> None:
    claim = _minimal_claim(
        impls=["python::polymer_genomics.stats.identity"],
    )
    run = materialize_claim(claim, api_client=object())
    assert isinstance(run, MaterializationRun)
    assert run.status == "complete"
    # stat_0 was pinned at 0.5 and should be materialized at 0.5.
    assert run.materialized == {"stat_0": 0.5}
    assert len(run.drift) == 1
    d = run.drift[0]
    assert d.stat_id == "stat_0"
    assert d.pinned == 0.5
    assert d.computed == 0.5
    assert d.abs_diff == 0.0
    assert d.within_tolerance is True


def test_unknown_impl_prefix_surfaces_no_handler() -> None:
    claim = _minimal_claim(impls=["java::com.example.fake.Estimator"])
    run = materialize_claim(claim, api_client=object())
    assert run.status == "skipped_ineligible"
    assert run.error is not None
    assert "no registered handler" in run.error
    assert len(run.op_outcomes) == 1
    assert run.op_outcomes[0].status == "no_handler"


def test_recognized_but_unimplemented_prefix_surfaces_unsupported_impl() -> None:
    # R:: is registered (handler=None) — recognized but pending.
    claim = _minimal_claim(impls=["R::ranger::ranger"])
    run = materialize_claim(claim, api_client=object())
    assert run.status == "skipped_ineligible"
    assert run.error is not None
    assert "not yet implemented" in run.error
    assert len(run.op_outcomes) == 1
    assert run.op_outcomes[0].status == "unsupported_impl"


def test_mixed_impls_yield_partial_status() -> None:
    claim = _minimal_claim(
        impls=[
            "python::polymer_genomics.stats.identity",
            "R::ranger::ranger",
        ]
    )
    run = materialize_claim(claim, api_client=object())
    assert run.status == "partial"
    assert "stat_0" in run.materialized  # identity handler succeeded
    assert "stat_1" not in run.materialized  # R:: was unsupported
    outcome_statuses = {o.status for o in run.op_outcomes}
    assert outcome_statuses == {"materialized", "unsupported_impl"}


def test_claim_without_estimator_ops_materializes_trivially() -> None:
    claim = _minimal_claim(impls=[])
    run = materialize_claim(claim, api_client=object())
    assert run.status == "complete"
    assert run.materialized == {}
    assert run.drift == []


def test_longest_prefix_dispatch_prefers_identity_over_generic() -> None:
    """Generic ``python::polymer_genomics.stats.`` is registered as pending,
    but ``python::polymer_genomics.stats.identity`` has a real handler."""
    claim = _minimal_claim(
        impls=["python::polymer_genomics.stats.identity"],
    )
    run = materialize_claim(claim, api_client=object())
    assert run.status == "complete"


def test_handler_exception_resolves_to_error_status() -> None:
    def _explode(op, claim, produced_stat_ids, api_client):
        raise RuntimeError("simulated handler failure")

    register_handler("test::explode.", _explode)
    try:
        claim = _minimal_claim(impls=["test::explode.me"])
        run = materialize_claim(claim, api_client=object())
        assert run.status == "error"
        assert run.error is not None
        assert "simulated handler failure" in run.error
    finally:
        # leave registry tidy
        register_handler("test::explode.", None)


# ---------------------------------------------------------------------------
# End-to-end through ``evaluate()``
# ---------------------------------------------------------------------------


def test_evaluate_reports_materialization_when_api_client_supplied() -> None:
    claim = _minimal_claim(
        impls=["python::polymer_genomics.stats.identity"],
    )
    result = evaluate(claim, api_client=object())
    assert result.materialization_status == "complete"
    assert result.materialized == {"stat_0": 0.5}
    assert result.drift is not None
    assert len(result.drift) == 1
    assert result.drift[0].within_tolerance is True
    # Inference is still computed from pinned values.
    assert result.verdict == "LICENSED"


def test_evaluator_version_is_0_2() -> None:
    assert EVALUATOR_VERSION == "0.2.0"


# ---------------------------------------------------------------------------
# scipy.stats handler (the first "real" handler beyond identity)
# ---------------------------------------------------------------------------


class _MockApiClient:
    """Minimal duck-typed api_client exposing `fetch_columns`."""

    def __init__(self, data: dict[str, dict[str, list[float]]]) -> None:
        self._data = data

    def fetch_columns(self, layer: str, columns):
        cols = self._data.get(layer, {})
        return {c: cols.get(c, []) for c in columns}


def _claim_with_scipy_op(impl: str) -> FormalClaim:
    layer = _layer(provenance="canonical_db")
    premise = Premise(
        id="p0",
        source=LayerRef(layer="layer_X", version="1.0.0", provenance_state="canonical_db"),  # type: ignore[arg-type]
        predicate=CmpExpr(col="chr", op="=", rhs="chr1"),
        content_hash="sha256:unit_test",
    )
    op = EstimatorOp(
        id="corr_op",
        inputs=["p0"],
        estimator=EstimatorSpec(
            name="correlation_vs_phenotype",
            impl=impl,
            version="1.13",
            response="phenotype",
            features=FeatureSet(label="biophysics", resolved=["dG37", "curvature"]),
        ),
    )
    rho_stat = Statistic(
        id="s_mean_abs_rho", produced_by="corr_op", name="mean_abs_rho",
        value=0.42, evidence_class="S",
    )
    pval_stat = Statistic(
        id="s_min_pvalue", produced_by="corr_op", name="min_pvalue",
        value=0.001, evidence_class="S",
    )
    return FormalClaim(
        id="sha256:scipy_test",
        title="scipy handler test",
        posted_at="2026-04-22",
        api_version="1.1.0",
        data_version="2026-04-22",
        version="0.0.1",
        premises=[premise],
        operations=[op],
        statistics=[rho_stat, pval_stat],
        inference=InferenceRule(
            expression=InferenceAnd(terms=[
                InferenceCmp(lhs=StatRef(stat_id="s_mean_abs_rho"), op=">", rhs=0.2),
            ]),
            justification="unit test",
        ),
        conclusion=Conclusion(
            assertion="unit test",
            scope=ScopeBlock(layers=[layer]),
            confidence=Confidence(type="frequentist"),
            outcome="positive",
        ),
    )


def test_scipy_spearmanr_handler_materializes_end_to_end() -> None:
    claim = _claim_with_scipy_op("scipy.stats.spearmanr")
    # Strong monotonic relationship: phenotype ≈ dG37 * 2 + noise; curvature uncorrelated.
    mock_client = _MockApiClient({
        "layer_X": {
            "phenotype": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
            "dG37":      [1.1, 2.0, 3.2, 3.9, 5.1, 6.0, 6.8, 8.1, 9.2, 10.1],
            "curvature": [0.3, 0.9, 0.1, 0.7, 0.4, 0.8, 0.2, 0.6, 0.5, 0.0],
        }
    })
    run = materialize_claim(claim, api_client=mock_client)
    assert run.status == "complete"
    assert "s_mean_abs_rho" in run.materialized
    assert "s_min_pvalue" in run.materialized
    # dG37 ≈ perfect monotonic with phenotype; |rho| averaged with curvature
    # should still be well above 0.
    assert run.materialized["s_mean_abs_rho"] > 0.3
    # drift: pinned 0.42 vs computed, should be close to pinned (averaged).
    rho_drift = next(d for d in run.drift if d.stat_id == "s_mean_abs_rho")
    assert rho_drift.pinned == 0.42
    assert rho_drift.abs_diff is not None


def test_scipy_handler_without_fetch_columns_surfaces_unsupported() -> None:
    claim = _claim_with_scipy_op("scipy.stats.pearsonr")
    # api_client lacking fetch_columns: falls through to HandlerNotImplemented.
    run = materialize_claim(claim, api_client=object())
    assert run.status == "skipped_ineligible"
    assert run.error is not None
    assert "fetch_columns" in run.error


def test_scipy_handler_recognizes_python_prefix_variant() -> None:
    """`python::scipy.stats.*` impl prefix also routes to the scipy handler."""
    claim = _claim_with_scipy_op("python::scipy.stats.pearsonr")
    mock_client = _MockApiClient({
        "layer_X": {
            "phenotype": [1.0, 2.0, 3.0],
            "dG37":      [1.0, 2.0, 3.0],
            "curvature": [1.0, 2.0, 3.0],
        }
    })
    run = materialize_claim(claim, api_client=mock_client)
    assert run.status == "complete"


def test_scipy_handler_errors_cleanly_on_missing_features() -> None:
    """If FeatureSet.resolved isn't populated, surface a clean 'unsupported'."""
    layer = _layer(provenance="canonical_db")
    premise = Premise(
        id="p0",
        source=LayerRef(layer="layer_X", version="1.0.0", provenance_state="canonical_db"),  # type: ignore[arg-type]
        predicate=CmpExpr(col="chr", op="=", rhs="chr1"),
        content_hash="sha256:unit_test",
    )
    op = EstimatorOp(
        id="corr_op",
        inputs=["p0"],
        estimator=EstimatorSpec(
            name="corr",
            impl="scipy.stats.spearmanr",
            version="1.13",
            response="phenotype",
            features=FeatureSet(label="biophysics"),  # `resolved` is None
        ),
    )
    stat = Statistic(id="s0", produced_by="corr_op", name="rho", value=0.0, evidence_class="S")
    claim = FormalClaim(
        id="sha256:unit_test",
        title="missing resolved",
        posted_at="2026-04-22",
        api_version="1.1.0",
        data_version="2026-04-22",
        version="0.0.1",
        premises=[premise],
        operations=[op],
        statistics=[stat],
        inference=InferenceRule(
            expression=InferenceAnd(terms=[
                InferenceCmp(lhs=StatRef(stat_id="s0"), op=">=", rhs=-1.0)
            ]),
            justification="_",
        ),
        conclusion=Conclusion(
            assertion="_",
            scope=ScopeBlock(layers=[layer]),
            confidence=Confidence(type="frequentist"),
            outcome="positive",
        ),
    )
    run = materialize_claim(claim, api_client=_MockApiClient({}))
    assert run.status == "skipped_ineligible"
    assert run.error is not None
    assert "resolved" in run.error
