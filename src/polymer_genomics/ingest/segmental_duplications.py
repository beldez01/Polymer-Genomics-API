"""UCSC Segmental Duplications ingestion.

Populates structural.segmental_duplications with paired SDs from the UCSC
genomicSuperDups track (Bailey 2001/2002). Used by Exp 23 orphan filters
M4 / C3 to remove breakpoints in NAHR-prone configurations (≥ 95% identity
paired duplications).

Source: UCSC Genome Browser genomicSuperDups table, hg38.
    https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/genomicSuperDups.txt.gz
License: UCSC public (free use).

Usage::

    # Stage 1 — download (first time only)
    bash scripts/download_ucsc_segdups.sh

    # Stage 2 — run ingestion
    uv run python -m polymer_genomics.ingest.segmental_duplications

Prerequisites:
    - Migration 006 applied: `psql -f scripts/migrations/006_segmental_duplications.sql`
    - data/segdups/genomicSuperDups_hg38.txt.gz present
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
from pathlib import Path

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 10_000

_SRC_PATH = Path("data/segdups/genomicSuperDups_hg38.txt.gz")

_LAYER_KEY = "segmental_duplications"
_LAYER_META = {
    "layer_key": _LAYER_KEY,
    "version": "1.0",
    "name": "UCSC Segmental Duplications (genomicSuperDups)",
    "layer_type": "structural",
    "genome_build": "hg38",
    "source": "UCSC genomicSuperDups (Bailey 2001/2002)",
    "license_class": "public_domain",
    "storage_type": "postgres",
    "evidence_class": "K",
    "tier": "intrinsic",
    "equilibrium_regime": "equilibrium",
    "statefulness": "reference_static",
    "validation_status": "externally_validated",
    "interpretability": "direct",
    "is_composite": False,
}

# UCSC genomicSuperDups columns (0-indexed), as documented in table schema:
#   bin, chrom, chromStart, chromEnd, name, score, strand, otherChrom,
#   otherStart, otherEnd, otherSize, uid, posBasesHit, testResult, verdict,
#   chits, ccov, alignfile, alignL, indelN, indelS, alignB, matchB,
#   mismatchB, transitionsB, transversionsB, fracMatch, fracMatchIndel,
#   jcK, k2K
_COL_CHROM = 1
_COL_CHROM_START = 2
_COL_CHROM_END = 3
_COL_NAME = 4
_COL_STRAND = 6
_COL_OTHER_CHROM = 7
_COL_OTHER_START = 8
_COL_OTHER_END = 9
_COL_FRAC_MATCH = 26
_COL_JC_K = 28


def _parse_segdups(path: Path) -> list[tuple]:
    if not path.exists():
        raise FileNotFoundError(
            f"UCSC segdups file missing: {path}\n"
            "Run scripts/download_ucsc_segdups.sh to fetch."
        )

    rows = []
    with gzip.open(path, "rt") as fh:
        for line in fh:
            fields = line.rstrip("\n").split("\t")
            chrom = fields[_COL_CHROM]
            other_chrom = fields[_COL_OTHER_CHROM]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            other_chr_id = CHR_NAME_TO_ID.get(other_chrom)
            if chr_id is None:
                continue  # skip alt/random/unplaced

            start = int(fields[_COL_CHROM_START]) + 1   # BED 0-based → 1-based closed
            end = int(fields[_COL_CHROM_END])
            other_start = int(fields[_COL_OTHER_START]) + 1 if other_chr_id is not None else None
            other_end = int(fields[_COL_OTHER_END]) if other_chr_id is not None else None

            try:
                frac_match = float(fields[_COL_FRAC_MATCH])
            except (IndexError, ValueError):
                frac_match = None
            try:
                jc_k = float(fields[_COL_JC_K])
            except (IndexError, ValueError):
                jc_k = None

            rows.append((
                chr_id, start, end,
                other_chr_id, other_start, other_end,
                fields[_COL_STRAND] or None,
                frac_match,
                jc_k,
                end - start + 1,
                fields[_COL_NAME] or None,
            ))
    return rows


async def main(dry_run: bool = False) -> None:
    conn = await get_ingest_connection(admin=True)

    try:
        table_exists = await conn.fetchval(
            """SELECT EXISTS (
                   SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'structural' AND table_name = 'segmental_duplications'
               )"""
        )
        if not table_exists:
            raise RuntimeError(
                "Table structural.segmental_duplications does not exist. "
                "Apply scripts/migrations/006_segmental_duplications.sql first."
            )

        count = await conn.fetchval(
            "SELECT count(*) FROM structural.segmental_duplications"
        )
        if count > 0:
            print(f"  segmental_duplications already has {count} rows, skipping.")
            return

        rows = _parse_segdups(_SRC_PATH)
        print(f"  Parsed {len(rows)} segmental duplication pairs from {_SRC_PATH}")

        if dry_run:
            print(f"  [dry run] would insert {len(rows)} rows")
            return

        # Register layer
        layer_id = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = $1", _LAYER_KEY,
        )
        if layer_id is None:
            layer_id = await conn.fetchval(
                """INSERT INTO registry.layers
                   (layer_key, version, name, layer_type, genome_build,
                    source, license_class, storage_type, row_count,
                    is_active, is_default, evidence_class, tier,
                    equilibrium_regime, statefulness, validation_status,
                    interpretability, is_composite)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, true, true,
                           $9, $10, $11, $12, $13, $14, $15)
                   ON CONFLICT (layer_key, version) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
                _LAYER_META["layer_key"], _LAYER_META["version"], _LAYER_META["name"],
                _LAYER_META["layer_type"], _LAYER_META["genome_build"], _LAYER_META["source"],
                _LAYER_META["license_class"], _LAYER_META["storage_type"],
                _LAYER_META["evidence_class"], _LAYER_META["tier"],
                _LAYER_META["equilibrium_regime"], _LAYER_META["statefulness"],
                _LAYER_META["validation_status"], _LAYER_META["interpretability"],
                _LAYER_META["is_composite"],
            )

        async with ingest_transaction(conn):
            inserted = 0
            for batch_start in range(0, len(rows), BATCH_SIZE):
                batch = rows[batch_start:batch_start + BATCH_SIZE]
                await conn.executemany(
                    """INSERT INTO structural.segmental_duplications
                       (layer_id, build, chr_id, start_pos, end_pos,
                        match_chr_id, match_start, match_end, strand,
                        frac_match, jc_k, seg_len, name)
                       VALUES ($1, 'hg38', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                       ON CONFLICT DO NOTHING""",
                    [(layer_id, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10])
                     for r in batch],
                )
                inserted += len(batch)

            await conn.execute(
                "UPDATE registry.layers SET row_count = $1 WHERE layer_key = $2",
                inserted, _LAYER_KEY,
            )

        print(f"  Inserted {inserted} segmental duplication pairs.")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest UCSC segmental duplications")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
