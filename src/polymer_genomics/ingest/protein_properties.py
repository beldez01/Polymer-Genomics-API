"""Protein physicochemical properties ingestion from UniProt ProtParam data.

Reads a TSV export of ProtParam-computed physicochemical properties (elemental
composition, isoelectric point, instability index, aliphatic index, GRAVY,
extinction coefficients), resolves gene coordinates from gene.features, and
bulk-loads into bioenergetics.protein_properties via the COPY protocol.

The ``bioenergetics.protein_properties`` table is non-partitioned.

Usage::

    uv run python -m polymer_genomics.ingest.protein_properties
    uv run python -m polymer_genomics.ingest.protein_properties --build hg38
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
from polymer_genomics.ingest.gene_costs import resolve_gene_coordinates

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Column list matching the CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "gene_symbol", "uniprot_id",
    "chr_id", "start_pos", "end_pos", "strand",
    "h_atoms", "o_atoms", "p_atoms", "total_atoms",
    "pi", "instability_index", "aliphatic_index", "gravy",
    "molecular_formula",
    "extinction_coeff_reduced", "extinction_coeff_oxidized",
]

# TSV header -> DB column mapping
_HEADER_MAP: dict[str, str] = {
    "gene_symbol": "gene_symbol",
    "uniprot_id": "uniprot_id",
    "h_atoms": "h_atoms",
    "o_atoms": "o_atoms",
    "p_atoms": "p_atoms",
    "total_atoms": "total_atoms",
    "pi": "pi",
    "instability_index": "instability_index",
    "aliphatic_index": "aliphatic_index",
    "gravy": "gravy",
    "molecular_formula": "molecular_formula",
    "extinction_coeff_reduced": "extinction_coeff_reduced",
    "extinction_coeff_oxidized": "extinction_coeff_oxidized",
}

# Columns that should be parsed as int
_INT_COLS = {
    "h_atoms", "o_atoms", "p_atoms", "total_atoms",
    "extinction_coeff_reduced", "extinction_coeff_oxidized",
}

# Columns that should be parsed as float
_FLOAT_COLS = {
    "pi", "instability_index", "aliphatic_index", "gravy",
}


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


def read_properties_table(tsv_path: str | Path) -> list[dict]:
    """Parse the UniProt ProtParam properties TSV.

    Expected headers:
      gene_symbol, uniprot_id, h_atoms, o_atoms, p_atoms, total_atoms,
      pi, instability_index, aliphatic_index, gravy, molecular_formula,
      extinction_coeff_reduced, extinction_coeff_oxidized
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


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the protein_properties layer."""
    layer_key = "protein_properties_v1"
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
            ($1, $2, $3, 'protein_properties', $4,
             'UniProt ProtParam (expasy.org)', 'cc_by_4_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Protein Properties - ProtParam ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    props: dict,
    coord: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        # Identity
        props.get("gene_symbol"),
        props.get("uniprot_id"),
        # Genomic
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        # Elemental composition
        props.get("h_atoms"),
        props.get("o_atoms"),
        props.get("p_atoms"),
        props.get("total_atoms"),
        # Physicochemical
        props.get("pi"),
        props.get("instability_index"),
        props.get("aliphatic_index"),
        props.get("gravy"),
        props.get("molecular_formula"),
        # Extinction coefficients
        props.get("extinction_coeff_reduced"),
        props.get("extinction_coeff_oxidized"),
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read TSV, resolve coordinates, and bulk-load into bioenergetics.protein_properties."""
    print(f"  Reading properties table: {tsv_path}")
    props_rows = read_properties_table(tsv_path)
    print(f"  Parsed {len(props_rows):,} protein entries from TSV")

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for props in props_rows:
        symbol = props.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper())
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, props, coord)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "protein_properties",
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
            "protein_properties",
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
    """Connect and ingest protein physicochemical properties."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "PROTEIN_PROPERTIES_TSV",
        "data/uniprot_protparam_properties.tsv",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: TSV not found at {tsv_path}")
        print("Set PROTEIN_PROPERTIES_TSV environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting protein properties - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM bioenergetics.protein_properties WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total protein properties rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest UniProt ProtParam properties into bioenergetics.protein_properties",
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
