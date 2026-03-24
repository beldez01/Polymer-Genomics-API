"""Chromatin accessibility signal ingestion from ENCODE DNase/ATAC-seq BigWigs.

Bins signal to 1kb windows for GM12878/K562 DNase-seq and primary
hematopoietic ATAC-seq (Corces 2016) if available.

Requires: pyBigWig

Usage::

    uv run python -m polymer_genomics.ingest.accessibility_signal
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 50_000
WINDOW_SIZE = 1000

# ENCODE signal BigWig accessions (read-depth normalized signal)
BIGWIG_MAP: dict[str, dict] = {
    "dnase_gm12878": {"accession": "ENCFF915DFR", "type": "DNase-seq", "cell": "GM12878"},
    "dnase_k562":    {"accession": "ENCFF972GVB", "type": "DNase-seq", "cell": "K562"},
    "atac_hsc":      {"accession": None, "type": "ATAC-seq", "cell": "HSC", "note": "Corces 2016 GEO"},
    "atac_monocyte": {"accession": None, "type": "ATAC-seq", "cell": "Monocyte", "note": "Corces 2016 GEO"},
}

COLUMN_ORDER = list(BIGWIG_MAP.keys())

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    *COLUMN_ORDER,
]

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/accessibility"
)


def _encode_download_url(accession: str) -> str:
    return f"https://www.encodeproject.org/files/{accession}/@@download/{accession}.bigWig"


async def download_bigwigs(data_dir: str) -> dict[str, str | None]:
    """Download missing BigWig files. Returns {col_name: filepath_or_None}."""
    import requests

    paths: dict[str, str | None] = {}
    for col_name, info in BIGWIG_MAP.items():
        accession = info.get("accession")
        if accession is None:
            # Check if manually placed
            manual_path = os.path.join(data_dir, f"{col_name}.bigWig")
            if Path(manual_path).exists():
                paths[col_name] = manual_path
                print(f"  {col_name}: found manually placed file")
            else:
                paths[col_name] = None
                print(f"  {col_name}: no accession, skipping (place {col_name}.bigWig manually)")
            continue

        filename = f"{col_name}_{accession}.bigWig"
        filepath = os.path.join(data_dir, filename)
        paths[col_name] = filepath

        if Path(filepath).exists():
            print(f"  {col_name}: already downloaded")
            continue

        url = _encode_download_url(accession)
        print(f"  Downloading {col_name} ({info['type']} in {info['cell']})...")

        resp = requests.get(url, stream=True, timeout=120)
        resp.raise_for_status()

        with open(filepath, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        size_mb = Path(filepath).stat().st_size / (1024 * 1024)
        print(f"    Downloaded: {size_mb:.1f} MB")

    return paths


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "accessibility_signal"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
        VALUES
            ($1, $2, $3, 'accessibility', $4,
             'ENCODE DNase-seq (CC BY 4.0) + Corces 2016 ATAC-seq',
             'cc_by_4_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"Accessibility Signal ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_accessibility(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    bigwig_paths: dict[str, str | None],
) -> int:
    """Bin BigWig signal to 1kb windows and bulk-load."""
    import pyBigWig

    bw_handles: dict[str, object] = {}
    for col_name, filepath in bigwig_paths.items():
        if filepath is None or not Path(filepath).exists():
            bw_handles[col_name] = None
        else:
            bw_handles[col_name] = pyBigWig.open(filepath)

    try:
        ref_bw = None
        for bw in bw_handles.values():
            if bw is not None:
                ref_bw = bw
                break
        if ref_bw is None:
            raise RuntimeError("No BigWig files available")

        available_chroms = set(ref_bw.chroms().keys())
        total_loaded = 0
        batch: list[tuple] = []

        for chrom in sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c]):
            chr_id = CHR_NAME_TO_ID[chrom]
            if chrom not in available_chroms:
                continue

            chrom_len = ref_bw.chroms()[chrom]
            n_windows = (chrom_len + WINDOW_SIZE - 1) // WINDOW_SIZE

            chr_signals: dict[str, list[float | None]] = {}
            for col_name, bw in bw_handles.items():
                if bw is None or chrom not in bw.chroms():
                    chr_signals[col_name] = [None] * n_windows
                else:
                    try:
                        bw_chrom_len = bw.chroms()[chrom]
                        end_coord = min(n_windows * WINDOW_SIZE, bw_chrom_len)
                        actual_bins = end_coord // WINDOW_SIZE
                        if actual_bins <= 0:
                            chr_signals[col_name] = [None] * n_windows
                            continue
                        vals = bw.stats(
                            chrom, 0, actual_bins * WINDOW_SIZE,
                            type="mean", nBins=actual_bins,
                        )
                        if actual_bins < n_windows:
                            vals = vals + [None] * (n_windows - actual_bins)
                        chr_signals[col_name] = vals
                    except RuntimeError:
                        chr_signals[col_name] = [None] * n_windows

            for i in range(n_windows):
                start = i * WINDOW_SIZE
                end = min(start + WINDOW_SIZE, chrom_len)
                values = [chr_signals[col][i] for col in COLUMN_ORDER]
                batch.append((layer_id, build, chr_id, start, end, *values))

                if len(batch) >= BATCH_SIZE:
                    await conn.copy_records_to_table(
                        "accessibility_signal",
                        records=batch,
                        columns=COLUMNS,
                        schema_name="regulatory",
                    )
                    total_loaded += len(batch)
                    if total_loaded % 500_000 == 0:
                        print(f"    Loaded {total_loaded:,} rows...")
                    batch = []

            print(f"  {chrom}: {n_windows:,} windows")

        if batch:
            await conn.copy_records_to_table(
                "accessibility_signal",
                records=batch,
                columns=COLUMNS,
                schema_name="regulatory",
            )
            total_loaded += len(batch)

        print(f"  Total rows loaded: {total_loaded:,}")
        return total_loaded

    finally:
        for bw in bw_handles.values():
            if bw is not None:
                bw.close()


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    Path(data_dir).mkdir(parents=True, exist_ok=True)

    conn = await get_ingest_connection(admin=True)

    try:
        print(f"\n{'='*60}")
        print(f"Accessibility Signal Ingestion - {build}")
        print(f"{'='*60}")

        print("\nStep 1: Download BigWig files...")
        bigwig_paths = await download_bigwigs(data_dir)

        layer_id = await register_layer(conn, build)

        existing_count = await conn.fetchval(
            "SELECT count(*) FROM regulatory.accessibility_signal WHERE layer_id = $1",
            layer_id,
        )
        if existing_count > 0:
            print(f"  WARNING: {existing_count:,} rows already exist. Skipping.")
            return

        print("\nStep 2: Binning to 1kb and loading...")
        async with ingest_transaction(conn):
            total = await ingest_accessibility(conn, build, layer_id, bigwig_paths)
        print(f"\n  Accessibility rows loaded: {total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest ENCODE accessibility signal (1kb bins)",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
