"""gnomAD v4.1 structural variant ingestion into variation.structural_variants.

Parses the gnomAD SV VCF (GRCh38), extracting allele frequency, SV type,
and VEP consequence annotations, then bulk-loads via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.gnomad_sv --build hg38
    GNOMAD_SV_FILE=/path/to/gnomad.v4.1.sv.sites.vcf.gz uv run python -m polymer_genomics.ingest.gnomad_sv
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
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
    "sv_id", "sv_type", "sv_length",
    "allele_count", "allele_number", "allele_freq",
    "homozygote_count", "popmax_af", "popmax_pop",
    "filter_status", "consequence", "gene_symbol",
]

DEFAULT_VCF_PATH = "data/downloads/gnomad.v4.1.sv.sites.vcf.gz"

# Map VCF CHROM to chr_id — handles both "chr1" and "1" prefixed formats
_VCF_CHR_MAP: dict[str, int] = {}
for _i in range(1, 23):
    _VCF_CHR_MAP[str(_i)] = CHR_NAME_TO_ID[f"chr{_i}"]
    _VCF_CHR_MAP[f"chr{_i}"] = CHR_NAME_TO_ID[f"chr{_i}"]
_VCF_CHR_MAP["X"] = CHR_NAME_TO_ID["chrX"]
_VCF_CHR_MAP["chrX"] = CHR_NAME_TO_ID["chrX"]
_VCF_CHR_MAP["Y"] = CHR_NAME_TO_ID["chrY"]
_VCF_CHR_MAP["chrY"] = CHR_NAME_TO_ID["chrY"]
_VCF_CHR_MAP["MT"] = CHR_NAME_TO_ID["chrM"]
_VCF_CHR_MAP["chrM"] = CHR_NAME_TO_ID["chrM"]


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


def _safe_int(val: str | None) -> int | None:
    """Convert to int, returning None on failure."""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _safe_float(val: str | None) -> float | None:
    """Convert to float, returning None on failure."""
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _extract_vep_gene(csq: str | None) -> tuple[str | None, str | None]:
    """Extract most severe VEP consequence and gene from CSQ INFO field.

    CSQ format: Allele|Consequence|IMPACT|SYMBOL|Gene|...
    Returns (consequence, gene_symbol).
    """
    if not csq:
        return None, None

    # CSQ may contain multiple annotations separated by commas;
    # take the first (most severe by VEP convention).
    first = csq.split(",")[0]
    parts = first.split("|")
    consequence = parts[1] if len(parts) > 1 and parts[1] else None
    gene_symbol = parts[3] if len(parts) > 3 and parts[3] else None
    return consequence, gene_symbol


# ── VCF reader ───────────────────────────────────────────────────────────────


def read_gnomad_sv_vcf(vcf_path: str | Path) -> list[dict]:
    """Parse gnomAD SV VCF, extracting all structural variants."""
    rows: list[dict] = []
    skipped_chr = 0

    opener = gzip.open if str(vcf_path).endswith(".gz") else open

    with opener(vcf_path, "rt") as f:
        for line in f:
            if line.startswith("#"):
                continue

            fields = line.rstrip("\n").split("\t")
            if len(fields) < 8:
                continue

            chrom, pos_str, sv_id, _ref, _alt, _qual, filt, info_str = fields[:8]

            # Chromosome
            chr_id = _VCF_CHR_MAP.get(chrom)
            if chr_id is None:
                skipped_chr += 1
                continue

            # Parse INFO
            info = _parse_info(info_str)

            sv_type = info.get("SVTYPE", "")
            if not sv_type:
                continue

            # Coordinates: VCF POS is 1-based → convert to 0-based half-open
            try:
                pos = int(pos_str)
            except ValueError:
                continue
            start_pos = pos - 1

            # END from INFO field; fallback to POS + abs(SVLEN); fallback to POS+1 for BND
            end_str = info.get("END")
            svlen_str = info.get("SVLEN")

            if end_str:
                end_pos = _safe_int(end_str)
                if end_pos is None:
                    end_pos = start_pos + 1
            elif svlen_str:
                svlen = _safe_int(svlen_str)
                if svlen is not None:
                    end_pos = start_pos + abs(svlen)
                else:
                    end_pos = start_pos + 1
            else:
                # BND or unknown — point event
                end_pos = start_pos + 1

            sv_length = _safe_int(svlen_str)
            if sv_length is not None:
                sv_length = abs(sv_length)

            # Allele frequency fields (handle both cased and lowercase keys)
            ac = _safe_int(info.get("AC") or info.get("ac"))
            an = _safe_int(info.get("AN") or info.get("an"))
            af = _safe_float(info.get("AF") or info.get("af"))
            n_homalt = _safe_int(
                info.get("N_HOMALT") or info.get("nhomalt") or info.get("N_homalt")
            )
            popmax_af = _safe_float(
                info.get("POPMAX_AF") or info.get("popmax_AF") or info.get("popmax_af")
            )
            popmax_pop = info.get("POPMAX") or info.get("popmax") or None

            # VEP consequence
            csq_str = info.get("CSQ") or info.get("vep") or None
            consequence, gene_symbol = _extract_vep_gene(csq_str)

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "sv_id": sv_id if sv_id != "." else None,
                "sv_type": sv_type,
                "sv_length": sv_length,
                "allele_count": ac,
                "allele_number": an,
                "allele_freq": af,
                "homozygote_count": n_homalt,
                "popmax_af": popmax_af,
                "popmax_pop": popmax_pop,
                "filter_status": filt if filt != "." else None,
                "consequence": consequence,
                "gene_symbol": gene_symbol,
            })

    print(f"  Parsed {len(rows):,} structural variants")
    print(f"  Skipped: {skipped_chr:,} (unrecognised chromosome)")
    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "gnomad_sv_v4"
    version = f"4.1.{build}"

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
           VALUES ($1, $2, $3, 'structural_variant', $4,
                   'gnomAD v4.1 Structural Variants (Collins et al. 2020 Nature 581:444)',
                   'odc_odbl_1_0', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"gnomAD v4.1 Structural Variants ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["sv_id"], rec["sv_type"], rec["sv_length"],
        rec["allele_count"], rec["allele_number"], rec["allele_freq"],
        rec["homozygote_count"], rec["popmax_af"], rec["popmax_pop"],
        rec["filter_status"], rec["consequence"], rec["gene_symbol"],
    )


async def ingest_build(
    conn: asyncpg.Connection, build: str, layer_id: str, vcf_path: str | Path,
) -> int:
    print(f"\n  Reading gnomAD SV VCF: {vcf_path}")
    records = read_gnomad_sv_vcf(vcf_path)
    if not records:
        print("  ERROR: No records parsed")
        return 0

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        batch.append(_build_row(layer_id, build, rec))
        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "structural_variants", records=batch,
                columns=COLUMNS, schema_name="variation",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "structural_variants", records=batch,
            columns=COLUMNS, schema_name="variation",
        )
        total_loaded += len(batch)

    print(f"  Loaded {total_loaded:,} structural variants")
    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    vcf_path = os.environ.get("GNOMAD_SV_FILE")
    if not vcf_path:
        vcf_path = str(
            Path(__file__).resolve().parents[3] / DEFAULT_VCF_PATH
        )

    if not Path(vcf_path).is_file():
        print(f"ERROR: gnomAD SV VCF not found at {vcf_path}")
        print("Download from https://gnomad.broadinstitute.org/downloads#v4-structural-variants")
        print("Or set GNOMAD_SV_FILE=/path/to/gnomad.v4.1.sv.sites.vcf.gz")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting gnomAD v4.1 Structural Variants - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM variation.structural_variants WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  WARNING: {existing:,} rows already exist. Skipping.")
                continue

            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, vcf_path)
            print(f"\n  Total structural variants loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(description="Ingest gnomAD v4.1 structural variants")
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
