"""Clock Physics module — biophysical context for epigenetic clock probes.

Wires together clock coefficients, probe coordinates, and pre-computed
biophysics to answer: *what are the physical properties of the DNA
at the sites that track biological aging?*
"""

import time
from statistics import mean, stdev

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/clock-physics", tags=["clock-physics"])

# Re-use the canonical biophysics column list from the probes module.
_BIOPHYSICS_COLS = (
    "gc_content", "stacking_dg37", "melting_temp", "curvature",
    "groove_width", "dipole_density", "periodicity_power",
    "mgw_mean", "prot_mean", "roll_mean", "helt_mean",
    "delta_mgw", "delta_prot", "delta_roll", "delta_helt",
    "melting_cooperativity", "bubble_propensity", "melting_width",
    "cpg_count", "cpg_density", "cpg_obs_exp",
    "meth_delta_g", "meth_delta_tm", "meth_sensitivity",
    "methylation_capacity", "demethylation_cost", "oxidation_depth", "taut_relaxed",
    "correlation_length", "integrated_response", "perturbation_reach", "response_asymmetry",
    "deformability", "g4_density", "g4_max_score",
    "kmer_complexity", "dinucleotide_entropy", "dominant_period",
    "phylop_241way_mean", "phastcons_241way_mean",
    "b_score_mean", "recomb_rate_cmmb", "mutation_rate_mean",
)

# Columns highlighted in the summary statistics.
_SUMMARY_COLS = (
    "gc_content", "stacking_dg37", "melting_temp", "curvature",
    "meth_sensitivity", "methylation_capacity", "deformability",
    "cpg_density", "correlation_length", "g4_density",
    "bubble_propensity", "phylop_241way_mean",
)

# Valid clock names (populated lazily from DB).
_VALID_CLOCKS: list[str] | None = None


def _safe_round(v, n=4):
    return round(v, n) if v is not None else None


# ── List clocks ──────────────────────────────────────────────────────────


@router.get("/{build}")
async def list_clock_physics(build: str):
    """List all available clocks with probe counts and summary metadata."""
    start_time = time.monotonic()
    if build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}})

    pool = await get_pool()
    async with pool.acquire() as conn:
        db_start = time.monotonic()
        rows = await conn.fetch(
            "SELECT clock_name, display_name, n_probes, tissue, outcome, "
            "platform, pmid FROM ref.clock_metadata ORDER BY clock_name"
        )
        db_time = (time.monotonic() - db_start) * 1000

    clocks = [dict(r) for r in rows]
    return build_envelope(
        status="complete",
        query={"build": build},
        layers_resolved=[],
        data={"clocks": clocks, "n": len(clocks),
              "description": "Use GET /v1/clock-physics/{build}/{clock} for full biophysical profiles"},
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


# ── Single clock physics profile ─────────────────────────────────────────


@router.get("/{build}/{clock}")
async def clock_physics_profile(
    build: str,
    clock: str,
    top_n: int | None = Query(None, description="Return only top N probes by |coefficient|", ge=1, le=2000),
):
    """Full biophysical profile for every probe in an epigenetic clock.

    Returns per-probe: coefficient, coordinates, gene, CpG context, and
    the complete biophysical profile of the 1kb window containing it.
    Also returns aggregate statistics across the entire clock.
    """
    start_time = time.monotonic()
    if build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}})

    clock = clock.lower().strip()
    bp_select = ", ".join(f"b.{c}" for c in _BIOPHYSICS_COLS)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Clock metadata
        meta = await conn.fetchrow(
            "SELECT clock_name, display_name, n_probes, tissue, outcome, "
            "intercept, age_transform, platform, pmid, source_citation "
            "FROM ref.clock_metadata WHERE clock_name = $1",
            clock,
        )
        if not meta:
            valid = await conn.fetch("SELECT clock_name FROM ref.clock_metadata ORDER BY clock_name")
            raise HTTPException(404, {"error": {
                "code": "NOT_FOUND",
                "message": f"Clock '{clock}' not found",
                "valid_clocks": [r["clock_name"] for r in valid],
            }})

        # Resolve layer IDs
        probe_layers = await conn.fetch(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build",
            build,
        )
        bp_layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_key = 'sequence_biophysics_l0' AND genome_build = $1::genome_build",
            build,
        )
        if not probe_layers or not bp_layer:
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": "Missing probe or biophysics layers"}})

        probe_layer_ids = [l["id"] for l in probe_layers]

        # Main query: clock coefficients → probe coordinates → biophysics
        db_start = time.monotonic()
        rows = await conn.fetch(
            f"""
            SELECT DISTINCT ON (cc.probe_id)
                   cc.probe_id, cc.coefficient,
                   p.chr_id, p.pos, p.pos + 1 AS end_pos,
                   p.gene_symbol, p.cpg_context,
                   b.start_pos AS win_start, b.end_pos AS win_end,
                   {bp_select}
            FROM ref.clock_coefficients cc
            JOIN probe.coordinates p
                ON p.probe_id = cc.probe_id
                AND p.build = $1::genome_build
                AND p.layer_id = ANY($3)
            LEFT JOIN biophysics.sequence_properties b
                ON b.build = p.build
                AND b.chr_id = p.chr_id
                AND b.coord @> int4range(p.pos, p.pos + 1)
                AND b.layer_id = $4
            WHERE cc.clock_name = $2
            ORDER BY cc.probe_id, p.chr_id, p.pos
            """,
            build,
            clock,
            probe_layer_ids,
            bp_layer["id"],
        )
        db_time = (time.monotonic() - db_start) * 1000

    # Build per-probe response
    probes_out = []
    collectors: dict[str, list[float]] = {c: [] for c in _SUMMARY_COLS}
    coeff_collectors: dict[str, list[tuple[float, float]]] = {c: [] for c in _SUMMARY_COLS}
    cpg_context_counts: dict[str, int] = {}
    n_with_bp = 0

    for r in rows:
        chr_name = CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}")
        api = db_to_api(r["pos"], r["end_pos"])
        coeff = float(r["coefficient"])

        bp = None
        if r["win_start"] is not None:
            n_with_bp += 1
            win_api = db_to_api(r["win_start"], r["win_end"])
            bp = {"window": f"{chr_name}:{win_api['start']}-{win_api['end']}"}
            for col in _BIOPHYSICS_COLS:
                val = r[col]
                bp[col] = float(val) if val is not None else None
                if col in collectors and val is not None:
                    collectors[col].append(float(val))
                    coeff_collectors[col].append((coeff, float(val)))

        ctx = r["cpg_context"] or "unknown"
        cpg_context_counts[ctx] = cpg_context_counts.get(ctx, 0) + 1

        probes_out.append({
            "probe_id": r["probe_id"],
            "coefficient": coeff,
            "chr": chr_name,
            "pos": api["start"],
            "gene_symbol": r["gene_symbol"],
            "cpg_context": r["cpg_context"],
            "biophysics": bp,
        })

    # Sort by |coefficient| descending for top_n
    probes_out.sort(key=lambda p: abs(p["coefficient"]), reverse=True)
    if top_n:
        probes_out = probes_out[:top_n]

    # Aggregate statistics
    summary: dict = {
        "n_probes_in_clock": dict(meta)["n_probes"],
        "n_resolved": len(probes_out) if not top_n else len(rows),
        "n_with_biophysics": n_with_bp,
        "cpg_context_distribution": cpg_context_counts,
    }

    for col in _SUMMARY_COLS:
        vals = collectors[col]
        if vals:
            summary[f"mean_{col}"] = _safe_round(mean(vals))
            summary[f"sd_{col}"] = _safe_round(stdev(vals)) if len(vals) > 1 else None
        else:
            summary[f"mean_{col}"] = None
            summary[f"sd_{col}"] = None

    # Coefficient-weighted means for key biophysical properties
    weighted = {}
    for col in ("stacking_dg37", "melting_temp", "meth_sensitivity", "methylation_capacity", "deformability"):
        pairs = coeff_collectors.get(col, [])
        if pairs:
            abs_weights = [abs(c) for c, _ in pairs]
            total_w = sum(abs_weights)
            if total_w > 0:
                weighted[f"coeff_weighted_{col}"] = _safe_round(
                    sum(abs(c) * v for c, v in pairs) / total_w
                )
    summary["coefficient_weighted"] = weighted if weighted else None

    layers_resolved = [
        {"layer_key": l["layer_key"], "version": l["version"],
         "layer_id": str(l["id"]), "content_hash": l["content_hash"], "status": "ok"}
        for l in probe_layers
    ] + [
        {"layer_key": bp_layer["layer_key"], "version": bp_layer["version"],
         "layer_id": str(bp_layer["id"]), "content_hash": bp_layer["content_hash"], "status": "ok"}
    ]

    return build_envelope(
        status="complete",
        query={"build": build, "clock": clock, "top_n": top_n},
        layers_resolved=layers_resolved,
        data={
            "clock": dict(meta),
            "probes": probes_out,
            "summary": summary,
        },
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


# ── Cross-clock comparison ───────────────────────────────────────────────


@router.get("/{build}/compare/{clock_a}/{clock_b}")
async def compare_clock_physics(build: str, clock_a: str, clock_b: str):
    """Compare biophysical profiles of two clocks.

    Returns: shared probes, unique probes per clock, and comparative
    summary statistics showing how the two clocks differ biophysically.
    """
    start_time = time.monotonic()
    if build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}})

    clock_a, clock_b = clock_a.lower().strip(), clock_b.lower().strip()
    if clock_a == clock_b:
        raise HTTPException(400, {"error": {"code": "SAME_CLOCK", "message": "Provide two different clocks"}})

    bp_select = ", ".join(f"b.{c}" for c in _BIOPHYSICS_COLS)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Validate clocks exist
        meta_a = await conn.fetchrow("SELECT * FROM ref.clock_metadata WHERE clock_name = $1", clock_a)
        meta_b = await conn.fetchrow("SELECT * FROM ref.clock_metadata WHERE clock_name = $1", clock_b)
        if not meta_a or not meta_b:
            missing = clock_a if not meta_a else clock_b
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": f"Clock '{missing}' not found"}})

        # Get probe sets for each clock
        probes_a = await conn.fetch(
            "SELECT probe_id FROM ref.clock_coefficients WHERE clock_name = $1", clock_a)
        probes_b = await conn.fetch(
            "SELECT probe_id FROM ref.clock_coefficients WHERE clock_name = $1", clock_b)

        set_a = {r["probe_id"] for r in probes_a}
        set_b = {r["probe_id"] for r in probes_b}
        shared = set_a & set_b
        unique_a = set_a - set_b
        unique_b = set_b - set_a

        # Get biophysics for all probes in both clocks
        all_probes = list(set_a | set_b)
        probe_layers = await conn.fetch(
            "SELECT id FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build", build)
        bp_layer = await conn.fetchrow(
            "SELECT id FROM registry.active_layers "
            "WHERE layer_key = 'sequence_biophysics_l0' AND genome_build = $1::genome_build", build)
        if not probe_layers or not bp_layer:
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": "Missing layers"}})

        probe_layer_ids = [l["id"] for l in probe_layers]

        db_start = time.monotonic()
        rows = await conn.fetch(
            f"""
            SELECT DISTINCT ON (p.probe_id)
                   p.probe_id, p.chr_id, p.pos,
                   {bp_select}
            FROM probe.coordinates p
            LEFT JOIN biophysics.sequence_properties b
                ON b.build = p.build AND b.chr_id = p.chr_id
                AND b.coord @> int4range(p.pos, p.pos + 1)
                AND b.layer_id = $3
            WHERE p.build = $1::genome_build
              AND p.probe_id = ANY($2)
              AND p.layer_id = ANY($4)
            ORDER BY p.probe_id, p.chr_id, p.pos
            """,
            build, all_probes, bp_layer["id"], probe_layer_ids,
        )
        db_time = (time.monotonic() - db_start) * 1000

    # Partition biophysics by clock membership
    probe_bp: dict[str, dict] = {}
    for r in rows:
        bp = {}
        for col in _SUMMARY_COLS:
            val = r[col]
            bp[col] = float(val) if val is not None else None
        probe_bp[r["probe_id"]] = bp

    def _clock_stats(probe_set: set[str]) -> dict:
        stats = {}
        for col in _SUMMARY_COLS:
            vals = [probe_bp[p][col] for p in probe_set if p in probe_bp and probe_bp[p][col] is not None]
            stats[f"mean_{col}"] = _safe_round(mean(vals)) if vals else None
            stats[f"sd_{col}"] = _safe_round(stdev(vals)) if len(vals) > 1 else None
        return stats

    stats_a = _clock_stats(set_a)
    stats_b = _clock_stats(set_b)

    # Compute deltas (clock_b - clock_a)
    deltas = {}
    for col in _SUMMARY_COLS:
        ma, mb = stats_a.get(f"mean_{col}"), stats_b.get(f"mean_{col}")
        if ma is not None and mb is not None:
            deltas[f"delta_mean_{col}"] = _safe_round(mb - ma)

    return build_envelope(
        status="complete",
        query={"build": build, "clock_a": clock_a, "clock_b": clock_b},
        layers_resolved=[],
        data={
            "clock_a": {"name": clock_a, "display_name": dict(meta_a)["display_name"],
                        "n_probes": len(set_a), "stats": stats_a},
            "clock_b": {"name": clock_b, "display_name": dict(meta_b)["display_name"],
                        "n_probes": len(set_b), "stats": stats_b},
            "overlap": {
                "shared_probes": len(shared),
                "unique_to_a": len(unique_a),
                "unique_to_b": len(unique_b),
                "jaccard": _safe_round(len(shared) / len(set_a | set_b)) if (set_a | set_b) else 0,
            },
            "deltas": deltas,
        },
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
