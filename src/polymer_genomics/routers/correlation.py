"""Correlation endpoint: cross-layer statistical relationships."""

import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.correlation import (
    CORRELATION_REGISTRY,
    STAT_FUNCTIONS,
    VALID_STATS,
    build_correlation_sql,
    validate_stat_compatibility,
)
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.routers.tiles import VALID_RESOLUTIONS

router = APIRouter(prefix="/v1/correlate", tags=["correlation"])

MAX_BINS = 50_000


@router.get("/{build}/{region}")
async def correlate_layers(
    build: str,
    region: str,
    layer_a: str = Query(..., description="Layer key for first layer"),
    layer_b: str = Query(..., description="Layer key for second layer"),
    stat: str = Query(..., description="Statistic to compute"),
    resolution: int = Query(10000, description="Bin size in bp"),
    field_a: str = Query("density", description="Numeric field from layer_a"),
    field_b: str = Query("density", description="Numeric field from layer_b"),
    coords: str = Query("1based"),
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

    # --- Validate stat ---
    if stat not in VALID_STATS:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "INVALID_STAT",
                    "message": (
                        f"Invalid statistic: {stat}. "
                        f"Must be one of {sorted(VALID_STATS)}."
                    ),
                }
            },
        )

    # --- Parse region ---
    try:
        parsed = parse_region(region)
    except ValueError as e:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_REGION", "message": str(e)}},
        )

    chr_name = parsed["chr"]
    chr_id = CHR_NAME_TO_ID.get(chr_name)
    if chr_id is None:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown chromosome: {chr_name}"}},
        )

    internal = api_to_db(parsed["start"], parsed["end"], coords=coords)

    # --- Max bins safeguard ---
    region_length = internal["end"] - internal["start"]
    n_possible_bins = region_length // resolution
    if n_possible_bins > MAX_BINS:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "TOO_MANY_BINS",
                    "message": (
                        f"Region would produce up to {n_possible_bins} bins "
                        f"(limit {MAX_BINS}). Increase resolution or reduce region size."
                    ),
                    "limit": MAX_BINS,
                    "requested": n_possible_bins,
                }
            },
        )

    # --- Resolve layers from registry.active_layers ---
    pool = await get_pool()
    async with pool.acquire() as conn:
        layer_rows = await conn.fetch(
            """SELECT id, layer_key, version, layer_type, content_hash
               FROM registry.active_layers WHERE layer_key = ANY($1)""",
            [layer_a, layer_b],
        )

    layer_map = {lr["layer_key"]: lr for lr in layer_rows}

    if layer_a not in layer_map:
        raise HTTPException(
            400,
            {"error": {"code": "UNKNOWN_LAYER", "message": f"Layer not found: {layer_a}"}},
        )
    if layer_b not in layer_map:
        raise HTTPException(
            400,
            {"error": {"code": "UNKNOWN_LAYER", "message": f"Layer not found: {layer_b}"}},
        )

    lr_a = layer_map[layer_a]
    lr_b = layer_map[layer_b]

    # --- Resolve layer types in CORRELATION_REGISTRY ---
    reg_a = CORRELATION_REGISTRY.get(lr_a["layer_type"])
    reg_b = CORRELATION_REGISTRY.get(lr_b["layer_type"])

    if reg_a is None:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "UNSUPPORTED_LAYER_TYPE",
                    "message": f"Layer type '{lr_a['layer_type']}' not supported for correlation.",
                }
            },
        )
    if reg_b is None:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "UNSUPPORTED_LAYER_TYPE",
                    "message": f"Layer type '{lr_b['layer_type']}' not supported for correlation.",
                }
            },
        )

    # --- Validate fields ---
    if field_a not in reg_a["fields"]:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "INVALID_FIELD",
                    "message": (
                        f"Field '{field_a}' not available for layer type '{lr_a['layer_type']}'. "
                        f"Valid fields: {sorted(reg_a['fields'].keys())}."
                    ),
                }
            },
        )
    if field_b not in reg_b["fields"]:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "INVALID_FIELD",
                    "message": (
                        f"Field '{field_b}' not available for layer type '{lr_b['layer_type']}'. "
                        f"Valid fields: {sorted(reg_b['fields'].keys())}."
                    ),
                }
            },
        )

    # --- Validate same layer + same field ---
    if layer_a == layer_b and field_a == field_b:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "SELF_CORRELATION",
                    "message": "Cannot correlate a layer with itself on the same field.",
                }
            },
        )

    # --- Validate stat compatibility ---
    compat_error = validate_stat_compatibility(stat, reg_a["mode"], reg_b["mode"])
    if compat_error:
        raise HTTPException(
            400,
            {"error": {"code": "INCOMPATIBLE_STAT", "message": compat_error}},
        )

    # --- Build and execute SQL ---
    sql = build_correlation_sql(reg_a, field_a, reg_b, field_b)

    async with pool.acquire() as conn:
        db_start = time.monotonic()
        rows = await conn.fetch(
            sql,
            build,
            chr_id,
            internal["start"],
            internal["end"],
            lr_a["id"],
            lr_b["id"],
            resolution,
        )
        db_time = (time.monotonic() - db_start) * 1000

    # --- Extract paired vectors ---
    values_a = [float(r["value_a"]) for r in rows]
    values_b = [float(r["value_b"]) for r in rows]
    n_bins = len(rows)
    n_both_nonzero = sum(1 for a, b in zip(values_a, values_b) if a != 0 and b != 0)

    # --- Compute statistic ---
    if n_bins == 0:
        result = {"value": None, "p_value": None, "reason": "insufficient_data"}
    else:
        stat_fn = STAT_FUNCTIONS[stat]
        result = stat_fn(values_a, values_b)

    # --- Build response ---
    data = {
        "statistic": stat,
        "value": result.get("value"),
        "p_value": result.get("p_value"),
        "n_bins": n_bins,
        "n_bins_both_nonzero": n_both_nonzero,
    }
    if "confidence_interval_95" in result:
        data["confidence_interval_95"] = result["confidence_interval_95"]
    if "details" in result:
        data["details"] = result["details"]
    if "reason" in result:
        data["reason"] = result["reason"]

    layers_resolved = [
        {
            "layer_key": lr_a["layer_key"],
            "version": lr_a["version"],
            "layer_id": str(lr_a["id"]),
            "content_hash": lr_a["content_hash"],
            "status": "ok",
            "field": field_a,
        },
        {
            "layer_key": lr_b["layer_key"],
            "version": lr_b["version"],
            "layer_id": str(lr_b["id"]),
            "content_hash": lr_b["content_hash"],
            "status": "ok",
            "field": field_b,
        },
    ]

    return build_envelope(
        status="complete",
        query={
            "build": build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "layer_a": layer_a,
            "layer_b": layer_b,
            "stat": stat,
            "field_a": field_a,
            "field_b": field_b,
            "resolution": resolution,
        },
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
