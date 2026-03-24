"""ENCODE cCRE V4 ingestion into regulatory.ccre.

Reads the ENCODE cCRE combined BED file (926K elements, 15 columns),
maps chromosome names to chr_id, and bulk-loads via the COPY protocol.

The BED file columns (0-indexed):
  0: chrom, 1: chromStart, 2: chromEnd, 3: name (accession),
  4: score, 5: strand, 6: thickStart, 7: thickEnd, 8: reserved (RGB),
  9: ccre (class+binding), 10: encodeLabel, 11: zScore,
  12: ucscLabel, 13: accessionLabel, 14: description

Usage::

    uv run python -m polymer_genomics.ingest.regulatory
    uv run python -m polymer_genomics.ingest.regulatory --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "accession", "score",
    "encode_label", "ccre_class", "z_score", "description",
]


# ── BED reader ───────────────────────────────────────────────────────────────


def read_ccre_bed(bed_path: str | Path) -> list[dict]:
    """Parse ENCODE cCRE combined BED file (15-column format)."""
    rows: list[dict] = []
    with open(bed_path) as f:
        for line in f:
            if line.startswith("#") or line.startswith("track"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 12:
                continue

            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue  # skip alt/random/Un chromosomes

            try:
                start_pos = int(fields[1])  # already 0-based
                end_pos = int(fields[2])    # already half-open
                score = int(fields[4]) if fields[4] else None
                z_score = float(fields[11]) if fields[11] else None
            except (ValueError, IndexError):
                continue

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "accession": fields[3],     # EH38E1310153
                "score": score,
                "encode_label": fields[10], # PLS, pELS, dELS, CTCF-only, DNase-H3K4me3
                "ccre_class": fields[9],    # PLS,CTCF-bound
                "z_score": z_score,
                "description": fields[14] if len(fields) > 14 else None,
            })
    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the ENCODE cCRE V4 layer."""
    layer_key = "encode_ccre_v4"
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
            ($1, $2, $3, 'regulatory', $4,
             'ENCODE SCREEN V4 (encodeproject.org)', 'cc_by_4_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"ENCODE cCREs V4 ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["accession"], rec["score"],
        rec["encode_label"], rec["ccre_class"], rec["z_score"], rec["description"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    bed_path: str | Path,
) -> int:
    """Read BED, bulk-load into regulatory.ccre."""
    print(f"  Reading BED file: {bed_path}")
    records = read_ccre_bed(bed_path)
    print(f"  Parsed {len(records):,} cCRE records from BED")

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        row = _build_row(layer_id, build, rec)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "ccre",
                records=batch,
                columns=COLUMNS,
                schema_name="regulatory",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "ccre",
            records=batch,
            columns=COLUMNS,
            schema_name="regulatory",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest ENCODE cCRE data."""
    if builds is None:
        builds = ["hg38"]

    bed_path = os.environ.get(
        "ENCODE_CCRE_BED",
        "/Users/zbb2/Desktop/Research/data/encode/encodeCcreCombined.bed",
    )

    if not Path(bed_path).exists():
        print(f"ERROR: BED file not found at {bed_path}")
        print("Set ENCODE_CCRE_BED environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting ENCODE cCREs V4 - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing_count = await conn.fetchval(
                "SELECT count(*) FROM regulatory.ccre WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, bed_path)
            print(f"\n  Total cCRE rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest ENCODE cCREs V4 into regulatory.ccre",
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
