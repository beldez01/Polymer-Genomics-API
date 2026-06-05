import numpy as np
from manifold.entropy import differentiation_potential


def test_one_hot_has_zero_potential():
    p = np.array([[1.0, 0.0, 0.0]])
    assert np.allclose(differentiation_potential(p), [0.0])


def test_uniform_has_max_potential():
    p = np.array([[0.25, 0.25, 0.25, 0.25]])
    assert np.allclose(differentiation_potential(p), [np.log(4)])


def test_unnormalized_rows_are_normalized():
    p = np.array([[2.0, 2.0]])
    assert np.allclose(differentiation_potential(p), [np.log(2)])


def test_hsc_higher_than_committed():
    hsc = np.array([[0.2, 0.2, 0.2, 0.2, 0.2]])
    committed = np.array([[0.9, 0.04, 0.03, 0.02, 0.01]])
    e = differentiation_potential(np.vstack([hsc, committed]))
    assert e[0] > e[1]
