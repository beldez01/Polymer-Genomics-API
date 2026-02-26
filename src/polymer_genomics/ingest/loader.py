"""Batch loader for bulk-inserting genomic data via the PostgreSQL COPY protocol.

Uses asyncpg's ``copy_records_to_table`` for high-throughput ingestion and
provides content-hashing for data integrity verification in the registry.
"""

from __future__ import annotations

import hashlib
import struct
import uuid as uuid_mod
from datetime import datetime

import asyncpg

from polymer_genomics.ingest.partitions import _validate_schema, _validate_table


def _encode_value(val: object) -> bytes:
    """Encode a database value to a deterministic byte sequence for hashing."""
    if val is None:
        return b"\x00"
    if isinstance(val, bool):
        return b"\x01" if val else b"\x02"
    if isinstance(val, int):
        return b"\x03" + struct.pack(">q", val)
    if isinstance(val, float):
        return b"\x04" + struct.pack(">d", val)
    if isinstance(val, str):
        encoded = val.encode("utf-8")
        return b"\x05" + struct.pack(">I", len(encoded)) + encoded
    if isinstance(val, uuid_mod.UUID):
        return b"\x06" + val.bytes
    if isinstance(val, datetime):
        return b"\x07" + val.isoformat().encode("utf-8")
    if isinstance(val, bytes):
        return b"\x08" + struct.pack(">I", len(val)) + val
    # Fallback: use repr (less ideal but safe)
    encoded = repr(val).encode("utf-8")
    return b"\x09" + struct.pack(">I", len(encoded)) + encoded


async def batch_load(
    conn: asyncpg.Connection,
    schema: str,
    table: str,
    rows: list[tuple],
    columns: list[str],
) -> int:
    """Load rows into a partitioned table using the COPY protocol.

    Inserts directly into the parent table and lets PostgreSQL route rows
    to the correct partition based on build and chr_id values in each row.

    Parameters
    ----------
    conn
        An asyncpg connection with INSERT privilege (e.g. ``ingest_writer``).
    schema
        Database schema (must be in ALLOWED_SCHEMAS).
    table
        Base table name (must be in ALLOWED_TABLES).
    rows
        List of tuples, each matching the ``columns`` specification.
        Must include build and chr_id values for partition routing.
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
        for val in row.values():
            hasher.update(_encode_value(val))
        hasher.update(b"\xff")  # row separator
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
