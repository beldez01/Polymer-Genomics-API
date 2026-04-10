"""Step 04: Compute per-feature mean and std across all GEUVADIS alleles' positions.

Fits the normalizer on GEUVADIS feature tensors ONLY (no Bettens data leakage).
The resulting normalizer is applied to both GEUVADIS (training) and Bettens (test).

Output: pytorch_results/normalizer.json
"""
from __future__ import annotations

import csv
import json
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
    return allele.replace("*", "_").replace(":", "_")


def main() -> None:
    config.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    tensor_dir = config.CACHE_DIR / "tensors"

    # Get unique GEUVADIS alleles
    geuv_alleles: set[tuple[str, str]] = set()
    with open(config.CACHE_DIR / "geuvadis_rows.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            geuv_alleles.add((row["locus"], row["allele_2field"]))

    print(f"Fitting normalizer on {len(geuv_alleles)} GEUVADIS alleles")

    # Accumulate running sum and sum of squares per feature
    n_positions = 0
    sum_feat = np.zeros(config.N_POSITION_FEATURES, dtype=np.float64)
    sumsq_feat = np.zeros(config.N_POSITION_FEATURES, dtype=np.float64)

    for locus, allele_2f in sorted(geuv_alleles):
        path = tensor_dir / f"{locus}_{safe_filename(allele_2f)}.pt"
        if not path.exists():
            print(f"WARNING: missing tensor for {locus} {allele_2f}")
            continue
        data = torch.load(path, weights_only=False)
        features = data["features"].numpy().astype(np.float64)  # [L-1, 15]
        n_positions += features.shape[0]
        sum_feat += features.sum(axis=0)
        sumsq_feat += (features ** 2).sum(axis=0)

    mean = sum_feat / n_positions
    variance = (sumsq_feat / n_positions) - mean ** 2
    # Guard against negative variance from floating point
    variance = np.maximum(variance, 1e-12)
    std = np.sqrt(variance)

    normalizer = {
        "feature_names": config.FEATURE_NAMES,
        "mean": mean.tolist(),
        "std": std.tolist(),
        "n_positions": int(n_positions),
        "n_alleles": len(geuv_alleles),
    }

    out_path = config.RESULTS_DIR / "normalizer.json"
    with open(out_path, "w") as f:
        json.dump(normalizer, f, indent=2)

    print(f"Wrote normalizer to {out_path}")
    print(f"  n_positions: {n_positions}")
    print(f"  Feature means: {[f'{m:.3f}' for m in mean[:5]]}...")
    print(f"  Feature stds:  {[f'{s:.3f}' for s in std[:5]]}...")


if __name__ == "__main__":
    main()
