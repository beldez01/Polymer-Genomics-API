from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.db import get_pool

router = APIRouter(prefix="/v1/layers", tags=["layers"])


@router.get("")
async def list_layers(
    type: str | None = Query(None),
    build: str | None = Query(None),
    active: bool = Query(True),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = "SELECT * FROM registry.layers WHERE 1=1"
        params: list = []
        idx = 1
        if active:
            query += f" AND is_active = ${idx}"
            params.append(True)
            idx += 1
        if type:
            query += f" AND layer_type = ${idx}::layer_type"
            params.append(type)
            idx += 1
        if build:
            query += f" AND genome_build = ${idx}::genome_build"
            params.append(build)
            idx += 1
        query += " ORDER BY layer_key, version"
        rows = await conn.fetch(query, *params)

    return {
        "layers": [
            {
                "layer_key": r["layer_key"],
                "version": r["version"],
                "name": r["name"],
                "type": r["layer_type"],
                "build": r["genome_build"],
                "license_class": r["license_class"],
                "row_count": r["row_count"],
                "is_default": r["is_default"],
            }
            for r in rows
        ]
    }


@router.get("/{layer_key}")
async def get_layer(layer_key: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT * FROM registry.layers
               WHERE layer_key = $1 AND is_active = true AND is_default = true""",
            layer_key,
        )
    if not row:
        raise HTTPException(status_code=404, detail=f"Layer '{layer_key}' not found")
    return {
        "layer_key": row["layer_key"],
        "version": row["version"],
        "name": row["name"],
        "type": row["layer_type"],
        "build": row["genome_build"],
        "source": row["source"],
        "license_class": row["license_class"],
        "row_count": row["row_count"],
        "content_hash": row["content_hash"],
        "is_default": row["is_default"],
        "metadata": row["metadata"],
    }
