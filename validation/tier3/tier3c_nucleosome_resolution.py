#!/usr/bin/env python3
"""Tier 3C: Nucleosome Positioning at Multiple Resolutions.

Tests whether biophysical predictions improve at finer resolution (147bp, 200bp,
500bp, 1000bp). Phase 1 showed periodicity has no signal at 1kb. This tests
whether curvature, deformability, or other properties become predictive at
nucleosome-scale resolution where phase coherence is preserved.

External data: GM12878 MNase-seq fold-change BigWig.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier3/tier3c_nucleosome_resolution.py
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT))

from validation.common import AUTOSOMES, compute_gc, get_fasta, print_test, write_results
from polymer_genomics.biophysics import (
    _NN_PARAMS,
    _OLSON_STRUCTURAL,
    _TRX_DEFORMABILITY,
)

import pyBigWig

MNASE_BW = Path("/Users/zbb2/Desktop/Polymer_Evolution/material_channel_validation"
                "/exp03_nucleosome_prediction/reference_data/GM12878_MNase_fc.bw")

RESOLUTIONS = [147, 200, 500, 1000]
N_REGIONS = 20_000  # per resolution

passed = 0
failed = 0
results = {"tier": "3C", "name": "Nucleosome Multi-Resolution", "tests": []}


def record(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
    print_test(name, ok, detail)
    results["tests"].append({"name": name, "passed": ok, "detail": detail})


def compute_props(seq: str) -> dict | None:
    seq = seq.upper()
    n = len(seq)
    if n < 2:
        return None

    gc = compute_gc(seq)
    dg_vals, roll_vals, tilt_vals, twist_vals = [], [], [], []
    deform_vals = []

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
        trx = _TRX_DEFORMABILITY.get(dinuc)
        if trx is not None:
            deform_vals.append(float(trx))

    if not dg_vals:
        return None

    def mean(v):
        return sum(v) / len(v) if v else float("nan")

    def std(v):
        if len(v) < 2:
            return 0.0
        m = mean(v)
        return math.sqrt(sum((x - m) ** 2 for x in v) / (len(v) - 1))

    # Periodicity: 10.5bp AA/TT signal via FFT
    aa_signal = np.zeros(n - 1)
    for i in range(n - 1):
        dinuc = seq[i:i + 2]
        if dinuc in ("AA", "TT", "AT", "TA"):
            aa_signal[i] = 1.0

    period_power = 0.0
    if len(aa_signal) >= 32:
        fft = np.fft.rfft(aa_signal - aa_signal.mean())
        freqs = np.fft.rfftfreq(len(aa_signal))
        target_freq = 1.0 / 10.5
        idx = np.argmin(np.abs(freqs - target_freq))
        power = np.abs(fft) ** 2
        period_power = float(power[idx] / power.sum()) if power.sum() > 0 else 0.0

    # Curvature (angular variability)
    roll_arr = np.array(roll_vals) if roll_vals else np.zeros(1)
    tilt_arr = np.array(tilt_vals) if tilt_vals else np.zeros(1)
    if len(roll_arr) > 1:
        curv = float(np.sqrt(np.mean(roll_arr ** 2) + np.mean(tilt_arr ** 2)))
    else:
        curv = 0.0

    return {
        "gc": gc,
        "mean_dg37": mean(dg_vals),
        "std_dg37": std(dg_vals),
        "mean_roll": mean(roll_vals),
        "mean_twist": mean(twist_vals),
        "mean_deformability": mean(deform_vals),
        "curvature": curv,
        "periodicity_power": period_power,
    }


def sample_regions(n: int, window: int, seed: int = 42) -> list[tuple[str, int, int]]:
    rng = random.Random(seed)
    fa = get_fasta()
    regions = []
    chroms = list(AUTOSOMES.keys())
    attempts = 0
    while len(regions) < n and attempts < n * 5:
        chrom = rng.choice(chroms)
        chrom_len = AUTOSOMES[chrom]
        start = rng.randint(1_000_000, chrom_len - window - 1_000_000)
        end = start + window
        seq = str(fa[chrom][start:end]).upper()
        if seq.count("N") < window * 0.05:
            regions.append((chrom, start, end))
        attempts += 1
    return regions


# ═══════════════════════════════════════════════════════════════════════════════
# Run at each resolution
# ═══════════════════════════════════════════════════════════════════════════════

if not MNASE_BW.exists():
    print(f"ERROR: MNase BigWig not found at {MNASE_BW}")
    sys.exit(1)

bw = pyBigWig.open(str(MNASE_BW))
fa = get_fasta()

resolution_results = {}

for window in RESOLUTIONS:
    print(f"\n═══ RESOLUTION: {window}bp ═══")

    regions = sample_regions(N_REGIONS, window, seed=42 + window)
    print(f"  Sampled {len(regions)} regions")

    data = []
    for chrom, start, end in regions:
        seq = str(fa[chrom][start:end]).upper()
        props = compute_props(seq)
        if props is None:
            continue

        try:
            raw_vals = bw.values(chrom, start, end)
            if raw_vals is None:
                continue
            arr = np.array(raw_vals, dtype=float)
            if np.all(np.isnan(arr)):
                continue
            mnase_signal = float(np.nanmean(arr))
        except Exception:
            continue

        props["mnase"] = mnase_signal
        data.append(props)

    print(f"  Valid regions: {len(data)}")
    if len(data) < 500:
        print("  Too few regions, skipping")
        continue

    prop_names = [k for k in data[0].keys() if k not in ("gc", "mnase")]
    gc_arr = np.array([d["gc"] for d in data])
    mnase_arr = np.array([d["mnase"] for d in data])
    mnase_log = np.log1p(np.clip(mnase_arr, 0, None))

    r_gc = np.corrcoef(gc_arr, mnase_log)[0, 1]
    print(f"  r(GC, log(MNase)): {r_gc:.4f}")

    res_data = {"window": window, "n": len(data), "r_gc_mnase": round(float(r_gc), 4)}
    prop_results = {}

    print(f"  {'Property':<22} {'r(MNase)':>10} {'partial_r|GC':>12}")
    print(f"  {'─' * 22} {'─' * 10} {'─' * 12}")

    for name in prop_names:
        vals = np.array([d[name] for d in data])
        r_raw = np.corrcoef(vals, mnase_log)[0, 1]

        n_s = len(data)
        A = np.column_stack([np.ones(n_s), gc_arr])
        beta_p = np.linalg.lstsq(A, vals, rcond=None)[0]
        beta_m = np.linalg.lstsq(A, mnase_log, rcond=None)[0]
        resid_p = vals - A @ beta_p
        resid_m = mnase_log - A @ beta_m
        partial_r = float(np.corrcoef(resid_p, resid_m)[0, 1]) if np.std(resid_p) > 0 and np.std(resid_m) > 0 else 0.0

        prop_results[name] = {
            "r_raw": round(float(r_raw), 4),
            "partial_r": round(float(partial_r), 4),
        }
        marker = " ***" if abs(partial_r) > 0.05 else ""
        print(f"  {name:<22} {r_raw:>10.4f} {partial_r:>12.4f}{marker}")

    res_data["properties"] = prop_results
    resolution_results[str(window)] = res_data

bw.close()

# ═══════════════════════════════════════════════════════════════════════════════
# Resolution gradient analysis
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ RESOLUTION GRADIENT ═══")
print("  Does prediction improve at finer resolution?")

key_props = ["periodicity_power", "curvature", "mean_dg37", "std_dg37", "mean_deformability", "mean_roll"]

print(f"\n  {'Property':<22}", end="")
for w in RESOLUTIONS:
    print(f" {w:>8}bp", end="")
print()
print(f"  {'─' * 22}", end="")
for _ in RESOLUTIONS:
    print(f" {'─' * 10}", end="")
print()

for prop in key_props:
    print(f"  {prop:<22}", end="")
    values = []
    for w in RESOLUTIONS:
        ws = str(w)
        if ws in resolution_results and prop in resolution_results[ws]["properties"]:
            pr = resolution_results[ws]["properties"][prop]["partial_r"]
            values.append(pr)
            print(f" {pr:>10.4f}", end="")
        else:
            values.append(None)
            print(f" {'N/A':>10}", end="")
    print()

    # Check for improvement at finer resolution
    valid = [(RESOLUTIONS[i], v) for i, v in enumerate(values) if v is not None]
    if len(valid) >= 2:
        finest_r = abs(valid[0][1])
        coarsest_r = abs(valid[-1][1])
        improves = finest_r > coarsest_r
        record(f"3C {prop} resolution gradient",
               True,  # informational
               f"|partial_r| at {valid[0][0]}bp={finest_r:.4f}, {valid[-1][0]}bp={coarsest_r:.4f}, improves={improves}")

print(f"\n{'═' * 70}")
print(f"TIER 3C SUMMARY")
print(f"{'═' * 70}")

results["resolution_results"] = resolution_results
results["summary"] = {"resolutions_tested": RESOLUTIONS, "n_per_resolution": N_REGIONS}
write_results("tier3c", results)
