"""Project the 12 bulk RNA nodes onto the manifold -> nodes.json fragment.

The manifold PCA was fit on log1p(normalize_total(counts, 1e4)) expression, so each
bulk node TPM vector is normalized to 1e4 total then log1p'd before projection to
land in the same space. Granulocytes (neutrophil, eosinophil) have no faithful mature
manifold region, so they are pinned to the granulocytic-progenitor tip (gmp's
coordinate) and flagged out_of_manifold with elevation pushed below gmp.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from manifold.projection import ManifoldModel, project_node
from manifold.assemble import mark_out_of_manifold

DATA = Path(__file__).resolve().parents[2] / "data" / "manifold"
GRANULOCYTES = {"neutrophil", "eosinophil"}
K = 30


def _load_model() -> ManifoldModel:
    cells = pd.read_parquet(DATA / "cells.parquet")
    pca = np.load(DATA / "pca.npz", allow_pickle=True)
    return ManifoldModel(
        genes=[str(g) for g in pca["genes"]],
        mean_=pca["mean_"],
        components_=pca["components_"],
        cell_pcs=pca["cell_pcs"],
        cell_xy=cells[["x", "y"]].values,
        cell_diff_potential=cells["diff_potential"].values,
        cell_pseudotime=cells["pseudotime"].values,
        cell_density=cells["density"].values,
    )


def _lognorm(v: np.ndarray) -> np.ndarray:
    """Match the manifold preprocessing: normalize to 1e4 total, then log1p."""
    v = np.asarray(v, dtype=float)
    total = v.sum()
    if total > 0:
        v = v / total * 1e4
    return np.log1p(v)


def main() -> int:
    model = _load_model()
    rna = pd.read_parquet(DATA / "node_rna.parquet")
    genes = rna["gene"].tolist()
    cell_cols = [c for c in rna.columns if c != "gene"]

    nodes = []
    for ct in cell_cols:
        vec = _lognorm(rna[ct].values)
        p = project_node(vec, genes, model, k=K)
        nodes.append({
            "id": ct, "label": ct.upper().replace("_", " "),
            "x": p.x, "y": p.y, "elevation": p.diff_potential,
            "pseudotime": p.pseudotime, "density": p.density,
            "projection_confidence": p.confidence,
        })

    gmp = next((n for n in nodes if n["id"] == "gmp"), None)
    if gmp is not None:
        for n in nodes:
            if n["id"] in GRANULOCYTES:
                n["x"], n["y"] = gmp["x"], gmp["y"]
                n["elevation"] = min(n["elevation"], gmp["elevation"]) - 0.1

    nodes = mark_out_of_manifold(nodes, GRANULOCYTES)
    (DATA / "nodes.json").write_text(json.dumps(nodes, indent=2))
    print(f"projected {len(nodes)} nodes -> {DATA/'nodes.json'}")
    for n in nodes:
        print(f"  {n['id']:<11} elev={n['elevation']:.3f} conf={n['projection_confidence']:.3f}"
              f" {'[OOM]' if n['out_of_manifold'] else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
