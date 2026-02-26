"""Bulk download endpoint — presigned URL for layer data files."""

from fastapi import APIRouter, HTTPException

from polymer_genomics.db import get_pool
from polymer_genomics.s3 import generate_presigned_url

router = APIRouter(prefix="/v1/bulk", tags=["bulk"])

EXPIRY_SECONDS = 3600


@router.get("/{layer_key}")
async def bulk_download(layer_key: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Look up active layer by key
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version FROM registry.active_layers WHERE layer_key = $1",
            layer_key,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "LAYER_NOT_FOUND", "message": f"Layer '{layer_key}' not found"}},
            )

        # Look up storage object for this layer
        obj = await conn.fetchrow(
            """SELECT bucket, key, content_hash, size_bytes, file_type
               FROM storage.objects WHERE layer_id = $1""",
            layer["id"],
        )
        if not obj:
            raise HTTPException(
                404,
                {
                    "error": {
                        "code": "NO_BULK_DATA",
                        "message": f"No bulk download available for layer '{layer_key}'",
                    }
                },
            )

    url = generate_presigned_url(
        bucket=obj["bucket"],
        key=obj["key"],
        expiry_seconds=EXPIRY_SECONDS,
    )

    return {
        "layer_key": layer["layer_key"],
        "version": layer["version"],
        "content_hash": obj["content_hash"],
        "size_bytes": obj["size_bytes"],
        "file_type": obj["file_type"],
        "download_url": url,
        "expires_in_seconds": EXPIRY_SECONDS,
    }
