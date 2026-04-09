"""Palsson et al. 2025 individual oNCO events ingestion.

Loads 28,675 observed non-crossover events into recombination.onco_events.

Source: Nature 639:700-707 (2025)
Data:   github.com/DecodeGenetics/PalssonEtAl_Nature_2024/data/oNCOs/oNCOs.tsv

Usage::

    uv run python -m polymer_genomics.ingest.palsson_onco_events
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path


from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

ONCO_FILE = Path(__file__).resolve().parents[3] / "data" / "downloads" / "palsson2025" / "oNCOs.tsv"


def _parse_onco_events(path: Path) -> list[tuple]:
    """Parse oNCOs.tsv → list of (build, chr_id, start, end, ptype, event_id, mpps, gc_mpps)."""
    rows = []

    with open(path) as f:
        for line in f:
            if line.startswith("#"):
                continue
            if line.startswith("Chr\t"):
                continue  # header

            fields = line.rstrip("\n").split("\t")
            if len(fields) < 8:
                continue

            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue

            try:
                begin = int(fields[1]) - 1   # 1-based → 0-based
                end = int(fields[2])          # already exclusive in 0-based
                ptype = fields[4]             # P or M
                event_id = fields[5]
                mpps = int(fields[6])
                gc_mpps = int(fields[7])
            except (ValueError, IndexError):
                continue

            rows.append(("hg38", chr_id, begin, end, ptype, event_id, mpps, gc_mpps))

    print(f"  Parsed {len(rows):,} oNCO events")
    return rows


async def main() -> None:
    if not ONCO_FILE.is_file():
        print(f"ERROR: oNCO file not found at {ONCO_FILE}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        print(f"\n{'='*60}")
        print("Ingesting Palsson 2025 oNCO events")
        print(f"{'='*60}")

        # Ensure schema and table exist
        await conn.execute("CREATE SCHEMA IF NOT EXISTS recombination")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS recombination.onco_events (
                id serial PRIMARY KEY,
                build text NOT NULL DEFAULT 'hg38',
                chr_id smallint NOT NULL,
                start_pos int NOT NULL,
                end_pos int NOT NULL,
                parent_type char(1) NOT NULL,
                event_id text NOT NULL,
                n_mpps smallint,
                n_gc_mpps smallint,
                UNIQUE (build, event_id)
            )
        """)

        # Idempotency
        count = await conn.fetchval("SELECT count(*) FROM recombination.onco_events")
        if count and count > 0:
            print(f"  oNCO events already loaded ({count:,} rows). Skipping.")
            return

        # Parse
        rows = _parse_onco_events(ONCO_FILE)

        # Insert
        async with ingest_transaction(conn):
            await conn.copy_records_to_table(
                "onco_events",
                schema_name="recombination",
                records=rows,
                columns=["build", "chr_id", "start_pos", "end_pos",
                          "parent_type", "event_id", "n_mpps", "n_gc_mpps"],
            )

        # Verify
        final_count = await conn.fetchval("SELECT count(*) FROM recombination.onco_events")
        print(f"  Loaded {final_count:,} oNCO events")

        # Register layer
        existing = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = 'onco_events_v1'"
        )
        if existing is None:
            await conn.execute("""
                INSERT INTO registry.layers
                    (layer_key, version, name, layer_type, genome_build,
                     source, license_class, storage_type,
                     evidence_class, tier, is_active, is_default)
                VALUES
                    ('onco_events_v1', '1.0', 'Palsson 2025 oNCO Events',
                     'recombination', 'hg38',
                     'Palsson et al. 2025 Nature 639:700-707',
                     'cc_by_4_0', 'postgres',
                     'M', 'intrinsic', true, false)
            """)
            print("  Registered layer: onco_events_v1")

        print("\noNCO events ingestion complete.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest Palsson 2025 oNCO events")
    parser.parse_args()
    asyncio.run(main())


if __name__ == "__main__":
    cli()
