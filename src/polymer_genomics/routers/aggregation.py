"""Aggregation endpoint: binned density and summary statistics."""

import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS, safe_table
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
    elif layer_type == "biophysics":
        return """
            SELECT floor(b.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   avg(b.gc_content) AS mean_gc,
                   avg(b.stacking_dg37) AS mean_dg37,
                   avg(b.melting_temp) AS mean_tm,
                   avg(b.curvature) AS mean_curvature
            FROM biophysics.sequence_properties b
            WHERE b.build = $1::genome_build
              AND b.chr_id = $2
              AND b.coord && int4range($3, $4)
              AND b.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "conservation":
        return """
            SELECT floor(c.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   avg(c.phylop_mean) AS mean_phylop,
                   avg(c.phastcons_mean) AS mean_phastcons
            FROM conservation.scores c
            WHERE c.build = $1::genome_build
              AND c.chr_id = $2
              AND c.coord && int4range($3, $4)
              AND c.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "repeat":
        return """
            SELECT floor(r.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM annotation.repeats r
            WHERE r.build = $1::genome_build
              AND r.chr_id = $2
              AND r.coord && int4range($3, $4)
              AND r.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "regulatory":
        return """
            SELECT floor(c.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM regulatory.ccre c
            WHERE c.build = $1::genome_build
              AND c.chr_id = $2
              AND c.coord && int4range($3, $4)
              AND c.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "nonb_dna":
        return """
            SELECT floor(n.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   avg(n.total_nonb_density) AS mean_nonb_density,
                   avg(n.g4_density) AS mean_g4_density
            FROM fragility.nonb_dna n
            WHERE n.build = $1::genome_build
              AND n.chr_id = $2
              AND n.coord && int4range($3, $4)
              AND n.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "clinvar":
        return """
            SELECT floor(v.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM variation.clinvar_variants v
            WHERE v.build = $1::genome_build
              AND v.chr_id = $2
              AND v.coord && int4range($3, $4)
              AND v.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "eqtl":
        return """
            SELECT floor(e.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM qtl.eqtls e
            WHERE e.build = $1::genome_build
              AND e.chr_id = $2
              AND e.coord && int4range($3, $4)
              AND e.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "meqtl":
        return """
            SELECT floor(m.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM qtl.meqtls m
            WHERE m.build = $1::genome_build
              AND m.chr_id = $2
              AND m.coord && int4range($3, $4)
              AND m.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "chromatin_state":
        return """
            SELECT floor(cs.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM regulatory.chromatin_state cs
            WHERE cs.build = $1::genome_build
              AND cs.chr_id = $2
              AND cs.coord && int4range($3, $4)
              AND cs.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "lad":
        return """
            SELECT floor(l.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM nuclear.lads l
            WHERE l.build = $1::genome_build
              AND l.chr_id = $2
              AND l.coord && int4range($3, $4)
              AND l.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "super_enhancer":
        return """
            SELECT floor(se.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density,
                   avg(se.h3k27ac_signal) AS mean_h3k27ac
            FROM nuclear.super_enhancers se
            WHERE se.build = $1::genome_build
              AND se.chr_id = $2
              AND se.coord && int4range($3, $4)
              AND se.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "methylation":
        return """
            SELECT floor(m.pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density,
                   avg(m.gran) AS mean_gran,
                   avg(m.mono) AS mean_mono,
                   avg(m.bcell) AS mean_bcell
            FROM ref.methylation_reference m
            WHERE m.build = $1::genome_build
              AND m.chr_id = $2
              AND m.coord && int4range($3, $4)
              AND m.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "onco_events":
        return """
            SELECT floor(o.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM recombination.onco_events o
            WHERE o.build = $1
              AND o.chr_id = $2
              AND o.start_pos < $4
              AND o.end_pos > $3
              AND ($5::uuid IS NOT NULL)
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "dmc1_hotspots":
        return """
            SELECT floor(d.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density,
                   avg(d.mean_strength) AS mean_strength
            FROM recombination.dmc1_hotspots d
            WHERE d.build = $1
              AND d.chr_id = $2
              AND d.start_pos < $4
              AND d.end_pos > $3
              AND ($5::uuid IS NOT NULL)
            GROUP BY bin_start
            ORDER BY bin_start
        """
    # Generic count/density fallback for any layer in _COUNT_TABLES
    from polymer_genomics.routers.profile import _COUNT_TABLES, _ALLOWED_PROFILE_TABLES
    table = _COUNT_TABLES.get(layer_type)
    if table is not None:
        table = safe_table(table, _ALLOWED_PROFILE_TABLES)
        return f"""
            SELECT floor(t.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM {table} t
            WHERE t.build = $1::genome_build
              AND t.chr_id = $2
              AND t.coord && int4range($3, $4)
              AND t.layer_id = $5
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
                        "bin_start": int(r["bin_start"]) + 1,
                        "bin_end": int(r["bin_start"]) + resolution,
                        "gene_count": r["gene_count"],
                        "density": r["density"],
                        "mean_ecpa": float(r["mean_ecpa"]) if r["mean_ecpa"] is not None else None,
                        "total_cost": float(r["total_cost"]) if r["total_cost"] is not None else None,
                        "mean_cai": float(r["mean_cai"]) if r["mean_cai"] is not None else None,
                    }
                else:
                    bin_entry = {
                        "bin_start": int(r["bin_start"]) + 1,
                        "bin_end": int(r["bin_start"]) + resolution,
                        "count": r["count"],
                    }
                    # Include all extra columns from the SQL result
                    for key in r.keys():
                        if key not in ("bin_start", "count"):
                            val = r[key]
                            bin_entry[key] = float(val) if val is not None else None
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
