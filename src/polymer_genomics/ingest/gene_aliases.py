"""NCBI gene alias/synonym ingestion into gene.aliases.

Downloads Homo_sapiens.gene_info.gz from NCBI FTP, parses the Synonyms
column, and bulk-loads alias→canonical mappings via the COPY protocol.

The ``gene.aliases`` table is non-partitioned (~150-250K rows).

Usage::

    uv run python -m polymer_genomics.ingest.gene_aliases
    uv run python -m polymer_genomics.ingest.gene_aliases --file /path/to/Homo_sapiens.gene_info.gz
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
import tempfile
import urllib.request
from pathlib import Path

import asyncpg

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

NCBI_FTP_URL = (
    "https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Homo_sapiens.gene_info.gz"
)

COLUMNS: list[str] = [
    "layer_id",
    "alias",
    "canonical_symbol",
    "ncbi_gene_id",
    "alias_type",
]


# ── Parser ───────────────────────────────────────────────────────────────────


def parse_gene_info(filepath: str | Path) -> list[dict]:
    """Parse NCBI gene_info file into alias→canonical rows.

    Columns used (0-indexed):
      1 = GeneID (integer)
      2 = Symbol (canonical)
      4 = Synonyms (pipe-separated, or '-' if none)

    Skips self-aliases (synonym == canonical).
    """
    rows: list[dict] = []
    open_fn = gzip.open if str(filepath).endswith(".gz") else open

    with open_fn(filepath, "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 5:
                continue

            gene_id_str = fields[1]
            canonical = fields[2].strip()
            synonyms_raw = fields[4].strip()

            try:
                gene_id = int(gene_id_str)
            except ValueError:
                continue

            if synonyms_raw == "-" or not synonyms_raw:
                continue

            for syn in synonyms_raw.split("|"):
                syn = syn.strip()
                if not syn or syn == canonical:
                    continue
                rows.append({
                    "alias": syn,
                    "canonical_symbol": canonical,
                    "ncbi_gene_id": gene_id,
                    "alias_type": "synonym",
                })

    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection) -> str:
    """Register (or retrieve) the NCBI gene aliases layer."""
    layer_key = "ncbi_gene_aliases"
    version = "1.0"

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
            ($1, $2, $3, 'gene_alias', 'hg38',
             'NCBI', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        "NCBI Gene Aliases (Homo sapiens)",
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(layer_id: str, entry: dict) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id,
        entry["alias"],
        entry["canonical_symbol"],
        entry["ncbi_gene_id"],
        entry["alias_type"],
    )


async def ingest(conn: asyncpg.Connection, layer_id: str, filepath: str | Path) -> int:
    """Parse gene_info and bulk-load into gene.aliases."""
    print(f"  Parsing: {filepath}")
    alias_rows = parse_gene_info(filepath)
    print(f"  Parsed {len(alias_rows):,} alias entries")

    unique_aliases = {r["alias"] for r in alias_rows}
    unique_canonicals = {r["canonical_symbol"] for r in alias_rows}
    print(f"  Unique aliases: {len(unique_aliases):,}, unique canonical symbols: {len(unique_canonicals):,}")

    # Deduplicate: keep first occurrence per UPPER(alias)
    seen: set[str] = set()
    deduped: list[dict] = []
    for entry in alias_rows:
        key = entry["alias"].upper()
        if key not in seen:
            seen.add(key)
            deduped.append(entry)
    if len(deduped) < len(alias_rows):
        print(f"  Deduplicated: {len(alias_rows):,} -> {len(deduped):,} (removed {len(alias_rows) - len(deduped):,} case-insensitive duplicates)")
    alias_rows = deduped

    total_loaded = 0
    batch: list[tuple] = []

    for entry in alias_rows:
        row = _build_row(layer_id, entry)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "aliases",
                records=batch,
                columns=COLUMNS,
                schema_name="gene",
            )
            total_loaded += len(batch)
            print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "aliases",
            records=batch,
            columns=COLUMNS,
            schema_name="gene",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Download helper ──────────────────────────────────────────────────────────


def download_gene_info() -> str:
    """Download Homo_sapiens.gene_info.gz to a temp file."""
    print(f"  Downloading from NCBI: {NCBI_FTP_URL}")
    tmp = tempfile.NamedTemporaryFile(suffix=".gene_info.gz", delete=False)
    urllib.request.urlretrieve(NCBI_FTP_URL, tmp.name)
    print(f"  Downloaded to: {tmp.name}")
    return tmp.name


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(filepath: str | None = None) -> None:
    """Connect and ingest NCBI gene aliases."""

    if filepath and not Path(filepath).exists():
        print(f"ERROR: File not found: {filepath}")
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
        print(f"\n{'='*60}")
        print("Ingesting NCBI gene aliases")
        print(f"{'='*60}")

        # 1. Register layer
        layer_id = await register_layer(conn)

        # 2. Check for existing data
        existing_count = await conn.fetchval(
            "SELECT count(*) FROM gene.aliases WHERE layer_id = $1",
            layer_id,
        )
        if existing_count > 0:
            print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
            print("  Skipping ingestion. Delete existing data first to re-ingest.")
            return

        # 3. Get file
        tmp_downloaded = False
        if not filepath:
            filepath = download_gene_info()
            tmp_downloaded = True

        try:
            # 4. Ingest
            total = await ingest(conn, layer_id, filepath)
            print(f"\n  Total alias rows loaded: {total:,}")
        finally:
            if tmp_downloaded:
                Path(filepath).unlink(missing_ok=True)

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest NCBI gene aliases into gene.aliases",
    )
    parser.add_argument(
        "--file",
        default=None,
        help="Path to Homo_sapiens.gene_info.gz (downloads from NCBI if omitted)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.file))


if __name__ == "__main__":
    cli()
