"""Step 02: Compute per-position biophysical feature tensors for each unique allele.

Reads:
- pytorch_model/cache/geuvadis_rows.csv (from step 01)
- pytorch_model/cache/bettens_rows.csv (from step 03, if it exists)
- IMGT FASTA files in data/imgt_hla/

Writes:
- pytorch_model/cache/tensors/{locus}_{allele_safe}.pt

For each unique 2-field allele, selects the first matching 4-field sequence from the
IMGT FASTA (canonical representative, same convention as Exp 26).
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

import numpy as np
import torch

from internal.InSilico.exp26_hla_allele_diversity.pytorch_model import config
from internal.InSilico.exp26_hla_allele_diversity.pytorch_model.features import (
    compute_per_position,
)


def safe_filename(allele: str) -> str:
    """Convert 'A*01:01' → 'A_01_01' for filesystem safety."""
    return allele.replace("*", "_").replace(":", "_")


def parse_fasta(path: Path) -> dict[str, str]:
    """Parse IMGT FASTA. Returns {full_allele_name: sequence}."""
    sequences: dict[str, str] = {}
    current_name: str | None = None
    current_seq: list[str] = []

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith(">"):
                if current_name is not None:
                    sequences[current_name] = "".join(current_seq)
                # Header: >HLA:HLA00001 A*01:01:01:01 3503 bp
                parts = line.split()
                current_name = parts[1] if len(parts) >= 2 else None
                current_seq = []
            else:
                current_seq.append(line)
        if current_name is not None:
            sequences[current_name] = "".join(current_seq)
    return sequences


def to_two_field(allele: str) -> str:
    """'A*01:01:01:01' → 'A*01:01'."""
    locus, rest = allele.split("*")
    parts = rest.split(":")
    return f"{locus}*{':'.join(parts[:2])}"


def select_canonical(all_alleles: dict[str, str], target_2f: str) -> tuple[str, str] | None:
    """Given a 2-field target like 'A*01:01', return (canonical_full_name, sequence).

    Canonical = first matching 4-field allele in sorted order (deterministic).
    Returns None if no match.
    """
    matches = [
        (name, seq) for name, seq in all_alleles.items() if to_two_field(name) == target_2f
    ]
    if not matches:
        return None
    matches.sort(key=lambda x: x[0])
    return matches[0]


def load_imgt_by_locus() -> dict[str, dict[str, str]]:
    """Load all IMGT FASTA files, keyed by locus letter."""
    locus_to_seqs: dict[str, dict[str, str]] = {}
    for locus in config.LOCI:
        fasta_path = config.IMGT_DIR / f"{locus}_gen.fasta"
        if not fasta_path.exists():
            print(f"WARNING: {fasta_path} not found, skipping locus {locus}")
            continue
        locus_to_seqs[locus] = parse_fasta(fasta_path)
        print(f"Loaded {len(locus_to_seqs[locus])} alleles for HLA-{locus}")
    return locus_to_seqs


def collect_unique_alleles(rows_csv: Path) -> set[tuple[str, str]]:
    """Return set of (locus, allele_2field) tuples from a rows CSV."""
    unique: set[tuple[str, str]] = set()
    with open(rows_csv) as f:
        reader = csv.DictReader(f)
        for row in reader:
            unique.add((row["locus"], row["allele_2field"]))
    return unique


def main() -> None:
    tensor_dir = config.CACHE_DIR / "tensors"
    tensor_dir.mkdir(parents=True, exist_ok=True)

    # Load IMGT sequences
    locus_to_seqs = load_imgt_by_locus()

    # Collect unique alleles from GEUVADIS and (optionally) Bettens
    unique_alleles: set[tuple[str, str]] = set()
    geuv_rows = config.CACHE_DIR / "geuvadis_rows.csv"
    if geuv_rows.exists():
        unique_alleles |= collect_unique_alleles(geuv_rows)
        print(f"After GEUVADIS: {len(unique_alleles)} unique alleles")
    bett_rows = config.CACHE_DIR / "bettens_rows.csv"
    if bett_rows.exists():
        unique_alleles |= collect_unique_alleles(bett_rows)
        print(f"After Bettens:  {len(unique_alleles)} unique alleles")

    # Compute and cache
    computed = 0
    skipped = 0
    missing: list[tuple[str, str]] = []
    for locus, allele_2f in sorted(unique_alleles):
        out_path = tensor_dir / f"{locus}_{safe_filename(allele_2f)}.pt"
        if out_path.exists():
            skipped += 1
            continue

        locus_seqs = locus_to_seqs.get(locus, {})
        match = select_canonical(locus_seqs, allele_2f)
        if match is None:
            missing.append((locus, allele_2f))
            continue

        canonical_name, seq = match
        features = compute_per_position(seq)  # [L-1, 15]
        tensor = torch.from_numpy(features)  # float32
        torch.save(
            {
                "features": tensor,
                "allele_2field": allele_2f,
                "canonical_4field": canonical_name,
                "sequence_length": len(seq),
                "locus": locus,
            },
            out_path,
        )
        computed += 1

    print(f"Computed {computed} new tensors, skipped {skipped} existing")
    if missing:
        print(f"MISSING ({len(missing)}): {missing[:10]}{'...' if len(missing) > 10 else ''}")


if __name__ == "__main__":
    main()
