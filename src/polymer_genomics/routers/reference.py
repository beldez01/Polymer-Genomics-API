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
_sbs_cache: list[dict] | None = None
_clock_meta_cache: list[dict] | None = None
_clock_coeff_cache: dict[str, list[dict]] | None = None


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


# ── SBS Thermodynamic Spectrum ────────────────────────────────────────────

async def _get_sbs_cache() -> list[dict]:
    global _sbs_cache
    if _sbs_cache is not None:
        return _sbs_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT channel, mutation_type, ref_base, alt_base, flanking_5, flanking_3, "
            "trinuc_ref, trinuc_alt, dg_wt, dg_mut, delta_dg, source_citation "
            "FROM mutation.sbs_spectrum ORDER BY mutation_type, channel"
        )

    _sbs_cache = [dict(r) for r in rows]
    return _sbs_cache


@router.get("/sbs-spectrum")
async def get_sbs_spectrum(
    mutation_type: str | None = Query(None, description="Filter by mutation type (e.g. 'C>A')"),
    channel: str | None = Query(None, description="Specific SBS channel (e.g. 'A[C>A]G')"),
):
    """Return SBS thermodynamic spectrum.

    96-channel COSMIC SBS trinucleotide mutation spectrum with nearest-neighbor
    stacking energy perturbation (δΔG) computed from SantaLucia 1998 parameters.
    Positive δΔG = destabilizing mutation.
    """
    start_time = time.monotonic()
    db_start = time.monotonic()
    cache = await _get_sbs_cache()
    db_time = (time.monotonic() - db_start) * 1000

    entries = cache
    if channel:
        channel = channel.upper()
        entries = [e for e in entries if e["channel"] == channel]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"SBS channel '{channel}' not found"}
            })
    elif mutation_type:
        mutation_type = mutation_type.upper()
        entries = [e for e in entries if e["mutation_type"] == mutation_type]
        if not entries:
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"Mutation type '{mutation_type}' not found"}
            })

    return _ref_envelope(
        query={"mutation_type": mutation_type, "channel": channel},
        data={"channels": entries, "n": len(entries)},
        db_time_ms=db_time,
        _start_time=start_time,
    )


# ── Epigenetic Clock Probes ──────────────────────────────────────────────

async def _get_clock_caches() -> tuple[list[dict], dict[str, list[dict]]]:
    global _clock_meta_cache, _clock_coeff_cache
    if _clock_meta_cache is not None and _clock_coeff_cache is not None:
        return _clock_meta_cache, _clock_coeff_cache

    pool = await get_pool()
    async with pool.acquire() as conn:
        meta_rows = await conn.fetch(
            "SELECT clock_name, display_name, n_probes, tissue, outcome, "
            "intercept, age_transform, platform, pmid, source_citation "
            "FROM ref.clock_metadata ORDER BY clock_name"
        )
        coeff_rows = await conn.fetch(
            "SELECT clock_name, probe_id, coefficient, source_citation "
            "FROM ref.clock_coefficients ORDER BY clock_name, probe_id"
        )

    _clock_meta_cache = [dict(r) for r in meta_rows]

    coeff_map: dict[str, list[dict]] = {}
    for r in coeff_rows:
        entry = {
            "probe_id": r["probe_id"],
            "coefficient": r["coefficient"],
            "source": r["source_citation"],
        }
        coeff_map.setdefault(r["clock_name"], []).append(entry)
    _clock_coeff_cache = coeff_map

    return _clock_meta_cache, _clock_coeff_cache


@router.get("/clock-probes")
async def get_clock_probes(
    clock: str | None = Query(None, description="Clock name (e.g. 'horvath_2013')"),
    probe_id: str | None = Query(None, description="Probe ID to check clock membership (e.g. 'cg16867657')"),
):
    """Return epigenetic clock probe coefficients.

    Query by clock name to get all probes for that clock, or by probe_id
    to see which clocks use that probe and its coefficient in each.
    Omit both to list all clocks with metadata.
    """
    start_time = time.monotonic()
    db_start = time.monotonic()
    meta_cache, coeff_cache = await _get_clock_caches()
    db_time = (time.monotonic() - db_start) * 1000

    if clock:
        # Return all probes for a specific clock
        clock = clock.lower()
        meta = [m for m in meta_cache if m["clock_name"] == clock]
        if not meta:
            valid = [m["clock_name"] for m in meta_cache]
            raise HTTPException(404, {
                "error": {"code": "NOT_FOUND",
                          "message": f"Clock '{clock}' not found. Valid: {valid}"}
            })
        probes = coeff_cache.get(clock, [])
        return _ref_envelope(
            query={"clock": clock},
            data={"clock": meta[0], "probes": probes, "n_loaded": len(probes)},
            db_time_ms=db_time,
            _start_time=start_time,
        )

    if probe_id:
        # Return all clocks that use this probe
        probe_id = probe_id.strip()
        memberships = []
        for cname, probes in coeff_cache.items():
            for p in probes:
                if p["probe_id"] == probe_id:
                    clock_meta = next((m for m in meta_cache if m["clock_name"] == cname), {})
                    memberships.append({
                        "clock_name": cname,
                        "display_name": clock_meta.get("display_name"),
                        "coefficient": p["coefficient"],
                        "outcome": clock_meta.get("outcome"),
                    })
        if not memberships:
            return _ref_envelope(
                query={"probe_id": probe_id},
                data={"probe_id": probe_id, "clocks": [], "n": 0,
                      "message": "Probe not found in any loaded clock"},
                db_time_ms=db_time,
                _start_time=start_time,
            )
        return _ref_envelope(
            query={"probe_id": probe_id},
            data={"probe_id": probe_id, "clocks": memberships, "n": len(memberships)},
            db_time_ms=db_time,
            _start_time=start_time,
        )

    # Default: list all clocks with metadata
    return _ref_envelope(
        query={},
        data={"clocks": meta_cache, "n": len(meta_cache)},
        db_time_ms=db_time,
        _start_time=start_time,
    )


# ── Probe-Repeat Overlap ──────────────────────────────────────────────────


@router.get("/probe-repeat-overlap")
async def get_probe_repeat_overlap(
    probe_id: str | None = Query(None, description="Probe ID (e.g. 'cg16867657')"),
    platform: str | None = Query(None, description="Platform filter ('epic_v2', 'epic_v1', '450k')"),
    repeat_class: str | None = Query(None, description="Repeat class filter ('LINE', 'SINE', 'LTR', 'DNA')"),
    repeat_age: str | None = Query(None, description="Repeat age filter ('young', 'intermediate', 'ancient')"),
    limit: int = Query(100, le=10000, description="Maximum results to return"),
):
    """Look up probes that overlap repeat elements.

    Returns the probe-repeat cross-reference: which methylation probes sit
    inside LINE, SINE, LTR, or DNA transposon elements, with evolutionary
    age classification.

    Query by probe_id to check if a specific probe is in a repeat, or
    filter by repeat_class/repeat_age to find all probes in a category.
    """
    start_time = time.monotonic()

    # Build dynamic query
    conditions = []
    params: list = []
    idx = 1

    if probe_id:
        conditions.append(f"probe_id = ${idx}")
        params.append(probe_id.strip())
        idx += 1
    if platform:
        conditions.append(f"platform = ${idx}")
        params.append(platform)
        idx += 1
    if repeat_class:
        conditions.append(f"repeat_class = ${idx}")
        params.append(repeat_class)
        idx += 1
    if repeat_age:
        conditions.append(f"repeat_age = ${idx}::repeat_age_class")
        params.append(repeat_age)
        idx += 1

    where = " AND ".join(conditions) if conditions else "TRUE"
    sql = (
        f"SELECT probe_id, platform, build, chr_id, pos, "
        f"repeat_class, repeat_family, repeat_name, repeat_age, divergence_pct "
        f"FROM probe.repeat_xref WHERE {where} "
        f"ORDER BY probe_id LIMIT ${idx}"
    )
    params.append(limit)

    pool = await get_pool()
    async with pool.acquire() as conn:
        db_start = time.monotonic()
        rows = await conn.fetch(sql, *params)
        db_time = (time.monotonic() - db_start) * 1000

    entries = [dict(r) for r in rows]
    # Convert repeat_age enum to string
    for e in entries:
        if e.get("repeat_age") is not None:
            e["repeat_age"] = str(e["repeat_age"])

    return _ref_envelope(
        query={
            "probe_id": probe_id,
            "platform": platform,
            "repeat_class": repeat_class,
            "repeat_age": repeat_age,
            "limit": limit,
        },
        data={"overlaps": entries, "n": len(entries)},
        db_time_ms=db_time,
        _start_time=start_time,
    )


# ── Validation ──────────────────────────────────────────────────────────────


@router.get("/validation")
async def get_validation_report(
    build: str = Query("hg38", description="Genome build"),
    layer_key: str | None = Query(None, description="Validate a single layer (omit for all)"),
):
    """Run integrity validation checks on data layers.

    Checks row counts, value ranges, and null fractions against per-layer
    specifications.  Returns a report with pass/fail for each check.
    """
    from polymer_genomics.validation.runner import run_layer_validation, run_all_validations

    start_time = time.monotonic()
    pool = await get_pool()
    async with pool.acquire() as conn:
        db_start = time.monotonic()
        if layer_key:
            results = {layer_key: await run_layer_validation(conn, layer_key, build)}
        else:
            results = await run_all_validations(conn, build)
        db_time = (time.monotonic() - db_start) * 1000

    report: dict = {}
    total_checks = 0
    total_passed = 0
    for lk, checks in results.items():
        layer_results = []
        for c in checks:
            total_checks += 1
            if c.passed:
                total_passed += 1
            layer_results.append({
                "check": c.check_name,
                "passed": c.passed,
                "message": c.message,
                "actual": c.actual,
                "expected": c.expected,
            })
        report[lk] = layer_results

    return _ref_envelope(
        query={"build": build, "layer_key": layer_key},
        data={
            "report": report,
            "summary": {
                "total_checks": total_checks,
                "passed": total_passed,
                "failed": total_checks - total_passed,
            },
        },
        db_time_ms=db_time,
        _start_time=start_time,
    )
