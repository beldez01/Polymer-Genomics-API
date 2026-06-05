"""Build the height grid + assemble landscape_v2.json for the viewer."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from manifold.surface import build_surface, sample_surface
from manifold.assemble import grid_to_json, empty_deformation

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "manifold"
OUT = ROOT / "landscape-viewer" / "public" / "landscape_v2.json"
GRID_DIM = 160
# Elevation field (1 - pseudotime) is in [0,1]; the -log(density) term has a much
# larger raw swing (~2-5), so it must be down-weighted or it swamps the cascade.
# w_e=3.0 makes the developmental cascade the DOMINANT vertical feature (~0-3),
# w_d=0.2 keeps density as a SECONDARY attractor-well texture (~0.9-1.8 swing).
W_E, W_D = 3.0, 0.12


def _carry_over_edges() -> list:
    """Reuse existing landscape.json edges so the genomic drill-down keeps working."""
    old = ROOT / "landscape-viewer" / "public" / "landscape.json"
    if old.exists():
        return json.loads(old.read_text()).get("edges", [])
    return []


def main() -> int:
    cells = pd.read_parquet(DATA / "cells.parquet")
    nodes = json.loads((DATA / "nodes.json").read_text())

    # Height field = inverse pseudotime (HSC apex high -> terminal low), a monotonic
    # descending cascade across all lineages; fate-entropy separated only some
    # branches on this atlas. Density still carves attractor wells.
    height = 1.0 - cells["pseudotime"].values
    surface = build_surface(
        cells[["x", "y"]].values, height,
        grid_dim=GRID_DIM, w_e=W_E, w_d=W_D,
    )
    for n in nodes:
        n["z"] = sample_surface(surface, n["x"], n["y"])

    landscape = {
        "meta": {
            "generated_from": "GSE194122 + setty2019",
            "elevation": "inverse_palantir_pseudotime",
            "well_term": "neg_log_density",
            "weights": {"w_e": W_E, "w_d": W_D},
            "grid_dim": GRID_DIM,
        },
        "grid": grid_to_json(surface),
        "nodes": nodes,
        "edges": _carry_over_edges(),
        "deformation": empty_deformation(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(landscape))
    print(f"wrote {OUT}  ({len(nodes)} nodes, grid {GRID_DIM}x{GRID_DIM})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
