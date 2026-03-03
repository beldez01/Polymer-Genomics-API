"""Methylation atlas ingestion into methylation.atlas_layers + S3/MinIO.

Reads a pre-processed methylation reference matrix (CSV/TSV) with per-cell-type
beta values, generates per-cell-type Parquet files, uploads to S3/MinIO, registers
in storage.objects and methylation.atlas_layers, and pre-computes 10kb summary bins.

Supports the standard 6 hematopoietic cell types from the Reinius/Salas reference:
CD4T, CD8T, NK, Bcell, Mono, Gran.

Usage::

    uv run python -m polymer_genomics.ingest.methylation
    uv run python -m polymer_genomics.ingest.methylation --build hg38
    uv run python -m polymer_genomics.ingest.methylation --csv /path/to/matrix.csv
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import os
import tempfile
from collections import defaultdict
from csv import DictReader
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.s3 import get_s3_client

# ── Constants ────────────────────────────────────────────────────────────────

CELL_TYPES = ["CD4T", "CD8T", "NK", "Bcell", "Mono", "Gran"]

DEFAULT_BIN_SIZE = 10_000  # 10kb summary bins

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

S3_PREFIX = "methylation/atlas"

# Expected CSV columns: probe_id, chr, pos, CD4T, CD8T, NK, Bcell, Mono, Gran
REQUIRED_COLUMNS = {"probe_id", "chr", "pos"}


# ── CSV Reading ──────────────────────────────────────────────────────────────


def read_methylation_matrix(csv_path: str | Path) -> dict[str, dict]:
    """Read a pre-processed methylation reference matrix from CSV.

    The CSV must have columns: probe_id, chr, pos, and one column per cell type.
    Beta values should be floats in [0, 1].

    Parameters
    ----------
    csv_path
        Path to the CSV file (comma or tab delimited).

    Returns
    -------
    dict[str, dict]
        Mapping of probe_id to a dict with keys: chr, chr_id, pos, and
        per-cell-type beta values. Rows with unrecognised chromosomes or
        missing required fields are silently skipped.

    Raises
    ------
    FileNotFoundError
        If the CSV file does not exist.
    ValueError
        If required columns are missing from the CSV header.
    """
    csv_path = Path(csv_path)
    if not csv_path.exists():
        msg = f"Methylation matrix not found: {csv_path}"
        raise FileNotFoundError(msg)

    # Detect delimiter (tab or comma).
    with open(csv_path, encoding="utf-8") as fh:
        first_line = fh.readline()
    delimiter = "\t" if "\t" in first_line else ","

    probes: dict[str, dict] = {}

    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = DictReader(fh, delimiter=delimiter)

        if reader.fieldnames is None:
            msg = f"Empty or malformed CSV: {csv_path}"
            raise ValueError(msg)

        header_set = set(reader.fieldnames)
        missing = REQUIRED_COLUMNS - header_set
        if missing:
            msg = f"Missing required columns: {sorted(missing)}"
            raise ValueError(msg)

        # Determine which cell types are present in this file.
        available_cell_types = [ct for ct in CELL_TYPES if ct in header_set]

        for row in reader:
            probe_id = row.get("probe_id", "").strip()
            chr_name = row.get("chr", "").strip()
            pos_str = row.get("pos", "").strip()

            if not probe_id or not chr_name or not pos_str:
                continue

            chr_id = CHR_NAME_TO_ID.get(chr_name)
            if chr_id is None:
                continue

            try:
                pos = int(pos_str)
            except ValueError:
                continue

            entry: dict = {
                "chr": chr_name,
                "chr_id": chr_id,
                "pos": pos,
            }

            for ct in available_cell_types:
                raw = row.get(ct, "").strip()
                if raw == "" or raw.upper() == "NA":
                    entry[ct] = None
                else:
                    try:
                        beta = float(raw)
                        if not (0.0 <= beta <= 1.0):
                            entry[ct] = None
                        else:
                            entry[ct] = beta
                    except ValueError:
                        entry[ct] = None

            probes[probe_id] = entry

    return probes


# ── Parquet Generation ───────────────────────────────────────────────────────


def create_cell_type_parquet(
    probe_data: dict[str, dict],
    cell_type: str,
    output_dir: str | Path,
) -> str:
    """Create a Parquet file for one cell type's beta values.

    The Parquet file contains columns: probe_id, chr, chr_id, pos, beta.
    Probes with missing beta values for this cell type are excluded.

    Parameters
    ----------
    probe_data
        Full probe data dict from ``read_methylation_matrix``.
    cell_type
        Cell type column name (e.g. ``'CD4T'``).
    output_dir
        Directory to write the Parquet file.

    Returns
    -------
    str
        Absolute path to the created Parquet file.

    Raises
    ------
    ValueError
        If cell_type is not in CELL_TYPES.
    """
    if cell_type not in CELL_TYPES:
        msg = f"Unknown cell type: {cell_type!r}. Must be one of {CELL_TYPES}"
        raise ValueError(msg)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    probe_ids = []
    chrs = []
    chr_ids = []
    positions = []
    betas = []

    for probe_id, entry in sorted(probe_data.items()):
        beta = entry.get(cell_type)
        if beta is None:
            continue
        probe_ids.append(probe_id)
        chrs.append(entry["chr"])
        chr_ids.append(entry["chr_id"])
        positions.append(entry["pos"])
        betas.append(beta)

    table = pa.table({
        "probe_id": pa.array(probe_ids, type=pa.string()),
        "chr": pa.array(chrs, type=pa.string()),
        "chr_id": pa.array(chr_ids, type=pa.int16()),
        "pos": pa.array(positions, type=pa.int32()),
        "beta": pa.array(betas, type=pa.float32()),
    })

    out_path = output_dir / f"{cell_type}.parquet"
    pq.write_table(table, out_path)

    return str(out_path.resolve())


# ── Summary Bins ─────────────────────────────────────────────────────────────


def create_summary_bins(
    probe_data: dict[str, dict],
    cell_type: str,
    bin_size: int = DEFAULT_BIN_SIZE,
) -> pa.Table:
    """Pre-compute mean beta values in fixed-size genomic bins for one cell type.

    Each bin is ``[bin_start, bin_start + bin_size)`` on each chromosome.
    Only bins with at least one probe are included.

    Parameters
    ----------
    probe_data
        Full probe data dict from ``read_methylation_matrix``.
    cell_type
        Cell type to summarise.
    bin_size
        Bin width in base pairs (default 10,000).

    Returns
    -------
    pa.Table
        Arrow table with columns: chr, chr_id, bin_start, bin_end,
        mean_beta, n_probes.
    """
    # Accumulate per-bin sums and counts.
    # Key: (chr_name, chr_id, bin_start) -> (sum_beta, count)
    bins: dict[tuple[str, int, int], tuple[float, int]] = defaultdict(lambda: (0.0, 0))

    for entry in probe_data.values():
        beta = entry.get(cell_type)
        if beta is None:
            continue
        chr_name = entry["chr"]
        chr_id = entry["chr_id"]
        pos = entry["pos"]
        bin_start = (pos // bin_size) * bin_size
        key = (chr_name, chr_id, bin_start)
        prev_sum, prev_count = bins[key]
        bins[key] = (prev_sum + beta, prev_count + 1)

    # Sort by (chr_id, bin_start) for deterministic output.
    sorted_keys = sorted(bins.keys(), key=lambda k: (k[1], k[2]))

    chrs = []
    chr_ids = []
    bin_starts = []
    bin_ends = []
    mean_betas = []
    n_probes = []

    for chr_name, chr_id, bin_start in sorted_keys:
        total, count = bins[(chr_name, chr_id, bin_start)]
        chrs.append(chr_name)
        chr_ids.append(chr_id)
        bin_starts.append(bin_start)
        bin_ends.append(bin_start + bin_size)
        mean_betas.append(total / count)
        n_probes.append(count)

    return pa.table({
        "chr": pa.array(chrs, type=pa.string()),
        "chr_id": pa.array(chr_ids, type=pa.int16()),
        "bin_start": pa.array(bin_starts, type=pa.int32()),
        "bin_end": pa.array(bin_ends, type=pa.int32()),
        "mean_beta": pa.array(mean_betas, type=pa.float32()),
        "n_probes": pa.array(n_probes, type=pa.int32()),
    })


def write_summary_parquet(
    probe_data: dict[str, dict],
    cell_type: str,
    output_dir: str | Path,
    bin_size: int = DEFAULT_BIN_SIZE,
) -> str:
    """Create and write summary bin Parquet for one cell type.

    Parameters
    ----------
    probe_data
        Full probe data dict from ``read_methylation_matrix``.
    cell_type
        Cell type to summarise.
    output_dir
        Directory to write the output file.
    bin_size
        Bin width in base pairs.

    Returns
    -------
    str
        Absolute path to the created summary Parquet file.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    table = create_summary_bins(probe_data, cell_type, bin_size)
    out_path = output_dir / f"{cell_type}_summary_{bin_size}bp.parquet"
    pq.write_table(table, out_path)

    return str(out_path.resolve())


# ── File Hashing ─────────────────────────────────────────────────────────────


def compute_file_hash(file_path: str | Path) -> str:
    """Compute a SHA-256 hash of a file.

    Reads the file in 64 KB chunks for memory efficiency.

    Parameters
    ----------
    file_path
        Path to the file.

    Returns
    -------
    str
        Hash in the format ``sha256:<hex_digest>``.

    Raises
    ------
    FileNotFoundError
        If the file does not exist.
    """
    file_path = Path(file_path)
    if not file_path.exists():
        msg = f"File not found: {file_path}"
        raise FileNotFoundError(msg)

    hasher = hashlib.sha256()
    with open(file_path, "rb") as fh:
        while True:
            chunk = fh.read(65536)
            if not chunk:
                break
            hasher.update(chunk)
    return f"sha256:{hasher.hexdigest()}"


# ── S3 Upload ────────────────────────────────────────────────────────────────


async def upload_to_s3(
    file_path: str | Path,
    bucket: str,
    key: str,
) -> dict:
    """Upload a file to S3/MinIO.

    Uses the shared boto3 client from ``polymer_genomics.s3``.

    Parameters
    ----------
    file_path
        Path to the local file.
    bucket
        S3 bucket name.
    key
        S3 object key.

    Returns
    -------
    dict
        Upload metadata with keys: etag, version_id (both from S3 response),
        size_bytes (local file size).
    """
    file_path = Path(file_path)
    client = get_s3_client()

    # Ensure bucket exists (MinIO auto-create).
    try:
        client.head_bucket(Bucket=bucket)
    except client.exceptions.ClientError:
        client.create_bucket(Bucket=bucket)

    # Upload the file. boto3's upload_file is synchronous; wrap in executor
    # for async compatibility.
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_path.read_bytes(),
        ),
    )

    return {
        "etag": response.get("ETag", "").strip('"'),
        "version_id": response.get("VersionId"),
        "size_bytes": file_path.stat().st_size,
    }


# ── Database Registration ───────────────────────────────────────────────────


async def register_layer(
    conn,
    build: str,
) -> str:
    """Register (or retrieve) the methylation atlas layer in registry.layers.

    Parameters
    ----------
    conn
        An asyncpg connection with INSERT privilege on registry.layers.
    build
        Genome build (e.g. ``'hg38'``).

    Returns
    -------
    str
        The layer UUID.
    """
    layer_key = "methylation_atlas"
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
            ($1, $2, $3, 'methylation', $4,
             'Reinius2012/Salas2018', 'public_domain', 'object_storage', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Methylation Atlas ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def register_storage_object(
    conn,
    layer_id: str,
    bucket: str,
    key: str,
    content_hash: str,
    size_bytes: int,
    file_type: str,
    description: str,
) -> str:
    """Register a file in storage.objects.

    Parameters
    ----------
    conn
        An asyncpg connection with INSERT privilege on storage.objects.
    layer_id
        UUID of the parent registry layer.
    bucket
        S3 bucket name.
    key
        S3 object key.
    content_hash
        SHA-256 hash of the file content.
    size_bytes
        File size in bytes.
    file_type
        File format (e.g. ``'parquet'``, ``'bigwig'``).
    description
        Human-readable description.

    Returns
    -------
    str
        The storage object UUID.
    """
    obj_id = await conn.fetchval(
        """
        INSERT INTO storage.objects
            (layer_id, provider, bucket, key, content_hash,
             size_bytes, file_type, description)
        VALUES
            ($1, 'aws_s3', $2, $3, $4, $5, $6, $7)
        ON CONFLICT (provider, bucket, key) DO UPDATE
            SET content_hash = EXCLUDED.content_hash,
                size_bytes = EXCLUDED.size_bytes,
                description = EXCLUDED.description
        RETURNING id
        """,
        layer_id,
        bucket,
        key,
        content_hash,
        size_bytes,
        file_type,
        description,
    )
    print(f"    Registered storage object: {key} -> {obj_id}")
    return obj_id


async def register_atlas_layer(
    conn,
    layer_id: str,
    cell_type: str,
    build: str,
    *,
    bigwig_ref: str | None = None,
    parquet_ref: str | None = None,
    summary_ref: str | None = None,
    n_samples: int | None = None,
    mean_coverage: float | None = None,
    metadata: dict | None = None,
) -> str:
    """Register a cell-type entry in methylation.atlas_layers.

    Parameters
    ----------
    conn
        An asyncpg connection with INSERT privilege on methylation.atlas_layers.
    layer_id
        UUID of the parent registry layer.
    cell_type
        Cell type name (e.g. ``'CD4T'``).
    build
        Genome build.
    bigwig_ref
        UUID of the BigWig storage object (None for V1).
    parquet_ref
        UUID of the Parquet storage object.
    summary_ref
        UUID of the summary Parquet storage object.
    n_samples
        Number of samples used to compute the reference.
    mean_coverage
        Mean CpG coverage across samples.
    metadata
        Additional metadata as JSON.

    Returns
    -------
    str
        The atlas layer UUID.
    """
    import json

    atlas_id = await conn.fetchval(
        """
        INSERT INTO methylation.atlas_layers
            (layer_id, cell_type, build, bigwig_ref, parquet_ref, summary_ref,
             n_samples, mean_coverage, metadata)
        VALUES
            ($1, $2, $3::genome_build, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING id
        """,
        layer_id,
        cell_type,
        build,
        bigwig_ref,
        parquet_ref,
        summary_ref,
        n_samples,
        mean_coverage,
        json.dumps(metadata) if metadata else None,
    )
    print(f"    Registered atlas layer: {cell_type}/{build} -> {atlas_id}")
    return atlas_id


# ── Postgres Reference Table Pipeline ────────────────────────────────────────


REFERENCE_COLUMNS = [
    "layer_id",
    "build",
    "chr_id",
    "probe_id",
    "pos",
    "gran",
    "mono",
    "nk",
    "bcell",
    "cd4t",
    "cd8t",
]

REFERENCE_BATCH_SIZE = 50_000


async def register_reference_layer(conn, build: str) -> str:
    """Register (or retrieve) the methylation atlas layer for Postgres storage.

    If the layer already exists (from S3 ingest), updates storage_type to 'both'.
    """
    layer_key = "methylation_atlas"
    version = f"1.0.{build}"

    existing = await conn.fetchrow(
        "SELECT id, storage_type::text FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key,
        version,
    )
    if existing is not None:
        layer_id = existing["id"]
        # If it was object_storage only, upgrade to 'both'
        if existing["storage_type"] == "object_storage":
            await conn.execute(
                "UPDATE registry.layers SET storage_type = 'both' WHERE id = $1",
                layer_id,
            )
            print(f"  Layer upgraded to storage_type='both': {layer_id}")
        else:
            print(f"  Layer already registered: {layer_key} v{version} -> {layer_id}")
        return layer_id

    layer_id = await conn.fetchval(
        """
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
        VALUES
            ($1, $2, $3, 'methylation', $4,
             'Reinius2012/Salas2018', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Methylation Atlas ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_reference(
    conn,
    build: str,
    matrix_path: str | Path,
) -> int:
    """Populate ref.methylation_reference from a CSV exported by export_methylation_reference.R.

    Steps:
    1. Register the layer (or retrieve existing).
    2. Read the CSV.
    3. Convert 1-based positions to 0-based (internal convention).
    4. Batch-load into ref.methylation_reference via COPY protocol.
    5. Update layer stats (row_count, content_hash).

    Returns the number of rows loaded.
    """
    from polymer_genomics.ingest.loader import batch_load, compute_content_hash, update_layer_stats

    matrix_path = Path(matrix_path)

    # 1. Register layer.
    layer_id = await register_reference_layer(conn, build)

    # Check for existing data.
    existing_count = await conn.fetchval(
        "SELECT COUNT(*) FROM ref.methylation_reference WHERE layer_id = $1 AND build = $2::genome_build",
        layer_id,
        build,
    )
    if existing_count and existing_count > 0:
        print(f"  WARNING: {existing_count:,} rows already exist. Truncating...")
        await conn.execute(
            "DELETE FROM ref.methylation_reference WHERE layer_id = $1 AND build = $2::genome_build",
            layer_id,
            build,
        )

    # 2. Read the CSV.
    print(f"  Reading methylation matrix: {matrix_path}")
    probe_data = read_methylation_matrix(matrix_path)
    print(f"  Loaded {len(probe_data):,} probes")

    # 3. Build rows: convert 1-based pos to 0-based (internal).
    rows = []
    for probe_id, entry in sorted(probe_data.items()):
        pos_0based = entry["pos"] - 1  # CSV is 1-based, DB is 0-based
        rows.append((
            layer_id,
            build,
            entry["chr_id"],
            probe_id,
            pos_0based,
            entry.get("Gran") or entry.get("gran"),
            entry.get("Mono") or entry.get("mono"),
            entry.get("NK") or entry.get("nk"),
            entry.get("Bcell") or entry.get("bcell"),
            entry.get("CD4T") or entry.get("cd4t"),
            entry.get("CD8T") or entry.get("cd8t"),
        ))

    # 4. Batch-load.
    total_loaded = 0
    for i in range(0, len(rows), REFERENCE_BATCH_SIZE):
        batch = rows[i : i + REFERENCE_BATCH_SIZE]
        n = await batch_load(conn, "ref", "methylation_reference", batch, REFERENCE_COLUMNS)
        total_loaded += n
        print(f"    Loaded batch {i // REFERENCE_BATCH_SIZE + 1}: {n:,} rows (total: {total_loaded:,})")

    # 5. Update layer stats.
    content_hash = await compute_content_hash(conn, "ref", "methylation_reference", str(layer_id))
    await update_layer_stats(conn, str(layer_id), total_loaded, content_hash)
    print(f"  Reference ingest complete: {total_loaded:,} rows, hash={content_hash[:20]}...")

    return total_loaded


# ── Full Pipeline (S3/Parquet) ──────────────────────────────────────────────


async def ingest_build(
    conn,
    build: str,
    matrix_path: str | Path,
    *,
    bucket: str | None = None,
) -> dict[str, str]:
    """Full ingestion pipeline for one genome build.

    Steps:
    1. Register the methylation atlas layer.
    2. Read the methylation matrix CSV.
    3. For each cell type:
       a. Generate per-cell-type Parquet.
       b. Generate 10kb summary Parquet.
       c. Compute content hashes.
       d. Upload both files to S3/MinIO.
       e. Register in storage.objects.
       f. Register in methylation.atlas_layers.

    Parameters
    ----------
    conn
        Database connection with admin privileges.
    build
        Genome build (``hg38`` or ``hg37``).
    matrix_path
        Path to the methylation matrix CSV.
    bucket
        S3 bucket name. Defaults to ``settings.s3_bucket``.

    Returns
    -------
    dict[str, str]
        Mapping of cell_type to atlas_layer UUID.
    """
    if bucket is None:
        bucket = settings.s3_bucket

    matrix_path = Path(matrix_path)

    # 1. Register the parent layer.
    layer_id = await register_layer(conn, build)

    # 2. Read the methylation matrix.
    print(f"  Reading methylation matrix: {matrix_path}")
    probe_data = read_methylation_matrix(matrix_path)
    print(f"  Loaded {len(probe_data):,} probes")

    # Determine which cell types have data.
    available_cell_types = []
    for ct in CELL_TYPES:
        has_data = any(entry.get(ct) is not None for entry in probe_data.values())
        if has_data:
            available_cell_types.append(ct)
    print(f"  Cell types with data: {available_cell_types}")

    if not available_cell_types:
        print("  WARNING: No cell type data found in matrix.")
        return {}

    # 3. Process each cell type.
    atlas_ids: dict[str, str] = {}

    with tempfile.TemporaryDirectory(prefix="meth_atlas_") as tmpdir:
        parquet_dir = Path(tmpdir) / "parquet"
        summary_dir = Path(tmpdir) / "summary"

        for ct in available_cell_types:
            print(f"\n  --- {ct} ---")

            # 3a. Generate per-cell-type Parquet.
            parquet_path = create_cell_type_parquet(probe_data, ct, parquet_dir)
            print(f"    Parquet: {parquet_path}")

            # 3b. Generate summary bins.
            summary_path = write_summary_parquet(probe_data, ct, summary_dir)
            print(f"    Summary: {summary_path}")

            # 3c. Compute hashes.
            parquet_hash = compute_file_hash(parquet_path)
            summary_hash = compute_file_hash(summary_path)

            # 3d. Upload to S3.
            parquet_key = f"{S3_PREFIX}/{build}/{ct}.parquet"
            summary_key = f"{S3_PREFIX}/{build}/{ct}_summary_10kb.parquet"

            print(f"    Uploading {ct}.parquet ...")
            parquet_meta = await upload_to_s3(parquet_path, bucket, parquet_key)
            print(f"    Uploading {ct}_summary_10kb.parquet ...")
            summary_meta = await upload_to_s3(summary_path, bucket, summary_key)

            # 3e. Register storage objects.
            parquet_obj_id = await register_storage_object(
                conn,
                str(layer_id),
                bucket,
                parquet_key,
                parquet_hash,
                parquet_meta["size_bytes"],
                "parquet",
                f"Methylation reference betas for {ct} ({build})",
            )
            summary_obj_id = await register_storage_object(
                conn,
                str(layer_id),
                bucket,
                summary_key,
                summary_hash,
                summary_meta["size_bytes"],
                "parquet",
                f"10kb summary bins for {ct} ({build})",
            )

            # Count probes with valid beta for this cell type.
            n_probes = sum(
                1 for entry in probe_data.values() if entry.get(ct) is not None
            )
            mean_beta = (
                sum(
                    entry[ct]
                    for entry in probe_data.values()
                    if entry.get(ct) is not None
                )
                / n_probes
                if n_probes > 0
                else None
            )

            # 3f. Register atlas layer.
            # TODO: BigWig generation requires specialized libraries (pyBigWig).
            # Set bigwig_ref to NULL for V1.
            atlas_id = await register_atlas_layer(
                conn,
                str(layer_id),
                ct,
                build,
                bigwig_ref=None,
                parquet_ref=str(parquet_obj_id),
                summary_ref=str(summary_obj_id),
                n_samples=None,
                mean_coverage=None,
                metadata={
                    "source": "Reinius2012/Salas2018",
                    "n_probes": n_probes,
                    "mean_beta": round(mean_beta, 4) if mean_beta is not None else None,
                    "bin_size_bp": DEFAULT_BIN_SIZE,
                    "bigwig_status": "TODO: requires pyBigWig",
                },
            )
            atlas_ids[ct] = str(atlas_id)

    print(f"\n  Completed {len(atlas_ids)} cell types for {build}")
    return atlas_ids


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(
    builds: list[str] | None = None,
    csv_path: str | Path | None = None,
    mode: str = "reference",
) -> None:
    """Connect as admin and run methylation ingestion.

    Parameters
    ----------
    builds
        List of builds to ingest. Defaults to ``["hg38"]``.
    csv_path
        Path to the methylation matrix CSV. If None, looks for
        ``data/methylation_reference_{build}.csv``.
    mode
        ``"reference"`` populates ``ref.methylation_reference`` (Postgres inline).
        ``"atlas"`` populates ``methylation.atlas_layers`` (S3/Parquet).
        ``"both"`` runs both pipelines.
    """
    import asyncpg

    if builds is None:
        builds = ["hg38"]

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
            if build not in VALID_BUILDS:
                print(f"  ERROR: Unknown build {build!r}")
                continue

            print(f"\n{'=' * 60}")
            print(f"Ingesting methylation ({mode}) -- {build}")
            print(f"{'=' * 60}")

            if csv_path is not None:
                matrix_path = Path(csv_path)
            else:
                matrix_path = DATA_DIR / f"methylation_reference_{build}.csv"

            if not matrix_path.exists():
                print(f"  ERROR: Matrix file not found: {matrix_path}")
                print("  Provide --csv or place file in data/ directory.")
                continue

            if mode in ("reference", "both"):
                print("\n--- Postgres reference table ---")
                n = await ingest_reference(conn, build, matrix_path)
                print(f"  Loaded {n:,} rows into ref.methylation_reference")

            if mode in ("atlas", "both"):
                print("\n--- S3/Parquet atlas ---")
                atlas_ids = await ingest_build(conn, build, matrix_path)
                print(f"  Summary: {len(atlas_ids)} cell types registered")
                for ct, aid in atlas_ids.items():
                    print(f"    {ct}: {aid}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest methylation reference data",
    )
    parser.add_argument(
        "--build",
        choices=sorted(VALID_BUILDS),
        default=None,
        help="Genome build to ingest (default: hg38 only)",
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help="Path to the methylation reference matrix CSV",
    )
    parser.add_argument(
        "--mode",
        choices=["reference", "atlas", "both"],
        default="reference",
        help="Ingest mode: reference (Postgres), atlas (S3/Parquet), or both (default: reference)",
    )
    args = parser.parse_args()

    builds = [args.build] if args.build else None
    asyncio.run(main(builds=builds, csv_path=args.csv, mode=args.mode))


if __name__ == "__main__":
    cli()
