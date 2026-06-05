"""Project a bulk cell-type gene vector onto a single-cell manifold.

Strategy: align the bulk vector to the manifold's gene order, center + rotate
into PCA space using the manifold's fitted PCA, find the k nearest manifold
cells, and read off distance-weighted means of their coordinates / potentials.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class ManifoldModel:
    genes: list[str]
    mean_: np.ndarray
    components_: np.ndarray
    cell_pcs: np.ndarray
    cell_xy: np.ndarray
    cell_diff_potential: np.ndarray
    cell_pseudotime: np.ndarray
    cell_density: np.ndarray


@dataclass
class NodeProjection:
    x: float
    y: float
    diff_potential: float
    pseudotime: float
    density: float
    confidence: float


def _align(bulk_vec: np.ndarray, bulk_genes: list[str], model_genes: list[str]) -> np.ndarray:
    """Return bulk_vec reordered to model_genes; genes absent in bulk -> 0."""
    lookup = {g: v for g, v in zip(bulk_genes, np.asarray(bulk_vec, dtype=float))}
    return np.array([lookup.get(g, 0.0) for g in model_genes], dtype=float)


def project_node(bulk_vec, bulk_genes, model: ManifoldModel, k: int = 30) -> NodeProjection:
    x_aligned = _align(bulk_vec, list(bulk_genes), model.genes)
    pc = (x_aligned - model.mean_) @ model.components_.T
    d = np.linalg.norm(model.cell_pcs - pc[None, :], axis=1)
    k = min(k, d.shape[0])
    nn = np.argpartition(d, k - 1)[:k]
    dist = d[nn]
    w = 1.0 / (dist + 1e-9)
    w = w / w.sum()
    xy = w @ model.cell_xy[nn]
    return NodeProjection(
        x=float(xy[0]),
        y=float(xy[1]),
        diff_potential=float(w @ model.cell_diff_potential[nn]),
        pseudotime=float(w @ model.cell_pseudotime[nn]),
        density=float(w @ model.cell_density[nn]),
        confidence=float(dist.mean()),
    )
