"""Ensembl Compara dN/dS ratio ingestion into conservation.protein_evolution.

Reads a BioMart TSV export of human-mouse ortholog dN/dS ratios, resolves
gene coordinates from gene.features, and bulk-loads via the COPY protocol.

The ``conservation.protein_evolution`` table is non-partitioned (~20K rows).

Usage::

    uv run python -m polymer_genomics.ingest.protein_evolution
    uv run python -m polymer_genomics.ingest.protein_evolution --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# -- Constants ----------------------------------------------------------------

BATCH_SIZE = 5_000

# Column list matching the CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    # Identity
    "gene_symbol", "ensembl_gene_id",
    # Genomic
    "chr_id", "start_pos", "end_pos", "strand",
    # Mouse ortholog
    "mouse_gene_symbol", "mouse_ensembl_gene_id",
    # Evolutionary rates
    "dn", "ds", "omega",
    # Orthology metadata
    "orthology_type", "homology_id",
    # Sequence identity
    "perc_id_human", "perc_id_mouse",
]

# TSV header -> DB column mapping
_HEADER_MAP: dict[str, str] = {
    "Gene stable ID": "ensembl_gene_id",
    "Gene name": "gene_symbol",
    "Mouse gene stable ID": "mouse_ensembl_gene_id",
    "Mouse gene name": "mouse_gene_symbol",
    "dN": "dn",
    "dS": "ds",
    "Homology type": "orthology_type",
    "%id. target Mouse gene": "perc_id_mouse",
    "%id. query gene": "perc_id_human",
    "Homology ID": "homology_id",
}

# Columns that should be parsed as float
_FLOAT_COLS = {"dn", "ds", "perc_id_human", "perc_id_mouse"}


# -- Helpers -------------------------------------------------------------------


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


# -- TSV reader ---------------------------------------------------------------


def read_dnds_table(tsv_path: str | Path) -> list[dict]:
    """Parse the BioMart dN/dS TSV, mapping headers to DB column names.

    Computes omega (dN/dS) for rows where dS > 0.
    """
    rows: list[dict] = []
    with open(tsv_path, newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for raw in reader:
            mapped: dict = {}
            for tsv_col, value in raw.items():
                db_col = _HEADER_MAP.get(tsv_col)
                if db_col is None:
                    continue
                if db_col in _FLOAT_COLS:
                    mapped[db_col] = _safe_float(value)
                else:
                    mapped[db_col] = value if value else None
            # Skip rows without gene symbol
            if not mapped.get("gene_symbol"):
                continue
            # Compute omega = dN / dS (where dS > 0)
            dn = mapped.get("dn")
            ds = mapped.get("ds")
            if dn is not None and ds is not None and ds > 0:
                mapped["omega"] = dn / ds
            else:
                mapped["omega"] = None
            rows.append(mapped)
    return rows


# -- Gene coordinate resolution -----------------------------------------------


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


# -- Layer registration -------------------------------------------------------


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the protein_evolution layer."""
    layer_key = "protein_evolution_v1"
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
            ($1, $2, $3, 'protein_evolution', $4,
             'Ensembl_Compara', 'apache_2_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Protein Evolution dN/dS ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# -- Ingestion -----------------------------------------------------------------


def _build_row(
    layer_id: str,
    build: str,
    rec: dict,
    coord: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        # Identity
        rec.get("gene_symbol"),
        rec.get("ensembl_gene_id"),
        # Genomic
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        # Mouse ortholog
        rec.get("mouse_gene_symbol"),
        rec.get("mouse_ensembl_gene_id"),
        # Evolutionary rates
        rec.get("dn"),
        rec.get("ds"),
        rec.get("omega"),
        # Orthology metadata
        rec.get("orthology_type"),
        rec.get("homology_id"),
        # Sequence identity
        rec.get("perc_id_human"),
        rec.get("perc_id_mouse"),
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read TSV, resolve coordinates, and bulk-load into conservation.protein_evolution."""
    print(f"  Reading dN/dS table: {tsv_path}")
    dnds_rows = read_dnds_table(tsv_path)
    print(f"  Parsed {len(dnds_rows):,} ortholog entries from TSV")

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for rec in dnds_rows:
        symbol = rec.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper())
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, rec, coord)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "protein_evolution",
                records=batch,
                columns=COLUMNS,
                schema_name="conservation",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "protein_evolution",
            records=batch,
            columns=COLUMNS,
            schema_name="conservation",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    print(f"  Coordinate match: {matched:,} matched, {unmatched:,} unmatched")
    return total_loaded


# -- Main ----------------------------------------------------------------------


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest Ensembl Compara dN/dS ratios."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "ENSEMBL_DNDS_TSV",
        "/Users/zbb2/Desktop/Research/data/ensembl/human_mouse_dnds.tsv",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: TSV not found at {tsv_path}")
        print("Set ENSEMBL_DNDS_TSV environment variable to the correct path.")
        return

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    conn = await asyncpg.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
    )

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Ensembl Compara dN/dS - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM conservation.protein_evolution WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total protein evolution rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Ensembl Compara dN/dS ratios into conservation.protein_evolution",
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
