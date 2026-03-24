"""GPU-accelerated cross-layer correlation analysis.

Reads the exported Parquet matrix and computes 9 analyses:
1. Raw Pearson correlation matrix
2. Spearman rank correlation matrix
3. GC-partialed correlation matrix (KEY OUTPUT)
4. Per-chromosome Pearson
5. Per-isochore Pearson
6. PCA (top 20 components)
7. UMAP embedding (100K subsample)
8. Mutual Information matrix
9. Distance Correlation matrix (50K subsample)

Platform: Google Colab Pro+ (A100 40GB) or Lambda Labs
Dependencies: cupy, cudf, cuml, plotly, pyarrow, numpy, scipy

Usage (GPU)::

    python gpu_cross_layer_correlation.py --input correlation_matrix_hg38_1kb.parquet

Usage (CPU fallback)::

    python gpu_cross_layer_correlation.py --input correlation_matrix_hg38_1kb.parquet --cpu
"""

from __future__ import annotations

import argparse
import os
import time
import warnings

import numpy as np

warnings.filterwarnings("ignore")


def load_data(input_path: str, use_gpu: bool = True):
    """Load Parquet into GPU or CPU dataframe."""
    if use_gpu:
        import cudf
        df = cudf.read_parquet(input_path)
    else:
        import pandas as pd
        df = pd.read_parquet(input_path)

    print(f"Loaded: {df.shape[0]:,} rows × {df.shape[1]} columns")
    return df


def get_numeric_columns(df, exclude=("chr_id", "start_pos", "end_pos", "isochore_gc")):
    """Get list of numeric columns for correlation."""
    cols = [c for c in df.columns if c not in exclude]
    return cols


def standardize(X):
    """Standardize columns to zero mean, unit variance."""
    mu = np.nanmean(X, axis=0)
    sigma = np.nanstd(X, axis=0)
    sigma[sigma == 0] = 1.0
    return (X - mu) / sigma


# ── Analysis 1: Raw Pearson ──────────────────────────────────────────────────

def compute_pearson(X: np.ndarray) -> np.ndarray:
    """GPU-friendly Pearson via matrix multiply on standardized data."""
    # Replace NaN with column means for correlation
    col_means = np.nanmean(X, axis=0)
    X_filled = np.where(np.isnan(X), col_means, X)
    Z = standardize(X_filled)
    n = Z.shape[0]
    return (Z.T @ Z) / n


# ── Analysis 2: Spearman ─────────────────────────────────────────────────────

def compute_spearman(X: np.ndarray) -> np.ndarray:
    """Spearman via rank transform then Pearson."""
    from scipy.stats import rankdata
    X_ranked = np.apply_along_axis(
        lambda col: rankdata(col, nan_policy="omit"), 0, X
    )
    return compute_pearson(X_ranked)


# ── Analysis 3: GC-Partialed Correlation ─────────────────────────────────────

def compute_gc_partialed(X: np.ndarray, gc_col_idx: int) -> np.ndarray:
    """First-order conditional correlation: r(i,j|GC).

    For each pair (i,j), compute:
        r_ij|gc = (r_ij - r_igc * r_jgc) / sqrt((1 - r_igc^2)(1 - r_jgc^2))
    """
    R = compute_pearson(X)
    n_cols = R.shape[0]
    gc = gc_col_idx

    r_gc = R[gc, :]  # correlation of each variable with GC

    partial = np.zeros_like(R)
    for i in range(n_cols):
        for j in range(n_cols):
            if i == j:
                partial[i, j] = 1.0
                continue
            num = R[i, j] - r_gc[i] * r_gc[j]
            denom = np.sqrt((1 - r_gc[i]**2) * (1 - r_gc[j]**2))
            if denom > 1e-10:
                partial[i, j] = num / denom
            else:
                partial[i, j] = np.nan

    return partial


# ── Analysis 6: PCA ──────────────────────────────────────────────────────────

def compute_pca(X: np.ndarray, n_components: int = 20, use_gpu: bool = True):
    """PCA via cuML or sklearn."""
    col_means = np.nanmean(X, axis=0)
    X_filled = np.where(np.isnan(X), col_means, X)

    if use_gpu:
        try:
            from cuml import PCA
            pca = PCA(n_components=n_components)
            pca.fit(X_filled.astype(np.float32))
            return pca.components_, pca.explained_variance_ratio_
        except ImportError:
            pass

    from sklearn.decomposition import PCA
    pca = PCA(n_components=n_components)
    pca.fit(X_filled)
    return pca.components_, pca.explained_variance_ratio_


# ── Analysis 7: UMAP ────────────────────────────────────────────────────────

def compute_umap(X: np.ndarray, n_samples: int = 100_000, use_gpu: bool = True):
    """UMAP embedding on subsample."""
    col_means = np.nanmean(X, axis=0)
    X_filled = np.where(np.isnan(X), col_means, X)

    rng = np.random.default_rng(42)
    idx = rng.choice(X_filled.shape[0], size=min(n_samples, X_filled.shape[0]), replace=False)
    X_sub = X_filled[idx]

    if use_gpu:
        try:
            from cuml import UMAP
            umap = UMAP(n_components=2, n_neighbors=15, min_dist=0.1)
            embedding = umap.fit_transform(X_sub.astype(np.float32))
            return idx, np.asarray(embedding)
        except ImportError:
            pass

    from umap import UMAP
    umap = UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
    embedding = umap.fit_transform(X_sub)
    return idx, embedding


# ── Analysis 8: Mutual Information ───────────────────────────────────────────

def compute_mutual_information(X: np.ndarray, n_bins: int = 50) -> np.ndarray:
    """Discretized histogram-based MI matrix."""
    n_cols = X.shape[1]
    MI = np.zeros((n_cols, n_cols))

    # Discretize each column
    X_disc = np.zeros_like(X, dtype=np.int32)
    for j in range(n_cols):
        col = X[:, j]
        valid = ~np.isnan(col)
        if valid.sum() < 10:
            X_disc[:, j] = 0
            continue
        edges = np.linspace(np.nanmin(col), np.nanmax(col) + 1e-10, n_bins + 1)
        X_disc[:, j] = np.digitize(col, edges) - 1
        X_disc[~valid, j] = 0

    for i in range(n_cols):
        for j in range(i, n_cols):
            # Joint histogram
            joint = np.zeros((n_bins, n_bins))
            for k in range(X.shape[0]):
                if np.isnan(X[k, i]) or np.isnan(X[k, j]):
                    continue
                joint[X_disc[k, i], X_disc[k, j]] += 1

            joint /= joint.sum() + 1e-10

            # Marginals
            pi = joint.sum(axis=1)
            pj = joint.sum(axis=0)

            # MI = sum p(x,y) * log(p(x,y) / (p(x)*p(y)))
            mi = 0.0
            for a in range(n_bins):
                for b in range(n_bins):
                    if joint[a, b] > 1e-15 and pi[a] > 1e-15 and pj[b] > 1e-15:
                        mi += joint[a, b] * np.log(joint[a, b] / (pi[a] * pj[b]))

            MI[i, j] = mi
            MI[j, i] = mi

    return MI


# ── Analysis 9: Distance Correlation ─────────────────────────────────────────

def compute_distance_correlation(X: np.ndarray, n_samples: int = 50_000) -> np.ndarray:
    """Distance correlation matrix on subsample."""
    rng = np.random.default_rng(42)
    idx = rng.choice(X.shape[0], size=min(n_samples, X.shape[0]), replace=False)
    X_sub = X[idx]

    col_means = np.nanmean(X_sub, axis=0)
    X_sub = np.where(np.isnan(X_sub), col_means, X_sub)

    n_cols = X_sub.shape[1]
    n = X_sub.shape[0]
    dCor = np.zeros((n_cols, n_cols))

    # Pre-compute centered distance matrices
    def centered_dist(x):
        d = np.abs(x[:, None] - x[None, :])
        row_mean = d.mean(axis=1, keepdims=True)
        col_mean = d.mean(axis=0, keepdims=True)
        grand_mean = d.mean()
        return d - row_mean - col_mean + grand_mean

    print("  Computing distance correlation (may take a while for many columns)...")
    A_cache = {}
    for i in range(n_cols):
        A_cache[i] = centered_dist(X_sub[:, i])

    for i in range(n_cols):
        for j in range(i, n_cols):
            A = A_cache[i]
            B = A_cache[j]
            dcov2_xy = (A * B).mean()
            dcov2_xx = (A * A).mean()
            dcov2_yy = (B * B).mean()

            if dcov2_xx > 0 and dcov2_yy > 0:
                dcor = np.sqrt(dcov2_xy / np.sqrt(dcov2_xx * dcov2_yy))
            else:
                dcor = 0.0

            dCor[i, j] = dcor
            dCor[j, i] = dcor

    return dCor


# ── Visualization ────────────────────────────────────────────────────────────

def plot_heatmap(matrix: np.ndarray, labels: list[str], title: str, output_path: str):
    """Interactive plotly heatmap."""
    import plotly.graph_objects as go

    fig = go.Figure(data=go.Heatmap(
        z=matrix,
        x=labels,
        y=labels,
        colorscale="RdBu_r",
        zmid=0,
        text=np.round(matrix, 3),
        texttemplate="%{text}",
        textfont={"size": 6},
    ))
    fig.update_layout(
        title=title,
        width=max(800, len(labels) * 20),
        height=max(800, len(labels) * 20),
        xaxis_tickangle=-45,
        font=dict(size=8),
    )
    fig.write_html(output_path)
    print(f"  Saved: {output_path}")


def plot_umap(embedding, chr_ids, output_path: str):
    """UMAP scatter colored by chromosome."""
    import plotly.express as px
    import pandas as pd

    df = pd.DataFrame({
        "UMAP1": embedding[:, 0],
        "UMAP2": embedding[:, 1],
        "chr": [f"chr{c}" for c in chr_ids],
    })
    fig = px.scatter(df, x="UMAP1", y="UMAP2", color="chr",
                     title="UMAP of 1kb Genomic Windows (100K subsample)",
                     opacity=0.3, width=1000, height=800)
    fig.write_html(output_path)
    print(f"  Saved: {output_path}")


def plot_pca_loadings(components, variance_ratio, labels, output_path: str):
    """PCA loadings barplot."""
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots

    n_show = min(5, len(variance_ratio))
    fig = make_subplots(rows=n_show, cols=1,
                        subplot_titles=[f"PC{i+1} ({variance_ratio[i]:.1%} var)"
                                       for i in range(n_show)])

    for i in range(n_show):
        loadings = components[i]
        sorted_idx = np.argsort(np.abs(loadings))[::-1][:20]  # Top 20
        fig.add_trace(
            go.Bar(
                x=[labels[j] for j in sorted_idx],
                y=[loadings[j] for j in sorted_idx],
                name=f"PC{i+1}",
            ),
            row=i + 1, col=1,
        )

    fig.update_layout(height=300 * n_show, width=1000, showlegend=False,
                      title="PCA Loadings (top 20 per component)")
    fig.write_html(output_path)
    print(f"  Saved: {output_path}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GPU cross-layer correlation analysis")
    parser.add_argument("--input", required=True, help="Input Parquet file")
    parser.add_argument("--output-dir", default="correlation_results", help="Output directory")
    parser.add_argument("--cpu", action="store_true", help="Use CPU fallback (no RAPIDS)")
    parser.add_argument("--skip-slow", action="store_true", help="Skip MI and dCor (slow)")
    args = parser.parse_args()

    use_gpu = not args.cpu
    os.makedirs(args.output_dir, exist_ok=True)

    # Load data
    print(f"\n{'='*60}")
    print("GPU Cross-Layer Correlation Analysis")
    print(f"{'='*60}\n")

    df = load_data(args.input, use_gpu=False)  # Always pandas for numpy conversion
    numeric_cols = get_numeric_columns(df)
    print(f"Numeric columns: {len(numeric_cols)}")

    X = df[numeric_cols].values.astype(np.float64)
    chr_ids = df["chr_id"].values
    labels = numeric_cols

    # Find GC column index
    gc_idx = labels.index("gc_content") if "gc_content" in labels else 0

    # ── Analysis 1: Raw Pearson ──
    print("\n[1/9] Raw Pearson correlation...")
    t0 = time.time()
    R_pearson = compute_pearson(X)
    print(f"  Done in {time.time()-t0:.1f}s")
    plot_heatmap(R_pearson, labels, "Raw Pearson Correlation (1kb windows)",
                 os.path.join(args.output_dir, "pearson_heatmap.html"))

    # ── Analysis 2: Spearman ──
    print("\n[2/9] Spearman rank correlation...")
    t0 = time.time()
    R_spearman = compute_spearman(X)
    print(f"  Done in {time.time()-t0:.1f}s")
    plot_heatmap(R_spearman, labels, "Spearman Rank Correlation (1kb windows)",
                 os.path.join(args.output_dir, "spearman_heatmap.html"))

    # ── Analysis 3: GC-Partialed ──
    print("\n[3/9] GC-partialed correlation (KEY OUTPUT)...")
    t0 = time.time()
    R_partial = compute_gc_partialed(X, gc_idx)
    print(f"  Done in {time.time()-t0:.1f}s")
    plot_heatmap(R_partial, labels, "GC-Partialed Correlation r(i,j|GC)",
                 os.path.join(args.output_dir, "gc_partialed_heatmap.html"))

    # Sanity checks
    print("\n  Sanity checks:")
    if "stacking_dg37" in labels:
        stk_idx = labels.index("stacking_dg37")
        print(f"    r(GC, stacking) raw = {R_pearson[gc_idx, stk_idx]:.4f} (expect ~-0.999)")
        print(f"    r(GC, stacking) partialed = {R_partial[gc_idx, stk_idx]:.4f} (expect ~NaN or small)")
    if "melting_temp" in labels:
        tm_idx = labels.index("melting_temp")
        print(f"    r(GC, Tm) raw = {R_pearson[gc_idx, tm_idx]:.4f} (expect ~0.999)")

    # ── Analysis 4: Per-chromosome ──
    print("\n[4/9] Per-chromosome Pearson...")
    chr_results = {}
    for c in sorted(set(chr_ids)):
        if c > 22:  # Skip X, Y, M for simplicity
            continue
        mask = chr_ids == c
        if mask.sum() < 100:
            continue
        R_chr = compute_pearson(X[mask])
        chr_results[f"chr{c}"] = R_chr
    print(f"  Computed for {len(chr_results)} chromosomes")

    # ── Analysis 5: Per-isochore ──
    print("\n[5/9] Per-isochore Pearson...")
    gc = X[:, gc_idx]
    isochore_bins = [
        ("L1", 0.0, 0.37),
        ("L2", 0.37, 0.41),
        ("H1", 0.41, 0.46),
        ("H2", 0.46, 0.53),
        ("H3", 0.53, 1.0),
    ]
    iso_results = {}
    for name, lo, hi in isochore_bins:
        mask = (gc >= lo) & (gc < hi) & ~np.isnan(gc)
        if mask.sum() < 100:
            continue
        R_iso = compute_pearson(X[mask])
        iso_results[name] = R_iso
        print(f"  {name} (GC {lo:.2f}-{hi:.2f}): {mask.sum():,} windows")

    # ── Analysis 6: PCA ──
    print("\n[6/9] PCA (top 20 components)...")
    t0 = time.time()
    components, var_ratio = compute_pca(X, n_components=20, use_gpu=use_gpu)
    print(f"  Done in {time.time()-t0:.1f}s")
    print(f"  Top 5 variance explained: {', '.join(f'{v:.1%}' for v in var_ratio[:5])}")
    plot_pca_loadings(components, var_ratio, labels,
                      os.path.join(args.output_dir, "pca_loadings.html"))

    # ── Analysis 7: UMAP ──
    print("\n[7/9] UMAP embedding (100K subsample)...")
    t0 = time.time()
    umap_idx, embedding = compute_umap(X, n_samples=100_000, use_gpu=use_gpu)
    print(f"  Done in {time.time()-t0:.1f}s")
    plot_umap(embedding, chr_ids[umap_idx],
              os.path.join(args.output_dir, "umap_embedding.html"))

    if not args.skip_slow:
        # ── Analysis 8: Mutual Information ──
        print("\n[8/9] Mutual Information...")
        t0 = time.time()
        MI = compute_mutual_information(X)
        print(f"  Done in {time.time()-t0:.1f}s")
        plot_heatmap(MI, labels, "Mutual Information (50 bins)",
                     os.path.join(args.output_dir, "mutual_information_heatmap.html"))

        # ── Analysis 9: Distance Correlation ──
        print("\n[9/9] Distance Correlation (50K subsample)...")
        t0 = time.time()
        dCor = compute_distance_correlation(X, n_samples=50_000)
        print(f"  Done in {time.time()-t0:.1f}s")
        plot_heatmap(dCor, labels, "Distance Correlation (50K subsample)",
                     os.path.join(args.output_dir, "distance_correlation_heatmap.html"))
    else:
        print("\n[8-9/9] Skipped MI and dCor (--skip-slow)")

    # ── Save all results ──
    print("\n  Saving correlation matrices to Parquet...")
    import pyarrow as pa
    import pyarrow.parquet as pq

    results = {
        "pearson": R_pearson,
        "spearman": R_spearman,
        "gc_partialed": R_partial,
    }

    # Save as a dict of flattened matrices with column labels
    metadata = {
        "columns": ",".join(labels),
        "n_windows": str(X.shape[0]),
        "n_features": str(len(labels)),
    }

    for name, matrix in results.items():
        flat = matrix.flatten().astype(np.float32)
        table = pa.table({"values": flat})
        table = table.replace_schema_metadata({
            **metadata,
            "matrix_type": name,
            "shape": f"{matrix.shape[0]},{matrix.shape[1]}",
        })
        path = os.path.join(args.output_dir, f"{name}_matrix.parquet")
        pq.write_table(table, path)

    # Summary
    print(f"\n{'='*60}")
    print("ANALYSIS COMPLETE")
    print(f"{'='*60}")
    print(f"  Output directory: {args.output_dir}/")
    print(f"  Key output: gc_partialed_heatmap.html")
    print(f"  Columns: {len(labels)}")
    print(f"  Windows: {X.shape[0]:,}")
    print(f"  Total variance explained by PC1-5: {sum(var_ratio[:5]):.1%}")


if __name__ == "__main__":
    main()
