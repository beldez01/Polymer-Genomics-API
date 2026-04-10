"""HLA expression prediction 1D CNN."""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from . import config


class HLAExpressionCNN(nn.Module):
    """1D CNN predicting log(TPM) from per-position biophysical features.

    Input:
        features: [batch, n_position_features=15, seq_len]
        locus_onehot: [batch, n_loci=6]
    Output:
        predicted log(TPM + 1): [batch]
    """

    def __init__(
        self,
        n_position_features: int = config.N_POSITION_FEATURES,
        n_loci: int = config.N_LOCI,
        dropout: float = config.DROPOUT,
    ) -> None:
        super().__init__()

        self.conv1 = nn.Conv1d(
            n_position_features,
            config.CONV1_OUT,
            kernel_size=config.CONV_KERNEL_LARGE,
            padding=config.CONV_KERNEL_LARGE // 2,
        )
        self.bn1 = nn.BatchNorm1d(config.CONV1_OUT)

        self.conv2 = nn.Conv1d(
            config.CONV1_OUT,
            config.CONV2_OUT,
            kernel_size=config.CONV_KERNEL_LARGE,
            padding=config.CONV_KERNEL_LARGE // 2,
        )
        self.bn2 = nn.BatchNorm1d(config.CONV2_OUT)

        self.pool1 = nn.MaxPool1d(config.MAX_POOL)

        self.conv3 = nn.Conv1d(
            config.CONV2_OUT,
            config.CONV3_OUT,
            kernel_size=config.CONV_KERNEL_SMALL,
            padding=config.CONV_KERNEL_SMALL // 2,
        )
        self.bn3 = nn.BatchNorm1d(config.CONV3_OUT)

        self.conv4 = nn.Conv1d(
            config.CONV3_OUT,
            config.CONV4_OUT,
            kernel_size=config.CONV_KERNEL_SMALL,
            padding=config.CONV_KERNEL_SMALL // 2,
        )
        self.bn4 = nn.BatchNorm1d(config.CONV4_OUT)

        self.global_pool = nn.AdaptiveAvgPool1d(1)

        self.fc1 = nn.Linear(config.CONV4_OUT + n_loci, config.FC_HIDDEN)
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(config.FC_HIDDEN, 1)

    def forward(
        self, features: torch.Tensor, locus_onehot: torch.Tensor
    ) -> torch.Tensor:
        # features: [B, 15, seq_len]
        h = F.relu(self.bn1(self.conv1(features)))
        h = F.relu(self.bn2(self.conv2(h)))
        h = self.pool1(h)
        h = F.relu(self.bn3(self.conv3(h)))
        h = F.relu(self.bn4(self.conv4(h)))
        h = self.global_pool(h).squeeze(-1)  # [B, 128]
        h = torch.cat([h, locus_onehot], dim=1)  # [B, 134]
        h = F.relu(self.fc1(h))
        h = self.dropout(h)
        out = self.fc2(h)  # [B, 1]
        return out.squeeze(-1)
