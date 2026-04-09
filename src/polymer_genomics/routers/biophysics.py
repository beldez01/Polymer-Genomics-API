"""Computed biophysics endpoint.

Fetches DNA sequence for a genomic region and computes per-dinucleotide
biophysical properties (thermodynamics, extinction, form propensity, groove
geometry) using published lookup tables. Returns GRanges-format JSON.
"""

import asyncio
import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.biophysics import (
    compute_contextual,
    compute_curvature,
    compute_extinction,
    compute_form_propensity,
    compute_groove_profile,
    compute_structural,
    compute_thermodynamics,
    detect_motifs,
)
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.envelope import build_envelope
from polymer_genomics.sequence import get_sequence

router = APIRouter(prefix="/v1/biophysics", tags=["biophysics"])

MAX_BIOPHYSICS_LENGTH = 1_000_000  # 1 Mb max (contextual features are O(n), fast)

_VALID_PROPERTIES = {
    "thermodynamics", "extinction", "form_propensity", "groove",
    "structural", "contextual", "curvature", "motifs",
}


@router.get("/{build}/{region}")
async def compute_region_biophysics(
    build: str,
    region: str,
    duplex_type: str = Query("dna_dna", description="Duplex type for NN params (only 'dna_dna' for genomic DNA)"),
    salt_mm: float = Query(1000.0, description="NaCl concentration in mM (1000 = standard, 150 = physiological)"),
    properties: str = Query("all", description="Comma-separated: thermodynamics,extinction,groove,form_propensity or 'all'"),
):
    """Compute sequence-derived biophysical properties for a genomic region.

    Fetches the DNA sequence and applies published lookup tables to compute
    per-dinucleotide profiles. Each dinucleotide step becomes one range element
    in the GRanges output (2 bp wide).

    Property groups: thermodynamics, extinction, form_propensity, groove,
    structural (roll/tilt/twist/rise/slide/shift + deformability),
    contextual (bubble propensity, context deviation, local flexibility),
    curvature (windowed roll/tilt accumulation),
    motifs (G-quadruplex, Z-DNA, homopolymers, inverted repeats).

    Maximum 1,000,000 bp per request.
    """
    start_time = time.monotonic()

    # --- Validate build ---
    if build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}})

    # --- Parse region ---
    try:
        parsed = parse_region(region)
    except ValueError as e:
        raise HTTPException(400, {"error": {"code": "INVALID_REGION", "message": str(e)}})

    chr_name = parsed["chr"]
    if chr_name not in CHR_NAME_TO_ID:
        raise HTTPException(400, {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown chromosome: {chr_name}"}})

    # --- Convert coordinates ---
    internal = api_to_db(parsed["start"], parsed["end"])
    length = internal["end"] - internal["start"]

    if length <= 0:
        raise HTTPException(400, {"error": {"code": "INVALID_REGION", "message": "Region length must be positive."}})

    if length > MAX_BIOPHYSICS_LENGTH:
        raise HTTPException(400, {
            "error": {
                "code": "REGION_TOO_LARGE",
                "message": f"Biophysics request exceeds maximum of {MAX_BIOPHYSICS_LENGTH:,} bp. Requested: {length:,} bp.",
            }
        })

    # --- Validate properties ---
    if properties == "all":
        requested = _VALID_PROPERTIES
    else:
        requested = set(properties.split(","))
        invalid = requested - _VALID_PROPERTIES
        if invalid:
            raise HTTPException(400, {
                "error": {
                    "code": "INVALID_PROPERTIES",
                    "message": f"Invalid properties: {invalid}. Valid: {sorted(_VALID_PROPERTIES)}",
                }
            })

    # --- Fetch sequence ---
    try:
        seq = await asyncio.to_thread(get_sequence, build, chr_name, internal["start"], internal["end"])
    except FileNotFoundError as e:
        raise HTTPException(503, {"error": {"code": "FASTA_UNAVAILABLE", "message": str(e)}})
    except (KeyError, ValueError) as e:
        raise HTTPException(400, {"error": {"code": "SEQUENCE_ERROR", "message": str(e)}})

    seq_time = time.monotonic()

    # --- Compute properties ---
    results: dict = {}
    motifs_result: dict | None = None
    if "thermodynamics" in requested:
        results["thermodynamics"] = compute_thermodynamics(seq, salt_mm=salt_mm)
    if "extinction" in requested:
        results["extinction"] = compute_extinction(seq)
    if "form_propensity" in requested:
        results["form_propensity"] = compute_form_propensity(seq)
    if "groove" in requested:
        results["groove"] = compute_groove_profile(seq)
    if "structural" in requested:
        results["structural"] = compute_structural(seq)
    if "contextual" in requested:
        results["contextual"] = compute_contextual(seq)
    if "curvature" in requested:
        results["curvature"] = compute_curvature(seq)
    if "motifs" in requested:
        motifs_result = detect_motifs(seq)

    # --- Build GRanges output ---
    # Each dinucleotide step = one range element (2 bp, 1-based closed)
    n_steps = len(seq) - 1 if len(seq) >= 2 else 0
    api_start = parsed["start"]  # 1-based

    seqnames = [chr_name] * n_steps
    starts = [api_start + i for i in range(n_steps)]
    ends = [api_start + i + 1 for i in range(n_steps)]
    strand = ["*"] * n_steps

    # Merge per-step data into mcols
    mcols: dict[str, list] = {"dinucleotide": [seq[i:i + 2] for i in range(n_steps)]}

    for prop_name, prop_data in results.items():
        per_step = prop_data.get("per_step", [])
        if len(per_step) == n_steps:
            # All steps present — extract columnar data
            for key in per_step[0]:
                if key == "dinucleotide":
                    continue
                col_name = f"{prop_name}_{key}" if prop_name != "thermodynamics" else key
                mcols[col_name] = [step[key] for step in per_step]

    # Summaries
    summaries = {k: v.get("summary", {}) for k, v in results.items()}

    compute_time = (time.monotonic() - seq_time) * 1000

    data = {
        "seqnames": seqnames,
        "ranges": {"start": starts, "end": ends},
        "strand": strand,
        "mcols": mcols,
        "summaries": summaries,
        "n_steps": n_steps,
        "sequence_length": len(seq),
    }
    if motifs_result is not None:
        data["motifs"] = motifs_result

    return build_envelope(
        status="complete",
        query={
            "build": build,
            "region": region,
            "duplex_type": duplex_type,
            "salt_mm": salt_mm,
            "properties": sorted(requested),
        },
        layers_resolved=[],
        data=data,
        db_time_ms=round(compute_time, 1),
        _start_time=start_time,
    )
