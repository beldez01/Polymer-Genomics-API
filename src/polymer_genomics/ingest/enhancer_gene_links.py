"""ABC model enhancer-gene link ingestion into regulatory.enhancer_gene_links.

Reads the Nasser et al. 2021 ABC predictions, liftOvers from hg19 to hg38,
and bulk-loads via COPY protocol.

Source: https://mitra.stanford.edu/engreitz/oak/public/Nasser2021/
Format: TSV.gz with columns including chr, start, end, TargetGene, ABC.Score, CellType
~6M predictions across 131 cell types. We filter for ABC.Score >= 0.015.

Usage::

    uv run python -m polymer_genomics.ingest.enhancer_gene_links
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
import subprocess
import tempfile
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 50_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "target_gene", "target_gene_tss", "cell_type",
    "abc_score", "distance", "class",
]


def _liftover_regions(records: list[dict], chain_path: str) -> list[dict]:
    """LiftOver a list of records from hg19 to hg38 using /tmp/liftOver."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_bed = os.path.join(tmpdir, "input.bed")
        output_bed = os.path.join(tmpdir, "output.bed")
        unmapped = os.path.join(tmpdir, "unmapped.bed")

        # Write BED with index as name for re-matching
        with open(input_bed, "w") as f:
            for i, rec in enumerate(records):
                f.write(f"chr{rec['chr_raw']}\t{rec['start_pos']}\t{rec['end_pos']}\t{i}\n")

        subprocess.run(
            ["/tmp/liftOver", input_bed, chain_path, output_bed, unmapped],
            capture_output=True, text=True,
        )

        # Parse lifted coordinates and match back to records
        lifted: dict[int, tuple[str, int, int]] = {}
        with open(output_bed) as f:
            for line in f:
                fields = line.rstrip("\n").split("\t")
                if len(fields) >= 4:
                    idx = int(fields[3])
                    lifted[idx] = (fields[0], int(fields[1]), int(fields[2]))

        result: list[dict] = []
        for i, rec in enumerate(records):
            if i in lifted:
                chrom, start, end = lifted[i]
                chr_id = CHR_NAME_TO_ID.get(chrom)
                if chr_id is not None:
                    rec_copy = rec.copy()
                    rec_copy["chr_id"] = chr_id
                    rec_copy["start_pos"] = start
                    rec_copy["end_pos"] = end
                    result.append(rec_copy)

        return result


def read_abc_predictions(gz_path: str | Path, chain_path: str) -> list[dict]:
    """Parse ABC predictions TSV and liftOver to hg38."""
    print(f"  Parsing ABC predictions...", flush=True)
    records: list[dict] = []

    with gzip.open(gz_path, "rt") as f:
        header = f.readline().rstrip("\n").split("\t")
        col = {h: i for i, h in enumerate(header)}

        for line in f:
            fields = line.rstrip("\n").split("\t")
            chrom_raw = fields[col["chr"]].replace("chr", "")
            try:
                start = int(fields[col["start"]])
                end = int(fields[col["end"]])
                abc_score = float(fields[col["ABC.Score"]])
            except (ValueError, KeyError):
                continue

            # Keep all (already filtered at ABC >= 0.015 in source)
            target_gene = fields[col.get("TargetGene", col.get("name", 0))]
            tss = None
            if "TargetGeneTSS" in col:
                try:
                    tss = int(fields[col["TargetGeneTSS"]])
                except ValueError:
                    pass

            distance = None
            if "distance" in col:
                try:
                    distance = int(fields[col["distance"]])
                except ValueError:
                    pass

            element_class = fields[col.get("class", 0)] if "class" in col else None
            cell_type = fields[col.get("CellType", 0)] if "CellType" in col else None

            records.append({
                "chr_raw": chrom_raw,
                "start_pos": start,
                "end_pos": end,
                "target_gene": target_gene,
                "target_gene_tss": tss,
                "cell_type": cell_type,
                "abc_score": abc_score,
                "distance": distance,
                "class": element_class,
            })

    print(f"  Parsed {len(records):,} predictions (hg19)")

    # LiftOver in chunks (liftOver can handle large files)
    CHUNK = 500_000
    lifted_all: list[dict] = []
    for i in range(0, len(records), CHUNK):
        chunk = records[i:i + CHUNK]
        lifted = _liftover_regions(chunk, chain_path)
        lifted_all.extend(lifted)
        print(f"    LiftOver chunk {i//CHUNK + 1}: {len(chunk):,} -> {len(lifted):,}", flush=True)

    print(f"  Total after liftOver: {len(lifted_all):,}")
    return lifted_all


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "abc_enhancer_gene_v1"
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
           VALUES ($1, $2, $3, 'enhancer_gene', $4,
                   'ABC Model (Nasser et al. 2021 Nature 593:238)', 'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"ABC Enhancer-Gene Predictions ({build})", build,
    )
    print(f"  Registered layer: {layer_key} -> {layer_id}")
    return layer_id


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["target_gene"], rec["target_gene_tss"], rec["cell_type"],
        rec["abc_score"], rec["distance"], rec["class"],
    )


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    gz_path = os.environ.get(
        "ABC_FILE",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/abc_predictions.txt.gz",
    )
    chain_path = os.environ.get(
        "LIFTOVER_CHAIN",
        "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/hg19ToHg38.over.chain.gz",
    )

    if not Path(gz_path).is_file():
        print(f"ERROR: ABC predictions not found at {gz_path}")
        return
    if not Path(chain_path).is_file():
        print(f"ERROR: liftOver chain not found at {chain_path}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting ABC Enhancer-Gene Predictions - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM regulatory.enhancer_gene_links WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,} rows. Skipping.")
                continue

            records = read_abc_predictions(gz_path, chain_path)
            if not records:
                print("  ERROR: No records after parsing + liftOver")
                continue

            total = 0
            batch: list[tuple] = []
            async with ingest_transaction(conn):
                for rec in records:
                    batch.append(_build_row(layer_id, build, rec))
                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "enhancer_gene_links", records=batch,
                            columns=COLUMNS, schema_name="regulatory",
                        )
                        total += len(batch)
                        if total % 500_000 == 0:
                            print(f"    Loaded {total:,}...", flush=True)
                        batch = []
                if batch:
                    await conn.copy_records_to_table(
                        "enhancer_gene_links", records=batch,
                        columns=COLUMNS, schema_name="regulatory",
                    )
                    total += len(batch)

            print(f"  Loaded {total:,} enhancer-gene links")
        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest ABC enhancer-gene predictions")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
