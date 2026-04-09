"""Human Protein Atlas tissue expression and subcellular localization ingestion.

Reads the HPA normal_tissue.tsv and subcellular_location.tsv downloads,
resolves ENSG IDs to gene symbols and coordinates via gene.features, and
bulk-loads into proteomics.tissue_expression and proteomics.subcellular_location
via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.protein_atlas
    uv run python -m polymer_genomics.ingest.protein_atlas --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
from pathlib import Path

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Tissue expression columns matching CREATE TABLE order (minus id)
COLUMNS: list[str] = [
    "layer_id", "build",
    "gene_symbol", "ensembl_gene_id",
    "chr_id", "start_pos", "end_pos", "strand",
    "tissue", "cell_type", "expression_level", "reliability",
]

# Subcellular location columns matching CREATE TABLE order (minus id)
COLUMNS_SUBCELL: list[str] = [
    "layer_id", "build",
    "gene_symbol", "ensembl_gene_id",
    "location", "reliability", "go_id",
]

# HPA expression level mapping for ordering
_EXPRESSION_LEVELS = {"Not detected", "Low", "Medium", "High"}

# HPA reliability mapping
_RELIABILITY_LEVELS = {"Enhanced", "Supported", "Approved", "Uncertain"}


# ── Helpers ──────────────────────────────────────────────────────────────────


def _clean_ensg(raw: str) -> str | None:
    """Strip version suffix from Ensembl gene ID."""
    if not raw or not raw.strip():
        return None
    ensg = raw.strip().split(".")[0]
    return ensg if ensg.startswith("ENSG") else None


# ── TSV readers ──────────────────────────────────────────────────────────────


def read_tissue_expression(tsv_path: str | Path) -> list[dict]:
    """Parse HPA normal_tissue.tsv.

    Expected columns: Gene, Gene name, Tissue, Cell type, Level, Reliability
    Returns one dict per row.
    """
    rows: list[dict] = []
    with open(tsv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for raw in reader:
            ensg = _clean_ensg(raw.get("Gene", ""))
            if not ensg:
                continue
            gene_name = raw.get("Gene name", "").strip()
            tissue = raw.get("Tissue", "").strip()
            cell_type = raw.get("Cell type", "").strip()
            level = raw.get("Level", "").strip()
            reliability = raw.get("Reliability", "").strip()

            if not tissue:
                continue

            if level not in _EXPRESSION_LEVELS:
                continue  # Skip rows with invalid expression levels (N/A, Ascending, etc.)

            rows.append({
                "ensembl_gene_id": ensg,
                "gene_name": gene_name,
                "tissue": tissue,
                "cell_type": cell_type if cell_type else None,
                "expression_level": level,
                "reliability": reliability if reliability in _RELIABILITY_LEVELS else None,
            })
    return rows


def read_subcellular_location(tsv_path: str | Path) -> list[dict]:
    """Parse HPA subcellular_location.tsv.

    Expected columns include: Gene, Gene name, Reliability, Enhanced,
    Supported, Approved, Uncertain, GO id, ...

    The Enhanced/Supported/Approved/Uncertain columns contain comma-separated
    location names. We expand each into individual rows.
    """
    rows: list[dict] = []
    with open(tsv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for raw in reader:
            ensg = _clean_ensg(raw.get("Gene", ""))
            if not ensg:
                continue
            gene_name = raw.get("Gene name", "").strip()
            go_id = raw.get("GO id", "").strip() if raw.get("GO id") else None

            # Parse locations from each reliability tier
            for tier in ("Enhanced", "Supported", "Approved", "Uncertain"):
                locations_str = raw.get(tier, "").strip()
                if not locations_str:
                    continue
                locations = [loc.strip() for loc in locations_str.split(";") if loc.strip()]
                for location in locations:
                    rows.append({
                        "ensembl_gene_id": ensg,
                        "gene_name": gene_name,
                        "location": location,
                        "reliability": tier,
                        "go_id": go_id,
                    })
    return rows


# ── Gene resolution ─────────────────────────────────────────────────────────


async def resolve_ensg_to_gene(
    conn: asyncpg.Connection,
    build: str,
) -> dict[str, dict]:
    """Build an ENSG -> {gene_symbol, chr_id, start_pos, end_pos, strand} lookup.

    Queries gene.features for gene-level entries with Ensembl IDs.
    """
    rows = await conn.fetch(
        """
        SELECT gene_id, gene_symbol, chr_id, start_pos, end_pos, strand
        FROM gene.features
        WHERE build = $1::genome_build
          AND feature_type = 'gene'
          AND gene_id IS NOT NULL
        ORDER BY gene_symbol, start_pos
        """,
        build,
    )
    lookup: dict[str, dict] = {}
    for r in rows:
        gid = r["gene_id"]
        sym = r["gene_symbol"]
        if gid and sym and gid not in lookup:
            lookup[gid] = {
                "gene_symbol": sym,
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
    """Register (or retrieve) the Human Protein Atlas layer."""
    layer_key = "protein_atlas_v1"
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
            ($1, $2, $3, 'protein_atlas', $4,
             'Human_Protein_Atlas', 'cc_by_sa_3_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Human Protein Atlas ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    entry: dict,
    gene_info: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for tissue expression COPY."""
    return (
        layer_id, build,
        gene_info["gene_symbol"] if gene_info else entry.get("gene_name"),
        entry.get("ensembl_gene_id"),
        gene_info["chr_id"] if gene_info else None,
        gene_info["start_pos"] if gene_info else None,
        gene_info["end_pos"] if gene_info else None,
        gene_info["strand"] if gene_info else None,
        entry.get("tissue"),
        entry.get("cell_type"),
        entry.get("expression_level"),
        entry.get("reliability"),
    )


def _build_subcell_row(
    layer_id: str,
    build: str,
    entry: dict,
    gene_symbol: str | None,
) -> tuple:
    """Build a tuple matching COLUMNS_SUBCELL order for subcellular location COPY."""
    return (
        layer_id, build,
        gene_symbol,
        entry.get("ensembl_gene_id"),
        entry.get("location"),
        entry.get("reliability"),
        entry.get("go_id"),
    )


async def ingest_tissue_expression(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
    ensg_lookup: dict[str, dict],
) -> int:
    """Read tissue expression TSV and bulk-load into proteomics.tissue_expression."""
    print(f"  Reading tissue expression: {tsv_path}")
    tissue_rows = read_tissue_expression(tsv_path)
    print(f"  Parsed {len(tissue_rows):,} tissue expression entries")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for entry in tissue_rows:
        ensg = entry.get("ensembl_gene_id", "")
        gene_info = ensg_lookup.get(ensg)
        if gene_info:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, entry, gene_info)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "tissue_expression",
                records=batch,
                columns=COLUMNS,
                schema_name="proteomics",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "tissue_expression",
            records=batch,
            columns=COLUMNS,
            schema_name="proteomics",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    print(f"  Gene match (tissue): {matched:,} matched, {unmatched:,} unmatched")
    return total_loaded


async def ingest_subcellular_location(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
    ensg_lookup: dict[str, dict],
) -> int:
    """Read subcellular location TSV and bulk-load into proteomics.subcellular_location."""
    print(f"  Reading subcellular location: {tsv_path}")
    subcell_rows = read_subcellular_location(tsv_path)
    print(f"  Parsed {len(subcell_rows):,} subcellular location entries")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for entry in subcell_rows:
        ensg = entry.get("ensembl_gene_id", "")
        gene_info = ensg_lookup.get(ensg)
        gene_symbol = gene_info["gene_symbol"] if gene_info else entry.get("gene_name")
        if gene_info:
            matched += 1
        else:
            unmatched += 1

        row = _build_subcell_row(layer_id, build, entry, gene_symbol)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "subcellular_location",
                records=batch,
                columns=COLUMNS_SUBCELL,
                schema_name="proteomics",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "subcellular_location",
            records=batch,
            columns=COLUMNS_SUBCELL,
            schema_name="proteomics",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    print(f"  Gene match (subcell): {matched:,} matched, {unmatched:,} unmatched")
    return total_loaded


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tissue_path: str | Path,
    subcell_path: str | Path,
) -> int:
    """Resolve genes and ingest both tissue expression and subcellular location."""
    print(f"  Resolving ENSG IDs to gene coordinates for {build}...")
    ensg_lookup = await resolve_ensg_to_gene(conn, build)
    print(f"  Found coordinates for {len(ensg_lookup):,} ENSG IDs")

    total = 0

    # 1. Tissue expression
    total += await ingest_tissue_expression(conn, build, layer_id, tissue_path, ensg_lookup)

    # 2. Subcellular location
    if Path(subcell_path).exists():
        total += await ingest_subcellular_location(conn, build, layer_id, subcell_path, ensg_lookup)
    else:
        print(f"  WARNING: Subcellular location file not found at {subcell_path}, skipping.")

    return total


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest Human Protein Atlas data."""
    if builds is None:
        builds = ["hg38"]

    tissue_path = os.environ.get(
        "HPA_TISSUE_TSV",
        "/Users/zbb2/Desktop/Research/data/hpa/normal_tissue.tsv",
    )
    subcell_path = os.environ.get(
        "HPA_SUBCELL_TSV",
        "/Users/zbb2/Desktop/Research/data/hpa/subcellular_location.tsv",
    )

    if not Path(tissue_path).exists():
        print(f"ERROR: HPA tissue expression TSV not found at {tissue_path}")
        print("Set HPA_TISSUE_TSV environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Human Protein Atlas - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data (tissue expression)
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM proteomics.tissue_expression WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, tissue_path, subcell_path)
            print(f"\n  Total Protein Atlas rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Human Protein Atlas data into proteomics.tissue_expression and proteomics.subcellular_location",
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
