"""Metabolic burden computation.

Computes tissue-specific metabolic burden for each gene in
``bioenergetics.gene_costs`` by combining:

    burden = biosynthetic_cost × protein_length × expression × turnover_rate

Where:
    - biosynthetic_cost = ecpa_b20 (ATP per amino acid, Akashi-Gojobori)
    - protein_length = number of amino acids
    - expression = tpm_{tissue} (GTEx v10)
    - turnover_rate = ln(2) / half_life_hours (from protein_turnover data)

Units: ATP·aa·TPM/hour — a relative metabolic investment metric.

Usage::

    uv run python -m polymer_genomics.ingest.metabolic_burden
"""

from __future__ import annotations

import asyncio
import math
import os

import asyncpg

_TISSUES = [
    "adipose", "artery", "brain", "breast", "colon", "esophagus",
    "heart", "kidney", "liver", "lung", "muscle", "nerve",
    "ovary", "pancreas", "pituitary", "prostate", "skin",
    "small_intestine", "spleen", "stomach", "testis", "thyroid",
    "uterus", "whole_blood",
]

# Default protein half-life when no SILAC data available (hours).
# Median human protein half-life ~ 46 hours (Cambridge et al. 2011).
_DEFAULT_HALF_LIFE_HOURS = 46.0

BATCH_SIZE = 1000


async def main() -> None:
    """Compute and update metabolic burden columns in gene_costs."""
    conn = await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ.get("POSTGRES_DB", "polymer_genomics"),
        user=os.environ.get("POSTGRES_USER", "ingest_writer"),
        password=os.environ.get("POSTGRES_USER_PASSWORD", "ingest_writer_dev"),
    )

    try:
        # Check if burden already computed
        already_done = await conn.fetchval(
            "SELECT count(*) FROM bioenergetics.gene_costs WHERE burden_total IS NOT NULL"
        )
        if already_done > 0:
            print(f"  burden_total already populated for {already_done} genes, skipping.")
            print("  To recompute, run: UPDATE bioenergetics.gene_costs SET burden_total = NULL;")
            return

        # Build turnover lookup from protein_turnover if available
        turnover_map: dict[str, float] = {}
        try:
            turnover_rows = await conn.fetch(
                """SELECT UPPER(gene_symbol) as gene, half_life_hours
                   FROM bioenergetics.protein_turnover
                   WHERE half_life_hours IS NOT NULL AND half_life_hours > 0"""
            )
            for r in turnover_rows:
                turnover_map[r["gene"]] = r["half_life_hours"]
            print(f"  Loaded {len(turnover_map)} protein half-lives from protein_turnover.")
        except Exception:
            print("  No protein_turnover table found; using default half-life "
                  f"({_DEFAULT_HALF_LIFE_HOURS}h) for all genes.")

        # Fetch all gene_costs rows
        rows = await conn.fetch(
            """SELECT id, gene_symbol, ecpa_b20, protein_length, mean_tpm,
                      {}
               FROM bioenergetics.gene_costs
               WHERE ecpa_b20 IS NOT NULL AND protein_length IS NOT NULL""".format(
                ", ".join(f"tpm_{t}" for t in _TISSUES)
            )
        )
        print(f"  Processing {len(rows)} genes...")

        updated = 0
        for row in rows:
            gene = row["gene_symbol"].upper() if row["gene_symbol"] else ""
            ecpa = row["ecpa_b20"]
            plen = row["protein_length"]

            # Turnover rate
            half_life = turnover_map.get(gene, _DEFAULT_HALF_LIFE_HOURS)
            turnover = math.log(2) / half_life

            # Total burden (using mean_tpm as aggregate expression)
            mean_tpm = row["mean_tpm"]
            burden_total = (
                ecpa * plen * mean_tpm * turnover
                if mean_tpm is not None else None
            )

            # Per-tissue burden
            tissue_burdens: dict[str, float | None] = {}
            for tissue in _TISSUES:
                tpm = row[f"tpm_{tissue}"]
                if tpm is not None:
                    tissue_burdens[tissue] = ecpa * plen * tpm * turnover
                else:
                    tissue_burdens[tissue] = None

            # Build UPDATE
            set_clauses = [
                "half_life_hours = $2",
                "turnover_rate = $3",
                "burden_total = $4",
            ]
            params: list = [row["id"], half_life, turnover, burden_total]

            for i, tissue in enumerate(_TISSUES):
                param_idx = 5 + i
                set_clauses.append(f"burden_{tissue} = ${param_idx}")
                params.append(tissue_burdens[tissue])

            await conn.execute(
                f"UPDATE bioenergetics.gene_costs SET {', '.join(set_clauses)} WHERE id = $1",
                *params,
            )
            updated += 1

            if updated % BATCH_SIZE == 0:
                print(f"    Updated {updated:,} / {len(rows):,} genes...")

        print(f"\n  Metabolic burden computed for {updated:,} genes.")

        # Summary stats
        stats = await conn.fetchrow(
            """SELECT
                 avg(burden_total) as avg_burden,
                 max(burden_total) as max_burden,
                 min(burden_total) as min_burden
               FROM bioenergetics.gene_costs
               WHERE burden_total IS NOT NULL"""
        )
        if stats and stats["avg_burden"]:
            print(f"  Burden range: {stats['min_burden']:.1f} — {stats['max_burden']:.1f}")
            print(f"  Mean burden:  {stats['avg_burden']:.1f} ATP·aa·TPM/h")

        # Top 5 most expensive genes
        top5 = await conn.fetch(
            """SELECT gene_symbol, burden_total, ecpa_b20, protein_length, mean_tpm
               FROM bioenergetics.gene_costs
               WHERE burden_total IS NOT NULL
               ORDER BY burden_total DESC LIMIT 5"""
        )
        if top5:
            print("\n  Top 5 metabolically expensive genes:")
            for r in top5:
                print(f"    {r['gene_symbol']:>10s}: burden={r['burden_total']:>12.1f}  "
                      f"ecpa={r['ecpa_b20']:.1f}  len={r['protein_length']}  tpm={r['mean_tpm']:.1f}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
