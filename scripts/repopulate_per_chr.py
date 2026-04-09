#!/usr/bin/env python3
"""Repopulate NULL biophysics columns — per-chromosome UPDATE to avoid proxy timeout.

Stages BigWig data into a temp table per chromosome, then UPDATEs.
Fresh connection per chromosome. Works reliably over fly proxy.

Usage:
    cd /Users/zbb2/Desktop/PolymerGenomicsAPI
    uv run python scripts/repopulate_per_chr.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path

import asyncpg
import pyBigWig

sys.stdout.reconfigure(line_buffering=True)

DB = dict(
    host="localhost",
    port=5433,
    database="polymer_genomics_api",
    user="polymer_genomics_api",
    password="4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL",
)

PE = Path.home() / "Desktop" / "Polymer_Evolution"
P1 = PE / "phase1" / "output" / "window_1000"
P2 = PE / "phase2" / "output" / "window_1000"
P35 = PE / "phase3_5" / "output" / "window_1000"

CHR_IDS = {f"chr{i}": i for i in range(1, 23)}
CHR_IDS["chrX"] = 23

MODULES = [
    ("DNAshape absolute", {
        "mgw_mean": "dnashape_mgw.bw", "prot_mean": "dnashape_prot.bw",
        "roll_mean": "dnashape_roll.bw", "helt_mean": "dnashape_helt.bw",
    }, P1),
    ("DNAshape delta", {
        "delta_mgw": "delta_mgw.bw", "delta_prot": "delta_prot.bw",
        "delta_roll": "delta_roll.bw", "delta_helt": "delta_helt.bw",
    }, P1),
    ("Green's function", {
        "correlation_length": "correlation_length.bw",
        "integrated_response": "integrated_response.bw",
        "perturbation_reach": "perturbation_reach.bw",
        "response_asymmetry": "response_asymmetry.bw",
    }, P35),
]


async def update_one_chr(chrom: str, chr_id: int, col_map: dict[str, str], data_dir: Path) -> int:
    """Stage + UPDATE for one chromosome. Fresh connection."""
    conn = await asyncpg.connect(**DB, timeout=120,
                                  command_timeout=300)
    try:
        cols = list(col_map.keys())

        # Create temp staging table
        col_defs = ", ".join(f"{c} real" for c in cols)
        await conn.execute("DROP TABLE IF EXISTS _stg")
        await conn.execute(f"""
            CREATE TEMP TABLE _stg (
                start_pos int, {col_defs}
            )
        """)

        # Read BigWig intervals for this chromosome
        bws = {}
        for col, fn in col_map.items():
            bws[col] = pyBigWig.open(str(data_dir / fn))

        # Use first BigWig to get the window grid
        ref_bw = list(bws.values())[0]
        if chrom not in ref_bw.chroms():
            for bw in bws.values():
                bw.close()
            return 0

        intervals = ref_bw.intervals(chrom)
        if not intervals:
            for bw in bws.values():
                bw.close()
            return 0

        # Build all interval lookups
        chr_data = {}
        for col, bw in bws.items():
            ints = bw.intervals(chrom)
            chr_data[col] = {int(s): v for s, e, v in ints} if ints else {}

        # Build records for COPY
        records = []
        for start, end, _ in intervals:
            start_i = int(start)
            row = [start_i]
            for col in cols:
                row.append(chr_data[col].get(start_i))
            records.append(tuple(row))

        for bw in bws.values():
            bw.close()

        if not records:
            return 0

        # COPY into staging
        await conn.copy_records_to_table(
            "_stg", records=records,
            columns=["start_pos"] + cols,
        )

        # UPDATE from staging — single chromosome, small enough for proxy
        set_clauses = ", ".join(f"{c} = s.{c}" for c in cols)
        result = await conn.execute(f"""
            UPDATE biophysics.sequence_properties bp
            SET {set_clauses}
            FROM _stg s
            WHERE bp.build = 'hg38'
              AND bp.chr_id = {chr_id}
              AND bp.start_pos = s.start_pos
        """)

        count = int(result.split()[-1]) if result else 0
        return count

    finally:
        await conn.close()


async def process_module(name: str, col_map: dict[str, str], data_dir: Path):
    """Process one module across all chromosomes."""
    # Verify files exist
    for col, fn in col_map.items():
        path = data_dir / fn
        if not path.exists():
            print(f"  SKIP: {fn} not found", flush=True)
            return

    t0 = time.time()
    total = 0

    for chrom, chr_id in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        try:
            n = await update_one_chr(chrom, chr_id, col_map, data_dir)
            total += n
            elapsed = time.time() - t0
            print(f"  {chrom}: {n:,} rows ({elapsed:.0f}s)", flush=True)
        except Exception as e:
            print(f"  {chrom}: ERROR — {e}", flush=True)

    elapsed = time.time() - t0
    print(f"  === {name}: {total:,} total in {elapsed:.0f}s ===\n", flush=True)


async def run_subprocess(module_name: str, extra_args: list[str] | None = None):
    """Run a module as subprocess."""
    env = os.environ.copy()
    env.update({k.upper(): str(v) for k, v in DB.items()})
    env["POSTGRES_USER_PASSWORD"] = DB["password"]
    env["POSTGRES_ADMIN_USER"] = DB["user"]

    cmd = ["uv", "run", "python", "-m",
           f"polymer_genomics.ingest.{module_name}", "--build", "hg38"]
    if extra_args:
        cmd.extend(extra_args)

    print(f"  Running {module_name}...", flush=True)
    proc = await asyncio.create_subprocess_exec(
        *cmd, env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    output = stdout.decode() if stdout else ""
    lines = output.strip().split("\n")
    if proc.returncode == 0:
        print(f"  {module_name}: OK", flush=True)
        for line in lines[-3:]:
            print(f"    {line}", flush=True)
    else:
        print(f"  {module_name}: FAILED", flush=True)
        for line in lines[-5:]:
            print(f"    {line}", flush=True)


async def main():
    print("=" * 60, flush=True)
    print(" REPOPULATING BIOPHYSICS (per-chromosome)", flush=True)
    print(f" Proxy: localhost:{DB['port']}", flush=True)
    print("=" * 60, flush=True)

    t0 = time.time()

    # BigWig modules (per-chromosome UPDATE)
    for name, col_map, data_dir in MODULES:
        print(f"\n>>> {name} ({len(col_map)} cols)", flush=True)
        await process_module(name, col_map, data_dir)

    # Subprocess modules (they handle their own staging)
    print("\n>>> replication_timing (2 cols)", flush=True)
    await run_subprocess("replication_timing")

    print("\n>>> melting_domains (3 cols, FASTA)", flush=True)
    await run_subprocess("melting_domains", ["--fasta", "data/hg38.fa"])

    print("\n>>> sbs_bulk_update (4 cols, FASTA)", flush=True)
    await run_subprocess("sbs_bulk_update", ["--fasta", "data/hg38.fa"])

    print("\n>>> gene_density (3 cols)", flush=True)
    await run_subprocess("gene_density")

    print("\n>>> te_fractions (6 cols)", flush=True)
    await run_subprocess("te_fractions")

    print("\n>>> derived_densities", flush=True)
    await run_subprocess("derived_densities")

    print("\n>>> palsson_recombination", flush=True)
    await run_subprocess("palsson_recombination")

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}", flush=True)
    print(f" COMPLETE: {elapsed / 60:.1f} minutes", flush=True)
    print(f" MISSING: phylop, phastcons, b_score (need download)", flush=True)
    print(f"{'=' * 60}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
