"""Breakpoint and fragile site catalog ingestion.

Populates fragility.breakpoints with:
1. Common fragile sites (CFS) — hg38 coordinates from HumCFS / literature
2. Recurrent translocation breakpoints — hematologic malignancies

Evidence class: K (curated knowledge). All coordinates are hg38.

Usage::

    uv run python -m polymer_genomics.ingest.breakpoints
"""

from __future__ import annotations

import asyncio
import os

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction


# ═══════════════════════════════════════════════════════════════════════════════
# Common Fragile Sites (hg38 coordinates)
# Sources: HumCFS (Mrasek 2010), Debacker & Kooy 2007, Helmrich 2006
# ═══════════════════════════════════════════════════════════════════════════════

_FRAGILE_SITES: list[dict] = [
    # ── Major aphidicolin-inducible CFSs ──
    {"name": "FRA3B", "chr": 3, "start": 59600000, "end": 63700000, "gene_a": "FHIT",
     "source_id": "HumCFS:FRA3B"},
    {"name": "FRA16D", "chr": 16, "start": 78000000, "end": 79500000, "gene_a": "WWOX",
     "source_id": "HumCFS:FRA16D"},
    {"name": "FRA6E", "chr": 6, "start": 159000000, "end": 162000000, "gene_a": "PARK2",
     "source_id": "HumCFS:FRA6E"},
    {"name": "FRA7G", "chr": 7, "start": 114000000, "end": 116000000, "gene_a": "CAV1",
     "source_id": "HumCFS:FRA7G"},
    {"name": "FRA7H", "chr": 7, "start": 129600000, "end": 131000000, "gene_a": "IMMP2L",
     "source_id": "HumCFS:FRA7H"},
    {"name": "FRA2F", "chr": 2, "start": 148000000, "end": 150000000, "gene_a": None,
     "source_id": "HumCFS:FRA2F"},
    {"name": "FRA4F", "chr": 4, "start": 87500000, "end": 88500000, "gene_a": "AFF1",
     "source_id": "HumCFS:FRA4F"},
    {"name": "FRA7I", "chr": 7, "start": 158000000, "end": 159000000, "gene_a": None,
     "source_id": "HumCFS:FRA7I"},
    {"name": "FRA1E", "chr": 1, "start": 155000000, "end": 157000000, "gene_a": "LMNA",
     "source_id": "HumCFS:FRA1E"},
    {"name": "FRA9E", "chr": 9, "start": 107000000, "end": 113000000, "gene_a": None,
     "source_id": "HumCFS:FRA9E"},
    {"name": "FRA1H", "chr": 1, "start": 68000000, "end": 69000000, "gene_a": None,
     "source_id": "HumCFS:FRA1H"},
    {"name": "FRA2G", "chr": 2, "start": 168000000, "end": 170000000, "gene_a": None,
     "source_id": "HumCFS:FRA2G"},
    {"name": "FRA1B", "chr": 1, "start": 11000000, "end": 12000000, "gene_a": None,
     "source_id": "HumCFS:FRA1B"},
    {"name": "FRA2C", "chr": 2, "start": 51000000, "end": 52000000, "gene_a": None,
     "source_id": "HumCFS:FRA2C"},
    {"name": "FRA5C", "chr": 5, "start": 130000000, "end": 131000000, "gene_a": None,
     "source_id": "HumCFS:FRA5C"},
    {"name": "FRA6F", "chr": 6, "start": 111000000, "end": 113000000, "gene_a": "REV3L",
     "source_id": "HumCFS:FRA6F"},
    {"name": "FRA7B", "chr": 7, "start": 1000000, "end": 3000000, "gene_a": None,
     "source_id": "HumCFS:FRA7B"},
    {"name": "FRA8C", "chr": 8, "start": 100000000, "end": 103000000, "gene_a": None,
     "source_id": "HumCFS:FRA8C"},
    {"name": "FRA11B", "chr": 11, "start": 120000000, "end": 122000000, "gene_a": None,
     "source_id": "HumCFS:FRA11B"},
    {"name": "FRA13A", "chr": 13, "start": 33000000, "end": 36000000, "gene_a": "NBEA",
     "source_id": "HumCFS:FRA13A"},
    {"name": "FRA2H", "chr": 2, "start": 206000000, "end": 208000000, "gene_a": None,
     "source_id": "HumCFS:FRA2H"},
    {"name": "FRA4C", "chr": 4, "start": 11000000, "end": 12000000, "gene_a": None,
     "source_id": "HumCFS:FRA4C"},
    {"name": "FRA5D", "chr": 5, "start": 168000000, "end": 171000000, "gene_a": "SLIT3",
     "source_id": "HumCFS:FRA5D"},
    {"name": "FRA10D", "chr": 10, "start": 107000000, "end": 110000000, "gene_a": None,
     "source_id": "HumCFS:FRA10D"},
    {"name": "FRA12A", "chr": 12, "start": 46000000, "end": 47000000, "gene_a": None,
     "source_id": "HumCFS:FRA12A"},
    {"name": "FRA14B", "chr": 14, "start": 72000000, "end": 74000000, "gene_a": None,
     "source_id": "HumCFS:FRA14B"},
    {"name": "FRA15A", "chr": 15, "start": 57000000, "end": 60000000, "gene_a": None,
     "source_id": "HumCFS:FRA15A"},
    {"name": "FRA22B", "chr": 22, "start": 29000000, "end": 31000000, "gene_a": None,
     "source_id": "HumCFS:FRA22B"},
    {"name": "FRAXB", "chr": 23, "start": 6000000, "end": 7500000, "gene_a": "ANOS1",
     "source_id": "HumCFS:FRAXB"},
]


# ═══════════════════════════════════════════════════════════════════════════════
# Recurrent Translocation Breakpoints (hg38)
# Sources: Mitelman Database, COSMIC Structural Variants
# ═══════════════════════════════════════════════════════════════════════════════

_TRANSLOCATIONS: list[dict] = [
    # ── Myeloid malignancies ──
    {"name": "BCR-ABL t(9;22)(q34;q11)", "chr": 22, "start": 23179704, "end": 23318037,
     "gene_a": "BCR", "gene_b": "ABL1", "source_id": "Mitelman:t(9;22)"},
    {"name": "BCR-ABL t(9;22) ABL1 side", "chr": 9, "start": 130713016, "end": 130887675,
     "gene_a": "ABL1", "gene_b": "BCR", "source_id": "Mitelman:t(9;22)"},
    {"name": "PML-RARA t(15;17)(q24;q21) PML", "chr": 15, "start": 73994675, "end": 74047812,
     "gene_a": "PML", "gene_b": "RARA", "source_id": "Mitelman:t(15;17)"},
    {"name": "PML-RARA t(15;17)(q24;q21) RARA", "chr": 17, "start": 40309177, "end": 40357643,
     "gene_a": "RARA", "gene_b": "PML", "source_id": "Mitelman:t(15;17)"},
    {"name": "RUNX1-RUNX1T1 t(8;21)(q22;q22) RUNX1T1", "chr": 8, "start": 92017573, "end": 92106381,
     "gene_a": "RUNX1T1", "gene_b": "RUNX1", "source_id": "Mitelman:t(8;21)"},
    {"name": "RUNX1-RUNX1T1 t(8;21)(q22;q22) RUNX1", "chr": 21, "start": 34787801, "end": 35049344,
     "gene_a": "RUNX1", "gene_b": "RUNX1T1", "source_id": "Mitelman:t(8;21)"},
    {"name": "CBFB-MYH11 inv(16)(p13;q22) CBFB", "chr": 16, "start": 67063019, "end": 67134970,
     "gene_a": "CBFB", "gene_b": "MYH11", "source_id": "Mitelman:inv(16)"},
    {"name": "CBFB-MYH11 inv(16)(p13;q22) MYH11", "chr": 16, "start": 15703138, "end": 15862435,
     "gene_a": "MYH11", "gene_b": "CBFB", "source_id": "Mitelman:inv(16)"},
    {"name": "KMT2A/MLL 11q23 breakpoint", "chr": 11, "start": 118307205, "end": 118397539,
     "gene_a": "KMT2A", "gene_b": None, "source_id": "Mitelman:11q23"},
    {"name": "ETV6-RUNX1 t(12;21)(p13;q22) ETV6", "chr": 12, "start": 11802788, "end": 11979990,
     "gene_a": "ETV6", "gene_b": "RUNX1", "source_id": "Mitelman:t(12;21)"},
    {"name": "NPM1-ALK t(2;5)(p23;q35) NPM1", "chr": 5, "start": 171387119, "end": 171411290,
     "gene_a": "NPM1", "gene_b": "ALK", "source_id": "Mitelman:t(2;5)"},
    {"name": "NPM1-ALK t(2;5)(p23;q35) ALK", "chr": 2, "start": 29192774, "end": 29921566,
     "gene_a": "ALK", "gene_b": "NPM1", "source_id": "Mitelman:t(2;5)"},
    # ── Lymphoid malignancies ──
    {"name": "IGH-BCL2 t(14;18)(q32;q21) BCL2", "chr": 18, "start": 63123346, "end": 63320128,
     "gene_a": "BCL2", "gene_b": "IGH", "source_id": "Mitelman:t(14;18)"},
    {"name": "IGH-BCL2 t(14;18)(q32;q21) IGH", "chr": 14, "start": 105586437, "end": 106879844,
     "gene_a": "IGH", "gene_b": "BCL2", "source_id": "Mitelman:t(14;18)"},
    {"name": "IGH-MYC t(8;14)(q24;q32) MYC", "chr": 8, "start": 127735434, "end": 127742951,
     "gene_a": "MYC", "gene_b": "IGH", "source_id": "Mitelman:t(8;14)"},
    {"name": "IGH-CCND1 t(11;14)(q13;q32) CCND1", "chr": 11, "start": 69455873, "end": 69469242,
     "gene_a": "CCND1", "gene_b": "IGH", "source_id": "Mitelman:t(11;14)"},
    {"name": "IGH-BCL6 t(3;14)(q27;q32) BCL6", "chr": 3, "start": 187721377, "end": 187745725,
     "gene_a": "BCL6", "gene_b": "IGH", "source_id": "Mitelman:t(3;14)"},
    {"name": "IGH-MAF t(14;16)(q32;q23) MAF", "chr": 16, "start": 79593843, "end": 79602250,
     "gene_a": "MAF", "gene_b": "IGH", "source_id": "Mitelman:t(14;16)"},
    # ── Solid tumors (key fusions) ──
    {"name": "TMPRSS2-ERG t(21;21) fusion", "chr": 21, "start": 41473301, "end": 41508158,
     "gene_a": "TMPRSS2", "gene_b": "ERG", "source_id": "COSMIC:TMPRSS2-ERG"},
    {"name": "EML4-ALK inv(2)(p21;p23)", "chr": 2, "start": 42169588, "end": 42332548,
     "gene_a": "EML4", "gene_b": "ALK", "source_id": "COSMIC:EML4-ALK"},
]


async def main() -> None:
    """Populate fragility.breakpoints table."""
    conn = await get_ingest_connection(admin=True)

    try:
        # Check for existing data
        count = await conn.fetchval("SELECT count(*) FROM fragility.breakpoints")
        if count > 0:
            print(f"  breakpoints already has {count} rows, skipping.")
            return

        # Resolve layer_id
        layer_id = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = 'breakpoints'"
        )
        if layer_id is None:
            # Register the layer
            layer_id = await conn.fetchval(
                """INSERT INTO registry.layers
                   (layer_key, version, name, layer_type, genome_build,
                    source, license_class, storage_type, row_count,
                    is_active, is_default, evidence_class, tier,
                    equilibrium_regime, statefulness, validation_status,
                    interpretability, is_composite)
                   VALUES ('breakpoints', '1.0', 'Breakpoint / Fragile Site Catalog',
                           'regulatory', 'hg38', 'HumCFS + Mitelman + COSMIC',
                           'mixed', 'postgres', 0, true, true,
                           'K', 'intrinsic', 'equilibrium', 'reference_static',
                           'externally_validated', 'direct', true)
                   ON CONFLICT (layer_key, version) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
            )

        async with ingest_transaction(conn):
            # Insert fragile sites
            n_fs = 0
            for fs in _FRAGILE_SITES:
                await conn.execute(
                    """INSERT INTO fragility.breakpoints
                       (layer_id, build, chr_id, start_pos, end_pos,
                        breakpoint_type, name, gene_a, gene_b, source, source_id)
                       VALUES ($1, 'hg38', $2, $3, $4, 'fragile_site', $5, $6, NULL, 'HumCFS', $7)
                       ON CONFLICT DO NOTHING""",
                    layer_id, fs["chr"], fs["start"], fs["end"],
                    fs["name"], fs.get("gene_a"), fs["source_id"],
                )
                n_fs += 1

            # Insert translocations
            n_tx = 0
            for tx in _TRANSLOCATIONS:
                source = "COSMIC" if tx["source_id"].startswith("COSMIC:") else "Mitelman"
                await conn.execute(
                    """INSERT INTO fragility.breakpoints
                       (layer_id, build, chr_id, start_pos, end_pos,
                        breakpoint_type, name, gene_a, gene_b, source, source_id)
                       VALUES ($1, 'hg38', $2, $3, $4, 'translocation', $5, $6, $7, $8, $9)
                       ON CONFLICT DO NOTHING""",
                    layer_id, tx["chr"], tx["start"], tx["end"],
                    tx["name"], tx["gene_a"], tx.get("gene_b"), source, tx["source_id"],
                )
                n_tx += 1

            total = n_fs + n_tx

            # Update catalog row count
            await conn.execute(
                "UPDATE reference.catalog SET row_count = $1 WHERE table_name = 'breakpoints'",
                total,
            )
            await conn.execute(
                "UPDATE registry.layers SET row_count = $1 WHERE layer_key = 'breakpoints'",
                total,
            )

        print(f"  Inserted {total} breakpoints ({n_fs} fragile sites, {n_tx} translocations).")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
