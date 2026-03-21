import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["genes"])


@router.get("/{build}/{symbol}")
async def get_gene(build: str, symbol: str):
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

        db_start = time.monotonic()
        rows = await conn.fetch(
            """
            SELECT chr_id, start_pos, end_pos, strand, gene_symbol,
                   gene_id, transcript_id, feature_type
            FROM gene.features
            WHERE build = $1::genome_build
              AND gene_symbol = UPPER($2)
              AND layer_id = $3
            ORDER BY start_pos
            LIMIT $4
            """,
            build,
            symbol,
            layer["id"],
            settings.max_returned_rows,
        )
        db_time = (time.monotonic() - db_start) * 1000

    resolved_alias = None
    if not rows:
        # Try alias resolution before 404
        async with pool.acquire() as conn:
            canonical = await resolve_alias(conn, symbol)
        if canonical:
            resolved_alias = symbol
            async with pool.acquire() as conn:
                layer = await conn.fetchrow(
                    "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
                    "WHERE layer_type = 'gene_model' AND genome_build = $1::genome_build",
                    build,
                )
                rows = await conn.fetch(
                    """
                    SELECT chr_id, start_pos, end_pos, strand, gene_symbol,
                           gene_id, transcript_id, feature_type
                    FROM gene.features
                    WHERE build = $1::genome_build
                      AND gene_symbol = UPPER($2)
                      AND layer_id = $3
                    ORDER BY start_pos
                    LIMIT $4
                    """,
                    build,
                    canonical,
                    layer["id"],
                    settings.max_returned_rows,
                )
        if not rows:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in {build}"}},
            )
    else:
        canonical = symbol

    # Build GRanges response
    starts, ends, widths, strands = [], [], [], []
    seqnames = []
    symbols, gene_ids, tx_ids, ftypes = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"])
        seqnames.append(CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}"))
        symbols.append(r["gene_symbol"])
        gene_ids.append(r["gene_id"])
        tx_ids.append(r["transcript_id"])
        ftypes.append(r["feature_type"])

    data = {
        "class": "GRanges",
        "seqnames": seqnames,
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

    return build_envelope(
        status="complete",
        query={"build": build, "gene_symbol": symbol, **({"resolved_alias": resolved_alias} if resolved_alias else {})},
        layers_resolved=[
            {
                "layer_key": layer["layer_key"],
                "version": layer["version"],
                "layer_id": str(layer["id"]),
                "content_hash": layer["content_hash"],
                "status": "ok",
            }
        ],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
