"""Palsson et al. 2025 deCODE recombination maps ingestion.

Reads maternal + paternal recombination maps (CO, NCO, DSB rates at 1 Mb)
and broadcasts each rate to all 1000 underlying 1-kb biophysics windows.

Source: Nature 639:700-707 (2025), DOI: 10.1038/s41586-024-08450-5
Data:   github.com/DecodeGenetics/PalssonEtAl_Nature_2024

Usage::

    uv run python -m polymer_genomics.ingest.palsson_recombination
    uv run python -m polymer_genomics.ingest.palsson_recombination --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path


from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import check_base_rows

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 50_000
BIN_SIZE = 1000
PALSSON_WINDOW = 1_000_000

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "downloads" / "palsson2025"
MAT_MAP = DATA_DIR / "maps.mat.tsv"
PAT_MAP = DATA_DIR / "maps.pat.tsv"

COLUMNS = [
    "co_rate_cmmb", "nco_rate", "dsb_rate",
    "mat_co_rate", "mat_nco_rate",
    "pat_co_rate", "pat_nco_rate",
]


# ── Parse Palsson maps ──────────────────────────────────────────────────────


def _parse_palsson_map(path: Path) -> dict[str, list[tuple[int, float, float, float]]]:
    """Parse Palsson TSV → {chrom: [(pos_center, co_rate, nco_rate, dsb_rate), ...]}."""
    result: dict[str, list[tuple[int, float, float, float]]] = {}

    with open(path) as f:
        for line in f:
            if line.startswith("#"):
                continue
            if line.startswith("Chr\t"):
                continue  # header
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 7:
                continue

            chrom = fields[0]
            if chrom not in CHR_NAME_TO_ID:
                continue

            try:
                pos = int(fields[1])
                nco_rate = float(fields[2])
                co_rate = float(fields[3])
                dsb_rate = float(fields[4])
            except (ValueError, IndexError):
                continue

            if chrom not in result:
                result[chrom] = []
            result[chrom].append((pos, co_rate, nco_rate, dsb_rate))

    total = sum(len(v) for v in result.values())
    print(f"  Parsed {total:,} windows from {path.name}")
    return result


def _broadcast_to_1kb(
    maps: dict[str, list[tuple[int, float, float, float]]],
) -> dict[tuple[str, int], tuple[float, float, float]]:
    """Broadcast 1 Mb rates to all 1 kb bins in each window.

    Returns {(chrom, start_pos_0based): (co_rate, nco_rate, dsb_rate)}.
    """
    result = {}
    for chrom, entries in maps.items():
        for pos_center, co, nco, dsb in entries:
            win_start = pos_center - PALSSON_WINDOW // 2
            win_end = pos_center + PALSSON_WINDOW // 2
            for bp_start in range(max(0, win_start), win_end, BIN_SIZE):
                result[(chrom, bp_start)] = (co, nco, dsb)
    return result


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    if not MAT_MAP.is_file() or not PAT_MAP.is_file():
        print(f"ERROR: Palsson map files not found in {DATA_DIR}")
        print("  Download from: github.com/DecodeGenetics/PalssonEtAl_Nature_2024")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Palsson 2025 recombination maps - {build}")
            print(f"{'='*60}")

            await check_base_rows(conn, build)

            # Idempotency — check if FULLY loaded (>2M rows with data)
            n_existing = await conn.fetchval(
                "SELECT count(*) FROM biophysics.sequence_properties "
                "WHERE build = $1::genome_build AND co_rate_cmmb IS NOT NULL",
                build,
            )
            if n_existing is not None and n_existing > 2_000_000:
                print(f"  Palsson recombination data already present ({n_existing:,} rows). Skipping.")
                continue
            elif n_existing and n_existing > 0:
                print(f"  Partial data found ({n_existing:,} rows). Re-ingesting...")

            # Parse both maps
            print("\nParsing maternal map...")
            mat = _parse_palsson_map(MAT_MAP)
            print("Parsing paternal map...")
            pat = _parse_palsson_map(PAT_MAP)

            # Broadcast to 1 kb
            print("\nBroadcasting to 1 kb windows...")
            mat_1kb = _broadcast_to_1kb(mat)
            pat_1kb = _broadcast_to_1kb(pat)

            # Create staging table
            await conn.execute("""
                CREATE TEMP TABLE _palsson_staging (
                    chr_id       smallint NOT NULL,
                    start_pos    int NOT NULL,
                    co_rate_cmmb real,
                    nco_rate     real,
                    dsb_rate     real,
                    mat_co_rate  real,
                    mat_nco_rate real,
                    pat_co_rate  real,
                    pat_nco_rate real
                )
            """)

            # Build batch from both maps
            total = 0
            batch: list[tuple] = []

            # Get all unique (chrom, start_pos) from both maps
            all_keys = set(mat_1kb.keys()) | set(pat_1kb.keys())

            for chrom, start_pos in sorted(all_keys, key=lambda x: (CHR_NAME_TO_ID.get(x[0], 99), x[1])):
                chr_id = CHR_NAME_TO_ID.get(chrom)
                if chr_id is None:
                    continue

                mat_vals = mat_1kb.get((chrom, start_pos), (None, None, None))
                pat_vals = pat_1kb.get((chrom, start_pos), (None, None, None))

                # Average CO/NCO/DSB
                co = None
                nco = None
                dsb = None
                if mat_vals[0] is not None and pat_vals[0] is not None:
                    co = (mat_vals[0] + pat_vals[0]) / 2
                    nco = (mat_vals[1] + pat_vals[1]) / 2
                    dsb = (mat_vals[2] + pat_vals[2]) / 2

                batch.append((
                    chr_id, start_pos, co, nco, dsb,
                    mat_vals[0], mat_vals[1],
                    pat_vals[0], pat_vals[1],
                ))

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "_palsson_staging",
                        records=batch,
                        columns=["chr_id", "start_pos"] + COLUMNS,
                    )
                    total += len(batch)
                    if total % 500_000 == 0:
                        print(f"  Staged {total:,} rows...")
                    batch = []

            if batch:
                await conn.copy_records_to_table(
                    "_palsson_staging",
                    records=batch,
                    columns=["chr_id", "start_pos"] + COLUMNS,
                )
                total += len(batch)

            print(f"  Staged {total:,} rows")

            # UPDATE in chromosome batches (avoids fly proxy timeout on large UPDATE)
            print("  Updating biophysics.sequence_properties (per-chromosome)...")
            total_updated = 0
            for chr_name, chr_id in sorted(CHR_NAME_TO_ID.items(), key=lambda x: x[1]):
                result = await conn.execute("""
                    UPDATE biophysics.sequence_properties bp
                    SET co_rate_cmmb = s.co_rate_cmmb,
                        nco_rate     = s.nco_rate,
                        dsb_rate     = s.dsb_rate,
                        mat_co_rate  = s.mat_co_rate,
                        mat_nco_rate = s.mat_nco_rate,
                        pat_co_rate  = s.pat_co_rate,
                        pat_nco_rate = s.pat_nco_rate
                    FROM _palsson_staging s
                    WHERE bp.build = $1::genome_build
                      AND bp.chr_id = s.chr_id
                      AND bp.start_pos = s.start_pos
                      AND s.chr_id = $2
                """, build, chr_id)
                n = int(result.split()[-1]) if result else 0
                total_updated += n
                print(f"    {chr_name}: {n:,} rows")
            print(f"  Total updated: {total_updated:,}")

            # Also populate recomb_rate_cmmb if empty
            result2 = await conn.execute("""
                UPDATE biophysics.sequence_properties
                SET recomb_rate_cmmb = co_rate_cmmb
                WHERE build = $1::genome_build
                  AND recomb_rate_cmmb IS NULL
                  AND co_rate_cmmb IS NOT NULL
            """, build)
            print(f"  Backfilled recomb_rate_cmmb: {result2}")

            await conn.execute("DROP TABLE _palsson_staging")

        print("\nPalsson recombination ingestion complete.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest Palsson 2025 recombination maps")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
