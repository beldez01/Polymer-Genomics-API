"""Pratto et al. 2014 DMC1 SSDS meiotic DSB hotspot ingestion.

Loads ~61K DMC1-defined recombination hotspot peaks (hg38, liftOver from hg19)
into a new table recombination.dmc1_hotspots.

Source: Science 346:1256442 (2014), GEO: GSE59836
Data:   Pre-lifted RDS at data/downloads/pratto_dmc1/pratto_dmc1_hotspots_hg38.rds
        or BED at data/downloads/pratto_dmc1/pratto_dmc1_hg38.bed

Usage::

    uv run python -m polymer_genomics.ingest.pratto_dmc1
"""

from __future__ import annotations

import argparse
import asyncio
import csv
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BED_FILE = Path(__file__).resolve().parents[3] / "data" / "downloads" / "pratto_dmc1" / "pratto_dmc1_hg38.bed"


def _parse_bed(path: Path) -> list[tuple]:
    """Parse BED → list of (build, chr_id, start, end, mean_strength)."""
    rows = []
    with open(path) as f:
        for line in f:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 4:
                continue
            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue
            start = int(fields[1])      # already 0-based from BED
            end = int(fields[2])
            strength = float(fields[3])
            rows.append(("hg38", chr_id, start, end, strength))
    print(f"  Parsed {len(rows):,} DMC1 hotspot peaks")
    return rows


async def main() -> None:
    if not BED_FILE.is_file():
        print(f"ERROR: BED file not found at {BED_FILE}")
        print("  Run the liftOver R script first (see DESIGN.md)")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        print(f"\n{'='*60}")
        print("Ingesting Pratto 2014 DMC1 hotspot peaks (hg38)")
        print(f"{'='*60}")

        # Ensure table exists
        await conn.execute("CREATE SCHEMA IF NOT EXISTS recombination")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS recombination.dmc1_hotspots (
                id serial PRIMARY KEY,
                build text NOT NULL DEFAULT 'hg38',
                chr_id smallint NOT NULL,
                start_pos int NOT NULL,
                end_pos int NOT NULL,
                mean_strength real,
                UNIQUE (build, chr_id, start_pos, end_pos)
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_dmc1_hotspots_pos
            ON recombination.dmc1_hotspots (build, chr_id, start_pos, end_pos)
        """)

        # Idempotency
        count = await conn.fetchval("SELECT count(*) FROM recombination.dmc1_hotspots")
        if count and count > 0:
            print(f"  DMC1 hotspots already loaded ({count:,} rows). Skipping.")
            return

        # Parse and load
        rows = _parse_bed(BED_FILE)

        async with ingest_transaction(conn):
            await conn.copy_records_to_table(
                "dmc1_hotspots",
                schema_name="recombination",
                records=rows,
                columns=["build", "chr_id", "start_pos", "end_pos", "mean_strength"],
            )

        final_count = await conn.fetchval("SELECT count(*) FROM recombination.dmc1_hotspots")
        print(f"  Loaded {final_count:,} DMC1 hotspot peaks")

        # Register layer
        existing = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = 'dmc1_hotspots_v1'"
        )
        if existing is None:
            await conn.execute("""
                INSERT INTO registry.layers
                    (layer_key, version, name, layer_type, genome_build,
                     source, license_class, storage_type,
                     evidence_class, tier, is_active, is_default)
                VALUES
                    ('dmc1_hotspots_v1', '1.0', 'Pratto 2014 DMC1 DSB Hotspots',
                     'recombination', 'hg38',
                     'Pratto et al. 2014 Science 346:1256442 (GEO: GSE59836, liftOver hg19→hg38)',
                     'open_access', 'postgres',
                     'M', 'intrinsic', true, false)
            """)
            print("  Registered layer: dmc1_hotspots_v1")

        print("\nDMC1 hotspot ingestion complete.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest Pratto 2014 DMC1 hotspots")
    args = parser.parse_args()
    asyncio.run(main())


if __name__ == "__main__":
    cli()
