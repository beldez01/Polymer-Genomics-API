"""Gene/expression density derivation via UPDATE on biophysics.sequence_properties.

Derives gene_density, gene_bp_fraction, and median_tpm from existing
gene.features and expression.gene_tpm tables using SQL overlap computation.

Follows the greens_function.py UPDATE pattern.

Requires: migration 045_gene_density.sql applied.

Usage::

    uv run python -m polymer_genomics.ingest.gene_density
"""

from __future__ import annotations

import argparse
import asyncio

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows, assert_rows_updated


async def derive_gene_density(conn: asyncpg.Connection, build: str) -> int:
    """Compute gene density metrics from existing tables and UPDATE sequence_properties."""

    # Step 1: Gene density (count of gene features overlapping each 1kb window)
    print("  Computing gene_density...")
    result = await conn.execute("""
        UPDATE biophysics.sequence_properties bp
        SET gene_density = sub.cnt
        FROM (
            SELECT bp2.chr_id, bp2.start_pos, count(*) AS cnt
            FROM biophysics.sequence_properties bp2
            JOIN gene.features gf
                ON gf.build = bp2.build
                AND gf.chr_id = bp2.chr_id
                AND gf.coord && bp2.coord
            WHERE bp2.build = $1::genome_build
              AND gf.feature_type = 'gene'
            GROUP BY bp2.chr_id, bp2.start_pos
        ) sub
        WHERE bp.build = $1::genome_build
          AND bp.chr_id = sub.chr_id
          AND bp.start_pos = sub.start_pos
    """, build)
    gene_density_count = assert_rows_updated(result, context="gene_density")
    print(f"    gene_density updated: {gene_density_count:,} rows")

    # Set windows with no overlapping genes to 0
    await conn.execute("""
        UPDATE biophysics.sequence_properties
        SET gene_density = 0
        WHERE build = $1::genome_build AND gene_density IS NULL
    """, build)

    # Step 2: Gene body fraction (fraction of 1kb window covered by gene bodies)
    print("  Computing gene_bp_fraction...")
    result = await conn.execute("""
        UPDATE biophysics.sequence_properties bp
        SET gene_bp_fraction = sub.frac
        FROM (
            SELECT bp2.chr_id, bp2.start_pos,
                   LEAST(1.0,
                       sum(
                           GREATEST(0,
                               LEAST(upper(gf.coord), upper(bp2.coord))
                               - GREATEST(lower(gf.coord), lower(bp2.coord))
                           )
                       )::float / (upper(bp2.coord) - lower(bp2.coord))
                   ) AS frac
            FROM biophysics.sequence_properties bp2
            JOIN gene.features gf
                ON gf.build = bp2.build
                AND gf.chr_id = bp2.chr_id
                AND gf.coord && bp2.coord
            WHERE bp2.build = $1::genome_build
              AND gf.feature_type = 'gene'
            GROUP BY bp2.chr_id, bp2.start_pos, bp2.coord
        ) sub
        WHERE bp.build = $1::genome_build
          AND bp.chr_id = sub.chr_id
          AND bp.start_pos = sub.start_pos
    """, build)
    bp_frac_count = assert_rows_updated(result, context="gene_density gene_bp_fraction")
    print(f"    gene_bp_fraction updated: {bp_frac_count:,} rows")

    await conn.execute("""
        UPDATE biophysics.sequence_properties
        SET gene_bp_fraction = 0
        WHERE build = $1::genome_build AND gene_bp_fraction IS NULL
    """, build)

    # Step 3: Median TPM from GTEx
    print("  Computing median_tpm...")
    result = await conn.execute("""
        UPDATE biophysics.sequence_properties bp
        SET median_tpm = sub.med_tpm
        FROM (
            SELECT bp2.chr_id, bp2.start_pos,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY gt.median_tpm) AS med_tpm
            FROM biophysics.sequence_properties bp2
            JOIN expression.gene_tpm gt
                ON gt.build = bp2.build
                AND gt.chr_id = bp2.chr_id
                AND gt.coord && bp2.coord
            WHERE bp2.build = $1::genome_build
            GROUP BY bp2.chr_id, bp2.start_pos
        ) sub
        WHERE bp.build = $1::genome_build
          AND bp.chr_id = sub.chr_id
          AND bp.start_pos = sub.start_pos
    """, build)
    tpm_count = assert_rows_updated(result, context="gene_density median_tpm")
    print(f"    median_tpm updated: {tpm_count:,} rows")

    return gene_density_count


async def main(build: str = "hg38") -> None:
    conn = await get_ingest_connection(admin=False)

    try:
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'biophysics'
              AND table_name = 'sequence_properties'
              AND column_name = 'gene_density'
        """)
        if col_check == 0:
            print("ERROR: gene_density column not found. Run migration 045 first.")
            return

        sample = await conn.fetchval("""
            SELECT gene_density FROM biophysics.sequence_properties
            WHERE build = $1::genome_build AND gene_density IS NOT NULL
            LIMIT 1
        """, build)
        if sample is not None:
            print(f"  Gene density data already present for {build}. Skipping.")
            return

        await check_base_rows(conn, build)

        print(f"\n{'='*60}")
        print(f"Gene/Expression Density Derivation - {build}")
        print(f"{'='*60}")

        count = await derive_gene_density(conn, build)
        print(f"\n  Gene density derivation complete: {count:,} windows with genes")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Derive gene/expression density on sequence_properties",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    args = parser.parse_args()
    asyncio.run(main(args.build))


if __name__ == "__main__":
    cli()
