"""HLA allele biophysics endpoints.

Provides lookup, comparison, and transplant match scoring for HLA alleles
based on pre-computed biophysical properties from IPD-IMGT/HLA genomic
sequences. Focused on non-coding regions (introns/UTRs) that Bettens et al.
2022 showed drive 13-50% of HLA class I expression variance.

All data pre-ingested — no external API calls at query time.
"""

from __future__ import annotations

import math
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from polymer_genomics import __version__
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import DATA_VERSION

router = APIRouter(prefix="/v1/hla", tags=["hla"])

# ── Helpers ──────────────────────────────────────────────────────────────────


async def _get_hla_layer_id() -> str:
    """Retrieve the active HLA biophysics layer ID."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        layer_id = await conn.fetchval(
            """SELECT id FROM registry.layers
               WHERE layer_key = 'hla_allele_biophysics'
                 AND is_active = true
               ORDER BY version DESC
               LIMIT 1"""
        )
    if not layer_id:
        raise HTTPException(503, {"error": {"code": "HLA_NOT_LOADED", "message": "HLA allele data not yet ingested."}})
    return layer_id


def _allele_summary(row: dict) -> dict:
    """Extract biophysics summary from an allele row."""
    return {
        "gc_content": row.get("gc_content"),
        "cpg_count": row.get("cpg_count"),
        "cpg_density": row.get("cpg_density"),
        "cpg_obs_exp": row.get("cpg_obs_exp"),
        "cpg_island_count": row.get("cpg_island_count"),
        "mean_stacking_dg37": row.get("mean_stacking_dg37"),
        "melting_temp_est": row.get("melting_temp_est"),
        "mean_a_form_prop": row.get("mean_a_form_prop"),
        "mean_z_form_prop": row.get("mean_z_form_prop"),
        "total_z_penalty": row.get("total_z_penalty"),
        "mean_major_groove_w": row.get("mean_major_groove_w"),
        "mean_minor_groove_w": row.get("mean_minor_groove_w"),
    }


def _nc_summary(row: dict) -> dict:
    """Extract non-coding biophysics from an allele row."""
    return {
        "gc_content": row.get("nc_gc_content"),
        "cpg_count": row.get("nc_cpg_count"),
        "cpg_density": row.get("nc_cpg_density"),
        "mean_stacking_dg37": row.get("nc_mean_stacking_dg37"),
        "melting_temp_est": row.get("nc_melting_temp_est"),
        "mean_a_form_prop": row.get("nc_mean_a_form_prop"),
        "mean_z_form_prop": row.get("nc_mean_z_form_prop"),
        "total_z_penalty": row.get("nc_total_z_penalty"),
        "cpg_island_count": row.get("nc_cpg_island_count"),
    }


def _compute_delta(ref: dict, other: dict) -> dict:
    """Compute biophysical deltas between two summary dicts."""
    delta = {}
    for key in ref:
        rv = ref.get(key)
        ov = other.get(key)
        if rv is not None and ov is not None:
            delta[f"delta_{key}"] = round(ov - rv, 6)
    return delta


VALID_LOCI = {"HLA-A", "HLA-B", "HLA-C", "HLA-DRB1", "HLA-DQB1", "HLA-DPB1"}


def _validate_locus(locus: str) -> str:
    """Normalize and validate locus name."""
    normalized = locus.upper()
    if not normalized.startswith("HLA-"):
        normalized = f"HLA-{normalized}"
    if normalized not in VALID_LOCI:
        raise HTTPException(400, {
            "error": {"code": "INVALID_LOCUS", "message": f"Unknown locus '{locus}'. Valid: {sorted(VALID_LOCI)}"}
        })
    return normalized


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/loci")
async def list_hla_loci():
    """List available HLA loci with allele counts and mean biophysics.

    Returns the 6 transplant-relevant loci (HLA-A, -B, -C, -DRB1, -DQB1, -DPB1)
    with total allele counts, genomic allele counts, and mean biophysical properties.
    """
    start = time.monotonic()
    layer_id = await _get_hla_layer_id()

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT locus, hla_class,
                      count(*) AS total_alleles,
                      count(*) FILTER (WHERE has_genomic) AS genomic_alleles,
                      avg(gc_content) FILTER (WHERE has_genomic) AS mean_gc,
                      avg(mean_stacking_dg37) FILTER (WHERE has_genomic) AS mean_dg37,
                      avg(melting_temp_est) FILTER (WHERE has_genomic) AS mean_tm,
                      avg(nc_gc_content) FILTER (WHERE has_genomic) AS mean_nc_gc,
                      avg(nc_mean_stacking_dg37) FILTER (WHERE has_genomic) AS mean_nc_dg37
               FROM hla.alleles
               WHERE layer_id = $1
               GROUP BY locus, hla_class
               ORDER BY hla_class, locus""",
            layer_id,
        )

    loci = []
    for r in rows:
        loci.append({
            "locus": r["locus"],
            "hla_class": r["hla_class"],
            "total_alleles": r["total_alleles"],
            "genomic_alleles": r["genomic_alleles"],
            "mean_gc_content": round(r["mean_gc"], 4) if r["mean_gc"] else None,
            "mean_stacking_dg37": round(r["mean_dg37"], 4) if r["mean_dg37"] else None,
            "mean_melting_temp": round(r["mean_tm"], 1) if r["mean_tm"] else None,
            "mean_nc_gc_content": round(r["mean_nc_gc"], 4) if r["mean_nc_gc"] else None,
            "mean_nc_stacking_dg37": round(r["mean_nc_dg37"], 4) if r["mean_nc_dg37"] else None,
        })

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "n_loci": len(loci),
        "loci": loci,
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/alleles/{locus}")
async def list_hla_alleles(
    locus: str,
    allele_group: str | None = Query(None, description="Filter by 1st field (e.g., '02')"),
    protein: str | None = Query(None, description="Filter by 2nd field (e.g., '01')"),
    genomic_only: bool = Query(False, description="Only alleles with full genomic sequences"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """List HLA alleles for a locus with biophysics summaries.

    Supports filtering by allele group, protein subtype, and genomic availability.
    """
    start = time.monotonic()
    locus = _validate_locus(locus)
    layer_id = await _get_hla_layer_id()

    # Build dynamic query
    clauses = ["layer_id = $1", "locus = $2"]
    params: list[Any] = [layer_id, locus]
    idx = 3

    if allele_group is not None:
        clauses.append(f"allele_group = ${idx}")
        params.append(allele_group)
        idx += 1

    if protein is not None:
        clauses.append(f"protein = ${idx}")
        params.append(protein)
        idx += 1

    if genomic_only:
        clauses.append("has_genomic = true")

    where = " AND ".join(clauses)
    params.extend([limit, offset])

    sql = f"""
        SELECT allele_name, allele_group, protein, synonymous, noncoding,
               expression_suffix, has_genomic,
               sequence_length, cds_length,
               gc_content, mean_stacking_dg37, melting_temp_est,
               nc_gc_content, nc_mean_stacking_dg37, nc_melting_temp_est
        FROM hla.alleles
        WHERE {where}
        ORDER BY allele_name
        LIMIT ${idx} OFFSET ${idx + 1}
    """

    count_sql = f"SELECT count(*) FROM hla.alleles WHERE {where}"

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
        total = await conn.fetchval(count_sql, *params[:-2])

    alleles = []
    for r in rows:
        alleles.append({
            "allele_name": r["allele_name"],
            "allele_group": r["allele_group"],
            "protein": r["protein"],
            "synonymous": r["synonymous"],
            "noncoding": r["noncoding"],
            "expression_suffix": r["expression_suffix"],
            "has_genomic": r["has_genomic"],
            "sequence_length": r["sequence_length"],
            "cds_length": r["cds_length"],
            "gc_content": r["gc_content"],
            "mean_stacking_dg37": r["mean_stacking_dg37"],
            "melting_temp_est": r["melting_temp_est"],
            "nc_gc_content": r["nc_gc_content"],
            "nc_mean_stacking_dg37": r["nc_mean_stacking_dg37"],
            "nc_melting_temp_est": r["nc_melting_temp_est"],
        })

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "locus": locus,
        "total": total,
        "returned": len(alleles),
        "alleles": alleles,
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


@router.get("/allele/{allele_name:path}")
async def get_hla_allele(allele_name: str):
    """Lookup a single HLA allele with full biophysical profile.

    Returns identity, sequence metadata, whole-allele biophysics,
    non-coding biophysics, and per-feature (exon/intron/UTR) breakdown.

    The non-coding biophysics (nc_*) are the key scientific output:
    these capture the "hidden layer" of expression-relevant variation
    that protein-level transplant matching misses entirely.
    """
    start = time.monotonic()
    layer_id = await _get_hla_layer_id()

    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM hla.alleles WHERE layer_id = $1 AND allele_name = $2",
            layer_id, allele_name,
        )

        if not row:
            raise HTTPException(404, {
                "error": {"code": "ALLELE_NOT_FOUND", "message": f"Allele '{allele_name}' not found."}
            })

        # Fetch features
        features = await conn.fetch(
            """SELECT feature_type, feature_number, feature_label,
                      start_pos, end_pos, length_bp, sequence_hash,
                      gc_content, cpg_count, cpg_density, cpg_obs_exp,
                      mean_stacking_dg37, melting_temp_est,
                      mean_a_form_prop, mean_z_form_prop, total_z_penalty,
                      mean_major_groove_w, mean_minor_groove_w,
                      cpg_island_count, flag_count
               FROM hla.allele_features
               WHERE layer_id = $1 AND allele_id = $2
               ORDER BY feature_number""",
            layer_id, row["id"],
        )

    result = {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "layers_resolved": [{
            "layer_key": "hla_allele_biophysics",
            "evidence_class": "D",
            "source": f"IPD-IMGT/HLA v{row['imgt_version']}",
        }],
        "identity": {
            "allele_name": row["allele_name"],
            "locus": row["locus"],
            "allele_group": row["allele_group"],
            "protein": row["protein"],
            "synonymous": row["synonymous"],
            "noncoding": row["noncoding"],
            "hla_class": row["hla_class"],
            "expression_suffix": row["expression_suffix"],
        },
        "sequence_metadata": {
            "has_genomic": row["has_genomic"],
            "sequence_length": row["sequence_length"],
            "cds_length": row["cds_length"],
            "n_exons": row["n_exons"],
            "n_introns": row["n_introns"],
        },
        "biophysics": _allele_summary(dict(row)),
        "noncoding_biophysics": _nc_summary(dict(row)),
        "flag_counts": {
            "total": row["flag_count_total"],
            "warnings": row["flag_count_warnings"],
        },
        "features": [dict(f) for f in features],
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }

    return result


# ── Comparison endpoint ──────────────────────────────────────────────────────


class HLACompareRequest(BaseModel):
    """Request body for HLA allele comparison."""
    alleles: list[str] = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Allele names to compare (2-10). First is reference.",
    )
    focus: str = Field(
        "noncoding",
        pattern="^(full|noncoding|coding)$",
        description="Focus area for deltas: 'noncoding' (default), 'full', or 'coding'.",
    )


@router.post("/compare")
async def compare_hla_alleles(body: HLACompareRequest):
    """Compare biophysical properties of HLA alleles.

    Takes 2-10 allele names and returns per-allele biophysics plus delta
    tables. When focus='noncoding' (default), deltas emphasize intron and
    UTR differences — the hidden layer of expression mismatch identified
    by Bettens et al. 2022 (PLOS Genetics).

    The first allele is the reference for delta computation.
    """
    start = time.monotonic()
    layer_id = await _get_hla_layer_id()

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM hla.alleles
               WHERE layer_id = $1 AND allele_name = ANY($2::text[])""",
            layer_id, body.alleles,
        )

    # Index by name
    by_name = {r["allele_name"]: dict(r) for r in rows}

    # Check for missing alleles
    missing = [a for a in body.alleles if a not in by_name]
    if missing:
        raise HTTPException(404, {
            "error": {"code": "ALLELES_NOT_FOUND", "message": f"Alleles not found: {missing}"}
        })

    # Check if all share the same protein
    proteins = {(r["locus"], r["allele_group"], r["protein"]) for r in by_name.values()}
    shared_protein = len(proteins) == 1

    # Build comparison table
    comparison = {}
    for name in body.alleles:
        r = by_name[name]
        comparison[name] = {
            "allele_name": name,
            "locus": r["locus"],
            "expression_suffix": r["expression_suffix"],
            "sequence_length": r["sequence_length"],
            "biophysics": _allele_summary(r),
            "noncoding_biophysics": _nc_summary(r),
        }

    # Compute deltas vs reference
    ref_name = body.alleles[0]
    ref = by_name[ref_name]

    if body.focus == "noncoding":
        ref_summary = _nc_summary(ref)
    elif body.focus == "coding":
        ref_summary = _allele_summary(ref)
    else:
        ref_summary = _allele_summary(ref)

    deltas = {}
    for name in body.alleles[1:]:
        r = by_name[name]
        if body.focus == "noncoding":
            other_summary = _nc_summary(r)
        elif body.focus == "coding":
            other_summary = _allele_summary(r)
        else:
            other_summary = _allele_summary(r)

        deltas[name] = _compute_delta(ref_summary, other_summary)

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "n_alleles": len(body.alleles),
        "reference": ref_name,
        "focus": body.focus,
        "shared_protein": shared_protein,
        "comparison": comparison,
        "deltas_vs_reference": deltas,
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


# ── Match scoring endpoint ──────────────────────────────────────────────────


class HLAGenotype(BaseModel):
    allele_1: str
    allele_2: str


class HLAMatchRequest(BaseModel):
    """Request body for transplant match biophysics scoring."""
    donor: dict[str, HLAGenotype] = Field(
        ...,
        description="Donor genotype: {locus: {allele_1, allele_2}}",
    )
    recipient: dict[str, HLAGenotype] = Field(
        ...,
        description="Recipient genotype: {locus: {allele_1, allele_2}}",
    )


@router.post("/match-score")
async def hla_match_score(body: HLAMatchRequest):
    """Compute biophysical mismatch score for donor-recipient HLA matching.

    Beyond protein-level matching (current clinical standard), computes
    non-coding biophysical divergence that may correlate with expression
    mismatch. Based on Bettens et al. 2022: non-coding cis-eQTLs explain
    13-50% of HLA class I expression variance.

    Returns per-locus protein match status, non-coding biophysical deltas,
    and aggregate mismatch score.
    """
    start = time.monotonic()
    layer_id = await _get_hla_layer_id()

    # Collect all allele names
    all_alleles = set()
    for geno in list(body.donor.values()) + list(body.recipient.values()):
        all_alleles.add(geno.allele_1)
        all_alleles.add(geno.allele_2)

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT * FROM hla.alleles
               WHERE layer_id = $1 AND allele_name = ANY($2::text[])""",
            layer_id, list(all_alleles),
        )

    by_name = {r["allele_name"]: dict(r) for r in rows}

    # Check for missing
    missing = [a for a in all_alleles if a not in by_name]
    if missing:
        raise HTTPException(404, {
            "error": {"code": "ALLELES_NOT_FOUND", "message": f"Alleles not found: {missing}"}
        })

    # Score each locus
    per_locus = {}
    total_nc_divergence = 0.0
    n_scored = 0

    for locus in set(list(body.donor.keys()) + list(body.recipient.keys())):
        d_geno = body.donor.get(locus)
        r_geno = body.recipient.get(locus)
        if not d_geno or not r_geno:
            per_locus[locus] = {"status": "missing_genotype"}
            continue

        # Protein-level match
        d_proteins = {
            (by_name[d_geno.allele_1]["allele_group"], by_name[d_geno.allele_1]["protein"]),
            (by_name[d_geno.allele_2]["allele_group"], by_name[d_geno.allele_2]["protein"]),
        }
        r_proteins = {
            (by_name[r_geno.allele_1]["allele_group"], by_name[r_geno.allele_1]["protein"]),
            (by_name[r_geno.allele_2]["allele_group"], by_name[r_geno.allele_2]["protein"]),
        }
        protein_match = d_proteins == r_proteins

        # Non-coding divergence: average absolute delta across all donor-recipient allele pairs
        nc_deltas = []
        for d_allele in [d_geno.allele_1, d_geno.allele_2]:
            for r_allele in [r_geno.allele_1, r_geno.allele_2]:
                d_nc = _nc_summary(by_name[d_allele])
                r_nc = _nc_summary(by_name[r_allele])
                delta = _compute_delta(d_nc, r_nc)
                nc_deltas.append(delta)

        # Compute mean absolute delta for key metrics
        key_metrics = ["delta_gc_content", "delta_mean_stacking_dg37", "delta_melting_temp_est"]
        locus_divergence = 0.0
        for metric in key_metrics:
            values = [abs(d.get(metric, 0) or 0) for d in nc_deltas]
            if values:
                locus_divergence += sum(values) / len(values)

        total_nc_divergence += locus_divergence
        n_scored += 1

        per_locus[locus] = {
            "protein_match": protein_match,
            "donor_alleles": [d_geno.allele_1, d_geno.allele_2],
            "recipient_alleles": [r_geno.allele_1, r_geno.allele_2],
            "nc_divergence_score": round(locus_divergence, 6),
            "nc_deltas": nc_deltas,
        }

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "n_loci_scored": n_scored,
        "aggregate_nc_divergence": round(total_nc_divergence, 6),
        "per_locus": per_locus,
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


# ── Non-coding divergence analysis ──────────────────────────────────────────


class NCDivergenceRequest(BaseModel):
    """Request body for non-coding divergence analysis."""
    locus: str = Field(..., description="HLA locus (e.g., 'HLA-A')")
    allele_group: str = Field(..., description="1st field (e.g., '02')")
    protein: str = Field(..., description="2nd field (e.g., '01')")


@router.post("/noncoding-divergence")
async def noncoding_divergence(body: NCDivergenceRequest):
    """Analyze non-coding biophysical divergence among protein-identical alleles.

    Given a locus + protein (e.g., HLA-A*02:01), finds all alleles encoding
    the same protein and ranks them by non-coding biophysical divergence.

    This directly addresses the Bettens et al. 2022 finding: non-coding
    variants explain 13-50% of HLA expression differences even when the
    protein sequence is identical.
    """
    start = time.monotonic()
    locus = _validate_locus(body.locus)
    layer_id = await _get_hla_layer_id()

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT allele_name, synonymous, noncoding,
                      expression_suffix, sequence_length,
                      gc_content, mean_stacking_dg37, melting_temp_est,
                      nc_gc_content, nc_cpg_count, nc_cpg_density,
                      nc_mean_stacking_dg37, nc_melting_temp_est,
                      nc_mean_a_form_prop, nc_mean_z_form_prop,
                      nc_total_z_penalty, nc_cpg_island_count
               FROM hla.alleles
               WHERE layer_id = $1
                 AND locus = $2
                 AND allele_group = $3
                 AND protein = $4
                 AND has_genomic = true
               ORDER BY allele_name""",
            layer_id, locus, body.allele_group, body.protein,
        )

    if not rows:
        raise HTTPException(404, {
            "error": {
                "code": "NO_ALLELES",
                "message": f"No genomic alleles found for {locus}*{body.allele_group}:{body.protein}",
            }
        })

    alleles_data = [dict(r) for r in rows]

    # Compute variance across alleles for each nc metric
    nc_metrics = [
        "nc_gc_content", "nc_cpg_density", "nc_mean_stacking_dg37",
        "nc_melting_temp_est", "nc_mean_a_form_prop", "nc_mean_z_form_prop",
        "nc_total_z_penalty", "nc_cpg_island_count",
    ]

    metric_stats = {}
    for metric in nc_metrics:
        values = [r[metric] for r in alleles_data if r[metric] is not None]
        if len(values) >= 2:
            mean_v = sum(values) / len(values)
            var_v = sum((v - mean_v) ** 2 for v in values) / (len(values) - 1)
            metric_stats[metric] = {
                "n": len(values),
                "mean": round(mean_v, 6),
                "variance": round(var_v, 8),
                "range": [round(min(values), 6), round(max(values), 6)],
            }

    # Rank metrics by variance (most variable = most expression-relevant)
    ranked = sorted(metric_stats.items(), key=lambda x: x[1]["variance"], reverse=True)

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "query": {
            "locus": locus,
            "allele_group": body.allele_group,
            "protein": body.protein,
        },
        "n_alleles": len(alleles_data),
        "alleles": alleles_data,
        "metric_variance": metric_stats,
        "ranked_by_variance": [{"metric": k, **v} for k, v in ranked],
        "most_variable_metric": ranked[0][0] if ranked else None,
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


# ── Expression correlation ─────────────────────────────────────────────────

# Expression suffix semantics (IPD-IMGT/HLA nomenclature):
#   NULL  = normal expression
#   N     = null (not expressed)
#   L     = low cell-surface expression
#   S     = soluble/secreted (not on cell surface)
#   C     = cytoplasmic (retained intracellularly)
#   A     = aberrant expression
#   Q     = questionable expression

EXPRESSION_LABELS: dict[str | None, str] = {
    None: "normal",
    "N": "null",
    "L": "low",
    "S": "secreted",
    "C": "cytoplasmic",
    "A": "aberrant",
    "Q": "questionable",
}

# Biophysical metrics to test — whole-allele and non-coding
WHOLE_METRICS = [
    "gc_content", "cpg_count", "cpg_density", "cpg_obs_exp", "cpg_island_count",
    "mean_stacking_dg37", "melting_temp_est",
    "mean_a_form_prop", "mean_z_form_prop", "total_z_penalty",
    "mean_major_groove_w", "mean_minor_groove_w",
]
NC_METRICS = [
    "nc_gc_content", "nc_cpg_count", "nc_cpg_density",
    "nc_mean_stacking_dg37", "nc_melting_temp_est",
    "nc_mean_a_form_prop", "nc_mean_z_form_prop",
    "nc_total_z_penalty", "nc_cpg_island_count",
]


def _cohens_d(mean1: float, sd1: float, n1: int, mean2: float, sd2: float, n2: int) -> float | None:
    """Compute Cohen's d (pooled SD) between two groups. Returns None if undefined."""
    if n1 < 2 or n2 < 2:
        return None
    pooled_var = ((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2)
    if pooled_var <= 0:
        return None
    return (mean1 - mean2) / math.sqrt(pooled_var)


def _group_stats(values: list[float]) -> dict | None:
    """Compute n, mean, sd for a list of values."""
    if len(values) < 1:
        return None
    n = len(values)
    mean = sum(values) / n
    if n < 2:
        return {"n": n, "mean": round(mean, 6), "sd": None}
    var = sum((v - mean) ** 2 for v in values) / (n - 1)
    return {"n": n, "mean": round(mean, 6), "sd": round(math.sqrt(var), 6)}


@router.get("/expression-correlation")
async def expression_correlation(
    locus: str | None = Query(None, description="Filter by locus (e.g., 'A' or 'HLA-A')"),
    focus: str = Query("noncoding", pattern="^(noncoding|full|both)$",
                       description="Metric set: 'noncoding' (default), 'full' (whole-allele), or 'both'"),
):
    """Correlate biophysical properties with expression class.

    Groups all genomic HLA alleles by their IMGT expression suffix
    (normal, null, low, secreted, cytoplasmic, aberrant, questionable)
    and computes per-class summary statistics for each biophysical metric.

    Returns Cohen's d effect sizes for normal vs each aberrant class,
    ranked by absolute effect size. This tests the Bettens et al. 2022
    hypothesis: do material-channel properties of non-coding DNA predict
    expression phenotype?
    """
    start = time.monotonic()
    layer_id = await _get_hla_layer_id()

    # Build query
    clauses = ["layer_id = $1", "has_genomic = true"]
    params: list[Any] = [layer_id]
    idx = 2

    if locus is not None:
        normalized = locus.upper()
        if not normalized.startswith("HLA-"):
            normalized = f"HLA-{normalized}"
        if normalized not in VALID_LOCI:
            raise HTTPException(400, {
                "error": {"code": "INVALID_LOCUS", "message": f"Unknown locus '{locus}'. Valid: {sorted(VALID_LOCI)}"}
            })
        clauses.append(f"locus = ${idx}")
        params.append(normalized)
        idx += 1

    where = " AND ".join(clauses)

    # Select the metrics we need
    if focus == "noncoding":
        metrics = NC_METRICS
    elif focus == "full":
        metrics = WHOLE_METRICS
    else:
        metrics = WHOLE_METRICS + NC_METRICS

    cols = ", ".join(["expression_suffix", "locus"] + metrics)

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"SELECT {cols} FROM hla.alleles WHERE {where}",
            *params,
        )

    if not rows:
        raise HTTPException(404, {
            "error": {"code": "NO_ALLELES", "message": "No genomic alleles found for the given filters."}
        })

    # Group by expression class
    groups: dict[str, list[dict]] = {}
    for r in rows:
        label = EXPRESSION_LABELS.get(r["expression_suffix"], r["expression_suffix"] or "normal")
        groups.setdefault(label, []).append(dict(r))

    # Class distribution
    class_distribution = {
        label: {"n": len(alleles), "suffix": next(
            (k for k, v in EXPRESSION_LABELS.items() if v == label), None
        )}
        for label, alleles in sorted(groups.items(), key=lambda x: -len(x[1]))
    }

    # Per-class stats for each metric
    per_class_stats: dict[str, dict[str, dict]] = {}
    for metric in metrics:
        per_class_stats[metric] = {}
        for label, alleles_in_class in groups.items():
            values = [r[metric] for r in alleles_in_class if r[metric] is not None]
            stats = _group_stats(values)
            if stats:
                per_class_stats[metric][label] = stats

    # Cohen's d: normal vs each aberrant class
    effect_sizes: list[dict] = []
    normal_alleles = groups.get("normal", [])

    for metric in metrics:
        normal_values = [r[metric] for r in normal_alleles if r[metric] is not None]
        normal_stats = _group_stats(normal_values)
        if not normal_stats or normal_stats["sd"] is None:
            continue

        for label, alleles_in_class in groups.items():
            if label == "normal":
                continue
            class_values = [r[metric] for r in alleles_in_class if r[metric] is not None]
            class_stats = _group_stats(class_values)
            if not class_stats or class_stats["sd"] is None:
                continue

            d = _cohens_d(
                normal_stats["mean"], normal_stats["sd"], normal_stats["n"],
                class_stats["mean"], class_stats["sd"], class_stats["n"],
            )
            if d is not None:
                effect_sizes.append({
                    "metric": metric,
                    "expression_class": label,
                    "cohens_d": round(d, 4),
                    "abs_d": round(abs(d), 4),
                    "normal_mean": normal_stats["mean"],
                    "normal_sd": normal_stats["sd"],
                    "normal_n": normal_stats["n"],
                    "class_mean": class_stats["mean"],
                    "class_sd": class_stats["sd"],
                    "class_n": class_stats["n"],
                    "direction": "normal > class" if d > 0 else "class > normal",
                })

    # Sort by absolute effect size
    effect_sizes.sort(key=lambda x: x["abs_d"], reverse=True)

    # Also compute normal vs ALL-aberrant (pooled)
    aberrant_alleles = [r for label, recs in groups.items() if label != "normal" for r in recs]
    pooled_effects: list[dict] = []
    if aberrant_alleles:
        for metric in metrics:
            normal_values = [r[metric] for r in normal_alleles if r[metric] is not None]
            aberrant_values = [r[metric] for r in aberrant_alleles if r[metric] is not None]
            ns = _group_stats(normal_values)
            ab = _group_stats(aberrant_values)
            if ns and ab and ns["sd"] is not None and ab["sd"] is not None:
                d = _cohens_d(ns["mean"], ns["sd"], ns["n"], ab["mean"], ab["sd"], ab["n"])
                if d is not None:
                    pooled_effects.append({
                        "metric": metric,
                        "cohens_d": round(d, 4),
                        "abs_d": round(abs(d), 4),
                        "normal_mean": ns["mean"],
                        "normal_n": ns["n"],
                        "aberrant_mean": ab["mean"],
                        "aberrant_n": ab["n"],
                        "direction": "normal > aberrant" if d > 0 else "aberrant > normal",
                    })
        pooled_effects.sort(key=lambda x: x["abs_d"], reverse=True)

    return {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "focus": focus,
        "locus": locus,
        "n_alleles": len(rows),
        "class_distribution": class_distribution,
        "per_class_stats": per_class_stats,
        "effect_sizes": effect_sizes,
        "pooled_normal_vs_aberrant": pooled_effects,
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }


# ── Within-protein expression test ─────────────────────────────────────────


@router.get("/expression-within-protein")
async def expression_within_protein(
    locus: str | None = Query(None, description="Filter by locus"),
    min_alleles: int = Query(3, ge=2, description="Minimum alleles per protein group"),
    include_features: bool = Query(False, description="Include per-feature breakdown for top groups"),
):
    """Test whether non-coding biophysics predict expression within protein-identical alleles.

    The strongest test of the Bettens hypothesis: among alleles encoding the
    SAME protein, do the ones with expression suffixes (L, Q, S, C, A) have
    different non-coding biophysics than their normally-expressed siblings?

    Controls for protein-level variation — any difference must come from
    non-coding regions (introns, UTRs).

    Algorithm:
    1. Find protein groups with ≥ min_alleles genomic alleles AND at least
       1 suffix-bearing AND 1 normal allele
    2. Within each group, compute Cohen's d (normal vs suffix) per NC metric
    3. Aggregate across groups: mean d, direction consistency, top hits
    """
    start = time.monotonic()
    layer_id = await _get_hla_layer_id()

    # Build query
    clauses = ["layer_id = $1", "has_genomic = true"]
    params: list[Any] = [layer_id]
    idx = 2

    if locus is not None:
        normalized = locus.upper()
        if not normalized.startswith("HLA-"):
            normalized = f"HLA-{normalized}"
        if normalized not in VALID_LOCI:
            raise HTTPException(400, {
                "error": {"code": "INVALID_LOCUS", "message": f"Unknown locus '{locus}'."}
            })
        clauses.append(f"locus = ${idx}")
        params.append(normalized)
        idx += 1

    where = " AND ".join(clauses)
    metrics = NC_METRICS

    cols = ", ".join([
        "allele_name", "locus", "allele_group", "protein",
        "expression_suffix",
    ] + metrics)

    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(f"SELECT id, {cols} FROM hla.alleles WHERE {where}", *params)

    # Group by protein
    protein_groups: dict[tuple[str, str, str], list[dict]] = {}
    for r in rows:
        key = (r["locus"], r["allele_group"], r["protein"])
        protein_groups.setdefault(key, []).append(dict(r))

    # Filter to qualifying groups
    qualifying: list[dict] = []
    for (loc, grp, prot), alleles in protein_groups.items():
        if len(alleles) < min_alleles:
            continue
        normal = [a for a in alleles if a["expression_suffix"] is None]
        suffix = [a for a in alleles if a["expression_suffix"] is not None
                  and a["expression_suffix"] != "N"]  # Exclude null — coding knockouts
        if not normal or not suffix:
            continue

        # Compute per-metric Cohen's d within this protein group
        group_effects = []
        for metric in metrics:
            nv = [a[metric] for a in normal if a[metric] is not None]
            sv = [a[metric] for a in suffix if a[metric] is not None]
            ns = _group_stats(nv)
            ss = _group_stats(sv)
            if not ns or not ss:
                continue
            if ns["sd"] is not None and ss["sd"] is not None:
                d = _cohens_d(ns["mean"], ns["sd"], ns["n"], ss["mean"], ss["sd"], ss["n"])
            elif ns["sd"] is not None and ss["n"] == 1:
                # Single suffix allele: use normal SD for effect size
                d = (ns["mean"] - ss["mean"]) / ns["sd"] if ns["sd"] > 0 else None
            else:
                d = None
            if d is not None:
                group_effects.append({
                    "metric": metric,
                    "cohens_d": round(d, 4),
                    "abs_d": round(abs(d), 4),
                    "normal_mean": ns["mean"],
                    "normal_n": ns["n"],
                    "suffix_mean": ss["mean"],
                    "suffix_n": ss["n"],
                })

        suffix_labels = [a["expression_suffix"] for a in suffix]
        suffix_names = [a["allele_name"] for a in suffix]

        qualifying.append({
            "protein": f"{loc.replace('HLA-', '')}*{grp}:{prot}",
            "locus": loc,
            "allele_group": grp,
            "protein_field": prot,
            "n_total": len(alleles),
            "n_normal": len(normal),
            "n_suffix": len(suffix),
            "suffix_types": sorted(set(suffix_labels)),
            "suffix_alleles": suffix_names[:10],  # cap at 10 for response size
            "effects": sorted(group_effects, key=lambda x: x["abs_d"], reverse=True),
            "max_abs_d": max((e["abs_d"] for e in group_effects), default=0),
        })

    # Sort groups by max effect size
    qualifying.sort(key=lambda x: x["max_abs_d"], reverse=True)

    # Aggregate across all qualifying groups: mean effect per metric
    metric_aggregates: dict[str, list[float]] = {m: [] for m in metrics}
    metric_directions: dict[str, dict[str, int]] = {m: {"positive": 0, "negative": 0} for m in metrics}
    for group in qualifying:
        for effect in group["effects"]:
            m = effect["metric"]
            metric_aggregates[m].append(effect["cohens_d"])
            if effect["cohens_d"] > 0:
                metric_directions[m]["positive"] += 1
            else:
                metric_directions[m]["negative"] += 1

    aggregate_effects = []
    for metric in metrics:
        values = metric_aggregates[metric]
        if not values:
            continue
        mean_d = sum(values) / len(values)
        mean_abs_d = sum(abs(v) for v in values) / len(values)
        dirs = metric_directions[metric]
        total = dirs["positive"] + dirs["negative"]
        consistency = max(dirs["positive"], dirs["negative"]) / total if total > 0 else 0
        aggregate_effects.append({
            "metric": metric,
            "mean_d": round(mean_d, 4),
            "mean_abs_d": round(mean_abs_d, 4),
            "n_groups": len(values),
            "direction_positive": dirs["positive"],
            "direction_negative": dirs["negative"],
            "direction_consistency": round(consistency, 3),
            "dominant_direction": "normal > suffix" if dirs["positive"] >= dirs["negative"] else "suffix > normal",
        })
    aggregate_effects.sort(key=lambda x: x["mean_abs_d"], reverse=True)

    # Feature-level breakdown for top groups (if requested)
    feature_breakdown = []
    if include_features and qualifying:
        top_groups = qualifying[:5]
        for group in top_groups:
            loc = group["locus"]
            grp = group["allele_group"]
            prot = group["protein_field"]

            # Get allele IDs for this protein group
            group_alleles = protein_groups[(loc, grp, prot)]
            normal_ids = [a["id"] for a in group_alleles if a["expression_suffix"] is None]
            suffix_ids = [a["id"] for a in group_alleles
                         if a["expression_suffix"] is not None and a["expression_suffix"] != "N"]

            if not normal_ids or not suffix_ids:
                continue

            all_ids = normal_ids + suffix_ids
            async with pool.acquire() as conn:
                features = await conn.fetch(
                    """SELECT allele_id, feature_type, feature_label, length_bp,
                              gc_content, cpg_count, cpg_density,
                              mean_stacking_dg37, melting_temp_est,
                              mean_a_form_prop, mean_z_form_prop
                       FROM hla.allele_features
                       WHERE layer_id = $1 AND allele_id = ANY($2::bigint[])
                         AND feature_type IN ('intron', '5utr', '3utr')
                       ORDER BY feature_label""",
                    layer_id, all_ids,
                )

            # Group features by label
            by_label: dict[str, dict[str, list]] = {}
            normal_id_set = set(normal_ids)
            for f in features:
                label = f["feature_label"]
                is_normal = f["allele_id"] in normal_id_set
                cat = "normal" if is_normal else "suffix"
                by_label.setdefault(label, {"normal": [], "suffix": []})
                by_label[label][cat].append(dict(f))

            # Compute per-feature effects
            feat_metrics = ["gc_content", "cpg_density", "mean_stacking_dg37", "melting_temp_est"]
            feature_effects = []
            for label, groups_by_cat in sorted(by_label.items()):
                for fm in feat_metrics:
                    nv = [f[fm] for f in groups_by_cat["normal"] if f[fm] is not None]
                    sv = [f[fm] for f in groups_by_cat["suffix"] if f[fm] is not None]
                    ns = _group_stats(nv)
                    ss = _group_stats(sv)
                    if not ns or not ss:
                        continue
                    if ns["sd"] is not None and ss["sd"] is not None:
                        d = _cohens_d(ns["mean"], ns["sd"], ns["n"], ss["mean"], ss["sd"], ss["n"])
                    elif ns["sd"] is not None and ss["n"] == 1:
                        d = (ns["mean"] - ss["mean"]) / ns["sd"] if ns["sd"] > 0 else None
                    else:
                        d = None
                    if d is not None:
                        feature_effects.append({
                            "feature": label,
                            "metric": fm,
                            "cohens_d": round(d, 4),
                            "abs_d": round(abs(d), 4),
                            "normal_mean": ns["mean"],
                            "suffix_mean": ss["mean"],
                        })

            feature_effects.sort(key=lambda x: x["abs_d"], reverse=True)
            feature_breakdown.append({
                "protein": group["protein"],
                "n_features_compared": len(feature_effects),
                "effects": feature_effects[:20],
            })

    result: dict[str, Any] = {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "locus": locus,
        "min_alleles": min_alleles,
        "n_protein_groups_tested": len(qualifying),
        "n_protein_groups_total": len(protein_groups),
        "aggregate_effects": aggregate_effects,
        "protein_groups": qualifying[:30],  # top 30
        "timing": {"query_time_ms": round((time.monotonic() - start) * 1000, 1)},
    }
    if feature_breakdown:
        result["feature_breakdown"] = feature_breakdown

    return result
