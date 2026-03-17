from fastapi import APIRouter, HTTPException, Query

from polymer_genomics.constants import VALID_BUILDS
from polymer_genomics.db import get_pool
from polymer_genomics.layer_licenses import LAYER_SOURCE_INFO

router = APIRouter(prefix="/v1/layers", tags=["layers"])


@router.get("")
async def list_layers(
    type: str | None = Query(None),
    build: str | None = Query(None),
    active: bool = Query(True),
    evidence_class: str | None = Query(None),
    tier: str | None = Query(None),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        query = "SELECT * FROM registry.layers WHERE 1=1"
        params: list = []
        idx = 1
        if active:
            query += f" AND is_active = ${idx}"
            params.append(True)
            idx += 1
        if type:
            query += f" AND layer_type = ${idx}::layer_type"
            params.append(type)
            idx += 1
        if build:
            query += f" AND genome_build = ${idx}::genome_build"
            params.append(build)
            idx += 1
        if evidence_class:
            query += f" AND evidence_class = ${idx}::polymer_evidence_class"
            params.append(evidence_class)
            idx += 1
        if tier:
            query += f" AND tier = ${idx}::polymer_tier"
            params.append(tier)
            idx += 1
        query += " ORDER BY layer_key, version"
        rows = await conn.fetch(query, *params)

    layers = [
        {
            "layer_key": r["layer_key"],
            "version": r["version"],
            "name": r["name"],
            "type": r["layer_type"],
            "build": r["genome_build"],
            "license_class": r["license_class"],
            "row_count": r["row_count"],
            "is_default": r["is_default"],
            "evidence_class": r["evidence_class"],
            "tier": r["tier"],
            "equilibrium_regime": r["equilibrium_regime"],
            "statefulness": r["statefulness"],
            "validation_status": r["validation_status"],
            "interpretability": r["interpretability"],
            "is_composite": r["is_composite"],
        }
        for r in rows
    ]

    # Append reference.catalog entries (build-independent, not in registry.layers)
    if type is None or type == "reference":
        if build is None:  # reference tables are build-independent
            async with pool.acquire() as conn:
                ref_rows = await conn.fetch(
                    "SELECT table_name, display_name, description, source_citation, row_count "
                    "FROM reference.catalog ORDER BY table_name"
                )
            for r in ref_rows:
                layers.append({
                    "layer_key": f"ref_{r['table_name']}",
                    "version": "1.0",
                    "name": r["display_name"],
                    "type": "reference",
                    "build": "all",
                    "license_class": "open",
                    "row_count": r["row_count"],
                    "is_default": True,
                })

    return {"layers": layers}


@router.get("/summary/{build}")
async def layer_summary(build: str):
    """Genome-wide summary counts for key layers.

    Returns authoritative feature counts from the database, including
    protein-coding gene count (filtered from gene.features).
    """
    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Row counts from registry (authoritative for probes, CpG, etc.)
        layer_rows = await conn.fetch(
            """SELECT layer_key, row_count
               FROM registry.layers
               WHERE genome_build = $1::genome_build AND is_active = true AND is_default = true""",
            build,
        )
        counts = {r["layer_key"]: r["row_count"] for r in layer_rows}

        # Gene counts by feature_type from gene.features
        gene_layer = await conn.fetchrow(
            """SELECT id FROM registry.active_layers
               WHERE layer_key = 'gencode_v44' AND genome_build = $1::genome_build""",
            build,
        )
        gene_counts = {}
        if gene_layer:
            ft_rows = await conn.fetch(
                """SELECT feature_type::text AS ft, count(*) AS n
                   FROM gene.features
                   WHERE build = $1::genome_build AND layer_id = $2
                   GROUP BY feature_type""",
                build,
                gene_layer["id"],
            )
            gene_counts = {r["ft"]: r["n"] for r in ft_rows}

        # Protein-coding gene count (requires gene_type column; falls back to
        # total gene count if column doesn't exist yet)
        protein_coding_count = None
        if gene_layer:
            try:
                pc_row = await conn.fetchrow(
                    """SELECT count(*) AS n
                       FROM gene.features
                       WHERE build = $1::genome_build AND layer_id = $2
                         AND feature_type = 'gene' AND gene_type = 'protein_coding'""",
                    build,
                    gene_layer["id"],
                )
                protein_coding_count = pc_row["n"] if pc_row else None
            except Exception:
                # gene_type column doesn't exist yet — that's fine
                pass

    return {
        "build": build,
        "layer_counts": counts,
        "gene_features": gene_counts,
        "protein_coding_genes": protein_coding_count,
        "total_genes": gene_counts.get("gene"),
    }


@router.get("/{layer_key}")
async def get_layer(layer_key: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT * FROM registry.layers
               WHERE layer_key = $1 AND is_active = true AND is_default = true""",
            layer_key,
        )
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "LAYER_NOT_FOUND", "message": f"Layer '{layer_key}' not found"}},
        )
    return {
        "layer_key": row["layer_key"],
        "version": row["version"],
        "name": row["name"],
        "type": row["layer_type"],
        "build": row["genome_build"],
        "source": row["source"],
        "license_class": row["license_class"],
        "row_count": row["row_count"],
        "content_hash": row["content_hash"],
        "is_default": row["is_default"],
        "metadata": row["metadata"],
        "evidence_class": row["evidence_class"],
        "tier": row["tier"],
        "equilibrium_regime": row["equilibrium_regime"],
        "statefulness": row["statefulness"],
        "validation_status": row["validation_status"],
        "interpretability": row["interpretability"],
        "is_composite": row["is_composite"],
        "context_conditions": row["context_conditions"],
        "hypothesis_banner": row["hypothesis_banner"],
        "falsification_path": row["falsification_path"],
    }


@router.get("/{layer_key}/license")
async def get_layer_license(layer_key: str):
    """Full license, citation, and provenance information for a data layer.

    Returns the source database, license terms, and citation information.
    Useful for NAR-style attribution and compliance auditing.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """SELECT layer_key, layer_type, name, source, license_class,
                      metadata, evidence_class
               FROM registry.layers
               WHERE layer_key = $1 AND is_active = true AND is_default = true""",
            layer_key,
        )
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "LAYER_NOT_FOUND", "message": f"Layer '{layer_key}' not found"}},
        )

    layer_type = row["layer_type"]
    source_info = LAYER_SOURCE_INFO.get(layer_type, {})

    # ODbL compliance flag for gnomAD-derived data
    is_odbl = "ODbL" in source_info.get("license", "")

    return {
        "layer_key": row["layer_key"],
        "name": row["name"],
        "source": source_info.get("source", row["source"] or "Unknown"),
        "license": source_info.get("license", "See polymerbio.org/data-sources"),
        "license_class": row["license_class"],
        "evidence_class": row["evidence_class"],
        "odbl_share_alike": is_odbl,
        "citation_note": (
            "If you use this data in a publication, please cite the original source "
            "and Polymer Genomics (polymerbio.org)."
        ),
        "data_sources_url": "https://polymerbio.org/data-sources",
    }
