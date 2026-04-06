#!/usr/bin/env python3
"""Tier 2: Pipeline Consistency — does the computation produce deterministic results?

Verifies that the biophysics computation is deterministic, handles edge cases
correctly, and would produce consistent values across runs. Uses FASTA directly.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python validation/tier2_pipeline_consistency.py
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
    AUTOSOMES,
    compute_gc,
    compute_mean_stacking_dg,
    get_fasta,
    print_test,
    sample_random_regions,
    write_results,
)
from polymer_genomics.biophysics import compute_thermodynamics

passed = 0
failed = 0
results = {"tier": "2", "name": "Pipeline Consistency", "tests": []}


def record(name: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
    print_test(name, ok, detail)
    results["tests"].append({"name": name, "passed": ok, "detail": detail})


fa = get_fasta()

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.1: Deterministic GC computation (1000 random regions)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.1: GC Determinism (1000 regions) ═══")

regions = sample_random_regions(1000, window=1000, seed=99)
max_gc_diff = 0.0
n_gc_fail = 0

for chrom, start, end in regions:
    seq = str(fa[chrom][start:end]).upper()
    gc1 = compute_gc(seq)
    gc2 = compute_gc(seq)  # Same input → same output
    diff = abs(gc1 - gc2)
    max_gc_diff = max(max_gc_diff, diff)
    if diff > 0.0:
        n_gc_fail += 1

record("2.1 GC deterministic (1000 regions)", n_gc_fail == 0,
       f"max diff={max_gc_diff}, failures={n_gc_fail}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.2: Deterministic ΔG computation (500 regions)
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.2: ΔG Determinism (500 regions) ═══")

max_dg_diff = 0.0
n_dg_fail = 0

for chrom, start, end in regions[:500]:
    seq = str(fa[chrom][start:end]).upper()
    r1 = compute_thermodynamics(seq, salt_mm=1000.0)
    r2 = compute_thermodynamics(seq, salt_mm=1000.0)
    dg1 = r1["summary"]["total_delta_g_37"]
    dg2 = r2["summary"]["total_delta_g_37"]
    diff = abs(dg1 - dg2)
    max_dg_diff = max(max_dg_diff, diff)
    if diff > 0.0:
        n_dg_fail += 1

record("2.2 ΔG deterministic (500 regions)", n_dg_fail == 0,
       f"max diff={max_dg_diff}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.3: GC range sanity (all values in [0, 1])
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.3: GC Range Sanity ═══")

n_out_of_range = 0
gc_min, gc_max = 1.0, 0.0

for chrom, start, end in regions:
    seq = str(fa[chrom][start:end]).upper()
    gc = compute_gc(seq)
    gc_min = min(gc_min, gc)
    gc_max = max(gc_max, gc)
    if gc < 0.0 or gc > 1.0:
        n_out_of_range += 1

record("2.3 GC in [0,1]", n_out_of_range == 0,
       f"range [{gc_min:.4f}, {gc_max:.4f}]")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.4: N-handling — regions with N's should degrade gracefully
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.4: N-Handling ═══")

# Test with known N-containing sequence
test_n_seq = "ACGTNNNNACGT"
r_n = compute_thermodynamics(test_n_seq, salt_mm=1000.0)
n_steps = r_n["summary"]["n_steps"]
# Should skip the N-containing dinucleotides (AN, NN, NA) and still compute
record("2.4a N-skip in thermodynamics",
       n_steps > 0 and n_steps < len(test_n_seq) - 1,
       f"steps={n_steps} (expected 6 valid out of 11 total)")

# Pure N sequence
pure_n = "NNNNNNNNNN"
r_pure_n = compute_thermodynamics(pure_n, salt_mm=1000.0)
record("2.4b Pure-N returns empty",
       r_pure_n["summary"]["n_steps"] == 0,
       f"steps={r_pure_n['summary']['n_steps']}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.5: Boundary regions — chromosome starts and ends
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.5: Chromosome Boundary Regions ═══")

boundary_ok = 0
boundary_fail = 0

for chrom, chrom_len in list(AUTOSOMES.items())[:5]:
    # Start of chromosome
    for start in [0, 1000, 10000]:
        seq = str(fa[chrom][start:start + 1000]).upper()
        gc = compute_gc(seq)
        if 0.0 <= gc <= 1.0:
            boundary_ok += 1
        else:
            boundary_fail += 1

    # End of chromosome (close to the end)
    for offset in [10000, 50000]:
        start = chrom_len - offset
        seq = str(fa[chrom][start:start + 1000]).upper()
        gc = compute_gc(seq)
        if 0.0 <= gc <= 1.0:
            boundary_ok += 1
        else:
            boundary_fail += 1

record("2.5 Boundary regions computable",
       boundary_fail == 0,
       f"{boundary_ok} OK, {boundary_fail} failed")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.6: Cross-chromosome consistency
# Same GC sequence should give same ΔG regardless of which chromosome it's on
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.6: Cross-chromosome Consistency ═══")

# Use a fixed synthetic sequence
synthetic = "ACGTACGTACGTACGTACGT" * 50  # 1000bp
r_synth = compute_thermodynamics(synthetic, salt_mm=1000.0)
synth_dg = r_synth["summary"]["total_delta_g_37"]

# Same sequence should give identical result every time
r_synth2 = compute_thermodynamics(synthetic, salt_mm=1000.0)
synth_dg2 = r_synth2["summary"]["total_delta_g_37"]

record("2.6 Synthetic seq deterministic",
       abs(synth_dg - synth_dg2) < 0.001,
       f"ΔG₁={synth_dg:.4f}, ΔG₂={synth_dg2:.4f}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2.7: Large-scale GC distribution matches known genome composition
# ═══════════════════════════════════════════════════════════════════════════════

print("\n═══ TEST 2.7: Genome-wide GC Distribution ═══")

gc_values = []
for chrom, start, end in regions:
    seq = str(fa[chrom][start:end]).upper()
    gc_values.append(compute_gc(seq))

gc_arr = np.array(gc_values)
gc_mean = np.mean(gc_arr)
gc_std = np.std(gc_arr)

# Human genome: ~40.9% GC (Lander et al. 2001)
record("2.7a Genome mean GC ≈ 0.41",
       0.38 < gc_mean < 0.44,
       f"mean GC={gc_mean:.4f} (expected ~0.41)")

# GC should have reasonable variance (isochore structure)
record("2.7b GC has isochore variation",
       0.05 < gc_std < 0.12,
       f"std GC={gc_std:.4f}")


# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print(f"\n{'═' * 70}")
print(f"TIER 2 SUMMARY: {passed} passed, {failed} failed")
print(f"{'═' * 70}")

results["summary"] = {"passed": passed, "failed": failed}
write_results("tier2", results)
sys.exit(0 if failed == 0 else 1)
