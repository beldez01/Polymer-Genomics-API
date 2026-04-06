#!/usr/bin/env python3
"""Tier 3E: Replication Timing Within GC Strata.

Same method as 3D but with replication timing as the outcome variable.
Uses pre-computed 1kb replication timing BED file (already on disk).

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier3/tier3e_replication_gc_controlled.py
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

REPLI_BED = PROJECT_ROOT / "data" / "replication" / "repli_timing_hg38_1kb.bed"

passed = 0
failed = 0
results = {"tier": "3E", "name": "Replication Timing GC-Controlled", "tests": []}


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

    c_count = seq.count("C")
    g_count = seq.count("G")
    cpg_count = seq.count("CG")
    total = sum(1 for c in seq if c in "ACGT")
    cpg_exp = (c_count * g_count) / total if total > 0 else 0
    cpg_oe = cpg_count / cpg_exp if cpg_exp > 0 else 0

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
# 1. Load replication timing data
# ═══════════════════════════════════════════════════════════════════════════════

print("Loading replication timing data...")
repli_data = {}  # (chrom, start) -> timing_value
with open(REPLI_BED) as f:
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) < 4:
            continue
        chrom = parts[0]
        start = int(float(parts[1]))
        try:
            timing = float(parts[3])
        except (ValueError, IndexError):
            continue
        repli_data[(chrom, start)] = timing

print(f"  Loaded {len(repli_data)} replication timing windows")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Sample and compute biophysics for replication timing windows
# ═══════════════════════════════════════════════════════════════════════════════

import random
MAX_REGIONS = 50_000
all_keys = list(repli_data.keys())
random.Random(42).shuffle(all_keys)
sampled_keys = all_keys[:MAX_REGIONS]
print(f"  Sampling {len(sampled_keys)} of {len(repli_data)} windows...")

print("Computing biophysics for sampled replication timing windows...")
fa = get_fasta()

data = []
processed = 0
for (chrom, start) in sampled_keys:
    timing = repli_data[(chrom, start)]
    if not chrom.startswith("chr") or chrom in ("chrX", "chrY", "chrM"):
        continue
    end = start + 1000
    try:
        seq = str(fa[chrom][start:end]).upper()
    except (KeyError, ValueError):
        continue

    if len(seq) < 900:  # skip short regions
        continue
    if seq.count("N") > 50:  # skip N-rich
        continue

    props = compute_region_properties(seq)
    if props is None:
        continue

    props["repli_timing"] = timing
    data.append(props)
    processed += 1

    if processed % 50000 == 0:
        print(f"  Processed {processed}...")

print(f"  Valid regions: {len(data)}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Global and GC-stratified correlations
# ═══════════════════════════════════════════════════════════════════════════════

prop_names = [k for k in data[0].keys() if k not in ("gc", "repli_timing")]
gc_arr = np.array([d["gc"] for d in data])
repli_arr = np.array([d["repli_timing"] for d in data])

r_gc_repli = np.corrcoef(gc_arr, repli_arr)[0, 1]
print(f"\n═══ GLOBAL: r(GC, repli_timing) = {r_gc_repli:.4f} ═══")

print(f"\n  {'Property':<22} {'r(repli)':>10}")
print(f"  {'─' * 22} {'─' * 10}")
for name in prop_names:
    vals = np.array([d[name] for d in data])
    r = np.corrcoef(vals, repli_arr)[0, 1]
    print(f"  {name:<22} {r:>10.4f}")

print("\n═══ GC-STRATIFIED CORRELATIONS ═══")

strata_results = {}
for gc_lo, gc_hi in GC_STRATA:
    stratum_data = [d for d in data if gc_lo <= d["gc"] < gc_hi]
    n_stratum = len(stratum_data)
    if n_stratum < 100:
        print(f"\n  GC [{gc_lo:.2f}, {gc_hi:.2f}): n={n_stratum} (too few)")
        continue

    print(f"\n  GC [{gc_lo:.2f}, {gc_hi:.2f}): n={n_stratum}")

    stratum_repli = np.array([d["repli_timing"] for d in stratum_data])
    stratum_gc = np.array([d["gc"] for d in stratum_data])

    r_gc_within = np.corrcoef(stratum_gc, stratum_repli)[0, 1]
    print(f"    r(GC, repli) within: {r_gc_within:.4f}")

    stratum_r = {}
    print(f"    {'Property':<22} {'r(repli)':>10} {'partial_r|GC':>12}")
    print(f"    {'─' * 22} {'─' * 10} {'─' * 12}")

    for name in prop_names:
        vals = np.array([d[name] for d in stratum_data])
        r_raw = np.corrcoef(vals, stratum_repli)[0, 1]

        A = np.column_stack([np.ones(n_stratum), stratum_gc])
        beta_prop = np.linalg.lstsq(A, vals, rcond=None)[0]
        beta_repli = np.linalg.lstsq(A, stratum_repli, rcond=None)[0]
        resid_prop = vals - A @ beta_prop
        resid_repli = stratum_repli - A @ beta_repli

        denom = np.std(resid_prop) * np.std(resid_repli)
        partial_r = np.corrcoef(resid_prop, resid_repli)[0, 1] if denom > 0 else 0.0

        stratum_r[name] = {
            "r_raw": round(float(r_raw), 4),
            "partial_r": round(float(partial_r), 4),
        }
        marker = " ***" if abs(partial_r) > 0.05 else ""
        print(f"    {name:<22} {r_raw:>10.4f} {partial_r:>12.4f}{marker}")

    strata_results[f"{gc_lo:.2f}-{gc_hi:.2f}"] = {
        "n": n_stratum, "properties": stratum_r,
    }

# Average partial correlations
print("\n═══ AVERAGE PARTIAL CORRELATION ACROSS STRATA ═══")

avg_partial = {}
for name in prop_names:
    weighted_sum = 0.0
    total_n = 0
    for key, sr in strata_results.items():
        n_s = sr["n"]
        pr = sr["properties"][name]["partial_r"]
        weighted_sum += abs(pr) * n_s
        total_n += n_s
    avg_partial[name] = round(weighted_sum / total_n, 4) if total_n > 0 else 0.0

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
    record(f"3E {name}", avg_pr > 0.02,
           f"|partial_r|={avg_pr:.4f}, verdict={verdict}")

n_independent = sum(1 for v in avg_partial.values() if v > 0.05)

print(f"\n{'═' * 70}")
print(f"TIER 3E SUMMARY: r(GC, repli)={r_gc_repli:.4f}, {n_independent} independent properties")
print(f"{'═' * 70}")

results["summary"] = {
    "n_regions": len(data),
    "r_gc_repli_global": round(float(r_gc_repli), 4),
    "average_partial_correlations": avg_partial,
    "n_independent": n_independent,
}
results["strata_results"] = strata_results
write_results("tier3e", results)
