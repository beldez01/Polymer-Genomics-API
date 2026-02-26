"""Ingestion framework for bulk-loading genomic data into Polymer Genomics."""

from polymer_genomics.ingest.loader import batch_load, compute_content_hash, update_layer_stats
from polymer_genomics.ingest.partitions import ensure_partitions

__all__ = [
    "batch_load",
    "compute_content_hash",
    "ensure_partitions",
    "update_layer_stats",
]
