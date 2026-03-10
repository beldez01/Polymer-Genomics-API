"""RepeatMasker repeat element ingestion into annotation.repeats.

Reads the UCSC RepeatMasker dump file (rmsk.txt), maps chromosome names
to chr_id, and bulk-loads via the COPY protocol.

The ``annotation.repeats`` table is non-partitioned (~5.5M rows).

UCSC rmsk.txt format (tab-separated, no header):
    0: bin, 1: swScore, 2: milliDiv, 3: milliDel, 4: milliIns,
    5: genoName (chr), 6: genoStart, 7: genoEnd, 8: genoLeft,
    9: strand, 10: repName, 11: repClass, 12: repFamily,
    13: repStart, 14: repEnd, 15: repLeft, 16: id

Usage::

    uv run python -m polymer_genomics.ingest.repeats
    uv run python -m polymer_genomics.ingest.repeats --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "strand",
    "repeat_name", "repeat_class", "repeat_family",
    "sw_score", "divergence_pct", "deletion_pct", "insertion_pct",
]


# ── TSV reader ──────────────────────────────────────────────────────────────


def read_repeatmasker(tsv_path: str | Path) -> list[dict]:
    """Parse the UCSC RepeatMasker dump file (rmsk.txt, no header).

    Returns a list of dicts with fields matching the COLUMNS order.
    Coordinates are 0-based half-open (UCSC format = internal format).
    """
    rows: list[dict] = []
    skipped = 0

    with open(tsv_path) as f:
        for line_num, line in enumerate(f, 1):
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 17:
                skipped += 1
                continue

            chrom = fields[5]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue  # skip alt/random/Un chromosomes

            try:
                start_pos = int(fields[6])   # already 0-based
                end_pos = int(fields[7])     # already half-open
                sw_score = int(fields[1])
                milli_div = int(fields[2])
                milli_del = int(fields[3])
                milli_ins = int(fields[4])
            except (ValueError, IndexError):
                skipped += 1
                continue

            # Strand: UCSC uses '+' or 'C' (complement) -> normalize to '+'/'-'
            raw_strand = fields[9].strip()
            strand = "-" if raw_strand == "C" else raw_strand

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "strand": strand,
                "repeat_name": fields[10],
                "repeat_class": fields[11],
                "repeat_family": fields[12],
                "sw_score": sw_score,
                "divergence_pct": milli_div / 10.0,
                "deletion_pct": milli_del / 10.0,
                "insertion_pct": milli_ins / 10.0,
            })

            if line_num % 1_000_000 == 0:
                print(f"    Read {line_num:,} lines ({len(rows):,} kept)...")

    if skipped > 0:
        print(f"  Skipped {skipped:,} malformed lines")
    return rows


# ── Layer registration ──────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the RepeatMasker layer."""
    layer_key = "repeatmasker_v1"
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
            ($1, $2, $3, 'repeat', $4,
             'UCSC_RepeatMasker', 'non_commercial', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"RepeatMasker Repeat Elements ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ───────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["strand"],
        rec["repeat_name"], rec["repeat_class"], rec["repeat_family"],
        rec["sw_score"], rec["divergence_pct"], rec["deletion_pct"], rec["insertion_pct"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read rmsk.txt, bulk-load into annotation.repeats."""
    print(f"  Reading RepeatMasker file: {tsv_path}")
    records = read_repeatmasker(tsv_path)
    print(f"  Parsed {len(records):,} repeat elements")

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        row = _build_row(layer_id, build, rec)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "repeats",
                records=batch,
                columns=COLUMNS,
                schema_name="annotation",
            )
            total_loaded += len(batch)
            if total_loaded % 100_000 == 0:
                print(f"    Loaded {total_loaded:,} rows...")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "repeats",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest RepeatMasker data."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "REPEATMASKER_TSV",
        "/Users/zbb2/Desktop/Research/data/ucsc/rmsk.txt",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: RepeatMasker file not found at {tsv_path}")
        print("Set REPEATMASKER_TSV environment variable to the correct path.")
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
            print(f"Ingesting RepeatMasker repeat elements - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM annotation.repeats WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total repeat element rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest RepeatMasker repeat elements into annotation.repeats",
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
