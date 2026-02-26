"""Sequence endpoint — serves raw DNA sequence for any genomic region."""

from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.sequence import get_sequence

router = APIRouter(prefix="/v1/sequence", tags=["sequence"])

MAX_SEQUENCE_LENGTH = 100_000  # 100 kb max per request


@router.get("/{build}/{region}")
async def get_sequence_endpoint(
    build: str,
    region: str,
    coords: str = Query("1based"),
):
    """Return the raw DNA sequence for a genomic region.

    The response contains the uppercase nucleotide string plus metadata.
    Coordinates in the response always use 1-based closed convention,
    matching the user-facing format regardless of the ``coords`` query
    parameter used for input.
    """
    start_time = time.monotonic()

    # --- Validate build ---
    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
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
    if chr_name not in CHR_NAME_TO_ID:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown chromosome: {chr_name}"}},
        )

    # --- Convert coordinates ---
    internal = api_to_db(parsed["start"], parsed["end"], coords=coords)
    length = internal["end"] - internal["start"]

    if length <= 0:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_REGION", "message": "Region length must be positive."}},
        )

    if length > MAX_SEQUENCE_LENGTH:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "REGION_TOO_LARGE",
                    "message": (
                        f"Sequence request exceeds maximum of {MAX_SEQUENCE_LENGTH:,}bp. "
                        f"Requested: {length:,}bp."
                    ),
                }
            },
        )

    # --- Fetch sequence ---
    try:
        seq = get_sequence(build, chr_name, internal["start"], internal["end"])
    except FileNotFoundError as e:
        raise HTTPException(
            503,
            {"error": {"code": "FASTA_UNAVAILABLE", "message": str(e)}},
        )
    except (KeyError, ValueError) as e:
        raise HTTPException(
            400,
            {"error": {"code": "SEQUENCE_ERROR", "message": str(e)}},
        )

    elapsed_ms = (time.monotonic() - start_time) * 1000

    return {
        "build": build,
        "chr": chr_name,
        "start": parsed["start"],
        "end": parsed["end"],
        "coordinate_system": "1-based_closed",
        "length": len(seq),
        "sequence": seq,
        "timing": {"query_time_ms": round(elapsed_ms, 1)},
    }
