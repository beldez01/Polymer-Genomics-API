"""Human Protein Atlas tissue expression and subcellular location endpoint."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["protein_atlas"])


@router.get("/{build}/{symbol}/protein-atlas")
async def get_protein_atlas(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve protein_atlas layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'protein_atlas' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No protein_atlas layer for build {build}"}},
            )

        db_start = time.monotonic()

        # Query 1: tissue expression
        tissue_rows = await conn.fetch(
            """
            SELECT tissue, cell_type, expression_level, reliability,
                   chr_id, start_pos, end_pos, strand
            FROM proteomics.tissue_expression
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            ORDER BY CASE expression_level
                WHEN 'High' THEN 1
                WHEN 'Medium' THEN 2
                WHEN 'Low' THEN 3
                ELSE 4
            END, tissue
            """,
            build,
            symbol,
            layer["id"],
        )

        # Query 2: subcellular location
        loc_rows = await conn.fetch(
            """
            SELECT location, reliability, go_id
            FROM proteomics.subcellular_location
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            ORDER BY CASE reliability
                WHEN 'Enhanced' THEN 1
                WHEN 'Supported' THEN 2
                WHEN 'Approved' THEN 3
                ELSE 4
            END
            """,
            build,
            symbol,
            layer["id"],
        )

        db_time = (time.monotonic() - db_start) * 1000

    resolved_alias = None
    if not tissue_rows and not loc_rows:
        async with pool.acquire() as alias_conn:
            canonical = await resolve_alias(alias_conn, symbol)
        if canonical:
            resolved_alias = symbol
            async with pool.acquire() as conn:
                tissue_rows = await conn.fetch(
                    """
                    SELECT tissue, cell_type, expression_level, reliability,
                           chr_id, start_pos, end_pos, strand
                    FROM proteomics.tissue_expression
                    WHERE build = $1::genome_build
                      AND UPPER(gene_symbol) = UPPER($2)
                      AND layer_id = $3
                    ORDER BY CASE expression_level
                        WHEN 'High' THEN 1
                        WHEN 'Medium' THEN 2
                        WHEN 'Low' THEN 3
                        ELSE 4
                    END, tissue
                    """,
                    build, canonical, layer["id"],
                )
                loc_rows = await conn.fetch(
                    """
                    SELECT location, reliability, go_id
                    FROM proteomics.subcellular_location
                    WHERE build = $1::genome_build
                      AND UPPER(gene_symbol) = UPPER($2)
                      AND layer_id = $3
                    ORDER BY CASE reliability
                        WHEN 'Enhanced' THEN 1
                        WHEN 'Supported' THEN 2
                        WHEN 'Approved' THEN 3
                        ELSE 4
                    END
                    """,
                    build, canonical, layer["id"],
                )
        if not tissue_rows and not loc_rows:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in protein_atlas layer for {build}"}},
            )

    # Build coordinates from first tissue_expression row with non-null chr_id
    coordinates = None
    for row in tissue_rows:
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
            break

    data = {
        "coordinates": coordinates,
        "gene_symbol": symbol.upper(),
        "tissue_expression": {
            "n_tissues": len(tissue_rows),
            "tissues": [
                {
                    "tissue": row["tissue"],
                    "cell_type": row["cell_type"],
                    "expression_level": row["expression_level"],
                    "reliability": row["reliability"],
                }
                for row in tissue_rows
            ],
        },
        "subcellular_location": {
            "n_locations": len(loc_rows),
            "locations": [
                {
                    "location": row["location"],
                    "reliability": row["reliability"],
                    "go_id": row["go_id"],
                }
                for row in loc_rows
            ],
        },
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
