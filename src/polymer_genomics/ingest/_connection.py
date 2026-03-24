"""Shared database connection helper for ingestion modules.

Centralizes credential management and adds production safety checks.
Replaces the 5-line inline connection pattern duplicated across 53 modules.
"""
from __future__ import annotations

import logging
import os

import asyncpg

logger = logging.getLogger(__name__)

# Default credentials (local development only)
_ADMIN_DEFAULTS = {
    "user": "admin",
    "password": "dev_password",
}
_WRITER_DEFAULTS = {
    "user": "ingest_writer",
    "password": "ingest_writer_dev",
}


async def get_ingest_connection(
    *,
    admin: bool = False,
    host: str | None = None,
    port: int | None = None,
    database: str | None = None,
    user: str | None = None,
    password: str | None = None,
    statement_timeout: int = 0,
) -> asyncpg.Connection:
    """Create a database connection for ingestion.

    Args:
        admin: If True, use admin credentials (for DDL + layer registration).
               If False, use ingest_writer credentials (for data loading only).
        host/port/database/user/password: Optional overrides (for CLI-arg modules).
        statement_timeout: Statement timeout in ms (0 = unlimited, default for bulk loads).

    Raises:
        RuntimeError: If POLYMER_ENV=production and fallback credentials are in use.
    """
    defaults = _ADMIN_DEFAULTS if admin else _WRITER_DEFAULTS

    resolved_host = host or os.environ.get("POSTGRES_HOST", "localhost")
    resolved_port = port or int(os.environ.get("POSTGRES_PORT", "5432"))
    resolved_db = database or os.environ.get("POSTGRES_DB", "polymer_genomics")

    if admin:
        resolved_user = user or os.environ.get("POSTGRES_ADMIN_USER", defaults["user"])
        resolved_password = password or os.environ.get("POSTGRES_PASSWORD", defaults["password"])
    else:
        resolved_user = user or os.environ.get("POSTGRES_USER", defaults["user"])
        resolved_password = password or os.environ.get("POSTGRES_USER_PASSWORD", defaults["password"])

    # Production safety: refuse fallback credentials
    using_fallback = resolved_password in (defaults["password"],)
    if os.environ.get("POLYMER_ENV") == "production" and using_fallback:
        raise RuntimeError(
            f"POLYMER_ENV=production but using fallback password for user '{resolved_user}'. "
            f"Set {'POSTGRES_PASSWORD' if admin else 'POSTGRES_USER_PASSWORD'} explicitly."
        )

    logger.info("Connecting to %s:%d/%s as %s", resolved_host, resolved_port, resolved_db, resolved_user)

    conn = await asyncpg.connect(
        host=resolved_host,
        port=resolved_port,
        database=resolved_db,
        user=resolved_user,
        password=resolved_password,
    )

    if statement_timeout:
        await conn.execute(f"SET statement_timeout = {statement_timeout}")

    return conn
