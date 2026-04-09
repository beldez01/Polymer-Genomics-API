"""McVicker B-score ingestion into biophysics.b_score_mean.

Reads run-length encoded B-score files (McVicker et al. 2009),
computes 1kb window means, and UPDATEs biophysics.sequence_properties.

B-scores represent background selection intensity:
  0 = strong purifying selection at linked sites
  1000 = neutral (no background selection effect)

Source: http://www.phrap.org/software_dir/mcvicker_dir/bkgd.tar.gz
Format: Run-length encoded (score count) per chromosome, hg18 coordinates
Note: B-scores are coordinate-agnostic summaries — we assign to hg38 windows by position index.

Usage::

    uv run python -m polymer_genomics.ingest.b_scores
"""

from __future__ import annotations

import argparse
import asyncio
import os
import tarfile
from pathlib import Path


from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows

BATCH_SIZE = 50_000
BIN_SIZE = 1000

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


def _parse_bscore_rle(filepath: str | Path) -> list[tuple[int, int]]:
    """Parse run-length encoded B-score file. Returns [(score, count), ...]."""
    runs: list[tuple[int, int]] = []
    with open(filepath) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) == 2:
                runs.append((int(parts[0]), int(parts[1])))
    return runs


def _compute_window_means(runs: list[tuple[int, int]], chr_size: int) -> dict[int, float]:
    """Compute mean B-score per 1kb window from RLE data."""
    result: dict[int, float] = {}

    pos = 0
    run_idx = 0
    run_pos = 0  # position within current run

    for win_start in range(0, chr_size, BIN_SIZE):
        win_end = min(win_start + BIN_SIZE, chr_size)
        win_size = win_end - win_start
        total_score = 0.0
        covered = 0

        while pos < win_end and run_idx < len(runs):
            score, count = runs[run_idx]
            remaining_in_run = count - run_pos

            # How much of this run falls in the current window?
            run_end_pos = pos + remaining_in_run
            overlap_end = min(run_end_pos, win_end)
            overlap = overlap_end - pos

            if overlap > 0:
                total_score += score * overlap
                covered += overlap
                pos += overlap
                run_pos += overlap

            if run_pos >= count:
                run_idx += 1
                run_pos = 0

            if pos >= win_end:
                break

        if covered > 0:
            result[win_start] = total_score / win_size

    return result


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    tar_path = os.environ.get(
        "BSCORE_FILE",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/bkgd.tar.gz",
    )
    data_dir = os.environ.get(
        "BSCORE_DIR",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/bkgd",
    )

    # Extract tar if needed
    if not Path(data_dir).is_dir() and Path(tar_path).is_file():
        print(f"Extracting {tar_path}...")
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(Path(tar_path).parent)

    if not Path(data_dir).is_dir():
        print(f"ERROR: B-score directory not found at {data_dir}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting McVicker B-scores - {build}")
            print(f"{'='*60}")

            await check_base_rows(conn, build)

            # Idempotency
            sample = await conn.fetchval(
                "SELECT b_score_mean FROM biophysics.sequence_properties "
                "WHERE build = $1::genome_build AND b_score_mean IS NOT NULL LIMIT 1",
                build,
            )
            if sample is not None:
                print(f"  B-scores already present (sample={sample:.1f}). Skipping.")
                continue

            # Create staging
            await conn.execute("""
                CREATE TEMP TABLE _bscore_staging (
                    chr_id smallint NOT NULL,
                    start_pos int NOT NULL,
                    b_score_mean real
                )
            """)

            total = 0
            batch: list[tuple] = []

            for chrom in sorted(_CHR_SIZES.keys(), key=lambda c: CHR_NAME_TO_ID.get(c, 99)):
                chr_id = CHR_NAME_TO_ID.get(chrom)
                if chr_id is None:
                    continue

                bscore_file = os.path.join(data_dir, f"{chrom}.bkgd")
                if not Path(bscore_file).is_file():
                    print(f"  {chrom}: file not found, skipping")
                    continue

                print(f"  {chrom}: parsing RLE...", end=" ", flush=True)
                runs = _parse_bscore_rle(bscore_file)
                print(f"{len(runs):,} runs, computing windows...", end=" ", flush=True)
                window_means = _compute_window_means(runs, _CHR_SIZES[chrom])
                print(f"{len(window_means):,} windows", flush=True)

                for ws, mean_score in window_means.items():
                    batch.append((chr_id, ws, mean_score))
                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "_bscore_staging", records=batch,
                            columns=["chr_id", "start_pos", "b_score_mean"],
                        )
                        total += len(batch)
                        batch = []

            if batch:
                await conn.copy_records_to_table(
                    "_bscore_staging", records=batch,
                    columns=["chr_id", "start_pos", "b_score_mean"],
                )
                total += len(batch)

            print(f"\n  Staged {total:,} rows. Updating biophysics...", flush=True)
            result = await conn.execute("""
                UPDATE biophysics.sequence_properties bp
                SET b_score_mean = s.b_score_mean
                FROM _bscore_staging s
                WHERE bp.build = $1::genome_build
                  AND bp.chr_id = s.chr_id
                  AND bp.start_pos = s.start_pos
            """, build)
            print(f"  {result}", flush=True)

            await conn.execute("DROP TABLE _bscore_staging")

        print("\nB-score ingestion complete.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest McVicker B-scores")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
