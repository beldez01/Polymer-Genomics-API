"""Build a height-grid surface from a single-cell cloud.

H(x,y) = w_e * Ebar(x,y) - w_d * log(rho(x,y) + eps)

  Ebar  = smoothed scalar height field (P0 feeds 1 - pseudotime; any per-cell scalar works)
  rho   = smoothed cell density (attractor wells; sparse regions rise)

Implemented with a 2D histogram + Gaussian smoothing (fast, deterministic).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.ndimage import gaussian_filter


@dataclass
class Surface:
    nx: int
    ny: int
    x0: float
    x1: float
    y0: float
    y1: float
    z: np.ndarray  # (ny, nx) row-major: z[j, i] at (xi, yj)


def build_surface(
    cell_xy,
    cell_diff_potential,
    grid_dim: int = 160,
    w_e: float = 1.0,
    w_d: float = 0.5,
    pad_frac: float = 0.08,
    smooth_sigma: float = 1.5,
    eps: float = 1e-3,
) -> Surface:
    xy = np.asarray(cell_xy, dtype=float)
    e = np.asarray(cell_diff_potential, dtype=float)
    x, y = xy[:, 0], xy[:, 1]

    xr = x.max() - x.min() or 1.0
    yr = y.max() - y.min() or 1.0
    x0, x1 = x.min() - pad_frac * xr, x.max() + pad_frac * xr
    y0, y1 = y.min() - pad_frac * yr, y.max() + pad_frac * yr

    xedges = np.linspace(x0, x1, grid_dim + 1)
    yedges = np.linspace(y0, y1, grid_dim + 1)

    counts, _, _ = np.histogram2d(x, y, bins=[xedges, yedges])
    esum, _, _ = np.histogram2d(x, y, bins=[xedges, yedges], weights=e)

    counts_s = gaussian_filter(counts, smooth_sigma)
    esum_s = gaussian_filter(esum, smooth_sigma)

    ebar = np.divide(esum_s, counts_s, out=np.zeros_like(esum_s), where=counts_s > 0)
    rho = counts_s / (counts_s.sum() + eps)
    H = w_e * ebar - w_d * np.log(rho + eps)

    return Surface(
        nx=grid_dim, ny=grid_dim, x0=x0, x1=x1, y0=y0, y1=y1, z=H.T.copy()
    )


def sample_surface(s: Surface, x: float, y: float) -> float:
    """Bilinear sample of the height grid at world (x, y), clamped to bounds."""
    fx = (x - s.x0) / (s.x1 - s.x0) * (s.nx - 1)
    fy = (y - s.y0) / (s.y1 - s.y0) * (s.ny - 1)
    ix = int(np.clip(np.floor(fx), 0, s.nx - 2))
    iy = int(np.clip(np.floor(fy), 0, s.ny - 2))
    tx = float(np.clip(fx - ix, 0.0, 1.0))
    ty = float(np.clip(fy - iy, 0.0, 1.0))
    z = s.z
    z00, z10 = z[iy, ix], z[iy, ix + 1]
    z01, z11 = z[iy + 1, ix], z[iy + 1, ix + 1]
    return float(
        z00 * (1 - tx) * (1 - ty)
        + z10 * tx * (1 - ty)
        + z01 * (1 - tx) * ty
        + z11 * tx * ty
    )
