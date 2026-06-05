import numpy as np
from manifold.surface import build_surface, sample_surface


def _two_cluster_cloud():
    rng = np.random.default_rng(1)
    stem = rng.normal([-5.0, -5.0], 0.4, size=(400, 2))
    term = rng.normal([5.0, 5.0], 0.4, size=(400, 2))
    xy = np.vstack([stem, term])
    e = np.concatenate([np.full(400, 1.0), np.full(400, 0.0)])
    return xy, e


def test_grid_dims():
    xy, e = _two_cluster_cloud()
    s = build_surface(xy, e, grid_dim=32, w_e=1.0, w_d=0.5)
    assert s.z.shape == (32, 32)
    assert s.nx == 32 and s.ny == 32


def test_stem_region_higher_than_terminal_region():
    xy, e = _two_cluster_cloud()
    s = build_surface(xy, e, grid_dim=64, w_e=1.0, w_d=0.5)
    h_stem = sample_surface(s, -5.0, -5.0)
    h_term = sample_surface(s, 5.0, 5.0)
    assert h_stem > h_term


def test_density_carves_wells_below_sparse_region():
    xy, e = _two_cluster_cloud()
    s = build_surface(xy, np.zeros(xy.shape[0]), grid_dim=64, w_e=0.0, w_d=1.0)
    h_cluster = sample_surface(s, 5.0, 5.0)
    h_gap = sample_surface(s, 0.0, 0.0)
    assert h_cluster < h_gap


def test_sample_surface_bilinear_on_known_grid():
    from manifold.surface import Surface
    z = np.array([[0.0, 2.0], [4.0, 6.0]])
    s = Surface(nx=2, ny=2, x0=0.0, x1=1.0, y0=0.0, y1=1.0, z=z)
    assert np.isclose(sample_surface(s, 0.0, 0.0), 0.0)
    assert np.isclose(sample_surface(s, 1.0, 0.0), 2.0)
    assert np.isclose(sample_surface(s, 0.0, 1.0), 4.0)
    assert np.isclose(sample_surface(s, 0.5, 0.5), 3.0)
