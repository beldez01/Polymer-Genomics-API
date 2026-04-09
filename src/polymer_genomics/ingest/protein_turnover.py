"""Protein turnover ingestion from Mathieson et al. 2018 half-life data.

Reads the merged supplementary table (TSV with protein half-lives per cell
type), resolves gene coordinates from gene.features, computes degradation
rate constants, and bulk-loads into bioenergetics.protein_turnover via the
COPY protocol.

The ``bioenergetics.protein_turnover`` table is non-partitioned.

Usage::

    uv run python -m polymer_genomics.ingest.protein_turnover
    uv run python -m polymer_genomics.ingest.protein_turnover --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import math
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
    "cell_type", "half_life_hours", "k_degradation",
    "r_squared", "n_peptides",
    "measurement_method",
]

# TSV header -> DB column mapping
_HEADER_MAP: dict[str, str] = {
    "gene_symbol": "gene_symbol",
    "uniprot_id": "uniprot_id",
    "cell_type": "cell_type",
    "half_life_hours": "half_life_hours",
    "r_squared": "r_squared",
    "n_peptides": "n_peptides",
}

# Columns that should be parsed as int
_INT_COLS = {"n_peptides"}

# Columns that should be parsed as float
_FLOAT_COLS = {"half_life_hours", "r_squared"}


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


def _compute_k_degradation(half_life_hours: float | None) -> float | None:
    """Compute first-order degradation rate constant.

    k = ln(2) / t_half

    Returns None if half_life is None, zero, or negative.
    """
    if half_life_hours is None or half_life_hours <= 0:
        return None
    return math.log(2) / half_life_hours


# ── TSV reader ───────────────────────────────────────────────────────────────


def read_turnover_table(tsv_path: str | Path) -> list[dict]:
    """Parse the Mathieson et al. protein turnover TSV.

    Expected headers:
      gene_symbol, uniprot_id, cell_type, half_life_hours, r_squared, n_peptides
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

            # Compute degradation rate constant
            mapped["k_degradation"] = _compute_k_degradation(
                mapped.get("half_life_hours")
            )

            # Default measurement method
            mapped["measurement_method"] = "SILAC"

            rows.append(mapped)
    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the protein_turnover layer."""
    layer_key = "protein_turnover_v1"
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
            ($1, $2, $3, 'protein_turnover', $4,
             'Mathieson et al. 2018 (doi:10.1016/j.cels.2018.10.012)',
             'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Protein Turnover - Mathieson 2018 ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    turnover: dict,
    coord: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        # Identity
        turnover.get("gene_symbol"),
        turnover.get("uniprot_id"),
        # Genomic
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        # Turnover
        turnover.get("cell_type"),
        turnover.get("half_life_hours"),
        turnover.get("k_degradation"),
        turnover.get("r_squared"),
        turnover.get("n_peptides"),
        turnover.get("measurement_method"),
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read TSV, resolve coordinates, and bulk-load into bioenergetics.protein_turnover."""
    print(f"  Reading turnover table: {tsv_path}")
    turnover_rows = read_turnover_table(tsv_path)
    print(f"  Parsed {len(turnover_rows):,} protein-cell_type entries from TSV")

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for turnover in turnover_rows:
        symbol = turnover.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper())
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, turnover, coord)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "protein_turnover",
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
            "protein_turnover",
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
    """Connect and ingest protein turnover data."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "PROTEIN_TURNOVER_TSV",
        "data/mathieson_2018_protein_halflife.tsv",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: TSV not found at {tsv_path}")
        print("Set PROTEIN_TURNOVER_TSV environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting protein turnover - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM bioenergetics.protein_turnover WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total protein turnover rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Mathieson 2018 protein turnover into bioenergetics.protein_turnover",
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
