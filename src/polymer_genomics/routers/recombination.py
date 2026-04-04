"""Recombination landscape endpoint.

Returns oNCO events, DMC1 hotspot peaks, and CO/NCO/DSB rates for a region
in a single call.
"""

import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.queries.recombination import (
    _convert_dmc1_hotspots,
    _convert_onco_events,
    _convert_recombination_rates,
)

router = APIRouter(prefix="/v1/recombination", tags=["recombination"])


@router.get("/{build}/{region}")
async def query_recombination(
    build: str,
    region: str,
    parent_type: str | None = Query(None, description="Filter oNCO by parent: M or P"),
    limit: int = Query(5000, ge=1, le=50000),
):
    """Query the recombination landscape for a genomic region.

    Returns three layers in one call:
    - **onco_events**: Individual observed NCO events (Palsson 2025)
    - **dmc1_hotspots**: Meiotic DSB hotspot peaks (Pratto 2014)
    - **recombination_rates**: CO, NCO, DSB rates at 1kb resolution (Palsson 2025)
    """
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
            {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown: {chr_name}"}},
        )

    internal = api_to_db(parsed["start"], parsed["end"])

    pool = await get_pool()
    db_start = time.monotonic()

    async with pool.acquire() as conn:
        # oNCO events
        parent_clause = ""
        params_onco = [build, chr_id, internal["start"], internal["end"], limit]
        if parent_type and parent_type in ("M", "P"):
            parent_clause = "AND o.parent_type = $6"
            params_onco.append(parent_type)

        onco_rows = await conn.fetch(
            f"""
            SELECT o.start_pos, o.end_pos,
                   o.parent_type, o.event_id,
                   o.n_mpps, o.n_gc_mpps,
                   o.end_pos - o.start_pos AS event_width
            FROM recombination.onco_events o
            WHERE o.build = $1
              AND o.chr_id = $2
              AND o.start_pos < $4
              AND o.end_pos > $3
              {parent_clause}
            ORDER BY o.start_pos
            LIMIT $5
            """,
            *params_onco,
        )

        # DMC1 hotspots
        dmc1_rows = await conn.fetch(
            """
            SELECT d.start_pos, d.end_pos,
                   d.mean_strength,
                   d.end_pos - d.start_pos AS peak_width
            FROM recombination.dmc1_hotspots d
            WHERE d.build = $1
              AND d.chr_id = $2
              AND d.start_pos < $4
              AND d.end_pos > $3
            ORDER BY d.start_pos
            LIMIT $5
            """,
            build, chr_id, internal["start"], internal["end"], limit,
        )

        # Recombination rates from biophysics (1kb bins)
        rate_rows = await conn.fetch(
            """
            SELECT b.start_pos, b.end_pos,
                   b.co_rate_cmmb, b.nco_rate, b.dsb_rate,
                   b.mat_co_rate, b.mat_nco_rate,
                   b.pat_co_rate, b.pat_nco_rate
            FROM biophysics.sequence_properties b
            WHERE b.build = $1::genome_build
              AND b.chr_id = $2
              AND b.start_pos >= $3
              AND b.start_pos < $4
              AND b.co_rate_cmmb IS NOT NULL
            ORDER BY b.start_pos
            LIMIT $5
            """,
            build, chr_id, internal["start"], internal["end"], limit,
        )

    db_time = (time.monotonic() - db_start) * 1000

    data = {
        "onco_events": _convert_onco_events(onco_rows, chr_name),
        "dmc1_hotspots": _convert_dmc1_hotspots(dmc1_rows, chr_name),
        "recombination_rates": _convert_recombination_rates(rate_rows, chr_name),
    }

    layers_resolved = [
        {
            "layer_key": "onco_events_v1",
            "source": "Palsson et al. 2025 Nature 639:700-707",
            "evidence_class": "M",
            "status": "ok",
        },
        {
            "layer_key": "dmc1_hotspots_v1",
            "source": "Pratto et al. 2014 Science 346:1256442",
            "evidence_class": "M",
            "status": "ok",
        },
        {
            "layer_key": "recombination_rates",
            "source": "Palsson 2025 + Halldorsson 2019",
            "evidence_class": "M",
            "status": "ok",
        },
    ]

    return build_envelope(
        status="complete",
        query={"build": build, "region": region, "parent_type": parent_type},
        layers_resolved=layers_resolved,
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
