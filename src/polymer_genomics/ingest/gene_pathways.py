"""Reactome gene-to-pathway mapping ingestion into annotation.gene_pathways.

Reads the NCBI2Reactome_All_Levels.txt file from reactome.org, filters for
Homo sapiens entries, resolves NCBI gene IDs to gene symbols via a gene_info
lookup, and bulk-loads via the COPY protocol.

The ``annotation.gene_pathways`` table is non-partitioned (~200K rows for
human pathways).

Usage::

    uv run python -m polymer_genomics.ingest.gene_pathways
    uv run python -m polymer_genomics.ingest.gene_pathways --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Column list matching the CREATE TABLE order (minus id which is generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "gene_symbol", "gene_id",
    "pathway_id", "pathway_name", "pathway_hierarchy", "evidence_code",
    "source",
]

# Reactome TSV columns (no header in file)
_REACTOME_FIELDS = [
    "gene_id",       # NCBI gene ID (e.g. "5594")
    "pathway_id",    # Reactome stable ID (e.g. "R-HSA-109582")
    "url",           # URL to pathway page
    "pathway_name",  # Human-readable name
    "evidence_code", # IEA, TAS, etc.
    "species",       # Homo sapiens, Mus musculus, etc.
]


# ── Helpers ──────────────────────────────────────────────────────────────────


def _extract_hierarchy(pathway_id: str) -> str | None:
    """Extract top-level hierarchy from Reactome pathway ID.

    Reactome pathway IDs encode species but not hierarchy directly.
    We store the pathway_id itself; hierarchy is resolved at query time
    or via Reactome's pathway hierarchy file if available.
    """
    # For now, store None — hierarchy requires a separate Reactome file
    return None


# ── TSV reader ───────────────────────────────────────────────────────────────


def read_reactome(tsv_path: str | Path) -> list[dict]:
    """Parse the NCBI2Reactome_All_Levels.txt file, filtering for Homo sapiens.

    The file has no header. Columns are tab-separated:
    gene_id, pathway_id, url, pathway_name, evidence_code, species
    """
    rows: list[dict] = []
    with open(tsv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        for fields in reader:
            if len(fields) < 6:
                continue
            species = fields[5].strip()
            if species != "Homo sapiens":
                continue
            gene_id = fields[0].strip()
            if not gene_id:
                continue
            rows.append({
                "gene_id": gene_id,
                "pathway_id": fields[1].strip(),
                "pathway_name": fields[3].strip(),
                "evidence_code": fields[4].strip(),
            })
    return rows


# ── Gene symbol resolution ───────────────────────────────────────────────────


async def resolve_ncbi_to_symbol(
    conn: asyncpg.Connection,
    build: str,
) -> dict[str, str]:
    """Build an NCBI gene ID -> gene symbol lookup from gene.features.

    Uses the gene_id column in gene.features (which stores NCBI gene IDs
    as strings).  Returns a dict keyed by NCBI gene ID with gene_symbol
    as value.
    """
    rows = await conn.fetch(
        """
        SELECT gene_id, gene_symbol
        FROM gene.features
        WHERE build = $1::genome_build
          AND feature_type = 'gene'
          AND gene_id IS NOT NULL
        ORDER BY gene_symbol, start_pos
        """,
        build,
    )
    lookup: dict[str, str] = {}
    for r in rows:
        gid = r["gene_id"]
        sym = r["gene_symbol"]
        if gid and sym and gid not in lookup:
            lookup[gid] = sym
    return lookup


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the Reactome pathways layer."""
    layer_key = "reactome_pathways_v1"
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
            ($1, $2, $3, 'pathway', $4,
             'Reactome', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Reactome Pathways ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    entry: dict,
    gene_symbol: str | None,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        gene_symbol,
        entry.get("gene_id"),
        entry.get("pathway_id"),
        entry.get("pathway_name"),
        _extract_hierarchy(entry.get("pathway_id", "")),
        entry.get("evidence_code"),
        "Reactome",
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read Reactome TSV, resolve gene symbols, and bulk-load into annotation.gene_pathways."""
    print(f"  Reading Reactome file: {tsv_path}")
    pathway_rows = read_reactome(tsv_path)
    print(f"  Parsed {len(pathway_rows):,} human pathway entries from TSV")

    print(f"  Resolving NCBI gene IDs to symbols for {build}...")
    ncbi_lookup = await resolve_ncbi_to_symbol(conn, build)
    print(f"  Found symbols for {len(ncbi_lookup):,} NCBI gene IDs")

    total_loaded = 0
    matched = 0
    unmatched = 0
    batch: list[tuple] = []

    for entry in pathway_rows:
        gene_id = entry.get("gene_id", "")
        gene_symbol = ncbi_lookup.get(gene_id)
        if gene_symbol:
            matched += 1
        else:
            unmatched += 1
            continue  # Skip entries without a resolvable gene symbol

        row = _build_row(layer_id, build, entry, gene_symbol)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "gene_pathways",
                records=batch,
                columns=COLUMNS,
                schema_name="annotation",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "gene_pathways",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    print(f"  Gene symbol match: {matched:,} matched, {unmatched:,} skipped (no symbol)")
    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest Reactome pathway mappings."""
    if builds is None:
        builds = ["hg38"]

    tsv_path = os.environ.get(
        "REACTOME_TSV",
        "/Users/zbb2/Desktop/Research/data/reactome/NCBI2Reactome_All_Levels.txt",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: Reactome TSV not found at {tsv_path}")
        print("Set REACTOME_TSV environment variable to the correct path.")
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
            print(f"Ingesting Reactome pathways - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM annotation.gene_pathways WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total pathway mapping rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Reactome gene-pathway mappings into annotation.gene_pathways",
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
