"""Constitutive Lamina-Associated Domain (cLAD) ingestion into nuclear.lads.

Reads Meuleman et al. (2013) DamID HMM state calls from GSE22428, identifies
constitutive LADs (probes called LAD in all 3 cell type/lamin experiments),
merges adjacent probes into contiguous regions with 50kb gap tolerance,
liftOvers hg18→hg38, and bulk-loads.

Source: Meuleman et al. 2013 Genome Research 23:270-280
Data: GEO GSE22428 — GSE22428_HMM_state_calls_per_probe.txt.gz

Usage::

    uv run python -m polymer_genomics.ingest.lads
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

BATCH_SIZE = 5_000
GAP_TOLERANCE = 50_000  # merge probes within 50kb

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "lad_type", "cell_type", "damid_score",
]


def _merge_regions(probes: list[tuple[str, int, int]], gap: int = GAP_TOLERANCE) -> list[tuple[str, int, int]]:
    """Merge sorted (chr, start, end) probes into contiguous regions."""
    if not probes:
        return []
    merged: list[tuple[str, int, int]] = []
    cur_chr, cur_start, cur_end = probes[0]
    for chrom, start, end in probes[1:]:
        if chrom == cur_chr and start - cur_end <= gap:
            cur_end = max(cur_end, end)
        else:
            merged.append((cur_chr, cur_start, cur_end))
            cur_chr, cur_start, cur_end = chrom, start, end
    merged.append((cur_chr, cur_start, cur_end))
    return merged


def read_clads(hmm_file: str | Path) -> list[tuple[str, int, int]]:
    """Parse HMM state calls and return merged constitutive LAD regions (hg18)."""
    probes: list[tuple[str, int, int]] = []

    opener = gzip.open if str(hmm_file).endswith(".gz") else open
    with opener(hmm_file, "rt") as f:
        # Skip comment lines
        header = None
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#") or not line.strip():
                continue
            if header is None:
                header = line.split("\t")
                continue
            fields = line.split("\t")
            if len(fields) < 7:
                continue
            chrom = fields[0]
            start = int(fields[1])
            end = int(fields[2])
            # Columns 4-6: LaminB1_ESC, LaminB1_HT1080, LaminA_HT1080
            vals = [int(fields[i]) for i in range(4, 7)]
            if all(v == 1 for v in vals):
                probes.append((chrom, start, end))

    # Sort by chromosome then position
    chr_order = {f"chr{i}": i for i in range(1, 23)}
    chr_order["chrX"] = 23
    chr_order["chrY"] = 24
    probes.sort(key=lambda x: (chr_order.get(x[0], 99), x[1]))

    print(f"  {len(probes):,} constitutive LAD probes (all 3 experiments)")
    merged = _merge_regions(probes)
    print(f"  {len(merged):,} merged cLAD regions (gap tolerance {GAP_TOLERANCE // 1000}kb)")
    return merged


def _liftover_regions(regions: list[tuple[str, int, int]], chain_path: str) -> list[tuple[str, int, int]]:
    """LiftOver regions from hg18 to hg38."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_bed = os.path.join(tmpdir, "input.bed")
        output_bed = os.path.join(tmpdir, "output.bed")
        unmapped = os.path.join(tmpdir, "unmapped.bed")

        with open(input_bed, "w") as f:
            for i, (chrom, start, end) in enumerate(regions):
                f.write(f"{chrom}\t{start}\t{end}\t{i}\n")

        result = subprocess.run(
            ["/tmp/liftOver", input_bed, chain_path, output_bed, unmapped],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"  liftOver warning: {result.stderr[:200]}")

        # Count unmapped
        n_unmapped = 0
        with open(unmapped) as f:
            for line in f:
                if not line.startswith("#"):
                    n_unmapped += 1

        lifted: list[tuple[str, int, int]] = []
        with open(output_bed) as f:
            for line in f:
                fields = line.rstrip("\n").split("\t")
                if len(fields) >= 3:
                    lifted.append((fields[0], int(fields[1]), int(fields[2])))

        print(f"  {len(lifted):,} regions after liftOver ({n_unmapped} unmapped)")

        # Re-sort and re-merge (liftOver can fragment or reorder)
        chr_order = {f"chr{i}": i for i in range(1, 23)}
        chr_order["chrX"] = 23
        chr_order["chrY"] = 24
        lifted.sort(key=lambda x: (chr_order.get(x[0], 99), x[1]))
        merged = _merge_regions(lifted, gap=GAP_TOLERANCE)
        print(f"  {len(merged):,} regions after post-liftOver merge")
        return merged


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "lads_meuleman_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer: {layer_key} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'lad', $4,
                   'Meuleman et al. 2013 Genome Res 23:270 (GSE22428)', 'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"Constitutive LADs ({build})", build,
    )
    print(f"  Registered: {layer_key} -> {layer_id}")
    return layer_id


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    dl = Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads")
    hmm_file = os.environ.get("LAD_HMM_FILE", str(dl / "GSE22428_HMM_state_calls.txt.gz"))
    chain_path = os.environ.get("LIFTOVER_CHAIN_HG18", str(dl / "hg18ToHg38.over.chain.gz"))

    for p, label in [(hmm_file, "HMM state calls"), (chain_path, "hg18→hg38 chain")]:
        if not Path(p).is_file():
            print(f"ERROR: {label} not found at {p}")
            return

    # Parse and merge constitutive LADs (hg18)
    print("Parsing HMM state calls...")
    clad_regions_hg18 = read_clads(hmm_file)

    # LiftOver hg18→hg38
    print("LiftOver hg18→hg38...")
    clad_regions_hg38 = _liftover_regions(clad_regions_hg18, chain_path)

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting constitutive LADs - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM nuclear.lads WHERE layer_id = $1", layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,}. Skipping.")
                continue

            total = 0
            batch: list[tuple] = []
            async with ingest_transaction(conn):
                for chrom, start, end in clad_regions_hg38:
                    chr_id = CHR_NAME_TO_ID.get(chrom)
                    if chr_id is None:
                        continue
                    row = (
                        layer_id, build,
                        chr_id, start, end,
                        "constitutive", "consensus", None,
                    )
                    batch.append(row)
                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "lads", records=batch,
                            columns=COLUMNS, schema_name="nuclear",
                        )
                        total += len(batch)
                        batch = []
                if batch:
                    await conn.copy_records_to_table(
                        "lads", records=batch,
                        columns=COLUMNS, schema_name="nuclear",
                    )
                    total += len(batch)

            # Update registry
            await conn.execute(
                "UPDATE registry.layers SET row_count = $1 WHERE id = $2",
                total, layer_id,
            )
            print(f"  Loaded {total:,} constitutive LADs")

            # Summary stats
            total_bp = sum(end - start for chrom, start, end in clad_regions_hg38 if CHR_NAME_TO_ID.get(chrom))
            print(f"  Total coverage: {total_bp / 1e9:.2f} Gb ({total_bp / 3.1e9 * 100:.1f}% of genome)")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest constitutive LADs")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
