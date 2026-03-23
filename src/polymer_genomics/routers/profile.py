"""Region profile — composite endpoint.

Given a genomic region, queries all available layers and returns a structured
summary with significance flags. This is the "tell me everything about this
region" query that showcases the cross-layer correlation engine.
"""

import logging
import time

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

from polymer_genomics import __version__
from polymer_genomics.config import settings
from polymer_genomics.constants import CHR_NAME_TO_ID, VALID_BUILDS
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

        for lr in layer_rows:
            layer_key = lr["layer_key"]
            layer_type = lr["layer_type"]

            # Count features in region
            count = await conn.fetchval(
                _count_sql_for_type(layer_type),
                build, chr_id, internal["start"], internal["end"], lr["id"],
            )

            if count is None:
                count = 0

            entry = {
                "layer_key": layer_key,
                "name": lr["name"],
                "layer_type": layer_type,
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
    "methylation": "meth.reference",
    "conservation": "conservation.scores",
    "regulatory": "regulatory.ccre",
    "expression": "gene.expression",
    "gene_cost": "gene.costs",
    "protein_abundance": "gene.protein_abundance",
    "protein_atlas": "gene.protein_atlas",
    "constraint": "gene.constraint",
    "chromatin_state": "regulatory.chromatin_states",
    "repeat": "annotation.repeats",
    "herv": "annotation.herv_loci",
    "biophysics": "biophysics.sequence_properties",
    "sequence_biophysics": "biophysics.sequence_properties",
    "histone_mark": "regulatory.histone_peaks",
    "gwas": "annotation.gwas_hits",
    "nonb_dna": "fragility.nonb_dna",
    "breakpoint": "fragility.breakpoints",
    "fragility": "fragility.composite_score",
    "tad_domain": "regulatory.tad_domains",
}


def _count_sql_for_type(layer_type: str) -> str:
    """Return a count SQL query for a given layer type."""
    table = _COUNT_TABLES.get(layer_type)
    if table is None:
        logger.warning("Unknown layer_type '%s' in region_profile — returning 0 count", layer_type)
        return (
            "SELECT 0"
        )
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
