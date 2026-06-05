import numpy as np
from manifold.assemble import grid_to_json, empty_deformation, mark_out_of_manifold

GRANULOCYTES = {"neutrophil", "eosinophil"}


def test_empty_deformation_is_inert():
    d = empty_deformation()
    assert d == {"basis": [], "coefficients": [], "active": False}


def test_grid_to_json_roundtrips_shape():
    from manifold.surface import Surface
    s = Surface(nx=2, ny=2, x0=0.0, x1=1.0, y0=0.0, y1=1.0,
                z=np.array([[0.0, 1.0], [2.0, 3.0]]))
    g = grid_to_json(s)
    assert g["nx"] == 2 and g["ny"] == 2
    assert g["z"] == [0.0, 1.0, 2.0, 3.0]


def test_mark_out_of_manifold_flags_granulocytes():
    nodes = [{"id": "neutrophil"}, {"id": "cd4_t"}]
    out = mark_out_of_manifold(nodes, GRANULOCYTES)
    flags = {n["id"]: n["out_of_manifold"] for n in out}
    assert flags["neutrophil"] is True
    assert flags["cd4_t"] is False
