"""Gene bioenergetic cost detail endpoint."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.aliases import resolve_alias
from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["gene_costs"])

# Tissue order for structured response (sorted alphabetically)
_TISSUES = [
    "adipose", "artery", "brain", "breast", "colon", "esophagus",
    "heart", "kidney", "liver", "lung", "muscle", "nerve",
    "ovary", "pancreas", "pituitary", "prostate", "skin",
    "small_intestine", "spleen", "stomach", "testis", "thyroid",
    "uterus", "whole_blood",
]


@router.get("/{build}/{symbol}/cost")
async def get_gene_cost(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve gene_cost layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'gene_cost' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No gene_cost layer for build {build}"}},
            )

        db_start = time.monotonic()
        row = await conn.fetchrow(
            """
            SELECT *
            FROM bioenergetics.gene_costs
            WHERE build = $1::genome_build
              AND UPPER(gene_symbol) = UPPER($2)
              AND layer_id = $3
            LIMIT 1
            """,
            build,
            symbol,
            layer["id"],
        )
        db_time = (time.monotonic() - db_start) * 1000

    resolved_alias = None
    if not row:
        async with pool.acquire() as alias_conn:
            canonical = await resolve_alias(alias_conn, symbol)
        if canonical:
            resolved_alias = symbol
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT *
                    FROM bioenergetics.gene_costs
                    WHERE build = $1::genome_build
                      AND UPPER(gene_symbol) = UPPER($2)
                      AND layer_id = $3
                    LIMIT 1
                    """,
                    build, canonical, layer["id"],
                )
        if not row:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in gene_cost layer for {build}"}},
            )

    # Build structured response with 7 groups
    coordinates = None
    if row["chr_id"] is not None and row["start_pos"] is not None:
        api = db_to_api(row["start_pos"], row["end_pos"])
        chr_name = CHR_ID_TO_NAME.get(row["chr_id"], f"chr{row['chr_id']}")
        coordinates = {
            "seqname": chr_name,
            "start": api["start"],
            "end": api["end"],
            "width": api["width"],
            "strand": row["strand"],
        }

    identity = {
        "gene_symbol": row["gene_symbol"],
        "uniprot_id": row["uniprot_id"],
        "protein_name": row["protein_name"],
        "protein_length": row["protein_length"],
    }

    biosynthetic_cost = {
        "ecpa_b20": row["ecpa_b20"],
        "ecpa_h11": row["ecpa_h11"],
        "c_protein": row["c_protein"],
        "c_aa_synthesis": row["c_aa_synthesis"],
        "c_translation": row["c_translation"],
    }

    elemental = {
        "n_protein": row["n_protein"],
        "s_protein": row["s_protein"],
        "c_atoms": row["c_atoms"],
        "mw_kda": row["mw_kda"],
        "cost_per_kda": row["cost_per_kda"],
        "n_per_kda": row["n_per_kda"],
        "s_per_kda": row["s_per_kda"],
    }

    composition = {
        "frac_cheap": row["frac_cheap"],
        "frac_moderate": row["frac_moderate"],
        "frac_expensive": row["frac_expensive"],
        "frac_very_expensive": row["frac_very_expensive"],
        "n_cys": row["n_cys"],
        "n_met": row["n_met"],
        "n_trp": row["n_trp"],
        "n_arg": row["n_arg"],
        "n_lys": row["n_lys"],
    }

    codon_optimization = {
        "cds_length_nt": row["cds_length_nt"],
        "n_codons": row["n_codons"],
        "gc3": row["gc3"],
        "gc_cds": row["gc_cds"],
        "cai": row["cai"],
        "tai": row["tai"],
        "enc": row["enc"],
        "fop": row["fop"],
    }

    # Build expression array sorted by EWGC descending
    tissue_pairs = []
    for tissue in _TISSUES:
        tpm_val = row[f"tpm_{tissue}"]
        ewgc_val = row[f"ewgc_{tissue}"]
        tissue_pairs.append({
            "tissue": tissue,
            "tpm": float(tpm_val) if tpm_val is not None else None,
            "ewgc": float(ewgc_val) if ewgc_val is not None else None,
        })
    # Sort by EWGC descending (nulls last)
    tissue_pairs.sort(key=lambda t: t["ewgc"] if t["ewgc"] is not None else -1e9, reverse=True)

    expression = {
        "mean_tpm": row["mean_tpm"],
        "max_tpm": row["max_tpm"],
        "tissues": tissue_pairs,
    }

    # Metabolic burden (if computed)
    metabolic_burden = None
    if row.get("burden_total") is not None:
        burden_tissues = []
        for tissue in _TISSUES:
            bval = row.get(f"burden_{tissue}")
            burden_tissues.append({
                "tissue": tissue,
                "burden": float(bval) if bval is not None else None,
            })
        burden_tissues.sort(
            key=lambda t: t["burden"] if t["burden"] is not None else -1e9,
            reverse=True,
        )
        metabolic_burden = {
            "half_life_hours": row.get("half_life_hours"),
            "turnover_rate": row.get("turnover_rate"),
            "burden_total": row["burden_total"],
            "tissues": burden_tissues,
        }

    data = {
        "coordinates": coordinates,
        "identity": identity,
        "biosynthetic_cost": biosynthetic_cost,
        "elemental": elemental,
        "composition": composition,
        "codon_optimization": codon_optimization,
        "expression": expression,
        "metabolic_burden": metabolic_burden,
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol, **({"resolved_alias": resolved_alias} if resolved_alias else {})},
        layers_resolved=[
            {
                "layer_key": layer["layer_key"],
                "version": layer["version"],
                "layer_id": str(layer["id"]),
                "content_hash": layer["content_hash"],
                "status": "ok",
            }
        ],
        data=data,
        db_time_ms=round(db_time, 1),
        _start_time=start_time,
    )
