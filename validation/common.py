"""Shared utilities for the validation suite."""

from __future__ import annotations

import json
import os
import random
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FASTA_PATH = PROJECT_ROOT / "data" / "hg38.fa"
RESULTS_DIR = PROJECT_ROOT / "validation" / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# Standard GC strata used across all Tier 3 tests
GC_STRATA = [(0.30, 0.35), (0.35, 0.40), (0.40, 0.45),
             (0.45, 0.50), (0.50, 0.55), (0.55, 0.60)]

# Autosome chromosome names and approximate sizes (hg38)
AUTOSOMES = {
    "chr1": 248956422, "chr2": 242193529, "chr3": 198295559,
    "chr4": 190214555, "chr5": 181538259, "chr6": 170805979,
    "chr7": 159345973, "chr8": 145138636, "chr9": 138394717,
    "chr10": 133797422, "chr11": 135086622, "chr12": 133275309,
    "chr13": 114364328, "chr14": 107043718, "chr15": 101991189,
    "chr16": 90338345, "chr17": 83257441, "chr18": 80373285,
    "chr19": 58617616, "chr20": 64444167, "chr21": 46709983,
    "chr22": 50818468,
}


def get_fasta():
    """Return an opened pyfaidx.Fasta handle (cached)."""
    from pyfaidx import Fasta
    return Fasta(str(FASTA_PATH))


def sample_random_regions(n: int, window: int = 1000, seed: int = 42) -> list[tuple[str, int, int]]:
    """Sample n random (chrom, start, end) regions from autosomes, avoiding N-gaps."""
    rng = random.Random(seed)
    fa = get_fasta()
    regions = []
    attempts = 0
    max_attempts = n * 5
    chroms = list(AUTOSOMES.keys())

    while len(regions) < n and attempts < max_attempts:
        chrom = rng.choice(chroms)
        chrom_len = AUTOSOMES[chrom]
        start = rng.randint(1_000_000, chrom_len - window - 1_000_000)
        end = start + window
        seq = str(fa[chrom][start:end]).upper()
        n_count = seq.count("N")
        if n_count < window * 0.05:  # <5% N's
            regions.append((chrom, start, end))
        attempts += 1

    return regions


def compute_gc(seq: str) -> float:
    """Compute GC fraction from sequence string."""
    seq = seq.upper()
    gc = sum(1 for c in seq if c in "GC")
    total = sum(1 for c in seq if c in "ACGT")
    return gc / total if total > 0 else 0.0


def compute_mean_stacking_dg(seq: str) -> float:
    """Compute mean stacking ΔG₃₇ (kcal/mol/step) using SantaLucia 1998."""
    from polymer_genomics.biophysics import compute_thermodynamics
    result = compute_thermodynamics(seq.upper(), salt_mm=1000.0)
    summary = result["summary"]
    return summary.get("mean_delta_g_per_step", float("nan"))


def write_results(tier: str, results: dict):
    """Write results to JSON file and print summary."""
    out_path = RESULTS_DIR / f"{tier}_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults written to {out_path}")


def print_test(name: str, passed: bool, detail: str = ""):
    """Print a formatted test result line."""
    status = "PASS" if passed else "FAIL"
    marker = "\033[32m" if passed else "\033[31m"
    reset = "\033[0m"
    line = f"  [{marker}{status}{reset}] {name}"
    if detail:
        line += f" -- {detail}"
    print(line)
    return passed
