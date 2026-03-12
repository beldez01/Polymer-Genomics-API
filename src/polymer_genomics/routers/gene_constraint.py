"""Gene constraint detail endpoint."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["constraint"])


@router.get("/{build}/{symbol}/constraint")
async def get_gene_constraint(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve constraint layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'constraint' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No constraint layer for build {build}"}},
            )

        db_start = time.monotonic()
        row = await conn.fetchrow(
            """
            SELECT *
            FROM conservation.gene_constraint
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            LIMIT 1
            """,
            build,
            symbol,
            layer["id"],
        )
        db_time = (time.monotonic() - db_start) * 1000

    resolved_alias = None
    if not row:
        async with pool.acquire() as alias_conn:
            canonical = await resolve_alias(alias_conn, symbol)
        if canonical:
            resolved_alias = symbol
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT *
                    FROM conservation.gene_constraint
                    WHERE build = $1::genome_build
                      AND UPPER(gene_symbol) = UPPER($2)
                      AND layer_id = $3
                    LIMIT 1
                    """,
                    build, canonical, layer["id"],
                )
        if not row:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in constraint layer for {build}"}},
            )

    # Build structured response
    coordinates = None
    if row["chr_id"] is not None and row["start_pos"] is not None:
        api = db_to_api(row["start_pos"], row["end_pos"])
        chr_name = CHR_ID_TO_NAME.get(row["chr_id"], f"chr{row['chr_id']}")
        coordinates = {
            "seqname": chr_name,
            "start": api["start"],
            "end": api["end"],
            "width": api["width"],
            "strand": row["strand"],
        }

    identity = {
        "gene_symbol": row["gene_symbol"],
        "transcript": row["transcript"],
    }

    constraint = {
        "pli": row["pli"],
        "loeuf": row["loeuf"],
        "mis_z": row["mis_z"],
        "syn_z": row["syn_z"],
        "obs_lof": row["obs_lof"],
        "exp_lof": row["exp_lof"],
        "obs_mis": row["obs_mis"],
        "exp_mis": row["exp_mis"],
        "obs_syn": row["obs_syn"],
        "exp_syn": row["exp_syn"],
    }

    data = {
        "coordinates": coordinates,
        "identity": identity,
        "constraint": constraint,
        "gnomad_version": row["gnomad_version"],
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol, **({"resolved_alias": resolved_alias} if resolved_alias else {})},
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
