import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.config import settings
from polymer_genomics.coordinates import api_to_db, db_to_api, parse_region
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.queries import LAYER_QUERY_MAP

router = APIRouter(prefix="/v1/regions", tags=["regions"])

CHR_NAME_TO_ID = {f"chr{i}": i for i in range(1, 23)}
CHR_NAME_TO_ID.update({"chrX": 23, "chrY": 24, "chrM": 25})

VALID_BUILDS = {"hg37", "hg38"}


@router.get("/{build}/{region}")
async def query_region(
    build: str,
    region: str,
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
    async with pool.acquire() as conn:
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
            query_fn = LAYER_QUERY_MAP.get(lr["layer_type"])
            if not query_fn:
                continue

            rows = await conn.fetch(
                query_fn(),
                build,
                chr_id,
                internal["start"],
                internal["end"],
                lr["id"],
                page_limit,
            )

            converted = _convert_rows(lr["layer_type"], rows, chr_name)
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

    total_rows = sum(d.get("n", 0) for d in data.values())
    if total_rows >= page_limit:
        status = "truncated"
    else:
        status = "complete"

    return build_envelope(
        status=status,
        query={
            "build": build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "layers_requested": layer_keys or ["all_active"],
            "coords_input": coords,
        },
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


def _convert_rows(layer_type: str, rows: list, chr_name: str) -> dict:
    """Convert DB rows to GRanges-structured response with 1-based coordinates."""
    if layer_type == "cpg":
        starts, ends, widths, contexts, gc_contents = [], [], [], [], []
        for r in rows:
            api = db_to_api(r["pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            contexts.append(r["context"])
            gc_contents.append(r["gc_content"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": ["*"] * len(rows),
            "mcols": {"context": contexts, "gc_content": gc_contents},
            "n": len(rows),
        }
    elif layer_type == "gene_model":
        starts, ends, widths, strands = [], [], [], []
        symbols, gene_ids, tx_ids, ftypes = [], [], [], []
        for r in rows:
            api = db_to_api(r["start_pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            strands.append(r["strand"])
            symbols.append(r["gene_symbol"])
            gene_ids.append(r["gene_id"])
            tx_ids.append(r["transcript_id"])
            ftypes.append(r["feature_type"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": strands,
            "mcols": {
                "gene_symbol": symbols,
                "gene_id": gene_ids,
                "transcript_id": tx_ids,
                "feature_type": ftypes,
            },
            "n": len(rows),
        }
    elif layer_type == "probe":
        starts, ends, widths, probe_ids, symbols, contexts = [], [], [], [], [], []
        for r in rows:
            api = db_to_api(r["pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            probe_ids.append(r["probe_id"])
            symbols.append(r["gene_symbol"])
            contexts.append(r["cpg_context"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": ["*"] * len(rows),
            "mcols": {"probe_id": probe_ids, "gene_symbol": symbols, "cpg_context": contexts},
            "n": len(rows),
        }
    elif layer_type == "isochore":
        starts, ends, widths, gc_contents, classes = [], [], [], [], []
        for r in rows:
            api = db_to_api(r["start_pos"], r["end_pos"])
            starts.append(api["start"])
            ends.append(api["end"])
            widths.append(api["width"])
            gc_contents.append(r["gc_content"])
            classes.append(r["isochore_class"])
        return {
            "class": "GRanges",
            "seqnames": [chr_name] * len(rows),
            "ranges": {"start": starts, "end": ends, "width": widths},
            "strand": ["*"] * len(rows),
            "mcols": {"gc_content": gc_contents, "isochore_class": classes},
            "n": len(rows),
        }
    return {"n": 0}
