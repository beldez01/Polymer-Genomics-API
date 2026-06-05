"""Place the 12 bulk nodes onto the manifold by LABEL-TRANSFER -> nodes.json.

Why label-transfer, not expression projection: averaging a cell type's expression
into a pseudobulk vector collapses it toward the manifold's global centroid, so an
expression kNN lands every node at mid-pseudotime (no cascade). Cross-platform noise
(BLUEPRINT bulk RNA vs 10x multiome) compounds this. But both sides carry cell-type
ANNOTATIONS, so we place each bulk node at the CENTROID of its matching manifold
cell type(s): the node sits where its cell type actually lives on the real manifold,
inheriting that region's (x, y), pseudotime-derived elevation, and density. This is
honest data-pinning. The expression projector (src/manifold/projection.py) is kept as
a tested utility / alternative but is not used for P0 placement.

Elevation = 1 - mean pseudotime (HSC apex high -> terminal low; monotonic cascade).
Granulocytes (neutrophil, eosinophil) have no faithful mature manifold region, so they
map to the granulocytic-progenitor tip (G/M prog) and are flagged out_of_manifold with
elevation pushed below gmp.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from manifold.assemble import mark_out_of_manifold

DATA = Path(__file__).resolve().parents[2] / "data" / "manifold"
GRANULOCYTES = {"neutrophil", "eosinophil"}

# Our 12 bulk node ids -> matching manifold cell_type label(s). The multiome's 22
# annotated types lack exact MPP/CMP/CLP/GMP; we use the closest available
# progenitor(s) and flag the approximation in the node's `mapping` field.
NODE_TO_CELLTYPES: dict[str, list[str]] = {
    "hsc": ["HSC"],
    "mpp": ["HSC"],                              # no MPP annotation; HSC is closest
    "cmp": ["MK/E prog", "G/M prog"],            # common myeloid progenitor ≈ avg
    "gmp": ["G/M prog"],
    "clp": ["Lymph prog"],
    "monocyte": ["CD14+ Mono", "CD16+ Mono"],
    "cd4_t": ["CD4+ T naive", "CD4+ T activated"],
    "cd8_t": ["CD8+ T", "CD8+ T naive"],
    "b_cell": ["Naive CD20+ B", "B1 B", "Transitional B"],
    "nk": ["NK"],
    "neutrophil": ["G/M prog"],                  # OOM: no mature granulocyte in atlas
    "eosinophil": ["G/M prog"],                  # OOM
}
# nodes whose mapping is an approximation (no exact annotated counterpart)
APPROX = {"mpp", "cmp", "neutrophil", "eosinophil"}


def main() -> int:
    cells = pd.read_parquet(DATA / "cells.parquet")
    ct = cells["cell_type"].astype(str)

    nodes = []
    for node_id, types in NODE_TO_CELLTYPES.items():
        mask = ct.isin(types).values
        n_cells = int(mask.sum())
        if n_cells == 0:
            raise ValueError(f"node {node_id}: no manifold cells for types {types}")
        sub = cells.loc[mask]
        x, y = float(sub["x"].mean()), float(sub["y"].mean())
        pt = float(sub["pseudotime"].mean())
        dens = float(sub["density"].mean())
        # within-group spread = mean distance to the centroid (lower = tighter mapping)
        spread = float(np.sqrt(((sub[["x", "y"]].values - [x, y]) ** 2).sum(1)).mean())
        nodes.append({
            "id": node_id, "label": node_id.upper().replace("_", " "),
            "x": x, "y": y,
            "elevation": 1.0 - pt,          # inverse pseudotime: HSC high -> terminal low
            "pseudotime": pt, "density": dens,
            "n_cells": n_cells, "spread": spread,
            "mapping": "+".join(types),
            "approx": node_id in APPROX,
        })

    # Granulocytes: pin to gmp's coordinate, push elevation below gmp (more differentiated
    # than the progenitor they map onto), flag out_of_manifold.
    gmp = next((n for n in nodes if n["id"] == "gmp"), None)
    if gmp is not None:
        for n in nodes:
            if n["id"] in GRANULOCYTES:
                n["x"], n["y"] = gmp["x"], gmp["y"]
                n["elevation"] = min(n["elevation"], gmp["elevation"]) - 0.1

    nodes = mark_out_of_manifold(nodes, GRANULOCYTES)
    (DATA / "nodes.json").write_text(json.dumps(nodes, indent=2))
    print(f"placed {len(nodes)} nodes (label-transfer) -> {DATA/'nodes.json'}")
    for n in sorted(nodes, key=lambda d: -d["elevation"]):
        flags = " ".join(f for f, on in [("[OOM]", n["out_of_manifold"]),
                                         ("[approx]", n.get("approx"))] if on)
        print(f"  {n['id']:<11} elev={n['elevation']:.3f} pt={n['pseudotime']:.3f}"
              f" n={n['n_cells']:<6} {n['mapping']:<28} {flags}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
