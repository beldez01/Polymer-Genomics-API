"""Variant Physics Engine — biophysical perturbation from genetic variants.

Takes genomic variants (chr, pos, ref, alt) and returns:
- Delta biophysical properties (stacking energy, curvature, groove width, etc.)
- Nucleosome disruption score
- Non-B DNA motif creation/destruction
- CpG site impact
- Cross-references with pre-computed biophysics and functional annotations
"""

import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from polymer_genomics.constants import CHR_ID_TO_NAME, CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope
from polymer_genomics.sequence import get_sequence
from polymer_genomics.variant_physics import (
    apply_variant,
    compute_variant_deltas,
    DEFAULT_FLANK,
)

router = APIRouter(prefix="/v1/variant", tags=["variant-physics"])

MAX_VARIANTS = 100
FLANK = DEFAULT_FLANK


class VariantInput(BaseModel):
    chr: str = Field(..., description="Chromosome (e.g. 'chr16')")
    pos: int = Field(..., ge=1, description="1-based position")
    ref: str = Field(..., min_length=1, max_length=1000, description="Reference allele")
    alt: str = Field(..., min_length=1, max_length=1000, description="Alternate allele")


class VariantPhysicsRequest(BaseModel):
    build: str = Field("hg38", description="Genome build (hg38 or hg37)")
    variants: list[VariantInput] = Field(..., min_length=1, max_length=MAX_VARIANTS)
    flank: int = Field(FLANK, ge=10, le=500, description="Flanking bp on each side (default 50)")
    cross_reference: bool = Field(True, description="Include DB cross-references (ClinVar, conservation, etc.)")


@router.post("/physics")
async def variant_physics(body: VariantPhysicsRequest):
    """Compute biophysical consequences of genetic variants.

    For each variant, fetches reference sequence, applies the variant,
    computes biophysical properties for both ref and alt, and returns
    the delta (perturbation) for every property. Also detects CpG
    creation/destruction, non-B DNA motif changes, and optionally
    cross-references with pre-computed 1kb biophysics and functional
    annotations.
    """
    start_time = time.monotonic()

    if body.build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {body.build}"}})

    results = []
    errors = []

    for v in body.variants:
        chr_name = v.chr
        if chr_name not in CHR_NAME_TO_ID:
            errors.append({"variant": f"{v.chr}:{v.pos}:{v.ref}>{v.alt}",
                           "error": f"Unknown chromosome: {chr_name}"})
            continue

        # Convert 1-based API position to 0-based internal
        pos_0 = v.pos - 1

        # Fetch reference sequence with flanking
        flank = body.flank
        start = max(0, pos_0 - flank)
        end = pos_0 + len(v.ref) + flank
        try:
            ref_seq = get_sequence(body.build, chr_name, start, end)
        except Exception as e:
            errors.append({"variant": f"{v.chr}:{v.pos}:{v.ref}>{v.alt}",
                           "error": f"Sequence fetch failed: {str(e)}"})
            continue

        # Position of the variant within the fetched window
        var_offset = pos_0 - start

        # Validate ref allele matches
        actual_ref = ref_seq[var_offset:var_offset + len(v.ref)]
        if actual_ref.upper() != v.ref.upper():
            errors.append({"variant": f"{v.chr}:{v.pos}:{v.ref}>{v.alt}",
                           "error": f"Ref mismatch: expected '{v.ref}', found '{actual_ref}'"})
            continue

        # Apply variant
        alt_seq = apply_variant(ref_seq, var_offset, v.ref, v.alt)

        # Compute deltas
        deltas = compute_variant_deltas(ref_seq, alt_seq, variant_pos=var_offset)

        variant_result = {
            "variant": f"{v.chr}:{v.pos}:{v.ref}>{v.alt}",
            "chr": v.chr,
            "pos": v.pos,
            "ref": v.ref,
            "alt": v.alt,
            "window": f"{chr_name}:{start + 1}-{end}",
            "deltas": deltas,
        }

        # Cross-reference with pre-computed 1kb biophysics
        if body.cross_reference:
            xref = await _cross_reference(body.build, chr_name, pos_0)
            variant_result["cross_reference"] = xref

        results.append(variant_result)

    return build_envelope(
        status="complete",
        query={"build": body.build, "n_variants": len(body.variants), "flank": body.flank},
        layers_resolved=[],
        data={
            "variants": results,
            "errors": errors if errors else None,
            "n_computed": len(results),
            "n_errors": len(errors),
        },
        db_time_ms=0,
        _start_time=start_time,
    )


async def _cross_reference(build: str, chr_name: str, pos_0: int) -> dict:
    """Look up pre-computed biophysics and annotations at the variant position."""
    chr_id = CHR_NAME_TO_ID.get(chr_name)
    if chr_id is None:
        return {}

    pool = await get_pool()
    xref: dict = {}

    async with pool.acquire() as conn:
        # 1kb biophysics window
        bp_row = await conn.fetchrow(
            """
            SELECT gc_content, stacking_dg37, melting_temp, curvature,
                   deformability, meth_sensitivity, methylation_capacity,
                   cpg_density, g4_density, correlation_length
            FROM biophysics.sequence_properties b
            JOIN registry.active_layers l ON l.id = b.layer_id
            WHERE l.layer_key = 'sequence_biophysics_l0'
              AND b.build = $1::genome_build
              AND b.chr_id = $2
              AND b.coord @> int4range($3, $3 + 1)
            LIMIT 1
            """,
            build, chr_id, pos_0,
        )
        if bp_row:
            xref["biophysics_1kb"] = {k: (round(float(v), 4) if v is not None else None)
                                       for k, v in dict(bp_row).items()}

        # Conservation
        cons_row = await conn.fetchrow(
            """
            SELECT phylop_mean, phastcons_mean
            FROM conservation.scores c
            JOIN registry.active_layers l ON l.id = c.layer_id
            WHERE l.layer_key = 'phylop_phastcons_100way'
              AND c.build = $1::genome_build
              AND c.chr_id = $2
              AND c.start_pos <= $3 AND c.end_pos > $3
            LIMIT 1
            """,
            build, chr_id, pos_0,
        )
        if cons_row:
            xref["conservation"] = {k: (round(float(v), 4) if v is not None else None)
                                     for k, v in dict(cons_row).items()}

        # ClinVar (exact position match)
        clinvar_rows = await conn.fetch(
            """
            SELECT cv.clinical_significance, cv.review_status, cv.variant_type
            FROM variation.clinvar cv
            JOIN registry.active_layers l ON l.id = cv.layer_id
            WHERE l.layer_key = 'clinvar'
              AND cv.build = $1::genome_build
              AND cv.chr_id = $2
              AND cv.start_pos = $3
            LIMIT 5
            """,
            build, chr_id, pos_0,
        )
        if clinvar_rows:
            xref["clinvar"] = [dict(r) for r in clinvar_rows]

        # Regulatory elements overlapping the position
        reg_rows = await conn.fetch(
            """
            SELECT r.encode_label, r.ccre_class, r.score
            FROM regulatory.ccre r
            JOIN registry.active_layers l ON l.id = r.layer_id
            WHERE l.layer_key = 'encode_ccre_v4'
              AND r.build = $1::genome_build
              AND r.chr_id = $2
              AND r.start_pos <= $3 AND r.end_pos > $3
            LIMIT 5
            """,
            build, chr_id, pos_0,
        )
        if reg_rows:
            xref["regulatory"] = [dict(r) for r in reg_rows]

    return xref
