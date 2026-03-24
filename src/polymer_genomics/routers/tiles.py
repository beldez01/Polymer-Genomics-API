"""Tile endpoint: deterministic tiling over genomic regions (Contract 4)."""

import time

from fastapi import APIRouter, HTTPException, Query
from starlette.responses import JSONResponse

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.queries import TRACK_REGISTRY

# ---------------------------------------------------------------------------
# Pure tile math
# ---------------------------------------------------------------------------

VALID_RESOLUTIONS = {1000, 10000, 100000, 1000000}


def tile_to_region(chr_name: str, tile_index: int, resolution: int) -> dict:
    """Convert tile coordinates to a region (0-based half-open)."""
    start = tile_index * resolution
    end = start + resolution
    return {"chr": chr_name, "start": start, "end": end}


def region_to_tiles(start: int, end: int, resolution: int) -> list[int]:
    """Convert a region [start, end) to a list of tile indices."""
    first = start // resolution
    last = (end - 1) // resolution
    return list(range(first, last + 1))


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/v1/tiles", tags=["tiles"])


@router.get("/{build}/{chr_name}/tile/{resolution}/{tile_index}")
async def get_tile(
    build: str,
    chr_name: str,
    resolution: int,
    tile_index: int,
    layers: str | None = Query(None),
):
    start_time = time.monotonic()

    # --- Validate build ---
    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    # --- Validate resolution ---
    if resolution not in VALID_RESOLUTIONS:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "INVALID_RESOLUTION",
                    "message": (
                        f"Invalid resolution: {resolution}. "
                        f"Must be one of {sorted(VALID_RESOLUTIONS)}."
                    ),
                }
            },
        )

    # --- Validate chromosome ---
    chr_id = CHR_NAME_TO_ID.get(chr_name)
    if chr_id is None:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown chromosome: {chr_name}"}},
        )

    # --- Compute tile region (0-based half-open, used directly for DB queries) ---
    tile_region = tile_to_region(chr_name, tile_index, resolution)
    tile_start = tile_region["start"]
    tile_end = tile_region["end"]

    page_limit = settings.max_returned_rows

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve requested layers
        if layers:
            layer_keys = [lk.strip() for lk in layers.split(",")]
        else:
            layer_keys = None

        if layer_keys:
            layer_rows = await conn.fetch(
                """SELECT id, layer_key, version, layer_type, content_hash
                   FROM registry.active_layers WHERE layer_key = ANY($1)""",
                layer_keys,
            )
        else:
            layer_rows = await conn.fetch(
                "SELECT id, layer_key, version, layer_type, content_hash FROM registry.active_layers"
            )

        layers_resolved = []
        data = {}
        has_content_hash = False
        db_start = time.monotonic()

        for lr in layer_rows:
            track = TRACK_REGISTRY.get(lr["layer_type"])
            if not track:
                continue

            rows = await conn.fetch(
                track["query_fn"](),
                build,
                chr_id,
                tile_start,
                tile_end,
                lr["id"],
                page_limit,
            )

            converted = track["convert_fn"](rows, chr_name)
            data[lr["layer_key"]] = converted

            if lr["content_hash"]:
                has_content_hash = True

            layers_resolved.append(
                {
                    "layer_key": lr["layer_key"],
                    "version": lr["version"],
                    "layer_id": str(lr["id"]),
                    "content_hash": lr["content_hash"],
                    "status": "ok",
                }
            )

        db_time = (time.monotonic() - db_start) * 1000

    envelope = build_envelope(
        status="complete",
        query={
            "build": build,
            "region": {"chr": chr_name, "start": tile_start + 1, "end": tile_end},
            "layers_requested": layer_keys or ["all_active"],
        },
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )

    # Add tile metadata at top level
    envelope["tile"] = {
        "chr": chr_name,
        "index": tile_index,
        "resolution": resolution,
        "start": tile_start + 1,
        "end": tile_end,
    }

    # Build response with Cache-Control for versioned layers
    headers = {}
    if has_content_hash:
        headers["Cache-Control"] = "public, max-age=86400, immutable"

    return JSONResponse(content=envelope, headers=headers)
