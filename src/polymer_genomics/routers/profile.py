"""Region profile — composite endpoint.

Given a genomic region, queries all available layers and returns a structured
summary with significance flags. This is the "tell me everything about this
region" query that showcases the cross-layer correlation engine.
"""

import asyncio
import logging
import time

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

from polymer_genomics import __version__
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS, safe_table
from polymer_genomics.coordinates import api_to_db, parse_region
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import DATA_VERSION

router = APIRouter(prefix="/v1/profile", tags=["profile"])


@router.get("/{build}/{region}")
async def region_profile(
    build: str,
    region: str,
    include_negative: bool = Query(
        False,
        description="Include layers with NO features in the region (informative absences).",
    ),
):
    """Comprehensive profile of a genomic region across all data layers.

    Runs all active layers and returns a structured summary including:
    - Feature counts per layer
    - Summary statistics for continuous layers
    - Significance flags (unusual values relative to genome-wide distributions)
    - Negative annotations (layers with NO features, if include_negative=true)

    Max region size: 1 Mb. For larger regions, use aggregate_region.
    """
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    try:
        parsed = parse_region(region)
    except ValueError as e:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_REGION", "message": str(e)}},
        )

    chr_name = parsed["chr"]
    chr_id = CHR_NAME_TO_ID.get(chr_name)
    if chr_id is None:
        raise HTTPException(
            400,
            {"error": {"code": "INVALID_CHROMOSOME", "message": f"Unknown: {chr_name}"}},
        )

    internal = api_to_db(parsed["start"], parsed["end"])
    region_length = internal["end"] - internal["start"]

    # Cap at 1 Mb for this composite query
    if region_length > 1_000_000:
        raise HTTPException(
            400,
            {
                "error": {
                    "code": "REGION_TOO_LARGE",
                    "message": "region_profile supports up to 1 Mb. Use aggregate_region for larger regions.",
                    "limit": 1_000_000,
                    "requested": region_length,
                }
            },
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Get all active layers
        layer_rows = await conn.fetch(
            """SELECT id, layer_key, layer_type, name, evidence_class, tier
               FROM registry.active_layers
               WHERE genome_build = $1::genome_build""",
            build,
        )

        db_start = time.monotonic()
        layer_summaries = []
        present_layers = []
        absent_layers = []

        sem = asyncio.Semaphore(8)

        async def _count_layer(lr):
            layer_type = lr["layer_type"]
            count_sql = _count_sql_for_type(layer_type)
            if count_sql is None:
                return lr, 0
            async with sem:
                async with pool.acquire() as layer_conn:
                    count = await layer_conn.fetchval(
                        count_sql,
                        build, chr_id, internal["start"], internal["end"], lr["id"],
                    )
            return lr, count if count is not None else 0

        results = await asyncio.gather(*[_count_layer(lr) for lr in layer_rows])

        for lr, count in results:
            entry = {
                "layer_key": lr["layer_key"],
                "name": lr["name"],
                "layer_type": lr["layer_type"],
                "evidence_class": lr["evidence_class"],
                "tier": lr["tier"],
                "feature_count": count,
                "density_per_kb": round(count / (region_length / 1000), 2) if region_length > 0 else 0,
            }

            if count > 0:
                present_layers.append(entry)
            else:
                absent_layers.append(entry)

            layer_summaries.append(entry)

        db_time = (time.monotonic() - db_start) * 1000

    # Build significance flags
    flags = _compute_significance_flags(layer_summaries, region_length)

    query_time_ms = round((time.monotonic() - start_time) * 1000, 1)

    result = {
        "status": "complete",
        "api_version": __version__,
        "data_version": DATA_VERSION,
        "query": {
            "build": build,
            "region": {"chr": chr_name, "start": parsed["start"], "end": parsed["end"]},
            "region_length_bp": region_length,
        },
        "summary": {
            "total_layers_queried": len(layer_summaries),
            "layers_with_features": len(present_layers),
            "layers_without_features": len(absent_layers),
        },
        "layers": sorted(present_layers, key=lambda x: x["feature_count"], reverse=True),
        "flags": flags,
        "timing": {
            "query_time_ms": query_time_ms,
            "db_time_ms": round(db_time, 1),
        },
    }

    if include_negative:
        result["absent_layers"] = absent_layers

    return result


# ── Internal helpers ─────────────────────────────────────────────

# Table mapping for count queries by layer_type.
# Layer types intentionally excluded (no positional table — gene-level or
# reference-only data that doesn't participate in region profiles):
#   gene_set, pathway, gene_alias, gene_profile, clock, sbs
_COUNT_TABLES = {
    "cpg": "cpg.sites",
    "gene_model": "gene.features",
    "probe": "probe.coordinates",
    "isochore": "ref.isochores",
    "methylation": "ref.methylation_reference",
    "conservation": "conservation.scores",
    "regulatory": "regulatory.ccre",
    "expression": "expression.gene_tpm",
    "gene_cost": "bioenergetics.gene_costs",
    "protein_abundance": "bioenergetics.protein_abundance",
    "protein_atlas": "proteomics.tissue_expression",
    "constraint": "conservation.gene_constraint",
    "chromatin_state": "regulatory.chromatin_state",
    "repeat": "annotation.repeats",
    "herv": "annotation.herv_loci",
    "biophysics": "biophysics.sequence_properties",
    "sequence_biophysics": "biophysics.sequence_properties",
    "histone_mark": "regulatory.histone_peaks",
    "gwas": "annotation.gwas_associations",
    "nonb_dna": "fragility.nonb_dna",
    "breakpoint": "fragility.breakpoints",
    "fragility": "fragility.composite_score",
    "tad_domain": "regulatory.tad_domains",
    "hic_compartment": "regulatory.hic_compartment",
    "insulation_score": "regulatory.insulation_score",
    # ── Rosetta Stone Tier 9+ layers ───────────────────────────────
    "clinvar": "variation.clinvar_variants",
    "eqtl": "qtl.eqtls",
    "meqtl": "qtl.meqtls",
    "lad": "nuclear.lads",
    "nad": "nuclear.nads",
    "dmv": "nuclear.dmvs",
    "super_enhancer": "nuclear.super_enhancers",
    "enhancer_gene": "regulatory.enhancer_gene_links",
    "ultraconserved": "evolution.ultraconserved_elements",
    "archaic_methylation": "evolution.archaic_methylation",
    "protein_turnover": "bioenergetics.protein_turnover",
    "protein_properties": "bioenergetics.protein_properties",
    "protein_evolution": "conservation.protein_evolution",
    "structural_variant": "variation.structural_variants",
    "tcga_methylation": "methylation.tcga_pan_cancer",
    "selection_sweep": "evolution.selection_sweeps",
    "accelerated_region": "evolution.accelerated_regions",
    "te_exaptation": "evolution.te_exaptation",
    "tfbs": "regulatory.tfbs_peaks",
    # ── Audit gap closure ─────────────────────────────────────────
    "cpg_island": "cpg.islands",
    "archaic_introgression": "evolution.archaic_segments",
    "tf_binding": "regulatory.tf_binding_signal",
    "wgbs": "methylation.wgbs_1kb",
    "accessibility": "regulatory.accessibility_signal",
    "mutation_density": "annotation.mutation_density",
}


_ALLOWED_PROFILE_TABLES = frozenset(_COUNT_TABLES.values())


# Recombination tables lack coord/layer_id — custom count SQL
_RECOMB_COUNT_SQL = {
    "onco_events": (
        "SELECT count(*) FROM recombination.onco_events "
        "WHERE build = $1 AND chr_id = $2 AND start_pos < $4 AND end_pos > $3 AND ($5::uuid IS NOT NULL)"
    ),
    "dmc1_hotspots": (
        "SELECT count(*) FROM recombination.dmc1_hotspots "
        "WHERE build = $1 AND chr_id = $2 AND start_pos < $4 AND end_pos > $3 AND ($5::uuid IS NOT NULL)"
    ),
}


def _count_sql_for_type(layer_type: str) -> str | None:
    """Return a count SQL query for a given layer type, or None if unsupported."""
    if layer_type in _RECOMB_COUNT_SQL:
        return _RECOMB_COUNT_SQL[layer_type]
    table = _COUNT_TABLES.get(layer_type)
    if table is None:
        logger.warning("Unknown layer_type '%s' in region_profile — returning 0 count", layer_type)
        return None
    table = safe_table(table, _ALLOWED_PROFILE_TABLES)
    return (
        f"SELECT count(*) FROM {table} "
        f"WHERE build = $1::genome_build AND chr_id = $2 "
        f"AND coord && int4range($3, $4) AND layer_id = $5"
    )


def _compute_significance_flags(
    layer_summaries: list[dict], region_length: int
) -> list[dict]:
    """Compute significance flags based on feature densities."""
    flags = []

    for entry in layer_summaries:
        lt = entry["layer_type"]
        count = entry["feature_count"]
        density = entry["density_per_kb"]

        # CpG density flags
        if lt == "cpg" and density > 0:
            if density > 80:
                flags.append({
                    "type": "info",
                    "code": "HIGH_CPG_DENSITY",
                    "layer": entry["layer_key"],
                    "message": f"CpG density {density}/kb is very high (CpG island likely)",
                    "value": density,
                })
            elif density < 5 and region_length >= 1000:
                flags.append({
                    "type": "info",
                    "code": "LOW_CPG_DENSITY",
                    "layer": entry["layer_key"],
                    "message": f"CpG density {density}/kb is very low (CpG desert)",
                    "value": density,
                })

        # Conservation flags
        if lt == "conservation" and count == 0 and region_length >= 1000:
            flags.append({
                "type": "info",
                "code": "NO_CONSERVATION_DATA",
                "layer": entry["layer_key"],
                "message": "No conservation scores in this region",
            })

        # Regulatory flags
        if lt == "regulatory" and density > 5:
            flags.append({
                "type": "info",
                "code": "REGULATORY_DENSE",
                "layer": entry["layer_key"],
                "message": f"High regulatory element density ({density}/kb)",
                "value": density,
            })

        # Non-B DNA flags
        if lt == "nonb_dna" and count > 0:
            flags.append({
                "type": "warning",
                "code": "NONB_DNA_PRESENT",
                "layer": entry["layer_key"],
                "message": f"Non-B DNA structures detected ({count} features)",
                "value": count,
            })

        # GWAS flags
        if lt == "gwas" and count > 0:
            flags.append({
                "type": "info",
                "code": "GWAS_HITS",
                "layer": entry["layer_key"],
                "message": f"{count} GWAS associations in this region",
                "value": count,
            })

    return flags
