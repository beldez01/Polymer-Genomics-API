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
    large (>60k) heterogeneous atlases (cutoff becomes too strict, returns []).
    We supply explicit terminal states: one per MATURE lineage, anchored by CANONICAL
    MARKER expression (the highest-marker cell of each type sits at the differentiated
    TIP of its cluster — see TERMINAL_MARKERS). Centroid/closest-to-mean terminals left
    mature myeloid diffusely multipotent; marker-tip terminals concentrate the
    absorbing probability. Passed to run_palantir(..., terminal_states=[barcodes]).
    NOTE: downstream P0 uses pr.pseudotime (not pr.entropy) for elevation, because
    fate-entropy on this atlas separates only some branches; pseudotime is monotonic
    across all lineages. cells.parquet still records both.
  - Root cell: the atlas's own GEX_pseudotime_order (per-cell differentiation order
    from the NeurIPS study) covers ONLY the erythroid trajectory
    (HSC -> MK/E -> Proerythroblast -> Erythroblast -> Normoblast); lymphoid/myeloid
    cells are NaN. So we cannot use it to pick the mature terminals (the plan's
    proposed GEX_pseudotime_order.idxmax() yields only 1 terminal, Normoblast).
    But ALL HSC cells DO have it, so we use it to pin the root = the HSC cell with
    the MINIMUM GEX_pseudotime_order (the atlas-defined apex of differentiation),
    which is more defensible than the marker-argmax single cell.
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

# Mature / terminally differentiated endpoints across all hematopoietic branches.
# One absorbing terminal per mature lineage. The terminal is anchored by CANONICAL
# MARKER expression: the cell of each type with the highest marker score sits at the
# differentiated TIP of its cluster, so the diffusion absorbing probability of nearby
# committed cells concentrates on that terminal (low entropy = committed). Centroid /
# closest-to-mean terminals sat in the cluster middle and left mature myeloid cells
# diffusely multipotent (biologically wrong high differentiation potential).
TERMINAL_MARKERS = {
    "CD14+ Mono":       ["CD14", "FCN1", "S100A8", "LYZ"],
    "CD16+ Mono":       ["FCGR3A", "MS4A7", "CDKN1C"],
    "CD8+ T":           ["CD8A", "CD8B", "GZMK", "CD3D"],
    "CD4+ T activated": ["CD4", "IL7R", "CD3D", "IL2RA"],
    "NK":               ["NKG7", "GNLY", "KLRD1", "NCAM1"],
    "ILC":              ["KIT", "IL7R", "RORC"],
    "Naive CD20+ B":    ["MS4A1", "CD79A", "CD79B", "CD19"],
    "Plasma cell":      ["MZB1", "JCHAIN", "XBP1", "SDC1"],
    "Normoblast":       ["HBB", "HBA1", "GYPA", "ALAS2"],
    "pDC":              ["LILRA4", "IL3RA", "CLEC4C", "GZMB"],
    "cDC2":             ["CD1C", "FCER1A", "CLEC10A"],
}


def _pick_terminal_marker(
    marker_expr: pd.DataFrame, obs: pd.DataFrame, cell_type: str, markers: list[str]
) -> str | None:
    """Barcode of the cell of `cell_type` with the highest mean marker expression.

    Markers are scored on the FULL log-normalized gene set (captured before HVG
    subsetting). Restricting to cells annotated as `cell_type` avoids picking a
    high-marker doublet from another compartment. The argmax cell is the
    differentiated tip of the lineage — a strong absorbing terminal.
    """
    present = [m for m in markers if m in marker_expr.columns]
    if not present:
        return None
    barcodes = obs.index[obs["cell_type"].astype(str) == cell_type]
    if len(barcodes) == 0:
        return None
    score = marker_expr.loc[barcodes, present].mean(axis=1)
    return score.idxmax()


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

    # Capture terminal-marker expression on the FULL gene set BEFORE HVG subsetting
    # (markers like CD14 / MS4A1 are not guaranteed to survive HVG selection).
    all_markers = sorted(
        {g for gs in TERMINAL_MARKERS.values() for g in gs if g in adata.var_names}
    )
    _mx = adata[:, all_markers].X
    _mx = _mx.toarray() if hasattr(_mx, "toarray") else np.asarray(_mx)
    marker_expr = pd.DataFrame(_mx, index=adata.obs_names, columns=all_markers)
    print(f"  Captured {len(all_markers)} terminal markers for terminal selection")

    # Root cell = the HSC cell at the apex of the atlas's own differentiation order.
    # GEX_pseudotime_order covers all HSC cells (lymphoid/myeloid mature cells are
    # NaN), so the HSC cell with the MINIMUM order is the atlas-defined starting
    # point of hematopoiesis. Fall back to a marker-score argmax if the column is
    # absent or HSC cells lack order values.
    root = None
    if "GEX_pseudotime_order" in adata.obs.columns:
        order = adata.obs["GEX_pseudotime_order"].astype(float)
        hsc_order = order[(adata.obs["cell_type"].astype(str) == "HSC").values].dropna()
        if len(hsc_order) > 0:
            root = hsc_order.idxmin()
            print(
                f"  Root (HSC apex via GEX_pseudotime_order): {root} "
                f"order={order[root]:.3f}"
            )
    if root is None:
        present = [g for g in ROOT_MARKERS if g in adata.var_names]
        if not present:
            raise ValueError(f"No root markers {ROOT_MARKERS} found in var_names")
        print(f"  [fallback] Root markers found: {present}")
        marker_score = np.asarray(adata[:, present].X.mean(axis=1)).ravel()
        root = adata.obs_names[int(np.argmax(marker_score))]
    print(f"  Root cell: {root}  cell_type: {adata.obs.loc[root, 'cell_type']}")

    # HVG selection
    sc.pp.highly_variable_genes(adata, n_top_genes=N_HVG)
    adata = adata[:, adata.var.highly_variable].copy()
    print(f"  After HVG subset: {adata.shape}")

    # Store genes as base Ensembl IDs (var['gene_id']) so bulk nodes (which carry
    # Ensembl IDs) can be aligned for projection. var_names are symbols and would
    # have zero overlap with the MAE's Ensembl-keyed node vectors.
    genes = [str(g) for g in adata.var["gene_id"]]
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
    # Supply one representative cell per mature lineage (closest to its centroid).
    terminal_map = {
        ct: _pick_terminal_marker(marker_expr, adata.obs, ct, markers)
        for ct, markers in TERMINAL_MARKERS.items()
    }
    terminal_map = {ct: bc for ct, bc in terminal_map.items() if bc is not None}
    terminal_cells = list(terminal_map.values())
    if len(terminal_cells) < 4:
        raise ValueError(
            f"Only {len(terminal_cells)} terminal states found; need >=4 for a "
            f"meaningful fate-probability landscape."
        )
    print(f"  Terminal state cells selected: {len(terminal_cells)}")
    for ct, bc in terminal_map.items():
        print(f"    {ct}: {bc}")

    # palantir 1.4.4 kwarg: terminal_states accepts a list of cell barcodes.
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
    by_type = (
        cells.groupby("cell_type", observed=True)["diff_potential"]
        .mean()
        .sort_values(ascending=False)
    )
    print("mean diff_potential by cell_type (full, sorted):\n", by_type.round(3).to_string())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
