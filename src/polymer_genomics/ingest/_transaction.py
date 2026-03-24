"""Transaction wrapper and safety checks for ingestion modules.

Provides:
- ingest_transaction: wraps INSERT flows in a single DB transaction
- check_base_rows: pre-flight for UPDATE modules (ensures base data exists)
- assert_rows_updated: post-UPDATE validation (raises on 0-row updates)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import asyncpg

logger = logging.getLogger(__name__)


@asynccontextmanager
async def ingest_transaction(conn: asyncpg.Connection):
    """Wrap an ingestion flow in a database transaction.

    Usage:
        async with ingest_transaction(conn):
            await conn.copy_records_to_table(...)
            # If anything raises here, the entire transaction is rolled back.
            # On clean exit, changes are committed.

    This prevents partial data from being committed when a script crashes
    mid-ingestion. Without this wrapper, a crash after loading 15 of 25
    chromosomes leaves the DB with partial data AND the idempotency check
    blocks re-run (rows already exist).
    """
    async with conn.transaction():
        logger.info("Transaction started")
        yield
        logger.info("Transaction committing")
    logger.info("Transaction committed")


async def check_base_rows(
    conn: asyncpg.Connection,
    build: str,
    *,
    table: str = "biophysics.sequence_properties",
    min_rows: int = 2_000_000,
) -> int:
    """Verify that base rows exist before running UPDATE modules.

    UPDATE-via-staging modules (dnashape, methylation_perturbation, etc.)
    join on (build, chr_id, start_pos). If the base table hasn't been
    populated by biophysics_tracks.py, the UPDATE silently matches 0 rows.

    Args:
        conn: Database connection.
        build: Genome build (hg38 or hg37).
        table: Fully qualified table name to check.
        min_rows: Minimum expected row count.

    Returns:
        Actual row count.

    Raises:
        RuntimeError: If row count is below min_rows.
    """
    count = await conn.fetchval(
        f"SELECT count(*) FROM {table} WHERE build = $1::genome_build",
        build,
    )
    if count < min_rows:
        raise RuntimeError(
            f"Only {count:,} rows in {table} for build {build} "
            f"(need {min_rows:,}+). Run biophysics_tracks.py first."
        )
    logger.info("Base row check passed: %s has %s rows for %s", table, f"{count:,}", build)
    return count


def assert_rows_updated(
    result: str | None,
    *,
    min_expected: int = 1,
    context: str = "",
) -> int:
    """Parse and validate an UPDATE result string.

    asyncpg returns UPDATE results as strings like "UPDATE 2937992".
    This function extracts the count and raises if it's below expectations.

    Args:
        result: The raw result string from conn.execute("UPDATE ...").
        min_expected: Minimum number of rows that should have been updated.
        context: Optional context string for error messages (e.g., "dnashape mgw_mean").

    Returns:
        Number of rows updated.

    Raises:
        RuntimeError: If fewer than min_expected rows were updated.
    """
    if not result:
        updated = 0
    else:
        try:
            updated = int(result.split()[-1])
        except (ValueError, IndexError):
            updated = 0

    ctx = f" ({context})" if context else ""
    if updated < min_expected:
        raise RuntimeError(
            f"UPDATE matched only {updated:,} rows{ctx} "
            f"(expected >= {min_expected:,}). "
            f"Base table may not be populated for this build."
        )

    logger.info("Updated %s rows%s", f"{updated:,}", ctx)
    return updated
