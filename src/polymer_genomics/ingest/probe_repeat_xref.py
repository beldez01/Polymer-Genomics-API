"""Probe-repeat cross-reference ingestion.

Performs a spatial join between probe.coordinates and annotation.repeats
to create probe.repeat_xref — a lookup table of which probes overlap
which repeat elements.

This is a pure SQL operation (no external data files needed).
Requires D1 (033_repeats_enrichment.sql) to have been applied for repeat_age.

Usage::

    uv run python -m polymer_genomics.ingest.probe_repeat_xref
    uv run python -m polymer_genomics.ingest.probe_repeat_xref --build hg38
"""

from __future__ import annotations

import argparse
import asyncio

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction


SPATIAL_JOIN_SQL = """
INSERT INTO probe.repeat_xref
    (probe_id, platform, build, chr_id, pos,
     repeat_class, repeat_family, repeat_name, repeat_age, divergence_pct)
SELECT DISTINCT ON (p.probe_id, l.layer_key)
    p.probe_id,
    l.layer_key AS platform,
    p.build,
    p.chr_id,
    p.pos,
    r.repeat_class,
    r.repeat_family,
    r.repeat_name,
    r.repeat_age,
    r.divergence_pct
FROM probe.coordinates p
JOIN registry.layers l ON l.id = p.layer_id
JOIN annotation.repeats r
    ON r.build = p.build
    AND r.chr_id = p.chr_id
    AND r.coord && int4range(p.pos, p.pos + 1)
WHERE p.build = $1
ORDER BY p.probe_id, l.layer_key, r.sw_score DESC NULLS LAST
ON CONFLICT (platform, build, probe_id) DO NOTHING
"""


async def main(builds: list[str] | None = None) -> None:
    """Run probe-repeat spatial join."""
    if builds is None:
        builds = ["hg38"]

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Building probe-repeat cross-reference - {build}")
            print(f"{'='*60}")

            # Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM probe.repeat_xref WHERE build = $1",
                build,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for {build}.")
                print("  Skipping. TRUNCATE probe.repeat_xref first to rebuild.")
                continue

            print("  Running spatial join (this may take several minutes)...")
            async with ingest_transaction(conn):
                result = await conn.execute(SPATIAL_JOIN_SQL, build)
            # asyncpg returns 'INSERT 0 NROWS'
            count_str = result.split()[-1] if result else "0"
            print(f"  Inserted {count_str} probe-repeat overlaps for {build}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Build probe-repeat cross-reference (spatial join)",
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
