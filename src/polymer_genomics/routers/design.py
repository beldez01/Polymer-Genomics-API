"""Construct design endpoints — Module 5 of the Design Tools suite.

Evaluates multi-part DNA constructs (promoter + insert + terminator + backbone)
with per-part physics, junction analysis, and assembly flags.

No database access required — pure sequence computation.
"""

import asyncio
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from polymer_genomics.construct import (
    evaluate_construct,
    compare_constructs,
    VALID_ROLES,
    MAX_PARTS,
)

router = APIRouter(prefix="/v1/design", tags=["design"])


class ConstructPart(BaseModel):
    """A single part of a DNA construct."""

    name: str = Field(
        ...,
        max_length=200,
        description="Label for this part (e.g., 'CMV_promoter', 'GFP_insert').",
    )
    sequence: str = Field(
        ...,
        min_length=10,
        max_length=100_000,
        description="DNA sequence (ACGT, Ns tolerated). 10-100,000 bp.",
    )
    role: str = Field(
        "generic",
        description=(
            "Functional role: promoter, cds, utr5, utr3, terminator, "
            "backbone, linker, spacer, or generic."
        ),
    )


class ConstructRequest(BaseModel):
    """Request body for construct evaluation."""

    parts: list[ConstructPart] = Field(
        ...,
        min_length=1,
        max_length=MAX_PARTS,
        description=f"Ordered list of construct parts (1-{MAX_PARTS}).",
    )
    name: str = Field(
        "construct",
        max_length=200,
        description="Label for the construct.",
    )
    circular: bool = Field(
        False,
        description="True for plasmid (evaluates closing junction), False for linear.",
    )
    salt_mm: float = Field(
        150.0,
        ge=1.0,
        le=5000.0,
        description="NaCl concentration in mM. 150 = physiological (default), 1000 = standard.",
    )
    analysis: str = Field(
        "full",
        pattern="^(full|thermodynamic|structural)$",
        description="Analysis type: 'full' (default), 'thermodynamic', or 'structural'.",
    )


class ConstructCompareItem(BaseModel):
    """A single construct in a comparison request."""

    name: str = Field(
        "construct",
        max_length=200,
        description="Label for this construct design.",
    )
    parts: list[ConstructPart] = Field(
        ...,
        min_length=1,
        max_length=MAX_PARTS,
        description="Ordered list of construct parts.",
    )
    circular: bool = Field(
        False,
        description="True for plasmid, False for linear.",
    )


class ConstructCompareRequest(BaseModel):
    """Request body for construct comparison."""

    constructs: list[ConstructCompareItem] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Two or more construct designs to compare (2-10).",
    )
    salt_mm: float = Field(
        150.0,
        ge=1.0,
        le=5000.0,
        description="NaCl concentration in mM.",
    )
    analysis: str = Field(
        "full",
        pattern="^(full|thermodynamic|structural)$",
        description="Analysis type.",
    )


@router.post("/construct")
async def design_construct(body: ConstructRequest):
    """Evaluate a multi-part DNA construct.

    Accepts an ordered list of construct parts (promoter, insert, terminator,
    backbone, etc.) and returns:

    - **Per-part evaluation**: full biophysical assessment of each part
      (thermodynamics, structural properties, CpG islands, flags)
    - **Junction analysis**: biophysical properties of the ~50 bp around each
      part-to-part junction
    - **Assembly flags**: construct-level warnings for cloning and synthesis:
      - Internal restriction sites (EcoRI, BamHI, HindIII, XbaI, SalI, NotI)
      - Homopolymer runs >6 bp at junctions
      - Direct repeats >12 bp between parts (recombination risk)
      - Extreme GC windows (<25% or >75% in any 100 bp window)
      - CpG islands spanning junctions (silencing risk)

    **Use cases:**
    - Pre-screen a plasmid design before ordering synthesis
    - Identify problematic junctions in a multi-part assembly
    - Flag internal restriction sites that interfere with cloning
    - Detect recombination-prone repeats across construct parts
    """
    start_time = time.monotonic()

    parts_dicts = [
        {"name": p.name, "sequence": p.sequence, "role": p.role}
        for p in body.parts
    ]

    try:
        result = await asyncio.to_thread(
            evaluate_construct,
            parts=parts_dicts,
            name=body.name,
            circular=body.circular,
            salt_mm=body.salt_mm,
            analysis=body.analysis,
        )
    except ValueError as e:
        raise HTTPException(400, {"error": {"code": "INVALID_CONSTRUCT", "message": str(e)}})

    compute_ms = round((time.monotonic() - start_time) * 1000, 1)
    result["timing"] = {"compute_time_ms": compute_ms}
    result["status"] = "complete"

    return result


@router.post("/construct/compare")
async def compare_construct_designs(body: ConstructCompareRequest):
    """Compare two or more construct designs side-by-side.

    Evaluates each construct independently and returns a comparison table with
    deltas against the first (reference) construct. Useful for choosing between
    alternative promoters, codon variants, or backbone designs.

    Returns per-construct evaluations plus a delta table:
    - delta_length: difference in total length
    - delta_gc: difference in GC content
    - delta_assembly_warnings: difference in assembly warning count
    - delta_part_warnings: difference in per-part warning count

    **Use cases:**
    - Compare two backbone variants (e.g., pUC19 vs pBR322)
    - Evaluate alternative promoter + insert combinations
    - Assess the impact of codon optimization on construct physics
    """
    start_time = time.monotonic()

    constructs_dicts = [
        {
            "name": c.name,
            "parts": [
                {"name": p.name, "sequence": p.sequence, "role": p.role}
                for p in c.parts
            ],
            "circular": c.circular,
        }
        for c in body.constructs
    ]

    try:
        result = await asyncio.to_thread(
            compare_constructs,
            constructs=constructs_dicts,
            salt_mm=body.salt_mm,
            analysis=body.analysis,
        )
    except ValueError as e:
        raise HTTPException(400, {"error": {"code": "INVALID_CONSTRUCT", "message": str(e)}})

    compute_ms = round((time.monotonic() - start_time) * 1000, 1)
    result["timing"] = {"compute_time_ms": compute_ms}
    result["status"] = "complete"

    return result
