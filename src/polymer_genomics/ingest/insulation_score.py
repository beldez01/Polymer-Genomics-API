"""Insulation score ingestion from 4D Nucleome.

Reads diamond insulation score bigWig files and loads into
regulatory.insulation_score. 5kb resolution, cooltools v0.2.0.

Source: 4DN data portal (data.4dnucleome.org).

Requires: asyncpg, pyBigWig

Usage::

    uv run python -m polymer_genomics.ingest.insulation_score
    uv run python -m polymer_genomics.ingest.insulation_score --all
"""

from __future__ import annotations

import argparse
import asyncio
import glob as _glob
import math
import os
from pathlib import Path

import asyncpg
import pyBigWig

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 50_000

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/insulation"
)

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "cell_type", "insulation_score", "resolution_bp",
]


def _parse_bigwig(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> list[tuple[int, int, int, float, int]]:
    """Parse insulation score bigWig file.

    Returns list of (chr_id, start, end, score, resolution).
    """
    rows = []
    bw = pyBigWig.open(filepath)

    for chrom, length in bw.chroms().items():
        chr_id = chr_name_to_id.get(chrom)
        if chr_id is None:
            continue

        intervals = bw.intervals(chrom)
        if intervals is None:
            continue

        for start, end, val in intervals:
            if val is None or math.isnan(val):
                continue
            resolution = end - start
            rows.append((chr_id, start, end, float(val), resolution))

    bw.close()
    return rows


def _discover_cell_types(data_dir: str) -> list[str]:
    """Auto-detect cell types from bigWig filenames."""
    cell_types = set()
    for path in _glob.glob(os.path.join(data_dir, "*_insulation_*.bw")):
        name = os.path.basename(path)
        ct = name.split("_insulation_")[0]
        cell_types.add(ct)
    return sorted(cell_types)


def _find_file(data_dir: str, cell_type: str) -> str | None:
    """Find insulation score file for a cell type."""
    matches = _glob.glob(os.path.join(data_dir, f"{cell_type}_insulation_*.bw"))
    return matches[0] if matches else None


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "insulation_score"
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
             source, license_class, storage_type, is_active, is_default,
             evidence_class, tier, equilibrium_regime, statefulness,
             validation_status, interpretability, is_composite)
        VALUES
            ($1, $2, $3, 'insulation_score', $4,
             '4D Nucleome, cooltools v0.2.0 diamond insulation',
             'cc_by_4_0', 'postgres', true, true,
             'M', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'mechanistic', false)
        RETURNING id
        """,
        layer_key, version,
        f"Insulation Score ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_insulation(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    data_dir: str,
    cell_type: str,
) -> int:
    """Load insulation score data for a single cell type."""
    filepath = _find_file(data_dir, cell_type)
    if not filepath:
        print(f"  WARNING: No insulation file found for {cell_type}. Skipping.")
        return 0

    print(f"  Parsing: {os.path.basename(filepath)}")
    rows = _parse_bigwig(filepath, CHR_NAME_TO_ID)

    if not rows:
        print(f"  WARNING: No data parsed for {cell_type}.")
        return 0

    print(f"  Parsed {len(rows):,} bins for {cell_type}")

    total_loaded = 0
    batch: list[tuple] = []

    for chr_id, start, end, score, resolution in rows:
        batch.append((
            layer_id, build, chr_id, start, end,
            cell_type, score, resolution,
        ))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "insulation_score",
                records=batch,
                columns=COLUMNS,
                schema_name="regulatory",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "insulation_score",
            records=batch,
            columns=COLUMNS,
            schema_name="regulatory",
        )
        total_loaded += len(batch)

    print(f"  {cell_type}: {total_loaded:,} rows loaded")
    return total_loaded


async def main(
    build: str = "hg38",
    data_dir: str | None = None,
    cell_types: list[str] | None = None,
    discover_all: bool = False,
) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if discover_all:
        cell_types = _discover_cell_types(data_dir)
        print(f"  Auto-discovered {len(cell_types)} cell types")
    elif cell_types is None:
        cell_types = ["GM12878", "K562", "H1-hESC"]

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        print(f"\n{'='*60}")
        print(f"Insulation Score Ingestion - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        grand_total = 0
        for cell_type in cell_types:
            existing = await conn.fetchval(
                "SELECT count(*) FROM regulatory.insulation_score "
                "WHERE layer_id = $1 AND cell_type = $2",
                layer_id, cell_type,
            )
            if existing > 0:
                print(f"  WARNING: {cell_type} already has {existing:,} rows. Skipping.")
                continue
            async with ingest_transaction(conn):
                total = await ingest_insulation(conn, build, layer_id, data_dir, cell_type)
            grand_total += total

        print(f"\n  Total rows loaded: {grand_total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest insulation scores from 4DN bigWig files",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--cell-type", action="append", dest="cell_types")
    parser.add_argument("--all", action="store_true", dest="discover_all")
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir, args.cell_types, args.discover_all))


if __name__ == "__main__":
    cli()
