"""Gene bioenergetic cost ingestion into bioenergetics.gene_costs.

Reads the reference gene cost table (TSV with 93 columns from UniProt, GTEx,
and CodonStatsDB), resolves gene coordinates from gene.features, and bulk-loads
via the COPY protocol.

The ``bioenergetics.gene_costs`` table is non-partitioned (~20K rows).

Usage::

    uv run python -m polymer_genomics.ingest.gene_costs
    uv run python -m polymer_genomics.ingest.gene_costs --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Column list matching the CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    # Identity
    "gene_symbol", "uniprot_id", "protein_name",
    # Genomic
    "chr_id", "start_pos", "end_pos", "strand",
    # Protein
    "protein_length",
    # Biosynthetic cost
    "ecpa_b20", "ecpa_h11", "c_protein", "c_aa_synthesis", "c_translation",
    # Elemental
    "n_protein", "s_protein", "c_atoms", "mw_kda", "cost_per_kda", "n_per_kda", "s_per_kda",
    # Composition
    "frac_cheap", "frac_moderate", "frac_expensive", "frac_very_expensive",
    "n_cys", "n_met", "n_trp", "n_arg", "n_lys",
    # Codon
    "cds_length_nt", "n_codons", "gc3", "gc_cds", "cai", "tai", "enc", "fop",
    # Expression summary
    "mean_tpm", "max_tpm",
    # Per-tissue TPM (24)
    "tpm_brain", "tpm_heart", "tpm_kidney", "tpm_liver", "tpm_muscle",
    "tpm_adipose", "tpm_whole_blood", "tpm_lung", "tpm_pancreas", "tpm_stomach",
    "tpm_small_intestine", "tpm_skin", "tpm_testis", "tpm_ovary", "tpm_thyroid",
    "tpm_spleen", "tpm_nerve", "tpm_artery", "tpm_colon", "tpm_esophagus",
    "tpm_prostate", "tpm_pituitary", "tpm_breast", "tpm_uterus",
    # Per-tissue EWGC (24)
    "ewgc_brain", "ewgc_heart", "ewgc_kidney", "ewgc_liver", "ewgc_muscle",
    "ewgc_adipose", "ewgc_whole_blood", "ewgc_lung", "ewgc_pancreas", "ewgc_stomach",
    "ewgc_small_intestine", "ewgc_skin", "ewgc_testis", "ewgc_ovary", "ewgc_thyroid",
    "ewgc_spleen", "ewgc_nerve", "ewgc_artery", "ewgc_colon", "ewgc_esophagus",
    "ewgc_prostate", "ewgc_pituitary", "ewgc_breast", "ewgc_uterus",
]

# TSV header -> DB column mapping for non-trivial renames
_HEADER_MAP: dict[str, str] = {
    "uniprot_id": "uniprot_id",
    "gene_symbol": "gene_symbol",
    "protein_name": "protein_name",
    "protein_length": "protein_length",
    "ECPAgene_B20": "ecpa_b20",
    "ECPAgene_H11": "ecpa_h11",
    "C_protein_total": "c_protein",
    "C_aa_synthesis": "c_aa_synthesis",
    "C_translation": "c_translation",
    "N_protein": "n_protein",
    "S_protein": "s_protein",
    "C_atoms": "c_atoms",
    "MW_kDa": "mw_kda",
    "cost_per_kDa": "cost_per_kda",
    "N_per_kDa": "n_per_kda",
    "S_per_kDa": "s_per_kda",
    "frac_cheap": "frac_cheap",
    "frac_moderate": "frac_moderate",
    "frac_expensive": "frac_expensive",
    "frac_very_expensive": "frac_very_expensive",
    "n_Cys": "n_cys",
    "n_Met": "n_met",
    "n_Trp": "n_trp",
    "n_Arg": "n_arg",
    "n_Lys": "n_lys",
    "cds_length_nt": "cds_length_nt",
    "n_codons": "n_codons",
    "GC3": "gc3",
    "GC_cds": "gc_cds",
    "CAI": "cai",
    "tAI": "tai",
    "ENC": "enc",
    "Fop": "fop",
    "CAI_correct": "cai_correct",
    "tAI_correct": "tai_correct",
    "mean_TPM_all": "mean_tpm",
    "max_TPM": "max_tpm",
    "MW_Da": "mw_da",
    "standard_aa": "standard_aa",
    "non_standard_aa": "non_standard_aa",
    "entry_name": "entry_name",
    "mt_CAI": "mt_cai",
    "mt_tAI": "mt_tai",
    "mt_ENC": "mt_enc",
    "mt_Fop": "mt_fop",
}

# Tissue columns (TSV header prefix -> db column prefix)
_TISSUES = [
    "Brain", "Heart", "Kidney", "Liver", "Muscle", "Adipose",
    "Whole_Blood", "Lung", "Pancreas", "Stomach", "Small_Intestine",
    "Skin", "Testis", "Ovary", "Thyroid", "Spleen", "Nerve", "Artery",
    "Colon", "Esophagus", "Prostate", "Pituitary", "Breast", "Uterus",
]

for tissue in _TISSUES:
    _HEADER_MAP[f"TPM_{tissue}"] = f"tpm_{tissue.lower()}"
    _HEADER_MAP[f"EWGC_{tissue}"] = f"ewgc_{tissue.lower()}"

# Columns that should be parsed as int
_INT_COLS = {
    "protein_length", "n_protein", "s_protein", "c_atoms",
    "n_cys", "n_met", "n_trp", "n_arg", "n_lys",
    "cds_length_nt", "n_codons", "standard_aa", "non_standard_aa",
}

# Columns that should be parsed as float
_FLOAT_COLS = {
    "ecpa_b20", "ecpa_h11", "c_protein", "c_aa_synthesis", "c_translation",
    "mw_kda", "mw_da", "cost_per_kda", "n_per_kda", "s_per_kda",
    "frac_cheap", "frac_moderate", "frac_expensive", "frac_very_expensive",
    "gc3", "gc_cds", "cai", "tai", "enc", "fop",
    "cai_correct", "tai_correct",
    "mt_cai", "mt_tai", "mt_enc", "mt_fop",
    "mean_tpm", "max_tpm",
}
for tissue in _TISSUES:
    _FLOAT_COLS.add(f"tpm_{tissue.lower()}")
    _FLOAT_COLS.add(f"ewgc_{tissue.lower()}")


# ── Helpers ──────────────────────────────────────────────────────────────────


def _safe_int(val: str) -> int | None:
    if not val or val.strip() == "":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _safe_float(val: str) -> float | None:
    if not val or val.strip() == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ── TSV reader ───────────────────────────────────────────────────────────────


def read_cost_table(tsv_path: str | Path) -> list[dict]:
    """Parse the reference gene cost TSV, mapping headers to DB column names."""
    rows: list[dict] = []
    with open(tsv_path, newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for raw in reader:
            mapped: dict = {}
            for tsv_col, value in raw.items():
                db_col = _HEADER_MAP.get(tsv_col)
                if db_col is None:
                    continue
                if db_col in _INT_COLS:
                    mapped[db_col] = _safe_int(value)
                elif db_col in _FLOAT_COLS:
                    mapped[db_col] = _safe_float(value)
                else:
                    mapped[db_col] = value if value else None
            # Skip rows without gene symbol
            if not mapped.get("gene_symbol"):
                continue
            rows.append(mapped)
    return rows


# ── Gene coordinate resolution ───────────────────────────────────────────────


async def resolve_gene_coordinates(
    conn: asyncpg.Connection,
    build: str,
) -> dict[str, dict]:
    """Query gene.features for gene-level coordinates.

    Returns a dict keyed by uppercase gene_symbol with
    {chr_id, start_pos, end_pos, strand}.
    """
    rows = await conn.fetch(
        """
        SELECT gene_symbol, chr_id, start_pos, end_pos, strand
        FROM gene.features
        WHERE build = $1::genome_build
          AND feature_type = 'gene'
        ORDER BY gene_symbol, start_pos
        """,
        build,
    )
    lookup: dict[str, dict] = {}
    for r in rows:
        sym = r["gene_symbol"]
        if sym and sym.upper() not in lookup:
            lookup[sym.upper()] = {
                "chr_id": r["chr_id"],
                "start_pos": r["start_pos"],
                "end_pos": r["end_pos"],
                "strand": r["strand"],
            }
    return lookup


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the gene_costs layer."""
    layer_key = "gene_costs_v1"
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
            ($1, $2, $3, 'gene_cost', $4,
             'derived:UniProt+GTEx+CodonStatsDB', 'mixed', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Gene Bioenergetic Costs ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    cost: dict,
    coord: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    # Use CAI_correct / tAI_correct for MT genes if available
    cai = cost.get("cai_correct") or cost.get("cai")
    tai = cost.get("tai_correct") or cost.get("tai")

    return (
        layer_id, build,
        # Identity
        cost.get("gene_symbol"),
        cost.get("uniprot_id"),
        cost.get("protein_name"),
        # Genomic
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        # Protein
        cost.get("protein_length"),
        # Biosynthetic cost
        cost.get("ecpa_b20"),
        cost.get("ecpa_h11"),
        cost.get("c_protein"),
        cost.get("c_aa_synthesis"),
        cost.get("c_translation"),
        # Elemental
        cost.get("n_protein"),
        cost.get("s_protein"),
        cost.get("c_atoms"),
        cost.get("mw_kda"),
        cost.get("cost_per_kda"),
        cost.get("n_per_kda"),
        cost.get("s_per_kda"),
        # Composition
        cost.get("frac_cheap"),
        cost.get("frac_moderate"),
        cost.get("frac_expensive"),
        cost.get("frac_very_expensive"),
        cost.get("n_cys"),
        cost.get("n_met"),
        cost.get("n_trp"),
        cost.get("n_arg"),
        cost.get("n_lys"),
        # Codon
        cost.get("cds_length_nt"),
        cost.get("n_codons"),
        cost.get("gc3"),
        cost.get("gc_cds"),
        cai,
        tai,
        cost.get("enc"),
        cost.get("fop"),
        # Expression summary
        cost.get("mean_tpm"),
        cost.get("max_tpm"),
        # Per-tissue TPM (24)
        cost.get("tpm_brain"), cost.get("tpm_heart"), cost.get("tpm_kidney"),
        cost.get("tpm_liver"), cost.get("tpm_muscle"), cost.get("tpm_adipose"),
        cost.get("tpm_whole_blood"), cost.get("tpm_lung"), cost.get("tpm_pancreas"),
        cost.get("tpm_stomach"), cost.get("tpm_small_intestine"), cost.get("tpm_skin"),
        cost.get("tpm_testis"), cost.get("tpm_ovary"), cost.get("tpm_thyroid"),
        cost.get("tpm_spleen"), cost.get("tpm_nerve"), cost.get("tpm_artery"),
        cost.get("tpm_colon"), cost.get("tpm_esophagus"), cost.get("tpm_prostate"),
        cost.get("tpm_pituitary"), cost.get("tpm_breast"), cost.get("tpm_uterus"),
        # Per-tissue EWGC (24)
        cost.get("ewgc_brain"), cost.get("ewgc_heart"), cost.get("ewgc_kidney"),
        cost.get("ewgc_liver"), cost.get("ewgc_muscle"), cost.get("ewgc_adipose"),
        cost.get("ewgc_whole_blood"), cost.get("ewgc_lung"), cost.get("ewgc_pancreas"),
        cost.get("ewgc_stomach"), cost.get("ewgc_small_intestine"), cost.get("ewgc_skin"),
        cost.get("ewgc_testis"), cost.get("ewgc_ovary"), cost.get("ewgc_thyroid"),
        cost.get("ewgc_spleen"), cost.get("ewgc_nerve"), cost.get("ewgc_artery"),
        cost.get("ewgc_colon"), cost.get("ewgc_esophagus"), cost.get("ewgc_prostate"),
        cost.get("ewgc_pituitary"), cost.get("ewgc_breast"), cost.get("ewgc_uterus"),
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read TSV, resolve coordinates, and bulk-load into bioenergetics.gene_costs."""
    print(f"  Reading cost table: {tsv_path}")
    cost_rows = read_cost_table(tsv_path)
    print(f"  Parsed {len(cost_rows):,} gene entries from TSV")

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for cost in cost_rows:
        symbol = cost.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper())
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, cost, coord)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "gene_costs",
                records=batch,
                columns=COLUMNS,
                schema_name="bioenergetics",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "gene_costs",
            records=batch,
            columns=COLUMNS,
            schema_name="bioenergetics",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    print(f"  Coordinate match: {matched:,} matched, {unmatched:,} unmatched")
    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest gene costs."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "GENE_COST_TSV",
        "/Users/zbb2/Desktop/Research/data/output/reference_gene_cost_table_v3.tsv",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: TSV not found at {tsv_path}")
        print("Set GENE_COST_TSV environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting gene costs - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM bioenergetics.gene_costs WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total gene cost rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest gene bioenergetic costs into bioenergetics.gene_costs",
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
