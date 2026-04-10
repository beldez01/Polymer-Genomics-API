"""PyTorch Dataset and sampler for HLA expression prediction."""
from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset, Sampler

from . import config


def safe_filename(allele: str) -> str:
    return allele.replace("*", "_").replace(":", "_")


class HLAExpressionDataset(Dataset):
    """Per-subject-allele HLA expression prediction dataset.

    Each item is one (subject, allele) observation:
        features: [seq_len, 15] z-normalized biophysical features
        locus_onehot: [6] one-hot encoding of locus
        target: scalar log(tpm + 1)
    """

    def __init__(
        self,
        rows_csv: Path,
        tensor_dir: Path,
        normalizer_path: Path,
    ) -> None:
        self.rows_csv = Path(rows_csv)
        self.tensor_dir = Path(tensor_dir)

        with open(normalizer_path) as f:
            norm = json.load(f)
        self.mean = np.asarray(norm["mean"], dtype=np.float32)
        self.std = np.asarray(norm["std"], dtype=np.float32)

        self.rows: list[dict] = []
        with open(self.rows_csv) as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Only keep rows whose tensor exists on disk
                path = self.tensor_dir / f"{row['locus']}_{safe_filename(row['allele_2field'])}.pt"
                if path.exists():
                    self.rows.append(row)

        # Cache loaded tensors in memory (~180 alleles × ~15kb each = manageable)
        self._tensor_cache: dict[tuple[str, str], torch.Tensor] = {}

    def __len__(self) -> int:
        return len(self.rows)

    def _load_features(self, locus: str, allele_2f: str) -> torch.Tensor:
        key = (locus, allele_2f)
        if key not in self._tensor_cache:
            path = self.tensor_dir / f"{locus}_{safe_filename(allele_2f)}.pt"
            data = torch.load(path, weights_only=False)
            raw = data["features"].numpy()  # [L-1, 15]
            normalized = (raw - self.mean) / self.std
            self._tensor_cache[key] = torch.from_numpy(normalized.astype(np.float32))
        return self._tensor_cache[key]

    def __getitem__(self, idx: int) -> dict:
        row = self.rows[idx]
        locus = row["locus"]
        features = self._load_features(locus, row["allele_2field"])

        locus_onehot = torch.zeros(config.N_LOCI, dtype=torch.float32)
        locus_onehot[config.LOCUS_TO_IDX[locus]] = 1.0

        tpm = float(row["tpm"])
        target = torch.tensor(math.log(tpm + 1.0), dtype=torch.float32)

        return {
            "features": features,
            "locus_onehot": locus_onehot,
            "target": target,
        }


class LocusBucketedSampler(Sampler[list[int]]):
    """Batch sampler that groups rows by locus so each batch is single-locus.

    This ensures all sequences in a batch have identical length (avoids padding
    complexity). Shuffles within each locus bucket if shuffle=True.
    """

    def __init__(
        self,
        dataset: HLAExpressionDataset,
        batch_size: int,
        shuffle: bool = True,
        seed: int = 42,
    ) -> None:
        self.dataset = dataset
        self.batch_size = batch_size
        self.shuffle = shuffle
        self.seed = seed
        self.epoch = 0

    def __iter__(self):
        # Group indices by (locus, allele_2field) so all items in a batch
        # share the exact same sequence length (canonical sequence per allele).
        buckets: dict[tuple[str, str], list[int]] = {}
        for i, row in enumerate(self.dataset.rows):
            key = (row["locus"], row["allele_2field"])
            buckets.setdefault(key, []).append(i)

        rng = np.random.default_rng(self.seed + self.epoch)
        bucket_keys = list(buckets.keys())
        if self.shuffle:
            rng.shuffle(bucket_keys)

        all_batches: list[list[int]] = []
        for key in bucket_keys:
            indices = buckets[key]
            if self.shuffle:
                rng.shuffle(indices)
            for start in range(0, len(indices), self.batch_size):
                batch = indices[start : start + self.batch_size]
                if batch:
                    all_batches.append(batch)

        if self.shuffle:
            rng.shuffle(all_batches)

        self.epoch += 1
        return iter(all_batches)

    def __len__(self) -> int:
        total = 0
        buckets: dict[tuple[str, str], int] = {}
        for row in self.dataset.rows:
            key = (row["locus"], row["allele_2field"])
            buckets[key] = buckets.get(key, 0) + 1
        for count in buckets.values():
            total += (count + self.batch_size - 1) // self.batch_size
        return total


def collate_batch(batch: list[dict]) -> dict:
    """Stack a list of items into tensors. All features must have same seq_len."""
    features = torch.stack([b["features"] for b in batch])  # [B, seq_len, 15]
    # Transpose to [B, 15, seq_len] for Conv1D
    features = features.transpose(1, 2)
    locus_onehot = torch.stack([b["locus_onehot"] for b in batch])  # [B, 6]
    target = torch.stack([b["target"] for b in batch])  # [B]
    return {
        "features": features,
        "locus_onehot": locus_onehot,
        "target": target,
    }
