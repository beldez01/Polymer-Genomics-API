"""Zoonomia 241-mammal conservation score ingestion into biophysics columns.

Computes 1kb-binned mean phyloP and phastCons from Zoonomia 241-way
BigWig files, then UPDATEs biophysics.sequence_properties via staging table.

Requires: bigWigAverageOverBed (UCSC tools) on PATH or at /tmp/bigWigAverageOverBed.

Source BigWig files (~12 GB total):
  phyloP:    https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP241way/hg38.phyloP241way.bw
  phastCons: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phastCons241way/hg38.phastCons241way.bw

Usage::

    uv run python -m polymer_genomics.ingest.zoonomia_conservation
    ZOONOMIA_PHYLOP_BW=/path/to/hg38.phyloP241way.bw uv run python -m polymer_genomics.ingest.zoonomia_conservation
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import tempfile
from pathlib import Path


from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 50_000
BIN_SIZE = 1000

PHYLOP_URL = "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/cactus241way/cactus241way.phyloP.bw"
PHASTCONS_URL = ""  # Not available as single BigWig from UCSC for 241-way

_CHR_SIZES: dict[str, int] = {
    "chr1": 248956422, "chr2": 242193529, "chr3": 198295559,
    "chr4": 190214555, "chr5": 181538259, "chr6": 170805979,
    "chr7": 159345973, "chr8": 145138636, "chr9": 138394717,
    "chr10": 133797422, "chr11": 135086622, "chr12": 133275309,
    "chr13": 114364328, "chr14": 107043718, "chr15": 101991189,
    "chr16": 90338345, "chr17": 83257441, "chr18": 80373285,
    "chr19": 58617616, "chr20": 64444167, "chr21": 46709983,
    "chr22": 50818468, "chrX": 156040895, "chrY": 57227415,
    "chrM": 16569,
}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _find_bigwig_tool() -> str:
    for path in ["/tmp/bigWigAverageOverBed", "bigWigAverageOverBed"]:
        if Path(path).exists() or subprocess.run(
            ["which", path], capture_output=True
        ).returncode == 0:
            return path
    raise FileNotFoundError(
        "bigWigAverageOverBed not found. Download from "
        "https://hgdownload.soe.ucsc.edu/admin/exe/"
    )


def _generate_windows_bed(output_path: str | Path) -> int:
    count = 0
    with open(output_path, "w") as f:
        for chrom, size in sorted(_CHR_SIZES.items(), key=lambda x: CHR_NAME_TO_ID.get(x[0], 99)):
            for start in range(0, size, BIN_SIZE):
                end = min(start + BIN_SIZE, size)
                f.write(f"{chrom}\t{start}\t{end}\t{chrom}_{start}\n")
                count += 1
    return count


def _run_bigwig_average(bw_path: str, bed_path: str, out_path: str, tool: str) -> None:
    cmd = [tool, bw_path, bed_path, out_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"bigWigAverageOverBed failed: {result.stderr}")


def _parse_mean_output(path: str) -> dict[str, float | None]:
    """Parse bigWigAverageOverBed output into {name: mean} dict."""
    result: dict[str, float | None] = {}
    with open(path) as f:
        for line in f:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 6:
                continue
            name = fields[0]
            covered = int(fields[2])
            if covered == 0:
                result[name] = None
            else:
                result[name] = float(fields[5])
    return result


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    data_dir = Path(os.environ.get(
        "ZOONOMIA_DATA_DIR",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads",
    ))
    data_dir.mkdir(parents=True, exist_ok=True)

    phylop_bw = os.environ.get("ZOONOMIA_PHYLOP_BW", str(data_dir / "hg38.cactus241way.phyloP.bw"))
    phastcons_bw = os.environ.get("ZOONOMIA_PHASTCONS_BW", str(data_dir / "hg38.phastCons241way.bw"))

    # Check for BigWig files (phastCons is optional — not available as single BigWig from UCSC)
    if not Path(phylop_bw).is_file():
        print(f"  phyloP 241-way BigWig not found at {phylop_bw}")
        print(f"  Download (~9 GB): {PHYLOP_URL}")
        print(f"  Set ZOONOMIA_PHYLOP_BW env var")
        return
    has_phastcons = Path(phastcons_bw).is_file()
    if not has_phastcons:
        print(f"  phastCons 241-way BigWig not found (optional, proceeding with phyloP only)")

    tool = _find_bigwig_tool()
    print(f"  bigWigAverageOverBed: {tool}")

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Zoonomia 241-way conservation - {build}")
            print(f"{'='*60}")

            await check_base_rows(conn, build)

            # Idempotency check
            sample = await conn.fetchval(
                "SELECT phylop_241way_mean FROM biophysics.sequence_properties "
                "WHERE build = $1::genome_build AND phylop_241way_mean IS NOT NULL LIMIT 1",
                build,
            )
            if sample is not None:
                print("  Zoonomia data already present. Skipping.")
                continue

            with tempfile.TemporaryDirectory() as tmpdir:
                windows_bed = os.path.join(tmpdir, "windows.bed")
                print(f"  Generating {BIN_SIZE}bp windows...")
                n_windows = _generate_windows_bed(windows_bed)
                print(f"  Generated {n_windows:,} windows")

                # phyloP
                phylop_out = os.path.join(tmpdir, "phylop241.tab")
                print(f"  Computing phyloP 241-way means...")
                _run_bigwig_average(phylop_bw, windows_bed, phylop_out, tool)
                phylop_data = _parse_mean_output(phylop_out)
                print(f"  phyloP: {len(phylop_data):,} windows")

                # phastCons (optional)
                phastcons_data: dict[str, float | None] = {}
                if has_phastcons:
                    phastcons_out = os.path.join(tmpdir, "phastcons241.tab")
                    print(f"  Computing phastCons 241-way means...")
                    _run_bigwig_average(phastcons_bw, windows_bed, phastcons_out, tool)
                    phastcons_data = _parse_mean_output(phastcons_out)
                    print(f"  phastCons: {len(phastcons_data):,} windows")
                else:
                    print(f"  Skipping phastCons (not available)")

            # Create staging table
            await conn.execute("""
                CREATE TEMP TABLE _zoonomia_staging (
                    chr_id    smallint NOT NULL,
                    start_pos int NOT NULL,
                    phylop_241way_mean    real,
                    phastcons_241way_mean real
                )
            """)

            # Load staging
            print(f"  Loading staging table...")
            batch: list[tuple] = []
            total = 0

            for chrom, size in sorted(_CHR_SIZES.items(), key=lambda x: CHR_NAME_TO_ID.get(x[0], 99)):
                chr_id = CHR_NAME_TO_ID.get(chrom)
                if chr_id is None:
                    continue
                for start in range(0, size, BIN_SIZE):
                    name = f"{chrom}_{start}"
                    p_val = phylop_data.get(name)
                    c_val = phastcons_data.get(name)
                    batch.append((chr_id, start, p_val, c_val))

                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "_zoonomia_staging",
                            records=batch,
                            columns=["chr_id", "start_pos", "phylop_241way_mean", "phastcons_241way_mean"],
                        )
                        total += len(batch)
                        batch = []

            if batch:
                await conn.copy_records_to_table(
                    "_zoonomia_staging",
                    records=batch,
                    columns=["chr_id", "start_pos", "phylop_241way_mean", "phastcons_241way_mean"],
                )
                total += len(batch)

            print(f"  Staged {total:,} rows")

            # UPDATE biophysics
            print(f"  Updating biophysics.sequence_properties...")
            result = await conn.execute("""
                UPDATE biophysics.sequence_properties bp
                SET phylop_241way_mean    = s.phylop_241way_mean,
                    phastcons_241way_mean = s.phastcons_241way_mean
                FROM _zoonomia_staging s
                WHERE bp.build = $1::genome_build
                  AND bp.chr_id = s.chr_id
                  AND bp.start_pos = s.start_pos
            """, build)
            print(f"  Result: {result}")

            await conn.execute("DROP TABLE _zoonomia_staging")
            print(f"  Done.")

        print("\nZoonomia ingestion complete.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest Zoonomia 241-way conservation")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
