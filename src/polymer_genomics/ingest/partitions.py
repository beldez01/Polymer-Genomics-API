"""Partition verification and creation utilities for the Polymer Genomics database.

The init.sql schema pre-creates all partitions for the core tables (gene.features,
cpg.sites). This module verifies that expected partitions exist and optionally
creates missing ones for tables added after initial provisioning.
"""

from __future__ import annotations

import re

import asyncpg

# Whitelist of schemas and tables allowed in dynamic SQL to prevent injection.
ALLOWED_SCHEMAS = frozenset({"cpg", "gene", "probe", "methylation", "ref", "registry", "storage"})
ALLOWED_TABLES = frozenset({
    "features",
    "sites",
    "islands",
    "coordinates",
    "map_edges",
    "atlas_layers",
    "isochores",
    "layers",
    "objects",
})
ALLOWED_BUILDS = frozenset({"hg37", "hg38"})

_IDENTIFIER_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _validate_identifier(name: str, kind: str) -> str:
    """Validate and return a safe SQL identifier."""
    if not _IDENTIFIER_RE.match(name):
        msg = f"Invalid {kind}: {name!r}"
        raise ValueError(msg)
    return name


def _validate_schema(schema: str) -> str:
    _validate_identifier(schema, "schema")
    if schema not in ALLOWED_SCHEMAS:
        msg = f"Schema {schema!r} not in allowed list: {sorted(ALLOWED_SCHEMAS)}"
        raise ValueError(msg)
    return schema


def _validate_table(table: str) -> str:
    _validate_identifier(table, "table")
    if table not in ALLOWED_TABLES:
        msg = f"Table {table!r} not in allowed list: {sorted(ALLOWED_TABLES)}"
        raise ValueError(msg)
    return table


def _validate_build(build: str) -> str:
    if build not in ALLOWED_BUILDS:
        msg = f"Build {build!r} not in allowed list: {sorted(ALLOWED_BUILDS)}"
        raise ValueError(msg)
    return build


async def _partition_exists(conn: asyncpg.Connection, schema: str, partition_name: str) -> bool:
    """Check whether a table (partition) exists in the given schema."""
    exists = await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2
        )
        """,
        schema,
        partition_name,
    )
    return bool(exists)


async def ensure_partitions(
    conn: asyncpg.Connection,
    schema: str,
    table: str,
    build: str,
    chr_ids: list[int],
    *,
    create_if_missing: bool = False,
) -> dict[int, bool]:
    """Verify (and optionally create) sub-partitions for a partitioned table.

    Parameters
    ----------
    conn
        An asyncpg connection with sufficient privileges. For verification
        only, ``ingest_writer`` suffices. For creation, a connection with
        CREATE privilege on the schema is required (e.g. ``admin``).
    schema
        Database schema name (must be in ALLOWED_SCHEMAS).
    table
        Base table name (must be in ALLOWED_TABLES).
    build
        Genome build (``hg37`` or ``hg38``).
    chr_ids
        Chromosome IDs (1-25) to check/create partitions for.
    create_if_missing
        If ``True``, create missing sub-partitions and their GiST indexes.
        If ``False`` (default), raise ``RuntimeError`` when a partition is missing.

    Returns
    -------
    dict[int, bool]
        Mapping of chr_id to whether the partition already existed (True)
        or was newly created (False). All values are True when
        ``create_if_missing=False`` (since missing partitions raise).
    """
    schema = _validate_schema(schema)
    table = _validate_table(table)
    build = _validate_build(build)

    # Validate chr_ids
    for cid in chr_ids:
        if not isinstance(cid, int) or cid < 1 or cid > 25:
            msg = f"chr_id must be an integer 1-25, got {cid!r}"
            raise ValueError(msg)

    build_partition = f"{table}_{build}"
    result: dict[int, bool] = {}

    for cid in chr_ids:
        sub_partition = f"{table}_{build}_chr{cid}"
        exists = await _partition_exists(conn, schema, sub_partition)

        if exists:
            result[cid] = True
            continue

        if not create_if_missing:
            msg = (
                f"Partition {schema}.{sub_partition} does not exist. "
                f"Run init.sql or pass create_if_missing=True with an admin connection."
            )
            raise RuntimeError(msg)

        # Verify the build-level partition exists before creating sub-partitions.
        if not await _partition_exists(conn, schema, build_partition):
            msg = (
                f"Build partition {schema}.{build_partition} does not exist. "
                f"Cannot create sub-partitions without it."
            )
            raise RuntimeError(msg)

        # Create the sub-partition.
        await conn.execute(
            f"CREATE TABLE IF NOT EXISTS {schema}.{sub_partition} "
            f"PARTITION OF {schema}.{build_partition} FOR VALUES IN ({cid})"
        )

        # Create the GiST index.
        index_name = f"idx_{table}_{build}_chr{cid}_coord"
        await conn.execute(
            f"CREATE INDEX IF NOT EXISTS {index_name} "
            f"ON {schema}.{sub_partition} USING GiST (chr_id, coord)"
        )

        result[cid] = False

    return result
