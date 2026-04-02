import time
from statistics import mean

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/probes", tags=["probes"])

MAX_BATCH_SIZE = 10_000


class ProbeBatchRequest(BaseModel):
    probe_ids: list[str]


# Biophysics columns returned per probe from the 1kb window overlay.
# Grouped by source: L0 core, DNAshape, L1 methylation perturbation,
# L3.5 Green's function, L0 extended.
_BIOPHYSICS_COLS = (
    # L0 core (Phase 1, SantaLucia 1998 + Bolshoy 1991)
    "gc_content", "stacking_dg37", "melting_temp", "curvature",
    "groove_width", "dipole_density", "periodicity_power",
    # DNAshape (DNAshapeR, Zhou 2013)
    "mgw_mean", "prot_mean", "roll_mean", "helt_mean",
    "delta_mgw", "delta_prot", "delta_roll", "delta_helt",
    # Melting / mutation profiles
    "melting_cooperativity", "bubble_propensity", "melting_width",
    # L1 methylation perturbation (Phase 2)
    "cpg_count", "cpg_density", "cpg_obs_exp",
    "meth_delta_g", "meth_delta_tm", "meth_sensitivity",
    "methylation_capacity", "demethylation_cost", "oxidation_depth", "taut_relaxed",
    # L3.5 Green's function (Phase 3.5)
    "correlation_length", "integrated_response", "perturbation_reach", "response_asymmetry",
    # L0 extended
    "deformability", "g4_density", "g4_max_score",
    "kmer_complexity", "dinucleotide_entropy", "dominant_period",
    # Evolutionary physics (Phase 10)
    "phylop_241way_mean", "phastcons_241way_mean",
    "b_score_mean", "recomb_rate_cmmb", "mutation_rate_mean",
)

# Columns to include in summary statistics
_SUMMARY_COLS = (
    "gc_content", "stacking_dg37", "melting_temp", "curvature",
    "meth_sensitivity", "methylation_capacity", "correlation_length",
    "deformability", "g4_density", "cpg_density",
)


@router.get("/{build}/{probe_id}")
async def get_probe(build: str, probe_id: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve all probe layers
        layers = await conn.fetch(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build",
            build,
        )
        if not layers:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No probe layer for build {build}"}},
            )

        layer_ids = [l["id"] for l in layers]
        layer_map = {l["id"]: l for l in layers}

        db_start = time.monotonic()

        # Fetch probe coordinate across all probe layers
        row = await conn.fetchrow(
            """
            SELECT probe_id, chr_id, pos, pos + 1 AS end_pos,
                   gene_symbol, cpg_context, layer_id
            FROM probe.coordinates
            WHERE build = $1::genome_build
              AND probe_id = $2
              AND layer_id = ANY($3)
            """,
            build,
            probe_id,
            layer_ids,
        )

        if not row:
            db_time = (time.monotonic() - db_start) * 1000
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Probe '{probe_id}' not found in {build}"}},
            )

        layer = layer_map[row["layer_id"]]

        # Fetch crossmap edges — deduplicate across source platforms so that
        # a probe present on both 450k and epic_v1 doesn't produce duplicate
        # destination entries (e.g. epic_v2 → cg00000029_TC21 appearing twice).
        crossmap_rows = await conn.fetch(
            """
            SELECT DISTINCT ON (dst_platform, dst_probe_id)
                   src_platform, dst_platform, dst_probe_id, method, confidence
            FROM probe.map_edges
            WHERE src_probe_id = $1
              AND build = $2::genome_build
            ORDER BY dst_platform, dst_probe_id, method
            """,
            probe_id,
            build,
        )
        db_time = (time.monotonic() - db_start) * 1000

    api = db_to_api(row["pos"], row["end_pos"])
    chr_name = CHR_ID_TO_NAME.get(row["chr_id"], f"chr{row['chr_id']}")

    probe_data = {
        "probe_id": row["probe_id"],
        "seqname": chr_name,
        "start": api["start"],
        "end": api["end"],
        "width": api["width"],
        "gene_symbol": row["gene_symbol"],
        "cpg_context": row["cpg_context"],
    }

    crossmap = [
        {
            "src_platform": cr["src_platform"],
            "dst_platform": cr["dst_platform"],
            "dst_probe_id": cr["dst_probe_id"],
            "method": cr["method"],
            "confidence": float(cr["confidence"]),
        }
        for cr in crossmap_rows
    ]

    return build_envelope(
        status="complete",
        query={"build": build, "probe_id": probe_id},
        layers_resolved=[
            {
                "layer_key": layer["layer_key"],
                "version": layer["version"],
                "layer_id": str(layer["id"]),
                "content_hash": layer["content_hash"],
                "status": "ok",
            }
        ],
        data={"probe": probe_data, "crossmap": crossmap},
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


@router.post("/{build}/batch")
async def probe_batch(build: str, body: ProbeBatchRequest):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    if not body.probe_ids:
        raise HTTPException(
            400,
            {"error": {"code": "EMPTY_BATCH", "message": "probe_ids must not be empty"}},
        )

    if len(body.probe_ids) > MAX_BATCH_SIZE:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "BATCH_TOO_LARGE",
                    "message": f"Maximum {MAX_BATCH_SIZE} probe IDs per request",
                    "limit": MAX_BATCH_SIZE,
                    "requested": len(body.probe_ids),
                }
            },
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve all probe layers
        layers = await conn.fetch(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build",
            build,
        )
        if not layers:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No probe layer for build {build}"}},
            )

        layer_ids = [l["id"] for l in layers]

        db_start = time.monotonic()
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (probe_id) probe_id, chr_id, pos, pos + 1 AS end_pos,
                   gene_symbol, cpg_context
            FROM probe.coordinates
            WHERE build = $1::genome_build
              AND probe_id = ANY($2)
              AND layer_id = ANY($3)
            ORDER BY probe_id, chr_id, pos
            """,
            build,
            body.probe_ids,
            layer_ids,
        )
        db_time = (time.monotonic() - db_start) * 1000

    # Build GRanges response
    starts, ends, widths = [], [], []
    seqnames = []
    probe_ids, symbols, contexts = [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        seqnames.append(CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}"))
        probe_ids.append(r["probe_id"])
        symbols.append(r["gene_symbol"])
        contexts.append(r["cpg_context"])

    data = {
        "class": "GRanges",
        "seqnames": seqnames,
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "probe_id": probe_ids,
            "gene_symbol": symbols,
            "cpg_context": contexts,
        },
        "n": len(rows),
    }

    return build_envelope(
        status="complete",
        query={"build": build, "probe_ids": body.probe_ids, "batch_size": len(body.probe_ids)},
        layers_resolved=[
            {
                "layer_key": l["layer_key"],
                "version": l["version"],
                "layer_id": str(l["id"]),
                "content_hash": l["content_hash"],
                "status": "ok",
            }
            for l in layers
        ],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


@router.post("/{build}/biophysics")
async def probe_biophysics(build: str, body: ProbeBatchRequest):
    """Annotate probes with biophysical context from the 1kb window overlay.

    One API call from DMP list to biophysical annotation. For each probe,
    returns its coordinates, gene, CpG context, and the full biophysical
    profile of the 1kb genomic window containing it.
    """
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )
    if not body.probe_ids:
        raise HTTPException(
            400,
            {"error": {"code": "EMPTY_BATCH", "message": "probe_ids must not be empty"}},
        )
    if len(body.probe_ids) > MAX_BATCH_SIZE:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "BATCH_TOO_LARGE",
                    "message": f"Maximum {MAX_BATCH_SIZE} probe IDs per request",
                    "limit": MAX_BATCH_SIZE,
                    "requested": len(body.probe_ids),
                }
            },
        )

    bp_select = ", ".join(f"b.{c}" for c in _BIOPHYSICS_COLS)

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve probe + biophysics layer IDs
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
        if not probe_layers:
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": "No probe layers"}})
        if not bp_layer:
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": "No biophysics layer"}})

        probe_layer_ids = [l["id"] for l in probe_layers]

        db_start = time.monotonic()
        rows = await conn.fetch(
            f"""
            SELECT DISTINCT ON (p.probe_id)
                   p.probe_id, p.chr_id, p.pos, p.pos + 1 AS end_pos,
                   p.gene_symbol, p.cpg_context,
                   b.start_pos AS win_start, b.end_pos AS win_end,
                   {bp_select}
            FROM probe.coordinates p
            LEFT JOIN biophysics.sequence_properties b
                ON b.build = p.build
                AND b.chr_id = p.chr_id
                AND b.coord @> int4range(p.pos, p.pos + 1)
                AND b.layer_id = $4
            WHERE p.build = $1::genome_build
              AND p.probe_id = ANY($2)
              AND p.layer_id = ANY($3)
            ORDER BY p.probe_id, p.chr_id, p.pos
            """,
            build,
            body.probe_ids,
            probe_layer_ids,
            bp_layer["id"],
        )
        db_time = (time.monotonic() - db_start) * 1000

    # Build per-probe response
    probes_out = []
    resolved_ids = set()
    collectors: dict[str, list[float]] = {c: [] for c in _SUMMARY_COLS}

    for r in rows:
        resolved_ids.add(r["probe_id"])
        chr_name = CHR_ID_TO_NAME.get(r["chr_id"], f"chr{r['chr_id']}")
        api = db_to_api(r["pos"], r["end_pos"])

        # Build biophysics sub-object (None if no window matched)
        bp = None
        if r["win_start"] is not None:
            win_api = db_to_api(r["win_start"], r["win_end"])
            bp = {"window": f"{chr_name}:{win_api['start']}-{win_api['end']}"}
            for col in _BIOPHYSICS_COLS:
                val = r[col]
                bp[col] = float(val) if val is not None else None
                if col in collectors and val is not None:
                    collectors[col].append(float(val))

        probes_out.append({
            "probe_id": r["probe_id"],
            "chr": chr_name,
            "pos": api["start"],
            "gene_symbol": r["gene_symbol"],
            "cpg_context": r["cpg_context"],
            "biophysics": bp,
        })

    # Summary stats
    n_with_bp = sum(1 for p in probes_out if p["biophysics"] is not None)
    unresolved = [pid for pid in body.probe_ids if pid not in resolved_ids]

    summary: dict = {
        "n_requested": len(body.probe_ids),
        "n_resolved": len(resolved_ids),
        "n_with_biophysics": n_with_bp,
        "n_unresolved": len(unresolved),
    }
    for col in _SUMMARY_COLS:
        vals = collectors[col]
        summary[f"mean_{col}"] = round(mean(vals), 4) if vals else None

    if unresolved and len(unresolved) <= 100:
        summary["unresolved_probes"] = unresolved

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
        query={"build": build, "n_probes": len(body.probe_ids)},
        layers_resolved=layers_resolved,
        data={"probes": probes_out, "summary": summary},
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
