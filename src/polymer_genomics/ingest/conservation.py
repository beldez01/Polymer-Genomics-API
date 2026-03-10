"""Conservation score ingestion from UCSC PhyloP/PhastCons 100-way bigWig files.

Generates 1kb-binned mean conservation scores using bigWigAverageOverBed,
then bulk-loads into conservation.scores via the COPY protocol.

Requires: bigWigAverageOverBed (UCSC tools) on PATH or at /tmp/bigWigAverageOverBed.

Usage::

    uv run python -m polymer_genomics.ingest.conservation
    uv run python -m polymer_genomics.ingest.conservation --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import tempfile
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# ── Constants ────────────────────────────────────────────────────────────────

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


# ── Helpers ──────────────────────────────────────────────────────────────────


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


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    """Register (or retrieve) the conservation layer."""
    layer_key = "phylop_phastcons_100way"
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
             'UCSC 100-way vertebrate alignment (PhyloP + PhastCons)', 'non_commercial', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version, f"PhyloP + PhastCons 100-way ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


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


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest conservation scores."""
    if builds is None:
        builds = ["hg38"]

    phylop_bw = os.environ.get(
        "PHYLOP_BW",
        "/Users/zbb2/Desktop/Research/data/conservation/hg38.phyloP100way.bw",
    )
    phastcons_bw = os.environ.get(
        "PHASTCONS_BW",
        "/Users/zbb2/Desktop/Research/data/conservation/hg38.phastCons100way.bw",
    )

    if not Path(phylop_bw).exists():
        print(f"ERROR: PhyloP bigWig not found at {phylop_bw}")
        print("Set PHYLOP_BW environment variable to the correct path.")
        return

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    conn = await asyncpg.connect(
        host=host, port=port, database=database, user=user, password=password,
    )

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting conservation scores - {build}")
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

            total = await ingest_build(conn, build, layer_id, phylop_bw, phastcons_bw)
            print(f"\n  Conservation rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest PhyloP/PhastCons 100-way conservation scores",
    )
    parser.add_argument(
        "--build", choices=["hg38", "hg37"], default=None,
        help="Genome build (default: hg38 only)",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds))


if __name__ == "__main__":
    cli()
