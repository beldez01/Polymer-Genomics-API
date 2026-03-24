"""Hematopoietic WGBS methylation ingestion from Loyfer et al. 2023.

Downloads processed CpG-level BED files from GEO GSE186458 and aggregates
to 1kb windows for 12 sorted hematopoietic cell types.

Requires: asyncpg, requests

Usage::

    uv run python -m polymer_genomics.ingest.wgbs_hematopoietic
    uv run python -m polymer_genomics.ingest.wgbs_hematopoietic --data-dir /path/to/beds
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 50_000
WINDOW_SIZE = 1000

# Cell type columns in the order they appear in the database
CELL_TYPES = [
    "hsc", "cmp", "gmp", "monocyte", "neutrophil", "eosinophil",
    "b_naive", "b_memory", "t_naive", "t_memory", "nk", "erythroid",
]

# GEO supplementary file mappings (Loyfer 2023)
# These are processed beta-value BED files: chr, start, end, beta, coverage
# Actual filenames will need to be confirmed from GSE186458
GEO_FILES: dict[str, str] = {
    "hsc": "GSM5652176_HSC.bed.gz",
    "cmp": "GSM5652177_CMP.bed.gz",
    "gmp": "GSM5652178_GMP.bed.gz",
    "monocyte": "GSM5652179_Monocyte.bed.gz",
    "neutrophil": "GSM5652180_Neutrophil.bed.gz",
    "eosinophil": "GSM5652181_Eosinophil.bed.gz",
    "b_naive": "GSM5652182_B-naive.bed.gz",
    "b_memory": "GSM5652183_B-memory.bed.gz",
    "t_naive": "GSM5652184_T-naive.bed.gz",
    "t_memory": "GSM5652185_T-memory.bed.gz",
    "nk": "GSM5652186_NK.bed.gz",
    "erythroid": "GSM5652187_Erythroid.bed.gz",
}

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "n_cpgs",
    *CELL_TYPES,
    "mean_beta", "beta_variance", "beta_range",
]

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/wgbs/loyfer_2023"
)


def _parse_bed_to_1kb(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> dict[tuple[int, int], list[float]]:
    """Parse a CpG-level BED file and aggregate to 1kb windows.

    Returns {(chr_id, window_start): [beta_values]} for averaging.
    """
    windows: dict[tuple[int, int], list[float]] = {}

    opener = gzip.open if filepath.endswith(".gz") else open
    with opener(filepath, "rt") as f:
        for line in f:
            if line.startswith("#") or line.startswith("track"):
                continue
            parts = line.strip().split("\t")
            if len(parts) < 4:
                continue

            chrom = parts[0]
            chr_id = chr_name_to_id.get(chrom)
            if chr_id is None:
                continue

            pos = int(parts[1])  # 0-based start
            beta = float(parts[3])

            # Map to 1kb window
            window_start = (pos // WINDOW_SIZE) * WINDOW_SIZE
            key = (chr_id, window_start)

            if key not in windows:
                windows[key] = []
            windows[key].append(beta)

    return windows


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "wgbs_hematopoietic"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
        VALUES
            ($1, $2, $3, 'methylation', $4,
             'Loyfer et al. 2023 Nature, GEO GSE186458 (sorted WGBS)',
             'cc0_1_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"Hematopoietic WGBS 1kb ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_wgbs(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    data_dir: str,
) -> int:
    """Parse BED files, aggregate to 1kb, and bulk-load."""
    # Step 1: Parse all cell types into per-window aggregates
    all_windows: dict[str, dict[tuple[int, int], float]] = {}
    cpg_counts: dict[tuple[int, int], int] = {}

    for cell_type in CELL_TYPES:
        filename = GEO_FILES.get(cell_type, f"{cell_type}.bed.gz")
        filepath = os.path.join(data_dir, filename)

        if not Path(filepath).exists():
            # Try without .gz
            filepath_plain = filepath.replace(".gz", "")
            if Path(filepath_plain).exists():
                filepath = filepath_plain
            else:
                print(f"  WARNING: Missing {filepath}, {cell_type} will be NULL")
                all_windows[cell_type] = {}
                continue

        print(f"  Parsing {cell_type}...")
        raw = _parse_bed_to_1kb(filepath, CHR_NAME_TO_ID)

        # Average betas per window
        averaged: dict[tuple[int, int], float] = {}
        for key, betas in raw.items():
            averaged[key] = sum(betas) / len(betas)
            # Track CpG counts (use max across cell types)
            cpg_counts[key] = max(cpg_counts.get(key, 0), len(betas))

        all_windows[cell_type] = averaged
        print(f"    {len(averaged):,} windows with data")

    # Step 2: Build union of all window keys
    all_keys: set[tuple[int, int]] = set()
    for windows in all_windows.values():
        all_keys.update(windows.keys())

    print(f"\n  Total unique 1kb windows: {len(all_keys):,}")

    # Step 3: Build rows and load
    total_loaded = 0
    batch: list[tuple] = []

    for chr_id, window_start in sorted(all_keys):
        end_pos = window_start + WINDOW_SIZE
        n_cpgs = cpg_counts.get((chr_id, window_start), 0)

        # Per-cell-type betas
        cell_betas = []
        valid_betas = []
        for ct in CELL_TYPES:
            beta = all_windows.get(ct, {}).get((chr_id, window_start))
            cell_betas.append(beta)
            if beta is not None:
                valid_betas.append(beta)

        # Summary stats
        if len(valid_betas) >= 2:
            mean_beta = sum(valid_betas) / len(valid_betas)
            beta_variance = sum((b - mean_beta) ** 2 for b in valid_betas) / (len(valid_betas) - 1)
            beta_range = max(valid_betas) - min(valid_betas)
        elif len(valid_betas) == 1:
            mean_beta = valid_betas[0]
            beta_variance = 0.0
            beta_range = 0.0
        else:
            mean_beta = None
            beta_variance = None
            beta_range = None

        batch.append((
            layer_id, build, chr_id, window_start, end_pos,
            n_cpgs,
            *cell_betas,
            mean_beta, beta_variance, beta_range,
        ))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "wgbs_1kb",
                records=batch,
                columns=COLUMNS,
                schema_name="methylation",
            )
            total_loaded += len(batch)
            if total_loaded % 500_000 == 0:
                print(f"    Loaded {total_loaded:,} rows...")
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "wgbs_1kb",
            records=batch,
            columns=COLUMNS,
            schema_name="methylation",
        )
        total_loaded += len(batch)

    print(f"  Total rows loaded: {total_loaded:,}")
    return total_loaded


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("Download Loyfer 2023 BED files from GEO GSE186458 to this directory.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        print(f"\n{'='*60}")
        print(f"Hematopoietic WGBS Ingestion - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        existing_count = await conn.fetchval(
            "SELECT count(*) FROM methylation.wgbs_1kb WHERE layer_id = $1",
            layer_id,
        )
        if existing_count > 0:
            print(f"  WARNING: {existing_count:,} rows already exist. Skipping.")
            return

        async with ingest_transaction(conn):
            total = await ingest_wgbs(conn, build, layer_id, data_dir)
        print(f"\n  WGBS rows loaded: {total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Loyfer 2023 hematopoietic WGBS (1kb bins)",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
