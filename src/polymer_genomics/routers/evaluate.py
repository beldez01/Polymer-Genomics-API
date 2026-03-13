"""Sequence evaluation endpoint — the physics linter.

Accepts an arbitrary DNA sequence (not a genomic coordinate) and returns a
structured biophysical assessment. This is the core product surface for
synthetic biology, AI scientist agents, and genetic circuit designers.

No database access required — pure sequence computation.
"""

import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from polymer_genomics.evaluate import evaluate_sequence, MAX_EVALUATE_LENGTH, MIN_EVALUATE_LENGTH

router = APIRouter(prefix="/v1", tags=["evaluate"])


class EvaluateRequest(BaseModel):
    """Request body for sequence evaluation."""
    sequence: str = Field(
        ...,
        min_length=MIN_EVALUATE_LENGTH,
        max_length=MAX_EVALUATE_LENGTH,
        description="DNA sequence (ACGT, Ns tolerated). 10–100,000 bp.",
    )
    name: str = Field(
        "unnamed",
        max_length=200,
        description="Label for this sequence.",
    )
    analysis: str = Field(
        "full",
        pattern="^(full|thermodynamic|structural)$",
        description="Analysis type: 'full' (default), 'thermodynamic', or 'structural'.",
    )
    salt_mm: float = Field(
        1000.0,
        ge=1.0,
        le=5000.0,
        description="NaCl concentration in mM. 1000 = standard (SantaLucia), 150 = physiological.",
    )
    window_size: int = Field(
        100,
        ge=20,
        le=10000,
        description="Window size in bp for windowed profiles (default 100).",
    )


class CompareRequest(BaseModel):
    """Request body for multi-sequence comparison."""
    sequences: dict[str, str] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Named sequences to compare. Keys are labels, values are DNA sequences. 2–10 sequences.",
    )
    analysis: str = Field(
        "full",
        pattern="^(full|thermodynamic|structural)$",
        description="Analysis type.",
    )
    salt_mm: float = Field(
        1000.0,
        ge=1.0,
        le=5000.0,
        description="NaCl concentration in mM.",
    )
    window_size: int = Field(
        100,
        ge=20,
        le=10000,
        description="Window size in bp.",
    )


@router.post("/evaluate")
async def evaluate_design(body: EvaluateRequest):
    """Evaluate the biophysical properties of a DNA sequence.

    Takes any DNA sequence (10–100,000 bp) and returns a comprehensive
    biophysical assessment including thermodynamic stability, structural
    properties, CpG islands, and flagged regions of concern.

    This is a **pure computation** endpoint — no database or reference genome
    needed. The sequence is analyzed directly using published biophysical
    lookup tables (SantaLucia 1998, Tataurov 2008, El Hassan & Calladine
    1996/1997, Ho 1986, Gardiner-Garden & Frommer 1987).

    **Use cases:**
    - Evaluate a synthetic construct before ordering synthesis
    - Flag CpG islands that may cause silencing in mammalian cells
    - Assess thermodynamic stability uniformity across a construct
    - Detect homopolymer runs and dinucleotide repeats (synthesis difficulty)
    - Compare windowed GC and stacking energy profiles
    """
    start_time = time.monotonic()

    try:
        result = evaluate_sequence(
            seq=body.sequence,
            name=body.name,
            analysis=body.analysis,
            salt_mm=body.salt_mm,
            window_size=body.window_size,
        )
    except ValueError as e:
        raise HTTPException(400, {"error": {"code": "INVALID_SEQUENCE", "message": str(e)}})

    compute_ms = round((time.monotonic() - start_time) * 1000, 1)
    result["timing"] = {"compute_time_ms": compute_ms}
    result["status"] = "complete"

    return result


@router.post("/compare")
async def compare_sequences(body: CompareRequest):
    """Compare biophysical properties of multiple DNA sequences.

    Accepts 2–10 named sequences and returns per-sequence evaluations plus
    a delta table comparing each sequence against the first (reference).

    **Use cases:**
    - Compare codon-optimized variants against wildtype
    - Evaluate multiple promoter candidates side-by-side
    - Assess the biophysical impact of mutations or redesigns
    """
    start_time = time.monotonic()

    names = list(body.sequences.keys())
    results: dict[str, dict] = {}
    errors: dict[str, str] = {}

    # Evaluate each sequence
    for name, seq in body.sequences.items():
        try:
            results[name] = evaluate_sequence(
                seq=seq,
                name=name,
                analysis=body.analysis,
                salt_mm=body.salt_mm,
                window_size=body.window_size,
            )
        except ValueError as e:
            errors[name] = str(e)

    if errors:
        raise HTTPException(400, {
            "error": {
                "code": "INVALID_SEQUENCES",
                "message": f"Errors in {len(errors)} sequence(s)",
                "details": errors,
            }
        })

    # Build comparison table
    reference_name = names[0]
    ref = results[reference_name]

    comparison: dict[str, dict] = {}
    for name in names:
        r = results[name]
        comparison[name] = {
            "length_bp": r["length_bp"],
            "gc_content": r["summary"]["gc_content"],
            "mean_stacking_dG37": r["summary"].get("mean_stacking_dG37_kcal", None),
            "cpg_island_count": r["summary"]["cpg_island_count"],
            "melting_temp_C": r["summary"]["melting_temp_estimate_C"],
            "flag_count": r["flag_counts"]["total"],
            "warning_count": r["flag_counts"]["warnings"],
        }

    # Compute deltas against reference
    deltas: dict[str, dict] = {}
    for name in names[1:]:
        r = results[name]
        delta: dict = {
            "delta_length": r["length_bp"] - ref["length_bp"],
            "delta_gc": round(
                r["summary"]["gc_content"] - ref["summary"]["gc_content"], 4
            ),
            "delta_cpg_islands": (
                r["summary"]["cpg_island_count"] - ref["summary"]["cpg_island_count"]
            ),
            "delta_melting_temp_C": round(
                r["summary"]["melting_temp_estimate_C"]
                - ref["summary"]["melting_temp_estimate_C"],
                1,
            ),
            "delta_warnings": (
                r["flag_counts"]["warnings"] - ref["flag_counts"]["warnings"]
            ),
        }
        # Stacking energy delta
        ref_dg = ref["summary"].get("mean_stacking_dG37_kcal")
        r_dg = r["summary"].get("mean_stacking_dG37_kcal")
        if ref_dg is not None and r_dg is not None:
            delta["delta_mean_dG37"] = round(r_dg - ref_dg, 4)

        # Flag differences
        ref_codes = {f"{f['code']}@{f['region']}" for f in ref["flags"]}
        r_codes = {f"{f['code']}@{f['region']}" for f in r["flags"]}
        delta["flags_added"] = sorted(r_codes - ref_codes)
        delta["flags_removed"] = sorted(ref_codes - r_codes)

        deltas[name] = delta

    compute_ms = round((time.monotonic() - start_time) * 1000, 1)

    return {
        "status": "complete",
        "n_sequences": len(names),
        "reference": reference_name,
        "comparison": comparison,
        "deltas_vs_reference": deltas,
        "evaluations": results,
        "timing": {"compute_time_ms": compute_ms},
    }
