"""Ultraconserved element ingestion into evolution.ultraconserved_elements.

Reads the UCSC ultraCons table (481 elements, Bejerano et al. 2004)
and bulk-loads via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.ultraconserved
    ULTRACONS_FILE=/path/to/ultraCons.txt uv run python -m polymer_genomics.ingest.ultraconserved
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
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 1000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "uce_name", "length_bp", "category",
]

UCSC_URL = "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/ultraCons.txt.gz"

# Normalize UCSC type values
_CATEGORY_MAP = {
    "exonic": "exonic",
    "possibly_exonic": "exonic",
    "intronic": "intronic",
    "intergenic": "intergenic",
}


# ── TSV reader ───────────────────────────────────────────────────────────────


def read_ultracons(tsv_path: str | Path) -> list[dict]:
    """Parse UCSC ultraCons dump. Format: bin, chrom, start, end, name, score, type."""
    rows: list[dict] = []
    skipped = 0

    opener = gzip.open if str(tsv_path).endswith(".gz") else open

    with opener(tsv_path, "rt") as f:
        for line in f:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 7:
                skipped += 1
                continue

            chrom = fields[1]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                skipped += 1
                continue

            try:
                start_pos = int(fields[2])  # already 0-based
                end_pos = int(fields[3])    # already half-open
            except ValueError:
                skipped += 1
                continue

            uce_name = fields[4]
            raw_type = fields[6].strip().lower()
            category = _CATEGORY_MAP.get(raw_type, raw_type)

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "uce_name": uce_name,
                "length_bp": end_pos - start_pos,
                "category": category,
            })

    print(f"  Parsed {len(rows):,} ultraconserved elements")
    if skipped:
        print(f"  Skipped: {skipped:,} rows")
    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "ultraconserved_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'ultraconserved', $4,
                   'UCSC ultraCons (Bejerano et al. 2004 Science 304:1321)',
                   'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"Ultraconserved Elements ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["uce_name"], rec["length_bp"], rec["category"],
    )


async def ingest_build(
    conn: asyncpg.Connection, build: str, layer_id: str, data_path: str | Path,
) -> int:
    print(f"\n  Reading UCE data: {data_path}")
    records = read_ultracons(data_path)
    if not records:
        print("  ERROR: No records parsed")
        return 0

    batch = [_build_row(layer_id, build, rec) for rec in records]
    await conn.copy_records_to_table(
        "ultraconserved_elements", records=batch,
        columns=COLUMNS, schema_name="evolution",
    )
    print(f"  Loaded {len(batch):,} UCEs")
    return len(batch)


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    data_path = os.environ.get("ULTRACONS_FILE")
    if not data_path:
        data_path = "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/ultraCons.txt.gz"
        if not Path(data_path).is_file():
            print(f"Downloading ultraCons from UCSC to {data_path}...")
            Path(data_path).parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(UCSC_URL, data_path)
            print("Download complete.")

    if not Path(data_path).is_file():
        print(f"ERROR: UCE file not found at {data_path}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Ultraconserved Elements - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM evolution.ultraconserved_elements WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  WARNING: {existing:,} rows already exist. Skipping.")
                continue

            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, data_path)
            print(f"\n  Total UCEs loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest ultraconserved elements")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
