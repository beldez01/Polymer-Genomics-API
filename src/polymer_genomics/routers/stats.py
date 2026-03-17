"""Statistical summary endpoint for genomic regions.

Returns summary statistics (mean, median, sd, min, max, percentiles) for
data layers within a region — without returning individual rows.
"""

import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.correlation import CORRELATION_REGISTRY
from polymer_genomics.db import get_pool

router = APIRouter(prefix="/v1/stats", tags=["stats"])


def _build_stats_sql(
    table: str, pos_col: str, mode: str, field_exprs: dict[str, str]
) -> tuple[str, list[str]]:
    """Build SQL for summary statistics.

    Returns (sql, field_names).
    For continuous mode: percentile_cont aggregates.
    For count mode: count + density.
    """
    if mode == "continuous":
        # Build per-field aggregation
        agg_parts = []
        field_names = []
        for fname, expr in field_exprs.items():
            # Extract the raw column name from the avg(...) expression
            col = expr.replace("avg(", "").rstrip(")")
            agg_parts.append(
                f"count({col}) AS {fname}__n,\n"
                f"       avg({col}) AS {fname}__mean,\n"
                f"       stddev_samp({col}) AS {fname}__sd,\n"
                f"       min({col}) AS {fname}__min,\n"
                f"       max({col}) AS {fname}__max,\n"
                f"       percentile_cont(0.25) WITHIN GROUP (ORDER BY {col}) AS {fname}__p25,\n"
                f"       percentile_cont(0.50) WITHIN GROUP (ORDER BY {col}) AS {fname}__median,\n"
                f"       percentile_cont(0.75) WITHIN GROUP (ORDER BY {col}) AS {fname}__p75"
            )
            field_names.append(fname)

        select_clause = ",\n       ".join(agg_parts)
        sql = (
            f"SELECT {select_clause}\n"
            f"FROM {table}\n"
            f"WHERE build = $1::genome_build\n"
            f"  AND chr_id = $2\n"
            f"  AND coord && int4range($3, $4)\n"
            f"  AND layer_id = $5"
        )
        return sql, field_names

    else:  # count mode
        sql = (
            f"SELECT count(*) AS n\n"
            f"FROM {table}\n"
            f"WHERE build = $1::genome_build\n"
            f"  AND chr_id = $2\n"
            f"  AND coord && int4range($3, $4)\n"
            f"  AND layer_id = $5"
        )
        return sql, ["count"]


def _parse_continuous_row(row, field_names: list[str], region_length: int) -> dict:
    """Parse a continuous-mode stats row into per-field summary dicts."""
    result = {}
    for fname in field_names:
        n = row[f"{fname}__n"]
        if n == 0:
            result[fname] = {"n": 0}
            continue
        result[fname] = {
            "n": n,
            "mean": _round_safe(row[f"{fname}__mean"]),
            "sd": _round_safe(row[f"{fname}__sd"]),
            "min": _round_safe(row[f"{fname}__min"]),
            "max": _round_safe(row[f"{fname}__max"]),
            "p25": _round_safe(row[f"{fname}__p25"]),
            "median": _round_safe(row[f"{fname}__median"]),
            "p75": _round_safe(row[f"{fname}__p75"]),
        }
    return result


def _round_safe(val, digits: int = 6):
    """Round a value, handling None."""
    if val is None:
        return None
    return round(float(val), digits)


@router.get("/summary")
async def platform_summary():
    """Platform-wide statistics summary.

    Returns total layers, total rows, supported builds, and coverage
    information. Designed for NAR Database Issue reviewers and API
    documentation.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Total active layers
        layer_stats = await conn.fetchrow(
            """SELECT count(*) AS total_layers,
                      count(DISTINCT layer_type) AS distinct_types,
                      count(DISTINCT genome_build) AS builds,
                      sum(row_count) AS total_rows
               FROM registry.layers
               WHERE is_active = true AND is_default = true"""
        )

        # Per-build breakdown
        build_rows = await conn.fetch(
            """SELECT genome_build::text AS build,
                      count(*) AS layers,
                      sum(row_count) AS rows
               FROM registry.layers
               WHERE is_active = true AND is_default = true
               GROUP BY genome_build
               ORDER BY genome_build"""
        )

        # Evidence class distribution
        evidence_rows = await conn.fetch(
            """SELECT evidence_class::text AS evidence_class,
                      count(*) AS layers
               FROM registry.layers
               WHERE is_active = true AND is_default = true
               GROUP BY evidence_class
               ORDER BY evidence_class"""
        )

        # Layer type distribution
        type_rows = await conn.fetch(
            """SELECT layer_type::text AS layer_type,
                      count(*) AS layers,
                      sum(row_count) AS rows
               FROM registry.layers
               WHERE is_active = true AND is_default = true
               GROUP BY layer_type
               ORDER BY sum(row_count) DESC"""
        )

    from polymer_genomics import __version__
    from polymer_genomics.envelope import DATA_VERSION

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "platform": {
            "total_layers": layer_stats["total_layers"],
            "distinct_layer_types": layer_stats["distinct_types"],
            "supported_builds": layer_stats["builds"],
            "total_rows": layer_stats["total_rows"],
        },
        "builds": [
            {"build": r["build"], "layers": r["layers"], "rows": r["rows"]}
            for r in build_rows
        ],
        "evidence_classes": {r["evidence_class"]: r["layers"] for r in evidence_rows},
        "layer_types": [
            {"type": r["layer_type"], "layers": r["layers"], "rows": r["rows"]}
            for r in type_rows
        ],
        "documentation": "https://api.polymerbio.org/docs",
        "data_sources": "https://polymerbio.org/data-sources",
    }


@router.get("/{build}/{region}")
async def region_stats(
    build: str,
    region: str,
    layers: str | None = Query(None),
    fields: str | None = Query(None),
):
    """Get summary statistics for data layers in a genomic region.

    Returns mean, median, sd, min, max, and percentiles (p25, p75) for
    continuous layers, or count + density for count-mode layers.
    """
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

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

    internal = api_to_db(parsed["start"], parsed["end"])
    region_length = internal["end"] - internal["start"]
    if region_length > settings.max_region_length:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "REGION_TOO_LARGE",
                    "message": f"Region exceeds maximum of {settings.max_region_length}bp.",
                }
            },
        )

    # Parse layer and field filters
    layer_keys = [l.strip() for l in layers.split(",") if l.strip()] if layers else None
    field_set = {f.strip() for f in fields.split(",") if f.strip()} if fields else None

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve layers
        if layer_keys:
            layer_rows = await conn.fetch(
                """SELECT id, layer_key, layer_type
                   FROM registry.active_layers WHERE layer_key = ANY($1)""",
                layer_keys,
            )
        else:
            layer_rows = await conn.fetch(
                """SELECT id, layer_key, layer_type
                   FROM registry.active_layers"""
            )

        data = {}
        db_start = time.monotonic()

        for lr in layer_rows:
            layer_type = lr["layer_type"]
            # sequence_biophysics shares the same table/fields as biophysics
            reg_key = "biophysics" if layer_type == "sequence_biophysics" else layer_type
            reg = CORRELATION_REGISTRY.get(reg_key)
            if not reg:
                continue

            # Filter fields if requested
            field_exprs = reg["fields"]
            if field_set and reg["mode"] == "continuous":
                field_exprs = {k: v for k, v in field_exprs.items() if k in field_set}
                if not field_exprs:
                    continue

            sql, field_names = _build_stats_sql(
                reg["table"], reg["pos_col"], reg["mode"], field_exprs
            )

            row = await conn.fetchrow(
                sql, build, chr_id, internal["start"], internal["end"], lr["id"]
            )

            if row is None:
                continue

            if reg["mode"] == "continuous":
                data[lr["layer_key"]] = _parse_continuous_row(
                    row, field_names, region_length
                )
            else:
                n = row["n"]
                data[lr["layer_key"]] = {
                    "count": n,
                    "density": round(n / region_length, 6) if region_length > 0 else 0,
                }

        db_time = (time.monotonic() - db_start) * 1000

    query_time_ms = round((time.monotonic() - start_time) * 1000, 1)

    result = {
        "status": "complete",
        "query": {
            "build": build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "region_length_bp": region_length,
            "layers_requested": layer_keys or ["all_active"],
        },
        "data": data,
        "timing": {
            "query_time_ms": query_time_ms,
            "db_time_ms": round(db_time, 1),
        },
    }
    if field_set:
        result["query"]["fields_requested"] = sorted(field_set)

    return result
