"""GoDMC methylation QTL ingestion into qtl.meqtls.

Reads GoDMC association and SNP files, filters for significant cis-meQTLs,
deduplicates to lead SNP per CpG, liftOvers hg19→hg38, and bulk-loads.

Source: GoDMC (Min et al. 2021 Nat Genet 53:1311)
Data: http://fileserve.mrcieu.ac.uk/mqtl/

Usage::

    uv run python -m polymer_genomics.ingest.meqtls
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import gzip
import os
import subprocess
import tempfile
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

BATCH_SIZE = 10_000
P_THRESHOLD = 1e-8

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "snp_rsid", "cpg_probe_id", "beta", "se",
    "p_value", "allele_freq", "cis_trans", "distance",
]


def _parse_snp_positions(snp_file: str | Path) -> dict[str, tuple[str, int]]:
    """Parse GoDMC SNP file into {snp_name: (chr, pos)} dict."""
    positions: dict[str, tuple[str, int]] = {}
    opener = gzip.open if str(snp_file).endswith(".gz") else open

    with opener(snp_file, "rt") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("name", "")
            chrom = row.get("chr", "")
            pos_str = row.get("pos", "")
            if not chrom or not pos_str:
                continue
            try:
                pos = int(pos_str)
            except ValueError:
                continue
            rsid = row.get("rsid", name)
            positions[name] = (f"chr{chrom}" if not chrom.startswith("chr") else chrom, pos)
    return positions


def _liftover_positions(records: list[dict], chain_path: str) -> list[dict]:
    """LiftOver SNP positions from hg19 to hg38."""
    with tempfile.TemporaryDirectory() as tmpdir:
        input_bed = os.path.join(tmpdir, "input.bed")
        output_bed = os.path.join(tmpdir, "output.bed")
        unmapped = os.path.join(tmpdir, "unmapped.bed")

        with open(input_bed, "w") as f:
            for i, rec in enumerate(records):
                f.write(f"{rec['chrom']}\t{rec['pos']-1}\t{rec['pos']}\t{i}\n")

        subprocess.run(
            ["/tmp/liftOver", input_bed, chain_path, output_bed, unmapped],
            capture_output=True, text=True,
        )

        lifted: dict[int, tuple[str, int]] = {}
        with open(output_bed) as f:
            for line in f:
                fields = line.rstrip("\n").split("\t")
                if len(fields) >= 4:
                    idx = int(fields[3])
                    lifted[idx] = (fields[0], int(fields[1]))  # 0-based start

        result: list[dict] = []
        for i, rec in enumerate(records):
            if i in lifted:
                chrom_hg38, start_hg38 = lifted[i]
                chr_id = CHR_NAME_TO_ID.get(chrom_hg38)
                if chr_id is not None:
                    rec_copy = rec.copy()
                    rec_copy["chr_id"] = chr_id
                    rec_copy["start_pos"] = start_hg38
                    rec_copy["end_pos"] = start_hg38 + 1
                    result.append(rec_copy)
        return result


def read_meqtls(assoc_file: str | Path, snp_file: str | Path, chain_path: str) -> list[dict]:
    """Parse GoDMC associations, filter cis + significant, deduplicate, liftOver."""
    print("  Loading SNP positions...", flush=True)
    snp_pos = _parse_snp_positions(snp_file)
    print(f"  {len(snp_pos):,} SNP positions loaded", flush=True)

    print("  Parsing associations...", flush=True)
    # Group by CpG, keep lead (min pval)
    lead_per_cpg: dict[str, dict] = {}
    skipped_cis = 0
    skipped_pval = 0
    skipped_pos = 0

    opener = gzip.open if str(assoc_file).endswith(".gz") else open
    with opener(assoc_file, "rt") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Filter cis only
            if row.get("cistrans", "").upper() != "TRUE":
                skipped_cis += 1
                continue

            # Filter significance
            try:
                pval = float(row["pval"])
            except (ValueError, KeyError):
                continue
            if pval >= P_THRESHOLD:
                skipped_pval += 1
                continue

            snp_name = row.get("snp", "")
            cpg = row.get("cpg", "")
            if not snp_name or not cpg:
                continue

            # Get position
            if snp_name not in snp_pos:
                skipped_pos += 1
                continue
            chrom, pos = snp_pos[snp_name]

            try:
                beta = float(row.get("beta_a1", row.get("beta", "0")))
                se = float(row.get("se", "0"))
                freq = float(row.get("freq_a1", "0")) if row.get("freq_a1") else None
            except ValueError:
                beta, se, freq = 0.0, 0.0, None

            # Keep lead per CpG (min pval)
            if cpg not in lead_per_cpg or pval < lead_per_cpg[cpg]["pval"]:
                lead_per_cpg[cpg] = {
                    "chrom": chrom,
                    "pos": pos,
                    "snp_rsid": snp_name,
                    "cpg_probe_id": cpg,
                    "beta": beta,
                    "se": se,
                    "p_value": pval,
                    "allele_freq": freq,
                    "cis_trans": "cis",
                    "distance": None,  # compute after liftOver if needed
                    "pval": pval,
                }

    records = list(lead_per_cpg.values())
    print(f"  {len(records):,} lead cis-meQTLs (p < {P_THRESHOLD})", flush=True)
    print(f"  Skipped: {skipped_cis:,} trans, {skipped_pval:,} non-significant, {skipped_pos:,} no position", flush=True)

    # LiftOver
    print("  LiftOver hg19→hg38...", flush=True)
    lifted = _liftover_positions(records, chain_path)
    print(f"  {len(lifted):,} after liftOver", flush=True)
    return lifted


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "godmc_meqtl_v1"
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
           VALUES ($1, $2, $3, 'meqtl', $4,
                   'GoDMC (Min et al. 2021 Nat Genet 53:1311)', 'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"GoDMC cis-meQTLs ({build})", build,
    )
    print(f"  Registered: {layer_key} -> {layer_id}")
    return layer_id


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["snp_rsid"], rec["cpg_probe_id"], rec["beta"], rec["se"],
        rec["p_value"], rec["allele_freq"], rec["cis_trans"], rec["distance"],
    )


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    dl = Path("/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads")
    assoc_file = os.environ.get("GODMC_ASSOC_FILE", str(dl / "godmc_assoc_meta_all.csv.gz"))
    snp_file = os.environ.get("GODMC_SNP_FILE", str(dl / "godmc_snps.csv.gz"))
    chain_path = os.environ.get("LIFTOVER_CHAIN", str(dl / "hg19ToHg38.over.chain.gz"))

    for p, label in [(assoc_file, "associations"), (snp_file, "SNPs"), (chain_path, "chain")]:
        if not Path(p).is_file():
            print(f"ERROR: {label} not found at {p}")
            return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting GoDMC cis-meQTLs - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM qtl.meqtls WHERE layer_id = $1", layer_id,
            )
            if existing > 0:
                print(f"  Already loaded: {existing:,}. Skipping.")
                continue

            records = read_meqtls(assoc_file, snp_file, chain_path)
            if not records:
                print("  ERROR: No records")
                continue

            total = 0
            batch: list[tuple] = []
            async with ingest_transaction(conn):
                for rec in records:
                    batch.append(_build_row(layer_id, build, rec))
                    if len(batch) >= BATCH_SIZE:
                        await conn.copy_records_to_table(
                            "meqtls", records=batch,
                            columns=COLUMNS, schema_name="qtl",
                        )
                        total += len(batch)
                        batch = []
                if batch:
                    await conn.copy_records_to_table(
                        "meqtls", records=batch,
                        columns=COLUMNS, schema_name="qtl",
                    )
                    total += len(batch)

            print(f"  Loaded {total:,} meQTLs")
        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest GoDMC meQTLs")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
