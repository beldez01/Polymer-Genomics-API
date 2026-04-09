#!/usr/bin/env python3
"""Export each active layer to CSV, upload to MinIO, and register in storage.objects.

Usage:
    python scripts/seed_bulk_objects.py

Requires: asyncpg, boto3 (already in project dependencies).
Connects to local PostgreSQL (port 5432) and MinIO (port 9000).
"""

import asyncio
import csv
import hashlib
import os
import tempfile

import asyncpg
import boto3
from botocore.config import Config

# ── Config ────────────────────────────────────────────────────
PG_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://admin:dev_password@localhost:5432/polymer_genomics",
)
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "http://localhost:9000")
S3_BUCKET = os.environ.get("S3_BUCKET", "polymer-genomics-api")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "minioadmin")

# ── Layer-to-query mapping ────────────────────────────────────
# Each layer_key maps to a SQL query that exports human-readable columns.
# We join chr_id → chr_name so the CSV is self-contained.
LAYER_QUERIES = {
    "cpg_islands": """
        SELECT c.chr_name AS seqname, i.start_pos, i.end_pos,
               i.island_name
        FROM cpg.islands i
        JOIN ref.chromosomes c ON c.chr_id = i.chr_id
        WHERE i.layer_id = $1
        ORDER BY c.chr_id, i.start_pos
    """,
    "cpg_sites": """
        SELECT c.chr_name AS seqname, s.pos,
               s.context, s.gc_content
        FROM cpg.sites s
        JOIN ref.chromosomes c ON c.chr_id = s.chr_id
        WHERE s.layer_id = $1
        ORDER BY c.chr_id, s.pos
    """,
    "gencode_v44": """
        SELECT c.chr_name AS seqname, f.start_pos, f.end_pos,
               f.strand, f.gene_symbol, f.gene_id,
               f.transcript_id, f.feature_type
        FROM gene.features f
        JOIN ref.chromosomes c ON c.chr_id = f.chr_id
        WHERE f.layer_id = $1
        ORDER BY c.chr_id, f.start_pos
    """,
    "isochores": """
        SELECT c.chr_name AS seqname, i.start_pos, i.end_pos,
               i.gc_content, i.isochore_class
        FROM ref.isochores i
        JOIN ref.chromosomes c ON c.chr_id = i.chr_id
        WHERE i.layer_id = $1
        ORDER BY c.chr_id, i.start_pos
    """,
    "probe_450k": """
        SELECT c.chr_name AS seqname, p.pos,
               p.probe_id, p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        JOIN ref.chromosomes c ON c.chr_id = p.chr_id
        WHERE p.layer_id = $1
        ORDER BY c.chr_id, p.pos
    """,
    "probe_epic_v1": """
        SELECT c.chr_name AS seqname, p.pos,
               p.probe_id, p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        JOIN ref.chromosomes c ON c.chr_id = p.chr_id
        WHERE p.layer_id = $1
        ORDER BY c.chr_id, p.pos
    """,
    "probe_epic_v2": """
        SELECT c.chr_name AS seqname, p.pos,
               p.probe_id, p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        JOIN ref.chromosomes c ON c.chr_id = p.chr_id
        WHERE p.layer_id = $1
        ORDER BY c.chr_id, p.pos
    """,
}


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name="us-east-1",
        config=Config(signature_version="s3v4"),
    )


async def export_layer(conn, layer, s3):
    """Export one layer: query → CSV → MinIO → storage.objects."""
    layer_key = layer["layer_key"]
    layer_id = layer["id"]

    query = LAYER_QUERIES.get(layer_key)
    if not query:
        print(f"  SKIP {layer_key} — no export query defined")
        return

    print(f"  Exporting {layer_key} (id={layer_id}) ...")

    # Stream rows from DB
    rows = await conn.fetch(query, layer_id)
    if not rows:
        print(f"  SKIP {layer_key} — 0 rows")
        return

    columns = list(rows[0].keys())

    # Write CSV to temp file (some layers are large)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, newline=""
    ) as tmp:
        writer = csv.writer(tmp)
        writer.writerow(columns)
        for row in rows:
            writer.writerow([row[c] for c in columns])
        tmp_path = tmp.name

    # Compute file hash and size
    sha = hashlib.sha256()
    with open(tmp_path, "rb") as f:
        while chunk := f.read(8192):
            sha.update(chunk)
    content_hash = f"sha256:{sha.hexdigest()}"
    size_bytes = os.path.getsize(tmp_path)

    # Upload to MinIO
    object_key = f"bulk/{layer_key}.csv"
    s3.upload_file(tmp_path, S3_BUCKET, object_key)
    os.unlink(tmp_path)

    # Register in storage.objects (upsert on unique constraint)
    await conn.execute(
        """
        INSERT INTO storage.objects (layer_id, provider, bucket, key, content_hash, size_bytes, file_type)
        VALUES ($1, 'aws_s3', $2, $3, $4, $5, 'csv')
        ON CONFLICT (provider, bucket, key)
        DO UPDATE SET layer_id = $1, content_hash = $4, size_bytes = $5, created_at = now()
        """,
        layer_id,
        S3_BUCKET,
        object_key,
        content_hash,
        size_bytes,
    )

    row_count = len(rows)
    size_mb = size_bytes / (1024 * 1024)
    print(f"  OK {layer_key}: {row_count:,} rows, {size_mb:.1f} MB → s3://{S3_BUCKET}/{object_key}")


async def main():
    print("Connecting to PostgreSQL ...")
    conn = await asyncpg.connect(PG_DSN)

    print("Fetching active layers ...")
    layers = await conn.fetch(
        "SELECT id, layer_key, version, row_count FROM registry.active_layers ORDER BY layer_key"
    )
    print(f"  Found {len(layers)} active layers\n")

    s3 = get_s3_client()

    # Ensure bucket exists
    try:
        s3.head_bucket(Bucket=S3_BUCKET)
    except Exception:
        s3.create_bucket(Bucket=S3_BUCKET)
        print(f"  Created bucket {S3_BUCKET}\n")

    for layer in layers:
        await export_layer(conn, layer, s3)

    await conn.close()
    print("\nDone. All bulk objects registered.")


if __name__ == "__main__":
    asyncio.run(main())
