"""Gene pathway membership endpoint."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.constants import VALID_BUILDS
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["pathways"])


@router.get("/{build}/{symbol}/pathways")
async def get_gene_pathways(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve pathway layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'pathway' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No pathway layer for build {build}"}},
            )

        db_start = time.monotonic()
        rows = await conn.fetch(
            """
            SELECT pathway_id, pathway_name, pathway_hierarchy, evidence_code, source
            FROM annotation.gene_pathways
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            ORDER BY pathway_hierarchy, pathway_name
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
                    SELECT pathway_id, pathway_name, pathway_hierarchy, evidence_code, source
                    FROM annotation.gene_pathways
                    WHERE build = $1::genome_build
                      AND UPPER(gene_symbol) = UPPER($2)
                      AND layer_id = $3
                    ORDER BY pathway_hierarchy, pathway_name
                    """,
                    build, canonical, layer["id"],
                )
        if not rows:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in pathway layer for {build}"}},
            )

    data = {
        "gene_symbol": symbol.upper(),
        "n_pathways": len(rows),
        "pathways": [
            {
                "pathway_id": row["pathway_id"],
                "pathway_name": row["pathway_name"],
                "pathway_hierarchy": row["pathway_hierarchy"],
                "evidence_code": row["evidence_code"],
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
