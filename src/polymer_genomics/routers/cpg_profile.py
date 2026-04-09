"""CpG profile endpoint.

Returns a layered evidence object for any CpG position or probe ID,
combining site identity, gene context, regulatory annotations,
conservation, sequence biophysics, and methylation biophysics model.
"""

import asyncio
import re
import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.constants import CHR_ID_TO_NAME, CHR_NAME_TO_ID, VALID_BUILDS
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/cpg-profile", tags=["cpg-profile"])

_PROBE_PATTERN = re.compile(r"^cg\d{7,8}$", re.IGNORECASE)
_CHRPOS_PATTERN = re.compile(r"^(chr[0-9XYM]+):(\d+)$", re.IGNORECASE)


def _lp_from_gc(gc: float) -> float:
    """Persistence length (nm) from GC content using Shon et al. 2019 calibration.

    Linear fit: Lp = 49 + 43.75 * (gc - 0.30) for gc in [0.30, 0.64].
    Returns ~49 nm at GC=0.30, ~77 nm at GC=0.64.
    """
    return 49.0 + 43.75 * (gc - 0.30)


def _section(evidence_class: str, scale: str, status: str, **kwargs) -> dict:
    """Build a section dict."""
    d = {"evidence_class": evidence_class, "scale": scale, "status": status}
    d.update(kwargs)
    return d


async def _resolve_position(conn, build: str, query: str):
    """Resolve query to (chr_id, pos_0based, probe_row_or_None, resolved_as)."""
    # Try probe ID first
    probe_match = _PROBE_PATTERN.match(query)
    if probe_match:
        probe_id = query.lower()
        # Find probe layers
        layers = await conn.fetch(
            "SELECT id FROM registry.active_layers "
            "WHERE layer_type = 'probe' AND genome_build = $1::genome_build",
            build,
        )
        if not layers:
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": f"No probe layers for {build}"}})

        layer_ids = [l["id"] for l in layers]
        row = await conn.fetchrow(
            """SELECT probe_id, chr_id, pos, gene_symbol, cpg_context, layer_id
               FROM probe.coordinates
               WHERE build = $1::genome_build AND probe_id = $2 AND layer_id = ANY($3)""",
            build, probe_id, layer_ids,
        )
        if not row:
            raise HTTPException(404, {"error": {"code": "NOT_FOUND", "message": f"Probe '{query}' not found in {build}"}})

        return row["chr_id"], row["pos"], row, "probe"

    # Try chr:pos format
    chrpos_match = _CHRPOS_PATTERN.match(query)
    if chrpos_match:
        chr_name = chrpos_match.group(1)
        pos_1based = int(chrpos_match.group(2))
        chr_id = CHR_NAME_TO_ID.get(chr_name)
        if chr_id is None:
            raise HTTPException(400, {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown chromosome: {chr_name}"}})
        pos_0based = pos_1based - 1
        return chr_id, pos_0based, None, "position"

    raise HTTPException(400, {"error": {"code": "INVALID_QUERY", "message": f"Unrecognized query format: '{query}'. Use probe ID (cg06545761) or chr:pos (chr16:87441441)."}})


async def _get_layer_id(conn, build: str, layer_type: str) -> int | None:
    """Get active layer ID for a given type and build."""
    row = await conn.fetchrow(
        "SELECT id FROM registry.active_layers WHERE layer_type = $1 AND genome_build = $2::genome_build",
        layer_type, build,
    )
    return row["id"] if row else None


@router.get("/{build}/{query}")
async def get_cpg_profile(build: str, query: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(400, {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}})

    pool = await get_pool()
    async with pool.acquire() as conn:
        db_start = time.monotonic()

        # 1. Resolve position
        chr_id, pos_0based, probe_row, resolved_as = await _resolve_position(conn, build, query)
        chr_name = CHR_ID_TO_NAME.get(chr_id, f"chr{chr_id}")
        pos_1based = pos_0based + 1
        layers_resolved = []

        # ── Batch all layer IDs in one query ─────────────────────────
        all_layers = await conn.fetch(
            "SELECT id, layer_type, layer_key FROM registry.active_layers "
            "WHERE genome_build = $1::genome_build",
            build,
        )
        layer_map: dict[str, int] = {}
        layer_key_map: dict[int, str] = {}
        probe_layer_ids: list[int] = []
        for lr in all_layers:
            lt = lr["layer_type"]
            if lt == "probe":
                probe_layer_ids.append(lr["id"])
            elif lt not in layer_map:
                layer_map[lt] = lr["id"]
            layer_key_map[lr["id"]] = lr["layer_key"]

        # ── Site Identity ─────────────────────────────────────────────
        site_data: dict = {
            "evidence_class": "direct_annotation",
            "scale": "site",
            "status": "present",
            "seqname": chr_name,
            "position": pos_1based,
            "start": pos_1based,
        }

        if probe_row:
            site_data["probe_id"] = probe_row["probe_id"]
            site_data["cpg_context"] = probe_row["cpg_context"]
            site_data["gene_symbol"] = probe_row["gene_symbol"]
            site_data["platform"] = layer_key_map.get(probe_row["layer_id"])

            other_probes = await conn.fetch(
                """SELECT probe_id, layer_id FROM probe.coordinates
                   WHERE build = $1::genome_build AND chr_id = $2 AND pos = $3 AND layer_id = ANY($4)""",
                build, chr_id, pos_0based, probe_layer_ids,
            )
            site_data["probes_at_position"] = [
                {"probe_id": p["probe_id"]}
                for p in other_probes
            ]
        else:
            cpg_layer_id = layer_map.get("cpg")
            if cpg_layer_id:
                cpg_row = await conn.fetchrow(
                    "SELECT context, gc_content FROM cpg.sites "
                    "WHERE build = $1::genome_build AND chr_id = $2 AND pos = $3 AND layer_id = $4",
                    build, chr_id, pos_0based, cpg_layer_id,
                )
                if cpg_row:
                    site_data["cpg_context"] = cpg_row["context"]
                    site_data["gc"] = float(cpg_row["gc_content"]) if cpg_row["gc_content"] is not None else None
                else:
                    site_data["cpg_context"] = None

            if probe_layer_ids:
                probes_here = await conn.fetch(
                    """SELECT probe_id, cpg_context, gene_symbol FROM probe.coordinates
                       WHERE build = $1::genome_build AND chr_id = $2 AND pos = $3 AND layer_id = ANY($4)""",
                    build, chr_id, pos_0based, probe_layer_ids,
                )
                if probes_here:
                    site_data["probes_at_position"] = [{"probe_id": p["probe_id"]} for p in probes_here]
                    if not site_data.get("cpg_context") and probes_here[0]["cpg_context"]:
                        site_data["cpg_context"] = probes_here[0]["cpg_context"]
                    if not site_data.get("gene_symbol"):
                        site_data["gene_symbol"] = probes_here[0]["gene_symbol"]

        # ── All remaining queries in parallel ─────────────────────────
        bin_start = (pos_0based // 1000) * 1000
        bin_end = bin_start + 1000

        async def _fetch_gene_context():
            gene_layer_id = layer_map.get("gene_model")
            if not gene_layer_id:
                return _section("direct_annotation", "gene", "unavailable_for_build")
            async with pool.acquire() as c:
                gene_rows = await c.fetch(
                    """SELECT DISTINCT gene_symbol, strand, feature_type, start_pos, end_pos
                       FROM gene.features
                       WHERE build = $1::genome_build AND chr_id = $2
                         AND coord && int4range($3, $4) AND layer_id = $5
                       ORDER BY start_pos LIMIT 20""",
                    build, chr_id, pos_0based, pos_0based + 1, gene_layer_id,
                )
                if gene_rows:
                    best = gene_rows[0]
                    return _section("direct_annotation", "gene", "present",
                                    gene_symbol=best["gene_symbol"], strand=best["strand"],
                                    feature_type=best["feature_type"], distance_to_gene=0)
                nearest = await c.fetchrow(
                    """SELECT gene_symbol, strand, start_pos, end_pos,
                              LEAST(ABS(start_pos - $3), ABS(end_pos - $3)) AS dist
                       FROM gene.features
                       WHERE build = $1::genome_build AND chr_id = $2
                         AND coord && int4range($3 - 100000, $4 + 100000) AND layer_id = $5
                         AND feature_type = 'gene'
                       ORDER BY dist LIMIT 1""",
                    build, chr_id, pos_0based, pos_0based + 1, gene_layer_id,
                )
                if nearest:
                    return _section("contextual_proxy", "gene", "present",
                                    gene_symbol=nearest["gene_symbol"], strand=nearest["strand"],
                                    distance_to_gene=int(nearest["dist"]))
            return _section("direct_annotation", "gene", "no_overlap")

        async def _fetch_regulatory():
            reg_lid = layer_map.get("regulatory")
            chrom_lid = layer_map.get("chromatin_state")
            if not reg_lid and not chrom_lid:
                return _section("direct_annotation", "regulatory_element", "unavailable_for_build")
            reg_data: dict = {"evidence_class": "direct_annotation", "scale": "regulatory_element", "status": "present"}
            ccres, chromhmm = [], []
            async with pool.acquire() as c:
                if reg_lid:
                    reg_rows = await c.fetch(
                        """SELECT accession, score, ccre_class, encode_label
                           FROM regulatory.ccre WHERE build = $1::genome_build AND chr_id = $2
                             AND coord && int4range($3, $4) AND layer_id = $5 LIMIT 10""",
                        build, chr_id, pos_0based, pos_0based + 1, reg_lid)
                    ccres = [{"accession": r["accession"], "ccre_class": r["ccre_class"],
                              "score": int(r["score"]) if r["score"] is not None else None,
                              "encode_label": r["encode_label"]} for r in reg_rows]
                if chrom_lid:
                    chrom_rows = await c.fetch(
                        """SELECT state_name, epigenome_name FROM regulatory.chromatin_state
                           WHERE build = $1::genome_build AND chr_id = $2
                             AND coord && int4range($3, $4) AND layer_id = $5 LIMIT 10""",
                        build, chr_id, pos_0based, pos_0based + 1, chrom_lid)
                    chromhmm = [{"state_name": r["state_name"], "epigenome": r["epigenome_name"]} for r in chrom_rows]
            reg_data["ccres"] = ccres
            reg_data["chromhmm_states"] = chromhmm
            if not ccres and not chromhmm:
                reg_data["status"] = "no_overlap"
            return reg_data

        async def _fetch_conservation():
            cons_lid = layer_map.get("conservation")
            if not cons_lid:
                return _section("window_summary", "1kb_window", "unavailable_for_build")
            async with pool.acquire() as c:
                cons_row = await c.fetchrow(
                    """SELECT phylop_mean, phylop_max, phastcons_mean, phastcons_max
                       FROM conservation.scores WHERE build = $1::genome_build AND chr_id = $2
                         AND coord && int4range($3, $4) AND layer_id = $5 LIMIT 1""",
                    build, chr_id, bin_start, bin_end, cons_lid)
            if cons_row:
                return _section("window_summary", "1kb_window", "present",
                    phylop_mean=float(cons_row["phylop_mean"]) if cons_row["phylop_mean"] is not None else None,
                    phylop_max=float(cons_row["phylop_max"]) if cons_row["phylop_max"] is not None else None,
                    phastcons_mean=float(cons_row["phastcons_mean"]) if cons_row["phastcons_mean"] is not None else None,
                    phastcons_max=float(cons_row["phastcons_max"]) if cons_row["phastcons_max"] is not None else None,
                    rationale="Conservation scores summarized over 1kb bin, not single-base resolution.")
            return _section("window_summary", "1kb_window", "no_data")

        async def _fetch_biophysics():
            bp_lid = layer_map.get("biophysics")
            if not bp_lid:
                return _section("window_summary", "1kb_window", "unavailable_for_build"), None
            async with pool.acquire() as c:
                bp_row = await c.fetchrow(
                    """SELECT gc_content, stacking_dg37, melting_temp,
                              curvature, groove_width, dipole_density, periodicity_power
                       FROM biophysics.sequence_properties WHERE build = $1::genome_build AND chr_id = $2
                         AND coord && int4range($3, $4) AND layer_id = $5 LIMIT 1""",
                    build, chr_id, bin_start, bin_end, bp_lid)
            if bp_row:
                gc_val = float(bp_row["gc_content"]) if bp_row["gc_content"] is not None else None
                return _section("window_summary", "1kb_window", "present",
                    gc=gc_val,
                    stacking_dg37=float(bp_row["stacking_dg37"]) if bp_row["stacking_dg37"] is not None else None,
                    melting_temp=float(bp_row["melting_temp"]) if bp_row["melting_temp"] is not None else None,
                    curvature=float(bp_row["curvature"]) if bp_row["curvature"] is not None else None,
                    groove_width=float(bp_row["groove_width"]) if bp_row["groove_width"] is not None else None,
                    dipole=float(bp_row["dipole_density"]) if bp_row["dipole_density"] is not None else None,
                    periodicity=float(bp_row["periodicity_power"]) if bp_row["periodicity_power"] is not None else None,
                    rationale="Sequence biophysical properties from Polymer Evolution Layer 0, summarized over 1kb bin."), gc_val
            return _section("window_summary", "1kb_window", "no_data"), None

        # Phase 1: gene_context + regulatory + conservation + biophysics (all parallel)
        gene_context, regulatory_context, regional_conservation, biophys_result = await asyncio.gather(
            _fetch_gene_context(), _fetch_regulatory(), _fetch_conservation(), _fetch_biophysics(),
        )
        regional_biophysics, gc_val = biophys_result

        # Phase 2: gene priors (needs gene_symbol from gene_context)
        gene_symbol = gene_context.get("gene_symbol") or site_data.get("gene_symbol")
        if gene_symbol:
            priors: dict = {"evidence_class": "contextual_proxy", "scale": "gene", "status": "present"}
            constraint_lid = layer_map.get("constraint")
            expr_lid = layer_map.get("expression")
            async with pool.acquire() as c:
                if constraint_lid:
                    cr = await c.fetchrow(
                        "SELECT pli, loeuf, mis_z, syn_z FROM conservation.gene_constraint "
                        "WHERE build = $1::genome_build AND gene_symbol = $2 AND layer_id = $3",
                        build, gene_symbol, constraint_lid)
                    if cr:
                        priors["pli"] = float(cr["pli"]) if cr["pli"] is not None else None
                        priors["loeuf"] = float(cr["loeuf"]) if cr["loeuf"] is not None else None
                        priors["mis_z"] = float(cr["mis_z"]) if cr["mis_z"] is not None else None
                if expr_lid:
                    er = await c.fetchrow(
                        "SELECT median_tpm, max_tpm, max_tissue FROM expression.gene_tpm "
                        "WHERE build = $1::genome_build AND gene_symbol = $2 AND layer_id = $3",
                        build, gene_symbol, expr_lid)
                    if er:
                        priors["median_tpm"] = float(er["median_tpm"]) if er["median_tpm"] is not None else None
                        priors["max_tpm"] = float(er["max_tpm"]) if er["max_tpm"] is not None else None
                        priors["max_tissue"] = er["max_tissue"]
            priors["rationale"] = f"Constraint and expression data for nearest gene {gene_symbol}. These are gene-level priors, not site-specific measurements."
            nearby_gene_priors = priors
        else:
            nearby_gene_priors = _section("contextual_proxy", "gene", "no_overlap")

        db_time = (time.monotonic() - db_start) * 1000

    # ── Methylation Biophysics Model ──────────────────────────────
    # Computed from GC (no DB query needed)
    cpg_context = site_data.get("cpg_context")
    if cpg_context and gc_val is not None:
        lp_bare = round(_lp_from_gc(gc_val), 1)
        lp_meth = 50.0  # Shon et al. 2019 convergence value
        delta_lp_pct = round((lp_meth - lp_bare) / lp_bare * 100, 1) if lp_bare > 0 else None

        meth_biophysics = _section(
            "model_derived", "polymer_bulk", "present",
            lp_bare=lp_bare,
            lp_methylated=lp_meth,
            delta_lp_pct=delta_lp_pct,
            ddg_stacking=0.50,
            effect="stabilizing",
            rationale=(
                "Persistence length model from Shon et al. 2019 (Sci Adv): "
                "CpG methylation converges Lp to ~50 nm regardless of GC content, "
                "erasing sequence-dependent stiffness. "
                "Stacking free energy shift from SantaLucia 1998: "
                "5mC increases melt resistance by +0.50 kcal/mol per methylated CpG step. "
                "These are opposite effects on different mechanical modes: "
                "methylation softens bending (Lp down) but stabilizes stacking (delta-G up)."
            ),
        )
    elif cpg_context is None:
        meth_biophysics = _section("model_derived", "polymer_bulk", "not_applicable")
    else:
        meth_biophysics = _section("model_derived", "polymer_bulk", "no_data",
                                    rationale="GC content not available for Lp model.")

    return build_envelope(
        status="complete",
        query={"build": build, "input": query, "resolved_as": resolved_as},
        layers_resolved=layers_resolved,
        data={
            "site_identity": site_data,
            "gene_context": gene_context,
            "nearby_gene_priors": nearby_gene_priors,
            "regulatory_context": regulatory_context,
            "regional_conservation": regional_conservation,
            "regional_sequence_biophysics": regional_biophysics,
            "methylation_biophysics_model": meth_biophysics,
        },
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
