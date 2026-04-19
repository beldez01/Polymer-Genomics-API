"""evaluate.py — FormalClaim M2 (v0.1).

Walks a FormalClaim's InferenceRule against its pinned statistics and
produces an :class:`EvaluationResult` with a LICENSED / REJECTED / PENDING
verdict, a per-leaf conjunct breakdown, and drift fields reserved for
future materialization mode.

Scope of v0.1
-------------
* **Inference-only evaluation** from ``Statistic.value`` pinned in the
  fixture. Every encoded fixture today (30) has numeric pinned values for
  every stat referenced by its inference rule, so no fixture lands on
  PENDING in practice.
* Full AND / OR / NOT / CMP semantics with three-valued logic
  (true / false / null → PENDING), matching the viewer-side evaluator in
  ``viewer/src/lib/formalClaimsHelpers.ts``.
* ``StatRef.transform`` (abs / neg / log) on both sides of a cmp, and
  cmp.rhs as either a scalar or a :class:`StatRef` (stat-vs-stat).
* CLI: ``python -m polymer_genomics.formal_claims.evaluate`` walks every
  fixture under ``internal/epistemic_os/fixtures/`` and
  ``internal/InSilico/**/claims/``, writing one
  ``<fixture>.evaluation.json`` sibling per claim.

Deferred to v0.2 (materialization mode)
---------------------------------------
When an ``api_client`` is passed, :func:`evaluate` will walk each claim's
Operation DAG against the live Polymer Genomics API, materialize the
statistics, compare to pinned values, and report drift. The dispatch by
``EstimatorSpec.impl`` prefix is sketched in :func:`_materialize` but
raises ``NotImplementedError`` today; the eligible-fixture gate is already
wired so the returned :class:`EvaluationResult` payload has a stable
shape.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

from polymer_genomics.formal_claims.schema import (
    FormalClaim,
    InferenceAnd,
    InferenceCmp,
    InferenceExpression,
    InferenceNot,
    InferenceOr,
    Statistic,
    StatRef,
)

EVALUATOR_VERSION = "0.1.0"

Verdict = Literal["LICENSED", "REJECTED", "PENDING"]

MaterializationStatus = Literal[
    "skipped_pinned_only",
    "skipped_ineligible",
    "partial",
    "complete",
    "error",
]


# ---------------------------------------------------------------------------
# Result payload (pydantic so it serializes identically to FormalClaim)
# ---------------------------------------------------------------------------


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CmpEvaluation(_Model):
    """One leaf-level InferenceCmp evaluation."""

    lhs_stat_id: str
    lhs_transform: str | None
    lhs_value: float | None
    op: str
    rhs_stat_id: str | None
    rhs_transform: str | None
    rhs_value: float | None
    result: bool | None


class StatDrift(_Model):
    """Pinned-vs-materialized comparison for one statistic.

    Populated only in materialization mode; in v0.1 this block is always
    absent.
    """

    stat_id: str
    pinned: float | int | str | None
    computed: float | int | str | None
    abs_diff: float | None
    rel_diff: float | None
    within_tolerance: bool | None


class EvaluationResult(_Model):
    claim_id: str
    schema_version: str
    verdict: Verdict
    conjuncts: list[CmpEvaluation]

    materialized: dict[str, float | int | str] | None = None
    drift: list[StatDrift] | None = None
    materialization_status: MaterializationStatus = "skipped_pinned_only"
    materialization_error: str | None = None

    evaluated_at: str
    api_version: str
    data_version: str
    evaluator_version: str = EVALUATOR_VERSION


# ---------------------------------------------------------------------------
# Inference evaluation
# ---------------------------------------------------------------------------


def _stat_numeric(stat: Statistic | None) -> float | None:
    """Return ``float(value)`` when the stat's value is a real number.

    bool is a subclass of int in Python — explicitly exclude it so a boolean
    stat never slips through as 0.0/1.0.
    """
    if stat is None:
        return None
    v = stat.value
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def _apply_transform(v: float | None, t: str | None) -> float | None:
    if v is None or t is None:
        return v
    if t == "abs":
        return abs(v)
    if t == "neg":
        return -v
    if t == "log":
        if v <= 0:
            return None
        return math.log(v)
    return None


def _resolve_stat_ref(ref: StatRef, stat_map: dict[str, Statistic]) -> float | None:
    return _apply_transform(_stat_numeric(stat_map.get(ref.stat_id)), ref.transform)


def _eval_cmp(lhs: float | None, op: str, rhs: float | None) -> bool | None:
    if lhs is None or rhs is None:
        return None
    if op == "<":
        return lhs < rhs
    if op == "<=":
        return lhs <= rhs
    if op == "=":
        return lhs == rhs
    if op == "!=":
        return lhs != rhs
    if op == ">":
        return lhs > rhs
    if op == ">=":
        return lhs >= rhs
    return None


def _eval_expr(
    expr: InferenceExpression,
    stat_map: dict[str, Statistic],
    conjuncts: list[CmpEvaluation],
) -> bool | None:
    """Walk the inference expression. Appends one CmpEvaluation per leaf.

    Three-valued logic:
      - AND: any False ⇒ False; else any None ⇒ None; else True
      - OR:  any True  ⇒ True;  else any None ⇒ None; else False
      - NOT: None → None; otherwise flips
    """
    if isinstance(expr, InferenceAnd):
        any_null = False
        for term in expr.terms:
            v = _eval_expr(term, stat_map, conjuncts)
            if v is False:
                return False
            if v is None:
                any_null = True
        return None if any_null else True

    if isinstance(expr, InferenceOr):
        any_null = False
        for term in expr.terms:
            v = _eval_expr(term, stat_map, conjuncts)
            if v is True:
                return True
            if v is None:
                any_null = True
        return None if any_null else False

    if isinstance(expr, InferenceNot):
        v = _eval_expr(expr.term, stat_map, conjuncts)
        return None if v is None else not v

    # Leaf
    assert isinstance(expr, InferenceCmp)
    lhs_val = _resolve_stat_ref(expr.lhs, stat_map)

    rhs_stat_id: str | None
    rhs_transform: str | None
    if isinstance(expr.rhs, StatRef):
        rhs_val = _resolve_stat_ref(expr.rhs, stat_map)
        rhs_stat_id = expr.rhs.stat_id
        rhs_transform = expr.rhs.transform
    else:
        rhs_val = float(expr.rhs)
        rhs_stat_id = None
        rhs_transform = None

    result = _eval_cmp(lhs_val, expr.op, rhs_val)
    conjuncts.append(
        CmpEvaluation(
            lhs_stat_id=expr.lhs.stat_id,
            lhs_transform=expr.lhs.transform,
            lhs_value=lhs_val,
            op=expr.op,
            rhs_stat_id=rhs_stat_id,
            rhs_transform=rhs_transform,
            rhs_value=rhs_val,
            result=result,
        )
    )
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def evaluate(claim: FormalClaim, *, api_client: object | None = None) -> EvaluationResult:
    """Evaluate a FormalClaim's InferenceRule.

    Parameters
    ----------
    claim:
        The parsed FormalClaim fixture.
    api_client:
        If provided, materialization mode will be attempted. v0.1 is
        inference-only and ignores the client except to record that
        materialization was requested but is not yet implemented.

    Returns
    -------
    EvaluationResult
        Verdict + per-conjunct breakdown. In materialization mode the
        ``materialized`` and ``drift`` fields carry the live-API outputs.
    """
    stat_map = {s.id: s for s in claim.statistics}
    conjuncts: list[CmpEvaluation] = []
    root = _eval_expr(claim.inference.expression, stat_map, conjuncts)

    materialized: dict[str, float | int | str] | None = None
    drift: list[StatDrift] | None = None
    materialization_status: MaterializationStatus = "skipped_pinned_only"
    materialization_error: str | None = None

    if api_client is not None:
        try:
            result = _materialize(claim, api_client)
            materialized = result["materialized"]
            drift = result["drift"]
            materialization_status = result["status"]
        except NotImplementedError as exc:
            materialization_status = "skipped_ineligible"
            materialization_error = str(exc)
        except Exception as exc:  # pragma: no cover — guard for future impls
            materialization_status = "error"
            materialization_error = f"{type(exc).__name__}: {exc}"

    if root is True:
        verdict: Verdict = "LICENSED"
    elif root is False:
        verdict = "REJECTED"
    else:
        verdict = "PENDING"

    return EvaluationResult(
        claim_id=claim.id,
        schema_version=claim.schema_version,
        verdict=verdict,
        conjuncts=conjuncts,
        materialized=materialized,
        drift=drift,
        materialization_status=materialization_status,
        materialization_error=materialization_error,
        evaluated_at=datetime.now(UTC).isoformat(timespec="seconds"),
        api_version=claim.api_version,
        data_version=claim.data_version,
    )


def _materialize(claim: FormalClaim, api_client: object) -> dict:
    """Placeholder for v0.2 materialization mode.

    Planned dispatch by ``EstimatorSpec.impl`` prefix:
      * ``scipy.stats.*``                  → ``scipy.stats`` adapter
      * ``python::polymer_genomics.stats.*`` → in-process adapter
      * ``R::ranger::ranger``              → R subprocess adapter
      * ``python::sklearn.*``              → sklearn adapter

    Eligibility gate (all must hold for the fixture to materialize):
      * Every premise has ``provenance_state == "fly_postgres"`` *or* the
        caller has staged a reader for ``local_rds`` premises.
      * Every estimator op's ``impl`` is recognized by the dispatch table.
    """
    # pragma: no cover — v0.2
    _ = (claim, api_client)
    raise NotImplementedError(
        "evaluate.py v0.1 is inference-only; materialization is planned for v0.2. "
        "See the module docstring for the dispatch design."
    )


# ---------------------------------------------------------------------------
# CLI — walk every fixture and write the sibling evaluation file
# ---------------------------------------------------------------------------


def _repo_root() -> Path:
    # src/polymer_genomics/formal_claims/evaluate.py → up 3 gets the repo root
    return Path(__file__).resolve().parents[3]


def walk_fixtures(root: Path | None = None) -> list[Path]:
    """Return every FormalClaim fixture on disk.

    Mirrors the loader in ``viewer/src/app/dev/claim/[id]/page.tsx``:
      1. ``internal/epistemic_os/fixtures/*.json`` (legacy)
      2. any ``claims/*.json`` directory under ``internal/InSilico`` — the
         viewer walker recurses until it finds a directory literally named
         ``claims`` at any depth (RC experiments sit under
         ``InSilico/RC/<experiment>/claims/``).
    """
    root = root or _repo_root()

    def _not_evaluation(p: Path) -> bool:
        return not p.name.endswith(".evaluation.json")

    found: list[Path] = []
    legacy = root / "internal" / "epistemic_os" / "fixtures"
    if legacy.is_dir():
        found.extend(sorted(p for p in legacy.glob("*.json") if _not_evaluation(p)))
    insilico = root / "internal" / "InSilico"
    if insilico.is_dir():
        found.extend(
            sorted(p for p in insilico.glob("**/claims/*.json") if _not_evaluation(p))
        )
    return found


def _write_evaluation_sibling(fixture_path: Path, result: EvaluationResult) -> Path:
    out_path = fixture_path.with_name(fixture_path.stem + ".evaluation.json")
    out_path.write_text(result.model_dump_json(indent=2) + "\n")
    return out_path


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    root = Path(argv[0]) if argv else _repo_root()

    fixtures = walk_fixtures(root)
    if not fixtures:
        print("No fixtures found under", root, file=sys.stderr)
        return 1

    counts = {"LICENSED": 0, "REJECTED": 0, "PENDING": 0}
    skipped = 0
    for fixture in fixtures:
        try:
            claim = FormalClaim.model_validate(json.loads(fixture.read_text()))
        except Exception as exc:
            skipped += 1
            print(f"[SKIP] {fixture.relative_to(root)}: {type(exc).__name__}: {str(exc)[:200]}")
            continue
        result = evaluate(claim)
        _write_evaluation_sibling(fixture, result)
        counts[result.verdict] += 1
        print(f"{result.verdict:9s}  {fixture.relative_to(root)}")

    total = sum(counts.values())
    print(
        f"\n{counts['LICENSED']} LICENSED, {counts['REJECTED']} REJECTED, "
        f"{counts['PENDING']} PENDING across {total} fixtures"
        + (f" ({skipped} skipped)" if skipped else "")
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
