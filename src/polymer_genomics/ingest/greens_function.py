"""Phase 3.5: Green's function response track ingestion.

Reads 4 BigWig tracks computed by Polymer Evolution Phase 3.5 and UPDATEs
existing biophysics.sequence_properties rows with Green's function columns.

Tracks: correlation_length, integrated_response, perturbation_reach,
        response_asymmetry.

Requires: pyBigWig, migration 039_greens_function.sql applied,
          biophysics_tracks.py already run (rows must exist).

Usage::

    uv run python -m polymer_genomics.ingest.greens_function
    uv run python -m polymer_genomics.ingest.greens_function \
        --data-dir /path/to/phase3_5/output/window_1000
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

BATCH_SIZE = 10_000

GF_BIGWIG_FILES: dict[str, str] = {
    "correlation_length": "correlation_length.bw",
    "integrated_response": "integrated_response.bw",
    "perturbation_reach": "perturbation_reach.bw",
    "response_asymmetry": "response_asymmetry.bw",
}

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/external/polymer_evolution/phase3_5/output/window_1000"
)


async def ingest_greens_function(
    conn: asyncpg.Connection,
    build: str,
    data_dir: str,
) -> int:
    """Read BigWig files and UPDATE existing biophysics rows."""
    import pyBigWig

    bw_handles: dict[str, object] = {}
    for col_name, filename in GF_BIGWIG_FILES.items():
        bw_path = os.path.join(data_dir, filename)
        if not Path(bw_path).exists():
            raise FileNotFoundError(f"BigWig not found: {bw_path}")
        bw_handles[col_name] = pyBigWig.open(bw_path)

    track_names = list(GF_BIGWIG_FILES.keys())
    col_defs = ", ".join(f"{col} real" for col in track_names)

    try:
        await conn.execute(f"""
            CREATE TEMP TABLE _gf_staging (
                chr_id    smallint NOT NULL,
                start_pos int NOT NULL,
                {col_defs}
            )
        """)

        ref_bw = bw_handles["correlation_length"]
        available_chroms = set(ref_bw.chroms().keys())

        total_staged = 0
        batch: list[tuple] = []

        for chrom in sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c]):
            chr_id = CHR_NAME_TO_ID[chrom]
            if chrom not in available_chroms:
                continue

            intervals = ref_bw.intervals(chrom)
            if intervals is None:
                continue

            chr_data: dict[str, dict[int, float | None]] = {}
            for col_name, bw in bw_handles.items():
                track_intervals = bw.intervals(chrom)
                if track_intervals is None:
                    chr_data[col_name] = {}
                else:
                    chr_data[col_name] = {int(s): v for s, e, v in track_intervals}

            for start, end, _ in intervals:
                start = int(start)
                values = [chr_data[col].get(start) for col in track_names]
                batch.append((chr_id, start, *values))

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "_gf_staging",
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
                "_gf_staging",
                records=batch,
                columns=["chr_id", "start_pos"] + track_names,
            )
            total_staged += len(batch)

        print(f"  Total staged: {total_staged:,} rows")

        set_clauses = ", ".join(f"{col} = s.{col}" for col in track_names)
        print("  Applying UPDATE from staging table...")
        result = await conn.execute(f"""
            UPDATE biophysics.sequence_properties bp
            SET {set_clauses}
            FROM _gf_staging s
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = s.chr_id
              AND bp.start_pos = s.start_pos
        """, build)

        updated = assert_rows_updated(result, context="greens_function")
        print(f"  Updated {updated:,} rows")

        await conn.execute("DROP TABLE _gf_staging")
        return updated

    finally:
        for bw in bw_handles.values():
            bw.close()


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("Set --data-dir to the Polymer Evolution Phase 3.5 window_1000 output directory.")
        return

    conn = await get_ingest_connection(admin=False)

    try:
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'correlation_length'
        """)
        if col_check == 0:
            print("ERROR: correlation_length column not found. Run migration 039_greens_function.sql first.")
            return

        sample = await conn.fetchval("""
            SELECT correlation_length FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND correlation_length IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  Green's function data already present for {build}. Skipping.")
            return

        await check_base_rows(conn, build)

        print(f"\n{'='*60}")
        print(f"Ingesting Phase 3.5 Green's function tracks - {build}")
        print(f"{'='*60}")

        updated = await ingest_greens_function(conn, build, data_dir)
        print(f"\n  Green's function rows updated: {updated:,}")
        print("Done.")

    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Phase 3.5 Green's function response tracks",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
