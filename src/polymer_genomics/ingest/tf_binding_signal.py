"""TF Binding Signal ingestion from ENCODE ChIP-seq BigWig files.

Downloads fold-change-over-control BigWig files from ENCODE and bins to 1kb
windows for ~15 TF×cell_type columns.

Requires: pyBigWig, requests

Usage::

    uv run python -m polymer_genomics.ingest.tf_binding_signal
    uv run python -m polymer_genomics.ingest.tf_binding_signal --data-dir /path/to/bigwigs
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

BATCH_SIZE = 50_000

# Map: (db_column, display_name) -> ENCODE experiment accession
# These are fold-change-over-control signal BigWigs (hg38)
# Accessions should be confirmed via ENCODE REST API before first run.
TF_EXPERIMENTS: dict[str, dict] = {
    # GM12878
    "ctcf_gm12878":   {"tf": "CTCF",   "cell": "GM12878", "accession": "ENCFF485CGE"},
    "sp1_gm12878":    {"tf": "SP1",    "cell": "GM12878", "accession": "ENCFF952WGS"},
    "yy1_gm12878":    {"tf": "YY1",    "cell": "GM12878", "accession": "ENCFF260SWT"},
    "polr2a_gm12878": {"tf": "POLR2A", "cell": "GM12878", "accession": "ENCFF328MMS"},
    "ezh2_gm12878":   {"tf": "EZH2",   "cell": "GM12878", "accession": "ENCFF256BYP"},
    "suz12_gm12878":  {"tf": "SUZ12",  "cell": "GM12878", "accession": "ENCFF416XSK"},
    "rest_gm12878":   {"tf": "REST",   "cell": "GM12878", "accession": "ENCFF845YET"},
    # K562
    "ctcf_k562":      {"tf": "CTCF",   "cell": "K562",    "accession": "ENCFF534ITO"},
    "spi1_k562":      {"tf": "SPI1",   "cell": "K562",    "accession": "ENCFF216QNX"},
    "gata2_k562":     {"tf": "GATA2",  "cell": "K562",    "accession": "ENCFF371RWI"},
    "runx1_k562":     {"tf": "RUNX1",  "cell": "K562",    "accession": "ENCFF196VHS"},
    "tal1_k562":      {"tf": "TAL1",   "cell": "K562",    "accession": "ENCFF439GTA"},
    "sp1_k562":       {"tf": "SP1",    "cell": "K562",    "accession": "ENCFF524IWI"},
    "polr2a_k562":    {"tf": "POLR2A", "cell": "K562",    "accession": "ENCFF937ZPS"},
    "ezh2_k562":      {"tf": "EZH2",   "cell": "K562",    "accession": "ENCFF587SWK"},
}

COLUMN_ORDER = list(TF_EXPERIMENTS.keys())

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    *COLUMN_ORDER,
]

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/encode/tf_chipseq"
)

WINDOW_SIZE = 1000


def _encode_download_url(accession: str) -> str:
    return f"https://www.encodeproject.org/files/{accession}/@@download/{accession}.bigWig"


async def download_bigwigs(data_dir: str) -> dict[str, str]:
    """Download missing BigWig files from ENCODE. Returns {col_name: filepath}."""
    import requests

    paths: dict[str, str] = {}
    for col_name, info in TF_EXPERIMENTS.items():
        accession = info["accession"]
        filename = f"{col_name}_{accession}.bigWig"
        filepath = os.path.join(data_dir, filename)
        paths[col_name] = filepath

        if Path(filepath).exists():
            print(f"  {col_name}: already downloaded")
            continue

        url = _encode_download_url(accession)
        print(f"  Downloading {col_name} ({info['tf']} in {info['cell']})...")
        print(f"    URL: {url}")

        resp = requests.get(url, stream=True, timeout=120)
        resp.raise_for_status()

        with open(filepath, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        size_mb = Path(filepath).stat().st_size / (1024 * 1024)
        print(f"    Downloaded: {size_mb:.1f} MB")

    return paths


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "tf_binding_signal"
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
            ($1, $2, $3, 'tf_binding', $4,
             'ENCODE Consortium ChIP-seq fold-change-over-control (CC BY 4.0)',
             'cc_by_4_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"TF Binding Signal ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_tf_binding(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    bigwig_paths: dict[str, str],
) -> int:
    """Read BigWig files and bulk-load 1kb-binned TF signal."""
    import pyBigWig

    bw_handles: dict[str, object] = {}
    for col_name, filepath in bigwig_paths.items():
        if filepath is None or not Path(filepath).exists():
            # Try to find by glob pattern
            import glob
            pattern = os.path.join(data_dir, f"{col_name}_*.bigWig")
            matches = glob.glob(pattern)
            if matches:
                filepath = matches[0]
                print(f"  {col_name}: found {Path(filepath).name}")
                bw_handles[col_name] = pyBigWig.open(filepath)
            else:
                print(f"  WARNING: Missing {col_name}, column will be NULL")
                bw_handles[col_name] = None
        else:
            bw_handles[col_name] = pyBigWig.open(filepath)

    try:
        # Use first available BigWig as reference for chromosome grid
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

            # Pre-compute mean signal per 1kb window for each TF
            chr_signals: dict[str, list[float | None]] = {}
            for col_name, bw in bw_handles.items():
                if bw is None or chrom not in bw.chroms():
                    chr_signals[col_name] = [None] * n_windows
                else:
                    try:
                        end_coord = min(n_windows * WINDOW_SIZE, bw.chroms()[chrom])
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
                        "tf_binding_signal",
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
                "tf_binding_signal",
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

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    print(f"\n{'='*60}")
    print(f"TF Binding Signal Ingestion - {build}")
    print(f"{'='*60}")

    print("\nStep 1: Download BigWig files from ENCODE...")
    bigwig_paths = await download_bigwigs(data_dir)

    conn = await asyncpg.connect(
        host=host, port=port, database=database, user=user, password=password,
    )

    try:
        layer_id = await register_layer(conn, build)

        existing_count = await conn.fetchval(
            "SELECT count(*) FROM regulatory.tf_binding_signal WHERE layer_id = $1",
            layer_id,
        )
        if existing_count > 0:
            print(f"  WARNING: {existing_count:,} rows already exist. Skipping.")
            return

        print("\nStep 2: Binning to 1kb and loading...")
        total = await ingest_tf_binding(conn, build, layer_id, bigwig_paths)
        print(f"\n  TF binding rows loaded: {total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest ENCODE TF ChIP-seq fold-change signal (1kb bins)",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
