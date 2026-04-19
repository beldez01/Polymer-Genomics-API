"""3D PCA projection of FormalClaim feature vectors.

Pipeline: drop zero-variance columns -> StandardScaler -> PCA(n_components=3).
Deterministic given a fixed random_state. Returns a `ProjectionResult` with
3D coords, explained-variance ratios, top-feature loadings per PC, silhouette
scores by topic and outcome, pairwise distance matrix, and a permutation test
of whether `depends_on` edges are tighter in the embedding than chance.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
from scipy.spatial.distance import pdist, squareform
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


@dataclass(frozen=True)
class ProjectionResult:
    """Output of `project`. All numeric arrays are deterministic given inputs."""

    ids: list[str]
    coords_3d: np.ndarray  # (n, 3)
    explained_variance: list[float]  # ratios, len 3
    top_features_per_pc: list[list[tuple[str, float]]]  # 3 PCs x 5 (name, loading)
    silhouette_by_topic: float | None  # None if any class has <2 members
    silhouette_by_outcome: float | None
    pairwise_distances: np.ndarray  # (n, n), Euclidean in 3D
    depends_on_distance_summary: dict
    dropped_zero_variance_features: list[str]


def _silhouette_or_none(coords: np.ndarray, labels: list[str]) -> float | None:
    """Return silhouette_score over samples whose class has >=2 members.

    sklearn raises if any class has only 1 member; we filter out those samples
    and compute silhouette on the rest. The motivating case is the RC topic
    with a single fixture — RC is excluded but the score over the remaining
    4 topics is reported.
    """
    if len(labels) < 2:
        return None
    counts: dict[str, int] = {}
    for v in labels:
        counts[v] = counts.get(v, 0) + 1
    keep = [c >= 2 for c in (counts[v] for v in labels)]
    if sum(keep) < 2:
        return None
    kept_coords = coords[keep]
    kept_labels = [labels[i] for i, k in enumerate(keep) if k]
    if len(set(kept_labels)) < 2:
        return None
    return float(silhouette_score(kept_coords, kept_labels, metric="euclidean"))


def _depends_on_summary(
    ids: list[str],
    coords: np.ndarray,
    pairwise: np.ndarray,
    depends_on: dict[str, list[str]],
    *,
    random_state: int,
    n_perm: int = 1000,
) -> dict:
    """Empirical permutation test: are observed dependency edges shorter than random pairs?"""
    id_to_idx = {cid: i for i, cid in enumerate(ids)}
    edges: list[tuple[int, int]] = []
    for src, targets in depends_on.items():
        if src not in id_to_idx:
            continue
        for tgt in targets:
            if tgt in id_to_idx and id_to_idx[src] != id_to_idx[tgt]:
                edges.append((id_to_idx[src], id_to_idx[tgt]))

    n_edges = len(edges)
    if n_edges == 0:
        return {
            "n_edges": 0,
            "mean_observed": None,
            "mean_null": None,
            "p_value": None,
            "n_perm": n_perm,
        }

    obs = np.array([pairwise[i, j] for i, j in edges])
    mean_observed = float(obs.mean())

    n = len(ids)
    rng = np.random.default_rng(random_state)
    # Sample n_edges random distinct pairs per permutation; compute mean distance.
    null_means = np.empty(n_perm, dtype=np.float64)
    for k in range(n_perm):
        # Random pairs (i != j)
        i_idx = rng.integers(0, n, size=n_edges)
        j_idx = rng.integers(0, n, size=n_edges)
        # Reroll any self-pairs deterministically
        same = i_idx == j_idx
        while same.any():
            j_idx = np.where(same, rng.integers(0, n, size=n_edges), j_idx)
            same = i_idx == j_idx
        null_means[k] = pairwise[i_idx, j_idx].mean()

    mean_null = float(null_means.mean())
    p_value = float((null_means <= mean_observed).sum() / n_perm)
    return {
        "n_edges": n_edges,
        "mean_observed": mean_observed,
        "mean_null": mean_null,
        "p_value": p_value,
        "n_perm": n_perm,
    }


def project(
    ids: list[str],
    X: np.ndarray,
    feature_names: Sequence[str],
    topics: dict[str, str],
    outcomes: dict[str, str],
    depends_on: dict[str, list[str]],
    *,
    random_state: int = 0,
) -> ProjectionResult:
    """Run the deterministic projection pipeline on a feature matrix.

    Parameters
    ----------
    ids
        Claim ids in row order of X.
    X
        Shape (n_samples, n_features); rows align with ids.
    feature_names
        Length n_features; positions align with X columns.
    topics, outcomes
        Per-id metadata, used for silhouette computation only.
    depends_on
        ``{src_id: [target_id, ...]}``; used for the permutation test.
    random_state
        Seeds the RNG for the depends_on permutation null and is passed to
        sklearn PCA. PCA itself is deterministic for full SVD; the seed is
        included for forward-compatibility with randomized solvers.
    """
    if X.ndim != 2:
        raise ValueError(f"X must be 2D, got shape {X.shape!r}")
    if X.shape[0] != len(ids):
        raise ValueError(
            f"len(ids)={len(ids)} does not match X.shape[0]={X.shape[0]}"
        )
    if X.shape[1] != len(feature_names):
        raise ValueError(
            f"len(feature_names)={len(feature_names)} does not match X.shape[1]={X.shape[1]}"
        )

    feature_names = list(feature_names)

    # 1. Drop zero-variance columns (would inflate StandardScaler / produce NaNs).
    col_var = X.var(axis=0)
    keep_mask = col_var > 0
    dropped = [name for name, k in zip(feature_names, keep_mask, strict=True) if not k]
    kept_names = [name for name, k in zip(feature_names, keep_mask, strict=True) if k]
    X_kept = X[:, keep_mask]

    if X_kept.shape[1] < 3:
        raise ValueError(
            f"Need at least 3 non-zero-variance features for 3D PCA; "
            f"got {X_kept.shape[1]} after dropping {len(dropped)} columns."
        )

    # 2. Standardize.
    scaler = StandardScaler(with_mean=True, with_std=True)
    X_scaled = scaler.fit_transform(X_kept)

    # 3. PCA -> 3D.
    pca = PCA(n_components=3, random_state=random_state, svd_solver="full")
    coords = pca.fit_transform(X_scaled)

    # 4. Top features per PC: top-5 by |loading|.
    components = pca.components_  # shape (3, n_kept)
    top_per_pc: list[list[tuple[str, float]]] = []
    for pc_idx in range(3):
        loadings = components[pc_idx]
        order = np.argsort(-np.abs(loadings))
        top5 = [(kept_names[i], float(loadings[i])) for i in order[:5]]
        top_per_pc.append(top5)

    # 5. Pairwise distances.
    pdist_vec = pdist(coords, metric="euclidean")
    pairwise = squareform(pdist_vec)

    # 6. Silhouettes.
    topic_labels = [topics.get(cid, "__unknown__") for cid in ids]
    outcome_labels = [outcomes.get(cid, "__unknown__") for cid in ids]
    sil_topic = _silhouette_or_none(coords, topic_labels)
    sil_outcome = _silhouette_or_none(coords, outcome_labels)

    # 7. depends_on permutation test.
    dep_summary = _depends_on_summary(
        ids, coords, pairwise, depends_on, random_state=random_state
    )

    return ProjectionResult(
        ids=list(ids),
        coords_3d=coords,
        explained_variance=[float(v) for v in pca.explained_variance_ratio_],
        top_features_per_pc=top_per_pc,
        silhouette_by_topic=sil_topic,
        silhouette_by_outcome=sil_outcome,
        pairwise_distances=pairwise,
        depends_on_distance_summary=dep_summary,
        dropped_zero_variance_features=dropped,
    )


__all__ = ["ProjectionResult", "project"]
