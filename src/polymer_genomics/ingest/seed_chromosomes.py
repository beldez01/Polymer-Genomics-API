"""Seed ref.chromosomes with hg37 and hg38 chromosome lengths.

The init.sql schema inserts chr_id + chr_name for all 25 chromosomes but
leaves length_hg37 and length_hg38 as NULL.  This script fills those columns
with the canonical lengths from UCSC (public domain reference data).

Usage::

    uv run python -m polymer_genomics.ingest.seed_chromosomes
"""

from __future__ import annotations

import asyncio

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection

# ── Canonical chromosome lengths (UCSC) ─────────────────────────────────────

HG38_LENGTHS: dict[str, int] = {
    "chr1": 248956422,
    "chr2": 242193529,
    "chr3": 198295559,
    "chr4": 190214555,
    "chr5": 181538259,
    "chr6": 170805979,
    "chr7": 159345973,
    "chr8": 145138636,
    "chr9": 138394717,
    "chr10": 133797422,
    "chr11": 135086622,
    "chr12": 133275309,
    "chr13": 114364328,
    "chr14": 107043718,
    "chr15": 101991189,
    "chr16": 90338345,
    "chr17": 83257441,
    "chr18": 80373285,
    "chr19": 58617616,
    "chr20": 64444167,
    "chr21": 46709983,
    "chr22": 50818468,
    "chrX": 156040895,
    "chrY": 57227415,
    "chrM": 16569,
}

HG37_LENGTHS: dict[str, int] = {
    "chr1": 249250621,
    "chr2": 243199373,
    "chr3": 198022430,
    "chr4": 191154276,
    "chr5": 180915260,
    "chr6": 171115067,
    "chr7": 159138663,
    "chr8": 146364022,
    "chr9": 141213431,
    "chr10": 135534747,
    "chr11": 135006516,
    "chr12": 133851895,
    "chr13": 115169878,
    "chr14": 107349540,
    "chr15": 102531392,
    "chr16": 90354753,
    "chr17": 81195210,
    "chr18": 78077248,
    "chr19": 59128983,
    "chr20": 63025520,
    "chr21": 48129895,
    "chr22": 51304566,
    "chrX": 155270560,
    "chrY": 59373566,
    "chrM": 16571,
}

EXPECTED_CHROMOSOMES = 25


async def seed_chromosomes(conn: asyncpg.Connection) -> int:
    """Update ref.chromosomes with hg37 and hg38 lengths.

    Parameters
    ----------
    conn
        An asyncpg connection with UPDATE privilege on ref.chromosomes
        (admin or ingest_writer with appropriate grants).

    Returns
    -------
    int
        Number of rows updated.
    """
    updated = 0
    for chr_name in HG38_LENGTHS:
        result = await conn.execute(
            """
            UPDATE ref.chromosomes
            SET length_hg38 = $1,
                length_hg37 = $2
            WHERE chr_name = $3
            """,
            HG38_LENGTHS[chr_name],
            HG37_LENGTHS[chr_name],
            chr_name,
        )
        # asyncpg returns e.g. "UPDATE 1"
        count = int(result.split()[-1])
        updated += count

    return updated


async def main() -> None:
    """Connect as admin and seed chromosome lengths."""
    conn = await get_ingest_connection(admin=True)

    try:
        updated = await seed_chromosomes(conn)
        print(f"Seeded {updated} chromosome length records.")

        # Verification: print a summary
        rows = await conn.fetch(
            "SELECT chr_name, length_hg37, length_hg38 FROM ref.chromosomes ORDER BY chr_id"
        )
        print(f"\n{'chr_name':<8} {'hg37':>12} {'hg38':>12}")
        print("-" * 34)
        for row in rows:
            print(f"{row['chr_name']:<8} {row['length_hg37']:>12,} {row['length_hg38']:>12,}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
