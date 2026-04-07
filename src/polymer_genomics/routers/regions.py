import asyncio
import base64
import json
import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.layer_licenses import LAYER_SOURCE_INFO
from polymer_genomics.queries import TRACK_REGISTRY


def _encode_cursor(chr_id: int, last_pos: int) -> str:
    """Encode cursor as base64 JSON."""
    return base64.urlsafe_b64encode(
        json.dumps({"c": chr_id, "p": last_pos}).encode()
    ).decode()


def _decode_cursor(cursor: str) -> dict:
    """Decode cursor from base64 JSON. Returns {"c": chr_id, "p": last_pos}."""
    try:
        return json.loads(base64.urlsafe_b64decode(cursor))
    except Exception:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_CURSOR", "message": "Malformed cursor value."}},
        )


def _apply_cursor_clause(sql: str, pos_col: str) -> str:
    """Insert a cursor filter clause before ORDER BY in the SQL query."""
    # Insert AND {pos_col} > $7 before ORDER BY, and shift LIMIT to $8
    sql = sql.replace("LIMIT $6", "LIMIT $7")
    sql = sql.replace(
        f"ORDER BY {pos_col}",
        f"AND {pos_col} > $6\n        ORDER BY {pos_col}",
    )
    return sql


# Position column for each layer type (used for cursor pagination).
# "pos" for single-point layers, "start_pos" for interval layers.
_POS_COL: dict[str, str] = {
    "cpg": "s.pos",
    "probe": "p.pos",
    "methylation": "m.pos",
    "gene_model": "g.start_pos",
    "isochore": "i.start_pos",
    "gene_cost": "gc.start_pos",
    "expression": "e.start_pos",
    "regulatory": "r.start_pos",
    "conservation": "c.start_pos",
    "protein_abundance": "pa.start_pos",
    "protein_turnover": "pt.start_pos",
    "protein_properties": "pp.start_pos",
    "constraint": "gc.start_pos",
    "protein_evolution": "pe.start_pos",
    "protein_atlas": "te.start_pos",
    "chromatin_state": "cs.start_pos",
    "repeat": "r.start_pos",
    "herv": "h.start_pos",
    "biophysics": "b.start_pos",
    "sequence_biophysics": "b.start_pos",
    "histone_mark": "hp.start_pos",
    "gwas": "ga.start_pos",
    "nonb_dna": "n.start_pos",
    "breakpoint": "b.start_pos",
    "fragility": "f.start_pos",
    "onco_events": "o.start_pos",
    "dmc1_hotspots": "d.start_pos",
    "cpg_island": "i.start_pos",
    "hic_compartment": "h.start_pos",
    "insulation_score": "s.start_pos",
    "tad_domain": "t.start_pos",
    "tf_binding": "start_pos",
    "wgbs": "start_pos",
    "accessibility": "start_pos",
    "mutation_density": "start_pos",
}


def _filter_mcols(converted: dict, field_set: set[str]) -> dict:
    """Filter mcols in a GRanges dict to only requested fields."""
    if "mcols" in converted:
        converted["mcols"] = {
            k: v for k, v in converted["mcols"].items() if k in field_set
        }
    return converted

router = APIRouter(prefix="/v1/regions", tags=["regions"])


@router.get("/{build}/{region}")
async def query_region(
    build: str,
    region: str,
    layers: str | None = Query(None),
    fields: str | None = Query(None),
    coords: str = Query("1based"),
    limit: int | None = Query(None, ge=1),
    cursor: str | None = Query(None),
):
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

    internal = api_to_db(parsed["start"], parsed["end"], coords=coords)
    region_length = internal["end"] - internal["start"]
    if region_length > settings.max_region_length:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "REGION_TOO_LARGE",
                    "message": f"Region exceeds maximum of {settings.max_region_length}bp.",
                    "limit": settings.max_region_length,
                    "requested": region_length,
                }
            },
        )

    page_limit = min(limit or settings.default_page_size, settings.max_returned_rows)

    pool = await get_pool()

    # Resolve requested layers (single short-lived connection)
    if layers:
        layer_keys = [l.strip() for l in layers.split(",")]
    else:
        layer_keys = None

    async with pool.acquire() as conn:
        if layer_keys:
            layer_rows = await conn.fetch(
                """SELECT id, layer_key, version, layer_type, content_hash,
                          evidence_class, tier, validation_status, context_conditions,
                          license_class
                   FROM registry.active_layers WHERE layer_key = ANY($1)""",
                layer_keys,
            )
        else:
            layer_rows = await conn.fetch(
                """SELECT id, layer_key, version, layer_type, content_hash,
                          evidence_class, tier, validation_status, context_conditions,
                          license_class
                   FROM registry.active_layers"""
            )

    # Parse fields filter
    field_set = {f.strip() for f in fields.split(",") if f.strip()} if fields else None

    # Decode cursor if provided
    cursor_data = _decode_cursor(cursor) if cursor else None

    # Fetch all layers in parallel, each on its own pooled connection
    db_start = time.monotonic()
    sem = asyncio.Semaphore(4)  # limit concurrent DB connections

    async def _fetch_layer(lr):
        layer_type = lr["layer_type"]
        track = TRACK_REGISTRY.get(layer_type)
        if not track:
            return None

        use_cursor = (
            cursor_data is not None
            and cursor_data["c"] == chr_id
            and layer_type in _POS_COL
        )

        async with sem:
            async with pool.acquire() as layer_conn:
                if use_cursor:
                    pos_col = _POS_COL[layer_type]
                    sql = _apply_cursor_clause(track["query_fn"](), pos_col)
                    rows = await layer_conn.fetch(
                        sql,
                        build,
                        chr_id,
                        internal["start"],
                        internal["end"],
                        lr["id"],
                        cursor_data["p"],
                        page_limit,
                    )
                else:
                    rows = await layer_conn.fetch(
                        track["query_fn"](),
                        build,
                        chr_id,
                        internal["start"],
                        internal["end"],
                        lr["id"],
                        page_limit,
                    )

        converted = track["convert_fn"](rows, chr_name)

        if field_set:
            _filter_mcols(converted, field_set)

        # Build per-layer pagination info
        layer_pagination = None
        n = converted.get("n", 0)
        if n >= page_limit and layer_type in _POS_COL and rows:
            last_row = rows[-1]
            raw_pos_col = _POS_COL[layer_type].split(".")[-1]
            last_pos = last_row.get(raw_pos_col, last_row.get("pos", last_row.get("start_pos", 0)))
            layer_pagination = {
                "next_cursor": _encode_cursor(chr_id, last_pos),
                "has_more": True,
            }

        source_info = LAYER_SOURCE_INFO.get(layer_type, {})
        resolved_entry = {
            "layer_key": lr["layer_key"],
            "version": lr["version"],
            "layer_id": str(lr["id"]),
            "content_hash": lr["content_hash"],
            "evidence_class": lr["evidence_class"],
            "tier": lr["tier"],
            "validation_status": lr["validation_status"],
            "context_conditions": lr["context_conditions"],
            "source": source_info.get("source", "Unknown"),
            "source_license": source_info.get("license", "See polymerbio.org/data-sources"),
            "license_class": lr["license_class"],
            "status": "ok",
        }

        return lr["layer_key"], converted, resolved_entry, layer_pagination

    results = await asyncio.gather(*[_fetch_layer(lr) for lr in layer_rows])

    layers_resolved = []
    data = {}
    pagination_info: dict[str, dict] = {}
    for result in results:
        if result is None:
            continue
        layer_key, converted, resolved_entry, layer_pagination = result
        data[layer_key] = converted
        layers_resolved.append(resolved_entry)
        if layer_pagination is not None:
            pagination_info[layer_key] = layer_pagination

    db_time = (time.monotonic() - db_start) * 1000

    any_truncated = any(d.get("n", 0) >= page_limit for d in data.values())
    status = "truncated" if any_truncated else "complete"

    query_meta = {
        "build": build,
        "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
        "layers_requested": layer_keys or ["all_active"],
        "coords_input": coords,
    }
    if field_set:
        query_meta["fields_requested"] = sorted(field_set)

    return build_envelope(
        status=status,
        query=query_meta,
        layers_resolved=layers_resolved,
        data=data,
        pagination=pagination_info or None,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


