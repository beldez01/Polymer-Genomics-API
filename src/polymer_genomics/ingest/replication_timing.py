"""Replication timing ingestion via UPDATE on biophysics.sequence_properties.

Reads Repli-seq data from BED files (exported from RDS) or BigWig files and
UPDATEs existing biophysics rows with replication timing columns.

Follows the greens_function.py UPDATE pattern (staging table → UPDATE).

Requires: migration 044_replication_timing.sql applied.

Usage::

    uv run python -m polymer_genomics.ingest.replication_timing
    uv run python -m polymer_genomics.ingest.replication_timing --data-dir /path/to/data
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

BATCH_SIZE = 10_000
WINDOW_SIZE = 1000

# Supported file formats: BED (chr, start, end, score) or BigWig
# BED files take priority over BigWig files
REPLI_BED_FILES: dict[str, str] = {
    "repli_gm12878": "repli_timing_hg38_1kb.bed",
}

REPLI_BIGWIG_FILES: dict[str, str] = {
    "repli_gm12878": "repli_timing_gm12878.bw",
    "repli_k562": "repli_timing_k562.bw",
}

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/replication"
)


def _parse_bed(filepath: str, chr_name_to_id: dict[str, int]) -> dict[tuple[int, int], float]:
    """Parse BED file to {(chr_id, start_pos): score}."""
    data: dict[tuple[int, int], float] = {}
    with open(filepath) as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 4:
                continue
            chrom = parts[0]
            chr_id = chr_name_to_id.get(chrom)
            if chr_id is None:
                continue
            start = int(float(parts[1]))  # handle R scientific notation (1e+05)
            try:
                score = float(parts[3])
            except ValueError:
                continue
            data[(chr_id, start)] = score
    return data


async def ingest_from_bed(
    conn: asyncpg.Connection,
    build: str,
    data_dir: str,
) -> int:
    """Load replication timing from BED files via staging table → UPDATE."""
    # Find available BED files
    bed_data: dict[str, dict[tuple[int, int], float]] = {}
    for col_name, filename in REPLI_BED_FILES.items():
        filepath = os.path.join(data_dir, filename)
        if Path(filepath).exists():
            print(f"  Parsing BED: {filename}...")
            bed_data[col_name] = _parse_bed(filepath, CHR_NAME_TO_ID)
            print(f"    {len(bed_data[col_name]):,} windows")

    if not bed_data:
        return 0

    track_names = list(bed_data.keys())
    col_defs = ", ".join(f"{col} real" for col in track_names)

    await conn.execute(f"""
        CREATE TEMP TABLE _repli_staging (
            chr_id    smallint NOT NULL,
            start_pos int NOT NULL,
            {col_defs}
        )
    """)

    # Build union of all window keys
    all_keys: set[tuple[int, int]] = set()
    for data in bed_data.values():
        all_keys.update(data.keys())

    total_staged = 0
    batch: list[tuple] = []

    for chr_id, start_pos in sorted(all_keys):
        values = [bed_data.get(col, {}).get((chr_id, start_pos)) for col in track_names]
        batch.append((chr_id, start_pos, *values))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "_repli_staging",
                records=batch,
                columns=["chr_id", "start_pos"] + track_names,
            )
            total_staged += len(batch)
            if total_staged % 500_000 == 0:
                print(f"    Staged {total_staged:,} rows...")
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "_repli_staging",
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
        FROM _repli_staging s
        WHERE bp.build = $1::genome_build
          AND bp.chr_id = s.chr_id
          AND bp.start_pos = s.start_pos
    """, build)

    updated = int(result.split()[-1]) if result else 0
    print(f"  Updated {updated:,} rows")

    await conn.execute("DROP TABLE _repli_staging")
    return updated


async def ingest_from_bigwig(
    conn: asyncpg.Connection,
    build: str,
    data_dir: str,
) -> int:
    """Load replication timing from BigWig files via staging table → UPDATE."""
    import pyBigWig

    bw_handles: dict[str, object] = {}
    for col_name, filename in REPLI_BIGWIG_FILES.items():
        bw_path = os.path.join(data_dir, filename)
        if Path(bw_path).exists():
            bw_handles[col_name] = pyBigWig.open(bw_path)

    if not bw_handles:
        return 0

    track_names = list(bw_handles.keys())
    col_defs = ", ".join(f"{col} real" for col in track_names)

    try:
        await conn.execute(f"""
            CREATE TEMP TABLE _repli_staging (
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

            chrom_len = ref_bw.chroms()[chrom]
            n_windows = (chrom_len + WINDOW_SIZE - 1) // WINDOW_SIZE

            chr_signals: dict[str, list[float | None]] = {}
            for col_name, bw in bw_handles.items():
                if chrom not in bw.chroms():
                    chr_signals[col_name] = [None] * n_windows
                else:
                    chr_signals[col_name] = bw.stats(
                        chrom, 0, n_windows * WINDOW_SIZE,
                        type="mean", nBins=n_windows,
                    )

            for i in range(n_windows):
                start = i * WINDOW_SIZE
                values = [chr_signals[col][i] for col in track_names]
                batch.append((chr_id, start, *values))

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "_repli_staging",
                        records=batch,
                        columns=["chr_id", "start_pos"] + track_names,
                    )
                    total_staged += len(batch)
                    if total_staged % 500_000 == 0:
                        print(f"    Staged {total_staged:,} rows...")
                    batch = []

            print(f"  {chrom}: {n_windows:,} windows")

        if batch:
            await conn.copy_records_to_table(
                "_repli_staging",
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
            FROM _repli_staging s
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = s.chr_id
              AND bp.start_pos = s.start_pos
        """, build)

        updated = int(result.split()[-1]) if result else 0
        print(f"  Updated {updated:,} rows")

        await conn.execute("DROP TABLE _repli_staging")
        return updated

    finally:
        for bw in bw_handles.values():
            bw.close()


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        Path(data_dir).mkdir(parents=True, exist_ok=True)

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
              AND column_name = 'repli_gm12878'
        """)
        if col_check == 0:
            print("ERROR: repli_gm12878 column not found. Run migration 044 first.")
            return

        sample = await conn.fetchval("""
            SELECT repli_gm12878 FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND repli_gm12878 IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  Replication timing data already present for {build}. Skipping.")
            return

        print(f"\n{'='*60}")
        print(f"Replication Timing Ingestion - {build}")
        print(f"{'='*60}")

        # Try BED files first, then BigWig
        has_bed = any(
            Path(os.path.join(data_dir, f)).exists()
            for f in REPLI_BED_FILES.values()
        )
        has_bigwig = any(
            Path(os.path.join(data_dir, f)).exists()
            for f in REPLI_BIGWIG_FILES.values()
        )

        if has_bed:
            print("  Using BED format...")
            updated = await ingest_from_bed(conn, build, data_dir)
        elif has_bigwig:
            print("  Using BigWig format...")
            updated = await ingest_from_bigwig(conn, build, data_dir)
        else:
            print(f"  ERROR: No replication timing data found in {data_dir}")
            print(f"  Expected BED: {list(REPLI_BED_FILES.values())}")
            print(f"  Or BigWig: {list(REPLI_BIGWIG_FILES.values())}")
            return

        print(f"\n  Replication timing rows updated: {updated:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest replication timing (UPDATE on sequence_properties)",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
