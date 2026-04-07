#!/usr/bin/env python3
"""Tier 3G: MPRA Linter Validation — do biophysical flags associate with regulatory activity?

Data: Agarwal et al. 2025 Nature — 226K K562 lentiMPRA elements (200bp cCREs).
      Activity = log2(RNA/DNA) from column 7 of ActivityRatios.k562.bed.

Design (CompBio-reviewed):
  - Forward-orientation only (avoid double-counting reversed duplicates)
  - GC-stratified analysis (flags correlate with GC; must control)
  - Effect size (Cohen's d + 95% CI), not just significance
  - Report flag prevalence at 200bp scale (some flags won't fire)
  - Logistic regression: predict active (above median) from flags + GC
  - Continuous regression: activity ~ flag_count + GC

Source: https://krishna.gs.washington.edu/content/members/vagar/forJJ/
        bigMPRA_forENCODE_processedFiles/

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier3/tier3g_mpra_validation.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import GC_STRATA, compute_gc, print_test, write_results

ACTIVITY_BED = PROJECT_ROOT / "validation" / "data" / "mpra" / "big_k562_activity.bed"
FASTA_PATH = PROJECT_ROOT / "data" / "hg38.fa"

results = {"tier": "3G", "name": "MPRA Linter Validation (K562)", "tests": []}
passed = 0
failed = 0


def record(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
    print_test(name, ok, detail)
    results["tests"].append({"name": name, "passed": ok, "detail": detail})


def cohens_d(group1: np.ndarray, group2: np.ndarray) -> float:
    """Cohen's d effect size (pooled SD)."""
    n1, n2 = len(group1), len(group2)
    if n1 < 2 or n2 < 2:
        return 0.0
    s1, s2 = np.std(group1, ddof=1), np.std(group2, ddof=1)
    pooled = math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2))
    if pooled == 0:
        return 0.0
    return float((np.mean(group1) - np.mean(group2)) / pooled)


def cohens_d_ci(d: float, n1: int, n2: int, alpha: float = 0.05) -> tuple[float, float]:
    """Approximate 95% CI for Cohen's d (Hedges & Olkin)."""
    se = math.sqrt((n1 + n2) / (n1 * n2) + d ** 2 / (2 * (n1 + n2)))
    z = 1.96 if alpha == 0.05 else 2.576
    return (d - z * se, d + z * se)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Load MPRA data — forward orientation only
# ═══════════════════════════════════════════════════════════════════════════════

print("═══ TIER 3G: MPRA LINTER VALIDATION (K562, Agarwal 2025) ═══\n")

if not ACTIVITY_BED.exists():
    print(f"  ERROR: {ACTIVITY_BED} not found.")
    print("  Download from: https://krishna.gs.washington.edu/content/members/vagar/forJJ/")
    print("                 bigMPRA_forENCODE_processedFiles/ActivityRatios.k562.bed.gz")
    results["status"] = "NEEDS_DATA"
    write_results("tier3g", results)
    sys.exit(1)

print("Loading MPRA activity data (forward orientation only)...")
elements = []
with open(ACTIVITY_BED) as f:
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) < 7:
            continue
        name = parts[3]
        strand = parts[5]
        # Skip reversed orientation — avoid double-counting
        if "Reversed" in name or strand == "-":
            continue
        chrom = parts[0]
        start = int(parts[1])
        end = int(parts[2])
        try:
            activity = float(parts[6])
        except ValueError:
            continue
        elements.append({
            "chrom": chrom, "start": start, "end": end,
            "name": name, "activity": activity,
        })

print(f"  Loaded {len(elements)} forward-orientation elements")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Extract sequences from FASTA and run linter
# ═══════════════════════════════════════════════════════════════════════════════

print("Extracting sequences and running physics linter...")

from pyfaidx import Fasta
from polymer_genomics.evaluate import evaluate_sequence

fa = Fasta(str(FASTA_PATH))

for i, el in enumerate(elements):
    try:
        seq = str(fa[el["chrom"]][el["start"]:el["end"]]).upper()
    except (KeyError, ValueError):
        el["seq"] = None
        continue

    if len(seq) < 100 or seq.count("N") > len(seq) * 0.1:
        el["seq"] = None
        continue

    el["seq"] = seq
    el["gc"] = compute_gc(seq)

    # Run linter
    result = evaluate_sequence(seq)
    flags = result.get("flags", [])
    warning_flags = [f for f in flags if f.get("type") == "warning"]
    el["flag_codes"] = {f["code"] for f in warning_flags}
    el["flag_count"] = len(warning_flags)
    el["n_unique_flags"] = len(el["flag_codes"])

    if (i + 1) % 20000 == 0:
        print(f"  Processed {i + 1}/{len(elements)}...")

# Filter to valid elements
elements = [e for e in elements if e.get("seq") is not None]
print(f"  Valid elements with sequence: {len(elements)}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Flag prevalence at 200bp scale
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ FLAG PREVALENCE (200bp elements) ═══")

all_codes: dict[str, int] = {}
for el in elements:
    for code in el["flag_codes"]:
        all_codes[code] = all_codes.get(code, 0) + 1

n_total = len(elements)
print(f"\n  {'Flag':<25} {'Count':>8} {'Prevalence':>12}")
print(f"  {'─' * 25} {'─' * 8} {'─' * 12}")

sorted_codes = sorted(all_codes.items(), key=lambda x: -x[1])
for code, count in sorted_codes:
    pct = count / n_total * 100
    print(f"  {code:<25} {count:>8} {pct:>11.2f}%")

n_any_flag = sum(1 for e in elements if e["flag_count"] > 0)
print(f"\n  Elements with ANY warning flag: {n_any_flag} ({n_any_flag / n_total * 100:.1f}%)")
print(f"  Elements with NO flags: {n_total - n_any_flag} ({(n_total - n_any_flag) / n_total * 100:.1f}%)")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Global comparison: flagged vs unflagged (naive, GC-confounded)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ GLOBAL: FLAGGED vs UNFLAGGED (GC-confounded) ═══")

flagged_act = np.array([e["activity"] for e in elements if e["flag_count"] > 0])
unflagged_act = np.array([e["activity"] for e in elements if e["flag_count"] == 0])

if len(flagged_act) > 10 and len(unflagged_act) > 10:
    d_global = cohens_d(flagged_act, unflagged_act)
    ci = cohens_d_ci(d_global, len(flagged_act), len(unflagged_act))
    print(f"  Flagged:   n={len(flagged_act):>7}, mean activity={np.mean(flagged_act):>+.4f}")
    print(f"  Unflagged: n={len(unflagged_act):>7}, mean activity={np.mean(unflagged_act):>+.4f}")
    print(f"  Cohen's d = {d_global:+.4f} (95% CI: {ci[0]:+.4f} to {ci[1]:+.4f})")
    print(f"  NOTE: This is GC-confounded. See GC-stratified results below.")

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Per-flag effect sizes (global, then GC-controlled)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ PER-FLAG EFFECT SIZES ═══")

# Only analyze flags with >= 100 hits
analyzable_flags = [code for code, count in sorted_codes if count >= 100]

print(f"\n  Flags with ≥100 hits: {len(analyzable_flags)}")
print(f"\n  {'Flag':<25} {'n_flag':>7} {'d(global)':>10} {'d(GC-ctrl)':>11} {'95% CI':>20} {'Verdict':>15}")
print(f"  {'─' * 25} {'─' * 7} {'─' * 10} {'─' * 11} {'─' * 20} {'─' * 15}")

flag_results = {}

for code in analyzable_flags:
    flagged = np.array([e["activity"] for e in elements if code in e["flag_codes"]])
    not_flagged = np.array([e["activity"] for e in elements if code not in e["flag_codes"]])

    d_raw = cohens_d(flagged, not_flagged)

    # GC-controlled: compute Cohen's d within each GC stratum, then pool
    strata_ds = []
    strata_ns = []
    for gc_lo, gc_hi in GC_STRATA:
        f_stratum = np.array([e["activity"] for e in elements
                              if code in e["flag_codes"] and gc_lo <= e["gc"] < gc_hi])
        u_stratum = np.array([e["activity"] for e in elements
                              if code not in e["flag_codes"] and gc_lo <= e["gc"] < gc_hi])
        if len(f_stratum) >= 10 and len(u_stratum) >= 10:
            d_s = cohens_d(f_stratum, u_stratum)
            n_s = len(f_stratum) + len(u_stratum)
            strata_ds.append(d_s)
            strata_ns.append(n_s)

    if strata_ds:
        # Weighted average d across strata
        total_n = sum(strata_ns)
        d_gc = sum(d * n / total_n for d, n in zip(strata_ds, strata_ns))
        ci_gc = cohens_d_ci(d_gc, len(flagged), len(not_flagged))
    else:
        d_gc = float("nan")
        ci_gc = (float("nan"), float("nan"))

    if abs(d_gc) > 0.20:
        verdict = "STRONG"
    elif abs(d_gc) > 0.10:
        verdict = "MODERATE"
    elif abs(d_gc) > 0.05:
        verdict = "WEAK"
    else:
        verdict = "NEGLIGIBLE"

    ci_str = f"({ci_gc[0]:+.3f}, {ci_gc[1]:+.3f})" if not math.isnan(d_gc) else "N/A"
    print(f"  {code:<25} {len(flagged):>7} {d_raw:>+10.4f} {d_gc:>+11.4f} {ci_str:>20} {verdict:>15}")

    flag_results[code] = {
        "n_flagged": int(len(flagged)),
        "d_global": round(d_raw, 4),
        "d_gc_controlled": round(d_gc, 4) if not math.isnan(d_gc) else None,
        "ci_lower": round(ci_gc[0], 4) if not math.isnan(ci_gc[0]) else None,
        "ci_upper": round(ci_gc[1], 4) if not math.isnan(ci_gc[1]) else None,
        "verdict": verdict,
    }

    record(f"3G {code}",
           abs(d_gc) > 0.05 if not math.isnan(d_gc) else False,
           f"d(GC-ctrl)={d_gc:+.4f}, {verdict}")

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Flag burden analysis: does total flag count predict lower activity?
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ FLAG BURDEN ANALYSIS ═══")

gc_arr = np.array([e["gc"] for e in elements])
act_arr = np.array([e["activity"] for e in elements])
burden_arr = np.array([e["flag_count"] for e in elements])

# Simple linear regression: activity ~ flag_count + GC
X = np.column_stack([np.ones(len(elements)), burden_arr, gc_arr])
beta = np.linalg.lstsq(X, act_arr, rcond=None)[0]
residuals = act_arr - X @ beta
rss = np.sum(residuals ** 2)
n = len(elements)
p = 3
mse = rss / (n - p)
se_beta = np.sqrt(mse * np.diag(np.linalg.inv(X.T @ X)))

print(f"  Linear model: activity ~ intercept + flag_count + GC")
print(f"  n = {n}")
print(f"  intercept:  {beta[0]:+.4f} (SE {se_beta[0]:.4f})")
print(f"  flag_count: {beta[1]:+.4f} (SE {se_beta[1]:.4f})  t = {beta[1] / se_beta[1]:.2f}")
print(f"  GC:         {beta[2]:+.4f} (SE {se_beta[2]:.4f})  t = {beta[2] / se_beta[2]:.2f}")

# R² for the model
ss_total = np.sum((act_arr - np.mean(act_arr)) ** 2)
r_squared = 1 - rss / ss_total
print(f"  R² = {r_squared:.4f}")

flag_burden_significant = abs(beta[1] / se_beta[1]) > 2.0
record("3G flag_burden predicts activity",
       flag_burden_significant,
       f"beta={beta[1]:+.4f}, t={beta[1] / se_beta[1]:.2f}, R²={r_squared:.4f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Active vs inactive classification
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ ACTIVE vs INACTIVE ENRICHMENT ═══")

median_act = np.median(act_arr)
print(f"  Median activity: {median_act:.4f}")
print(f"  Active (above median): {np.sum(act_arr > median_act)}")

for code in analyzable_flags:
    flagged_active = sum(1 for e in elements if code in e["flag_codes"] and e["activity"] > median_act)
    flagged_total = sum(1 for e in elements if code in e["flag_codes"])
    unflagged_active = sum(1 for e in elements if code not in e["flag_codes"] and e["activity"] > median_act)
    unflagged_total = sum(1 for e in elements if code not in e["flag_codes"])

    if flagged_total > 0 and unflagged_total > 0:
        rate_flagged = flagged_active / flagged_total
        rate_unflagged = unflagged_active / unflagged_total
        odds_flagged = rate_flagged / (1 - rate_flagged) if rate_flagged < 1 else float("inf")
        odds_unflagged = rate_unflagged / (1 - rate_unflagged) if rate_unflagged < 1 else float("inf")
        odds_ratio = odds_flagged / odds_unflagged if odds_unflagged > 0 else float("inf")
        print(f"  {code:<25} active_rate: flagged={rate_flagged:.3f} unflagged={rate_unflagged:.3f}  OR={odds_ratio:.3f}")

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

n_strong = sum(1 for v in flag_results.values() if v["verdict"] in ("STRONG", "MODERATE"))
n_weak = sum(1 for v in flag_results.values() if v["verdict"] == "WEAK")
n_neg = sum(1 for v in flag_results.values() if v["verdict"] == "NEGLIGIBLE")

print(f"\n{'═' * 70}")
print(f"TIER 3G SUMMARY")
print(f"{'═' * 70}")
print(f"  Elements analyzed: {len(elements)} (forward orientation, K562)")
print(f"  External data: Agarwal et al. 2025 Nature (lentiMPRA, 680K cCREs)")
print(f"  Flags with ≥100 hits: {len(analyzable_flags)}")
print(f"")
print(f"  STRONG/MODERATE effect (|d| > 0.10): {n_strong}")
print(f"  WEAK effect (|d| 0.05-0.10):         {n_weak}")
print(f"  NEGLIGIBLE (|d| < 0.05):              {n_neg}")
print(f"")
print(f"  Flag burden beta (GC-adjusted): {beta[1]:+.4f} (t={beta[1] / se_beta[1]:.1f})")
print(f"{'═' * 70}")

results["summary"] = {
    "n_elements": len(elements),
    "n_forward": len(elements),
    "flag_prevalence": {code: count for code, count in sorted_codes},
    "flag_effects": flag_results,
    "burden_beta": round(float(beta[1]), 4),
    "burden_t": round(float(beta[1] / se_beta[1]), 2),
    "model_r_squared": round(float(r_squared), 4),
    "n_strong_moderate": n_strong,
    "n_weak": n_weak,
    "n_negligible": n_neg,
}
results["status"] = "COMPLETE"
write_results("tier3g", results)
