"""Structural feature extractor for FormalClaim v1.1 fixtures.

Walks a `FormalClaim` object and produces a fixed-dim numpy vector that summarises
the *shape* of the 5-tuple — not the prose. The vector is the input to the
PCA projection in `projection.py`.

Feature blocks are concatenated in a stable, named order so PCA loadings can be
mapped back to interpretable feature names (see `FEATURE_NAMES`).

Also exports a fixture loader that mirrors the recursive walk in
`viewer/src/app/dev/claim/[id]/page.tsx`.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import get_args

import numpy as np

from polymer_genomics.formal_claims.schema import (
    AggregateOp,
    CompositeConfidence,
    CorrectOp,
    CVSplitOp,
    EstimatorOp,
    EvidenceClass,
    FilterOp,
    FormalClaim,
    InferenceAnd,
    InferenceCmp,
    InferenceExpression,
    InferenceNot,
    InferenceOr,
    JoinOp,
    LayerRef,
    NullModelOp,
    Outcome,
    ProjectOp,
    ProvenanceState,
)

# ---------------------------------------------------------------------------
# Block definitions (kept stable — feature names are derived from these)
# ---------------------------------------------------------------------------

OUTCOMES: tuple[str, ...] = get_args(Outcome)  # 5
TOPICS: tuple[str, ...] = (
    "HLA experiment",
    "TE surveillance",
    "recombination hotspots",
    "dual_channel",
    "RC",
)  # 5

OP_KINDS: tuple[str, ...] = (
    "filter",
    "project",
    "join",
    "aggregate",
    "cv_split",
    "estimator",
    "null_model",
    "correct",
)  # 8

EVIDENCE_CLASSES: tuple[str, ...] = get_args(EvidenceClass)  # 7: M R D S K H L
PROVENANCE_STATES: tuple[str, ...] = get_args(ProvenanceState)  # 5

CV_SCHEMES: tuple[str, ...] = (
    "k_fold_by_chromosome",
    "k_fold_random",
    "leave_one_out",
    "stratified_k_fold",
)  # 4

NULL_MODEL_KINDS: tuple[str, ...] = (
    "label_shuffle",
    "circular_shift",
    "parametric",
    "block_bootstrap",
)  # 4

# ---------------------------------------------------------------------------
# Stable feature name list
# ---------------------------------------------------------------------------


def _build_feature_names() -> list[str]:
    names: list[str] = []
    names += [f"outcome::{o}" for o in OUTCOMES]
    names += [f"topic::{t}" for t in TOPICS]
    names += [f"op_count::{k}" for k in OP_KINDS]
    names += [
        "inference::max_depth",
        "inference::leaf_count",
        "inference::root_conjuncts",
    ]
    names += [f"evidence_class::{c}" for c in EVIDENCE_CLASSES]
    names += [f"provenance_state::{p}" for p in PROVENANCE_STATES]
    names += [
        "count::n_premises_log1p",
        "count::n_operations_log1p",
        "count::n_statistics_log1p",
    ]
    names += [
        "has::null_model",
        "has::correct",
        "has::composite_confidence",
    ]
    names += ["count::depends_on_log1p"]
    names += [f"cv_scheme::{s}" for s in CV_SCHEMES]
    names += [f"null_model::{k}" for k in NULL_MODEL_KINDS]
    return names


FEATURE_NAMES: list[str] = _build_feature_names()
FEATURE_DIM: int = len(FEATURE_NAMES)  # ~46

# ---------------------------------------------------------------------------
# Per-block extractors
# ---------------------------------------------------------------------------


def _one_hot(value: str, vocab: tuple[str, ...]) -> list[float]:
    return [1.0 if value == v else 0.0 for v in vocab]


def _op_kind_counts(claim: FormalClaim) -> list[float]:
    by_kind = Counter(op.kind for op in claim.operations)
    return [float(by_kind.get(k, 0)) for k in OP_KINDS]


def _inference_depth_and_leaves(expr: InferenceExpression) -> tuple[int, int]:
    """Return (max_depth, leaf_count). Leaves are InferenceCmp; depth of a cmp is 1."""
    if isinstance(expr, InferenceCmp):
        return 1, 1
    if isinstance(expr, InferenceNot):
        d, n = _inference_depth_and_leaves(expr.term)
        return d + 1, n
    if isinstance(expr, (InferenceAnd, InferenceOr)):
        if not expr.terms:
            return 1, 0
        child_results = [_inference_depth_and_leaves(t) for t in expr.terms]
        return 1 + max(d for d, _ in child_results), sum(n for _, n in child_results)
    raise TypeError(f"Unknown inference node type: {type(expr)!r}")


def _inference_root_conjuncts(expr: InferenceExpression) -> int:
    if isinstance(expr, InferenceAnd):
        return len(expr.terms)
    return 1


def _inference_block(claim: FormalClaim) -> list[float]:
    expr = claim.inference.expression
    depth, leaves = _inference_depth_and_leaves(expr)
    conjuncts = _inference_root_conjuncts(expr)
    return [float(depth), float(leaves), float(conjuncts)]


def _evidence_class_distribution(claim: FormalClaim) -> list[float]:
    counts = Counter(s.evidence_class for s in claim.statistics)
    total = sum(counts.values())
    if total == 0:
        return [0.0] * len(EVIDENCE_CLASSES)
    return [counts.get(c, 0) / total for c in EVIDENCE_CLASSES]


def _collect_layer_refs(claim: FormalClaim) -> list[LayerRef]:
    refs: list[LayerRef] = [p.source for p in claim.premises]
    refs += list(claim.conclusion.scope.layers)
    return refs


def _provenance_state_distribution(claim: FormalClaim) -> list[float]:
    refs = _collect_layer_refs(claim)
    counts = Counter(r.provenance_state for r in refs)
    total = sum(counts.values())
    if total == 0:
        return [0.0] * len(PROVENANCE_STATES)
    return [counts.get(p, 0) / total for p in PROVENANCE_STATES]


def _count_block(claim: FormalClaim) -> list[float]:
    return [
        math.log1p(len(claim.premises)),
        math.log1p(len(claim.operations)),
        math.log1p(len(claim.statistics)),
    ]


def _has_flags(claim: FormalClaim) -> list[float]:
    has_null_model = any(isinstance(op, NullModelOp) for op in claim.operations)
    has_correct = any(isinstance(op, CorrectOp) for op in claim.operations)
    has_composite_confidence = isinstance(
        claim.conclusion.composite_confidence, CompositeConfidence
    )
    return [
        1.0 if has_null_model else 0.0,
        1.0 if has_correct else 0.0,
        1.0 if has_composite_confidence else 0.0,
    ]


def _cv_scheme_one_hot(claim: FormalClaim) -> list[float]:
    cv_ops = [op for op in claim.operations if isinstance(op, CVSplitOp)]
    if not cv_ops:
        return [0.0] * len(CV_SCHEMES)
    # If multiple cv_split ops, sum the one-hots (rare; preserves info).
    out = [0.0] * len(CV_SCHEMES)
    for op in cv_ops:
        kind = op.scheme.kind
        if kind in CV_SCHEMES:
            out[CV_SCHEMES.index(kind)] += 1.0
    return out


def _null_model_one_hot(claim: FormalClaim) -> list[float]:
    nm_ops = [op for op in claim.operations if isinstance(op, NullModelOp)]
    if not nm_ops:
        return [0.0] * len(NULL_MODEL_KINDS)
    out = [0.0] * len(NULL_MODEL_KINDS)
    for op in nm_ops:
        kind = op.spec.kind
        if kind in NULL_MODEL_KINDS:
            out[NULL_MODEL_KINDS.index(kind)] += 1.0
    return out


# ---------------------------------------------------------------------------
# Public extractor
# ---------------------------------------------------------------------------


def extract_features(claim: FormalClaim, *, topic: str | None = None) -> np.ndarray:
    """Extract a fixed-dim float feature vector from a single FormalClaim.

    Topic is supplied externally (it lives in the file path, not the schema).
    A topic of ``None`` produces a zero vector for the topic block — used only
    for unit tests; the real pipeline always passes a topic via
    ``build_feature_matrix``.
    """
    block_outcome = _one_hot(claim.conclusion.outcome, OUTCOMES)
    block_topic = _one_hot(topic, TOPICS) if topic is not None else [0.0] * len(TOPICS)
    block_op_counts = _op_kind_counts(claim)
    block_inference = _inference_block(claim)
    block_evidence = _evidence_class_distribution(claim)
    block_provenance = _provenance_state_distribution(claim)
    block_counts = _count_block(claim)
    block_flags = _has_flags(claim)
    block_depends_on = [math.log1p(len(claim.depends_on))]
    block_cv = _cv_scheme_one_hot(claim)
    block_null_model = _null_model_one_hot(claim)

    parts = (
        block_outcome
        + block_topic
        + block_op_counts
        + block_inference
        + block_evidence
        + block_provenance
        + block_counts
        + block_flags
        + block_depends_on
        + block_cv
        + block_null_model
    )

    vec = np.asarray(parts, dtype=np.float64)
    if vec.shape[0] != FEATURE_DIM:
        raise RuntimeError(
            f"Feature vector length {vec.shape[0]} != FEATURE_DIM {FEATURE_DIM}"
        )
    if not np.all(np.isfinite(vec)):
        raise RuntimeError(f"Non-finite value in feature vector for {claim.id}")
    return vec


def build_feature_matrix(
    claims: dict[str, FormalClaim],
    topics: dict[str, str],
) -> tuple[list[str], np.ndarray, list[str]]:
    """Build the (ids, X, names) tuple for the projection pipeline.

    ``ids`` is the sorted list of claim basenames (deterministic).
    ``X`` is shape (n_claims, FEATURE_DIM).
    ``names`` is ``FEATURE_NAMES`` (returned for downstream loadings mapping).
    """
    ids = sorted(claims.keys())
    rows = [extract_features(claims[i], topic=topics.get(i)) for i in ids]
    X = np.vstack(rows) if rows else np.empty((0, FEATURE_DIM), dtype=np.float64)
    return ids, X, list(FEATURE_NAMES)


# ---------------------------------------------------------------------------
# Fixture loader (Python mirror of viewer's walkInSilicoClaims)
# ---------------------------------------------------------------------------

# repo_root/src/polymer_genomics/formal_claims/feature_extractor.py
# parents:                  [0] file
#                          [1] formal_claims
#                          [2] polymer_genomics
#                          [3] src
#                          [4] repo_root
INSILICO_ROOT: Path = Path(__file__).resolve().parents[3] / "internal" / "InSilico"


def _walk_claims_dirs(root: Path) -> list[Path]:
    """Recursively collect every `*.json` under any `claims/` subdir below `root`.

    Excludes ``*.evaluation.json`` sibling files written by
    :mod:`polymer_genomics.formal_claims.evaluate` — those are cached
    evaluator outputs, not FormalClaim fixtures.
    """
    out: list[Path] = []
    for sub in root.iterdir():
        if not sub.is_dir():
            continue
        for path in sub.rglob("claims/*.json"):
            if path.is_file() and not path.name.endswith(".evaluation.json"):
                out.append(path)
    return out


def load_all_formal_claims(
    root: Path = INSILICO_ROOT,
) -> tuple[dict[str, FormalClaim], dict[str, str]]:
    """Walk ``root/**/claims/*.json``; return (claims_by_id, topic_by_id).

    ``id`` is the file basename without ``.json``. ``topic`` is the top-level
    folder under ``InSilico/`` containing the claim (e.g. ``"HLA experiment"``).
    """
    claims_by_id: dict[str, FormalClaim] = {}
    topic_by_id: dict[str, str] = {}
    for path in _walk_claims_dirs(root):
        # path = .../InSilico/<topic>/[<...>/]claims/<id>.json
        rel_parts = path.relative_to(root).parts
        topic = rel_parts[0]
        cid = path.stem
        if cid in claims_by_id:
            raise RuntimeError(
                f"Duplicate claim id {cid!r}: {path} vs prior. Filenames must be unique."
            )
        with path.open() as f:
            data = json.load(f)
        claim = FormalClaim.model_validate(data)
        claims_by_id[cid] = claim
        topic_by_id[cid] = topic
    return claims_by_id, topic_by_id


__all__ = [
    "FEATURE_NAMES",
    "FEATURE_DIM",
    "OUTCOMES",
    "TOPICS",
    "OP_KINDS",
    "EVIDENCE_CLASSES",
    "PROVENANCE_STATES",
    "CV_SCHEMES",
    "NULL_MODEL_KINDS",
    "INSILICO_ROOT",
    "extract_features",
    "build_feature_matrix",
    "load_all_formal_claims",
]
