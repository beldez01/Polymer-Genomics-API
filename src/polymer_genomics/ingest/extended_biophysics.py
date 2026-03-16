"""Phase 1 extended biophysics track ingestion.

Reads 6 additional BigWig tracks from Polymer Evolution Phase 1 and UPDATEs
existing biophysics.sequence_properties rows.

Tracks: deformability, g4_density, g4_max_score, kmer_complexity,
        dinucleotide_entropy, dominant_period.

Requires: pyBigWig, migration 040_extended_biophysics.sql applied,
          biophysics_tracks.py already run (rows must exist).

Usage::

    uv run python -m polymer_genomics.ingest.extended_biophysics
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

BATCH_SIZE = 10_000

EXT_BIGWIG_FILES: dict[str, str] = {
    "deformability": "deformability.bw",
    "g4_density": "g4_density.bw",
    "g4_max_score": "g4_max_score.bw",
    "kmer_complexity": "kmer_complexity.bw",
    "dinucleotide_entropy": "dinucleotide_entropy.bw",
    "dominant_period": "dominant_period.bw",
}

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/Polymer_Evolution/phase1/output/window_1000"
)


async def ingest_extended_biophysics(
    conn: asyncpg.Connection,
    build: str,
    data_dir: str,
) -> int:
    """Read BigWig files and UPDATE existing biophysics rows."""
    import pyBigWig

    bw_handles: dict[str, object] = {}
    missing = []
    for col_name, filename in EXT_BIGWIG_FILES.items():
        bw_path = os.path.join(data_dir, filename)
        if not Path(bw_path).exists():
            print(f"  WARNING: BigWig not found: {bw_path} — skipping {col_name}")
            missing.append(col_name)
        else:
            bw_handles[col_name] = pyBigWig.open(bw_path)

    if not bw_handles:
        print("  ERROR: No BigWig files found.")
        return 0

    track_names = list(bw_handles.keys())
    col_defs = ", ".join(f"{col} real" for col in track_names)

    try:
        await conn.execute(f"""
            CREATE TEMP TABLE _ext_staging (
                chr_id    smallint NOT NULL,
                start_pos int NOT NULL,
                {col_defs}
            )
        """)

        ref_bw = list(bw_handles.values())[0]
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
                        "_ext_staging",
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
                "_ext_staging",
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
            FROM _ext_staging s
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = s.chr_id
              AND bp.start_pos = s.start_pos
        """, build)

        updated = int(result.split()[-1]) if result else 0
        print(f"  Updated {updated:,} rows")

        await conn.execute("DROP TABLE _ext_staging")
        return updated

    finally:
        for bw in bw_handles.values():
            bw.close()


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        return

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_USER", "ingest_writer")
    password = os.environ.get("POSTGRES_USER_PASSWORD", "ingest_writer_dev")

    conn = await asyncpg.connect(
        host=host, port=port, database=database, user=user, password=password,
    )

    try:
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'deformability'
        """)
        if col_check == 0:
            print("ERROR: deformability column not found. Run migration 040_extended_biophysics.sql first.")
            return

        sample = await conn.fetchval("""
            SELECT deformability FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND deformability IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  Extended biophysics data already present for {build}. Skipping.")
            return

        print(f"\n{'='*60}")
        print(f"Ingesting Phase 1 extended biophysics tracks - {build}")
        print(f"{'='*60}")

        updated = await ingest_extended_biophysics(conn, build, data_dir)
        print(f"\n  Extended biophysics rows updated: {updated:,}")
        print("Done.")

    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest Phase 1 extended biophysics tracks",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
