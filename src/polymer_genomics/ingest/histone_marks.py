"""ENCODE histone modification peak ingestion into regulatory.histone_peaks.

Reads ENCODE narrowPeak and broadPeak BED files for histone ChIP-seq data,
maps chromosome names to chr_id, and bulk-loads via the COPY protocol.

narrowPeak format (10 columns):
    chr, start, end, name, score, strand, signalValue, pValue, qValue, peak

broadPeak format (9 columns):
    chr, start, end, name, score, strand, signalValue, pValue, qValue

Usage::

    uv run python -m polymer_genomics.ingest.histone_marks
    uv run python -m polymer_genomics.ingest.histone_marks --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# -- Constants ----------------------------------------------------------------

BATCH_SIZE = 10_000

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "mark", "cell_type",
    "signal_value", "p_value", "q_value", "peak_offset",
]

# Mapping of (mark, cell_type) -> filename glob pattern.
# Extend this dict for each ENCODE file you download.
MARK_FILES: dict[tuple[str, str], str] = {
    ("H3K4me3", "GM12878"):  "*H3K4me3*GM12878*.*Peak*",
    ("H3K27ac", "GM12878"):  "*H3K27ac*GM12878*.*Peak*",
    ("H3K4me1", "GM12878"):  "*H3K4me1*GM12878*.*Peak*",
    ("H3K36me3", "GM12878"): "*H3K36me3*GM12878*.*Peak*",
    ("H3K27me3", "GM12878"): "*H3K27me3*GM12878*.*Peak*",
    ("H3K9me3", "GM12878"):  "*H3K9me3*GM12878*.*Peak*",
    ("H3K4me3", "K562"):     "*H3K4me3*K562*.*Peak*",
    ("H3K27ac", "K562"):     "*H3K27ac*K562*.*Peak*",
    ("H3K4me1", "K562"):     "*H3K4me1*K562*.*Peak*",
    ("H3K36me3", "K562"):    "*H3K36me3*K562*.*Peak*",
    ("H3K27me3", "K562"):    "*H3K27me3*K562*.*Peak*",
    ("H3K9me3", "K562"):     "*H3K9me3*K562*.*Peak*",
    ("H3K4me3", "H1-hESC"):  "*H3K4me3*H1*hESC*.*Peak*",
    ("H3K27ac", "H1-hESC"):  "*H3K27ac*H1*hESC*.*Peak*",
    ("H3K4me1", "H1-hESC"):  "*H3K4me1*H1*hESC*.*Peak*",
    ("H3K36me3", "H1-hESC"): "*H3K36me3*H1*hESC*.*Peak*",
    ("H3K27me3", "H1-hESC"): "*H3K27me3*H1*hESC*.*Peak*",
    ("H3K9me3", "H1-hESC"):  "*H3K9me3*H1*hESC*.*Peak*",
}


# -- BED reader ---------------------------------------------------------------


def read_peak_bed(
    bed_path: str | Path,
    mark: str,
    cell_type: str,
) -> list[dict]:
    """Parse a single ENCODE narrowPeak or broadPeak BED file.

    Detects format from file extension (.narrowPeak = 10 cols, .broadPeak = 9 cols).
    Coordinates are 0-based half-open (BED format = internal format).
    """
    path = Path(bed_path)
    is_narrow = ".narrowPeak" in path.name
    rows: list[dict] = []

    with open(path) as f:
        for line in f:
            if line.startswith("#") or line.startswith("track") or line.startswith("browser"):
                continue
            fields = line.rstrip("\n").split("\t")
            min_cols = 10 if is_narrow else 9
            if len(fields) < min_cols:
                continue

            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue  # skip alt/random/Un chromosomes

            try:
                start_pos = int(fields[1])  # already 0-based
                end_pos = int(fields[2])    # already half-open
            except (ValueError, IndexError):
                continue

            try:
                signal_value = float(fields[6]) if fields[6] != "." else None
                p_value = float(fields[7]) if fields[7] != "." else None
                q_value = float(fields[8]) if fields[8] != "." else None
            except (ValueError, IndexError):
                signal_value = None
                p_value = None
                q_value = None

            peak_offset = None
            if is_narrow:
                try:
                    val = int(fields[9])
                    peak_offset = val if val >= 0 else None
                except (ValueError, IndexError):
                    pass

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "mark": mark,
                "cell_type": cell_type,
                "signal_value": signal_value,
                "p_value": p_value,
                "q_value": q_value,
                "peak_offset": peak_offset,
            })
    return rows


# -- Layer registration -------------------------------------------------------


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the ENCODE histone peaks layer."""
    layer_key = "histone_peaks_encode_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key,
        version,
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
            ($1, $2, $3, 'histone_mark', $4,
             'ENCODE', 'cc_by_4_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"ENCODE Histone Modification Peaks ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# -- Ingestion ----------------------------------------------------------------


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["mark"], rec["cell_type"],
        rec["signal_value"], rec["p_value"], rec["q_value"], rec["peak_offset"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    histone_dir: str | Path,
) -> int:
    """Scan directory for ENCODE peak files and bulk-load into regulatory.histone_peaks."""
    histone_dir = Path(histone_dir)

    # First try MARK_FILES mapping
    found_any = False
    total_loaded = 0

    for (mark, cell_type), pattern in MARK_FILES.items():
        matches = sorted(histone_dir.glob(pattern))
        if not matches:
            continue
        found_any = True

        for bed_path in matches:
            print(f"\n  Processing {mark} / {cell_type}: {bed_path.name}")

            records = read_peak_bed(bed_path, mark, cell_type)
            print(f"    Parsed {len(records):,} peaks")

            batch: list[tuple] = []
            file_loaded = 0

            for rec in records:
                row = _build_row(layer_id, build, rec)
                batch.append(row)

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "histone_peaks",
                        records=batch,
                        columns=COLUMNS,
                        schema_name="regulatory",
                    )
                    file_loaded += len(batch)
                    batch = []

            # Flush remaining
            if batch:
                await conn.copy_records_to_table(
                    "histone_peaks",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="regulatory",
                )
                file_loaded += len(batch)

            total_loaded += file_loaded
            print(f"    Loaded {file_loaded:,} rows (total: {total_loaded:,})")

    # Fallback: scan for any .narrowPeak / .broadPeak files not matched above
    if not found_any:
        all_peaks = sorted(
            list(histone_dir.glob("*.narrowPeak"))
            + list(histone_dir.glob("*.narrowPeak.gz"))
            + list(histone_dir.glob("*.broadPeak"))
            + list(histone_dir.glob("*.broadPeak.gz"))
        )
        if not all_peaks:
            print(f"  ERROR: No .narrowPeak/.broadPeak files found in {histone_dir}")
            print("  Update MARK_FILES dict or place ENCODE peak files in the directory.")
            return 0

        print(f"  Found {len(all_peaks)} peak files (unmatched by MARK_FILES)")
        print("  WARNING: mark and cell_type will be set to 'unknown'.")
        print("  Consider updating MARK_FILES for proper annotation.")

        for bed_path in all_peaks:
            print(f"\n  Processing: {bed_path.name}")
            records = read_peak_bed(bed_path, mark="unknown", cell_type="unknown")
            print(f"    Parsed {len(records):,} peaks")

            batch = []
            file_loaded = 0

            for rec in records:
                row = _build_row(layer_id, build, rec)
                batch.append(row)

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "histone_peaks",
                        records=batch,
                        columns=COLUMNS,
                        schema_name="regulatory",
                    )
                    file_loaded += len(batch)
                    batch = []

            if batch:
                await conn.copy_records_to_table(
                    "histone_peaks",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="regulatory",
                )
                file_loaded += len(batch)

            total_loaded += file_loaded
            print(f"    Loaded {file_loaded:,} rows (total: {total_loaded:,})")

    return total_loaded


# -- Main ---------------------------------------------------------------------


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest ENCODE histone modification peak data."""
    if builds is None:
        builds = ["hg38"]

    histone_dir = os.environ.get(
        "HISTONE_DIR",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/encode/histone/",
    )

    if not Path(histone_dir).is_dir():
        print(f"ERROR: Histone data directory not found at {histone_dir}")
        print("Set HISTONE_DIR environment variable to the correct path.")
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
            print(f"Ingesting ENCODE histone modification peaks - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM regulatory.histone_peaks WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, histone_dir)
            print(f"\n  Total histone peak rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest ENCODE histone modification peaks into regulatory.histone_peaks",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build (default: hg38 only)",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds))


if __name__ == "__main__":
    cli()
