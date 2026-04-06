#!/usr/bin/env python3
"""Tier 3D: DNase Accessibility Within GC Strata — THE CIRCLE-BREAKER.

The central question: do biophysical properties predict chromatin accessibility
BEYOND what GC content alone predicts?

Method: sample 50K random 1kb regions, compute biophysics, load DNase signal,
bin by GC strata, compute correlations WITHIN each stratum.

If partial_r > 0.05 within GC-matched strata, the property adds independent
biological information. This is non-circular because DNase-seq is an independent
experimental measurement.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier3/tier3d_dnase_gc_controlled.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import (
    GC_STRATA,
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
)
from polymer_genomics.ingest.reference_constants import (
    _A_FORM_PROPENSITY,
    _Z_FORM_PROPENSITY,
)

import pyBigWig

N_REGIONS = 50_000
WINDOW = 1000

DNASE_BW = PROJECT_ROOT / "data" / "accessibility" / "dnase_gm12878_ENCFF915DFR.bigWig"

passed = 0
failed = 0
results = {"tier": "3D", "name": "DNase Accessibility GC-Controlled", "tests": []}


def record(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
    print_test(name, ok, detail)
    results["tests"].append({"name": name, "passed": ok, "detail": detail})


def compute_region_properties(seq: str) -> dict | None:
    """Compute biophysical properties for a sequence."""
    seq = seq.upper()
    n = len(seq)
    if n < 2:
        return None

    gc = compute_gc(seq)

    dg_vals, roll_vals, tilt_vals, twist_vals = [], [], [], []
    rise_vals, deform_vals, aform_vals, zform_vals = [], [], [], []

    for i in range(n - 1):
        dinuc = seq[i:i + 2]
        nn = _NN_PARAMS.get(dinuc)
        if nn:
            dg_vals.append(nn["delta_g_37"])
        struct = _OLSON_STRUCTURAL.get(dinuc)
        if struct:
            roll_vals.append(struct["roll"])
            tilt_vals.append(struct["tilt"])
            twist_vals.append(struct["twist"])
            rise_vals.append(struct["rise"])
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

    # CpG obs/exp
    c_count = seq.count("C")
    g_count = seq.count("G")
    cpg_count = seq.count("CG")
    total = sum(1 for c in seq if c in "ACGT")
    cpg_exp = (c_count * g_count) / total if total > 0 else 0
    cpg_oe = cpg_count / cpg_exp if cpg_exp > 0 else 0

    # Dinucleotide entropy
    dinuc_counts = {}
    for i in range(n - 1):
        d = seq[i:i + 2]
        if all(c in "ACGT" for c in d):
            dinuc_counts[d] = dinuc_counts.get(d, 0) + 1
    total_d = sum(dinuc_counts.values())
    entropy = -sum((c / total_d) * math.log2(c / total_d)
                    for c in dinuc_counts.values() if c > 0) if total_d > 0 else 0

    return {
        "gc": gc,
        "mean_dg37": mean(dg_vals),
        "std_dg37": std(dg_vals),
        "mean_roll": mean(roll_vals),
        "mean_tilt": mean(tilt_vals),
        "mean_twist": mean(twist_vals),
        "mean_rise": mean(rise_vals),
        "mean_deformability": mean(deform_vals),
        "mean_a_form": mean(aform_vals),
        "mean_z_form": mean(zform_vals),
        "cpg_obs_exp": cpg_oe,
        "dinuc_entropy": entropy,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Sample regions, compute biophysics, load DNase
# ═══════════════════════════════════════════════════════════════════════════════

print(f"Sampling {N_REGIONS} random 1kb regions...")
regions = sample_random_regions(N_REGIONS, window=WINDOW, seed=123)
print(f"  Got {len(regions)} regions")

fa = get_fasta()
bw = pyBigWig.open(str(DNASE_BW))

data = []
for i, (chrom, start, end) in enumerate(regions):
    seq = str(fa[chrom][start:end]).upper()
    props = compute_region_properties(seq)
    if props is None:
        continue

    # DNase signal: mean over the region (use values() — stats() broken for this file)
    try:
        raw_vals = bw.values(chrom, start, end)
        if raw_vals is None:
            continue
        arr = np.array(raw_vals, dtype=float)
        if np.all(np.isnan(arr)):
            continue
        dnase_signal = float(np.nanmean(arr))
    except Exception:
        continue

    props["dnase"] = dnase_signal
    data.append(props)

    if (i + 1) % 10000 == 0:
        print(f"  Processed {i + 1}/{len(regions)}...")

bw.close()
print(f"  Valid regions with DNase signal: {len(data)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Global correlations (for reference — these are GC-confounded)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ GLOBAL CORRELATIONS (GC-confounded) ═══")

prop_names = [k for k in data[0].keys() if k not in ("gc", "dnase")]
gc_arr = np.array([d["gc"] for d in data])
dnase_arr = np.array([d["dnase"] for d in data])

# Log-transform DNase for better linearity (signal is log-normal)
dnase_log = np.log1p(dnase_arr)

r_gc_dnase = np.corrcoef(gc_arr, dnase_log)[0, 1]
print(f"  r(GC, log(DNase)): {r_gc_dnase:.4f}")

print(f"\n  {'Property':<22} {'r(DNase)':>10} {'r²':>8}")
print(f"  {'─' * 22} {'─' * 10} {'─' * 8}")

global_r = {}
for name in prop_names:
    vals = np.array([d[name] for d in data])
    r = np.corrcoef(vals, dnase_log)[0, 1]
    global_r[name] = round(float(r), 4)
    print(f"  {name:<22} {r:>10.4f} {r**2:>8.4f}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. GC-stratified correlations — THE CORE TEST
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ GC-STRATIFIED CORRELATIONS (circle-breaking) ═══")
print("  Within each GC stratum, does any property predict DNase beyond GC?")

strata_results = {}
for gc_lo, gc_hi in GC_STRATA:
    stratum_data = [d for d in data if gc_lo <= d["gc"] < gc_hi]
    n_stratum = len(stratum_data)
    if n_stratum < 100:
        print(f"\n  GC [{gc_lo:.2f}, {gc_hi:.2f}): n={n_stratum} (too few, skipping)")
        continue

    print(f"\n  GC [{gc_lo:.2f}, {gc_hi:.2f}): n={n_stratum}")

    stratum_dnase = np.log1p(np.array([d["dnase"] for d in stratum_data]))
    stratum_gc = np.array([d["gc"] for d in stratum_data])

    # Within-stratum GC-DNase correlation (should be much weaker than global)
    r_gc_within = np.corrcoef(stratum_gc, stratum_dnase)[0, 1]
    print(f"    r(GC, DNase) within stratum: {r_gc_within:.4f}")

    stratum_r = {}
    print(f"    {'Property':<22} {'r(DNase)':>10} {'partial_r|GC':>12}")
    print(f"    {'─' * 22} {'─' * 10} {'─' * 12}")

    for name in prop_names:
        vals = np.array([d[name] for d in stratum_data])

        # Raw within-stratum correlation
        r_raw = np.corrcoef(vals, stratum_dnase)[0, 1]

        # Partial correlation controlling for residual GC within stratum
        # Regress GC out of both property and DNase
        A = np.column_stack([np.ones(n_stratum), stratum_gc])
        beta_prop = np.linalg.lstsq(A, vals, rcond=None)[0]
        beta_dnase = np.linalg.lstsq(A, stratum_dnase, rcond=None)[0]
        resid_prop = vals - A @ beta_prop
        resid_dnase = stratum_dnase - A @ beta_dnase

        denom = np.std(resid_prop) * np.std(resid_dnase)
        if denom > 0:
            partial_r = np.corrcoef(resid_prop, resid_dnase)[0, 1]
        else:
            partial_r = 0.0

        stratum_r[name] = {
            "r_raw": round(float(r_raw), 4),
            "partial_r": round(float(partial_r), 4),
        }
        marker = " ***" if abs(partial_r) > 0.05 else ""
        print(f"    {name:<22} {r_raw:>10.4f} {partial_r:>12.4f}{marker}")

    strata_results[f"{gc_lo:.2f}-{gc_hi:.2f}"] = {
        "n": n_stratum,
        "r_gc_dnase_within": round(float(r_gc_within), 4),
        "properties": stratum_r,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Average partial correlations across strata
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ AVERAGE PARTIAL CORRELATION ACROSS STRATA ═══")
print("  Mean |partial_r| across all GC strata (weighted by n)")

avg_partial = {}
for name in prop_names:
    weighted_sum = 0.0
    total_n = 0
    for key, sr in strata_results.items():
        n_s = sr["n"]
        pr = sr["properties"][name]["partial_r"]
        weighted_sum += abs(pr) * n_s
        total_n += n_s
    avg_pr = weighted_sum / total_n if total_n > 0 else 0.0
    avg_partial[name] = round(avg_pr, 4)

# Sort by magnitude
sorted_avg = sorted(avg_partial.items(), key=lambda x: -x[1])

print(f"\n  {'Property':<22} {'Mean |partial_r|':>16} {'Verdict':>22}")
print(f"  {'─' * 22} {'─' * 16} {'─' * 22}")

for name, avg_pr in sorted_avg:
    if avg_pr > 0.10:
        verdict = "STRONG INDEPENDENT"
    elif avg_pr > 0.05:
        verdict = "WEAK INDEPENDENT"
    elif avg_pr > 0.02:
        verdict = "MARGINAL"
    else:
        verdict = "NO INDEPENDENT SIGNAL"
    print(f"  {name:<22} {avg_pr:>16.4f} {verdict:>22}")
    record(f"3D {name} independence",
           avg_pr > 0.02,
           f"mean |partial_r|={avg_pr:.4f}, verdict={verdict}")


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

n_independent = sum(1 for v in avg_partial.values() if v > 0.05)
n_marginal = sum(1 for v in avg_partial.values() if 0.02 < v <= 0.05)
n_none = sum(1 for v in avg_partial.values() if v <= 0.02)

print(f"\n{'═' * 70}")
print(f"TIER 3D SUMMARY")
print(f"{'═' * 70}")
print(f"  Regions analyzed: {len(data)}")
print(f"  External data: DNase-seq GM12878 (ENCODE ENCFF915DFR)")
print(f"  r(GC, log(DNase)) global: {r_gc_dnase:.4f}")
print(f"")
print(f"  Properties with INDEPENDENT signal (|partial_r| > 0.05):  {n_independent}")
print(f"  Properties with MARGINAL signal (|partial_r| 0.02-0.05): {n_marginal}")
print(f"  Properties with NO independent signal:                     {n_none}")
print(f"{'═' * 70}")

results["summary"] = {
    "n_regions": len(data),
    "r_gc_dnase_global": round(float(r_gc_dnase), 4),
    "average_partial_correlations": avg_partial,
    "n_independent": n_independent,
    "n_marginal": n_marginal,
    "n_no_signal": n_none,
}
results["strata_results"] = strata_results

write_results("tier3d", results)
