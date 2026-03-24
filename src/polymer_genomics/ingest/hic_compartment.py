"""Hi-C A/B compartment score ingestion.

Reads compartment bigWig files (4DN) or BED eigenvector files (Rao 2014)
and loads into regulatory.hic_compartment.

Source: 4D Nucleome (bigWig), GEO GSE63525 (BED).

Requires: asyncpg, pyBigWig

Usage::

    uv run python -m polymer_genomics.ingest.hic_compartment
    uv run python -m polymer_genomics.ingest.hic_compartment --all
"""

from __future__ import annotations

import argparse
import asyncio
import glob as _glob
import gzip
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
    "~/Desktop/PolymerGenomicsAPI/data/hic"
)

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "pc1_gm12878", "resolution_bp", "cell_type", "pc1_score",
]


def _parse_bigwig(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> list[tuple[int, int, int, float, int]]:
    """Parse compartment bigWig file.

    Returns list of (chr_id, start, end, pc1, resolution).
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


def _parse_eigenvector_bed(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> list[tuple[int, int, int, float, int]]:
    """Parse BED-like eigenvector file."""
    rows = []
    opener = gzip.open if filepath.endswith(".gz") else open
    with opener(filepath, "rt") as f:
        for line in f:
            if line.startswith("#") or line.startswith("track"):
                continue
            parts = line.strip().split("\t")
            if len(parts) < 4:
                continue
            chrom = parts[0]
            if not chrom.startswith("chr"):
                chrom = f"chr{chrom}"
            chr_id = chr_name_to_id.get(chrom)
            if chr_id is None:
                continue
            start = int(parts[1])
            end = int(parts[2])
            try:
                pc1 = float(parts[3])
            except ValueError:
                continue
            rows.append((chr_id, start, end, pc1, end - start))
    return rows


def _discover_cell_types(data_dir: str) -> list[str]:
    """Auto-detect cell types from bigWig/BED filenames."""
    cell_types = set()
    for path in _glob.glob(os.path.join(data_dir, "*_compartment*")):
        name = os.path.basename(path)
        ct = name.split("_compartment")[0]
        cell_types.add(ct)
    return sorted(cell_types)


def _find_file(data_dir: str, cell_type: str) -> str | None:
    """Find compartment file for a cell type."""
    candidates = [
        f"{cell_type}_compartment.bw",
        f"{cell_type}_compartment_25kb.bed.gz",
        f"{cell_type}_compartment_25kb.bed",
        f"{cell_type}_compartment.bed.gz",
        f"{cell_type}_compartment.bed",
    ]
    for c in candidates:
        path = os.path.join(data_dir, c)
        if Path(path).exists():
            return path
    # Glob fallback
    matches = _glob.glob(os.path.join(data_dir, f"{cell_type}_compartment*"))
    return matches[0] if matches else None


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "hic_compartment"
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
            ($1, $2, $3, 'hic_compartment', $4,
             '4D Nucleome + Rao et al. 2014 Cell',
             'cc_by_4_0', 'postgres', true, true,
             'M', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'mechanistic', false)
        RETURNING id
        """,
        layer_key, version,
        f"Hi-C A/B Compartment ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_compartment(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    data_dir: str,
    cell_type: str,
) -> int:
    """Load compartment data for a single cell type."""
    filepath = _find_file(data_dir, cell_type)
    if not filepath:
        print(f"  WARNING: No compartment file found for {cell_type}. Skipping.")
        return 0

    print(f"  Parsing: {os.path.basename(filepath)}")
    if filepath.endswith(".bw"):
        rows = _parse_bigwig(filepath, CHR_NAME_TO_ID)
    else:
        rows = _parse_eigenvector_bed(filepath, CHR_NAME_TO_ID)

    if not rows:
        print(f"  WARNING: No data parsed for {cell_type}.")
        return 0

    print(f"  Parsed {len(rows):,} bins for {cell_type}")

    total_loaded = 0
    batch: list[tuple] = []

    for chr_id, start, end, pc1, resolution in rows:
        # pc1_gm12878 only filled for GM12878, otherwise NULL
        pc1_gm12878 = pc1 if cell_type == "GM12878" else None
        batch.append((
            layer_id, build, chr_id, start, end,
            pc1_gm12878, resolution, cell_type, pc1,
        ))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "hic_compartment",
                records=batch,
                columns=COLUMNS,
                schema_name="regulatory",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "hic_compartment",
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
        cell_types = ["GM12878"]

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        print(f"\n{'='*60}")
        print(f"Hi-C Compartment Ingestion - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        grand_total = 0
        for cell_type in cell_types:
            existing = await conn.fetchval(
                "SELECT count(*) FROM regulatory.hic_compartment "
                "WHERE layer_id = $1 AND cell_type = $2",
                layer_id, cell_type,
            )
            if existing > 0:
                print(f"  WARNING: {cell_type} already has {existing:,} rows. Skipping.")
                continue
            async with ingest_transaction(conn):
                total = await ingest_compartment(conn, build, layer_id, data_dir, cell_type)
            grand_total += total

        print(f"\n  Total rows loaded: {grand_total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Hi-C A/B compartment eigenvectors",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--cell-type", action="append", dest="cell_types")
    parser.add_argument("--all", action="store_true", dest="discover_all")
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir, args.cell_types, args.discover_all))


if __name__ == "__main__":
    cli()
