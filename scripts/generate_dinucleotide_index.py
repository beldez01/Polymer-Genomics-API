#!/usr/bin/env python3
"""Generate genome-wide dinucleotide index files (uint8 numpy arrays).

Output: data/dinucleotide_index/{chr}.npy
Total size: ~3.1 GB (1 byte per dinucleotide step)

Usage: uv run python scripts/generate_dinucleotide_index.py
"""
import os
import sys
import time
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from polymer_genomics.dinucleotide_index import generate_chromosome_index

FASTA_PATH = "data/hg38.fa"
OUTPUT_DIR = "data/dinucleotide_index"
CHROMOSOMES = [f"chr{i}" for i in range(1, 23)] + ["chrX", "chrY"]


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating dinucleotide index -> {OUTPUT_DIR}/", flush=True)

    total = 0
    t0 = time.time()
    for chr_name in CHROMOSOMES:
        t1 = time.time()
        idx = generate_chromosome_index(FASTA_PATH, chr_name)
        out_path = os.path.join(OUTPUT_DIR, f"{chr_name}.npy")
        np.save(out_path, idx)
        size_mb = os.path.getsize(out_path) / 1e6
        total += len(idx)
        print(f"  {chr_name}: {len(idx):,} steps, {size_mb:.1f} MB, {time.time()-t1:.1f}s", flush=True)

    elapsed = time.time() - t0
    total_gb = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR, f))
        for f in os.listdir(OUTPUT_DIR) if f.endswith(".npy")
    ) / 1e9
    print(f"\nDone: {total:,} steps, {total_gb:.2f} GB, {elapsed/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
