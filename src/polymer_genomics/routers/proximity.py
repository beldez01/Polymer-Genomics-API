import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.queries import TRACK_REGISTRY

router = APIRouter(prefix="/v1/query", tags=["proximity"])


@router.get("")
async def query_proximity(
    build: str,
    gene: str,
    radius: int = Query(..., ge=0),
    layers: str | None = Query(None),
    coords: str = Query("1based"),
    limit: int | None = Query(None, ge=1),
):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve gene_model layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'gene_model' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No gene_model layer for build {build}"}},
            )

        # Get gene bounds (aggregate across all features)
        gene_bounds = await conn.fetchrow(
            """
            SELECT chr_id, MIN(start_pos) AS gene_start, MAX(end_pos) AS gene_end
            FROM gene.features
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            GROUP BY chr_id
            """,
            build,
            gene,
            layer["id"],
        )

        if not gene_bounds:
            canonical = await resolve_alias(conn, gene)
            if canonical:
                gene_bounds = await conn.fetchrow(
                    """
                    SELECT chr_id, MIN(start_pos) AS gene_start, MAX(end_pos) AS gene_end
                    FROM gene.features
                    WHERE build = $1::genome_build
                      AND UPPER(gene_symbol) = UPPER($2)
                      AND layer_id = $3
                    GROUP BY chr_id
                    """,
                    build, canonical, layer["id"],
                )
            if not gene_bounds:
                raise HTTPException(
                    404,
                    {"error": {"code": "NOT_FOUND", "message": f"Gene '{gene}' not found in {build}"}},
                )

        chr_id = gene_bounds["chr_id"]
        chr_name = CHR_ID_TO_NAME.get(chr_id, f"chr{chr_id}")
        gene_start = gene_bounds["gene_start"]
        gene_end = gene_bounds["gene_end"]

        # Expand by radius (0-based half-open internally)
        query_start = max(0, gene_start - radius)
        query_end = gene_end + radius

        region_length = query_end - query_start
        if region_length > settings.max_region_length:
            raise HTTPException(
                400,
                {
                    "error": {
                        "code": "REGION_TOO_LARGE",
                        "message": f"Expanded region exceeds maximum of {settings.max_region_length}bp.",
                        "limit": settings.max_region_length,
                        "requested": region_length,
                    }
                },
            )

        page_limit = min(limit or settings.default_page_size, settings.max_returned_rows)

        # Resolve requested layers
        if layers:
            layer_keys = [l.strip() for l in layers.split(",")]
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
        db_start = time.monotonic()

        for lr in layer_rows:
            track = TRACK_REGISTRY.get(lr["layer_type"])
            if not track:
                continue

            rows = await conn.fetch(
                track["query_fn"](),
                build,
                chr_id,
                query_start,
                query_end,
                lr["id"],
                page_limit,
            )

            converted = track["convert_fn"](rows, chr_name)
            data[lr["layer_key"]] = converted
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

    # Convert gene bounds to API coordinates for the response
    gene_api = db_to_api(gene_start, gene_end)
    region_api = db_to_api(query_start, query_end)

    total_rows = sum(d.get("n", 0) for d in data.values())
    status = "truncated" if total_rows >= page_limit else "complete"

    return build_envelope(
        status=status,
        query={
            "build": build,
            "gene_symbol": gene,
            "gene_bounds": {
                "chr": chr_name,
                "start": gene_api["start"],
                "end": gene_api["end"],
                "width": gene_api["width"],
            },
            "radius": radius,
            "region": {
                "chr": chr_name,
                "start": region_api["start"],
                "end": region_api["end"],
            },
            "layers_requested": layer_keys or ["all_active"],
            "coords_input": coords,
        },
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
