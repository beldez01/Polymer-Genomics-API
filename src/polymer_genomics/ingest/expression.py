"""Gene expression ingestion from GTEx v10 median TPM (GCT format).

Reads the GTEx v10 gene median TPM GCT file (~56K genes, 54 tissues),
resolves gene coordinates from gene.features, computes summary statistics,
and bulk-loads into expression.gene_tpm via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.expression
    uv run python -m polymer_genomics.ingest.expression --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import statistics
from pathlib import Path

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction
from polymer_genomics.ingest.gene_costs import resolve_gene_coordinates

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# GTEx v10 GCT tissue column names → DB column suffixes
# GCT uses spaces, hyphens, parentheses; DB uses snake_case with tpm_ prefix.
_GTEX_TISSUE_TO_DB: dict[str, str] = {
    "Adipose - Subcutaneous": "adipose_subcutaneous",
    "Adipose - Visceral (Omentum)": "adipose_visceral_omentum",
    "Adrenal Gland": "adrenal_gland",
    "Artery - Aorta": "artery_aorta",
    "Artery - Coronary": "artery_coronary",
    "Artery - Tibial": "artery_tibial",
    "Bladder": "bladder",
    "Brain - Amygdala": "brain_amygdala",
    "Brain - Anterior cingulate cortex (BA24)": "brain_anterior_cingulate_cortex_ba24",
    "Brain - Caudate (basal ganglia)": "brain_caudate_basal_ganglia",
    "Brain - Cerebellar Hemisphere": "brain_cerebellar_hemisphere",
    "Brain - Cerebellum": "brain_cerebellum",
    "Brain - Cortex": "brain_cortex",
    "Brain - Frontal Cortex (BA9)": "brain_frontal_cortex_ba9",
    "Brain - Hippocampus": "brain_hippocampus",
    "Brain - Hypothalamus": "brain_hypothalamus",
    "Brain - Nucleus accumbens (basal ganglia)": "brain_nucleus_accumbens_basal_ganglia",
    "Brain - Putamen (basal ganglia)": "brain_putamen_basal_ganglia",
    "Brain - Spinal cord (cervical c-1)": "brain_spinal_cord_cervical_c1",
    "Brain - Substantia nigra": "brain_substantia_nigra",
    "Breast - Mammary Tissue": "breast_mammary_tissue",
    "Cells - Cultured fibroblasts": "cells_cultured_fibroblasts",
    "Cells - EBV-transformed lymphocytes": "cells_ebv_transformed_lymphocytes",
    "Cervix - Ectocervix": "cervix_ectocervix",
    "Cervix - Endocervix": "cervix_endocervix",
    "Colon - Sigmoid": "colon_sigmoid",
    "Colon - Transverse": "colon_transverse",
    "Esophagus - Gastroesophageal Junction": "esophagus_gastroesophageal_junction",
    "Esophagus - Mucosa": "esophagus_mucosa",
    "Esophagus - Muscularis": "esophagus_muscularis",
    "Fallopian Tube": "fallopian_tube",
    "Heart - Atrial Appendage": "heart_atrial_appendage",
    "Heart - Left Ventricle": "heart_left_ventricle",
    "Kidney - Cortex": "kidney_cortex",
    "Kidney - Medulla": "kidney_medulla",
    "Liver": "liver",
    "Lung": "lung",
    "Minor Salivary Gland": "minor_salivary_gland",
    "Muscle - Skeletal": "muscle_skeletal",
    "Nerve - Tibial": "nerve_tibial",
    "Ovary": "ovary",
    "Pancreas": "pancreas",
    "Pituitary": "pituitary",
    "Prostate": "prostate",
    "Skin - Not Sun Exposed (Suprapubic)": "skin_not_sun_exposed_suprapubic",
    "Skin - Sun Exposed (Lower leg)": "skin_sun_exposed_lower_leg",
    "Small Intestine - Terminal Ileum": "small_intestine_terminal_ileum",
    "Spleen": "spleen",
    "Stomach": "stomach",
    "Testis": "testis",
    "Thyroid": "thyroid",
    "Uterus": "uterus",
    "Vagina": "vagina",
    "Whole Blood": "whole_blood",
}

# Ordered DB tissue suffixes (determines column order in COPY)
_DB_TISSUES: list[str] = [
    "adipose_subcutaneous", "adipose_visceral_omentum", "adrenal_gland",
    "artery_aorta", "artery_coronary", "artery_tibial",
    "bladder",
    "brain_amygdala", "brain_anterior_cingulate_cortex_ba24",
    "brain_caudate_basal_ganglia", "brain_cerebellar_hemisphere",
    "brain_cerebellum", "brain_cortex", "brain_frontal_cortex_ba9",
    "brain_hippocampus", "brain_hypothalamus",
    "brain_nucleus_accumbens_basal_ganglia", "brain_putamen_basal_ganglia",
    "brain_spinal_cord_cervical_c1", "brain_substantia_nigra",
    "breast_mammary_tissue",
    "cells_cultured_fibroblasts", "cells_ebv_transformed_lymphocytes",
    "cervix_ectocervix", "cervix_endocervix",
    "colon_sigmoid", "colon_transverse",
    "esophagus_gastroesophageal_junction", "esophagus_mucosa", "esophagus_muscularis",
    "fallopian_tube",
    "heart_atrial_appendage", "heart_left_ventricle",
    "kidney_cortex", "kidney_medulla",
    "liver", "lung",
    "minor_salivary_gland", "muscle_skeletal", "nerve_tibial",
    "ovary", "pancreas", "pituitary", "prostate",
    "skin_not_sun_exposed_suprapubic", "skin_sun_exposed_lower_leg",
    "small_intestine_terminal_ileum",
    "spleen", "stomach", "testis", "thyroid",
    "uterus", "vagina", "whole_blood",
]

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "gene_symbol", "gene_id",
    "chr_id", "start_pos", "end_pos", "strand",
    "median_tpm", "max_tpm", "max_tissue", "n_tissues_detected",
] + [f"tpm_{t}" for t in _DB_TISSUES]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _safe_float(val: str) -> float | None:
    if not val or val.strip() == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ── GCT reader ───────────────────────────────────────────────────────────────


def read_gct(gct_path: str | Path) -> list[dict]:
    """Parse GTEx v10 GCT median TPM file.

    GCT format:
      Line 1: #1.2
      Line 2: <n_genes> <n_tissues>
      Line 3: header (Name, Description, tissue1, tissue2, ...)
      Lines 4+: data rows
    """
    rows: list[dict] = []

    import gzip
    path = Path(gct_path)
    opener = gzip.open if path.suffix == ".gz" else open

    with opener(path, "rt") as f:
        # Skip format version line
        f.readline()
        # Skip dimensions line
        f.readline()
        # Parse header
        reader = csv.DictReader(f, delimiter="\t")

        for raw in reader:
            gene_id_full = raw.get("Name", "")
            description = raw.get("Description", "")

            # Strip version suffix from ENSG ID
            gene_id = gene_id_full.split(".")[0] if gene_id_full else None

            # Use description as gene symbol (GTEx GCT convention)
            gene_symbol = description.strip() if description else None
            if not gene_symbol:
                continue

            # Parse per-tissue TPM values
            tissue_tpms: dict[str, float | None] = {}
            for gtex_col, db_suffix in _GTEX_TISSUE_TO_DB.items():
                tissue_tpms[db_suffix] = _safe_float(raw.get(gtex_col, ""))

            # Compute summary statistics
            valid_tpms = [v for v in tissue_tpms.values() if v is not None]
            if valid_tpms:
                median_tpm = statistics.median(valid_tpms)
                max_tpm = max(valid_tpms)
                # Find tissue with max TPM
                max_tissue = None
                for db_suffix, val in tissue_tpms.items():
                    if val == max_tpm:
                        max_tissue = db_suffix
                        break
                n_tissues_detected = sum(1 for v in valid_tpms if v > 0.1)
            else:
                median_tpm = None
                max_tpm = None
                max_tissue = None
                n_tissues_detected = 0

            rows.append({
                "gene_symbol": gene_symbol,
                "gene_id": gene_id,
                "median_tpm": median_tpm,
                "max_tpm": max_tpm,
                "max_tissue": max_tissue,
                "n_tissues_detected": n_tissues_detected,
                **{f"tpm_{k}": v for k, v in tissue_tpms.items()},
            })

    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the GTEx v10 expression layer."""
    layer_key = "gtex_v10"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key,
        version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
        VALUES
            ($1, $2, $3, 'expression', $4,
             'GTEx v10 (dbGaP phs000424)', 'open_access', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"GTEx v10 Gene Expression ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    gene: dict,
    coord: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        gene.get("gene_symbol"),
        gene.get("gene_id"),
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        gene.get("median_tpm"),
        gene.get("max_tpm"),
        gene.get("max_tissue"),
        gene.get("n_tissues_detected"),
        *[gene.get(f"tpm_{t}") for t in _DB_TISSUES],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    gct_path: str | Path,
) -> int:
    """Read GCT, resolve coordinates, and bulk-load into expression.gene_tpm."""
    print(f"  Reading GCT file: {gct_path}")
    gene_rows = read_gct(gct_path)
    print(f"  Parsed {len(gene_rows):,} gene entries from GCT")

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for gene in gene_rows:
        symbol = gene.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper())
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, gene, coord)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "gene_tpm",
                records=batch,
                columns=COLUMNS,
                schema_name="expression",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "gene_tpm",
            records=batch,
            columns=COLUMNS,
            schema_name="expression",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    print(f"  Coordinate match: {matched:,} matched, {unmatched:,} unmatched")
    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest GTEx v10 expression data."""
    if builds is None:
        builds = ["hg38"]

    gct_path = os.environ.get(
        "GTEX_MEDIAN_TPM",
        "data/GTEx_Analysis_2022-06-06_v10_RNASeQCv1.1.9_gene_median_tpm.gct.gz",
    )

    if not Path(gct_path).exists():
        print(f"ERROR: GCT file not found at {gct_path}")
        print("Set GTEX_MEDIAN_TPM environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting GTEx v10 expression - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM expression.gene_tpm WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, gct_path)
            print(f"\n  Total expression rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest GTEx v10 gene expression into expression.gene_tpm",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build (default: hg38 only)",
    )
    args = parser.parse_args()

    builds = [args.build] if args.build else None
    asyncio.run(main(builds))


if __name__ == "__main__":
    cli()
