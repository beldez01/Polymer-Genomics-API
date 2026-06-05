"""Assembly helpers for landscape_v2.json."""
from __future__ import annotations

from manifold.surface import Surface


def empty_deformation() -> dict:
    """The inert P0 deformation block."""
    return {"basis": [], "coefficients": [], "active": False}


def grid_to_json(s: Surface) -> dict:
    return {
        "nx": s.nx, "ny": s.ny,
        "x0": float(s.x0), "x1": float(s.x1),
        "y0": float(s.y0), "y1": float(s.y1),
        "z": [float(v) for v in s.z.ravel(order="C")],   # row-major z[j,i]
    }


def mark_out_of_manifold(nodes: list[dict], granulocytes: set[str]) -> list[dict]:
    for n in nodes:
        n["out_of_manifold"] = n["id"] in granulocytes
    return nodes
