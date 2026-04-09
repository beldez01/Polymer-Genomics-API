"""MSigDB Hallmark gene set ingestion into annotation.gene_sets.

Reads the MSigDB Hallmark GMT file (h.all.v*.Hs.symbols.gmt), expands each
gene set into one row per gene x gene_set combination, and bulk-loads via
the COPY protocol.

The ``annotation.gene_sets`` table is non-partitioned (~7K rows for Hallmark,
more for other collections).

Usage::

    uv run python -m polymer_genomics.ingest.gene_sets
    uv run python -m polymer_genomics.ingest.gene_sets --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Column list matching the CREATE TABLE order (minus id which is generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "gene_symbol",
    "collection", "gene_set_name", "gene_set_description",
    "source",
]


# ── GMT reader ───────────────────────────────────────────────────────────────


def read_gmt(gmt_path: str | Path) -> list[dict]:
    """Parse an MSigDB GMT file into one row per gene x gene_set.

    GMT format (tab-separated, no header):
      gene_set_name<TAB>description<TAB>gene1<TAB>gene2<TAB>...<TAB>geneN

    Returns a list of dicts, one per gene membership.
    """
    rows: list[dict] = []
    with open(gmt_path, newline="", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n\r")
            if not line:
                continue
            fields = line.split("\t")
            if len(fields) < 3:
                continue

            gene_set_name = fields[0].strip()
            description = fields[1].strip() if fields[1].strip() else None
            gene_symbols = [g.strip() for g in fields[2:] if g.strip()]

            # Determine collection from gene set name prefix
            if gene_set_name.startswith("HALLMARK_"):
                collection = "H"
            elif gene_set_name.startswith("KEGG_"):
                collection = "C2"
            elif gene_set_name.startswith("REACTOME_"):
                collection = "C2"
            elif gene_set_name.startswith("GO_"):
                collection = "C5"
            else:
                collection = "H"  # Default for hallmark GMT file

            for symbol in gene_symbols:
                rows.append({
                    "gene_symbol": symbol,
                    "collection": collection,
                    "gene_set_name": gene_set_name,
                    "gene_set_description": description,
                })

    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the MSigDB Hallmark gene sets layer."""
    layer_key = "msigdb_hallmark_v1"
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
            ($1, $2, $3, 'gene_set', $4,
             'MSigDB', 'cc_by_4.0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"MSigDB Hallmark Gene Sets ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(
    layer_id: str,
    build: str,
    entry: dict,
) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        entry.get("gene_symbol"),
        entry.get("collection"),
        entry.get("gene_set_name"),
        entry.get("gene_set_description"),
        "MSigDB",
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    gmt_path: str | Path,
) -> int:
    """Read GMT, expand gene sets, and bulk-load into annotation.gene_sets."""
    print(f"  Reading GMT file: {gmt_path}")
    gene_set_rows = read_gmt(gmt_path)
    print(f"  Parsed {len(gene_set_rows):,} gene-set membership entries from GMT")

    # Count unique gene sets and genes for diagnostics
    unique_sets = {r["gene_set_name"] for r in gene_set_rows}
    unique_genes = {r["gene_symbol"] for r in gene_set_rows}
    print(f"  Unique gene sets: {len(unique_sets):,}, unique genes: {len(unique_genes):,}")

    total_loaded = 0
    batch: list[tuple] = []

    for entry in gene_set_rows:
        row = _build_row(layer_id, build, entry)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "gene_sets",
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
            "gene_sets",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest MSigDB Hallmark gene sets."""
    if builds is None:
        builds = ["hg38"]

    gmt_path = os.environ.get(
        "MSIGDB_GMT",
        "/Users/zbb2/Desktop/Research/data/msigdb/h.all.v2024.1.Hs.symbols.gmt",
    )

    if not Path(gmt_path).exists():
        print(f"ERROR: GMT file not found at {gmt_path}")
        print("Set MSIGDB_GMT environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting MSigDB Hallmark gene sets - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM annotation.gene_sets WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, gmt_path)
            print(f"\n  Total gene set membership rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest MSigDB Hallmark gene sets into annotation.gene_sets",
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
