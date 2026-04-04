"""ENCODE transcription factor binding site (TFBS) ChIP-seq peak ingestion
into regulatory.tfbs_peaks.

Reads ENCODE narrowPeak BED files for TF ChIP-seq data, maps chromosome
names to chr_id, and bulk-loads via the COPY protocol.

narrowPeak format (10 columns):
    chr, start, end, name, score, strand, signalValue, pValue, qValue, peak

File naming convention: ``<TF>_<CELLTYPE>.narrowPeak.gz``

Usage::

    uv run python -m polymer_genomics.ingest.tfbs_peaks
    uv run python -m polymer_genomics.ingest.tfbs_peaks --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# -- Constants ----------------------------------------------------------------

BATCH_SIZE = 10_000

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "tf_name", "cell_type",
    "signal_value", "p_value", "q_value", "peak_offset",
    "experiment_id",
]


# -- File discovery -----------------------------------------------------------


def discover_files(data_dir: Path) -> list[dict]:
    """Discover ``<TF>_<CELLTYPE>.narrowPeak.gz`` files in *data_dir*.

    Returns a list of dicts with keys ``path``, ``tf_name``, ``cell_type``.
    The TF name and cell type are parsed from the filename.
    """
    found: list[dict] = []
    for p in sorted(data_dir.glob("*.narrowPeak.gz")):
        stem = p.name.removesuffix(".narrowPeak.gz")
        parts = stem.split("_", maxsplit=1)
        if len(parts) == 2:
            tf_name, cell_type = parts
        else:
            tf_name = stem
            cell_type = "unknown"
        found.append({"path": p, "tf_name": tf_name, "cell_type": cell_type})
    return found


# -- BED reader ---------------------------------------------------------------


def read_narrowpeak(
    bed_path: str | Path,
    tf_name: str,
    cell_type: str,
) -> list[dict]:
    """Parse a single ENCODE narrowPeak BED file for TF ChIP-seq.

    Coordinates are 0-based half-open (BED format = internal format).
    """
    path = Path(bed_path)
    rows: list[dict] = []

    opener = gzip.open if path.name.endswith(".gz") else open
    with opener(path, "rt") as f:
        for line in f:
            if line.startswith("#") or line.startswith("track") or line.startswith("browser"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 10:
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
            try:
                val = int(fields[9])
                peak_offset = val if val >= 0 else None
            except (ValueError, IndexError):
                pass

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "tf_name": tf_name,
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
    """Register (or retrieve) the ENCODE TFBS peaks layer."""
    layer_key = "encode_tfbs_v1"
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
            ($1, $2, $3, 'tfbs', $4,
             'ENCODE TF ChIP-seq (ENCODE Consortium 2020 Nature 583:699)',
             'cc_by_4', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"ENCODE TF Binding Sites ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# -- Ingestion ----------------------------------------------------------------


def _build_row(layer_id: str, build: str, rec: dict, experiment_id: str | None) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["tf_name"], rec["cell_type"],
        rec["signal_value"], rec["p_value"], rec["q_value"], rec["peak_offset"],
        experiment_id,
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tfbs_dir: str | Path,
) -> int:
    """Scan directory for ENCODE TF ChIP-seq narrowPeak files and bulk-load."""
    tfbs_dir = Path(tfbs_dir)

    files = discover_files(tfbs_dir)
    if not files:
        print(f"  ERROR: No .narrowPeak.gz files found in {tfbs_dir}")
        print("  Place ENCODE TF ChIP-seq narrowPeak files as <TF>_<CELLTYPE>.narrowPeak.gz")
        return 0

    print(f"  Discovered {len(files)} narrowPeak files")
    total_loaded = 0

    for entry in files:
        bed_path = entry["path"]
        tf_name = entry["tf_name"]
        cell_type = entry["cell_type"]
        # Use filename stem as experiment_id
        experiment_id = bed_path.name.removesuffix(".narrowPeak.gz")

        print(f"\n  Processing {tf_name} / {cell_type}: {bed_path.name}")

        records = read_narrowpeak(bed_path, tf_name, cell_type)
        print(f"    Parsed {len(records):,} peaks")

        batch: list[tuple] = []
        file_loaded = 0

        for rec in records:
            row = _build_row(layer_id, build, rec, experiment_id)
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                await conn.copy_records_to_table(
                    "tfbs_peaks",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="regulatory",
                )
                file_loaded += len(batch)
                batch = []

        # Flush remaining
        if batch:
            await conn.copy_records_to_table(
                "tfbs_peaks",
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
    """Connect and ingest ENCODE TF binding site peak data."""
    if builds is None:
        builds = ["hg38"]

    tfbs_dir = os.environ.get(
        "TFBS_DIR",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/tfbs/",
    )

    if not Path(tfbs_dir).is_dir():
        print(f"ERROR: TFBS data directory not found at {tfbs_dir}")
        print("Set TFBS_DIR environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting ENCODE TF binding site peaks - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM regulatory.tfbs_peaks WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, tfbs_dir)
            print(f"\n  Total TFBS peak rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest ENCODE TF binding site peaks into regulatory.tfbs_peaks",
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
