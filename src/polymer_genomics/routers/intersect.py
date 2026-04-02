"""Cross-layer intersection endpoint.

Finds genomic positions satisfying conditions across multiple annotation layers.
The killer feature: no other genomics API offers multi-layer boolean intersection
with heterogeneous filter types in a single query.
"""

import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from polymer_genomics import __version__
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.envelope import DATA_VERSION
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.db import get_pool

router = APIRouter(prefix="/v1/query", tags=["intersection"])


# ── Request models ────────────────────────────────────────────────

class IntersectFilter(BaseModel):
    layer: str
    field: str | None = None
    op: str  # 'overlaps', '>', '<', '>=', '<=', '==', '!=', 'between'
    value: float | str | list | None = None


class IntersectRequest(BaseModel):
    build: str = "hg38"
    region: str
    filters: list[IntersectFilter] = Field(..., min_length=1, max_length=10)
    return_layers: list[str] | None = None
    limit: int = Field(default=1000, le=10000)


# ── Layer → table/field mapping ───────────────────────────────────

_ALLOWED_OPS = {"overlaps", ">", "<", ">=", "<=", "==", "!=", "between"}

_SQL_OPS = {
    ">": ">",
    "<": "<",
    ">=": ">=",
    "<=": "<=",
    "==": "=",
    "!=": "!=",
}

# Maps layer keys to their table, coord column, and allowed filterable fields
INTERSECT_TABLES: dict[str, dict] = {
    "biophysics": {
        "table": "biophysics.sequence_properties",
        "id_col": "layer_id",
        "fields": {
            "gc_content", "stacking_dg37", "melting_temp", "curvature",
            "dipole_density", "groove_width", "periodicity_power",
            "mgw_mean", "prot_mean", "roll_mean", "helt_mean",
            "delta_mgw", "delta_prot", "delta_roll", "delta_helt",
            "melting_cooperativity", "bubble_propensity", "melting_width",
            "sbs_c_to_a_ddg", "sbs_c_to_g_ddg", "sbs_c_to_t_ddg", "sbs_t_to_a_ddg",
            "meth_delta_g", "meth_delta_tm",
            "correlation_length", "integrated_response", "perturbation_reach", "response_asymmetry",
            "deformability", "g4_density", "g4_max_score", "kmer_complexity",
            "dinucleotide_entropy", "dominant_period",
            "phylop_241way_mean", "phastcons_241way_mean",
            "b_score_mean", "recomb_rate_cmmb", "mutation_rate_mean",
        },
    },
    "conservation": {
        "table": "conservation.scores",
        "id_col": "layer_id",
        "fields": {"phylop_mean", "phastcons_mean"},
    },
    "cpg_sites": {
        "table": "cpg.sites",
        "id_col": "layer_id",
        "fields": {"density", "observed_expected"},
    },
    "cpg_islands": {
        "table": "cpg.islands",
        "id_col": "layer_id",
        "fields": {"length", "gc_content", "obs_exp"},
    },
    "ccre": {
        "table": "regulatory.ccre",
        "id_col": "layer_id",
        "fields": {"ccre_type", "zscore_dnase", "zscore_h3k4me3", "zscore_h3k27ac", "zscore_ctcf"},
    },
    "chromatin_state": {
        "table": "regulatory.chromatin_states",
        "id_col": "layer_id",
        "fields": {"state_number", "state_name"},
    },
    "breakpoints": {
        "table": "fragility.breakpoints",
        "id_col": "layer_id",
        "fields": {"breakpoint_type", "name"},
    },
    "nonb_dna": {
        "table": "fragility.nonb_dna",
        "id_col": "layer_id",
        "fields": {
            "g4_density", "z_dna_density", "cruciform_density",
            "r_loop_score", "triplex_density", "total_nonb_density",
        },
    },
    "repeats": {
        "table": "annotation.repeats",
        "id_col": "layer_id",
        "fields": {"repeat_class", "repeat_family", "repeat_age", "is_active", "superfamily"},
    },
    "herv_loci": {
        "table": "annotation.herv_loci",
        "id_col": "layer_id",
        "fields": {"subfamily", "n_fragments", "locus_length"},
    },
    "tad_domain": {
        "table": "regulatory.tad_domains",
        "id_col": "layer_id",
        "fields": {"cell_type", "resolution_bp", "corner_score", "uvar_score", "lvar_score"},
    },
    "hic_compartment": {
        "table": "regulatory.hic_compartment",
        "id_col": "layer_id",
        "fields": {"cell_type", "pc1_score", "resolution_bp"},
    },
    "insulation_score": {
        "table": "regulatory.insulation_score",
        "id_col": "layer_id",
        "fields": {"cell_type", "insulation_score", "resolution_bp"},
    },
}


def _build_subquery(
    filt: IntersectFilter,
    param_idx: int,
    build: str,
    chr_id: int,
    db_start: int,
    db_end: int,
) -> tuple[str, list, int]:
    """Build a SQL subquery for one filter.

    Returns (sql_fragment, params, next_param_idx).
    """
    table_info = INTERSECT_TABLES.get(filt.layer)
    if table_info is None:
        raise HTTPException(
            400,
            {"error": {
                "code": "INVALID_LAYER",
                "message": f"Unknown intersect layer: {filt.layer}. "
                           f"Available: {sorted(INTERSECT_TABLES.keys())}",
            }},
        )

    table = table_info["table"]
    idx = param_idx

    # Base: region overlap
    base = (
        f"SELECT start_pos, end_pos FROM {table} "
        f"WHERE build = ${idx}::genome_build AND chr_id = ${idx+1} "
        f"AND coord && int4range(${idx+2}, ${idx+3})"
    )
    params = [build, chr_id, db_start, db_end]
    idx += 4

    if filt.op == "overlaps":
        return base, params, idx

    # Validate field exists
    if filt.field is None:
        raise HTTPException(400, {"error": {
            "code": "MISSING_FIELD",
            "message": f"Filter on '{filt.layer}' with op '{filt.op}' requires a 'field' parameter.",
        }})

    if filt.field not in table_info["fields"]:
        raise HTTPException(400, {"error": {
            "code": "INVALID_FIELD",
            "message": f"Field '{filt.field}' not available for layer '{filt.layer}'. "
                       f"Available: {sorted(table_info['fields'])}",
        }})

    if filt.op == "between":
        if not isinstance(filt.value, list) or len(filt.value) != 2:
            raise HTTPException(400, {"error": {
                "code": "INVALID_VALUE",
                "message": "'between' op requires value as [low, high] array.",
            }})
        sql = f"{base} AND {filt.field} BETWEEN ${idx} AND ${idx+1}"
        params.extend([filt.value[0], filt.value[1]])
        idx += 2
        return sql, params, idx

    sql_op = _SQL_OPS.get(filt.op)
    if sql_op is None:
        raise HTTPException(400, {"error": {
            "code": "INVALID_OP",
            "message": f"Unknown operator: '{filt.op}'. Allowed: {sorted(_ALLOWED_OPS)}",
        }})

    sql = f"{base} AND {filt.field} {sql_op} ${idx}"
    params.append(filt.value)
    idx += 1
    return sql, params, idx


@router.post("/intersect")
async def intersect_layers(req: IntersectRequest):
    """Find genomic positions satisfying multiple cross-layer conditions.

    Each filter specifies a layer, optional field, operator, and threshold.
    Returns positions that satisfy ALL filters (boolean AND intersection).
    """
    start_time = time.monotonic()

    if req.build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {req.build}"}})

    try:
        parsed = parse_region(req.region)
    except ValueError as e:
        raise HTTPException(400, {"error": {"code": "INVALID_REGION", "message": str(e)}})

    chr_name = parsed["chr"]
    chr_id = CHR_NAME_TO_ID.get(chr_name)
    if chr_id is None:
        raise HTTPException(400, {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown: {chr_name}"}})

    internal = api_to_db(parsed["start"], parsed["end"])

    # Build INTERSECT query from all filters
    subqueries: list[str] = []
    all_params: list = []
    param_idx = 1

    for filt in req.filters:
        if filt.op not in _ALLOWED_OPS:
            raise HTTPException(400, {"error": {
                "code": "INVALID_OP",
                "message": f"Unknown operator: '{filt.op}'. Allowed: {sorted(_ALLOWED_OPS)}",
            }})

        sql, params, param_idx = _build_subquery(
            filt, param_idx, req.build, chr_id, internal["start"], internal["end"],
        )
        subqueries.append(sql)
        all_params.extend(params)

    # Combine with INTERSECT and apply limit
    combined = " INTERSECT ".join(f"({sq})" for sq in subqueries)
    final_sql = f"SELECT * FROM ({combined}) AS _intersect ORDER BY start_pos LIMIT ${param_idx}"
    all_params.append(req.limit)

    pool = await get_pool()
    async with pool.acquire() as conn:
        db_start = time.monotonic()
        rows = await conn.fetch(final_sql, *all_params)
        db_time = (time.monotonic() - db_start) * 1000

        # Optionally annotate with return_layers
        annotations = {}
        if req.return_layers and rows:
            positions = [(r["start_pos"], r["end_pos"]) for r in rows]
            for layer_key in req.return_layers:
                table_info = INTERSECT_TABLES.get(layer_key)
                if table_info is None:
                    continue
                table = table_info["table"]
                # Fetch all data for these positions
                ann_rows = await conn.fetch(
                    f"SELECT * FROM {table} "
                    f"WHERE build = $1::genome_build AND chr_id = $2 "
                    f"AND coord && int4range($3, $4)",
                    req.build, chr_id, internal["start"], internal["end"],
                )
                converted_anns = []
                for r in ann_rows:
                    d = dict(r)
                    if "start_pos" in d:
                        d["start_pos"] = d["start_pos"] + 1
                    converted_anns.append(d)
                annotations[layer_key] = converted_anns

    # Format results
    positions = []
    for r in rows:
        pos = {
            "start": r["start_pos"] + 1,  # convert to 1-based
            "end": r["end_pos"],
        }
        positions.append(pos)

    query_time = (time.monotonic() - start_time) * 1000

    return {
        "status": "complete" if len(rows) < req.limit else "truncated",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "coordinate_system": "1-based_closed",
        "query": {
            "build": req.build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "filters": [f.model_dump() for f in req.filters],
            "return_layers": req.return_layers,
        },
        "data": {
            "intersection_count": len(positions),
            "positions": positions,
            "annotations": annotations if annotations else None,
        },
        "timing": {
            "query_time_ms": round(query_time, 1),
            "db_time_ms": round(db_time, 1),
        },
    }
