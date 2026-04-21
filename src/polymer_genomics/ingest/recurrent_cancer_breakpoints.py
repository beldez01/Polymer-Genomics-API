"""Recurrent cancer breakpoints ingestion (multi-source).

Populates oncology.recurrent_breakpoints. Designed as the cancer-side input
for Exp 23 orphan-cohort construction.

Primary source: Chen et al. 2021, PLOS Comp Biol (PMC7951985) — ~630,000
breakpoint events aggregated from multiple tumor WGS cohorts with recurrence
annotations.

Secondary source (pre-registered replication): PCAWG consensus SV calls
(requires ICGC DACO access).

Tertiary source (sensitivity): Mitelman full database (cytogenetic resolution).

The schema supports all three via a `source` column. Exp 23 Phase 2 selects
ONE primary source per analysis run; others are sensitivity analyses.

Usage::

    # Chen 2021 ingestion (public supplementary)
    bash scripts/download_chen2021_breakpoints.sh
    uv run python -m polymer_genomics.ingest.recurrent_cancer_breakpoints \\
        --source chen2021 \\
        --input data/cancer_breakpoints_chen2021/breakpoints_hg38.tsv \\
        --dry-run

Prerequisites:
    - Migration 007 applied: `psql -f scripts/migrations/007_recurrent_cancer_breakpoints.sql`
    - Input file downloaded (see download_chen2021_breakpoints.sh)
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
from pathlib import Path

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 10_000

_LAYER_KEY = "recurrent_cancer_breakpoints"

_SOURCE_META = {
    "chen2021": {
        "layer_name": "Cancer Breakpoints — Chen 2021 (PMC7951985)",
        "source_tag": "Chen2021_630K",
        "evidence_class": "M",
        "license_class": "cc_by_4_0",  # PLOS Comp Biol publishes CC-BY
        "citation": "Chen et al. PLOS Comp Biol (2021)",
    },
    "pcawg": {
        "layer_name": "Cancer Breakpoints — PCAWG consensus",
        "source_tag": "PCAWG_consensus",
        "evidence_class": "M",
        "license_class": "restricted",  # DACO-gated
        "citation": "PCAWG Consortium, Nature (2020)",
    },
    "mitelman": {
        "layer_name": "Cancer Breakpoints — Mitelman full",
        "source_tag": "Mitelman_full",
        "evidence_class": "K",  # cytogenetic-curated
        "license_class": "open_access",
        "citation": "Mitelman Database (isb-cgc)",
    },
}


def _resolve_chrom(name: str | None) -> int | None:
    """Normalize chromosome name and resolve to chr_id."""
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    # Accept both 'chr1' and '1' formats
    if not name.startswith("chr") and not name.lower() in {"mt", "m"}:
        name = f"chr{name}"
    return CHR_NAME_TO_ID.get(name)


# ── Chen 2021 parser ─────────────────────────────────────────────────────────

# Expected Chen 2021 supplementary column names (adapt if actual format differs).
# The paper's Table S1-S2 typically include:
#   chrom, start, end, sv_type, recurrence, tumor_types, partner_chrom, partner_start,
#   partner_end, sample_id
_CHEN_FIELD_MAP = {
    "chrom": ["chrom", "chr", "chromosome", "seqnames"],
    "start": ["start", "pos", "start_pos", "breakpoint"],
    "end": ["end", "end_pos"],
    "sv_type": ["sv_type", "type", "svtype", "class"],
    "recurrence": ["recurrence", "recurrence_count", "n_samples", "n_tumors"],
    "tumor_types": ["tumor_types", "tumour_types", "cancer_types", "tissue"],
    "mate_chrom": ["partner_chrom", "mate_chrom", "chrom_2", "chr2"],
    "mate_start": ["partner_start", "mate_start", "pos_2", "start_2"],
    "mate_end": ["partner_end", "mate_end", "end_2"],
    "sample_id": ["sample_id", "tumor_id", "donor_id"],
}


def _find_field(header: list[str], candidates: list[str]) -> str | None:
    """Case-insensitive first-match of any candidate column name."""
    lowered = {h.lower(): h for h in header}
    for c in candidates:
        if c.lower() in lowered:
            return lowered[c.lower()]
    return None


def _parse_chen2021(path: Path) -> list[dict]:
    """Parse Chen 2021 supplementary TSV/CSV into row dicts.

    Auto-detects delimiter (tab or comma) and header column names. If the
    actual Chen 2021 column names differ from _CHEN_FIELD_MAP candidates,
    the parser raises ValueError with a clear message — edit the field map
    and re-run.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Chen 2021 input file missing: {path}\n"
            "Run scripts/download_chen2021_breakpoints.sh and/or manually "
            "retrieve supplementary tables from PMC7951985."
        )

    # Sniff delimiter
    with open(path) as fh:
        sample = fh.read(8192)
    delim = "\t" if sample.count("\t") > sample.count(",") else ","

    with open(path) as fh:
        reader = csv.DictReader(fh, delimiter=delim)
        header = reader.fieldnames or []
        fm = {key: _find_field(header, cands) for key, cands in _CHEN_FIELD_MAP.items()}

        missing = [k for k in ("chrom", "start") if fm[k] is None]
        if missing:
            raise ValueError(
                f"Could not locate required columns {missing} in header: {header}\n"
                "Edit _CHEN_FIELD_MAP candidates in recurrent_cancer_breakpoints.py"
            )

        rows: list[dict] = []
        for i, rec in enumerate(reader):
            chr_id = _resolve_chrom(rec.get(fm["chrom"]))
            if chr_id is None:
                continue
            try:
                start = int(float(rec[fm["start"]]))
            except (KeyError, ValueError, TypeError):
                continue

            end_val = rec.get(fm["end"]) if fm["end"] else None
            try:
                end = int(float(end_val)) if end_val else start + 1
            except (ValueError, TypeError):
                end = start + 1

            mate_chr_id = _resolve_chrom(rec.get(fm["mate_chrom"])) if fm["mate_chrom"] else None
            mate_start = None
            mate_end = None
            if mate_chr_id is not None:
                try:
                    mate_start = int(float(rec[fm["mate_start"]])) if fm["mate_start"] else None
                    mate_end = int(float(rec[fm["mate_end"]])) if fm["mate_end"] else mate_start
                except (ValueError, TypeError):
                    pass

            recurrence = None
            if fm["recurrence"]:
                try:
                    recurrence = int(float(rec[fm["recurrence"]]))
                except (ValueError, TypeError):
                    recurrence = None

            rows.append({
                "chr_id": chr_id,
                "start_pos": start,
                "end_pos": end,
                "sv_type": (rec.get(fm["sv_type"]) or "UNK").strip().upper() if fm["sv_type"] else "UNK",
                "recurrence_count": recurrence,
                "tumor_types": rec.get(fm["tumor_types"]) if fm["tumor_types"] else None,
                "mate_chr_id": mate_chr_id,
                "mate_start": mate_start,
                "mate_end": mate_end,
                "source_id": rec.get(fm["sample_id"]) if fm["sample_id"] else f"Chen2021:row{i}",
                "metadata": {k: v for k, v in rec.items() if k not in fm.values()} or None,
            })
    return rows


# ── Main ─────────────────────────────────────────────────────────────────────

_PARSERS = {
    "chen2021": _parse_chen2021,
    # 'pcawg': _parse_pcawg,       # add when DACO access confirmed
    # 'mitelman': _parse_mitelman, # add for sensitivity analysis
}


async def main(source: str, input_path: str, dry_run: bool = False) -> None:
    if source not in _PARSERS:
        raise SystemExit(
            f"source must be one of {list(_PARSERS)}. "
            "PCAWG and Mitelman parsers to be added in subsequent PRs."
        )

    meta = _SOURCE_META[source]
    parser = _PARSERS[source]

    conn = await get_ingest_connection(admin=True)
    try:
        table_exists = await conn.fetchval(
            """SELECT EXISTS (
                   SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'oncology' AND table_name = 'recurrent_breakpoints'
               )"""
        )
        if not table_exists:
            raise RuntimeError(
                "Table oncology.recurrent_breakpoints does not exist. "
                "Apply scripts/migrations/007_recurrent_cancer_breakpoints.sql first."
            )

        existing = await conn.fetchval(
            "SELECT count(*) FROM oncology.recurrent_breakpoints WHERE source = $1",
            meta["source_tag"],
        )
        if existing > 0:
            print(f"  {meta['source_tag']} already has {existing} rows, skipping.")
            return

        rows = parser(Path(input_path))
        print(f"  Parsed {len(rows)} breakpoint events from {input_path}")

        if not rows:
            print("  [WARN] no rows parsed — check column names + delimiter", file=sys.stderr)
            return

        if dry_run:
            print(f"  [dry run] would insert {len(rows)} rows as source={meta['source_tag']}")
            # Print a sample row for sanity
            sample = rows[0]
            print(f"  sample: {json.dumps({k: v for k, v in sample.items() if k != 'metadata'})}")
            return

        # Register layer (one layer_key, one row per source)
        layer_id = await conn.fetchval(
            "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
            _LAYER_KEY, meta["source_tag"],
        )
        if layer_id is None:
            layer_id = await conn.fetchval(
                """INSERT INTO registry.layers
                   (layer_key, version, name, layer_type, genome_build,
                    source, license_class, storage_type, row_count,
                    is_active, is_default, evidence_class, tier,
                    equilibrium_regime, statefulness, validation_status,
                    interpretability, is_composite)
                   VALUES ($1, $2, $3, 'oncology', 'hg38', $4, $5, 'postgres', 0,
                           true, false, $6, 'active', 'equilibrium',
                           'reference_static', 'externally_validated', 'direct', false)
                   ON CONFLICT (layer_key, version) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id""",
                _LAYER_KEY, meta["source_tag"], meta["layer_name"],
                meta["citation"], meta["license_class"], meta["evidence_class"],
            )

        async with ingest_transaction(conn):
            inserted = 0
            for batch_start in range(0, len(rows), BATCH_SIZE):
                batch = rows[batch_start:batch_start + BATCH_SIZE]
                await conn.executemany(
                    """INSERT INTO oncology.recurrent_breakpoints
                       (layer_id, build, chr_id, start_pos, end_pos,
                        sv_type, recurrence_count, tumor_types,
                        mate_chr_id, mate_start, mate_end,
                        source, source_id, metadata)
                       VALUES ($1, 'hg38', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                       ON CONFLICT DO NOTHING""",
                    [(layer_id, r["chr_id"], r["start_pos"], r["end_pos"],
                      r["sv_type"], r["recurrence_count"], r["tumor_types"],
                      r["mate_chr_id"], r["mate_start"], r["mate_end"],
                      meta["source_tag"], r["source_id"],
                      json.dumps(r["metadata"]) if r["metadata"] else None)
                     for r in batch],
                )
                inserted += len(batch)

            await conn.execute(
                "UPDATE registry.layers SET row_count = $1 WHERE id = $2",
                inserted, layer_id,
            )

        print(f"  Inserted {inserted} {meta['source_tag']} breakpoints.")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest recurrent cancer breakpoints")
    parser.add_argument("--source", required=True, choices=list(_PARSERS.keys()))
    parser.add_argument("--input", required=True, help="Path to source file")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.source, args.input, dry_run=args.dry_run))
