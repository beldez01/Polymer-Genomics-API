"""Imprinted gene and ICR reference table ingestion.

Loads well-established imprinted genes into ref.imprinted_genes.
Source: geneimprint.com, Monk et al. 2019 Nat Rev Genet.

Usage::

    uv run python -m polymer_genomics.ingest.imprinting
"""

from __future__ import annotations

import asyncio

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Embedded data ────────────────────────────────────────────────────────────

# (gene_symbol, expressed_allele, imprint_status, chromosome)
_IMPRINTED_GENES = [
    # Paternally expressed (maternal allele silenced)
    ("IGF2", "paternal", "confirmed", "chr11"),
    ("DLK1", "paternal", "confirmed", "chr14"),
    ("PEG3", "paternal", "confirmed", "chr19"),
    ("PEG10", "paternal", "confirmed", "chr7"),
    ("MEST", "paternal", "confirmed", "chr7"),
    ("SNRPN", "paternal", "confirmed", "chr15"),
    ("NDN", "paternal", "confirmed", "chr15"),
    ("MAGEL2", "paternal", "confirmed", "chr15"),
    ("MKRN3", "paternal", "confirmed", "chr15"),
    ("PLAGL1", "paternal", "confirmed", "chr6"),
    ("SGCE", "paternal", "confirmed", "chr7"),
    ("KCNQ1OT1", "paternal", "confirmed", "chr11"),
    ("RTL1", "paternal", "confirmed", "chr14"),
    ("DIRAS3", "paternal", "confirmed", "chr1"),
    ("NNAT", "paternal", "confirmed", "chr20"),
    ("INPP5F", "paternal", "confirmed", "chr10"),
    ("NAP1L5", "paternal", "confirmed", "chr4"),
    ("L3MBTL1", "paternal", "confirmed", "chr20"),
    ("ZDBF2", "paternal", "confirmed", "chr2"),
    ("FAM50B", "paternal", "confirmed", "chr6"),
    # Maternally expressed (paternal allele silenced)
    ("H19", "maternal", "confirmed", "chr11"),
    ("MEG3", "maternal", "confirmed", "chr14"),
    ("GRB10", "maternal", "confirmed", "chr7"),
    ("UBE3A", "maternal", "confirmed", "chr15"),
    ("ATP10A", "maternal", "confirmed", "chr15"),
    ("CDKN1C", "maternal", "confirmed", "chr11"),
    ("PHLDA2", "maternal", "confirmed", "chr11"),
    ("SLC22A18", "maternal", "confirmed", "chr11"),
    ("KCNQ1", "maternal", "confirmed", "chr11"),
    ("TP73", "maternal", "confirmed", "chr1"),
    ("RB1", "maternal", "predicted", "chr13"),
    ("ZNF331", "maternal", "confirmed", "chr19"),
    ("MEG8", "maternal", "confirmed", "chr14"),
    ("GNAS", "maternal", "confirmed", "chr20"),
    ("PPP1R9A", "maternal", "confirmed", "chr7"),
    ("KLF14", "maternal", "confirmed", "chr7"),
    ("WT1", "maternal", "confirmed", "chr11"),
    ("AIM1", "maternal", "predicted", "chr6"),
]


async def main() -> None:
    conn = await get_ingest_connection(admin=True)

    try:
        # Check table exists
        table_check = await conn.fetchval("""
            SELECT count(*) FROM information_schema.tables
            WHERE table_schema = 'ref' AND table_name = 'imprinted_genes'
        """)
        if table_check == 0:
            print("ERROR: ref.imprinted_genes table not found.")
            print("Run migration 059_ref_imprinting.sql first.")
            return

        # Check existing data
        existing = await conn.fetchval("SELECT count(*) FROM ref.imprinted_genes")
        if existing > 0:
            print(f"ref.imprinted_genes already has {existing} rows. Skipping.")
            return

        print(f"Loading {len(_IMPRINTED_GENES)} imprinted genes...")

        async with ingest_transaction(conn):
            for gene, allele, status, chrom in _IMPRINTED_GENES:
                await conn.execute(
                    """INSERT INTO ref.imprinted_genes
                       (gene_symbol, expressed_allele, imprint_status, chromosome)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (gene_symbol) DO NOTHING""",
                    gene, allele, status, chrom,
                )

        final = await conn.fetchval("SELECT count(*) FROM ref.imprinted_genes")
        print(f"  Loaded {final} imprinted genes.")

        # Summary
        counts = await conn.fetch("""
            SELECT expressed_allele, count(*) as n
            FROM ref.imprinted_genes
            GROUP BY expressed_allele
        """)
        for row in counts:
            print(f"    {row['expressed_allele']}: {row['n']}")

        print("\nDone. (ICR coordinates deferred to liftOver step.)")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
