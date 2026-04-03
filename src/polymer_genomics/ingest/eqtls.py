"""GTEx v8 eQTL ingestion into qtl.eqtls.

Downloads significant eQTL variant-gene pairs from the GTEx v8 release,
deduplicates to the lead variant per gene-tissue pair (smallest p_nominal),
resolves ENSG IDs to gene symbols from the DB, and bulk-loads via COPY.

Usage::

    uv run python -m polymer_genomics.ingest.eqtls
    GTEX_DIR=/path/to/GTEx_Analysis_v8_eQTL uv run python -m polymer_genomics.ingest.eqtls
"""

from __future__ import annotations

import asyncio
import gzip
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# -- Constants ----------------------------------------------------------------

BATCH_SIZE = 50_000

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "variant_id", "gene_id", "gene_symbol", "tissue",
    "tss_distance", "effect_size", "p_value", "q_value",
]

DEFAULT_GTEX_DIR = "data/downloads/GTEx_Analysis_v8_eQTL"

FILE_SUFFIX = ".v8.signif_variant_gene_pairs.txt.gz"


# -- Helpers ------------------------------------------------------------------


def _parse_variant_id(variant_id: str) -> tuple[int, int, int] | None:
    """Parse GTEx variant_id into (chr_id, start_pos, end_pos).

    Format: chr1_64764_C_T_b38
    Returns 0-based half-open coordinates, or None if chromosome is invalid.
    """
    parts = variant_id.split("_")
    if len(parts) < 4:
        return None
    chrom = parts[0]  # already has 'chr' prefix
    chr_id = CHR_NAME_TO_ID.get(chrom)
    if chr_id is None:
        return None
    try:
        pos = int(parts[1])  # 1-based
    except ValueError:
        return None
    start_pos = pos - 1  # 0-based half-open
    end_pos = pos
    return chr_id, start_pos, end_pos


def _strip_ensg_version(gene_id: str) -> str:
    """Strip version suffix from ENSG ID: ENSG00000227232.5 -> ENSG00000227232."""
    if "." in gene_id:
        return gene_id.split(".")[0]
    return gene_id


# -- Tissue file reader -------------------------------------------------------


def read_tissue_file(path: Path) -> dict[str, dict]:
    """Read a tissue file and deduplicate to lead variant per gene.

    For each gene_id, keeps only the row with the smallest pval_nominal.

    Returns:
        dict mapping gene_id (versioned) -> best row dict
    """
    best: dict[str, dict] = {}
    skipped_chr = 0
    total_lines = 0

    with gzip.open(path, "rt") as f:
        header = f.readline().rstrip("\n").split("\t")
        col_idx = {name: i for i, name in enumerate(header)}

        # Required columns
        i_variant = col_idx["variant_id"]
        i_gene = col_idx["gene_id"]
        i_tss = col_idx["tss_distance"]
        i_pval = col_idx["pval_nominal"]
        i_slope = col_idx["slope"]
        i_pval_beta = col_idx["pval_beta"]

        for line in f:
            total_lines += 1
            fields = line.rstrip("\n").split("\t")

            variant_id = fields[i_variant]
            parsed = _parse_variant_id(variant_id)
            if parsed is None:
                skipped_chr += 1
                continue

            chr_id, start_pos, end_pos = parsed
            gene_id = fields[i_gene]

            try:
                pval = float(fields[i_pval])
            except (ValueError, IndexError):
                continue

            # Dedup: keep only smallest pval per gene
            if gene_id in best and best[gene_id]["p_value"] <= pval:
                continue

            try:
                tss_distance = int(fields[i_tss])
            except (ValueError, IndexError):
                tss_distance = None

            try:
                effect_size = float(fields[i_slope])
            except (ValueError, IndexError):
                effect_size = None

            try:
                q_value = float(fields[i_pval_beta])
            except (ValueError, IndexError):
                q_value = None

            best[gene_id] = {
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "variant_id": variant_id,
                "gene_id": _strip_ensg_version(gene_id),
                "tss_distance": tss_distance,
                "effect_size": effect_size,
                "p_value": pval,
                "q_value": q_value,
            }

    return best


# -- Gene symbol mapping ------------------------------------------------------


async def build_ensg_to_symbol(conn: asyncpg.Connection) -> dict[str, str]:
    """Build ENSG -> gene_symbol mapping from gene.features."""
    rows = await conn.fetch(
        "SELECT DISTINCT gene_id, gene_symbol FROM gene.features WHERE build = 'hg38'::genome_build"
    )
    mapping: dict[str, str] = {}
    for r in rows:
        gid = r["gene_id"]
        sym = r["gene_symbol"]
        if gid and sym:
            mapping[gid] = sym
    print(f"  Gene symbol mapping: {len(mapping):,} ENSG IDs")
    return mapping


# -- Layer registration -------------------------------------------------------


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "gtex_eqtl_v8"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'eqtl', $4,
                   'GTEx v8 (GTEx Consortium 2020 Science)',
                   'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"GTEx v8 eQTLs ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# -- Ingestion ----------------------------------------------------------------


def _build_row(
    layer_id: str,
    build: str,
    tissue: str,
    rec: dict,
    ensg_to_symbol: dict[str, str],
) -> tuple:
    gene_symbol = ensg_to_symbol.get(rec["gene_id"])
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["variant_id"], rec["gene_id"], gene_symbol, tissue,
        rec["tss_distance"], rec["effect_size"], rec["p_value"], rec["q_value"],
    )


async def ingest_tissue(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tissue: str,
    tissue_path: Path,
    ensg_to_symbol: dict[str, str],
) -> int:
    """Ingest a single tissue file into qtl.eqtls."""
    best = read_tissue_file(tissue_path)
    if not best:
        print(f"    WARNING: no records parsed from {tissue}")
        return 0

    total_loaded = 0
    batch: list[tuple] = []

    for rec in best.values():
        batch.append(_build_row(layer_id, build, tissue, rec, ensg_to_symbol))
        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "eqtls", records=batch,
                columns=COLUMNS, schema_name="qtl",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "eqtls", records=batch,
            columns=COLUMNS, schema_name="qtl",
        )
        total_loaded += len(batch)

    return total_loaded


# -- Main ---------------------------------------------------------------------


async def main() -> None:
    gtex_dir = Path(
        os.environ.get("GTEX_DIR", DEFAULT_GTEX_DIR)
    )
    if not gtex_dir.is_dir():
        print(f"ERROR: GTEx directory not found at {gtex_dir}")
        print("Set GTEX_DIR environment variable or place files in data/downloads/GTEx_Analysis_v8_eQTL/")
        return

    tissue_files = sorted(gtex_dir.glob(f"*{FILE_SUFFIX}"))
    if not tissue_files:
        print(f"ERROR: No *{FILE_SUFFIX} files found in {gtex_dir}")
        return

    print(f"Found {len(tissue_files)} tissue files in {gtex_dir}")

    build = "hg38"  # GTEx v8 is GRCh38

    conn = await get_ingest_connection(admin=True)
    try:
        print(f"\n{'='*60}")
        print(f"Ingesting GTEx v8 eQTLs - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        # Idempotency check
        existing = await conn.fetchval(
            "SELECT count(*) FROM qtl.eqtls WHERE layer_id = $1",
            layer_id,
        )
        if existing > 0:
            print(f"  WARNING: {existing:,} rows already exist for this layer. Skipping.")
            return

        # Build gene symbol mapping
        ensg_to_symbol = await build_ensg_to_symbol(conn)

        grand_total = 0
        resolved_count = 0
        unresolved_count = 0

        async with ingest_transaction(conn):
            for i, tissue_path in enumerate(tissue_files, 1):
                tissue = tissue_path.name.replace(FILE_SUFFIX, "")
                print(f"\n  [{i:2d}/{len(tissue_files)}] {tissue}")

                count = await ingest_tissue(
                    conn, build, layer_id, tissue, tissue_path, ensg_to_symbol,
                )
                grand_total += count
                print(f"    -> {count:,} lead eQTL variants loaded")

        # Summary stats
        final_count = await conn.fetchval(
            "SELECT count(*) FROM qtl.eqtls WHERE layer_id = $1", layer_id,
        )
        symbols_null = await conn.fetchval(
            "SELECT count(*) FROM qtl.eqtls WHERE layer_id = $1 AND gene_symbol IS NULL",
            layer_id,
        )

        print(f"\n{'='*60}")
        print(f"GTEx v8 eQTL ingestion complete")
        print(f"  Total rows loaded:    {final_count:,}")
        print(f"  Rows with symbol:     {final_count - symbols_null:,}")
        print(f"  Rows without symbol:  {symbols_null:,}")
        print(f"{'='*60}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
