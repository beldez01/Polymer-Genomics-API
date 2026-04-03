"""ClinVar pathogenic variant ingestion into variation.clinvar_variants.

Downloads and parses the ClinVar VCF (GRCh38), filtering for Pathogenic
and Likely_pathogenic variants, then bulk-loads via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.clinvar
    CLINVAR_FILE=/path/to/clinvar.vcf.gz uv run python -m polymer_genomics.ingest.clinvar
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
import urllib.request
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "variation_id", "rsid", "ref_allele", "alt_allele",
    "clinical_significance", "review_status", "disease",
    "gene_symbol", "molecular_consequence", "origin",
]

CLINVAR_URL = "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz"

# Map VCF CHROM to chr_id
_VCF_CHR_MAP: dict[str, int] = {}
for _i in range(1, 23):
    _VCF_CHR_MAP[str(_i)] = CHR_NAME_TO_ID[f"chr{_i}"]
_VCF_CHR_MAP["X"] = CHR_NAME_TO_ID["chrX"]
_VCF_CHR_MAP["Y"] = CHR_NAME_TO_ID["chrY"]
_VCF_CHR_MAP["MT"] = CHR_NAME_TO_ID["chrM"]


# ── INFO field parsing ───────────────────────────────────────────────────────


def _parse_info(info_str: str) -> dict[str, str]:
    """Parse VCF INFO field into a dict."""
    result: dict[str, str] = {}
    for item in info_str.split(";"):
        if "=" in item:
            k, v = item.split("=", 1)
            result[k] = v
        else:
            result[item] = ""
    return result


def _extract_gene(geneinfo: str | None) -> str | None:
    """Extract first gene symbol from GENEINFO field (GENE:ID|GENE2:ID2)."""
    if not geneinfo:
        return None
    first = geneinfo.split("|")[0]
    if ":" in first:
        return first.split(":")[0]
    return first or None


def _extract_consequence(mc: str | None) -> str | None:
    """Extract molecular consequence from MC field (SO:id|name,...)."""
    if not mc:
        return None
    first = mc.split(",")[0]
    if "|" in first:
        return first.split("|")[1]
    return first or None


# ── VCF reader ───────────────────────────────────────────────────────────────


def read_clinvar_vcf(vcf_path: str | Path) -> list[dict]:
    """Parse ClinVar VCF, keeping only Pathogenic/Likely_pathogenic variants."""
    rows: list[dict] = []
    skipped_chr = 0
    skipped_sig = 0

    opener = gzip.open if str(vcf_path).endswith(".gz") else open

    with opener(vcf_path, "rt") as f:
        for line in f:
            if line.startswith("#"):
                continue

            fields = line.rstrip("\n").split("\t")
            if len(fields) < 8:
                continue

            chrom, pos_str, vid, ref, alt, _qual, _filt, info_str = fields[:8]

            # Chromosome
            chr_id = _VCF_CHR_MAP.get(chrom)
            if chr_id is None:
                skipped_chr += 1
                continue

            # Parse INFO
            info = _parse_info(info_str)

            # Filter for pathogenic
            clnsig = info.get("CLNSIG", "")
            # Must start with Pathogenic or Likely_pathogenic (not Conflicting_classifications_of_pathogenicity)
            if not (clnsig.startswith("Pathogenic") or clnsig.startswith("Likely_pathogenic")):
                skipped_sig += 1
                continue

            # Coordinates: VCF is 1-based → 0-based half-open
            try:
                pos = int(pos_str)
            except ValueError:
                continue
            start_pos = pos - 1
            end_pos = pos - 1 + len(ref)

            # Extract fields
            variation_id = None
            clnvcid = info.get("CLNVCID") or info.get("ALLELEID")
            if clnvcid:
                try:
                    variation_id = int(clnvcid)
                except ValueError:
                    pass

            rsid_val = vid if vid.startswith("rs") else None

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "variation_id": variation_id,
                "rsid": rsid_val,
                "ref_allele": ref,
                "alt_allele": alt,
                "clinical_significance": clnsig,
                "review_status": info.get("CLNREVSTAT"),
                "disease": info.get("CLNDN", "").replace("_", " ") or None,
                "gene_symbol": _extract_gene(info.get("GENEINFO")),
                "molecular_consequence": _extract_consequence(info.get("MC")),
                "origin": info.get("ORIGIN"),
            })

    print(f"  Parsed {len(rows):,} pathogenic/likely pathogenic variants")
    print(f"  Skipped: {skipped_chr:,} (bad chr), {skipped_sig:,} (not pathogenic)")
    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "clinvar_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key, version,
    )
    if existing is not None:
        print(f"  Layer already registered: {layer_key} v{version} -> {existing}")
        return existing

    layer_id = await conn.fetchval(
        """INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, is_active, is_default)
           VALUES ($1, $2, $3, 'clinvar', $4,
                   'NCBI ClinVar GRCh38 (Landrum et al. 2018 NAR)',
                   'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"ClinVar Pathogenic Variants ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["variation_id"], rec["rsid"], rec["ref_allele"], rec["alt_allele"],
        rec["clinical_significance"], rec["review_status"], rec["disease"],
        rec["gene_symbol"], rec["molecular_consequence"], rec["origin"],
    )


async def ingest_build(
    conn: asyncpg.Connection, build: str, layer_id: str, vcf_path: str | Path,
) -> int:
    print(f"\n  Reading ClinVar VCF: {vcf_path}")
    records = read_clinvar_vcf(vcf_path)
    if not records:
        print("  ERROR: No records parsed")
        return 0

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        batch.append(_build_row(layer_id, build, rec))
        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "clinvar_variants", records=batch,
                columns=COLUMNS, schema_name="variation",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "clinvar_variants", records=batch,
            columns=COLUMNS, schema_name="variation",
        )
        total_loaded += len(batch)

    print(f"  Loaded {total_loaded:,} ClinVar variants")
    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    vcf_path = os.environ.get("CLINVAR_FILE")
    if not vcf_path:
        vcf_path = "/Users/zbb2/Desktop/PolymerGenomicsAPI/data/downloads/clinvar.vcf.gz"
        if not Path(vcf_path).is_file():
            print(f"Downloading ClinVar VCF to {vcf_path}...")
            Path(vcf_path).parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(CLINVAR_URL, vcf_path)
            print("Download complete.")

    if not Path(vcf_path).is_file():
        print(f"ERROR: ClinVar VCF not found at {vcf_path}")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting ClinVar - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM variation.clinvar_variants WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  WARNING: {existing:,} rows already exist. Skipping.")
                continue

            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, vcf_path)
            print(f"\n  Total ClinVar variants loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest ClinVar pathogenic variants")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
