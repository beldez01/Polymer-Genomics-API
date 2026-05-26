"""Methylation shape perturbation (δ-shape) track ingestion.

Reads 4 methyl-DNAshapeR-computed δ-shape BigWig files and UPDATEs existing
biophysics.sequence_properties rows with delta shape columns.

These tracks represent the shape CAPACITY of CpG methylation at each window:
  δMGW  — minor groove width change (Angstrom)
  δProT — propeller twist change (degrees)
  δRoll — roll angle change (degrees), dominant perturbation ~+6° at CpGs
  δHelT — helix twist change (degrees)

Source: Rao et al. 2018, Epigenetics & Chromatin (methyl-DNAshapeR)

Requires: pyBigWig

Usage::

    uv run python -m polymer_genomics.ingest.methyl_dnashape --build hg38
    uv run python -m polymer_genomics.ingest.methyl_dnashape \
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
DELTA_BIGWIG_FILES: dict[str, str] = {
    "delta_mgw": "delta_mgw.bw",
    "delta_prot": "delta_prot.bw",
    "delta_roll": "delta_roll.bw",
    "delta_helt": "delta_helt.bw",
}

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/external/polymer_evolution/phase1/output/window_1000"
)


# ── Ingestion ────────────────────────────────────────────────────────────────


async def ingest_methyl_dnashape(
    conn: asyncpg.Connection,
    build: str,
    data_dir: str,
) -> int:
    """Read δ-shape BigWig files and UPDATE biophysics.sequence_properties."""
    import pyBigWig

    bw_handles: dict[str, object] = {}
    for col_name, filename in DELTA_BIGWIG_FILES.items():
        bw_path = os.path.join(data_dir, filename)
        if not Path(bw_path).exists():
            raise FileNotFoundError(f"BigWig not found: {bw_path}")
        bw_handles[col_name] = pyBigWig.open(bw_path)

    try:
        # Create temp staging table
        await conn.execute("""
            CREATE TEMP TABLE _delta_shape_staging (
                chr_id    smallint NOT NULL,
                start_pos int NOT NULL,
                delta_mgw  real,
                delta_prot real,
                delta_roll real,
                delta_helt real
            )
        """)

        ref_bw = bw_handles["delta_mgw"]
        available_chroms = set(ref_bw.chroms().keys())
        track_names = list(DELTA_BIGWIG_FILES.keys())

        total_staged = 0
        batch: list[tuple] = []

        for chrom in sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c]):
            chr_id = CHR_NAME_TO_ID[chrom]

            if chrom not in available_chroms:
                continue

            intervals = ref_bw.intervals(chrom)
            if intervals is None:
                continue

            # Pre-fetch all track intervals for this chromosome
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
                        "_delta_shape_staging",
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
                "_delta_shape_staging",
                records=batch,
                columns=["chr_id", "start_pos"] + track_names,
            )
            total_staged += len(batch)

        print(f"  Total staged: {total_staged:,} rows")

        # Bulk UPDATE from staging table
        print("  Applying UPDATE from staging table...")
        result = await conn.execute("""
            UPDATE biophysics.sequence_properties bp
            SET delta_mgw  = s.delta_mgw,
                delta_prot = s.delta_prot,
                delta_roll = s.delta_roll,
                delta_helt = s.delta_helt
            FROM _delta_shape_staging s
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = s.chr_id
              AND bp.start_pos = s.start_pos
        """, build)

        updated = assert_rows_updated(result, context="methyl_dnashape")
        print(f"  Updated {updated:,} rows")

        await conn.execute("DROP TABLE _delta_shape_staging")
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

    conn = await get_ingest_connection(admin=False)

    try:
        # Check if columns exist
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'delta_mgw'
        """)
        if col_check == 0:
            print("ERROR: delta_mgw column not found. Run migration 031_methyl_dnashape.sql first.")
            return

        # Check if already populated
        sample = await conn.fetchval("""
            SELECT delta_roll FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND delta_roll IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  δ-shape data already present for {build}. Skipping.")
            print("  To re-ingest, first SET delta_mgw=NULL, delta_prot=NULL, etc.")
            return

        await check_base_rows(conn, build)

        print(f"\n{'='*60}")
        print(f"Ingesting methylation δ-shape tracks — {build}")
        print(f"{'='*60}")

        updated = await ingest_methyl_dnashape(conn, build, data_dir)
        print(f"\n  δ-shape rows updated: {updated:,}")
        print("Done.")

    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest methyl-DNAshapeR δ-shape tracks into biophysics.sequence_properties",
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
