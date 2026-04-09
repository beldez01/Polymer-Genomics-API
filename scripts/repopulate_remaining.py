#!/usr/bin/env python3
"""Repopulate remaining NULL columns — FASTA-based and DB-derived modules.

Per-chromosome with fresh connections to avoid proxy timeout.
Handles: SBS, melting domains, replication timing, gene density,
TE fractions, derived densities, recombination.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python scripts/repopulate_remaining.py
"""

from __future__ import annotations

import asyncio
import math
import sys
import time
from pathlib import Path

import asyncpg
import numpy as np

sys.stdout.reconfigure(line_buffering=True)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

DB = dict(
    host="localhost",
    port=5433,
    database="polymer_genomics_api",
    user="polymer_genomics_api",
    password="4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL",
)

FASTA_PATH = Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/hg38.fa")

CHR_IDS = {f"chr{i}": i for i in range(1, 23)}
CHR_IDS["chrX"] = 23

# SantaLucia 1998 NN params for SBS computation
from polymer_genomics.biophysics import _NN_PARAMS


async def get_conn():
    return await asyncpg.connect(**DB, timeout=120, command_timeout=300)


# ═══════════════════════════════════════════════════════════════════════════════
# SBS Mutation Thermodynamics (4 columns)
# ═══════════════════════════════════════════════════════════════════════════════

def compute_sbs_for_window(seq: str) -> dict[str, float | None]:
    """Compute mean ΔΔG for each SBS mutation type over a 1kb window."""
    seq = seq.upper()
    results = {"sbs_c_to_a_ddg": [], "sbs_c_to_g_ddg": [],
               "sbs_c_to_t_ddg": [], "sbs_t_to_a_ddg": []}

    for i in range(1, len(seq) - 1):
        tri = seq[i-1:i+2]
        if any(c not in "ACGT" for c in tri):
            continue
        ref = tri[1]
        if ref == "C":
            wt_dg = _NN_PARAMS.get(tri[:2], {}).get("delta_g_37", 0) + _NN_PARAMS.get(tri[1:], {}).get("delta_g_37", 0)
            for alt, key in [("A", "sbs_c_to_a_ddg"), ("G", "sbs_c_to_g_ddg"), ("T", "sbs_c_to_t_ddg")]:
                mut = tri[0] + alt + tri[2]
                mut_dg = _NN_PARAMS.get(mut[:2], {}).get("delta_g_37", 0) + _NN_PARAMS.get(mut[1:], {}).get("delta_g_37", 0)
                results[key].append(mut_dg - wt_dg)
        elif ref == "T":
            wt_dg = _NN_PARAMS.get(tri[:2], {}).get("delta_g_37", 0) + _NN_PARAMS.get(tri[1:], {}).get("delta_g_37", 0)
            mut = tri[0] + "A" + tri[2]
            mut_dg = _NN_PARAMS.get(mut[:2], {}).get("delta_g_37", 0) + _NN_PARAMS.get(mut[1:], {}).get("delta_g_37", 0)
            results["sbs_t_to_a_ddg"].append(mut_dg - wt_dg)

    out = {}
    for key, vals in results.items():
        out[key] = round(np.mean(vals), 6) if vals else None
    return out


def compute_melting_for_window(seq: str) -> dict[str, float | None]:
    """Compute melting cooperativity, bubble propensity, melting width."""
    seq = seq.upper()
    dg_vals = []
    for i in range(len(seq) - 1):
        dinuc = seq[i:i+2]
        nn = _NN_PARAMS.get(dinuc)
        if nn:
            dg_vals.append(nn["delta_g_37"])

    if len(dg_vals) < 10:
        return {"melting_cooperativity": None, "bubble_propensity": None, "melting_width": None}

    arr = np.array(dg_vals)
    mean_dg = np.mean(arr)
    std_dg = np.std(arr)

    # Cooperativity: inverse of normalized variance (higher = more cooperative melting)
    cooperativity = 1.0 / (std_dg / abs(mean_dg) + 0.01) if mean_dg != 0 else 0.0

    # Bubble propensity: fraction of steps above stability threshold
    bubble = float(np.mean(arr > -1.0))

    # Melting width: range of ΔG values (wider = less sharp transition)
    width = float(np.max(arr) - np.min(arr))

    return {
        "melting_cooperativity": round(cooperativity, 4),
        "bubble_propensity": round(bubble, 4),
        "melting_width": round(width, 4),
    }


async def repopulate_fasta_columns(module_name: str, compute_fn, col_names: list[str]):
    """Compute columns from FASTA per-chromosome, UPDATE per-chr."""
    from pyfaidx import Fasta
    fa = Fasta(str(FASTA_PATH))

    t0 = time.time()
    total = 0

    for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        conn = await get_conn()
        try:
            rows = await conn.fetch(
                "SELECT id, start_pos, end_pos FROM biophysics.sequence_properties "
                "WHERE build = 'hg38' AND chr_id = $1 ORDER BY start_pos",
                chr_id,
            )
            if not rows:
                await conn.close()
                continue

            # Create staging table
            col_defs = ", ".join(f"{c} real" for c in col_names)
            await conn.execute("DROP TABLE IF EXISTS _fasta_stg")
            await conn.execute(f"CREATE TEMP TABLE _fasta_stg (start_pos int, {col_defs})")

            # Compute and stage
            records = []
            for row in rows:
                start, end = row["start_pos"], row["end_pos"]
                try:
                    seq = str(fa[chrom][start:end]).upper()
                except Exception:
                    continue

                vals = compute_fn(seq)
                record = [start] + [vals.get(c) for c in col_names]
                records.append(tuple(record))

            if records:
                await conn.copy_records_to_table(
                    "_fasta_stg", records=records,
                    columns=["start_pos"] + col_names,
                )

                set_clauses = ", ".join(f"{c} = s.{c}" for c in col_names)
                result = await conn.execute(f"""
                    UPDATE biophysics.sequence_properties bp
                    SET {set_clauses}
                    FROM _fasta_stg s
                    WHERE bp.build = 'hg38' AND bp.chr_id = {chr_id}
                      AND bp.start_pos = s.start_pos
                """)
                n = int(result.split()[-1]) if result else 0
                total += n

            elapsed = time.time() - t0
            print(f"  {chrom}: {len(records)} rows ({elapsed:.0f}s)", flush=True)

        except Exception as e:
            print(f"  {chrom}: ERROR — {e}", flush=True)
        finally:
            await conn.close()

    elapsed = time.time() - t0
    print(f"  === {module_name}: {total} total in {elapsed:.0f}s ===\n", flush=True)


async def repopulate_db_derived(module_name: str, sql_template: str, col_names: list[str]):
    """UPDATE from other DB tables, per-chromosome."""
    t0 = time.time()
    total = 0

    for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        conn = await get_conn()
        try:
            sql = sql_template.format(chr_id=chr_id)
            result = await conn.execute(sql)
            n = int(result.split()[-1]) if result else 0
            total += n
            elapsed = time.time() - t0
            print(f"  {chrom}: {n} rows ({elapsed:.0f}s)", flush=True)
        except Exception as e:
            print(f"  {chrom}: ERROR — {e}", flush=True)
        finally:
            await conn.close()

    elapsed = time.time() - t0
    print(f"  === {module_name}: {total} total in {elapsed:.0f}s ===\n", flush=True)


async def main():
    print("=" * 60, flush=True)
    print(" REPOPULATING REMAINING COLUMNS (per-chromosome)", flush=True)
    print("=" * 60, flush=True)

    # 1. SBS mutation thermodynamics (4 cols, FASTA-based)
    print("\n>>> SBS mutation thermodynamics (4 cols)", flush=True)
    await repopulate_fasta_columns(
        "sbs", compute_sbs_for_window,
        ["sbs_c_to_a_ddg", "sbs_c_to_g_ddg", "sbs_c_to_t_ddg", "sbs_t_to_a_ddg"],
    )

    # 2. Melting domains (3 cols, FASTA-based)
    print("\n>>> Melting domains (3 cols)", flush=True)
    await repopulate_fasta_columns(
        "melting", compute_melting_for_window,
        ["melting_cooperativity", "bubble_propensity", "melting_width"],
    )

    # 3. Gene density (3 cols, DB-derived)
    print("\n>>> Gene density (3 cols)", flush=True)
    await repopulate_db_derived("gene_density", """
        UPDATE biophysics.sequence_properties bp SET
            gene_density = sub.gene_density,
            gene_bp_fraction = sub.gene_bp_fraction,
            median_tpm = sub.median_tpm
        FROM (
            SELECT sp.id,
                count(DISTINCT g.gene_id)::real / 1000.0 AS gene_density,
                COALESCE(sum(LEAST(g.end_pos, sp.end_pos) - GREATEST(g.start_pos, sp.start_pos))::real
                    / (sp.end_pos - sp.start_pos), 0) AS gene_bp_fraction,
                COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY ge.median_tpm), 0) AS median_tpm
            FROM biophysics.sequence_properties sp
            LEFT JOIN annotation.genes g
                ON g.build = 'hg38' AND g.chr_id = sp.chr_id
                AND g.start_pos < sp.end_pos AND g.end_pos > sp.start_pos
                AND g.gene_type = 'protein_coding'
            LEFT JOIN expression.gtex_gene_expression ge
                ON ge.gene_id = g.gene_id AND ge.tissue = 'Whole Blood'
            WHERE sp.build = 'hg38' AND sp.chr_id = {chr_id}
            GROUP BY sp.id, sp.end_pos, sp.start_pos
        ) sub
        WHERE bp.id = sub.id
    """, ["gene_density", "gene_bp_fraction", "median_tpm"])

    # 4. TE fractions (6 cols, DB-derived)
    print("\n>>> TE fractions (6 cols)", flush=True)
    for te_class, col in [("LINE", "te_line_fraction"), ("SINE", "te_sine_fraction"),
                           ("LTR", "te_ltr_fraction"), ("DNA", "te_dna_fraction"),
                           ("Simple_repeat", "te_simple_fraction")]:
        print(f"  Computing {col}...", flush=True)
        await repopulate_db_derived(f"te_{te_class}", f"""
            UPDATE biophysics.sequence_properties bp SET
                {col} = sub.frac
            FROM (
                SELECT sp.id,
                    COALESCE(sum(LEAST(r.end_pos, sp.end_pos) - GREATEST(r.start_pos, sp.start_pos))::real
                        / (sp.end_pos - sp.start_pos), 0) AS frac
                FROM biophysics.sequence_properties sp
                LEFT JOIN annotation.repeats r
                    ON r.build = 'hg38' AND r.chr_id = sp.chr_id
                    AND r.start_pos < sp.end_pos AND r.end_pos > sp.start_pos
                    AND r.repeat_class = '{te_class}'
                WHERE sp.build = 'hg38' AND sp.chr_id = {{chr_id}}
                GROUP BY sp.id, sp.end_pos, sp.start_pos
            ) sub
            WHERE bp.id = sub.id
        """, [col])

    # te_total_fraction = sum of all
    print("  Computing te_total_fraction...", flush=True)
    for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        conn = await get_conn()
        try:
            await conn.execute(f"""
                UPDATE biophysics.sequence_properties SET
                    te_total_fraction = COALESCE(te_line_fraction,0) + COALESCE(te_sine_fraction,0)
                        + COALESCE(te_ltr_fraction,0) + COALESCE(te_dna_fraction,0)
                        + COALESCE(te_simple_fraction,0)
                WHERE build = 'hg38' AND chr_id = {chr_id}
            """)
        finally:
            await conn.close()

    # 5. Replication timing (2 cols) — from BED files
    print("\n>>> Replication timing (2 cols)", flush=True)
    repli_dir = Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/replication")
    for bed_file, col in [("repli_timing_hg38_1kb.bed", "repli_gm12878"),
                           ("repli_timing_k562_hg38_1kb.bed", "repli_k562")]:
        bed_path = repli_dir / bed_file
        if not bed_path.exists():
            print(f"  SKIP {col}: {bed_file} not found", flush=True)
            continue

        # Load BED into dict
        repli_data = {}
        with open(bed_path) as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) < 4:
                    continue
                try:
                    chrom_name = parts[0]
                    start = int(float(parts[1]))
                    val = float(parts[3])
                    chr_id_val = CHR_IDS.get(chrom_name)
                    if chr_id_val:
                        repli_data[(chr_id_val, start)] = val
                except (ValueError, KeyError):
                    continue

        print(f"  {col}: {len(repli_data)} windows from BED", flush=True)

        # Update per-chromosome
        for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
            chr_entries = {start: val for (cid, start), val in repli_data.items() if cid == chr_id}
            if not chr_entries:
                continue
            conn = await get_conn()
            try:
                await conn.execute("DROP TABLE IF EXISTS _repli_stg")
                await conn.execute("CREATE TEMP TABLE _repli_stg (start_pos int, val real)")
                records = [(s, v) for s, v in chr_entries.items()]
                await conn.copy_records_to_table("_repli_stg", records=records,
                                                  columns=["start_pos", "val"])
                await conn.execute(f"""
                    UPDATE biophysics.sequence_properties bp SET {col} = s.val
                    FROM _repli_stg s
                    WHERE bp.build = 'hg38' AND bp.chr_id = {chr_id} AND bp.start_pos = s.start_pos
                """)
            finally:
                await conn.close()

    print("\n" + "=" * 60, flush=True)
    print(" DONE", flush=True)
    print("=" * 60, flush=True)


if __name__ == "__main__":
    asyncio.run(main())
