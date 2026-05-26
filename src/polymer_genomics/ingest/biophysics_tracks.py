"""Biophysics track ingestion from Polymer Evolution Phase 1 BigWig files.

Reads 7 pre-computed 1kb-binned biophysical tracks and bulk-loads into
biophysics.sequence_properties via the COPY protocol.

Requires: pyBigWig (pip install pyBigWig)

Usage::

    uv run python -m polymer_genomics.ingest.biophysics_tracks
    uv run python -m polymer_genomics.ingest.biophysics_tracks \
        --build hg38 \
        --data-dir /path/to/phase1/output/window_1000
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 50_000

# Map: DB column name -> BigWig filename
BIGWIG_FILES: dict[str, str] = {
    "gc_content": "gc_content.bw",
    "stacking_dg37": "stacking_energy.bw",
    "melting_temp": "melting_temp.bw",
    "curvature": "curvature.bw",
    "groove_width": "groove_width.bw",
    "dipole_density": "dipole_density.bw",
    "periodicity_power": "periodicity_power.bw",
}

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "gc_content", "stacking_dg37", "melting_temp",
    "curvature", "groove_width", "dipole_density", "periodicity_power",
]

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/external/polymer_evolution/phase1/output/window_1000"
)


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    """Register (or retrieve) the biophysics layer."""
    layer_key = "sequence_biophysics_l0"
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
            ($1, $2, $3, 'biophysics', $4,
             'Polymer Evolution Phase 1 (SantaLucia 1998, Bolshoy 1991, El Hassan 1997)',
             'mit', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"Sequence Biophysics L0 ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    data_dir: str,
) -> int:
    """Read BigWig files and bulk-load into biophysics.sequence_properties."""
    import pyBigWig

    # Open all BigWig files
    bw_handles: dict[str, object] = {}
    for col_name, filename in BIGWIG_FILES.items():
        bw_path = os.path.join(data_dir, filename)
        if not Path(bw_path).exists():
            raise FileNotFoundError(f"BigWig not found: {bw_path}")
        bw_handles[col_name] = pyBigWig.open(bw_path)

    try:
        # Use gc_content to define the window grid (all tracks share identical windows)
        ref_bw = bw_handles["gc_content"]
        available_chroms = set(ref_bw.chroms().keys())
        track_names = list(BIGWIG_FILES.keys())

        total_loaded = 0
        batch: list[tuple] = []

        # Iterate chromosomes in canonical order
        for chrom in sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c]):
            chr_id = CHR_NAME_TO_ID[chrom]

            if chrom not in available_chroms:
                print(f"  {chrom}: not in BigWig, skipping")
                continue

            # Get intervals from the reference BigWig
            intervals = ref_bw.intervals(chrom)
            if intervals is None:
                print(f"  {chrom}: no data, skipping")
                continue

            # Pre-fetch all track intervals for this chromosome
            chr_data: dict[str, dict[tuple[int, int], float | None]] = {}
            for col_name, bw in bw_handles.items():
                track_intervals = bw.intervals(chrom)
                if track_intervals is None:
                    chr_data[col_name] = {}
                else:
                    chr_data[col_name] = {
                        (int(s), int(e)): v for s, e, v in track_intervals
                    }

            for start, end, _ in intervals:
                start = int(start)
                end = int(end)
                key = (start, end)

                values = []
                for col_name in track_names:
                    val = chr_data[col_name].get(key)
                    values.append(val)

                batch.append((
                    layer_id, build, chr_id, start, end,
                    *values,
                ))

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "sequence_properties",
                        records=batch,
                        columns=COLUMNS,
                        schema_name="biophysics",
                    )
                    total_loaded += len(batch)
                    if total_loaded % 500_000 == 0:
                        print(f"    Loaded {total_loaded:,} rows...")
                    batch = []

            print(f"  {chrom}: {len(intervals):,} windows")

        if batch:
            await conn.copy_records_to_table(
                "sequence_properties",
                records=batch,
                columns=COLUMNS,
                schema_name="biophysics",
            )
            total_loaded += len(batch)

        print(f"  Total rows loaded: {total_loaded:,}")
        return total_loaded

    finally:
        for bw in bw_handles.values():
            bw.close()


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None, data_dir: str | None = None) -> None:
    """Connect and ingest biophysics tracks."""
    if builds is None:
        builds = ["hg38"]
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("Set --data-dir to the Polymer Evolution Phase 1 window_1000 output directory.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting biophysics tracks - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing_count = await conn.fetchval(
                "SELECT count(*) FROM biophysics.sequence_properties WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist.")
                print("  Skipping. Delete existing data first to re-ingest.")
                continue

            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, data_dir)
            print(f"\n  Biophysics rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Polymer Evolution Phase 1 biophysical tracks (1kb bins)",
    )
    parser.add_argument(
        "--build", choices=["hg38", "hg37"], default=None,
        help="Genome build (default: hg38 only)",
    )
    parser.add_argument(
        "--data-dir", default=None,
        help=f"Path to Phase 1 window_1000 output directory (default: {DEFAULT_DATA_DIR})",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds, args.data_dir))


if __name__ == "__main__":
    cli()
