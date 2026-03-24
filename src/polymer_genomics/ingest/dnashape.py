"""DNA shape track ingestion from Polymer Evolution Phase 1 BigWig files.

Reads 4 DNAshapeR-computed 1kb-binned shape tracks and UPDATEs existing
biophysics.sequence_properties rows with shape feature columns.

Requires: pyBigWig (pip install pyBigWig)

Usage::

    uv run python -m polymer_genomics.ingest.dnashape
    uv run python -m polymer_genomics.ingest.dnashape \
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
from polymer_genomics.ingest._transaction import check_base_rows, assert_rows_updated

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

# Map: DB column name -> BigWig filename
SHAPE_BIGWIG_FILES: dict[str, str] = {
    "mgw_mean": "dnashape_mgw.bw",
    "prot_mean": "dnashape_prot.bw",
    "roll_mean": "dnashape_roll.bw",
    "helt_mean": "dnashape_helt.bw",
}

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/Polymer_Evolution/phase1/output/window_1000"
)


# ── Ingestion ────────────────────────────────────────────────────────────────


async def ingest_dnashape(
    conn: asyncpg.Connection,
    build: str,
    data_dir: str,
) -> int:
    """Read BigWig files and UPDATE existing biophysics.sequence_properties rows."""
    import pyBigWig

    # Open all BigWig files
    bw_handles: dict[str, object] = {}
    for col_name, filename in SHAPE_BIGWIG_FILES.items():
        bw_path = os.path.join(data_dir, filename)
        if not Path(bw_path).exists():
            raise FileNotFoundError(f"BigWig not found: {bw_path}")
        bw_handles[col_name] = pyBigWig.open(bw_path)

    try:
        # Create temp table for bulk loading
        await conn.execute("""
            CREATE TEMP TABLE _dnashape_staging (
                chr_id    smallint NOT NULL,
                start_pos int NOT NULL,
                mgw_mean  real,
                prot_mean real,
                roll_mean real,
                helt_mean real
            )
        """)

        ref_bw = bw_handles["mgw_mean"]
        available_chroms = set(ref_bw.chroms().keys())
        track_names = list(SHAPE_BIGWIG_FILES.keys())

        total_staged = 0
        batch: list[tuple] = []

        for chrom in sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c]):
            chr_id = CHR_NAME_TO_ID[chrom]

            if chrom not in available_chroms:
                continue

            intervals = ref_bw.intervals(chrom)
            if intervals is None:
                continue

            # Pre-fetch all track intervals
            chr_data: dict[str, dict[int, float | None]] = {}
            for col_name, bw in bw_handles.items():
                track_intervals = bw.intervals(chrom)
                if track_intervals is None:
                    chr_data[col_name] = {}
                else:
                    chr_data[col_name] = {
                        int(s): v for s, e, v in track_intervals
                    }

            for start, end, _ in intervals:
                start = int(start)
                values = [chr_data[col].get(start) for col in track_names]
                batch.append((chr_id, start, *values))

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "_dnashape_staging",
                        records=batch,
                        columns=["chr_id", "start_pos"] + track_names,
                    )
                    total_staged += len(batch)
                    if total_staged % 500_000 == 0:
                        print(f"    Staged {total_staged:,} rows...")
                    batch = []

            print(f"  {chrom}: {len(intervals):,} windows")

        if batch:
            await conn.copy_records_to_table(
                "_dnashape_staging",
                records=batch,
                columns=["chr_id", "start_pos"] + track_names,
            )
            total_staged += len(batch)

        print(f"  Total staged: {total_staged:,} rows")

        # Bulk UPDATE from staging table
        print("  Applying UPDATE from staging table...")
        result = await conn.execute("""
            UPDATE biophysics.sequence_properties bp
            SET mgw_mean  = s.mgw_mean,
                prot_mean = s.prot_mean,
                roll_mean = s.roll_mean,
                helt_mean = s.helt_mean
            FROM _dnashape_staging s
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = s.chr_id
              AND bp.start_pos = s.start_pos
        """, build)

        updated = assert_rows_updated(result, context="dnashape")
        print(f"  Updated {updated:,} rows")

        await conn.execute("DROP TABLE _dnashape_staging")
        return updated

    finally:
        for bw in bw_handles.values():
            bw.close()


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("Set --data-dir to the Polymer Evolution Phase 1 window_1000 output directory.")
        return

    conn = await get_ingest_connection(admin=False)  # ingest_writer role

    try:
        # Check if columns exist
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'mgw_mean'
        """)
        if col_check == 0:
            print("ERROR: mgw_mean column not found. Run migration 028_dnashape.sql first.")
            return

        # Check if already populated
        sample = await conn.fetchval("""
            SELECT mgw_mean FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND mgw_mean IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  DNA shape data already present for {build}. Skipping.")
            print("  To re-ingest, first SET mgw_mean=NULL, prot_mean=NULL, etc.")
            return

        await check_base_rows(conn, build)

        print(f"\n{'='*60}")
        print(f"Ingesting DNA shape tracks - {build}")
        print(f"{'='*60}")

        updated = await ingest_dnashape(conn, build, data_dir)
        print(f"\n  DNA shape rows updated: {updated:,}")
        print("Done.")

    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest DNAshapeR tracks into biophysics.sequence_properties",
    )
    parser.add_argument(
        "--build", choices=["hg38", "hg37"], default="hg38",
        help="Genome build (default: hg38)",
    )
    parser.add_argument(
        "--data-dir", default=None,
        help=f"Path to Phase 1 window_1000 output directory (default: {DEFAULT_DATA_DIR})",
    )
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
