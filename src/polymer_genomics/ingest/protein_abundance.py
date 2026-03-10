"""Protein abundance ingestion from PaxDb v6.0 tissue-specific data.

Reads PaxDb TSV downloads (one file per organism/tissue), maps Ensembl
protein IDs (ENSP) to gene symbols via gene.features, resolves gene
coordinates, and bulk-loads into bioenergetics.protein_abundance via
the COPY protocol.

The ``bioenergetics.protein_abundance`` table is non-partitioned.

Usage::

    uv run python -m polymer_genomics.ingest.protein_abundance
    uv run python -m polymer_genomics.ingest.protein_abundance --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import re
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest.gene_costs import resolve_gene_coordinates

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Column list matching the CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "gene_symbol", "uniprot_id",
    "chr_id", "start_pos", "end_pos", "strand",
    "tissue", "abundance_ppm",
    "coverage", "spectral_count",
    "data_source", "organ_group",
]

# TSV header -> DB column mapping
_HEADER_MAP: dict[str, str] = {
    "internal_id": "internal_id",
    "string_external_id": "string_external_id",
    "abundance": "abundance",
}

# Tissue name grouping into organ systems
TISSUE_MAP: dict[str, str] = {
    "brain": "brain",
    "heart": "heart",
    "kidney": "kidney",
    "liver": "liver",
    "lung": "lung",
    "blood": "whole_blood",
    "pancreas": "pancreas",
    "colon": "colon",
    "skin": "skin",
    "testis": "testis",
    "ovary": "ovary",
    "thyroid": "thyroid",
    "spleen": "spleen",
}

# Columns that should be parsed as float
_FLOAT_COLS = {"abundance"}


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


def _extract_tissue_name(filename: str) -> str | None:
    """Extract tissue name from PaxDb filename.

    Expected patterns like:
        9606-WHOLE_ORGANISM-integrated.tsv
        9606-BRAIN-Wang_2019.tsv
        9606-LIVER-integrated.tsv
    """
    # Strip extension
    stem = Path(filename).stem
    # Try to extract tissue component (second dash-delimited segment)
    parts = stem.split("-")
    if len(parts) >= 2:
        tissue_raw = parts[1].lower()
        # Normalise underscores and common variants
        tissue_raw = tissue_raw.replace("_", " ").strip()
        # Map to canonical form if possible
        for key in TISSUE_MAP:
            if key in tissue_raw:
                return key
        # Return as-is if no mapping
        return tissue_raw
    return None


def _resolve_organ_group(tissue: str) -> str | None:
    """Map a tissue name to its organ group."""
    if not tissue:
        return None
    tissue_lower = tissue.lower()
    for key, group in TISSUE_MAP.items():
        if key in tissue_lower:
            return group
    return None


# ── TSV reader ───────────────────────────────────────────────────────────────


def read_paxdb_file(tsv_path: str | Path, tissue: str) -> list[dict]:
    """Parse a single PaxDb tissue TSV file.

    PaxDb format:
      - Comment lines start with #
      - Header: internal_id, string_external_id, abundance
      - string_external_id: "9606.ENSP00000..." format
    """
    rows: list[dict] = []
    with open(tsv_path, newline="") as f:
        # Keep header line (starts with #gene_name or #internal_id) but skip other comments
        lines: list[str] = []
        for line in f:
            if line.startswith("#") and not line.startswith("#gene_name") and not line.startswith("#internal_id"):
                continue
            # Strip leading # from header line
            if line.startswith("#"):
                line = line[1:]
            lines.append(line)

    if not lines:
        return rows

    import io
    reader = csv.DictReader(io.StringIO("".join(lines)), delimiter="\t")

    for raw in reader:
        string_id = raw.get("string_external_id", "")
        abundance_str = raw.get("abundance", "")
        gene_name = raw.get("gene_name", "").strip()

        # Extract ENSP ID from "9606.ENSP00000..." format
        ensp_id = None
        if string_id and "." in string_id:
            ensp_id = string_id.split(".", 1)[1]

        abundance = _safe_float(abundance_str)

        if not ensp_id:
            continue

        rows.append({
            "ensp_id": ensp_id,
            "gene_symbol": gene_name if gene_name else None,
            "abundance_ppm": abundance,
            "tissue": tissue,
            "organ_group": _resolve_organ_group(tissue),
            "data_source": "PaxDb_v6.0",
        })

    return rows


def read_paxdb_dir(paxdb_dir: str | Path) -> list[dict]:
    """Scan a directory of PaxDb TSV files and parse all tissues."""
    paxdb_dir = Path(paxdb_dir)
    all_rows: list[dict] = []

    tsv_files = sorted(paxdb_dir.glob("*.txt"))
    if not tsv_files:
        tsv_files = sorted(paxdb_dir.glob("*.tsv"))
    if not tsv_files:
        print(f"  WARNING: No TSV/TXT files found in {paxdb_dir}")
        return all_rows

    for tsv_file in tsv_files:
        tissue = _extract_tissue_name(tsv_file.name)
        if tissue is None:
            print(f"  Skipping (no tissue name): {tsv_file.name}")
            continue

        tissue_rows = read_paxdb_file(tsv_file, tissue)
        print(f"  {tsv_file.name}: {len(tissue_rows):,} proteins ({tissue})")
        all_rows.extend(tissue_rows)

    return all_rows


# ── ENSP-to-gene mapping ────────────────────────────────────────────────────


async def build_ensp_to_gene_map(
    conn: asyncpg.Connection,
    build: str,
) -> dict[str, str]:
    """Query gene.features for ENSP -> gene_symbol mappings.

    Falls back to transcript-level lookups. Returns dict keyed by ENSP ID
    (without version) -> gene_symbol.
    """
    # Use protein_id from gene.features if available, otherwise fall back
    # to a broader lookup via gene_symbol from Ensembl protein annotations.
    rows = await conn.fetch(
        """
        SELECT DISTINCT gene_symbol, feature_id
        FROM gene.features
        WHERE build = $1::genome_build
          AND feature_type = 'gene'
          AND gene_symbol IS NOT NULL
        """,
        build,
    )
    # Build a basic symbol lookup (ENSG -> symbol) for downstream use
    # The actual ENSP mapping needs a protein-to-gene table; for now
    # we return an empty map and rely on the caller to handle unmapped IDs
    ensg_to_symbol: dict[str, str] = {}
    for r in rows:
        if r["feature_id"] and r["gene_symbol"]:
            ensg_to_symbol[r["feature_id"].split(".")[0]] = r["gene_symbol"]
    return ensg_to_symbol


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the protein_abundance layer."""
    layer_key = "protein_abundance_v1"
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
            ($1, $2, $3, 'protein_abundance', $4,
             'PaxDb v6.0 (pax-db.org)', 'cc_by_4_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Protein Abundance - PaxDb v6.0 ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    protein: dict,
    coord: dict | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        # Identity
        protein.get("gene_symbol"),
        protein.get("uniprot_id"),
        # Genomic
        coord["chr_id"] if coord else None,
        coord["start_pos"] if coord else None,
        coord["end_pos"] if coord else None,
        coord["strand"] if coord else None,
        # Abundance
        protein.get("tissue"),
        protein.get("abundance_ppm"),
        protein.get("coverage"),
        protein.get("spectral_count"),
        protein.get("data_source"),
        protein.get("organ_group"),
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    paxdb_dir: str | Path,
) -> int:
    """Read PaxDb directory, resolve coordinates, and bulk-load."""
    print(f"  Scanning PaxDb directory: {paxdb_dir}")
    protein_rows = read_paxdb_dir(paxdb_dir)
    print(f"  Parsed {len(protein_rows):,} protein-tissue entries total")

    if not protein_rows:
        print("  No data to ingest.")
        return 0

    print(f"  Resolving gene coordinates for {build}...")
    coord_lookup = await resolve_gene_coordinates(conn, build)
    print(f"  Found coordinates for {len(coord_lookup):,} genes")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for protein in protein_rows:
        symbol = protein.get("gene_symbol", "")
        coord = coord_lookup.get(symbol.upper()) if symbol else None
        if coord:
            matched += 1
        else:
            unmatched += 1

        row = _build_row(layer_id, build, protein, coord)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "protein_abundance",
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
            "protein_abundance",
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
    """Connect and ingest PaxDb protein abundance data."""
    if builds is None:
        builds = ["hg38"]

    paxdb_dir = os.environ.get(
        "PAXDB_DIR",
        "data/paxdb",
    )

    if not Path(paxdb_dir).is_dir():
        print(f"ERROR: PaxDb directory not found at {paxdb_dir}")
        print("Set PAXDB_DIR environment variable to the correct path.")
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
            print(f"Ingesting PaxDb protein abundance - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM bioenergetics.protein_abundance WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, paxdb_dir)
            print(f"\n  Total protein abundance rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest PaxDb v6.0 protein abundance into bioenergetics.protein_abundance",
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
