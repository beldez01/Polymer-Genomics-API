"""PRDM9 motif catalog ingestion.

Populates recombination.prdm9_motifs with two complementary sources:

1. **Altemose et al. 2017** (eLife 6:e28383) — experimentally validated
   PRDM9 binding peaks via ChIP-seq in human testis. Direct coordinate import.
   Evidence class: M (measured).

2. **Myers 2008 / 2010 13-mer motif** — PWM scanned against hg38 reference.
   Supports A, B, C alleles. Evidence class: D (derived).

Used by Exp 23 orphan filter M1: a DMC1 peak is PRDM9-directed (i.e. NOT orphan)
if any allele's 13-mer matches within ±1 kb.

Usage::

    # Stage 1 — download source data (first time only)
    bash scripts/download_prdm9_sources.sh

    # Stage 2 — run ingestion (populates recombination.prdm9_motifs)
    uv run python -m polymer_genomics.ingest.prdm9_motifs

Prerequisites:
    - Migration 004 applied: `psql -f scripts/migrations/004_prdm9_motifs.sql`
    - Source files present under data/prdm9_catalog/ (see _ALTEMOSE_PEAKS_PATH, _MYERS_PWM_PATH)
"""

from __future__ import annotations

import argparse
import asyncio
import csv
from pathlib import Path

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Paths ────────────────────────────────────────────────────────────────────

_DATA_ROOT = Path("data/prdm9_catalog")
_ALTEMOSE_PEAKS_PATH = _DATA_ROOT / "altemose_2017" / "prdm9_chipseq_peaks_hg38.bed"
_MYERS_PWM_PATH = _DATA_ROOT / "myers_2008" / "prdm9_13mer_pwm.json"
_MYERS_SCAN_OUTPUT = _DATA_ROOT / "myers_2008" / "prdm9_pwm_hits_hg38.bed.gz"

# PWM scanner threshold. Altemose 2017 reports log-odds ≥ 8 as high-confidence.
_PWM_LOG_ODDS_THRESHOLD = 8.0

# Insert batch size
BATCH_SIZE = 5_000


# ── Layer registration ───────────────────────────────────────────────────────

_LAYER_KEY = "prdm9_motifs"
_LAYER_VERSION = "1.0"

_LAYER_META = {
    "layer_key": _LAYER_KEY,
    "version": _LAYER_VERSION,
    "name": "PRDM9 Binding Motif Catalog",
    "layer_type": "regulatory",
    "genome_build": "hg38",
    "source": "Altemose 2017 eLife (ChIP-seq peaks) + Myers 2008/2010 Science (13-mer PWM)",
    "license_class": "mixed",
    "storage_type": "postgres",
    "evidence_class": "M",  # primary = validated peaks; PWM rows flagged D at row level
    "tier": "intrinsic",
    "equilibrium_regime": "equilibrium",
    "statefulness": "reference_static",
    "validation_status": "externally_validated",
    "interpretability": "direct",
    "is_composite": True,  # mix of M + D rows
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _load_altemose_peaks(path: Path) -> list[dict]:
    """Parse Altemose 2017 ChIP-seq peak BED file.

    Expected columns (BED 6+): chrom, start, end, name, score, strand
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Altemose 2017 peak file missing: {path}\n"
            "Run scripts/download_prdm9_sources.sh to fetch."
        )
    rows = []
    with open(path) as fh:
        reader = csv.reader(fh, delimiter="\t")
        for i, row in enumerate(reader):
            if not row or row[0].startswith("#"):
                continue
            chrom = row[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue  # skip alts, random, etc.
            rows.append({
                "chr_id": chr_id,
                "start_pos": int(row[1]) + 1,   # BED is 0-based half-open → 1-based closed
                "end_pos": int(row[2]),
                "strand": row[5] if len(row) > 5 else None,
                "allele": "validated",
                "source": "altemose_2017_chipseq",
                "score": float(row[4]) if len(row) > 4 and row[4] else None,
                "source_id": f"Altemose2017:peak_{i}",
            })
    return rows


def _load_myers_pwm_hits(path: Path) -> list[dict]:
    """Parse Myers 2008 PWM scan output.

    Expected columns (BED-like .gz): chrom, start, end, allele, log_odds, strand

    NOTE: The PWM scan itself runs as a separate offline step via
    `scripts/scan_prdm9_pwm.py` which produces the thresholded hits file.
    This loader just consumes the BED-like output.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Myers PWM scan output missing: {path}\n"
            "Run scripts/scan_prdm9_pwm.py first (requires BioPython + hg38.fa)."
        )
    import gzip

    rows = []
    with gzip.open(path, "rt") as fh:
        reader = csv.reader(fh, delimiter="\t")
        for i, row in enumerate(reader):
            if not row or row[0].startswith("#"):
                continue
            chrom = row[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue
            allele = row[3]  # 'A', 'B', 'C'
            log_odds = float(row[4])
            if log_odds < _PWM_LOG_ODDS_THRESHOLD:
                continue
            rows.append({
                "chr_id": chr_id,
                "start_pos": int(row[1]) + 1,
                "end_pos": int(row[2]),
                "strand": row[5] if len(row) > 5 else None,
                "allele": allele,
                "source": "myers_2008_pwm",
                "score": log_odds,
                "source_id": f"Myers2008:{allele}_{i}",
            })
    return rows


# ── Main ─────────────────────────────────────────────────────────────────────

async def main(dry_run: bool = False) -> None:
    """Populate recombination.prdm9_motifs."""
    conn = await get_ingest_connection(admin=True)

    try:
        # Ensure migration has been applied
        table_exists = await conn.fetchval(
            """SELECT EXISTS (
                   SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'recombination' AND table_name = 'prdm9_motifs'
               )"""
        )
        if not table_exists:
            raise RuntimeError(
                "Table recombination.prdm9_motifs does not exist. "
                "Apply scripts/migrations/004_prdm9_motifs.sql first."
            )

        # Idempotency
        count = await conn.fetchval("SELECT count(*) FROM recombination.prdm9_motifs")
        if count > 0:
            print(f"  prdm9_motifs already has {count} rows, skipping.")
            return

        # Load sources — Altemose peaks optional (skipped if file absent)
        if _ALTEMOSE_PEAKS_PATH.exists():
            altemose_rows = _load_altemose_peaks(_ALTEMOSE_PEAKS_PATH)
            print(f"  Altemose 2017: loaded {len(altemose_rows)} validated peaks")
        else:
            altemose_rows = []
            print(f"  Altemose 2017: peak file absent ({_ALTEMOSE_PEAKS_PATH}), skipping")

        myers_rows = _load_myers_pwm_hits(_MYERS_SCAN_OUTPUT)
        print(f"  Myers 2008 PWM (log_odds ≥ {_PWM_LOG_ODDS_THRESHOLD}): loaded {len(myers_rows)} hits")

        if dry_run:
            print("  [dry run] would insert {} total rows".format(
                len(altemose_rows) + len(myers_rows)))
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

        # Insert in transaction
        all_rows = altemose_rows + myers_rows
        async with ingest_transaction(conn):
            inserted = 0
            for batch_start in range(0, len(all_rows), BATCH_SIZE):
                batch = all_rows[batch_start:batch_start + BATCH_SIZE]
                await conn.executemany(
                    """INSERT INTO recombination.prdm9_motifs
                       (layer_id, build, chr_id, start_pos, end_pos,
                        strand, allele, source, score, source_id)
                       VALUES ($1, 'hg38', $2, $3, $4, $5, $6, $7, $8, $9)
                       ON CONFLICT DO NOTHING""",
                    [(layer_id, r["chr_id"], r["start_pos"], r["end_pos"],
                      r["strand"], r["allele"], r["source"], r["score"], r["source_id"])
                     for r in batch],
                )
                inserted += len(batch)

            await conn.execute(
                "UPDATE registry.layers SET row_count = $1 WHERE layer_key = $2",
                inserted, _LAYER_KEY,
            )

        print(f"  Inserted {inserted} PRDM9 motif entries.")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest PRDM9 motif catalog")
    parser.add_argument("--dry-run", action="store_true", help="Load + validate but don't insert")
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
