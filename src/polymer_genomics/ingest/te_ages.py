"""TE age estimation — derives insertion ages from RepeatMasker divergence.

Computes estimated_age_mya and age_class from the existing divergence_pct
column on annotation.repeats. Pure SQL derivation, no external data.

Formula: age_mya = (divergence_pct / 100) / (2 * 2.2e-9) / 1e6
  where 2.2e-9 = neutral substitution rate per bp per year

Age classes:
  ancient: >100 Mya (pre-mammalian)
  old:     25-100 Mya (early mammalian radiation)
  recent:  5-25 Mya (primate-specific)
  young:   <5 Mya (human/great ape lineage)

Usage::

    uv run python -m polymer_genomics.ingest.te_ages
"""

from __future__ import annotations

import asyncio

from polymer_genomics.ingest._connection import get_ingest_connection

NEUTRAL_RATE = 2.2e-9  # per bp per year


async def main() -> None:
    conn = await get_ingest_connection(admin=True)

    try:
        # Check if already populated
        sample = await conn.fetchval(
            "SELECT estimated_age_mya FROM annotation.repeats "
            "WHERE estimated_age_mya IS NOT NULL LIMIT 1"
        )
        if sample is not None:
            print("TE ages already computed. Skipping.")
            print(f"  Sample age: {sample:.1f} Mya")
            return

        # Check column exists
        col_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'annotation'
              AND table_name = 'repeats'
              AND column_name = 'estimated_age_mya'
        """)
        if col_check == 0:
            print("ERROR: estimated_age_mya column not found.")
            print("Run migration 058_te_age_columns.sql first.")
            return

        # Count rows to update
        total = await conn.fetchval(
            "SELECT count(*) FROM annotation.repeats WHERE divergence_pct IS NOT NULL"
        )
        print(f"Computing TE ages for {total:,} repeats...")

        result = await conn.execute("""
            UPDATE annotation.repeats SET
                estimated_age_mya = (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6,
                age_class = CASE
                    WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 100 THEN 'ancient'
                    WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 25  THEN 'old'
                    WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 5   THEN 'recent'
                    ELSE 'young'
                END
            WHERE divergence_pct IS NOT NULL
        """)
        print(f"  Result: {result}")

        # Verify
        counts = await conn.fetch("""
            SELECT age_class, count(*) as n
            FROM annotation.repeats
            WHERE age_class IS NOT NULL
            GROUP BY age_class
            ORDER BY age_class
        """)
        print("\n  Age distribution:")
        for row in counts:
            print(f"    {row['age_class']:>8s}: {row['n']:>10,}")

        print("\nDone.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
