"""Bulk SBS mutation dG ingestion via temp table + UPDATE JOIN.

Computes all 7 melting/SBS tracks locally from FASTA, loads into a temp table
via COPY, then does a single UPDATE ... FROM to populate the biophysics table.

This is ~100x faster than per-row UPDATE over a network proxy.
"""

from __future__ import annotations

import asyncio
import io
import struct
import sys

import asyncpg

from polymer_genomics.ingest.melting_domains import compute_all_tracks_numpy


async def bulk_update_sbs(
    conn: asyncpg.Connection,
    fasta_path: str,
    build: str = "hg38",
    chr_list: list[str] | None = None,
):
    from pyfaidx import Fasta
    from polymer_genomics.constants import CHR_NAME_TO_ID

    fasta = Fasta(fasta_path)

    layer_id = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'sequence_biophysics_l0' AND is_default = true"
    )
    if layer_id is None:
        raise RuntimeError("No default sequence_biophysics_l0 layer found")

    chroms = chr_list or sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c])
    total_updated = 0

    for chrom in chroms:
        if chrom not in fasta.keys():
            print(f"  {chrom}: not in FASTA, skipping")
            continue

        chr_id = CHR_NAME_TO_ID[chrom]

        # Check which positions need SBS data
        rows = await conn.fetch(
            "SELECT start_pos FROM biophysics.sequence_properties "
            "WHERE build = $1::genome_build AND chr_id = $2 AND layer_id = $3 "
            "  AND sbs_c_to_t_ddg IS NULL "
            "ORDER BY start_pos",
            build, chr_id, layer_id,
        )
        positions = [r["start_pos"] for r in rows]
        if not positions:
            print(f"  {chrom}: already complete, skipping")
            continue

        print(f"  {chrom}: {len(positions)} windows to compute...", end="", flush=True)

        # Load chromosome sequence
        chr_seq = str(fasta[chrom])
        chr_len = len(chr_seq)

        # Compute all tracks locally
        records = []
        for i, start_pos in enumerate(positions):
            end_pos = min(start_pos + 1000, chr_len)
            window_seq = chr_seq[start_pos:end_pos]
            if len(window_seq) < 50:
                continue

            tracks = compute_all_tracks_numpy(window_seq)
            records.append((
                chr_id,
                start_pos,
                tracks["melting_cooperativity"],
                tracks["bubble_propensity"],
                tracks["melting_width"],
                tracks["sbs_c_to_a_ddg"],
                tracks["sbs_c_to_g_ddg"],
                tracks["sbs_c_to_t_ddg"],
                tracks["sbs_t_to_a_ddg"],
            ))

            if (i + 1) % 10000 == 0:
                print(f"\r  {chrom}: computed {i + 1}/{len(positions)}...", end="", flush=True)

        if not records:
            print(" no valid windows")
            continue

        print(f"\r  {chrom}: computed {len(records)} windows, uploading...", end="", flush=True)

        # Create temp table
        await conn.execute("""
            CREATE TEMP TABLE IF NOT EXISTS _sbs_staging (
                chr_id smallint,
                start_pos int,
                melting_cooperativity real,
                bubble_propensity real,
                melting_width real,
                sbs_c_to_a_ddg real,
                sbs_c_to_g_ddg real,
                sbs_c_to_t_ddg real,
                sbs_t_to_a_ddg real
            )
        """)
        await conn.execute("TRUNCATE _sbs_staging")

        # Bulk load via copy_records_to_table
        await conn.copy_records_to_table(
            "_sbs_staging",
            records=records,
            columns=[
                "chr_id", "start_pos",
                "melting_cooperativity", "bubble_propensity", "melting_width",
                "sbs_c_to_a_ddg", "sbs_c_to_g_ddg", "sbs_c_to_t_ddg", "sbs_t_to_a_ddg",
            ],
        )

        # Single UPDATE ... FROM
        updated = await conn.fetchval(f"""
            WITH upd AS (
                UPDATE biophysics.sequence_properties bp
                SET melting_cooperativity = COALESCE(bp.melting_cooperativity, s.melting_cooperativity),
                    bubble_propensity = COALESCE(bp.bubble_propensity, s.bubble_propensity),
                    melting_width = COALESCE(bp.melting_width, s.melting_width),
                    sbs_c_to_a_ddg = s.sbs_c_to_a_ddg,
                    sbs_c_to_g_ddg = s.sbs_c_to_g_ddg,
                    sbs_c_to_t_ddg = s.sbs_c_to_t_ddg,
                    sbs_t_to_a_ddg = s.sbs_t_to_a_ddg
                FROM _sbs_staging s
                WHERE bp.build = $1::genome_build
                  AND bp.chr_id = s.chr_id
                  AND bp.start_pos = s.start_pos
                  AND bp.layer_id = $2
                RETURNING 1
            )
            SELECT count(*) FROM upd
        """, build, layer_id)

        total_updated += updated
        print(f"\r  {chrom}: {updated:,} rows updated ✓          ")

        # Free chr memory
        del chr_seq, records

    await conn.execute("DROP TABLE IF EXISTS _sbs_staging")
    print(f"\nTotal: {total_updated:,} rows updated")
    return total_updated


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Bulk SBS mutation dG ingestion")
    parser.add_argument("--fasta", default="data/hg38.fa")
    parser.add_argument("--build", default="hg38")
    parser.add_argument("--chr", nargs="*", help="Specific chromosomes")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--db", default="polymer_genomics_api")
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    async def main():
        conn = await asyncpg.connect(
            host=args.host, port=args.port,
            database=args.db, user=args.user, password=args.password,
        )
        try:
            await bulk_update_sbs(conn, args.fasta, args.build, args.chr)
        finally:
            await conn.close()

    asyncio.run(main())
