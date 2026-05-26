#!/usr/bin/env python3
"""Repopulate NULL biophysics columns using batch UPDATE via temp table.

Instead of per-row UPDATEs (too slow over proxy), this:
1. Creates a temp table with (chr_id, start_pos, col_value)
2. Bulk-loads via COPY
3. Joins back with a single UPDATE statement

Fresh connection per (module × chromosome) to avoid proxy timeout.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python scripts/repopulate_batch.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path

import asyncpg
import pyBigWig
import numpy as np

DB = dict(
    host="localhost",
    port=15432,
    database="polymer_genomics_api",
    user="polymer_genomics_api",
    password="4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL",
)

PE = Path.home() / "Desktop" / "PolymerGenomicsAPI" / "external" / "polymer_evolution"
P1 = PE / "phase1" / "output" / "window_1000"
P2 = PE / "phase2" / "output" / "window_1000"
P35 = PE / "phase3_5" / "output" / "window_1000"

CHR_IDS = {f"chr{i}": i for i in range(1, 23)}
CHR_IDS["chrX"] = 23

BIGWIG_MODULES = [
    ("shape_abs", {"mgw_mean": "dnashape_mgw.bw", "prot_mean": "dnashape_prot.bw",
                   "roll_mean": "dnashape_roll.bw", "helt_mean": "dnashape_helt.bw"}, P1),
    ("shape_delta", {"delta_mgw": "delta_mgw.bw", "delta_prot": "delta_prot.bw",
                     "delta_roll": "delta_roll.bw", "delta_helt": "delta_helt.bw"}, P1),
    ("extended", {"deformability": "deformability.bw", "g4_density": "g4_density.bw",
                  "g4_max_score": "g4_max_score.bw", "kmer_complexity": "kmer_complexity.bw",
                  "dinucleotide_entropy": "dinucleotide_entropy.bw",
                  "dominant_period": "dominant_period.bw"}, P1),
    ("methylation", {"cpg_count": "cpg_count.bw", "cpg_density": "cpg_density.bw",
                     "cpg_obs_exp": "cpg_obs_exp.bw", "meth_delta_g": "meth_delta_G.bw",
                     "meth_delta_tm": "meth_delta_Tm.bw", "meth_sensitivity": "meth_sensitivity.bw",
                     "methylation_capacity": "methylation_capacity.bw",
                     "demethylation_cost": "demethylation_cost.bw",
                     "oxidation_depth": "oxidation_depth.bw",
                     "taut_relaxed": "taut_relaxed.bw"}, P2),
    ("greens", {"correlation_length": "correlation_length.bw",
                "integrated_response": "integrated_response.bw",
                "perturbation_reach": "perturbation_reach.bw",
                "response_asymmetry": "response_asymmetry.bw"}, P35),
]


async def batch_update_column(conn: asyncpg.Connection, chrom: str, chr_id: int,
                               col_name: str, bw_path: Path) -> int:
    """Update one column for one chromosome using temp table + JOIN."""
    bw = pyBigWig.open(str(bw_path))
    try:
        if chrom not in bw.chroms():
            return 0

        intervals = bw.intervals(chrom)
        if not intervals:
            return 0

        # Build records: (chr_id, start_pos, value)
        records = []
        for start, end, val in intervals:
            if val is not None and not np.isnan(val):
                records.append((chr_id, int(start), float(val)))

        if not records:
            return 0

        # Create temp table, COPY data in, UPDATE via JOIN
        await conn.execute("CREATE TEMP TABLE IF NOT EXISTS _bw_tmp (chr_id smallint, start_pos int, val real)")
        await conn.execute("TRUNCATE _bw_tmp")
        await conn.copy_records_to_table("_bw_tmp", records=records,
                                          columns=["chr_id", "start_pos", "val"])

        result = await conn.execute(f"""
            UPDATE biophysics.sequence_properties sp
            SET {col_name} = t.val
            FROM _bw_tmp t
            WHERE sp.build = 'hg38'
              AND sp.chr_id = t.chr_id
              AND sp.start_pos = t.start_pos
        """)

        count = int(result.split()[-1]) if result else 0
        await conn.execute("TRUNCATE _bw_tmp")
        return count

    finally:
        bw.close()


async def process_module(name: str, col_map: dict[str, str], data_dir: Path):
    """Process one BigWig module: all columns, all chromosomes."""
    # Verify files
    for col, fn in col_map.items():
        if not (data_dir / fn).exists():
            print(f"  SKIP {name}: missing {fn}")
            return

    t0 = time.time()
    total = 0

    for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        conn = await asyncpg.connect(**DB, timeout=60)
        try:
            chr_total = 0
            for col, fn in col_map.items():
                n = await batch_update_column(conn, chrom, chr_id, col, data_dir / fn)
                chr_total += n
            total += chr_total
            elapsed = time.time() - t0
            print(f"  {chrom}: {chr_total} updates ({elapsed:.0f}s)", flush=True)
        except Exception as e:
            print(f"  {chrom}: ERROR: {e}", flush=True)
        finally:
            await conn.close()

    elapsed = time.time() - t0
    print(f"  >>> {name} complete: {total} total updates in {elapsed:.0f}s\n", flush=True)


async def run_subprocess_module(module_name: str, extra_args: list[str] | None = None):
    """Run an ingestion module as subprocess with correct env."""
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

    cmd = ["uv", "run", "python", "-m", f"polymer_genomics.ingest.{module_name}",
           "--build", "hg38"]
    if extra_args:
        cmd.extend(extra_args)

    proc = await asyncio.create_subprocess_exec(
        *cmd, env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode() if stdout else ""
    lines = output.strip().split("\n")
    if proc.returncode == 0:
        print(f"  {module_name}: OK ({lines[-1] if lines else ''})", flush=True)
    else:
        print(f"  {module_name}: FAILED (rc={proc.returncode})", flush=True)
        for line in lines[-5:]:
            print(f"    {line}", flush=True)


async def main():
    sys.stdout.reconfigure(line_buffering=True)

    print("=" * 60, flush=True)
    print(" REPOPULATING BIOPHYSICS COLUMNS (batch UPDATE)", flush=True)
    print("=" * 60, flush=True)
    t0 = time.time()

    # 1. BigWig modules (32 columns)
    for name, col_map, data_dir in BIGWIG_MODULES:
        print(f"\n>>> {name} ({len(col_map)} cols)", flush=True)
        await process_module(name, col_map, data_dir)

    # 2. FASTA-based modules
    fasta = str(Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/hg38.fa"))
    for mod in ["melting_domains", "sbs_bulk_update"]:
        print(f"\n>>> {mod} (FASTA-based)", flush=True)
        await run_subprocess_module(mod, ["--fasta", fasta])

    # 3. DB-derived modules
    for mod in ["replication_timing", "gene_density", "te_fractions", "derived_densities"]:
        print(f"\n>>> {mod} (DB-derived)", flush=True)
        await run_subprocess_module(mod)

    # 4. Recombination
    print(f"\n>>> palsson_recombination", flush=True)
    await run_subprocess_module("palsson_recombination")

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}", flush=True)
    print(f" COMPLETE in {elapsed / 60:.1f} minutes", flush=True)
    print(f"{'=' * 60}", flush=True)
    print(f"\n STILL MISSING (9GB download needed):", flush=True)
    print(f"   phylop_241way_mean, phastcons_241way_mean, b_score_mean", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
