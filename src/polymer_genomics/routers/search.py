import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.db import get_pool

router = APIRouter(prefix="/v1/search", tags=["search"])

VALID_BUILDS = {"hg37", "hg38"}


@router.get("")
async def search(
    q: str = Query(..., min_length=1),
    build: str = Query(...),
):
    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    if len(q) < 2:
        raise HTTPException(
            400,
            {"error": {"code": "QUERY_TOO_SHORT", "message": "Search query must be at least 2 characters"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve gene_model layer
        layer = await conn.fetchrow(
            "SELECT id FROM registry.active_layers "
            "WHERE layer_type = 'gene_model' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            return {"results": [], "total": 0}

        rows = await conn.fetch(
            """
            SELECT gene_symbol, (gene_symbol = $4) AS exact_match
            FROM (
                SELECT DISTINCT gene_symbol
                FROM gene.features
                WHERE build = $1::genome_build
                  AND gene_symbol ILIKE $2
                  AND layer_id = $3
            ) sub
            ORDER BY exact_match DESC, gene_symbol
            LIMIT 20
            """,
            build,
            q + "%",
            layer["id"],
            q,
        )

    results = [{"gene_symbol": r["gene_symbol"], "type": "gene"} for r in rows]
    return {"results": results, "total": len(results)}
