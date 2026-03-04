"""Biophysical reference constants lookup endpoints.

Serves canonical published values from the ``reference`` schema — small,
immutable lookup tables of physical/chemical constants for nucleic acids
and proteins. Data is cached in-memory on first request.
"""

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/reference", tags=["reference"])

# ── In-memory caches (populated once, never invalidated) ──────────────────

_nn_cache: dict[str, list[dict]] | None = None
_dinuc_cache: list[dict] | None = None
_aa_cache: list[dict] | None = None
_constants_cache: list[dict] | None = None


def _ref_envelope(
    *, query: dict, data: Any, db_time_ms: float, _start_time: float,
) -> dict:
    """Build envelope for reference endpoints (no coordinate system, no layers)."""
    return build_envelope(
        status="complete",
        query=query,
        layers_resolved=[],
        data=data,
        db_time_ms=round(db_time_ms, 1),
        _start_time=_start_time,
    )


# ── NN Thermodynamics ─────────────────────────────────────────────────────

async def _get_nn_cache() -> dict[str, list[dict]]:
    global _nn_cache
    if _nn_cache is not None:
        return _nn_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT duplex_type, dinucleotide, delta_h, delta_s, delta_g_37, "
            "source_citation FROM reference.nn_thermodynamics ORDER BY duplex_type, dinucleotide"
        )

    cache: dict[str, list[dict]] = {}
    for r in rows:
        entry = {
            "dinucleotide": r["dinucleotide"],
            "delta_h": r["delta_h"],
            "delta_s": r["delta_s"],
            "delta_g_37": r["delta_g_37"],
            "source": r["source_citation"],
        }
        cache.setdefault(r["duplex_type"], []).append(entry)

    _nn_cache = cache
    return _nn_cache


@router.get("/nn-parameters")
async def get_nn_parameters(
    duplex_type: str = Query("dna_dna", description="'dna_dna', 'rna_rna', or 'rna_dna'"),
    dinucleotide: str | None = Query(None, description="Specific dinucleotide (e.g. 'CG')"),
):
    """Return nearest-neighbor thermodynamic parameters.

    ΔH (kcal/mol), ΔS (cal/mol·K), ΔG₃₇ (kcal/mol) per dinucleotide step
    in 1 M NaCl at 37°C.
    """
    start_time = time.monotonic()
    db_start = time.monotonic()
    cache = await _get_nn_cache()
    db_time = (time.monotonic() - db_start) * 1000

    valid_types = list(cache.keys())
    if duplex_type not in cache:
        raise HTTPException(400, {
            "error": {"code": "INVALID_DUPLEX_TYPE",
                      "message": f"Invalid duplex_type '{duplex_type}'. Valid: {valid_types}"}
        })

    entries = cache[duplex_type]
    if dinucleotide:
        dinucleotide = dinucleotide.upper()
        entries = [e for e in entries if e["dinucleotide"] == dinucleotide]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"Dinucleotide '{dinucleotide}' not found for {duplex_type}"}
            })

    return _ref_envelope(
        query={"duplex_type": duplex_type, "dinucleotide": dinucleotide},
        data={"parameters": entries, "n": len(entries)},
        db_time_ms=db_time,
        _start_time=start_time,
    )


# ── Dinucleotide Properties ───────────────────────────────────────────────

async def _get_dinuc_cache() -> list[dict]:
    global _dinuc_cache
    if _dinuc_cache is not None:
        return _dinuc_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT dinucleotide, extinction_coeff_260, a_form_propensity, "
            "z_form_propensity, major_groove_width, major_groove_depth, "
            "minor_groove_width, minor_groove_depth, source_citation "
            "FROM reference.dinucleotide_properties ORDER BY dinucleotide"
        )

    _dinuc_cache = [dict(r) for r in rows]
    return _dinuc_cache


@router.get("/dinucleotide-properties")
async def get_dinucleotide_properties(
    dinucleotide: str | None = Query(None, description="Specific dinucleotide (e.g. 'CG')"),
    property_set: str = Query("all", description="'all', 'extinction', 'groove', or 'form_propensity'"),
):
    """Return per-dinucleotide biophysical properties.

    Extinction coefficients (Tataurov 2008), A/Z-form propensity, and
    groove geometry per dinucleotide step.
    """
    start_time = time.monotonic()
    db_start = time.monotonic()
    cache = await _get_dinuc_cache()
    db_time = (time.monotonic() - db_start) * 1000

    entries = cache
    if dinucleotide:
        dinucleotide = dinucleotide.upper()
        entries = [e for e in entries if e["dinucleotide"] == dinucleotide]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"Dinucleotide '{dinucleotide}' not found"}
            })

    # Filter columns by property_set
    if property_set != "all":
        keep_keys = {"dinucleotide", "source_citation"}
        if property_set == "extinction":
            keep_keys.add("extinction_coeff_260")
        elif property_set == "groove":
            keep_keys |= {"major_groove_width", "major_groove_depth",
                          "minor_groove_width", "minor_groove_depth"}
        elif property_set == "form_propensity":
            keep_keys |= {"a_form_propensity", "z_form_propensity"}
        else:
            raise HTTPException(400, {
                "error": {"code": "INVALID_PROPERTY_SET",
                          "message": f"Invalid property_set '{property_set}'. "
                                     "Valid: all, extinction, groove, form_propensity"}
            })
        entries = [{k: v for k, v in e.items() if k in keep_keys} for e in entries]

    return _ref_envelope(
        query={"dinucleotide": dinucleotide, "property_set": property_set},
        data={"properties": entries, "n": len(entries)},
        db_time_ms=db_time,
        _start_time=start_time,
    )


# ── Amino Acid Properties ────────────────────────────────────────────────

async def _get_aa_cache() -> list[dict]:
    global _aa_cache
    if _aa_cache is not None:
        return _aa_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT one_letter, three_letter, full_name, mw_da, volume_a3, sasa_a2, "
            "kd_hydrophobicity, ww_hydrophobicity, eisenberg_hydrophobicity, "
            "pka_side_chain, charge_at_ph7, ecpa_b20, source_citation "
            "FROM reference.amino_acid_properties ORDER BY one_letter"
        )

    _aa_cache = [dict(r) for r in rows]
    return _aa_cache


@router.get("/amino-acid-properties")
async def get_amino_acid_properties(
    residue: str | None = Query(None, description="One-letter amino acid code (e.g. 'M')"),
    scale: str = Query("all", description="Hydrophobicity scale: 'kd', 'ww', 'eisenberg', or 'all'"),
):
    """Return amino acid biophysical reference properties.

    Molecular weight, volume (Zamyatnin), SASA, hydrophobicity (3 scales),
    pKa, and biosynthetic cost (Akashi-Gojobori) per residue.
    """
    start_time = time.monotonic()
    db_start = time.monotonic()
    cache = await _get_aa_cache()
    db_time = (time.monotonic() - db_start) * 1000

    entries = cache
    if residue:
        residue = residue.upper()
        entries = [e for e in entries if e["one_letter"] == residue]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"Amino acid '{residue}' not found"}
            })

    # Filter hydrophobicity scale columns
    if scale != "all":
        valid_scales = {"kd": "kd_hydrophobicity", "ww": "ww_hydrophobicity",
                        "eisenberg": "eisenberg_hydrophobicity"}
        if scale not in valid_scales:
            raise HTTPException(400, {
                "error": {"code": "INVALID_SCALE",
                          "message": f"Invalid scale '{scale}'. Valid: all, kd, ww, eisenberg"}
            })
        drop_keys = set(valid_scales.values()) - {valid_scales[scale]}
        entries = [{k: v for k, v in e.items() if k not in drop_keys} for e in entries]

    return _ref_envelope(
        query={"residue": residue, "scale": scale},
        data={"amino_acids": entries, "n": len(entries)},
        db_time_ms=db_time,
        _start_time=start_time,
    )


# ── Physical Constants ────────────────────────────────────────────────────

async def _get_constants_cache() -> list[dict]:
    global _constants_cache
    if _constants_cache is not None:
        return _constants_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT name, symbol, value, units, category, description, context, "
            "source_citation FROM reference.physical_constants ORDER BY category, name"
        )

    _constants_cache = [dict(r) for r in rows]
    return _constants_cache


@router.get("/physical-constants")
async def get_physical_constants(
    name: str | None = Query(None, description="Exact constant name (e.g. 'lp_bdna_physiological_nm')"),
    category: str | None = Query(None, description="Filter by category (e.g. 'mechanics', 'kinetics')"),
):
    """Return scalar biophysical constants.

    Persistence length, Manning parameters, elastic moduli, polymerase rates,
    ribosome speed, and other canonical values with units and provenance.
    """
    start_time = time.monotonic()
    db_start = time.monotonic()
    cache = await _get_constants_cache()
    db_time = (time.monotonic() - db_start) * 1000

    entries = cache
    if name:
        entries = [e for e in entries if e["name"] == name]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"Constant '{name}' not found"}
            })
    if category:
        entries = [e for e in entries if e["category"] == category]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"No constants in category '{category}'"}
            })

    return _ref_envelope(
        query={"name": name, "category": category},
        data={"constants": entries, "n": len(entries)},
        db_time_ms=db_time,
        _start_time=start_time,
    )
