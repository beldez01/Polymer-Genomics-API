"""Gene profile endpoints — layered feature profiles with anomaly detection."""

import math
import time

from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["gene_profiles"])

INTERPRETATION_HINTS = {
    ("loeuf", "low"): "Strongly loss-of-function intolerant",
    ("loeuf", "high"): "Tolerant of loss-of-function variants",
    ("mis_z", "high"): "Strongly missense-constrained",
    ("tau", "high"): "Highly tissue-specific expression",
    ("tau", "low"): "Broadly expressed (housekeeping-like)",
    ("log_median_tpm", "high"): "Highly expressed across tissues",
    ("log_median_tpm", "low"): "Low expression across tissues",
    ("log_max_ppm", "high"): "Highly abundant protein",
    ("ecpa_b20", "high"): "Biosynthetically expensive protein",
    ("gc_body", "high"): "High GC content gene body",
    ("gc_body", "low"): "Low GC content gene body (AT-rich)",
    ("promoter_is_cpg_island", "high"): "CpG island promoter",
    ("gene_length_log_kb", "high"): "Unusually long gene",
    ("gene_length_log_kb", "low"): "Unusually short gene",
    ("frac_expensive_aa", "high"): "High fraction of costly amino acids",
    ("n_tissues_detected", "high"): "Detected in many tissues",
    ("n_tissues_detected", "low"): "Detected in few tissues",
    ("phylop_body", "high"): "Highly conserved sequence",
    ("phastcons_body", "high"): "Highly conserved sequence",
    ("promoter_ccre_count", "high"): "Dense regulatory element region",
    ("distal_ccre_density", "high"): "Gene body enriched for regulatory elements",
}

LAYER_NAMES = ("intrinsic", "regulatory", "expression", "protein")


def _safe_float(v) -> float | None:
    if v is None:
        return None
    f = float(v)
    return None if math.isnan(f) else f


def _format_dimensions(lv_row) -> list[dict]:
    dims = []
    names = lv_row["dimension_names"]
    raw = lv_row["raw_values"]
    z = lv_row["z_scores"]
    pct = lv_row["percentiles"]
    miss = lv_row["missingness"]
    for i, name in enumerate(names):
        dims.append({
            "name": name,
            "raw_value": _safe_float(raw[i]),
            "z_score": _safe_float(z[i]),
            "percentile": _safe_float(pct[i]),
            "missing": miss[i],
        })
    return dims


@router.get("/{build}/{symbol}/profile")
async def get_gene_profile(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve profile layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'gene_profile' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No gene_profile layer for build {build}"}},
            )

        db_start = time.monotonic()

        # 1. Gene identity
        identity = await conn.fetchrow(
            """
            SELECT id, ensembl_gene_id, gene_symbol, chr_id, start_pos, end_pos,
                   strand, gene_length_bp, canonical_transcript, n_transcripts
            FROM profiles.gene_identity
            WHERE build = $1::genome_build AND gene_symbol = UPPER($2)
            LIMIT 1
            """,
            build, symbol,
        )
        resolved_alias = None
        if not identity:
            canonical = await resolve_alias(conn, symbol)
            if canonical:
                resolved_alias = symbol
                identity = await conn.fetchrow(
                    """
                    SELECT id, ensembl_gene_id, gene_symbol, chr_id, start_pos, end_pos,
                           strand, gene_length_bp, canonical_transcript, n_transcripts
                    FROM profiles.gene_identity
                    WHERE build = $1::genome_build AND gene_symbol = UPPER($2)
                    LIMIT 1
                    """,
                    build, canonical,
                )
            if not identity:
                raise HTTPException(
                    404,
                    {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in profiles for {build}"}},
                )

        gene_pk = identity["id"]

        # 2. Layer vectors
        lv_rows = await conn.fetch(
            """
            SELECT layer_name, dimension_names, raw_values, z_scores, percentiles,
                   missingness, norm, n_dimensions, n_present
            FROM profiles.layer_vectors
            WHERE gene_id = $1 AND layer_id = $2
            ORDER BY layer_name
            """,
            gene_pk, layer["id"],
        )

        # 3. Anomalies
        anom_rows = await conn.fetch(
            """
            SELECT anomaly_type, layer_name, dimension, score, percentile, direction, context
            FROM profiles.anomalies
            WHERE gene_id = $1 AND layer_id = $2
            """,
            gene_pk, layer["id"],
        )

        # 4. Metadata
        metadata = await conn.fetchrow(
            """
            SELECT version_tag, n_genes, dimension_manifest, computed_at
            FROM profiles.profile_metadata
            WHERE layer_id = $1 AND build = $2::genome_build
            LIMIT 1
            """,
            layer["id"], build,
        )

        db_time = (time.monotonic() - db_start) * 1000

    # Build response
    coordinates = None
    if identity["chr_id"] is not None and identity["start_pos"] is not None:
        api = db_to_api(identity["start_pos"], identity["end_pos"])
        chr_name = CHR_ID_TO_NAME.get(identity["chr_id"], f"chr{identity['chr_id']}")
        coordinates = {
            "seqname": chr_name,
            "start": api["start"],
            "end": api["end"],
            "width": api["width"],
            "strand": identity["strand"],
        }

    identity_data = {
        "ensembl_gene_id": identity["ensembl_gene_id"],
        "gene_symbol": identity["gene_symbol"],
        "coordinates": coordinates,
        "gene_length_bp": identity["gene_length_bp"],
    }

    layers = {}
    for lv in lv_rows:
        layers[lv["layer_name"]] = {
            "dimensions": _format_dimensions(lv),
            "norm": _safe_float(lv["norm"]),
            "n_dimensions": lv["n_dimensions"],
            "n_present": lv["n_present"],
        }

    anomalies = []
    for a in anom_rows:
        hint = INTERPRETATION_HINTS.get((a["dimension"], a["direction"]))
        anomalies.append({
            "anomaly_type": a["anomaly_type"],
            "layer_name": a["layer_name"],
            "dimension": a["dimension"],
            "score": _safe_float(a["score"]),
            "percentile": _safe_float(a["percentile"]),
            "direction": a["direction"],
            "interpretation_hint": hint,
        })

    meta = None
    if metadata:
        import json
        meta = {
            "version_tag": metadata["version_tag"],
            "n_genes": metadata["n_genes"],
            "computed_at": metadata["computed_at"].isoformat() if metadata["computed_at"] else None,
        }

    data = {
        "identity": identity_data,
        "layers": layers,
        "anomalies": anomalies,
        "metadata": meta,
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol, **({"resolved_alias": resolved_alias} if resolved_alias else {})},
        layers_resolved=[{
            "layer_key": layer["layer_key"],
            "version": layer["version"],
            "layer_id": str(layer["id"]),
            "content_hash": layer["content_hash"],
            "status": "ok",
        }],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )


@router.get("/{build}/{symbol}/similar")
async def get_similar_genes(
    build: str,
    symbol: str,
    n: int = Query(default=10, ge=1, le=50),
    mode: str = Query(default="integrated"),
):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    valid_modes = {"integrated", "intrinsic", "regulatory", "expression", "protein"}
    if mode not in valid_modes:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_MODE", "message": f"Mode must be one of: {', '.join(sorted(valid_modes))}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'gene_profile' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No gene_profile layer for build {build}"}},
            )

        db_start = time.monotonic()

        # Resolve query gene
        query_gene = await conn.fetchrow(
            """
            SELECT gi.id, gi.ensembl_gene_id, gi.gene_symbol
            FROM profiles.gene_identity gi
            WHERE gi.build = $1::genome_build AND gi.gene_symbol = UPPER($2)
            LIMIT 1
            """,
            build, symbol,
        )
        if not query_gene:
            canonical = await resolve_alias(conn, symbol)
            if canonical:
                query_gene = await conn.fetchrow(
                    """
                    SELECT gi.id, gi.ensembl_gene_id, gi.gene_symbol
                    FROM profiles.gene_identity gi
                    WHERE gi.build = $1::genome_build AND gi.gene_symbol = UPPER($2)
                    LIMIT 1
                    """,
                    build, canonical,
                )
            if not query_gene:
                raise HTTPException(
                    404,
                    {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in profiles for {build}"}},
                )

        # Fetch all layer_vectors for query gene
        query_vectors = await conn.fetch(
            """
            SELECT layer_name, z_scores, missingness
            FROM profiles.layer_vectors
            WHERE gene_id = $1 AND layer_id = $2
            """,
            query_gene["id"], layer["id"],
        )
        if not query_vectors:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No profile vectors for '{symbol}'"}},
            )

        # Build query vector
        query_z_by_layer = {}
        query_miss_by_layer = {}
        for v in query_vectors:
            query_z_by_layer[v["layer_name"]] = [float(x) for x in v["z_scores"]]
            query_miss_by_layer[v["layer_name"]] = list(v["missingness"])

        # Determine which layers to compare
        if mode == "integrated":
            compare_layers = list(LAYER_NAMES)
        else:
            compare_layers = [mode]

        # Fetch ALL gene layer_vectors for the relevant layers
        all_vectors = await conn.fetch(
            """
            SELECT lv.gene_id, gi.ensembl_gene_id, gi.gene_symbol,
                   lv.layer_name, lv.z_scores, lv.missingness
            FROM profiles.layer_vectors lv
            JOIN profiles.gene_identity gi ON gi.id = lv.gene_id
            WHERE lv.layer_id = $1 AND lv.layer_name = ANY($2)
              AND gi.build = $3::genome_build
            """,
            layer["id"], compare_layers, build,
        )

        db_time = (time.monotonic() - db_start) * 1000

    # Group by gene
    genes_data: dict[int, dict] = {}
    for v in all_vectors:
        gid = v["gene_id"]
        if gid not in genes_data:
            genes_data[gid] = {
                "ensembl_gene_id": v["ensembl_gene_id"],
                "gene_symbol": v["gene_symbol"],
                "layers": {},
            }
        genes_data[gid]["layers"][v["layer_name"]] = {
            "z_scores": [float(x) for x in v["z_scores"]],
            "missingness": list(v["missingness"]),
        }

    # Compute cosine similarities
    def _cosine_sim(a: list[float], b: list[float], mask_a: list[bool], mask_b: list[bool]):
        dot = 0.0
        norm_a = 0.0
        norm_b = 0.0
        n_shared = 0
        for i in range(len(a)):
            if mask_a[i] or mask_b[i]:
                continue
            ai, bi = a[i], b[i]
            if math.isnan(ai) or math.isnan(bi):
                continue
            dot += ai * bi
            norm_a += ai * ai
            norm_b += bi * bi
            n_shared += 1
        if norm_a == 0 or norm_b == 0 or n_shared == 0:
            return None, 0
        return dot / (math.sqrt(norm_a) * math.sqrt(norm_b)), n_shared

    results = []
    query_pk = query_gene["id"]

    for gid, gdata in genes_data.items():
        if gid == query_pk:
            continue

        # Per-layer similarity
        layer_sims = {}
        total_z_q = []
        total_z_g = []
        total_mask_q = []
        total_mask_g = []

        for ln in LAYER_NAMES:
            q_z = query_z_by_layer.get(ln)
            q_m = query_miss_by_layer.get(ln)
            g_layer = gdata["layers"].get(ln)

            if q_z and g_layer:
                sim, _ = _cosine_sim(q_z, g_layer["z_scores"], q_m, g_layer["missingness"])
                layer_sims[ln] = round(sim, 4) if sim is not None else None
                total_z_q.extend(q_z)
                total_z_g.extend(g_layer["z_scores"])
                total_mask_q.extend(q_m)
                total_mask_g.extend(g_layer["missingness"])
            else:
                layer_sims[ln] = None

        if mode == "integrated":
            overall_sim, n_shared = _cosine_sim(total_z_q, total_z_g, total_mask_q, total_mask_g)
        else:
            q_z = query_z_by_layer.get(mode)
            q_m = query_miss_by_layer.get(mode)
            g_layer = gdata["layers"].get(mode)
            if q_z and g_layer:
                overall_sim, n_shared = _cosine_sim(q_z, g_layer["z_scores"], q_m, g_layer["missingness"])
            else:
                overall_sim, n_shared = None, 0

        if overall_sim is None:
            continue

        total_dims = sum(len(query_z_by_layer.get(ln, [])) for ln in compare_layers)
        coverage = n_shared / total_dims if total_dims > 0 else 0.0

        # Require at least 50% dimension coverage
        if coverage < 0.5:
            continue

        results.append({
            "ensembl_gene_id": gdata["ensembl_gene_id"],
            "gene_symbol": gdata["gene_symbol"],
            "cosine_similarity": round(overall_sim, 4),
            "coverage": round(coverage, 3),
            "n_shared_dims": n_shared,
            "layer_similarities": layer_sims,
        })

    # Sort by similarity descending, take top N
    results.sort(key=lambda x: x["cosine_similarity"], reverse=True)
    results = results[:n]

    data = {
        "query_gene": query_gene["gene_symbol"],
        "mode": mode,
        "similar_genes": results,
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol, "n": n, "mode": mode},
        layers_resolved=[{
            "layer_key": layer["layer_key"],
            "version": layer["version"],
            "layer_id": str(layer["id"]),
            "content_hash": layer["content_hash"],
            "status": "ok",
        }],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
