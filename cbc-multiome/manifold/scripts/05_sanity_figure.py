"""Sanity figure: manifold scatter (colored by cell_type) with the 12 placed nodes
overlaid, plus a printed placement table. Confirms each node sits in its mapped
cell type's region before the terrain is trusted. Placement is label-transfer, so
`spread` (mean distance of mapped cells to their centroid) is the tightness metric.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

DATA = Path(__file__).resolve().parents[2] / "data" / "manifold"
OUT = DATA / "sanity_projection.png"


def main() -> int:
    cells = pd.read_parquet(DATA / "cells.parquet")
    nodes = json.loads((DATA / "nodes.json").read_text())

    fig, ax = plt.subplots(figsize=(10, 9))
    # light scatter of all cells, colored faintly by cell_type via category codes
    codes = cells["cell_type"].astype("category").cat.codes
    ax.scatter(cells["x"], cells["y"], s=2, c=codes, cmap="tab20", alpha=0.35, linewidths=0)
    for n in nodes:
        color = "crimson" if n["out_of_manifold"] else "black"
        ax.scatter([n["x"]], [n["y"]], s=110, c=color, edgecolors="white", zorder=3)
        ax.annotate(f"{n['id']}", (n["x"], n["y"]), fontsize=9, weight="bold", zorder=4,
                    xytext=(4, 4), textcoords="offset points")
    ax.set_title("12 bulk nodes placed on the manifold by label-transfer "
                 "(red = out-of-manifold / granulocyte tip)")
    ax.set_xlabel("multiscale diffusion component 1")
    ax.set_ylabel("multiscale diffusion component 2")
    fig.savefig(OUT, dpi=130, bbox_inches="tight")
    print(f"wrote {OUT}")

    print("\nplacement table (elevation = 1 - pseudotime; spread = mapping tightness):")
    print(f"  {'node':<11} {'elev':>6} {'pt':>6} {'spread':>7} {'n':>7}  mapping")
    for n in sorted(nodes, key=lambda d: -d["elevation"]):
        flags = " ".join(f for f, on in [("[OOM]", n["out_of_manifold"]),
                                         ("[approx]", n.get("approx"))] if on)
        print(f"  {n['id']:<11} {n['elevation']:>6.3f} {n['pseudotime']:>6.3f}"
              f" {n['spread']:>7.3f} {n['n_cells']:>7}  {n['mapping']} {flags}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
