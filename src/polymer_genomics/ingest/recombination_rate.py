"""deCODE recombination rate ingestion into biophysics.recomb_rate_cmmb.

Parses UCSC recombRate table and computes overlap-weighted mean rate
per 1kb biophysics window, then UPDATEs via staging table.

Source: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/recombRate.txt.gz

Usage::

    uv run python -m polymer_genomics.ingest.recombination_rate
    RECOMB_RATE_FILE=/path/to/recombRate.txt.gz uv run python -m polymer_genomics.ingest.recombination_rate
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
import urllib.request
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 50_000
BIN_SIZE = 1000

UCSC_URL = "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/recombRate.txt.gz"

_CHR_SIZES: dict[str, int] = {
    "chr1": 248956422, "chr2": 242193529, "chr3": 198295559,
    "chr4": 190214555, "chr5": 181538259, "chr6": 170805979,
    "chr7": 159345973, "chr8": 145138636, "chr9": 138394717,
    "chr10": 133797422, "chr11": 135086622, "chr12": 133275309,
    "chr13": 114364328, "chr14": 107043718, "chr15": 101991189,
    "chr16": 90338345, "chr17": 83257441, "chr18": 80373285,
    "chr19": 58617616, "chr20": 64444167, "chr21": 46709983,
    "chr22": 50818468, "chrX": 156040895, "chrY": 57227415,
}


# ── Parse recombRate ─────────────────────────────────────────────────────────


def _parse_recomb_rate(path: str | Path) -> dict[str, list[tuple[int, int, float]]]:
    """Parse UCSC recombRate into {chrom: [(start, end, decodeAvg), ...]} sorted by start."""
    intervals: dict[str, list[tuple[int, int, float]]] = {}

    opener = gzip.open if str(path).endswith(".gz") else open

    with opener(path, "rt") as f:
        for line in f:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 6:
                continue

            # bin, chrom, chromStart, chromEnd, name, decodeAvg, ...
            chrom = fields[1]
            if chrom not in _CHR_SIZES:
                continue

            try:
                start = int(fields[2])
                end = int(fields[3])
                decode_avg = float(fields[5])
            except (ValueError, IndexError):
                continue

            if chrom not in intervals:
                intervals[chrom] = []
            intervals[chrom].append((start, end, decode_avg))

    # Sort by start
    for chrom in intervals:
        intervals[chrom].sort()

    total = sum(len(v) for v in intervals.values())
    print(f"  Parsed {total:,} recombination rate intervals across {len(intervals)} chromosomes")
    return intervals


def _compute_window_rates(
    intervals: list[tuple[int, int, float]], chr_size: int,
) -> dict[int, float]:
    """Compute overlap-weighted mean recomb rate for each 1kb window."""
    result: dict[int, float] = {}
    n_intervals = len(intervals)
    idx = 0  # pointer into sorted intervals

    for win_start in range(0, chr_size, BIN_SIZE):
        win_end = min(win_start + BIN_SIZE, chr_size)
        win_size = win_end - win_start

        weighted_sum = 0.0
        covered = 0

        # Advance pointer to intervals that might overlap this window
        while idx > 0 and (idx >= n_intervals or intervals[idx][0] > win_start):
            idx -= 1

        j = idx
        while j < n_intervals:
            iv_start, iv_end, rate = intervals[j]
            if iv_start >= win_end:
                break
            # Compute overlap
            ov_start = max(iv_start, win_start)
            ov_end = min(iv_end, win_end)
            if ov_start < ov_end:
                overlap = ov_end - ov_start
                weighted_sum += rate * overlap
                covered += overlap
            j += 1

        if covered > 0:
            result[win_start] = weighted_sum / win_size
        # else: leave as None (no data for this window)

    return result


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    data_path = os.environ.get("RECOMB_RATE_FILE")
    if not data_path:
        data_path = "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/recombRate.txt.gz"
        if not Path(data_path).is_file():
            print(f"Downloading recombRate from UCSC...")
            Path(data_path).parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(UCSC_URL, data_path)
            print("Download complete.")

    if not Path(data_path).is_file():
        print(f"ERROR: recombRate file not found at {data_path}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting deCODE recombination rate - {build}")
            print(f"{'='*60}")

            await check_base_rows(conn, build)

            # Idempotency
            sample = await conn.fetchval(
                "SELECT recomb_rate_cmmb FROM biophysics.sequence_properties "
                "WHERE build = $1::genome_build AND recomb_rate_cmmb IS NOT NULL LIMIT 1",
                build,
            )
            if sample is not None:
                print("  Recombination rate already present. Skipping.")
                continue

            intervals = _parse_recomb_rate(data_path)

            # Create staging
            await conn.execute("""
                CREATE TEMP TABLE _recomb_staging (
                    chr_id    smallint NOT NULL,
                    start_pos int NOT NULL,
                    recomb_rate_cmmb real
                )
            """)

            total = 0
            batch: list[tuple] = []

            for chrom, size in sorted(_CHR_SIZES.items(), key=lambda x: CHR_NAME_TO_ID.get(x[0], 99)):
                chr_id = CHR_NAME_TO_ID.get(chrom)
                if chr_id is None:
                    continue

                chrom_intervals = intervals.get(chrom, [])
                if not chrom_intervals:
                    continue

                print(f"  Processing {chrom} ({len(chrom_intervals):,} intervals)...")
                window_rates = _compute_window_rates(chrom_intervals, size)

                for win_start, rate in window_rates.items():
                    batch.append((chr_id, win_start, rate))

                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "_recomb_staging",
                            records=batch,
                            columns=["chr_id", "start_pos", "recomb_rate_cmmb"],
                        )
                        total += len(batch)
                        batch = []

            if batch:
                await conn.copy_records_to_table(
                    "_recomb_staging",
                    records=batch,
                    columns=["chr_id", "start_pos", "recomb_rate_cmmb"],
                )
                total += len(batch)

            print(f"  Staged {total:,} rows")

            # UPDATE
            print(f"  Updating biophysics.sequence_properties...")
            result = await conn.execute("""
                UPDATE biophysics.sequence_properties bp
                SET recomb_rate_cmmb = s.recomb_rate_cmmb
                FROM _recomb_staging s
                WHERE bp.build = $1::genome_build
                  AND bp.chr_id = s.chr_id
                  AND bp.start_pos = s.start_pos
            """, build)
            print(f"  Result: {result}")

            await conn.execute("DROP TABLE _recomb_staging")

        print("\nRecombination rate ingestion complete.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest deCODE recombination rate")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
