#!/usr/bin/env python3
"""Final repopulation: gene_density, derived_densities, replication_timing.
All per-chromosome with fresh connections."""

from __future__ import annotations
import asyncio, sys, time
from pathlib import Path

import asyncpg

sys.stdout.reconfigure(line_buffering=True)

DB = dict(host="localhost", port=5433, database="polymer_genomics_api",
          user="polymer_genomics_api", password="4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL")

CHR_IDS = {f"chr{i}": i for i in range(1, 23)}
CHR_IDS["chrX"] = 23

async def conn():
    return await asyncpg.connect(**DB, timeout=120, command_timeout=600)

async def run_per_chr(name, sql_fn):
    print(f"\n>>> {name}", flush=True)
    t0 = time.time()
    total = 0
    for chrom, cid in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        c = await conn()
        try:
            sql = sql_fn(cid)
            r = await c.execute(sql)
            n = int(r.split()[-1]) if r else 0
            total += n
            print(f"  {chrom}: {n} ({time.time()-t0:.0f}s)", flush=True)
        except Exception as e:
            print(f"  {chrom}: ERROR — {e}", flush=True)
        finally:
            await c.close()
    print(f"  === {name}: {total} total in {time.time()-t0:.0f}s ===", flush=True)

async def null_fill_per_chr(col):
    for chrom, cid in sorted(CHR_IDS.items(), key=lambda x: x[1]):
        c = await conn()
        try:
            await c.execute(f"UPDATE biophysics.sequence_properties SET {col} = 0 WHERE build = 'hg38' AND chr_id = {cid} AND {col} IS NULL")
        finally:
            await c.close()

async def main():
    print("=" * 60, flush=True)
    print(" FINAL REPOPULATION (per-chromosome)", flush=True)
    print("=" * 60, flush=True)

    # 1. Gene density
    await run_per_chr("gene_density", lambda cid: f"""
        UPDATE biophysics.sequence_properties bp SET gene_density = sub.cnt
        FROM (SELECT bp2.chr_id, bp2.start_pos, count(*) AS cnt
              FROM biophysics.sequence_properties bp2
              JOIN gene.features gf ON gf.build = bp2.build AND gf.chr_id = bp2.chr_id AND gf.coord && bp2.coord
              WHERE bp2.build = 'hg38' AND bp2.chr_id = {cid} AND gf.feature_type = 'gene'
              GROUP BY bp2.chr_id, bp2.start_pos) sub
        WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.chr_id = sub.chr_id AND bp.start_pos = sub.start_pos
    """)
    print("  Null-filling gene_density...", flush=True)
    await null_fill_per_chr("gene_density")

    # 2. Gene body fraction
    await run_per_chr("gene_bp_fraction", lambda cid: f"""
        UPDATE biophysics.sequence_properties bp SET gene_bp_fraction = sub.frac
        FROM (SELECT bp2.chr_id, bp2.start_pos,
                     LEAST(1.0, sum(GREATEST(0, LEAST(upper(gf.coord), upper(bp2.coord)) - GREATEST(lower(gf.coord), lower(bp2.coord))))::float / (upper(bp2.coord) - lower(bp2.coord))) AS frac
              FROM biophysics.sequence_properties bp2
              JOIN gene.features gf ON gf.build = bp2.build AND gf.chr_id = bp2.chr_id AND gf.coord && bp2.coord
              WHERE bp2.build = 'hg38' AND bp2.chr_id = {cid} AND gf.feature_type = 'gene'
              GROUP BY bp2.chr_id, bp2.start_pos, bp2.coord) sub
        WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.chr_id = sub.chr_id AND bp.start_pos = sub.start_pos
    """)
    await null_fill_per_chr("gene_bp_fraction")

    # 3. Median TPM
    await run_per_chr("median_tpm", lambda cid: f"""
        UPDATE biophysics.sequence_properties bp SET median_tpm = sub.med_tpm
        FROM (SELECT bp2.chr_id, bp2.start_pos,
                     percentile_cont(0.5) WITHIN GROUP (ORDER BY gt.median_tpm) AS med_tpm
              FROM biophysics.sequence_properties bp2
              JOIN expression.gene_tpm gt ON gt.build = bp2.build AND gt.chr_id = bp2.chr_id AND gt.coord && bp2.coord
              WHERE bp2.build = 'hg38' AND bp2.chr_id = {cid}
              GROUP BY bp2.chr_id, bp2.start_pos) sub
        WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.chr_id = sub.chr_id AND bp.start_pos = sub.start_pos
    """)

    # 4. cCRE density
    await run_per_chr("ccre_density", lambda cid: f"""
        UPDATE biophysics.sequence_properties bp SET ccre_density = sub.cnt
        FROM (SELECT bp2.chr_id, bp2.start_pos, count(*) AS cnt
              FROM biophysics.sequence_properties bp2
              JOIN regulatory.ccre c ON c.build = bp2.build AND c.chr_id = bp2.chr_id AND c.coord && bp2.coord
              WHERE bp2.build = 'hg38' AND bp2.chr_id = {cid}
              GROUP BY bp2.chr_id, bp2.start_pos) sub
        WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.chr_id = sub.chr_id AND bp.start_pos = sub.start_pos
    """)
    await null_fill_per_chr("ccre_density")

    # 5. Histone marks
    for col, mark, cell in [
        ("histone_h3k4me3_gm12878", "H3K4me3", "GM12878"),
        ("histone_h3k27me3_gm12878", "H3K27me3", "GM12878"),
        ("histone_h3k4me1_gm12878", "H3K4me1", "GM12878"),
        ("histone_h3k27ac_gm12878", "H3K27ac", "GM12878"),
    ]:
        await run_per_chr(col, lambda cid, m=mark, ct=cell, cn=col: f"""
            UPDATE biophysics.sequence_properties bp SET {cn} = sub.max_signal
            FROM (SELECT bp2.chr_id, bp2.start_pos, max(hp.signal_value) AS max_signal
                  FROM biophysics.sequence_properties bp2
                  JOIN regulatory.histone_peaks hp ON hp.build = bp2.build AND hp.chr_id = bp2.chr_id AND hp.coord && bp2.coord
                  WHERE bp2.build = 'hg38' AND bp2.chr_id = {cid} AND hp.mark = '{m}' AND hp.cell_type = '{ct}'
                  GROUP BY bp2.chr_id, bp2.start_pos) sub
            WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.chr_id = sub.chr_id AND bp.start_pos = sub.start_pos
        """)

    # 6. ChromHMM active fraction
    await run_per_chr("chromhmm_active_frac_e029", lambda cid: f"""
        UPDATE biophysics.sequence_properties bp SET chromhmm_active_frac_e029 = sub.active_frac
        FROM (SELECT bp2.chr_id, bp2.start_pos,
                     sum(CASE WHEN cs.state_id <= 7 THEN GREATEST(0, LEAST(upper(cs.coord), upper(bp2.coord)) - GREATEST(lower(cs.coord), lower(bp2.coord))) ELSE 0 END)::float / (upper(bp2.coord) - lower(bp2.coord)) AS active_frac
              FROM biophysics.sequence_properties bp2
              JOIN regulatory.chromatin_state cs ON cs.build = bp2.build AND cs.chr_id = bp2.chr_id AND cs.coord && bp2.coord
              WHERE bp2.build = 'hg38' AND bp2.chr_id = {cid} AND cs.epigenome_id = 'E029'
              GROUP BY bp2.chr_id, bp2.start_pos, bp2.coord) sub
        WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.chr_id = sub.chr_id AND bp.start_pos = sub.start_pos
    """)

    # 7. Replication timing from BED
    print("\n>>> replication_timing", flush=True)
    repli_dir = Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/replication")
    for bed_file, col in [("repli_timing_hg38_1kb.bed", "repli_gm12878"), ("repli_timing_k562_hg38_1kb.bed", "repli_k562")]:
        bed_path = repli_dir / bed_file
        if not bed_path.exists():
            print(f"  SKIP {col}: not found", flush=True)
            continue
        data = {}
        with open(bed_path) as f:
            for line in f:
                p = line.strip().split("\t")
                if len(p) < 4: continue
                try:
                    cname, start, val = p[0], int(float(p[1])), float(p[3])
                    cid = CHR_IDS.get(cname)
                    if cid: data.setdefault(cid, []).append((start, val))
                except: pass
        print(f"  {col}: loaded", flush=True)
        for chrom, cid in sorted(CHR_IDS.items(), key=lambda x: x[1]):
            entries = data.get(cid, [])
            if not entries: continue
            c = await conn()
            try:
                await c.execute("DROP TABLE IF EXISTS _r_stg")
                await c.execute("CREATE TEMP TABLE _r_stg (start_pos int, val real)")
                await c.copy_records_to_table("_r_stg", records=entries, columns=["start_pos", "val"])
                r = await c.execute(f"UPDATE biophysics.sequence_properties bp SET {col} = s.val FROM _r_stg s WHERE bp.build = 'hg38' AND bp.chr_id = {cid} AND bp.start_pos = s.start_pos")
                n = int(r.split()[-1]) if r else 0
                print(f"  {chrom}: {n}", flush=True)
            except Exception as e:
                print(f"  {chrom}: ERROR — {e}", flush=True)
            finally:
                await c.close()

    print(f"\n{'='*60}\n DONE\n{'='*60}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
