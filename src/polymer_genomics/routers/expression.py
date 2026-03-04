"""Gene expression detail endpoint (GTEx v10, 54 tissues)."""

import time

from fastapi import APIRouter, HTTPException

from polymer_genomics.constants import CHR_ID_TO_NAME, VALID_BUILDS
from polymer_genomics.coordinates import db_to_api
from polymer_genomics.db import get_pool
from polymer_genomics.envelope import build_envelope

router = APIRouter(prefix="/v1/genes", tags=["expression"])

# All 54 GTEx v10 tissues — DB column suffix (snake_case)
_TISSUES = [
    "adipose_subcutaneous", "adipose_visceral_omentum", "adrenal_gland",
    "artery_aorta", "artery_coronary", "artery_tibial",
    "bladder",
    "brain_amygdala", "brain_anterior_cingulate_cortex_ba24",
    "brain_caudate_basal_ganglia", "brain_cerebellar_hemisphere",
    "brain_cerebellum", "brain_cortex", "brain_frontal_cortex_ba9",
    "brain_hippocampus", "brain_hypothalamus",
    "brain_nucleus_accumbens_basal_ganglia", "brain_putamen_basal_ganglia",
    "brain_spinal_cord_cervical_c1", "brain_substantia_nigra",
    "breast_mammary_tissue",
    "cells_cultured_fibroblasts", "cells_ebv_transformed_lymphocytes",
    "cervix_ectocervix", "cervix_endocervix",
    "colon_sigmoid", "colon_transverse",
    "esophagus_gastroesophageal_junction", "esophagus_mucosa", "esophagus_muscularis",
    "fallopian_tube",
    "heart_atrial_appendage", "heart_left_ventricle",
    "kidney_cortex", "kidney_medulla",
    "liver", "lung",
    "minor_salivary_gland", "muscle_skeletal", "nerve_tibial",
    "ovary", "pancreas", "pituitary", "prostate",
    "skin_not_sun_exposed_suprapubic", "skin_sun_exposed_lower_leg",
    "small_intestine_terminal_ileum",
    "spleen", "stomach", "testis", "thyroid",
    "uterus", "vagina", "whole_blood",
]


@router.get("/{build}/{symbol}/expression")
async def get_gene_expression(build: str, symbol: str):
    start_time = time.monotonic()

    if build not in VALID_BUILDS:
        raise HTTPException(
            400,
            {"error": {"code": "BUILD_MISMATCH", "message": f"Invalid build: {build}"}},
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        # Resolve expression layer
        layer = await conn.fetchrow(
            "SELECT id, layer_key, version, content_hash FROM registry.active_layers "
            "WHERE layer_type = 'expression' AND genome_build = $1::genome_build",
            build,
        )
        if not layer:
            raise HTTPException(
                404,
                {"error": {"code": "NOT_FOUND", "message": f"No expression layer for build {build}"}},
            )

        db_start = time.monotonic()
        row = await conn.fetchrow(
            """
            SELECT *
            FROM expression.gene_tpm
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

    if not row:
        raise HTTPException(
            404,
            {"error": {"code": "NOT_FOUND", "message": f"Gene '{symbol}' not found in expression layer for {build}"}},
        )

    # Build structured response
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
        "gene_id": row["gene_id"],
    }

    summary = {
        "median_tpm": row["median_tpm"],
        "max_tpm": row["max_tpm"],
        "max_tissue": row["max_tissue"],
        "n_tissues_detected": row["n_tissues_detected"],
    }

    # Build tissue array sorted by TPM descending
    tissue_pairs = []
    for tissue in _TISSUES:
        tpm_val = row[f"tpm_{tissue}"]
        tissue_pairs.append({
            "tissue": tissue,
            "tpm": float(tpm_val) if tpm_val is not None else None,
        })
    # Sort by TPM descending (nulls last)
    tissue_pairs.sort(
        key=lambda t: t["tpm"] if t["tpm"] is not None else -1e9,
        reverse=True,
    )

    data = {
        "coordinates": coordinates,
        "identity": identity,
        "summary": summary,
        "tissues": tissue_pairs,
    }

    return build_envelope(
        status="complete",
        query={"build": build, "symbol": symbol},
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
