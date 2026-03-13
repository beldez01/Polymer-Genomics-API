"""Bulk shape + delta-shape ingestion, per-chromosome with long timeouts.

Usage::
    POSTGRES_HOST=localhost POSTGRES_PORT=15432 POSTGRES_DB=polymer_genomics_api \
    POSTGRES_USER=polymer_genomics_api POSTGRES_USER_PASSWORD=sUSi45D98nZS7gx \
    uv run python -m polymer_genomics.ingest.shape_bulk
"""
from __future__ import annotations
import asyncio, os, sys
import asyncpg
import pyBigWig

DATA_DIR = os.path.expanduser("~/Desktop/Polymer_Evolution/phase1/output/window_1000")

CHR_MAP = {f"chr{i}": i for i in range(1, 23)}
CHR_MAP.update({"chrX": 23, "chrY": 24, "chrM": 25})

ABS_FILES = {"mgw_mean": "dnashape_mgw.bw", "prot_mean": "dnashape_prot.bw",
             "roll_mean": "dnashape_roll.bw", "helt_mean": "dnashape_helt.bw"}
DELTA_FILES = {"delta_mgw": "delta_mgw.bw", "delta_prot": "delta_prot.bw",
               "delta_roll": "delta_roll.bw", "delta_helt": "delta_helt.bw"}

async def get_conn():
    return await asyncpg.connect(
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ.get("POSTGRES_DB", "polymer_genomics"),
        user=os.environ.get("POSTGRES_USER", "ingest_writer"),
        password=os.environ.get("POSTGRES_USER_PASSWORD", ""),
        command_timeout=600,
        timeout=120,
    )

def read_bw_chr(files_map: dict, chrom: str) -> list[tuple]:
    """Read all tracks for one chromosome, return list of (chr_id, start, v1, v2, v3, v4)."""
    chr_id = CHR_MAP.get(chrom)
    if chr_id is None:
        return []

    bws = {col: pyBigWig.open(os.path.join(DATA_DIR, fn)) for col, fn in files_map.items()}
    ref = list(bws.values())[0]
    if chrom not in ref.chroms():
        for b in bws.values(): b.close()
        return []

    intervals = ref.intervals(chrom)
    if not intervals:
        for b in bws.values(): b.close()
        return []

    data = {}
    for col, bw in bws.items():
        ti = bw.intervals(chrom)
        data[col] = {int(s): v for s, e, v in ti} if ti else {}
    for b in bws.values(): b.close()

    cols = list(files_map.keys())
    return [(chr_id, int(s), *(data[c].get(int(s)) for c in cols)) for s, e, _ in intervals]

async def stage_and_update(rows, columns, set_clause, tag):
    """Stage rows into temp table, UPDATE, drop."""
    conn = await get_conn()
    try:
        tbl = f"_s_{tag}"
        col_defs = "chr_id smallint, start_pos int, " + ", ".join(f"{c} real" for c in columns)
        await conn.execute(f"CREATE TEMP TABLE {tbl} ({col_defs})")
        await conn.copy_records_to_table(tbl, records=rows, columns=["chr_id", "start_pos"] + columns)
        result = await conn.execute(f"""
            UPDATE biophysics.sequence_properties bp
            SET {set_clause}
            FROM {tbl} s
            WHERE bp.build = 'hg38'::genome_build AND bp.chr_id = s.chr_id AND bp.start_pos = s.start_pos
        """)
        await conn.execute(f"DROP TABLE {tbl}")
        return int(result.split()[-1]) if result else 0
    finally:
        await conn.close()

async def main():
    # Check which chromosomes already have data (for resume)
    conn = await get_conn()
    done_chrs = set()
    rows_check = await conn.fetch("""
        SELECT DISTINCT chr_id FROM biophysics.sequence_properties
        WHERE build='hg38' AND mgw_mean IS NOT NULL AND delta_mgw IS NOT NULL
    """)
    for r in rows_check:
        done_chrs.add(r["chr_id"])
    await conn.close()
    if done_chrs:
        print(f"Resuming — {len(done_chrs)} chromosomes already done")

    abs_cols = list(ABS_FILES.keys())
    abs_set = ", ".join(f"{c} = s.{c}" for c in abs_cols)
    delta_cols = list(DELTA_FILES.keys())
    delta_set = ", ".join(f"{c} = s.{c}" for c in delta_cols)

    total = 0
    chroms = sorted(CHR_MAP.keys(), key=lambda c: CHR_MAP[c])

    for chrom in chroms:
        chr_id = CHR_MAP[chrom]
        if chr_id in done_chrs:
            print(f"  {chrom}: already done, skipping")
            continue

        # Absolute shape
        rows = read_bw_chr(ABS_FILES, chrom)
        if rows:
            n = await stage_and_update(rows, abs_cols, abs_set, f"abs_{CHR_MAP[chrom]}")
            sys.stdout.write(f"  {chrom}: {n:,} abs")
            sys.stdout.flush()
            total += n

        # Delta shape
        rows = read_bw_chr(DELTA_FILES, chrom)
        if rows:
            n = await stage_and_update(rows, delta_cols, delta_set, f"d_{CHR_MAP[chrom]}")
            sys.stdout.write(f" + {n:,} delta\n")
            sys.stdout.flush()
            total += n
        else:
            sys.stdout.write("\n")
            sys.stdout.flush()

    print(f"\nTotal updated: {total:,}")

if __name__ == "__main__":
    asyncio.run(main())
