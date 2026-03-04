"""gnomAD gene-level constraint metric ingestion into conservation.gene_constraint.

Reads the gnomAD gene constraint TSV (pLI, LOEUF, Z-scores, observed/expected
counts), resolves gene coordinates from gene.features, and bulk-loads via the
COPY protocol.

The ``conservation.gene_constraint`` table is non-partitioned (~20K rows).

Usage::

    uv run python -m polymer_genomics.ingest.gene_constraint
    uv run python -m polymer_genomics.ingest.gene_constraint --build hg38
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
    "gene_symbol", "transcript",
    # Genomic
    "chr_id", "start_pos", "end_pos", "strand",
    # Constraint metrics
    "pli", "loeuf", "mis_z", "syn_z",
    # Observed / expected counts
    "obs_lof", "exp_lof", "obs_mis", "exp_mis", "obs_syn", "exp_syn",
    # Provenance
    "gnomad_version",
]

# TSV header -> DB column mapping
_HEADER_MAP: dict[str, str] = {
    "gene": "gene_symbol",
    "transcript": "transcript",
    "pLI": "pli",
    "oe_lof_upper": "loeuf",
    "mis_z": "mis_z",
    "syn_z": "syn_z",
    "obs_lof": "obs_lof",
    "exp_lof": "exp_lof",
    "obs_mis": "obs_mis",
    "exp_mis": "exp_mis",
    "obs_syn": "obs_syn",
    "exp_syn": "exp_syn",
}

# Columns that should be parsed as int
_INT_COLS = {"obs_lof", "obs_mis", "obs_syn"}

# Columns that should be parsed as float
_FLOAT_COLS = {"pli", "loeuf", "mis_z", "syn_z", "exp_lof", "exp_mis", "exp_syn"}


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


def _parse_gnomad_version(tsv_path: str | Path) -> str:
    """Attempt to extract gnomAD version from the filename, defaulting to v2.1.1."""
    name = Path(tsv_path).name.lower()
    # Try common patterns: gnomad.v2.1.1.*, gnomad.v4.1.*
    if "v4.1" in name:
        return "v4.1"
    if "v4.0" in name:
        return "v4.0"
    if "v2.1.1" in name:
        return "v2.1.1"
    return "v2.1.1"


# -- TSV reader ---------------------------------------------------------------


def read_constraint_table(tsv_path: str | Path) -> tuple[list[dict], str]:
    """Parse the gnomAD gene constraint TSV, mapping headers to DB column names.

    Returns (rows, gnomad_version).
    """
    gnomad_version = _parse_gnomad_version(tsv_path)
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
    return rows, gnomad_version


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
    """Register (or retrieve) the gene_constraint layer."""
    layer_key = "gene_constraint_v1"
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
            ($1, $2, $3, 'constraint', $4,
             'gnomAD', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Gene Constraint Metrics ({build})",
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
    gnomad_version: str,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        # Identity
        rec.get("gene_symbol"),
        rec.get("transcript"),
        # Genomic
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        # Constraint metrics
        rec.get("pli"),
        rec.get("loeuf"),
        rec.get("mis_z"),
        rec.get("syn_z"),
        # Observed / expected counts
        rec.get("obs_lof"),
        rec.get("exp_lof"),
        rec.get("obs_mis"),
        rec.get("exp_mis"),
        rec.get("obs_syn"),
        rec.get("exp_syn"),
        # Provenance
        gnomad_version,
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read TSV, resolve coordinates, and bulk-load into conservation.gene_constraint."""
    print(f"  Reading constraint table: {tsv_path}")
    constraint_rows, gnomad_version = read_constraint_table(tsv_path)
    print(f"  Parsed {len(constraint_rows):,} gene entries from TSV (gnomAD {gnomad_version})")

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for rec in constraint_rows:
        symbol = rec.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper())
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, rec, coord, gnomad_version)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "gene_constraint",
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
            "gene_constraint",
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
    """Connect and ingest gnomAD gene constraint metrics."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "GNOMAD_CONSTRAINT_TSV",
        "/Users/zbb2/Desktop/Research/data/gnomad/gnomad.v2.1.1.lof_metrics.by_gene.txt",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: TSV not found at {tsv_path}")
        print("Set GNOMAD_CONSTRAINT_TSV environment variable to the correct path.")
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
            print(f"Ingesting gnomAD gene constraint - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM conservation.gene_constraint WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total gene constraint rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest gnomAD gene constraint metrics into conservation.gene_constraint",
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
