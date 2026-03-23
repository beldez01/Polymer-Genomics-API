"""TAD domain ingestion from ENCODE 4 Hi-C Arrowhead calls.

Reads BEDPE files (Juicer Tools Arrowhead output) and loads into
regulatory.tad_domains.  Native GRCh38 coordinates.

Source: ENCODE portal, Aiden Lab intact Hi-C, Arrowhead v2.13.06.

Requires: asyncpg

Usage::

    uv run python -m polymer_genomics.ingest.tad_domains
    uv run python -m polymer_genomics.ingest.tad_domains --cell-type K562
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

BATCH_SIZE = 50_000

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/tad"
)

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "cell_type", "resolution_bp", "corner_score", "uvar_score", "lvar_score",
]


def _parse_arrowhead_bedpe(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> list[tuple[int, int, int, float | None, float | None, float | None]]:
    """Parse Arrowhead BEDPE output.

    ENCODE Arrowhead format (tab-separated):
        chr1  x1  x2  chr2  y1  y2  name  score  strand1  strand2  color
        score  uVarScore  lVarScore  upSign  loSign

    We extract: chr1, x1, x2, score (corner score), uVarScore, lVarScore.
    Since TADs are on the diagonal, chr1==chr2 and x1==y1, x2==y2.

    Returns list of (chr_id, start, end, corner_score, uvar, lvar).
    """
    rows: list[tuple[int, int, int, float | None, float | None, float | None]] = []

    opener = gzip.open if filepath.endswith(".gz") else open
    with opener(filepath, "rt") as f:
        for line in f:
            if line.startswith("#") or line.startswith("chr1\t"):
                continue
            parts = line.strip().split("\t")
            if len(parts) < 6:
                continue

            chrom = parts[0]
            if not chrom.startswith("chr"):
                chrom = f"chr{chrom}"
            chr_id = chr_name_to_id.get(chrom)
            if chr_id is None:
                continue

            try:
                start = int(parts[1])
                end = int(parts[2])
            except ValueError:
                continue

            # Corner score (column index 11 in full BEDPE, or 7 in some formats)
            corner_score = _safe_float(parts, 11) or _safe_float(parts, 7)
            uvar_score = _safe_float(parts, 12)
            lvar_score = _safe_float(parts, 13)

            rows.append((chr_id, start, end, corner_score, uvar_score, lvar_score))

    return rows


def _parse_bed(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> list[tuple[int, int, int, float | None, float | None, float | None]]:
    """Parse simple BED format (chr, start, end, [score]).

    Fallback for non-BEDPE TAD files.
    """
    rows: list[tuple[int, int, int, float | None, float | None, float | None]] = []

    opener = gzip.open if filepath.endswith(".gz") else open
    with opener(filepath, "rt") as f:
        for line in f:
            if line.startswith("#") or line.startswith("track"):
                continue
            parts = line.strip().split("\t")
            if len(parts) < 3:
                continue

            chrom = parts[0]
            if not chrom.startswith("chr"):
                chrom = f"chr{chrom}"
            chr_id = chr_name_to_id.get(chrom)
            if chr_id is None:
                continue

            try:
                start = int(parts[1])
                end = int(parts[2])
            except ValueError:
                continue

            score = _safe_float(parts, 4) or _safe_float(parts, 3)

            rows.append((chr_id, start, end, score, None, None))

    return rows


def _safe_float(parts: list[str], idx: int) -> float | None:
    """Safely extract a float from a split line."""
    if idx >= len(parts):
        return None
    try:
        val = float(parts[idx])
        return val
    except (ValueError, TypeError):
        return None


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "tad_domain"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default,
             evidence_class, tier, equilibrium_regime, statefulness,
             validation_status, interpretability, is_composite)
        VALUES
            ($1, $2, $3, 'tad_domain', $4,
             'ENCODE 4 Hi-C, Aiden Lab, Arrowhead v2.13.06',
             'cc_by_4_0', 'postgres', true, true,
             'M', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'mechanistic', false)
        RETURNING id
        """,
        layer_key, version,
        f"TAD Domains ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_tad_domains(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    data_dir: str,
    cell_type: str,
) -> int:
    """Load TAD domain data for a single cell type."""
    # Try BEDPE format first (Arrowhead native), then BED
    bedpe_candidates = [
        f"{cell_type}_arrowhead_domains.bedpe.gz",
        f"{cell_type}_arrowhead_domains.bedpe",
        f"{cell_type}_tad_domains.bedpe.gz",
        f"{cell_type}_tad_domains.bedpe",
        f"{cell_type}_contact_domains.bedpe.gz",
        f"{cell_type}_contact_domains.bedpe",
    ]

    bed_candidates = [
        f"{cell_type}_tad_domains.bed.gz",
        f"{cell_type}_tad_domains.bed",
        f"{cell_type}_tads.bed.gz",
        f"{cell_type}_tads.bed",
    ]

    rows = []
    for c in bedpe_candidates:
        path = os.path.join(data_dir, c)
        if Path(path).exists():
            print(f"  Parsing BEDPE file: {c}")
            rows = _parse_arrowhead_bedpe(path, CHR_NAME_TO_ID)
            break

    if not rows:
        for c in bed_candidates:
            path = os.path.join(data_dir, c)
            if Path(path).exists():
                print(f"  Parsing BED file: {c}")
                rows = _parse_bed(path, CHR_NAME_TO_ID)
                break

    if not rows:
        print(f"  ERROR: No TAD domain data found for {cell_type}.")
        print(f"  Looked in: {data_dir}")
        print(f"  Expected files: {bedpe_candidates[0]} or {bed_candidates[0]}")
        return 0

    print(f"  Parsed {len(rows):,} TAD domains for {cell_type}")

    total_loaded = 0
    batch: list[tuple] = []

    for chr_id, start, end, corner, uvar, lvar in rows:
        resolution = end - start
        batch.append((
            layer_id, build, chr_id, start, end,
            cell_type, resolution, corner, uvar, lvar,
        ))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "tad_domains",
                records=batch,
                columns=COLUMNS,
                schema_name="regulatory",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "tad_domains",
            records=batch,
            columns=COLUMNS,
            schema_name="regulatory",
        )
        total_loaded += len(batch)

    print(f"  {cell_type}: {total_loaded:,} rows loaded")
    return total_loaded


async def main(
    build: str = "hg38",
    data_dir: str | None = None,
    cell_types: list[str] | None = None,
) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR
    if cell_types is None:
        cell_types = ["GM12878", "K562", "HUES64"]

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("Download ENCODE Arrowhead domain files from encodeproject.org.")
        print("Place them in data/tad/ as <CellType>_arrowhead_domains.bedpe[.gz]")
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
        print(f"\n{'='*60}")
        print(f"TAD Domain Ingestion - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        grand_total = 0
        for cell_type in cell_types:
            # Check if this cell type already loaded
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM regulatory.tad_domains "
                "WHERE layer_id = $1 AND cell_type = $2",
                layer_id, cell_type,
            )
            if existing_count > 0:
                print(f"  WARNING: {cell_type} already has {existing_count:,} rows. Skipping.")
                continue

            total = await ingest_tad_domains(conn, build, layer_id, data_dir, cell_type)
            grand_total += total

        print(f"\n  Total TAD domain rows loaded: {grand_total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest TAD domains from ENCODE Arrowhead calls",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    parser.add_argument(
        "--cell-type",
        action="append",
        dest="cell_types",
        help="Cell type to ingest (can specify multiple). Default: GM12878, K562, H1-hESC",
    )
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir, args.cell_types))


if __name__ == "__main__":
    cli()
