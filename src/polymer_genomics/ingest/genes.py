"""GENCODE v44 gene model ingestion into gene.features.

Downloads the GENCODE v44 GTF annotation (hg38 and optionally hg37 liftover),
parses gene models, converts coordinates from 1-based closed (GTF) to 0-based
half-open (database), and bulk-loads via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.genes
    uv run python -m polymer_genomics.ingest.genes --build hg38
    uv run python -m polymer_genomics.ingest.genes --build hg37
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
import re
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest.loader import batch_load, compute_content_hash, update_layer_stats
from polymer_genomics.ingest.partitions import ensure_partitions

# ── Constants ─────────────────────────────────────────────────────────────────

GENCODE_URLS: dict[str, str] = {
    "hg38": (
        "https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/"
        "release_44/gencode.v44.annotation.gtf.gz"
    ),
    "hg37": (
        "https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/"
        "release_44/GRCh37_mapping/gencode.v44lift37.annotation.gtf.gz"
    ),
}

GENCODE_FILENAMES: dict[str, str] = {
    "hg38": "gencode.v44.annotation.gtf.gz",
    "hg37": "gencode.v44lift37.annotation.gtf.gz",
}

# Map GENCODE GTF feature types to our database enum values.
FEATURE_TYPE_MAP: dict[str, str] = {
    "gene": "gene",
    "transcript": "transcript",
    "exon": "exon",
    "CDS": "cds",
    "five_prime_utr": "utr5",
    "three_prime_utr": "utr3",
    "start_codon": "start_codon",
    "stop_codon": "stop_codon",
}

# Columns for batch_load (must match the order of tuple elements in _build_row).
COLUMNS: list[str] = [
    "layer_id",
    "build",
    "chr_id",
    "start_pos",
    "end_pos",
    "strand",
    "gene_symbol",
    "gene_id",
    "transcript_id",
    "feature_type",
    "gene_type",
]

BATCH_SIZE = 50_000

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

# Regex for extracting key=value pairs from GTF attribute strings.
# Matches:  key "value"  (with optional trailing semicolon and whitespace)
_ATTR_RE = re.compile(r'(\w+)\s+"([^"]*)"')


# ── Parsing ───────────────────────────────────────────────────────────────────


def parse_attributes(attr_str: str) -> dict[str, str]:
    """Parse a GTF attribute string into a dict of key-value pairs.

    GTF attributes are semicolon-separated ``key "value"`` pairs::

        gene_id "ENSG00000223972.6"; gene_name "DDX11L2"; gene_type "lncRNA";

    Parameters
    ----------
    attr_str
        The raw attribute string (column 9 of a GTF line).

    Returns
    -------
    dict[str, str]
        Parsed key-value pairs.
    """
    return dict(_ATTR_RE.findall(attr_str))


def parse_gtf_line(line: str) -> dict | None:
    """Parse a single GTF line into a feature dict.

    Returns ``None`` for lines that should be skipped (comments, unrecognised
    chromosomes, or feature types not in our enum).

    Parameters
    ----------
    line
        A single line from a GTF file (may include trailing newline).

    Returns
    -------
    dict | None
        Parsed feature with keys: chr_id, start_pos, end_pos, strand,
        gene_symbol, gene_id, transcript_id, feature_type.
        Or ``None`` if the line should be skipped.
    """
    line = line.rstrip("\n\r")

    # Skip comments and blank lines.
    if not line or line.startswith("#"):
        return None

    fields = line.split("\t")
    if len(fields) < 9:
        return None

    seqname = fields[0]
    feature = fields[2]
    start = fields[3]
    end = fields[4]
    strand = fields[6]
    attr_str = fields[8]

    # Skip chromosomes not in our reference set.
    chr_id = CHR_NAME_TO_ID.get(seqname)
    if chr_id is None:
        return None

    # Map GTF feature type to our enum.
    mapped_feature = FEATURE_TYPE_MAP.get(feature)
    if mapped_feature is None:
        return None

    # Parse attributes for gene info.
    attrs = parse_attributes(attr_str)
    gene_symbol = attrs.get("gene_name")
    if gene_symbol is None:
        # gene_name is required; skip lines without it.
        return None

    gene_id = attrs.get("gene_id")
    transcript_id = attrs.get("transcript_id")
    gene_type = attrs.get("gene_type")

    # Convert coordinates: GTF is 1-based closed -> 0-based half-open.
    # start_pos = gtf_start - 1, end_pos = gtf_end (unchanged)
    start_pos = int(start) - 1
    end_pos = int(end)

    return {
        "chr_id": chr_id,
        "start_pos": start_pos,
        "end_pos": end_pos,
        "strand": strand,
        "gene_symbol": gene_symbol,
        "gene_id": gene_id,
        "transcript_id": transcript_id,
        "feature_type": mapped_feature,
        "gene_type": gene_type,
    }


# ── Download ──────────────────────────────────────────────────────────────────


def download_gtf(build: str, dest_dir: Path | None = None) -> Path:
    """Download a GENCODE GTF file if not already present.

    Parameters
    ----------
    build
        Genome build (``hg38`` or ``hg37``).
    dest_dir
        Directory to save the file. Defaults to ``data/``.

    Returns
    -------
    Path
        Path to the downloaded (or already existing) file.
    """
    if dest_dir is None:
        dest_dir = DATA_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = GENCODE_FILENAMES[build]
    dest = dest_dir / filename

    if dest.exists():
        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"  GTF already downloaded: {dest} ({size_mb:.1f} MB)")
        return dest

    url = GENCODE_URLS[build]
    print(f"  Downloading {url} ...")
    urllib.request.urlretrieve(url, dest)
    size_mb = dest.stat().st_size / (1024 * 1024)
    print(f"  Saved: {dest} ({size_mb:.1f} MB)")
    return dest


# ── Ingestion ─────────────────────────────────────────────────────────────────


def iter_gtf_features(gtf_path: Path) -> Iterator[dict]:
    """Iterate over parsed features from a gzipped GTF file.

    Yields
    ------
    dict
        Parsed feature dicts (from ``parse_gtf_line``), skipping ``None`` results.
    """
    with gzip.open(gtf_path, "rt", encoding="utf-8") as fh:
        for line in fh:
            record = parse_gtf_line(line)
            if record is not None:
                yield record


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the GENCODE v44 layer in registry.layers.

    Uses ``layer_key='gencode_v44'`` with the build-specific version.

    Parameters
    ----------
    conn
        Admin connection.
    build
        Genome build (``hg38`` or ``hg37``).

    Returns
    -------
    str
        The layer UUID.
    """
    layer_key = "gencode_v44"
    version = f"44.{build}"

    # Check if already registered.
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
            ($1, $2, $3, 'gene_model', $4,
             'gencodegenes.org', 'cc0_1_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"GENCODE v44 ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    gtf_path: Path,
) -> int:
    """Parse a GTF file and load features into gene.features.

    Parameters
    ----------
    conn
        Database connection with INSERT privilege on gene schema.
    build
        Genome build (``hg38`` or ``hg37``).
    layer_id
        UUID of the registered layer.
    gtf_path
        Path to the gzipped GTF file.

    Returns
    -------
    int
        Total number of rows loaded.
    """
    # Ensure partitions exist for all chromosomes.
    chr_ids = list(range(1, 26))
    await ensure_partitions(conn, "gene", "features", build, chr_ids)

    total_loaded = 0
    batch: list[tuple] = []

    for feature in iter_gtf_features(gtf_path):
        row = (
            layer_id,
            build,
            feature["chr_id"],
            feature["start_pos"],
            feature["end_pos"],
            feature["strand"],
            feature["gene_symbol"],
            feature["gene_id"],
            feature["transcript_id"],
            feature["feature_type"],
            feature["gene_type"],
        )
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            n = await batch_load(conn, "gene", "features", batch, COLUMNS)
            total_loaded += n
            print(f"    Loaded batch: {n} rows (total: {total_loaded:,})")
            batch = []

    # Flush remaining rows.
    if batch:
        n = await batch_load(conn, "gene", "features", batch, COLUMNS)
        total_loaded += n
        print(f"    Loaded final batch: {n} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ──────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect as admin and ingest GENCODE v44 gene models.

    Parameters
    ----------
    builds
        List of builds to ingest. Defaults to ``["hg38", "hg37"]``.
    """
    if builds is None:
        builds = ["hg38", "hg37"]

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
            print(f"Ingesting GENCODE v44 — {build}")
            print(f"{'='*60}")

            # 1. Register layer.
            layer_id = await register_layer(conn, build)

            # 2. Download GTF if needed.
            gtf_path = download_gtf(build)

            # 3. Check for existing data to avoid duplicates.
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM gene.features WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 4. Parse GTF and batch load.
            total = await ingest_build(conn, build, layer_id, gtf_path)
            print(f"\n  Total rows loaded: {total:,}")

            # 5. Compute content hash and update layer stats.
            print("  Computing content hash (this may take a moment)...")
            content_hash = await compute_content_hash(
                conn, "gene", "features", str(layer_id)
            )
            await update_layer_stats(conn, str(layer_id), total, content_hash)
            print(f"  Content hash: {content_hash[:30]}...")
            print("  Layer stats updated.")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest GENCODE v44 gene models into gene.features",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build to ingest (default: both hg38 and hg37)",
    )
    args = parser.parse_args()

    builds = [args.build] if args.build else None
    asyncio.run(main(builds))


if __name__ == "__main__":
    cli()
