"""Super-enhancer ingestion from dbSUPER into nuclear.super_enhancers.

Reads per-cell-type BED files from dbSUPER (hg19), liftOvers to hg38,
and bulk-loads via COPY protocol.

Source: dbSUPER (Khan & Zhang 2016 NAR)
Format: BED (chr, start, end, SE_id, rank) per cell type
Coordinates: hg19 -> liftOver to hg38

Usage::

    uv run python -m polymer_genomics.ingest.super_enhancers
"""

from __future__ import annotations

import argparse
import asyncio
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 10_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "cell_type", "se_rank",
]


def _liftover_bed(input_bed: str, chain: str, output_bed: str, unmapped: str) -> int:
    """Run liftOver on a BED file. Returns count of mapped regions."""
    result = subprocess.run(
        ["/tmp/liftOver", input_bed, chain, output_bed, unmapped],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"    liftOver warning: {result.stderr[:200]}")
    count = 0
    with open(output_bed) as f:
        for _ in f:
            count += 1
    return count


def read_and_liftover_zip(zip_path: str | Path, chain_path: str) -> list[dict]:
    """Extract BED files from dbSUPER ZIP, liftOver each to hg38."""
    rows: list[dict] = []

    with zipfile.ZipFile(zip_path) as zf:
        bed_files = [n for n in zf.namelist() if n.endswith(".bed")]
        print(f"  Found {len(bed_files)} cell type BED files")

        with tempfile.TemporaryDirectory() as tmpdir:
            for bed_name in bed_files:
                cell_type = Path(bed_name).stem  # filename without .bed

                # Extract BED
                hg19_bed = os.path.join(tmpdir, "input.bed")
                with open(hg19_bed, "w") as out:
                    data = zf.read(bed_name).decode("utf-8")
                    out.write(data)

                # LiftOver
                hg38_bed = os.path.join(tmpdir, "output.bed")
                unmapped = os.path.join(tmpdir, "unmapped.bed")
                n_mapped = _liftover_bed(hg19_bed, chain_path, hg38_bed, unmapped)

                # Parse lifted BED
                with open(hg38_bed) as f:
                    for line in f:
                        fields = line.rstrip("\n").split("\t")
                        if len(fields) < 4:
                            continue
                        chrom = fields[0]
                        chr_id = CHR_NAME_TO_ID.get(chrom)
                        if chr_id is None:
                            continue
                        try:
                            start = int(fields[1])
                            end = int(fields[2])
                        except ValueError:
                            continue

                        se_id = fields[3] if len(fields) > 3 else None
                        rank = None
                        if len(fields) > 4:
                            try:
                                rank = int(fields[4])
                            except ValueError:
                                pass

                        rows.append({
                            "chr_id": chr_id,
                            "start_pos": start,
                            "end_pos": end,
                            "cell_type": cell_type,
                            "se_rank": rank,
                        })

    print(f"  Total super-enhancers after liftOver: {len(rows):,}")
    return rows


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "super_enhancers_dbsuper_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'super_enhancer', $4,
                   'dbSUPER (Khan & Zhang 2016 NAR)', 'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"Super-Enhancers dbSUPER ({build})", build,
    )
    print(f"  Registered layer: {layer_key} -> {layer_id}")
    return layer_id


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["cell_type"], rec["se_rank"],
    )


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    zip_path = os.environ.get(
        "DBSUPER_FILE",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/dbsuper_all_hg19.zip",
    )
    chain_path = os.environ.get(
        "LIFTOVER_CHAIN",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/hg19ToHg38.over.chain.gz",
    )

    if not Path(zip_path).is_file():
        print(f"ERROR: dbSUPER ZIP not found at {zip_path}")
        return
    if not Path(chain_path).is_file():
        print(f"ERROR: liftOver chain not found at {chain_path}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Super-Enhancers (dbSUPER) - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM nuclear.super_enhancers WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,} rows. Skipping.")
                continue

            records = read_and_liftover_zip(zip_path, chain_path)
            if not records:
                print("  ERROR: No records after liftOver")
                continue

            total = 0
            batch: list[tuple] = []
            async with ingest_transaction(conn):
                for rec in records:
                    batch.append(_build_row(layer_id, build, rec))
                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "super_enhancers", records=batch,
                            columns=COLUMNS, schema_name="nuclear",
                        )
                        total += len(batch)
                        batch = []
                if batch:
                    await conn.copy_records_to_table(
                        "super_enhancers", records=batch,
                        columns=COLUMNS, schema_name="nuclear",
                    )
                    total += len(batch)

            print(f"  Loaded {total:,} super-enhancers")
        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest dbSUPER super-enhancers")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
