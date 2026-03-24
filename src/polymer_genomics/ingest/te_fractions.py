"""TE family fractions derivation via UPDATE on biophysics.sequence_properties.

Derives te_line_fraction, te_sine_fraction, etc. from existing
annotation.repeats table using SQL overlap computation.

Follows the greens_function.py UPDATE pattern.

Requires: migration 048_te_fractions.sql applied.

Usage::

    uv run python -m polymer_genomics.ingest.te_fractions
"""

from __future__ import annotations

import argparse
import asyncio

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows, assert_rows_updated


# RepeatMasker family classes mapping
TE_FAMILIES: dict[str, list[str]] = {
    "te_line_fraction": ["LINE"],
    "te_sine_fraction": ["SINE"],
    "te_ltr_fraction": ["LTR"],
    "te_dna_fraction": ["DNA"],
    "te_simple_fraction": ["Simple_repeat", "Low_complexity"],
}


async def derive_te_fractions(conn: asyncpg.Connection, build: str) -> int:
    """Compute TE family fractions from annotation.repeats and UPDATE sequence_properties."""

    # Compute overlap fractions per TE family
    for col_name, families in TE_FAMILIES.items():
        family_filter = ", ".join(f"'{f}'" for f in families)
        print(f"  Computing {col_name} ({family_filter})...")

        result = await conn.execute(f"""
            UPDATE biophysics.sequence_properties bp
            SET {col_name} = sub.frac
            FROM (
                SELECT bp2.chr_id, bp2.start_pos,
                       LEAST(1.0,
                           sum(
                               GREATEST(0,
                                   LEAST(upper(r.coord), upper(bp2.coord))
                                   - GREATEST(lower(r.coord), lower(bp2.coord))
                               )
                           )::float / (upper(bp2.coord) - lower(bp2.coord))
                       ) AS frac
                FROM biophysics.sequence_properties bp2
                JOIN annotation.repeats r
                    ON r.build = bp2.build
                    AND r.chr_id = bp2.chr_id
                    AND r.coord && bp2.coord
                WHERE bp2.build = $1::genome_build
                  AND r.repeat_class IN ({family_filter})
                GROUP BY bp2.chr_id, bp2.start_pos, bp2.coord
            ) sub
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = sub.chr_id
              AND bp.start_pos = sub.start_pos
        """, build)

        count = assert_rows_updated(result, context=f"te_fractions {col_name}")
        print(f"    {col_name} updated: {count:,} rows")

        # Set windows with no overlapping repeats to 0
        await conn.execute(f"""
            UPDATE biophysics.sequence_properties
            SET {col_name} = 0
            WHERE build = $1::genome_build AND {col_name} IS NULL
        """, build)

    # Total TE fraction (sum of all families, capped at 1.0)
    print("  Computing te_total_fraction...")
    result = await conn.execute("""
        UPDATE biophysics.sequence_properties
        SET te_total_fraction = LEAST(1.0,
            COALESCE(te_line_fraction, 0) +
            COALESCE(te_sine_fraction, 0) +
            COALESCE(te_ltr_fraction, 0) +
            COALESCE(te_dna_fraction, 0) +
            COALESCE(te_simple_fraction, 0)
        )
        WHERE build = $1::genome_build
    """, build)
    count = assert_rows_updated(result, context="te_fractions te_total_fraction")
    print(f"    te_total_fraction updated: {count:,} rows")

    return count


async def main(build: str = "hg38") -> None:
    conn = await get_ingest_connection(admin=False)

    try:
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'te_line_fraction'
        """)
        if col_check == 0:
            print("ERROR: te_line_fraction column not found. Run migration 048 first.")
            return

        sample = await conn.fetchval("""
            SELECT te_total_fraction FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND te_total_fraction IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  TE fraction data already present for {build}. Skipping.")
            return

        await check_base_rows(conn, build)

        print(f"\n{'='*60}")
        print(f"TE Family Fraction Derivation - {build}")
        print(f"{'='*60}")

        count = await derive_te_fractions(conn, build)
        print(f"\n  TE fraction derivation complete: {count:,} rows")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Derive TE family fractions on sequence_properties",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    args = parser.parse_args()
    asyncio.run(main(args.build))


if __name__ == "__main__":
    cli()
