"""COSMIC Cancer Gene Census (Tier 1 + Tier 2) ingestion.

Populates oncology.cosmic_cgc with driver genes annotated with somatic/germline
status, tumor types, role-in-cancer, and translocation partners.

Used by Exp 23 cancer-orphan filter step C5: a cancer breakpoint is orphan only
if it is > 50 kb from any Tier 1 or Tier 2 driver locus.

Source: https://cancer.sanger.ac.uk/census (requires free academic login).

Usage::

    # Stage 1 — download CGC CSV from COSMIC portal (manual, academic license required)
    #   Save to data/cosmic_cgc/cancer_gene_census_v<VERSION>.csv

    # Stage 2 — run ingestion
    uv run python -m polymer_genomics.ingest.cosmic_cgc \\
        --input data/cosmic_cgc/cancer_gene_census_v100.csv \\
        --version v100_GRCh38

Prerequisites:
    - Migration 005 applied: `psql -f scripts/migrations/005_cosmic_cgc.sql`
    - CGC CSV downloaded and placed under data/cosmic_cgc/
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import re
from pathlib import Path

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 1_000

_LAYER_KEY = "cosmic_cgc"
_LAYER_META = {
    "name": "COSMIC Cancer Gene Census",
    "layer_type": "oncology",
    "genome_build": "hg38",
    "source": "COSMIC Cancer Gene Census",
    "license_class": "non_commercial",  # COSMIC academic license
    "storage_type": "postgres",
    "evidence_class": "K",
    "tier": "active",
    "equilibrium_regime": "equilibrium",
    "statefulness": "reference_static",
    "validation_status": "externally_validated",
    "interpretability": "direct",
    "is_composite": False,
}


# ── CGC CSV parsing ──────────────────────────────────────────────────────────

_GENOME_LOC_RE = re.compile(r"(\w+):(\d+)-(\d+)")

# CGC CSV column names (consistent across v100+ releases)
_CGC_COLUMNS = {
    "gene_symbol": "Gene Symbol",
    "entrez_id": "Entrez GeneId",
    "genome_location": "Genome Location",
    "tier": "Tier",
    "hallmark": "Hallmark",
    "somatic": "Somatic",
    "germline": "Germline",
    "tumor_types_somatic": "Tumour Types(Somatic)",
    "tumor_types_germline": "Tumour Types(Germline)",
    "cancer_syndrome": "Cancer Syndrome",
    "tissue_type": "Tissue Type",
    "molecular_genetics": "Molecular Genetics",
    "role_in_cancer": "Role in Cancer",
    "mutation_types": "Mutation Types",
    "translocation_partner": "Translocation Partner",
}


def _parse_genome_location(loc: str | None) -> tuple[str | None, int | None, int | None]:
    """Parse 'chr17:7661779-7687538' → ('chr17', 7661779, 7687538)."""
    if not loc:
        return None, None, None
    m = _GENOME_LOC_RE.match(loc.strip())
    if not m:
        return None, None, None
    chrom_raw, start, end = m.groups()
    chrom = f"chr{chrom_raw}" if not chrom_raw.startswith("chr") else chrom_raw
    return chrom, int(start), int(end)


def _truthy(value: str | None) -> bool:
    if not value:
        return False
    return value.strip().lower() in {"yes", "true", "1", "y"}


def _load_cgc_csv(path: Path, source_version: str) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"COSMIC CGC CSV not found: {path}\n"
            "Download from https://cancer.sanger.ac.uk/census (academic login required)"
        )

    rows = []
    with open(path) as fh:
        reader = csv.DictReader(fh)
        for record in reader:
            tier_raw = record.get(_CGC_COLUMNS["tier"], "").strip()
            if tier_raw not in {"1", "2"}:
                continue  # skip anything that isn't Tier 1 or 2

            chrom, gstart, gend = _parse_genome_location(
                record.get(_CGC_COLUMNS["genome_location"])
            )

            rows.append({
                "gene_symbol": record.get(_CGC_COLUMNS["gene_symbol"], "").strip(),
                "entrez_id": int(record[_CGC_COLUMNS["entrez_id"]]) if record.get(_CGC_COLUMNS["entrez_id"]) else None,
                "chromosome": chrom,
                "genome_start": gstart,
                "genome_end": gend,
                "build": "hg38",
                "tier": int(tier_raw),
                "hallmark": _truthy(record.get(_CGC_COLUMNS["hallmark"])),
                "somatic": _truthy(record.get(_CGC_COLUMNS["somatic"])),
                "germline": _truthy(record.get(_CGC_COLUMNS["germline"])),
                "tumor_types_somatic": record.get(_CGC_COLUMNS["tumor_types_somatic"]) or None,
                "tumor_types_germline": record.get(_CGC_COLUMNS["tumor_types_germline"]) or None,
                "cancer_syndrome": record.get(_CGC_COLUMNS["cancer_syndrome"]) or None,
                "tissue_type": record.get(_CGC_COLUMNS["tissue_type"]) or None,
                "molecular_genetics": record.get(_CGC_COLUMNS["molecular_genetics"]) or None,
                "role_in_cancer": record.get(_CGC_COLUMNS["role_in_cancer"]) or None,
                "mutation_types": record.get(_CGC_COLUMNS["mutation_types"]) or None,
                "translocation_partner": record.get(_CGC_COLUMNS["translocation_partner"]) or None,
                "source_version": source_version,
            })
    return rows


# ── Main ─────────────────────────────────────────────────────────────────────

async def main(input_path: str, source_version: str, dry_run: bool = False) -> None:
    conn = await get_ingest_connection(admin=True)

    try:
        table_exists = await conn.fetchval(
            """SELECT EXISTS (
                   SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'oncology' AND table_name = 'cosmic_cgc'
               )"""
        )
        if not table_exists:
            raise RuntimeError(
                "Table oncology.cosmic_cgc does not exist. "
                "Apply scripts/migrations/005_cosmic_cgc.sql first."
            )

        count = await conn.fetchval(
            "SELECT count(*) FROM oncology.cosmic_cgc WHERE source_version = $1",
            source_version,
        )
        if count > 0:
            print(f"  cosmic_cgc already has {count} rows for version {source_version}, skipping.")
            return

        rows = _load_cgc_csv(Path(input_path), source_version)
        print(f"  Parsed {len(rows)} Tier 1/2 drivers from {input_path}")

        if dry_run:
            print("  [dry run] would insert {} rows".format(len(rows)))
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
                _LAYER_KEY, source_version, _LAYER_META["name"],
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
                    """INSERT INTO oncology.cosmic_cgc
                       (layer_id, gene_symbol, entrez_id, chromosome,
                        genome_start, genome_end, build, tier, hallmark,
                        somatic, germline, tumor_types_somatic, tumor_types_germline,
                        cancer_syndrome, tissue_type, molecular_genetics,
                        role_in_cancer, mutation_types, translocation_partner,
                        source_version)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                               $12, $13, $14, $15, $16, $17, $18, $19, $20)
                       ON CONFLICT (gene_symbol, source_version) DO UPDATE SET
                           tier = EXCLUDED.tier,
                           tumor_types_somatic = EXCLUDED.tumor_types_somatic""",
                    [(layer_id, r["gene_symbol"], r["entrez_id"], r["chromosome"],
                      r["genome_start"], r["genome_end"], r["build"], r["tier"],
                      r["hallmark"], r["somatic"], r["germline"],
                      r["tumor_types_somatic"], r["tumor_types_germline"],
                      r["cancer_syndrome"], r["tissue_type"], r["molecular_genetics"],
                      r["role_in_cancer"], r["mutation_types"],
                      r["translocation_partner"], r["source_version"])
                     for r in batch],
                )
                inserted += len(batch)

            await conn.execute(
                "UPDATE registry.layers SET row_count = $1 WHERE layer_key = $2",
                inserted, _LAYER_KEY,
            )

        print(f"  Inserted {inserted} COSMIC CGC entries (version {source_version}).")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest COSMIC Cancer Gene Census")
    parser.add_argument("--input", required=True, help="Path to CGC CSV")
    parser.add_argument("--version", required=True, help="Source version tag (e.g. v100_GRCh38)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.input, args.version, dry_run=args.dry_run))
