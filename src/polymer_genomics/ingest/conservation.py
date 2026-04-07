"""Conservation score ingestion from Zoonomia/Cactus 447-way phyloP and 470-way phastCons bigWig files.

Generates 1kb-binned mean conservation scores using bigWigAverageOverBed,
then bulk-loads into conservation.scores via the COPY protocol.

Zoonomia 447-way phyloP scores are derived from the Cactus whole-genome alignment
of 447 vertebrate species (Zoonomia Consortium, Science 2023). PhastCons scores
use the 470-way alignment.

Requires either:
- bigWigAverageOverBed (UCSC tools) for local-file mode, OR
- pyBigWig for streaming mode (--stream), which reads remote bigWig URLs
  directly with zero local disk usage.

Usage::

    uv run python -m polymer_genomics.ingest.conservation
    uv run python -m polymer_genomics.ingest.conservation --build hg38
    uv run python -m polymer_genomics.ingest.conservation --download
    uv run python -m polymer_genomics.ingest.conservation --stream   # no disk needed
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.request import urlopen

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# -- Constants ----------------------------------------------------------------

BATCH_SIZE = 50_000
BIN_SIZE = 1000  # 1kb bins

# hg38 chromosome sizes (standard chroms only)
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

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "phylop_mean", "phylop_max",
    "phastcons_mean", "phastcons_max",
]

# -- Download URLs ------------------------------------------------------------

PHYLOP_URL = (
    "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP447way/hg38.phyloP447way.bw"
)
PHASTCONS_URL = (
    "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phastCons470way/hg38.phastCons470way.bw"
)


# -- Helpers ------------------------------------------------------------------


def _find_bigwig_tool() -> str:
    """Locate bigWigAverageOverBed binary."""
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
    """Generate 1kb genome windows BED file for standard chromosomes."""
    count = 0
    with open(output_path, "w") as f:
        for chrom, size in sorted(_CHR_SIZES.items(), key=lambda x: CHR_NAME_TO_ID.get(x[0], 99)):
            for start in range(0, size, BIN_SIZE):
                end = min(start + BIN_SIZE, size)
                f.write(f"{chrom}\t{start}\t{end}\t{chrom}_{start}\n")
                count += 1
    return count


def _run_bigwig_average(bw_path: str, bed_path: str, out_path: str, tool: str, minmax: bool = False) -> None:
    """Run bigWigAverageOverBed. With minmax=True, appends min/max columns."""
    # Standard output: name, size, covered, sum, mean0, mean
    # With -minMax:    name, size, covered, sum, mean0, mean, min, max
    cmd = [tool]
    if minmax:
        cmd.append("-minMax")
    cmd.extend([bw_path, bed_path, out_path])
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"bigWigAverageOverBed failed: {result.stderr}")


def _parse_minmax_output(path: str) -> dict[str, tuple[float | None, float | None]]:
    """Parse bigWigAverageOverBed -minMax output into {name: (mean, max)} dict."""
    result: dict[str, tuple[float | None, float | None]] = {}
    with open(path) as f:
        for line in f:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 8:
                continue
            name = fields[0]
            covered = int(fields[2])
            if covered == 0:
                result[name] = (None, None)
            else:
                mean_val = float(fields[5])  # mean (covered bases only)
                max_val = float(fields[7])   # max column
                result[name] = (mean_val, max_val)
    return result


# -- Download -----------------------------------------------------------------


def _download_file(url: str, dest: str | Path) -> None:
    """Download a file from *url* to *dest* with progress reporting."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    print(f"  Downloading {url}")
    print(f"         -> {dest}")

    response = urlopen(url)  # noqa: S310
    total = response.headers.get("Content-Length")
    total = int(total) if total else None

    downloaded = 0
    chunk_size = 1024 * 1024  # 1 MB

    with open(dest, "wb") as f:
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded / total * 100
                mb_done = downloaded / (1024 * 1024)
                mb_total = total / (1024 * 1024)
                sys.stdout.write(
                    f"\r  Progress: {mb_done:,.1f} / {mb_total:,.1f} MB ({pct:.1f}%)"
                )
            else:
                mb_done = downloaded / (1024 * 1024)
                sys.stdout.write(f"\r  Downloaded: {mb_done:,.1f} MB")
            sys.stdout.flush()

    print()  # newline after progress
    print(f"  Download complete: {downloaded / (1024 * 1024):,.1f} MB")


def download_bigwigs(phylop_dest: str | Path, phastcons_dest: str | Path) -> None:
    """Download Zoonomia phyloP 447-way and phastCons 470-way bigWig files.

    - phyloP 447-way:   ~9.3 GB
    - phastCons 470-way: ~4.7 GB
    """
    phylop_dest = Path(phylop_dest)
    phastcons_dest = Path(phastcons_dest)

    if phylop_dest.exists():
        print(f"  PhyloP already exists at {phylop_dest} — skipping download")
    else:
        _download_file(PHYLOP_URL, phylop_dest)

    if phastcons_dest.exists():
        print(f"  PhastCons already exists at {phastcons_dest} — skipping download")
    else:
        _download_file(PHASTCONS_URL, phastcons_dest)


# -- Layer registration -------------------------------------------------------


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    """Register (or retrieve) the conservation layer."""
    layer_key = "conservation_zoonomia_447way"
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
            ($1, $2, $3, 'conservation', $4,
             'Zoonomia/Cactus 447-way vertebrate alignment', 'open_access', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"Conservation Scores \u2014 Zoonomia 447-way phyloP + 470-way phastCons ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# -- Streaming ingestion (pyBigWig, no local files) --------------------------


async def ingest_build_streaming(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    phylop_url: str,
    phastcons_url: str,
) -> int:
    """Stream remote bigWig files per-chromosome via pyBigWig. Zero disk usage."""
    import pyBigWig
    import time

    total_loaded = 0

    for chrom, size in sorted(_CHR_SIZES.items(), key=lambda x: CHR_NAME_TO_ID.get(x[0], 99)):
        chr_id = CHR_NAME_TO_ID.get(chrom)
        if chr_id is None:
            continue

        n_bins = (size + BIN_SIZE - 1) // BIN_SIZE
        t0 = time.time()
        print(f"  {chrom} ({n_bins:,} bins)...", end="", flush=True)

        # Open fresh handles per chromosome (avoids stale HTTP connections)
        phylop_bw = pyBigWig.open(phylop_url)
        phastcons_bw = pyBigWig.open(phastcons_url)

        try:
            phylop_means = phylop_bw.stats(chrom, 0, size, type="mean", nBins=n_bins)
            phylop_maxes = phylop_bw.stats(chrom, 0, size, type="max", nBins=n_bins)
            phastcons_means = phastcons_bw.stats(chrom, 0, size, type="mean", nBins=n_bins)
            phastcons_maxes = phastcons_bw.stats(chrom, 0, size, type="max", nBins=n_bins)
        finally:
            phylop_bw.close()
            phastcons_bw.close()

        # Build rows and load in batches
        batch: list[tuple] = []
        chr_loaded = 0
        for i in range(n_bins):
            start = i * BIN_SIZE
            end = min(start + BIN_SIZE, size)

            p_mean = phylop_means[i] if phylop_means[i] is not None else None
            p_max = phylop_maxes[i] if phylop_maxes[i] is not None else None
            c_mean = phastcons_means[i] if phastcons_means[i] is not None else None
            c_max = phastcons_maxes[i] if phastcons_maxes[i] is not None else None

            batch.append((
                layer_id, build,
                chr_id, start, end,
                p_mean, p_max,
                c_mean, c_max,
            ))

            if len(batch) >= BATCH_SIZE:
                await conn.copy_records_to_table(
                    "scores",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="conservation",
                )
                chr_loaded += len(batch)
                batch = []

        if batch:
            await conn.copy_records_to_table(
                "scores",
                records=batch,
                columns=COLUMNS,
                schema_name="conservation",
            )
            chr_loaded += len(batch)

        total_loaded += chr_loaded
        elapsed = time.time() - t0
        print(f" {chr_loaded:,} rows, {elapsed:.1f}s")

    print(f"  Total rows loaded: {total_loaded:,}")
    return total_loaded


# -- Ingestion (local files) --------------------------------------------------


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    phylop_bw: str,
    phastcons_bw: str | None,
) -> int:
    """Compute 1kb-binned scores and bulk-load into conservation.scores."""
    tool = _find_bigwig_tool()
    print(f"  Using: {tool}")

    with tempfile.TemporaryDirectory() as tmpdir:
        windows_bed = os.path.join(tmpdir, "windows.bed")
        print(f"  Generating {BIN_SIZE}bp genome windows...")
        n_windows = _generate_windows_bed(windows_bed)
        print(f"  Generated {n_windows:,} windows")

        # PhyloP mean + max (single pass with -minMax)
        phylop_out = os.path.join(tmpdir, "phylop.tab")
        print(f"  Computing PhyloP mean+max ({n_windows:,} windows)...")
        _run_bigwig_average(phylop_bw, windows_bed, phylop_out, tool, minmax=True)
        phylop_data = _parse_minmax_output(phylop_out)
        print(f"  PhyloP computed: {len(phylop_data):,} windows")

        # PhastCons mean + max (if available)
        phastcons_data: dict[str, tuple[float | None, float | None]] = {}
        if phastcons_bw and Path(phastcons_bw).exists():
            phastcons_out = os.path.join(tmpdir, "phastcons.tab")
            print(f"  Computing PhastCons mean+max...")
            _run_bigwig_average(phastcons_bw, windows_bed, phastcons_out, tool, minmax=True)
            phastcons_data = _parse_minmax_output(phastcons_out)
            print(f"  PhastCons computed: {len(phastcons_data):,} windows")
        else:
            print(f"  PhastCons bigWig not provided — skipping")

    # Build rows and load
    print(f"  Loading into database...")
    total_loaded = 0
    batch: list[tuple] = []

    for chrom, size in sorted(_CHR_SIZES.items(), key=lambda x: CHR_NAME_TO_ID.get(x[0], 99)):
        chr_id = CHR_NAME_TO_ID.get(chrom)
        if chr_id is None:
            continue
        for start in range(0, size, BIN_SIZE):
            end = min(start + BIN_SIZE, size)
            name = f"{chrom}_{start}"

            phylop_mean, phylop_max = phylop_data.get(name, (None, None))

            phastcons_mean, phastcons_max = phastcons_data.get(name, (None, None))

            batch.append((
                layer_id, build,
                chr_id, start, end,
                phylop_mean, phylop_max,
                phastcons_mean, phastcons_max,
            ))

            if len(batch) >= BATCH_SIZE:
                await conn.copy_records_to_table(
                    "scores",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="conservation",
                )
                total_loaded += len(batch)
                if total_loaded % 500_000 == 0:
                    print(f"    Loaded {total_loaded:,} rows...")
                batch = []

    if batch:
        await conn.copy_records_to_table(
            "scores",
            records=batch,
            columns=COLUMNS,
            schema_name="conservation",
        )
        total_loaded += len(batch)

    print(f"  Total rows loaded: {total_loaded:,}")
    return total_loaded


# -- Main ---------------------------------------------------------------------


async def main(builds: list[str] | None = None, download: bool = False, stream: bool = False) -> None:
    """Connect and ingest Zoonomia conservation scores."""
    if builds is None:
        builds = ["hg38"]

    phylop_bw = os.environ.get(
        "PHYLOP_BW",
        "data/hg38.phyloP447way.bw",
    )
    phastcons_bw = os.environ.get(
        "PHASTCONS_BW",
        "data/hg38.phastCons470way.bw",
    )

    if download:
        print("\n" + "=" * 60)
        print("Downloading Zoonomia bigWig files")
        print("=" * 60)
        download_bigwigs(phylop_bw, phastcons_bw)

    if not stream and not Path(phylop_bw).exists():
        print(f"ERROR: PhyloP bigWig not found at {phylop_bw}")
        print("Set PHYLOP_BW environment variable, run with --download, or use --stream.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            if stream:
                print(f"Streaming Zoonomia conservation scores - {build}")
                print(f"  (remote bigWig via pyBigWig, zero disk usage)")
            else:
                print(f"Ingesting Zoonomia conservation scores - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing_count = await conn.fetchval(
                "SELECT count(*) FROM conservation.scores WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist.")
                print("  Skipping. Delete existing data first to re-ingest.")
                continue

            async with ingest_transaction(conn):
                if stream:
                    total = await ingest_build_streaming(
                        conn, build, layer_id, PHYLOP_URL, PHASTCONS_URL,
                    )
                else:
                    total = await ingest_build(conn, build, layer_id, phylop_bw, phastcons_bw)
                print(f"\n  Conservation rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description=(
            "Ingest Zoonomia/Cactus 447-way phyloP + 470-way phastCons "
            "conservation scores into conservation.scores"
        ),
    )
    parser.add_argument(
        "--build", choices=["hg38", "hg37"], default=None,
        help="Genome build (default: hg38 only)",
    )
    parser.add_argument(
        "--download", action="store_true",
        help="Download Zoonomia bigWig files (~14 GB total) before ingestion",
    )
    parser.add_argument(
        "--stream", action="store_true",
        help="Stream from remote bigWig URLs via pyBigWig (no local disk needed)",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds, download=args.download, stream=args.stream))


if __name__ == "__main__":
    cli()
