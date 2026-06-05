import numpy as np
from manifold.deformation import apply_deformation


def test_empty_basis_returns_base_unchanged():
    H = np.array([[1.0, 2.0], [3.0, 4.0]])
    out = apply_deformation(H, {"basis": [], "coefficients": [], "active": False})
    assert np.array_equal(out, H)
    assert out is not H


def test_single_basis_adds_scaled_field():
    H = np.zeros((2, 2))
    D = np.array([[1.0, 1.0], [1.0, 1.0]])
    out = apply_deformation(H, {"basis": [D], "coefficients": [2.0], "active": True})
    assert np.allclose(out, np.full((2, 2), 2.0))


def test_two_basis_fields_sum():
    H = np.ones((1, 3))
    D1 = np.array([[1.0, 0.0, 0.0]])
    D2 = np.array([[0.0, 0.0, 5.0]])
    out = apply_deformation(H, {"basis": [D1, D2], "coefficients": [3.0, 1.0]})
    assert np.allclose(out, np.array([[4.0, 1.0, 6.0]]))
