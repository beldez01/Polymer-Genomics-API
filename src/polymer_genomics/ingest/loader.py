"""Batch loader for bulk-inserting genomic data via the PostgreSQL COPY protocol.

Uses asyncpg's ``copy_records_to_table`` for high-throughput ingestion and
provides content-hashing for data integrity verification in the registry.
"""

from __future__ import annotations

import hashlib

import asyncpg

from polymer_genomics.ingest.partitions import _validate_schema, _validate_table


async def batch_load(
    conn: asyncpg.Connection,
    schema: str,
    table: str,
    build: str,
    chr_id: int,
    layer_id: str,
    rows: list[tuple],
    columns: list[str],
) -> int:
    """Load rows into a partitioned table using the COPY protocol.

    Inserts directly into the parent table and lets PostgreSQL route rows
    to the correct partition based on build and chr_id values.

    Parameters
    ----------
    conn
        An asyncpg connection with INSERT privilege (e.g. ``ingest_writer``).
    schema
        Database schema (must be in ALLOWED_SCHEMAS).
    table
        Base table name (must be in ALLOWED_TABLES).
    build
        Genome build (``hg37`` or ``hg38``).
    chr_id
        Chromosome ID (1-25).
    layer_id
        UUID string for the registry layer.
    rows
        List of tuples, each matching the ``columns`` specification.
    columns
        List of column names for the COPY operation.

    Returns
    -------
    int
        Number of rows loaded.
    """
    schema = _validate_schema(schema)
    table = _validate_table(table)

    if not rows:
        return 0

    # Use copy_records_to_table on the parent table — PostgreSQL routes
    # to the correct partition via the build and chr_id values in each row.
    await conn.copy_records_to_table(
        table,
        records=rows,
        columns=columns,
        schema_name=schema,
    )

    return len(rows)


async def compute_content_hash(
    conn: asyncpg.Connection,
    schema: str,
    table: str,
    layer_id: str,
) -> str:
    """Compute a SHA-256 content hash for all rows belonging to a layer.

    Rows are read in canonical order (by ``id``) and hashed deterministically.

    Parameters
    ----------
    conn
        An asyncpg connection with SELECT privilege.
    schema
        Database schema.
    table
        Base table name.
    layer_id
        UUID string for the registry layer.

    Returns
    -------
    str
        Content hash in the format ``sha256:<hex_digest>``.
    """
    schema = _validate_schema(schema)
    table = _validate_table(table)

    rows = await conn.fetch(
        f"SELECT * FROM {schema}.{table} WHERE layer_id = $1 ORDER BY id",
        layer_id,
    )

    hasher = hashlib.sha256()
    for row in rows:
        hasher.update(str(dict(row)).encode())
    return f"sha256:{hasher.hexdigest()}"


async def update_layer_stats(
    conn: asyncpg.Connection,
    layer_id: str,
    row_count: int,
    content_hash: str,
) -> None:
    """Update the registry.layers row with ingestion statistics.

    Parameters
    ----------
    conn
        An asyncpg connection with UPDATE privilege on registry.layers.
    layer_id
        UUID string for the registry layer to update.
    row_count
        Total number of rows ingested.
    content_hash
        Content hash string (from ``compute_content_hash``).
    """
    await conn.execute(
        """
        UPDATE registry.layers
        SET row_count = $1,
            content_hash = $2,
            updated_at = now()
        WHERE id = $3
        """,
        row_count,
        content_hash,
        layer_id,
    )
