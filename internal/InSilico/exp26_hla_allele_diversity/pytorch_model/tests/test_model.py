"""Tests for HLAExpressionCNN forward pass."""
import pytest
import torch

from internal.InSilico.exp26_hla_allele_diversity.pytorch_model import config
from internal.InSilico.exp26_hla_allele_diversity.pytorch_model.model import (
    HLAExpressionCNN,
)


def test_model_forward_small():
    """Forward pass on a 32-sample batch of length 1000."""
    model = HLAExpressionCNN()
    model.eval()
    x = torch.randn(32, config.N_POSITION_FEATURES, 1000)
    locus = torch.zeros(32, config.N_LOCI)
    locus[:, 0] = 1.0
    with torch.no_grad():
        out = model(x, locus)
    assert out.shape == (32,)
    assert out.dtype == torch.float32


def test_model_forward_different_lengths():
    """Model handles different sequence lengths (one batch at a time)."""
    model = HLAExpressionCNN()
    model.eval()
    for seq_len in [500, 3200, 13000]:
        x = torch.randn(4, config.N_POSITION_FEATURES, seq_len)
        locus = torch.zeros(4, config.N_LOCI)
        locus[:, 3] = 1.0  # HLA-DRB1
        with torch.no_grad():
            out = model(x, locus)
        assert out.shape == (4,), f"Failed at seq_len={seq_len}"


def test_model_backward_pass():
    """Gradients flow through the full model."""
    model = HLAExpressionCNN()
    model.train()
    x = torch.randn(8, config.N_POSITION_FEATURES, 500)
    locus = torch.zeros(8, config.N_LOCI)
    locus[:, 0] = 1.0
    target = torch.randn(8)
    out = model(x, locus)
    loss = torch.nn.functional.mse_loss(out, target)
    loss.backward()
    # Check that first conv layer has gradients
    assert model.conv1.weight.grad is not None
    assert model.conv1.weight.grad.abs().sum() > 0


def test_model_parameter_count():
    """Model has a reasonable number of parameters (~100K, not millions)."""
    model = HLAExpressionCNN()
    n_params = sum(p.numel() for p in model.parameters())
    # Expect ~50K-200K parameters with the specified architecture
    assert 20_000 < n_params < 300_000, f"Unexpected parameter count: {n_params}"
