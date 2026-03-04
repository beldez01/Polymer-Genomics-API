"""Aggregation endpoint: binned density and summary statistics."""

import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.routers.tiles import VALID_RESOLUTIONS

router = APIRouter(prefix="/v1/aggregation", tags=["aggregation"])

# Layer types that have a gc_content column
_GC_LAYER_TYPES = {"cpg", "isochore"}


def _aggregation_query(layer_type: str) -> str:
    """Return the aggregation SQL for a given layer type."""
    if layer_type == "cpg":
        return """
            SELECT floor(s.pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density,
                   avg(s.gc_content) AS avg_gc
            FROM cpg.sites s
            WHERE s.build = $1::genome_build
              AND s.chr_id = $2
              AND s.coord && int4range($3, $4)
              AND s.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "isochore":
        return """
            SELECT floor(i.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density,
                   avg(i.gc_content) AS avg_gc
            FROM ref.isochores i
            WHERE i.build = $1::genome_build
              AND i.chr_id = $2
              AND i.coord && int4range($3, $4)
              AND i.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "gene_model":
        return """
            SELECT floor(g.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM gene.features g
            WHERE g.build = $1::genome_build
              AND g.chr_id = $2
              AND g.coord && int4range($3, $4)
              AND g.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "probe":
        return """
            SELECT floor(p.pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM probe.coordinates p
            WHERE p.build = $1::genome_build
              AND p.chr_id = $2
              AND p.coord && int4range($3, $4)
              AND p.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "gene_cost":
        return """
            SELECT floor(gc.start_pos / $6) * $6 AS bin_start,
                   count(*) AS gene_count,
                   count(*)::float / $6 AS density,
                   avg(gc.ecpa_b20) AS mean_ecpa,
                   sum(gc.c_protein) AS total_cost,
                   avg(gc.cai) AS mean_cai
            FROM bioenergetics.gene_costs gc
            WHERE gc.build = $1::genome_build
              AND gc.chr_id = $2
              AND gc.coord && int4range($3, $4)
              AND gc.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    return None


@router.get("/{build}/{region}")
async def aggregate_region(
    build: str,
    region: str,
    layers: str | None = Query(None),
    resolution: int = Query(1000),
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

    # No max_region_length guard here — aggregation returns binned summaries,
    # not raw rows, so whole-chromosome queries are fine.  Output size is
    # bounded by region_length / resolution, which is at most ~250 K bins
    # (whole chr1 at 1 kb) — well within SQL GROUP BY capacity.

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
        db_start = time.monotonic()

        for lr in layer_rows:
            agg_sql = _aggregation_query(lr["layer_type"])
            if not agg_sql:
                continue

            rows = await conn.fetch(
                agg_sql,
                build,
                chr_id,
                internal["start"],
                internal["end"],
                lr["id"],
                resolution,
            )

            has_gc = lr["layer_type"] in _GC_LAYER_TYPES
            is_gene_cost = lr["layer_type"] == "gene_cost"
            bins = []
            for r in rows:
                if is_gene_cost:
                    bin_entry = {
                        "bin_start": int(r["bin_start"]),
                        "bin_end": int(r["bin_start"]) + resolution,
                        "gene_count": r["gene_count"],
                        "density": r["density"],
                        "mean_ecpa": float(r["mean_ecpa"]) if r["mean_ecpa"] is not None else None,
                        "total_cost": float(r["total_cost"]) if r["total_cost"] is not None else None,
                        "mean_cai": float(r["mean_cai"]) if r["mean_cai"] is not None else None,
                    }
                else:
                    bin_entry = {
                        "bin_start": int(r["bin_start"]),
                        "bin_end": int(r["bin_start"]) + resolution,
                        "count": r["count"],
                        "density": r["density"],
                    }
                    if has_gc:
                        bin_entry["avg_gc"] = float(r["avg_gc"]) if r["avg_gc"] is not None else None
                bins.append(bin_entry)

            data[lr["layer_key"]] = {
                "bins": bins,
                "resolution": resolution,
                "n_bins": len(bins),
            }

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

    return build_envelope(
        status="complete",
        query={
            "build": build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "resolution": resolution,
            "layers_requested": layer_keys or ["all_active"],
        },
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
