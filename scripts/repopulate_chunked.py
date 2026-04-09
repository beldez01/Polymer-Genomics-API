#!/usr/bin/env python3
"""Repopulate NULL biophysics columns — one chromosome at a time, fresh connection each.

Reconnects to the database for every chromosome to avoid proxy timeout.
Run with fly proxy active on port 15432.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python scripts/repopulate_chunked.py
"""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path

import asyncpg
import pyBigWig
import numpy as np

# Connection config
DB = dict(
    host="localhost",
    port=15432,
    database="polymer_genomics_api",
    user="polymer_genomics_api",
    password="4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL",
)

PE = Path.home() / "Desktop" / "Polymer_Evolution"
P1 = PE / "phase1" / "output" / "window_1000"
P2 = PE / "phase2" / "output" / "window_1000"
P35 = PE / "phase3_5" / "output" / "window_1000"
FASTA = Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/hg38.fa")

CHR_IDS = {f"chr{i}": i for i in range(1, 23)}
CHR_IDS["chrX"] = 23
CHR_IDS["chrY"] = 24

# All UPDATE modules: (name, column_map, data_dir)
# column_map: {db_column: bigwig_filename}
BIGWIG_MODULES = [
    ("shape_abs", {
        "mgw_mean": "dnashape_mgw.bw",
        "prot_mean": "dnashape_prot.bw",
        "roll_mean": "dnashape_roll.bw",
        "helt_mean": "dnashape_helt.bw",
    }, P1),
    ("shape_delta", {
        "delta_mgw": "delta_mgw.bw",
        "delta_prot": "delta_prot.bw",
        "delta_roll": "delta_roll.bw",
        "delta_helt": "delta_helt.bw",
    }, P1),
    ("extended", {
        "deformability": "deformability.bw",
        "g4_density": "g4_density.bw",
        "g4_max_score": "g4_max_score.bw",
        "kmer_complexity": "kmer_complexity.bw",
        "dinucleotide_entropy": "dinucleotide_entropy.bw",
        "dominant_period": "dominant_period.bw",
    }, P1),
    ("methylation", {
        "cpg_count": "cpg_count.bw",
        "cpg_density": "cpg_density.bw",
        "cpg_obs_exp": "cpg_obs_exp.bw",
        "meth_delta_g": "meth_delta_G.bw",
        "meth_delta_tm": "meth_delta_Tm.bw",
        "meth_sensitivity": "meth_sensitivity.bw",
        "methylation_capacity": "methylation_capacity.bw",
        "demethylation_cost": "demethylation_cost.bw",
        "oxidation_depth": "oxidation_depth.bw",
        "taut_relaxed": "taut_relaxed.bw",
    }, P2),
    ("greens", {
        "correlation_length": "correlation_length.bw",
        "integrated_response": "integrated_response.bw",
        "perturbation_reach": "perturbation_reach.bw",
        "response_asymmetry": "response_asymmetry.bw",
    }, P35),
]

# Modules that compute from FASTA (not BigWig) — handle separately
FASTA_MODULES = ["melting_domains", "sbs_bulk_update"]

# Modules that derive from other DB tables (no external files)
DB_MODULES = ["replication_timing", "gene_density", "te_fractions", "derived_densities"]


async def update_from_bigwig(module_name: str, col_map: dict[str, str], data_dir: Path):
    """Update biophysics columns from BigWig files, one chromosome at a time."""
    # Verify files exist
    missing = []
    for col, fn in col_map.items():
        if not (data_dir / fn).exists():
            missing.append(fn)
    if missing:
        print(f"  SKIP {module_name}: missing files: {missing}")
        return

    cols = list(col_map.keys())
    total_updated = 0
    t0 = time.time()

    for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        # Fresh connection per chromosome
        try:
            conn = await asyncpg.connect(**DB)
        except Exception as e:
            print(f"  {chrom}: connection failed: {e}")
            continue

        try:
            # Open BigWigs
            bws = {}
            for col, fn in col_map.items():
                bws[col] = pyBigWig.open(str(data_dir / fn))

            # Get all windows for this chromosome from DB
            rows = await conn.fetch(
                "SELECT id, start_pos, end_pos FROM biophysics.sequence_properties "
                "WHERE build = 'hg38' AND chr_id = $1 ORDER BY start_pos",
                chr_id,
            )

            if not rows:
                for bw in bws.values():
                    bw.close()
                await conn.close()
                continue

            # Build updates in batches
            batch_size = 5000
            batch = []

            for row in rows:
                rid = row["id"]
                start = row["start_pos"]
                end = row["end_pos"]

                values = {}
                for col, bw in bws.items():
                    try:
                        raw = bw.values(chrom, start, end)
                        if raw is not None:
                            arr = np.array(raw, dtype=float)
                            val = float(np.nanmean(arr))
                            if not np.isnan(val):
                                values[col] = val
                    except Exception:
                        pass

                if values:
                    batch.append((rid, values))

                if len(batch) >= batch_size:
                    await _flush_batch(conn, batch, cols)
                    total_updated += len(batch)
                    batch = []

            if batch:
                await _flush_batch(conn, batch, cols)
                total_updated += len(batch)

            for bw in bws.values():
                bw.close()

            elapsed = time.time() - t0
            print(f"  {chrom}: {len(rows)} rows ({total_updated} total, {elapsed:.0f}s)")

        except Exception as e:
            print(f"  {chrom}: ERROR: {e}")
        finally:
            await conn.close()

    elapsed = time.time() - t0
    print(f"  {module_name}: {total_updated} rows updated in {elapsed:.0f}s\n")


async def _flush_batch(conn: asyncpg.Connection, batch: list, cols: list[str]):
    """Execute batch UPDATE statements."""
    for rid, values in batch:
        set_parts = []
        params = [rid]
        for i, col in enumerate(cols):
            if col in values:
                params.append(values[col])
                set_parts.append(f"{col} = ${len(params)}")
        if set_parts:
            sql = f"UPDATE biophysics.sequence_properties SET {', '.join(set_parts)} WHERE id = $1"
            await conn.execute(sql, *params)


async def run_db_module(module_name: str):
    """Run a DB-derived ingestion module."""
    env = os.environ.copy()
    env.update({
        "POSTGRES_HOST": DB["host"],
        "POSTGRES_PORT": str(DB["port"]),
        "POSTGRES_DB": DB["database"],
        "POSTGRES_PASSWORD": DB["password"],
        "POSTGRES_USER": DB["user"],
        "POSTGRES_USER_PASSWORD": DB["password"],
        "POSTGRES_ADMIN_USER": DB["user"],
    })

    proc = await asyncio.create_subprocess_exec(
        "uv", "run", "python", "-m", f"polymer_genomics.ingest.{module_name}",
        "--build", "hg38",
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode() if stdout else ""
    if proc.returncode == 0:
        print(f"  {module_name}: OK")
    else:
        # Print last few lines on failure
        lines = output.strip().split("\n")
        print(f"  {module_name}: FAILED (rc={proc.returncode})")
        for line in lines[-3:]:
            print(f"    {line}")


async def run_fasta_module(module_name: str):
    """Run a FASTA-based ingestion module."""
    env = os.environ.copy()
    env.update({
        "POSTGRES_HOST": DB["host"],
        "POSTGRES_PORT": str(DB["port"]),
        "POSTGRES_DB": DB["database"],
        "POSTGRES_PASSWORD": DB["password"],
        "POSTGRES_USER": DB["user"],
        "POSTGRES_USER_PASSWORD": DB["password"],
        "POSTGRES_ADMIN_USER": DB["user"],
    })

    proc = await asyncio.create_subprocess_exec(
        "uv", "run", "python", "-m", f"polymer_genomics.ingest.{module_name}",
        "--fasta", str(FASTA), "--build", "hg38",
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode() if stdout else ""
    if proc.returncode == 0:
        print(f"  {module_name}: OK")
    else:
        lines = output.strip().split("\n")
        print(f"  {module_name}: FAILED (rc={proc.returncode})")
        for line in lines[-3:]:
            print(f"    {line}")


async def main():
    print("=" * 60)
    print(" REPOPULATING BIOPHYSICS COLUMNS (per-chromosome)")
    print("=" * 60)
    t0 = time.time()

    # 1. BigWig-based modules (28 columns)
    for name, col_map, data_dir in BIGWIG_MODULES:
        cols_str = ", ".join(col_map.keys())
        print(f"\n>>> {name} ({len(col_map)} cols: {cols_str})")
        await update_from_bigwig(name, col_map, data_dir)

    # 2. FASTA-based modules (7 columns)
    for mod in FASTA_MODULES:
        print(f"\n>>> {mod} (FASTA-based)")
        await run_fasta_module(mod)

    # 3. DB-derived modules (~15 columns)
    for mod in DB_MODULES:
        print(f"\n>>> {mod} (DB-derived)")
        await run_db_module(mod)

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f" COMPLETE in {elapsed / 60:.1f} minutes")
    print(f"{'=' * 60}")
    print(f"\n STILL MISSING (needs 9GB re-download):")
    print(f"   phylop_241way_mean, phastcons_241way_mean, b_score_mean")
    print(f"   Download: https://hgdownload.soe.ucsc.edu/goldenPath/hg38/cactus241way/")


if __name__ == "__main__":
    asyncio.run(main())
