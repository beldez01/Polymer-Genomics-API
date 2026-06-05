"""Multiome RNA -> raw PCA (for bulk projection) + Harmony/diffusion/Palantir
geometry -> per-cell parquet + fitted-PCA npz.

Outputs (into data/manifold/):
  cells.parquet  columns: x, y, pseudotime, diff_potential, density, cell_type
  pca.npz        genes, mean_, components_ (raw PCA), cell_pcs (raw PCA scores)

API adaptations (palantir 1.4.4, harmonypy 2.0):
  - harmonypy 2.0: ho.Z_corr is already (n_cells, n_pcs); do NOT apply .T.
    sc.external.pp.harmony_integrate applies .T which gives the wrong shape.
    We call harmonypy.run_harmony directly.
  - palantir 1.4.4: terminal state auto-detection via eigenvector ranks fails on
    large (>60k) heterogeneous atlases (cutoff becomes too strict).  We supply
    explicit terminal states: one representative cell per mature lineage, chosen
    as the most extreme point in multiscale diffusion space for that cell type.
  - run_palantir returns PResults; .entropy IS the Shannon entropy of branch_probs
    (already computed inside palantir), so we use pr.entropy directly as
    diff_potential rather than recomputing it via the local entropy module.
  - run_diffusion_maps dict keys: EigenValues, EigenVectors (correct in plan).
  - determine_multiscale_space(dict) -> DataFrame (correct in plan).

Consistency contract:
  cell_pcs in pca.npz = RAW sklearn PCA scores (not Harmony-corrected).
  Harmony is used ONLY to build diffusion/Palantir geometry (x, y, pseudotime).
  bulk projection: (bulk_vec - mean_) @ components_.T  then kNN against cell_pcs.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import scanpy as sc
import harmonypy
import palantir
from sklearn.decomposition import PCA
from scipy.ndimage import gaussian_filter

DATA = Path(__file__).resolve().parents[2] / "data" / "manifold"
N_PCS = 30
N_HVG = 2000
ROOT_MARKERS = ["CD34", "AVP", "CRHBP", "HLF"]

# Terminally differentiated cell types present in this atlas.
# One representative per lineage — selected as most extreme in multiscale diffusion
# space (furthest from cell-type mean), which places them at the boundary of their
# fate compartment.
TERMINAL_TYPES = [
    "CD14+ Mono",
    "CD8+ T",
    "NK",
    "Naive CD20+ B",
    "Normoblast",
    "pDC",
]


def _pick_terminal(ms: pd.DataFrame, adata_obs: pd.DataFrame, cell_type: str) -> str:
    """Return the barcode of the most diffusion-extreme cell for a given cell_type."""
    barcodes = adata_obs.index[adata_obs["cell_type"] == cell_type]
    ct_ms = ms.loc[barcodes]
    deviation = (ct_ms - ct_ms.mean()).abs().sum(axis=1)
    return deviation.idxmax()


def main() -> int:
    print("Loading h5ad...")
    adata = sc.read_h5ad(DATA / "neurips_bmmc_multiome.h5ad")
    print(f"  full shape: {adata.shape}")

    # Keep only GEX features
    adata = adata[:, adata.var["feature_types"] == "GEX"].copy()
    print(f"  GEX-only shape: {adata.shape}")

    # Start from raw counts stored in layers['counts']
    adata.X = adata.layers["counts"].copy()
    sc.pp.normalize_total(adata, target_sum=1e4)
    sc.pp.log1p(adata)

    # Root marker score on FULL gene set (before HVG subset, so markers survive)
    present = [g for g in ROOT_MARKERS if g in adata.var_names]
    if not present:
        raise ValueError(f"No root markers {ROOT_MARKERS} found in var_names")
    print(f"  Root markers found: {present}")
    marker_score = np.asarray(adata[:, present].X.mean(axis=1)).ravel()
    root = adata.obs_names[int(np.argmax(marker_score))]
    print(f"  Root cell: {root}  cell_type: {adata.obs.loc[root, 'cell_type']}")

    # HVG selection
    sc.pp.highly_variable_genes(adata, n_top_genes=N_HVG)
    adata = adata[:, adata.var.highly_variable].copy()
    print(f"  After HVG subset: {adata.shape}")

    genes = list(adata.var_names)
    Xd = (
        adata.X.toarray().astype(np.float32)
        if hasattr(adata.X, "toarray")
        else np.asarray(adata.X, dtype=np.float32)
    )

    # Raw PCA — the CONTRACT space for bulk projection
    print(f"Fitting raw PCA ({N_PCS} PCs on {N_HVG} HVGs)...")
    pca = PCA(n_components=N_PCS, svd_solver="randomized", random_state=0)
    cell_pcs_raw = pca.fit_transform(Xd)   # shape: (n_cells, N_PCS)
    components_ = pca.components_           # shape: (N_PCS, n_genes)
    mean_ = pca.mean_                       # shape: (n_genes,)

    # Harmony batch-correction for manifold GEOMETRY only.
    # harmonypy 2.0: Z_corr is already (n_cells, n_pcs) — do NOT apply .T.
    # sc.external.pp.harmony_integrate still uses .T internally (bug vs harmonypy 2.0),
    # so we call harmonypy.run_harmony directly.
    print("Running Harmony batch correction (geometry only)...")
    try:
        ho = harmonypy.run_harmony(
            cell_pcs_raw.astype(np.float64), adata.obs, "batch"
        )
        pcs_geometry = ho.Z_corr.astype(np.float32)  # (n_cells, N_PCS) — correct
        print("  Harmony OK")
    except Exception as e:  # noqa: BLE001
        print(f"[warn] Harmony failed, using raw PCA for geometry: {e}")
        pcs_geometry = cell_pcs_raw

    # Diffusion maps on Harmony-corrected PCs
    print("Running diffusion maps...")
    dm = palantir.utils.run_diffusion_maps(
        pd.DataFrame(pcs_geometry, index=adata.obs_names)
    )

    print("Determining multiscale space...")
    ms = palantir.utils.determine_multiscale_space(dm)
    # ms is a DataFrame (n_cells × n_eigs), index = obs_names

    # Terminal states: auto-detection fails on large heterogeneous atlases.
    # Supply one cell per mature lineage (most diffusion-extreme in its cell type).
    terminal_cells = [
        _pick_terminal(ms, adata.obs, ct)
        for ct in TERMINAL_TYPES
        if ct in adata.obs["cell_type"].values
    ]
    print(f"  Terminal state cells selected: {len(terminal_cells)}")
    for ct, bc in zip(TERMINAL_TYPES, terminal_cells):
        print(f"    {ct}: {bc}")

    print(f"Running Palantir (num_waypoints=500, root={root})...")
    pr = palantir.core.run_palantir(
        ms, root, terminal_states=terminal_cells, num_waypoints=500
    )
    # pr.pseudotime: Series indexed by obs_names
    # pr.entropy:    Shannon entropy of branch_probs per cell (= differentiation potential)
    # pr.branch_probs: DataFrame (n_cells × n_terminal_states)

    obs = adata.obs_names
    pt = pr.pseudotime.reindex(obs).values
    diffpot = pr.entropy.reindex(obs).values   # use palantir's own entropy as diff_potential

    # 2D coordinates from the first two multiscale diffusion components
    coords = ms.reindex(obs).values[:, :2]

    # Fast histogram density (avoids O(n^2) KDE on 69k cells)
    H, xe, ye = np.histogram2d(coords[:, 0], coords[:, 1], bins=200)
    Hs = gaussian_filter(H, 2.0)
    ix = np.clip(np.digitize(coords[:, 0], xe) - 1, 0, Hs.shape[0] - 1)
    iy = np.clip(np.digitize(coords[:, 1], ye) - 1, 0, Hs.shape[1] - 1)
    density = Hs[ix, iy]

    cells = pd.DataFrame(
        {
            "x": coords[:, 0],
            "y": coords[:, 1],
            "pseudotime": pt,
            "diff_potential": diffpot,
            "density": density,
            "cell_type": adata.obs["cell_type"].astype(str).values,
        },
        index=obs,
    )
    cells.to_parquet(DATA / "cells.parquet")
    print(f"Wrote cells.parquet: {cells.shape}")

    np.savez(
        DATA / "pca.npz",
        genes=np.array(genes, dtype=object),
        mean_=mean_,
        components_=components_,
        cell_pcs=cell_pcs_raw,
    )
    print("Wrote pca.npz")

    # Sanity output
    print(
        "cells:", cells.shape[0],
        "| diff_potential range:",
        round(float(np.nanmin(diffpot)), 3), "-", round(float(np.nanmax(diffpot)), 3),
    )
    print(
        "root cell:", root,
        "diff_potential:", round(float(cells.loc[root, "diff_potential"]), 3),
        "| cell_type:", cells.loc[root, "cell_type"],
    )
    top = (
        cells.groupby("cell_type")["diff_potential"]
        .mean()
        .sort_values(ascending=False)
    )
    print("top diff_potential cell types:\n", top.head(6).round(3).to_string())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
