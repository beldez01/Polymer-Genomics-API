#!/usr/bin/env python3
"""Tier 5: Dimensional Independence — how many things are we actually measuring?

The API serves 64 biophysical columns at 1kb. If most are GC-derivatives, the
effective dimensionality is much lower than 64. This test computes biophysics for
10,000 random 1kb regions from FASTA and runs PCA + partial correlation analysis.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier5_dimensional_independence.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import (
    compute_gc,
    get_fasta,
    print_test,
    sample_random_regions,
    write_results,
)
from polymer_genomics.biophysics import (
    _NN_PARAMS,
    _OLSON_STRUCTURAL,
    _TRX_DEFORMABILITY,
    compute_thermodynamics,
)
from polymer_genomics.ingest.reference_constants import (
    _A_FORM_PROPENSITY,
    _Z_FORM_PROPENSITY,
)

N_REGIONS = 10_000
WINDOW = 1000
results = {"tier": "5", "name": "Dimensional Independence", "tests": []}


def compute_properties(seq: str) -> dict | None:
    """Compute all biophysical properties for a 1kb sequence."""
    seq = seq.upper()
    n = len(seq)
    if n < 2:
        return None

    # GC content
    gc = compute_gc(seq)

    # CpG obs/exp
    c_count = seq.count("C")
    g_count = seq.count("G")
    cpg_count = seq.count("CG")
    total_valid = sum(1 for c in seq if c in "ACGT")
    cpg_expected = (c_count * g_count) / total_valid if total_valid > 0 else 0
    cpg_oe = cpg_count / cpg_expected if cpg_expected > 0 else 0

    # CpG density (per kb)
    cpg_density = cpg_count / (total_valid / 1000) if total_valid > 0 else 0

    # Per-step properties
    dg_vals = []
    dh_vals = []
    ds_vals = []
    roll_vals = []
    tilt_vals = []
    twist_vals = []
    rise_vals = []
    slide_vals = []
    deform_vals = []
    aform_vals = []
    zform_vals = []

    for i in range(n - 1):
        dinuc = seq[i:i + 2]
        nn = _NN_PARAMS.get(dinuc)
        if nn:
            dg_vals.append(nn["delta_g_37"])
            dh_vals.append(nn["delta_h"])
            ds_vals.append(nn["delta_s"])
        struct = _OLSON_STRUCTURAL.get(dinuc)
        if struct:
            roll_vals.append(struct["roll"])
            tilt_vals.append(struct["tilt"])
            twist_vals.append(struct["twist"])
            rise_vals.append(struct["rise"])
            slide_vals.append(struct["slide"])
        trx = _TRX_DEFORMABILITY.get(dinuc)
        if trx is not None:
            deform_vals.append(float(trx))
        af = _A_FORM_PROPENSITY.get(dinuc)
        if af is not None:
            aform_vals.append(af)
        zf = _Z_FORM_PROPENSITY.get(dinuc)
        if zf is not None:
            zform_vals.append(zf)

    if not dg_vals:
        return None

    def mean(vals):
        return sum(vals) / len(vals) if vals else float("nan")

    def std(vals):
        if len(vals) < 2:
            return 0.0
        m = mean(vals)
        return math.sqrt(sum((v - m) ** 2 for v in vals) / (len(vals) - 1))

    # Curvature (windowed roll/tilt RMS)
    roll_arr = np.array(roll_vals)
    tilt_arr = np.array(tilt_vals)
    if len(roll_arr) > 21:
        half = 10
        curvatures = []
        for i in range(len(roll_arr)):
            lo = max(0, i - half)
            hi = min(len(roll_arr), i + half + 1)
            mr2 = np.mean(roll_arr[lo:hi] ** 2)
            mt2 = np.mean(tilt_arr[lo:hi] ** 2)
            curvatures.append(math.sqrt(mr2 + mt2))
        mean_curvature = np.mean(curvatures)
    else:
        mean_curvature = math.sqrt(np.mean(roll_arr ** 2) + np.mean(tilt_arr ** 2))

    # Dinucleotide entropy
    dinuc_counts = {}
    for i in range(n - 1):
        d = seq[i:i + 2]
        if all(c in "ACGT" for c in d):
            dinuc_counts[d] = dinuc_counts.get(d, 0) + 1
    total_dinucs = sum(dinuc_counts.values())
    entropy = 0.0
    for count in dinuc_counts.values():
        p = count / total_dinucs
        if p > 0:
            entropy -= p * math.log2(p)

    return {
        "gc": gc,
        "mean_dg37": mean(dg_vals),
        "mean_dh": mean(dh_vals),
        "mean_ds": mean(ds_vals),
        "std_dg37": std(dg_vals),
        "mean_roll": mean(roll_vals),
        "mean_tilt": mean(tilt_vals),
        "mean_twist": mean(twist_vals),
        "mean_rise": mean(rise_vals),
        "mean_slide": mean(slide_vals),
        "mean_deformability": mean(deform_vals),
        "mean_a_form": mean(aform_vals),
        "mean_z_form": mean(zform_vals),
        "mean_curvature": float(mean_curvature),
        "cpg_obs_exp": cpg_oe,
        "cpg_density": cpg_density,
        "dinuc_entropy": entropy,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Sample regions and compute properties
# ═══════════════════════════════════════════════════════════════════════════════

print(f"Sampling {N_REGIONS} random 1kb regions from hg38...")
regions = sample_random_regions(N_REGIONS, window=WINDOW, seed=42)
print(f"  Got {len(regions)} regions")

fa = get_fasta()
prop_names = None
data_rows = []

for i, (chrom, start, end) in enumerate(regions):
    seq = str(fa[chrom][start:end]).upper()
    props = compute_properties(seq)
    if props is None:
        continue
    if prop_names is None:
        prop_names = list(props.keys())
    data_rows.append([props[k] for k in prop_names])
    if (i + 1) % 2000 == 0:
        print(f"  Computed {i + 1}/{len(regions)} regions...")

print(f"  Valid regions: {len(data_rows)}")

X = np.array(data_rows)
n_samples, n_features = X.shape
print(f"  Matrix: {n_samples} × {n_features}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. PCA
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ PCA ANALYSIS ═══")

# Standardize
X_std = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-12)

# SVD-based PCA
U, S, Vt = np.linalg.svd(X_std, full_matrices=False)
explained_var = (S ** 2) / (n_samples - 1)
total_var = explained_var.sum()
explained_ratio = explained_var / total_var
cumulative = np.cumsum(explained_ratio)

print(f"\n  {'PC':<5} {'Var Explained':>14} {'Cumulative':>12}")
print(f"  {'─' * 5} {'─' * 14} {'─' * 12}")
for i in range(min(n_features, 10)):
    print(f"  PC{i + 1:<3} {explained_ratio[i]:>13.4f} {cumulative[i]:>11.4f}")

# Key thresholds
for thresh in [0.50, 0.75, 0.90, 0.95, 0.99]:
    n_pcs = int(np.searchsorted(cumulative, thresh) + 1)
    print(f"\n  PCs for {thresh:.0%} variance: {n_pcs}")
    results["tests"].append({
        "name": f"PCs for {thresh:.0%} variance",
        "n_pcs": n_pcs,
    })

print(f"\n  EFFECTIVE DIMENSIONALITY (95%): {int(np.searchsorted(cumulative, 0.95) + 1)} of {n_features}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Correlation Matrix
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ PEARSON CORRELATION WITH GC ═══")

gc_idx = prop_names.index("gc")
gc_col = X[:, gc_idx]

print(f"\n  {'Property':<25} {'r(GC)':>8} {'r²(GC)':>8}")
print(f"  {'─' * 25} {'─' * 8} {'─' * 8}")

gc_correlations = {}
for j, name in enumerate(prop_names):
    if name == "gc":
        continue
    r = np.corrcoef(gc_col, X[:, j])[0, 1]
    gc_correlations[name] = round(float(r), 4)
    print(f"  {name:<25} {r:>8.4f} {r**2:>8.4f}")

results["gc_correlations"] = gc_correlations


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Partial Correlations After Removing GC
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ PARTIAL CORRELATIONS (GC REMOVED) ═══")
print("  Pairwise correlation of residuals after regressing out GC")

# Regress GC out of each variable
X_resid = np.zeros_like(X)
for j in range(n_features):
    if j == gc_idx:
        continue
    # Simple linear regression: col_j = a + b * gc + residual
    A = np.column_stack([np.ones(n_samples), gc_col])
    beta = np.linalg.lstsq(A, X[:, j], rcond=None)[0]
    X_resid[:, j] = X[:, j] - A @ beta

# Correlation matrix of residuals (excluding GC)
other_idx = [i for i in range(n_features) if i != gc_idx]
other_names = [prop_names[i] for i in other_idx]
R_resid = np.corrcoef(X_resid[:, other_idx].T)

print(f"\n  Strongest partial correlations (|r| > 0.3 after GC removal):")
print(f"  {'Property 1':<22} {'Property 2':<22} {'partial r':>10}")
print(f"  {'─' * 22} {'─' * 22} {'─' * 10}")

strong_partial = []
for i in range(len(other_idx)):
    for j in range(i + 1, len(other_idx)):
        r = R_resid[i, j]
        if abs(r) > 0.3:
            strong_partial.append((other_names[i], other_names[j], round(float(r), 4)))

strong_partial.sort(key=lambda x: -abs(x[2]))
for name1, name2, r in strong_partial[:20]:
    print(f"  {name1:<22} {name2:<22} {r:>10.4f}")

results["strong_partial_correlations"] = [
    {"prop1": n1, "prop2": n2, "r": r} for n1, n2, r in strong_partial
]


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Independent Information Content per Property
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ INDEPENDENT INFORMATION CONTENT ═══")
print("  Variance NOT explained by GC (= 1 - r²(GC))")
print(f"\n  {'Property':<25} {'r(GC)':>8} {'1-r²':>8} {'Verdict':>20}")
print(f"  {'─' * 25} {'─' * 8} {'─' * 8} {'─' * 20}")

verdicts = {}
for j, name in enumerate(prop_names):
    if name == "gc":
        continue
    r = np.corrcoef(gc_col, X[:, j])[0, 1]
    independent_var = 1 - r ** 2
    if independent_var < 0.01:
        verdict = "GC-REDUNDANT"
    elif independent_var < 0.05:
        verdict = "MOSTLY GC"
    elif independent_var < 0.20:
        verdict = "PARTIALLY INDEPENDENT"
    else:
        verdict = "INDEPENDENT"
    verdicts[name] = verdict
    print(f"  {name:<25} {r:>8.4f} {independent_var:>8.4f} {verdict:>20}")

results["verdicts"] = verdicts


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Full Correlation Matrix Heatmap (text-based)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ FULL CORRELATION MATRIX ═══")
R_full = np.corrcoef(X.T)

# Print compact matrix
short_names = [n[:8] for n in prop_names]
print(f"\n  {'':>10}", end="")
for sn in short_names:
    print(f" {sn:>8}", end="")
print()

for i, name in enumerate(prop_names):
    print(f"  {name[:10]:>10}", end="")
    for j in range(n_features):
        r = R_full[i, j]
        print(f" {r:>8.3f}", end="")
    print()


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

n_95 = int(np.searchsorted(cumulative, 0.95) + 1)
n_redundant = sum(1 for v in verdicts.values() if v == "GC-REDUNDANT")
n_mostly = sum(1 for v in verdicts.values() if v == "MOSTLY GC")
n_partial = sum(1 for v in verdicts.values() if v == "PARTIALLY INDEPENDENT")
n_independent = sum(1 for v in verdicts.values() if v == "INDEPENDENT")

print(f"\n{'═' * 70}")
print(f"TIER 5 SUMMARY")
print(f"{'═' * 70}")
print(f"  Properties analyzed: {n_features}")
print(f"  PCs for 95% variance: {n_95}")
print(f"  Effective dimensionality: {n_95}")
print(f"")
print(f"  GC-REDUNDANT (1-r² < 0.01):     {n_redundant}")
print(f"  MOSTLY GC (1-r² < 0.05):         {n_mostly}")
print(f"  PARTIALLY INDEPENDENT (1-r² < 0.20): {n_partial}")
print(f"  INDEPENDENT (1-r² ≥ 0.20):       {n_independent}")
print(f"{'═' * 70}")

results["summary"] = {
    "n_features": n_features,
    "n_regions": len(data_rows),
    "pcs_95_pct": n_95,
    "n_gc_redundant": n_redundant,
    "n_mostly_gc": n_mostly,
    "n_partially_independent": n_partial,
    "n_independent": n_independent,
    "explained_variance_ratios": [round(float(x), 5) for x in explained_ratio[:10]],
    "cumulative_variance": [round(float(x), 5) for x in cumulative[:10]],
}

write_results("tier5", results)
