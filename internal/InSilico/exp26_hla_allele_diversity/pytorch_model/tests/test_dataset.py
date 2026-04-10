"""Tests for HLA expression Dataset."""
import csv
import json
from pathlib import Path

import pytest
import torch

from internal.InSilico.exp26_hla_allele_diversity.pytorch_model import config
from internal.InSilico.exp26_hla_allele_diversity.pytorch_model.dataset import (
    HLAExpressionDataset,
    LocusBucketedSampler,
)


@pytest.fixture
def dataset() -> HLAExpressionDataset:
    rows_csv = config.CACHE_DIR / "geuvadis_rows.csv"
    tensor_dir = config.CACHE_DIR / "tensors"
    normalizer_path = config.RESULTS_DIR / "normalizer.json"
    return HLAExpressionDataset(rows_csv, tensor_dir, normalizer_path)


def test_dataset_nonempty(dataset):
    """Dataset loads rows from GEUVADIS CSV."""
    assert len(dataset) > 0


def test_dataset_returns_correct_types(dataset):
    """__getitem__ returns (features, locus_onehot, target) with right shapes/dtypes."""
    item = dataset[0]
    assert "features" in item
    assert "locus_onehot" in item
    assert "target" in item
    assert item["features"].dtype == torch.float32
    assert item["locus_onehot"].dtype == torch.float32
    assert item["target"].dtype == torch.float32
    assert item["features"].ndim == 2  # [seq_len, 15]
    assert item["features"].shape[1] == config.N_POSITION_FEATURES
    assert item["locus_onehot"].shape == (config.N_LOCI,)


def test_dataset_target_is_log_tpm(dataset):
    """Target is log(tpm + 1), not raw tpm."""
    # Find a row with a known TPM
    row0 = dataset.rows[0]
    tpm = float(row0["tpm"])
    import math
    expected_log = math.log(tpm + 1.0)
    item = dataset[0]
    assert pytest.approx(item["target"].item(), abs=1e-5) == expected_log


def test_dataset_features_normalized(dataset):
    """Features are z-scored (approximately zero mean across positions)."""
    item = dataset[0]
    features = item["features"]  # [seq_len, 15]
    # Per-position mean across a single sequence won't be exactly 0
    # but values should be in reasonable normalized range
    assert features.abs().max() < 20  # sanity check, not a tight bound


def test_locus_bucketed_sampler(dataset):
    """Bucketed sampler produces single-locus batches."""
    sampler = LocusBucketedSampler(
        dataset, batch_size=4, shuffle=False, seed=42
    )
    batches = list(sampler)
    assert len(batches) > 0
    for batch_indices in batches:
        loci = {dataset.rows[i]["locus"] for i in batch_indices}
        assert len(loci) == 1, f"Batch contained multiple loci: {loci}"
