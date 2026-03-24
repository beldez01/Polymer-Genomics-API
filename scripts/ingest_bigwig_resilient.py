"""Resilient BigWig → 1kb INSERT ingestion with per-chromosome reconnection.

Handles the Fly.io shared-cpu DB limitations:
- Reconnects after each chromosome to avoid connection timeouts
- Small batch sizes (10K) to keep memory low
- Single-threaded to avoid overloading the shared DB

Usage::
    uv run python scripts/ingest_bigwig_resilient.py --mode tf
    uv run python scripts/ingest_bigwig_resilient.py --mode accessibility
"""

from __future__ import annotations

import argparse
import asyncio
import glob
import os
import time

import asyncpg
import pyBigWig

CHR_NAME_TO_ID = {f"chr{i}": i for i in range(1, 23)} | {"chrX": 23, "chrY": 24}

DB_CONFIG = {
    "host": os.environ.get("POSTGRES_HOST", "localhost"),
    "port": int(os.environ.get("POSTGRES_PORT", "15432")),
    "user": os.environ.get("POSTGRES_USER", "polymer_genomics_api"),
    "password": os.environ.get("POSTGRES_USER_PASSWORD", "4Nt2CNeHMncMjKv8WHPbo1w8w0ZupTdL"),
    "database": os.environ.get("POSTGRES_DB", "polymer_genomics_api"),
    "command_timeout": 300,
}

WINDOW_SIZE = 1000
BATCH_SIZE = 10_000

# ── TF Binding Configuration ──

TF_COLUMNS = [
    "ctcf_gm12878", "sp1_gm12878", "yy1_gm12878", "polr2a_gm12878",
    "ezh2_gm12878", "suz12_gm12878", "rest_gm12878",
    "ctcf_k562", "spi1_k562", "gata2_k562", "runx1_k562",
    "tal1_k562", "sp1_k562", "polr2a_k562", "ezh2_k562",
]

TF_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/encode/tf_chipseq"
)

# ── Accessibility Configuration ──

ACC_COLUMNS = ["dnase_gm12878", "dnase_k562", "atac_hsc", "atac_monocyte"]

ACC_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/accessibility"
)


def find_bigwig(data_dir: str, col_name: str) -> str | None:
    """Find BigWig file matching column name by glob."""
    pattern = os.path.join(data_dir, f"{col_name}_*.bigWig")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]
    # Try exact name
    exact = os.path.join(data_dir, f"{col_name}.bigWig")
    if os.path.exists(exact):
        return exact
    return None


def open_bigwigs(data_dir: str, columns: list[str]) -> dict[str, pyBigWig.pyBigWig | None]:
    """Open all BigWig files, return {col_name: handle_or_None}."""
    handles = {}
    for col in columns:
        path = find_bigwig(data_dir, col)
        if path:
            try:
                handles[col] = pyBigWig.open(path)
                print(f"  {col}: {os.path.basename(path)}")
            except RuntimeError as e:
                print(f"  {col}: FAILED to open ({e})")
                handles[col] = None
        else:
            print(f"  {col}: not found, will be NULL")
            handles[col] = None
    return handles


def bin_chromosome(
    bw_handles: dict[str, pyBigWig.pyBigWig | None],
    columns: list[str],
    chrom: str,
    chrom_len: int,
) -> list[tuple]:
    """Bin BigWig signals to 1kb windows for one chromosome."""
    n_windows = chrom_len // WINDOW_SIZE  # Use floor division (don't overshoot)

    chr_signals: dict[str, list] = {}
    for col in columns:
        bw = bw_handles.get(col)
        if bw is None or chrom not in (bw.chroms() or {}):
            chr_signals[col] = [None] * n_windows
        else:
            try:
                bw_len = bw.chroms()[chrom]
                end = min(n_windows * WINDOW_SIZE, bw_len)
                bins = end // WINDOW_SIZE
                if bins <= 0:
                    chr_signals[col] = [None] * n_windows
                    continue
                vals = bw.stats(chrom, 0, bins * WINDOW_SIZE, type="mean", nBins=bins)
                if bins < n_windows:
                    vals = vals + [None] * (n_windows - bins)
                chr_signals[col] = vals
            except RuntimeError:
                chr_signals[col] = [None] * n_windows

    chr_id = CHR_NAME_TO_ID[chrom]
    rows = []
    for i in range(n_windows):
        start = i * WINDOW_SIZE
        end = start + WINDOW_SIZE
        values = [chr_signals[col][i] for col in columns]
        rows.append((chr_id, start, end, *values))

    return rows


async def get_or_create_layer(
    conn: asyncpg.Connection,
    layer_key: str,
    layer_type: str,
    name: str,
    source: str,
    build: str = "hg38",
) -> str:
    """Get existing or create new layer."""
    version = f"1.0.{build}"
    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing:
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
           (layer_key, version, name, layer_type, genome_build,
            source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, $4::layer_type, $5,
                   $6, 'cc_by_4_0', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, name, layer_type, build, source,
    )
    print(f"  Registered layer: {layer_key} -> {layer_id}")
    return layer_id


async def ingest_mode(
    mode: str,
    columns: list[str],
    data_dir: str,
    schema: str,
    table: str,
    layer_key: str,
    layer_type: str,
    layer_name: str,
    layer_source: str,
    build: str = "hg38",
):
    """Ingest BigWig tracks with per-chromosome reconnection."""
    print(f"\n{'='*60}")
    print(f"{layer_name} Ingestion - {build}")
    print(f"{'='*60}")

    print("\nOpening BigWig files...")
    bw_handles = open_bigwigs(data_dir, columns)

    # Find reference BigWig
    ref_bw = None
    for bw in bw_handles.values():
        if bw is not None:
            ref_bw = bw
            break
    if ref_bw is None:
        print("ERROR: No BigWig files available")
        return

    # Get layer ID (fresh connection)
    conn = await asyncpg.connect(**DB_CONFIG)
    try:
        layer_id = await get_or_create_layer(
            conn, layer_key, layer_type, layer_name, layer_source, build,
        )
    finally:
        await conn.close()

    db_columns = ["layer_id", "build", "chr_id", "start_pos", "end_pos"] + columns
    grand_total = 0
    t0 = time.time()

    for chrom in sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c]):
        if chrom not in (ref_bw.chroms() or {}):
            continue

        chrom_len = ref_bw.chroms()[chrom]
        ct0 = time.time()

        # Bin this chromosome locally
        rows = bin_chromosome(bw_handles, columns, chrom, chrom_len)

        if not rows:
            continue

        # Add layer_id and build to each row
        full_rows = [(layer_id, build, *r) for r in rows]

        # Connect, load, disconnect
        conn = await asyncpg.connect(**DB_CONFIG)
        try:
            # Load in batches
            for i in range(0, len(full_rows), BATCH_SIZE):
                batch = full_rows[i:i + BATCH_SIZE]
                await conn.copy_records_to_table(
                    table,
                    records=batch,
                    columns=db_columns,
                    schema_name=schema,
                )
                grand_total += len(batch)

            elapsed = time.time() - ct0
            print(f"  {chrom}: {len(rows):,} windows in {elapsed:.1f}s (total: {grand_total:,})", flush=True)
        finally:
            await conn.close()

    # Close BigWig handles
    for bw in bw_handles.values():
        if bw is not None:
            bw.close()

    total_time = time.time() - t0
    print(f"\nDone. Total: {grand_total:,} rows in {total_time:.0f}s")


async def main():
    parser = argparse.ArgumentParser(description="Resilient BigWig ingestion")
    parser.add_argument("--mode", choices=["tf", "accessibility"], required=True)
    parser.add_argument("--build", default="hg38")
    args = parser.parse_args()

    if args.mode == "tf":
        await ingest_mode(
            mode="tf",
            columns=TF_COLUMNS,
            data_dir=TF_DATA_DIR,
            schema="regulatory",
            table="tf_binding_signal",
            layer_key="tf_binding_signal",
            layer_type="tf_binding",
            layer_name="TF Binding Signal",
            layer_source="ENCODE ChIP-seq fold-change-over-control (CC BY 4.0)",
            build=args.build,
        )
    elif args.mode == "accessibility":
        await ingest_mode(
            mode="accessibility",
            columns=ACC_COLUMNS,
            data_dir=ACC_DATA_DIR,
            schema="regulatory",
            table="accessibility_signal",
            layer_key="accessibility_signal",
            layer_type="accessibility",
            layer_name="Accessibility Signal",
            layer_source="ENCODE DNase-seq (CC BY 4.0)",
            build=args.build,
        )


if __name__ == "__main__":
    asyncio.run(main())
