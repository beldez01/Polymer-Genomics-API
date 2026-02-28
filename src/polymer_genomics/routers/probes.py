import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/probes", tags=["probes"])

MAX_BATCH_SIZE = 10_000


class ProbeBatchRequest(BaseModel):
    probe_ids: list[str]


@router.get("/{build}/{probe_id}")
async def get_probe(build: str, probe_id: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve all probe layers
        layers = await conn.fetch(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build",
            build,
        )
        if not layers:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No probe layer for build {build}"}},
            )

        layer_ids = [l["id"] for l in layers]
        layer_map = {l["id"]: l for l in layers}

        db_start = time.monotonic()

        # Fetch probe coordinate across all probe layers
        row = await conn.fetchrow(
            """
            SELECT probe_id, chr_id, pos, pos + 1 AS end_pos,
                   gene_symbol, cpg_context, layer_id
            FROM probe.coordinates
            WHERE build = $1::genome_build
              AND probe_id = $2
              AND layer_id = ANY($3)
            """,
            build,
            probe_id,
            layer_ids,
        )

        if not row:
            db_time = (time.monotonic() - db_start) * 1000
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Probe '{probe_id}' not found in {build}"}},
            )

        layer = layer_map[row["layer_id"]]

        # Fetch crossmap edges
        crossmap_rows = await conn.fetch(
            """
            SELECT dst_platform, dst_probe_id, method, confidence
            FROM probe.map_edges
            WHERE src_probe_id = $1
              AND build = $2::genome_build
            """,
            probe_id,
            build,
        )
        db_time = (time.monotonic() - db_start) * 1000

    api = db_to_api(row["pos"], row["end_pos"])
    chr_name = CHR_ID_TO_NAME.get(row["chr_id"], f"chr{row['chr_id']}")

    probe_data = {
        "probe_id": row["probe_id"],
        "seqname": chr_name,
        "start": api["start"],
        "end": api["end"],
        "width": api["width"],
        "gene_symbol": row["gene_symbol"],
        "cpg_context": row["cpg_context"],
    }

    crossmap = [
        {
            "dst_platform": cr["dst_platform"],
            "dst_probe_id": cr["dst_probe_id"],
            "method": cr["method"],
            "confidence": float(cr["confidence"]),
        }
        for cr in crossmap_rows
    ]

    return build_envelope(
        status="complete",
        query={"build": build, "probe_id": probe_id},
        layers_resolved=[
            {
                "layer_key": layer["layer_key"],
                "version": layer["version"],
                "layer_id": str(layer["id"]),
                "content_hash": layer["content_hash"],
                "status": "ok",
            }
        ],
        data={"probe": probe_data, "crossmap": crossmap},
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


@router.post("/{build}/batch")
async def probe_batch(build: str, body: ProbeBatchRequest):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    if not body.probe_ids:
        raise HTTPException(
            400,
            {"error": {"code": "EMPTY_BATCH", "message": "probe_ids must not be empty"}},
        )

    if len(body.probe_ids) > MAX_BATCH_SIZE:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "BATCH_TOO_LARGE",
                    "message": f"Maximum {MAX_BATCH_SIZE} probe IDs per request",
                    "limit": MAX_BATCH_SIZE,
                    "requested": len(body.probe_ids),
                }
            },
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve all probe layers
        layers = await conn.fetch(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build",
            build,
        )
        if not layers:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No probe layer for build {build}"}},
            )

        layer_ids = [l["id"] for l in layers]

        db_start = time.monotonic()
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (probe_id) probe_id, chr_id, pos, pos + 1 AS end_pos,
                   gene_symbol, cpg_context
            FROM probe.coordinates
            WHERE build = $1::genome_build
              AND probe_id = ANY($2)
              AND layer_id = ANY($3)
            ORDER BY probe_id, chr_id, pos
            """,
            build,
            body.probe_ids,
            layer_ids,
        )
        db_time = (time.monotonic() - db_start) * 1000

    # Build GRanges response
    starts, ends, widths = [], [], []
    seqnames = []
    probe_ids, symbols, contexts = [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        seqnames.append(CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}"))
        probe_ids.append(r["probe_id"])
        symbols.append(r["gene_symbol"])
        contexts.append(r["cpg_context"])

    data = {
        "class": "GRanges",
        "seqnames": seqnames,
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "probe_id": probe_ids,
            "gene_symbol": symbols,
            "cpg_context": contexts,
        },
        "n": len(rows),
    }

    return build_envelope(
        status="complete",
        query={"build": build, "probe_ids": body.probe_ids, "batch_size": len(body.probe_ids)},
        layers_resolved=[
            {
                "layer_key": l["layer_key"],
                "version": l["version"],
                "layer_id": str(l["id"]),
                "content_hash": l["content_hash"],
                "status": "ok",
            }
            for l in layers
        ],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
