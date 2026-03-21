"""Gene set membership endpoint."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.constants import VALID_BUILDS
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["gene_sets"])


@router.get("/{build}/{symbol}/gene-sets")
async def get_gene_sets(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve gene_set layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'gene_set' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No gene_set layer for build {build}"}},
            )

        db_start = time.monotonic()
        rows = await conn.fetch(
            """
            SELECT collection, gene_set_name, gene_set_description, source
            FROM annotation.gene_sets
            WHERE build = $1::genome_build
              AND gene_symbol = UPPER($2)
              AND layer_id = $3
            ORDER BY collection, gene_set_name
            """,
            build,
            symbol,
            layer["id"],
        )
        db_time = (time.monotonic() - db_start) * 1000

    resolved_alias = None
    if not rows:
        async with pool.acquire() as alias_conn:
            canonical = await resolve_alias(alias_conn, symbol)
        if canonical:
            resolved_alias = symbol
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT collection, gene_set_name, gene_set_description, source
                    FROM annotation.gene_sets
                    WHERE build = $1::genome_build
                      AND gene_symbol = UPPER($2)
                      AND layer_id = $3
                    ORDER BY collection, gene_set_name
                    """,
                    build, canonical, layer["id"],
                )
        if not rows:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in gene_set layer for {build}"}},
            )

    data = {
        "gene_symbol": symbol.upper(),
        "n_gene_sets": len(rows),
        "gene_sets": [
            {
                "collection": row["collection"],
                "gene_set_name": row["gene_set_name"],
                "description": row["gene_set_description"],
                "source": row["source"],
            }
            for row in rows
        ],
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol, **({"resolved_alias": resolved_alias} if resolved_alias else {})},
        layers_resolved=[
            {
                "layer_key": layer["layer_key"],
                "version": layer["version"],
                "layer_id": str(layer["id"]),
                "content_hash": layer["content_hash"],
                "status": "ok",
            }
        ],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
