"""Gene protein abundance detail endpoint."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["protein_abundance"])


@router.get("/{build}/{symbol}/protein-abundance")
async def get_protein_abundance(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve protein_abundance layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'protein_abundance' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No protein_abundance layer for build {build}"}},
            )

        db_start = time.monotonic()
        rows = await conn.fetch(
            """
            SELECT *
            FROM bioenergetics.protein_abundance
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            ORDER BY abundance_ppm DESC
            """,
            build,
            symbol,
            layer["id"],
        )
        db_time = (time.monotonic() - db_start) * 1000

    if not rows:
        raise HTTPException(
            404,
            {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in protein_abundance layer for {build}"}},
        )

    # Build coordinates from first row (all rows are the same gene)
    first = rows[0]
    coordinates = None
    if first["chr_id"] is not None and first["start_pos"] is not None:
        api = db_to_api(first["start_pos"], first["end_pos"])
        chr_name = CHR_ID_TO_NAME.get(first["chr_id"], f"chr{first['chr_id']}")
        coordinates = {
            "seqname": chr_name,
            "start": api["start"],
            "end": api["end"],
            "width": api["width"],
            "strand": first["strand"],
        }

    identity = {
        "gene_symbol": first["gene_symbol"],
        "uniprot_id": first["uniprot_id"],
    }

    tissues = [
        {
            "tissue": row["tissue"],
            "organ_group": row["organ_group"],
            "abundance_ppm": row["abundance_ppm"],
            "coverage": row["coverage"],
            "spectral_count": row["spectral_count"],
        }
        for row in rows
    ]

    data = {
        "coordinates": coordinates,
        "identity": identity,
        "tissues": tissues,
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol},
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
