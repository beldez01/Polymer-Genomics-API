"""Derived density tracks via UPDATE on biophysics.sequence_properties.

Derives ccre_density, histone peak signals, and ChromHMM active fraction
from existing regulatory tables.

Requires: migration 049_derived_densities.sql applied.

Usage::

    uv run python -m polymer_genomics.ingest.derived_densities
"""

from __future__ import annotations

import argparse
import asyncio

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows, assert_rows_updated


async def derive_densities(conn: asyncpg.Connection, build: str) -> int:
    """Compute derived density tracks from existing regulatory data."""

    # 1. cCRE density (count of ENCODE cCREs overlapping each 1kb window)
    print("  Computing ccre_density...")
    result = await conn.execute("""
        UPDATE biophysics.sequence_properties bp
        SET ccre_density = sub.cnt
        FROM (
            SELECT bp2.chr_id, bp2.start_pos, count(*) AS cnt
            FROM biophysics.sequence_properties bp2
            JOIN regulatory.ccre c
                ON c.build = bp2.build
                AND c.chr_id = bp2.chr_id
                AND c.coord && bp2.coord
            WHERE bp2.build = $1::genome_build
            GROUP BY bp2.chr_id, bp2.start_pos
        ) sub
        WHERE bp.build = $1::genome_build
          AND bp.chr_id = sub.chr_id
          AND bp.start_pos = sub.start_pos
    """, build)
    count = assert_rows_updated(result, context="derived_densities ccre_density")
    print(f"    ccre_density: {count:,} rows updated")

    await conn.execute("""
        UPDATE biophysics.sequence_properties
        SET ccre_density = 0
        WHERE build = $1::genome_build AND ccre_density IS NULL
    """, build)

    # 2. Histone peak signals (max signalValue per 1kb window, GM12878)
    histone_cols = {
        "histone_h3k4me3_gm12878": ("H3K4me3", "GM12878"),
        "histone_h3k27me3_gm12878": ("H3K27me3", "GM12878"),
        "histone_h3k4me1_gm12878": ("H3K4me1", "GM12878"),
        "histone_h3k27ac_gm12878": ("H3K27ac", "GM12878"),
    }

    for col_name, (mark, cell_type) in histone_cols.items():
        print(f"  Computing {col_name}...")
        result = await conn.execute(f"""
            UPDATE biophysics.sequence_properties bp
            SET {col_name} = sub.max_signal
            FROM (
                SELECT bp2.chr_id, bp2.start_pos,
                       max(hp.signal_value) AS max_signal
                FROM biophysics.sequence_properties bp2
                JOIN regulatory.histone_peaks hp
                    ON hp.build = bp2.build
                    AND hp.chr_id = bp2.chr_id
                    AND hp.coord && bp2.coord
                WHERE bp2.build = $1::genome_build
                  AND hp.mark = $2
                  AND hp.cell_type = $3
                GROUP BY bp2.chr_id, bp2.start_pos
            ) sub
            WHERE bp.build = $1::genome_build
              AND bp.chr_id = sub.chr_id
              AND bp.start_pos = sub.start_pos
        """, build, mark, cell_type)
        hcount = assert_rows_updated(result, context=f"derived_densities {col_name}")
        print(f"    {col_name}: {hcount:,} rows updated")

    # 3. ChromHMM active fraction for monocyte (E029)
    # Active states: 1_TssA, 2_TssAFlnk, 3_TxFlnk, 4_Tx, 5_TxWk, 6_EnhG, 7_Enh
    print("  Computing chromhmm_active_frac_e029...")
    result = await conn.execute("""
        UPDATE biophysics.sequence_properties bp
        SET chromhmm_active_frac_e029 = sub.active_frac
        FROM (
            SELECT bp2.chr_id, bp2.start_pos,
                   sum(
                       CASE WHEN cs.state_id <= 7 THEN
                           GREATEST(0,
                               LEAST(upper(cs.coord), upper(bp2.coord))
                               - GREATEST(lower(cs.coord), lower(bp2.coord))
                           )
                       ELSE 0 END
                   )::float / (upper(bp2.coord) - lower(bp2.coord)) AS active_frac
            FROM biophysics.sequence_properties bp2
            JOIN regulatory.chromatin_state cs
                ON cs.build = bp2.build
                AND cs.chr_id = bp2.chr_id
                AND cs.coord && bp2.coord
            WHERE bp2.build = $1::genome_build
              AND cs.epigenome_id = 'E029'
            GROUP BY bp2.chr_id, bp2.start_pos, bp2.coord
        ) sub
        WHERE bp.build = $1::genome_build
          AND bp.chr_id = sub.chr_id
          AND bp.start_pos = sub.start_pos
    """, build)
    chromhmm_count = assert_rows_updated(result, context="derived_densities chromhmm_active_frac_e029")
    print(f"    chromhmm_active_frac_e029: {chromhmm_count:,} rows updated")

    return count


async def main(build: str = "hg38") -> None:
    conn = await get_ingest_connection(admin=False)

    try:
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'ccre_density'
        """)
        if col_check == 0:
            print("ERROR: ccre_density column not found. Run migration 049 first.")
            return

        sample = await conn.fetchval("""
            SELECT ccre_density FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND ccre_density IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  Derived density data already present for {build}. Skipping.")
            return

        await check_base_rows(conn, build)

        print(f"\n{'='*60}")
        print(f"Derived Density Tracks - {build}")
        print(f"{'='*60}")

        count = await derive_densities(conn, build)
        print(f"\n  Derived density computation complete")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Derive density tracks on sequence_properties",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    args = parser.parse_args()
    asyncio.run(main(args.build))


if __name__ == "__main__":
    cli()
