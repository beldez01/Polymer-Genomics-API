"""Re-ingest melting domain tracks with corrected Poland-Scheraga model.

Designed for running over flaky fly proxy connections — processes one
chromosome at a time with per-batch reconnection.

Usage:
    # Start proxy first:
    fly proxy 15433:5432 -a polymer-db &

    # Run ingestion (all chromosomes):
    PYTHONPATH=src .venv/bin/python3 scripts/reingest_melting.py

    # Or specific chromosomes:
    PYTHONPATH=src .venv/bin/python3 scripts/reingest_melting.py --chr chr22 chr21
"""

import argparse
import asyncio
import time

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest.melting_domains import compute_all_tracks_numpy


DB_CONFIG = {
    "host": "localhost",
    "port": 15433,
    "database": "polymer_genomics_api",
    "user": "polymer_genomics_api",
    "password": "4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL",
    "ssl": "disable",
    "command_timeout": 120,
}

FASTA_PATH = "data/hg38.fa"
BATCH_SIZE = 500  # Small batches to survive proxy drops
MAX_RETRIES = 3


async def get_connection():
    """Create a fresh connection."""
    return await asyncpg.connect(**DB_CONFIG)


async def get_layer_id(conn):
    """Get the biophysics layer ID."""
    return await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'sequence_biophysics_l0' AND is_default = true"
    )


async def get_positions(conn, chr_id, layer_id):
    """Get all window start positions for a chromosome."""
    rows = await conn.fetch(
        "SELECT start_pos FROM biophysics.sequence_properties "
        "WHERE build = 'hg38' AND chr_id = $1 AND layer_id = $2 "
        "ORDER BY start_pos",
        chr_id, layer_id,
    )
    return [r["start_pos"] for r in rows]


async def update_batch(conn, batch, layer_id, chr_id):
    """Update a batch of rows."""
    await conn.executemany(
        """UPDATE biophysics.sequence_properties
           SET melting_cooperativity=$1, bubble_propensity=$2,
               melting_width=$3, sbs_c_to_a_ddg=$4,
               sbs_c_to_g_ddg=$5, sbs_c_to_t_ddg=$6,
               sbs_t_to_a_ddg=$7
           WHERE build='hg38'::genome_build AND chr_id=$8
             AND start_pos=$9 AND layer_id=$10""",
        batch,
    )


async def process_chromosome(chrom: str, fasta):
    """Process one chromosome with retry logic."""
    chr_id = CHR_NAME_TO_ID[chrom]
    chr_seq = str(fasta[chrom])
    chr_len = len(chr_seq)

    # Get positions (with retry)
    for attempt in range(MAX_RETRIES):
        try:
            conn = await get_connection()
            layer_id = await get_layer_id(conn)
            positions = await get_positions(conn, chr_id, layer_id)
            await conn.close()
            break
        except Exception as e:
            print(f"  {chrom}: position fetch attempt {attempt+1} failed: {e}")
            await asyncio.sleep(2)
    else:
        print(f"  {chrom}: FAILED to fetch positions after {MAX_RETRIES} attempts")
        return 0

    print(f"  {chrom}: {len(positions)} windows to compute...")

    # Process in batches
    total_updated = 0
    batch_num = 0

    for i in range(0, len(positions), BATCH_SIZE):
        batch_positions = positions[i:i + BATCH_SIZE]
        batch_num += 1

        # Compute tracks
        batch_data = []
        for start_pos in batch_positions:
            end_pos = min(start_pos + 1000, chr_len)
            window_seq = chr_seq[start_pos:end_pos]
            if len(window_seq) < 50:
                continue
            tracks = compute_all_tracks_numpy(window_seq)
            batch_data.append((
                tracks["melting_cooperativity"],
                tracks["bubble_propensity"],
                tracks["melting_width"],
                tracks["sbs_c_to_a_ddg"],
                tracks["sbs_c_to_g_ddg"],
                tracks["sbs_c_to_t_ddg"],
                tracks["sbs_t_to_a_ddg"],
                chr_id, start_pos, layer_id,
            ))

        # Upload batch (with retry)
        for attempt in range(MAX_RETRIES):
            try:
                conn = await get_connection()
                await update_batch(conn, batch_data, layer_id, chr_id)
                await conn.close()
                total_updated += len(batch_data)
                break
            except Exception as e:
                print(f"  {chrom} batch {batch_num}: attempt {attempt+1} failed: {e}")
                await asyncio.sleep(3)
        else:
            print(f"  {chrom} batch {batch_num}: FAILED after {MAX_RETRIES} attempts, skipping")

        if batch_num % 10 == 0:
            pct = min(100, round(100 * (i + BATCH_SIZE) / len(positions)))
            print(f"  {chrom}: {pct}% ({total_updated:,} updated)")

    print(f"  {chrom}: done ({total_updated:,} updated)")
    return total_updated


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chr", nargs="*", help="Specific chromosomes")
    parser.add_argument("--fasta", default=FASTA_PATH)
    args = parser.parse_args()

    from pyfaidx import Fasta
    fasta = Fasta(args.fasta)

    chroms = args.chr or sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c])
    chroms = [c for c in chroms if c in fasta.keys()]

    print(f"Re-ingesting melting tracks for {len(chroms)} chromosomes")
    start = time.monotonic()
    grand_total = 0

    for chrom in chroms:
        total = await process_chromosome(chrom, fasta)
        grand_total += total

    elapsed = time.monotonic() - start
    print(f"\nComplete: {grand_total:,} rows updated in {elapsed:.0f}s")


if __name__ == "__main__":
    asyncio.run(main())
