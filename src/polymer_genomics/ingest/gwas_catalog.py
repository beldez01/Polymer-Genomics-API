"""EBI GWAS Catalog ingestion into annotation.gwas_associations.

Reads the EBI GWAS Catalog "All associations" TSV download (with GRCh38
mappings) and bulk-loads genome-wide significant associations (p < 5e-8).

Usage::

    uv run python -m polymer_genomics.ingest.gwas_catalog
    GWAS_FILE=/path/to/gwas.tsv uv run python -m polymer_genomics.ingest.gwas_catalog
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# -- Constants ----------------------------------------------------------------

BATCH_SIZE = 10_000

P_VALUE_THRESHOLD = 5e-8

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "rsid", "p_value", "or_beta", "ci_95",
    "trait", "mapped_gene", "study_accession", "pubmed_id",
]

# Valid chromosome names in the GWAS catalog (just numbers + X, Y)
_GWAS_CHR_MAP: dict[str, int] = {}
for _i in range(1, 23):
    _GWAS_CHR_MAP[str(_i)] = CHR_NAME_TO_ID[f"chr{_i}"]
_GWAS_CHR_MAP["X"] = CHR_NAME_TO_ID["chrX"]
_GWAS_CHR_MAP["Y"] = CHR_NAME_TO_ID["chrY"]


# -- TSV reader ---------------------------------------------------------------


def _parse_float(val: str) -> float | None:
    """Parse a float from a string, returning None on failure."""
    if not val or val.strip() == "":
        return None
    try:
        return float(val)
    except (ValueError, OverflowError):
        return None


def _parse_or_beta(val: str) -> float | None:
    """Parse OR or BETA value (real)."""
    f = _parse_float(val)
    if f is None:
        return None
    # Clamp to float32 range for storage as real
    if abs(f) > 3.4e38:
        return None
    return f


def read_gwas_tsv(tsv_path: str | Path) -> list[dict]:
    """Parse the EBI GWAS Catalog associations TSV.

    The catalog uses 1-based coordinates; we convert to 0-based half-open
    (start = pos - 1, end = pos) for internal storage.

    Only rows with p-value < 5e-8 (genome-wide significance) are kept.
    """
    rows: list[dict] = []
    skipped_chr = 0
    skipped_pval = 0
    skipped_pos = 0

    with open(tsv_path, encoding="utf-8") as f:
        header_line = f.readline().rstrip("\n")
        headers = header_line.split("\t")

        # Build column index map
        col_idx: dict[str, int] = {}
        for i, h in enumerate(headers):
            col_idx[h] = i

        # Required columns
        needed = ["CHR_ID", "CHR_POS", "P-VALUE", "DISEASE/TRAIT"]
        for col in needed:
            if col not in col_idx:
                raise ValueError(f"Missing required column: {col!r} in GWAS TSV header")

        idx_chr = col_idx["CHR_ID"]
        idx_pos = col_idx["CHR_POS"]
        idx_snps = col_idx.get("SNPS")
        idx_pval = col_idx["P-VALUE"]
        idx_or = col_idx.get("OR or BETA")
        idx_ci = col_idx.get("95% CI (TEXT)")
        idx_trait = col_idx["DISEASE/TRAIT"]
        idx_gene = col_idx.get("MAPPED_GENE")
        idx_study = col_idx.get("STUDY ACCESSION")
        idx_pubmed = col_idx.get("PUBMEDID")

        for line in f:
            fields = line.rstrip("\n").split("\t")

            # Chromosome
            chr_raw = fields[idx_chr].strip() if idx_chr < len(fields) else ""
            chr_id = _GWAS_CHR_MAP.get(chr_raw)
            if chr_id is None:
                skipped_chr += 1
                continue

            # Position (1-based in catalog)
            pos_raw = fields[idx_pos].strip() if idx_pos < len(fields) else ""
            if not pos_raw:
                skipped_pos += 1
                continue
            # Some rows have multiple positions separated by ';' or 'x'
            # Take the first valid integer
            pos_str = pos_raw.split(";")[0].strip().split("x")[0].strip()
            try:
                pos = int(pos_str)
            except ValueError:
                skipped_pos += 1
                continue

            # P-value (filter for genome-wide significance)
            pval_raw = fields[idx_pval].strip() if idx_pval < len(fields) else ""
            p_value = _parse_float(pval_raw)
            if p_value is None or p_value >= P_VALUE_THRESHOLD:
                skipped_pval += 1
                continue

            # Convert to 0-based half-open
            start_pos = pos - 1
            end_pos = pos

            # Optional fields
            rsid = (fields[idx_snps].strip() if idx_snps is not None and idx_snps < len(fields) else None) or None
            or_beta = _parse_or_beta(fields[idx_or].strip() if idx_or is not None and idx_or < len(fields) else "")
            ci_95 = (fields[idx_ci].strip() if idx_ci is not None and idx_ci < len(fields) else None) or None
            trait = fields[idx_trait].strip() if idx_trait < len(fields) else ""
            mapped_gene = (fields[idx_gene].strip() if idx_gene is not None and idx_gene < len(fields) else None) or None
            study_accession = (fields[idx_study].strip() if idx_study is not None and idx_study < len(fields) else None) or None
            pubmed_id = (fields[idx_pubmed].strip() if idx_pubmed is not None and idx_pubmed < len(fields) else None) or None

            if not trait:
                continue

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "rsid": rsid,
                "p_value": p_value,
                "or_beta": or_beta,
                "ci_95": ci_95,
                "trait": trait,
                "mapped_gene": mapped_gene,
                "study_accession": study_accession,
                "pubmed_id": pubmed_id,
            })

    print(f"  Parsed {len(rows):,} genome-wide significant associations")
    print(f"  Skipped: {skipped_chr:,} (bad chr), {skipped_pos:,} (bad pos), {skipped_pval:,} (p >= 5e-8 or missing)")
    return rows


# -- Layer registration -------------------------------------------------------


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the EBI GWAS Catalog layer."""
    layer_key = "gwas_catalog_ebi_v1"
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
            ($1, $2, $3, 'gwas', $4,
             'EBI_GWAS_Catalog', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"EBI GWAS Catalog ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# -- Ingestion ----------------------------------------------------------------


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["rsid"], rec["p_value"], rec["or_beta"], rec["ci_95"],
        rec["trait"], rec["mapped_gene"], rec["study_accession"], rec["pubmed_id"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    gwas_file: str | Path,
) -> int:
    """Read the GWAS catalog TSV and bulk-load into annotation.gwas_associations."""
    print(f"\n  Reading GWAS catalog: {gwas_file}")
    records = read_gwas_tsv(gwas_file)

    if not records:
        print("  ERROR: No records parsed from GWAS catalog")
        return 0

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        row = _build_row(layer_id, build, rec)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "gwas_associations",
                records=batch,
                columns=COLUMNS,
                schema_name="annotation",
            )
            total_loaded += len(batch)
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "gwas_associations",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)

    print(f"  Loaded {total_loaded:,} GWAS associations")
    return total_loaded


# -- Main ---------------------------------------------------------------------


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest EBI GWAS Catalog data."""
    if builds is None:
        builds = ["hg38"]

    gwas_file = os.environ.get(
        "GWAS_FILE",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/gwas/gwas_catalog_associations.tsv",
    )

    if not Path(gwas_file).is_file():
        print(f"ERROR: GWAS catalog file not found at {gwas_file}")
        print("Set GWAS_FILE environment variable to the correct path.")
        return

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    conn = await asyncpg.connect(
        host=host, port=port, database=database, user=user, password=password,
    )

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting EBI GWAS Catalog - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM annotation.gwas_associations WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, gwas_file)
            print(f"\n  Total GWAS associations loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest EBI GWAS Catalog associations into annotation.gwas_associations",
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
