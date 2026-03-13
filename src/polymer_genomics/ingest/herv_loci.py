"""Telescope HERV proviral loci ingestion into annotation.herv_loci.

Parses the Telescope HERV annotation v2 GTF file (MIT-licensed), groups
exon features by gene_id to reconstruct proviral loci, and bulk-loads
via the COPY protocol.

Data source: https://github.com/mlbendall/telescope_annotation_db
             builds/HERV_rmsk.hg38.v2/transcripts.gtf

Usage::

    uv run python -m polymer_genomics.ingest.herv_loci
    uv run python -m polymer_genomics.ingest.herv_loci --gtf data/herv/telescope_herv_hg38_v2.gtf
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
from collections import defaultdict
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "strand",
    "locus_id", "subfamily", "n_fragments", "locus_length",
]


# ── GTF parser ───────────────────────────────────────────────────────────────

def _parse_gtf_attributes(attr_string: str) -> dict[str, str]:
    """Parse GTF attribute string into a dict."""
    attrs: dict[str, str] = {}
    for match in re.finditer(r'(\w+)\s+"([^"]*)"', attr_string):
        attrs[match.group(1)] = match.group(2)
    return attrs


def _extract_subfamily(locus_id: str, attrs: dict[str, str]) -> str:
    """Extract ERV subfamily from locus_id or attributes.

    Telescope locus IDs follow pattern: SUBFAMILY_location
    e.g. 'HERVK_1q22', 'HERV9_12q24.31', 'THE1_Xp11.4'
    """
    # Try family_id attribute first
    if "family_id" in attrs:
        return attrs["family_id"]

    # Parse from locus_id prefix (everything before the first underscore+location)
    # Pattern: SUBFAMILY_chrband or SUBFAMILY_dup_N
    parts = locus_id.split("_")
    if parts:
        # Subfamily is typically the first part, sometimes first two
        # e.g. HERVK, HERV9, THE1, MER4, PRIMA4
        return parts[0]

    return "unknown"


def read_telescope_gtf(gtf_path: str | Path) -> list[dict]:
    """Parse Telescope HERV GTF, grouping exon features by gene_id.

    Each gene_id represents one proviral locus. Exon features are the
    individual LTR/internal fragments that compose the locus.

    Returns one dict per proviral locus with aggregated coordinates.
    """
    # Group exons by gene_id
    loci: dict[str, dict] = defaultdict(lambda: {
        "chr": None,
        "strand": None,
        "starts": [],
        "ends": [],
        "attrs": {},
    })

    with open(gtf_path) as f:
        for line in f:
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 9:
                continue

            feature_type = fields[2]
            if feature_type != "exon":
                continue

            chrom = fields[0]
            start = int(fields[3]) - 1  # GTF is 1-based → 0-based
            end = int(fields[4])        # GTF end is inclusive → half-open
            strand = fields[6]
            attrs = _parse_gtf_attributes(fields[8])
            gene_id = attrs.get("gene_id", "")

            if not gene_id:
                continue

            locus = loci[gene_id]
            locus["chr"] = chrom
            locus["strand"] = strand if strand in ("+", "-") else None
            locus["starts"].append(start)
            locus["ends"].append(end)
            if not locus["attrs"]:
                locus["attrs"] = attrs

    # Convert to flat records
    records: list[dict] = []
    for gene_id, locus in loci.items():
        chrom = locus["chr"]
        chr_id = CHR_NAME_TO_ID.get(chrom)
        if chr_id is None:
            continue

        start_pos = min(locus["starts"])
        end_pos = max(locus["ends"])
        subfamily = _extract_subfamily(gene_id, locus["attrs"])

        records.append({
            "chr_id": chr_id,
            "start_pos": start_pos,
            "end_pos": end_pos,
            "strand": locus["strand"],
            "locus_id": gene_id,
            "subfamily": subfamily,
            "n_fragments": len(locus["starts"]),
            "locus_length": end_pos - start_pos,
        })

    print(f"  Parsed {len(records):,} HERV proviral loci from {len(loci):,} gene_ids")
    return records


# ── Layer registration ──────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the HERV loci layer."""
    layer_key = "herv_loci_v1"
    version = f"1.0.{build}"

    existing = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = $1 AND version = $2",
        layer_key,
        version,
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
            ($1, $2, $3, 'herv', $4,
             'Telescope_HERV_v2', 'open_access', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Telescope HERV Proviral Loci ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ───────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    """Build a tuple matching COLUMNS order for COPY."""
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["strand"],
        rec["locus_id"], rec["subfamily"], rec["n_fragments"], rec["locus_length"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    gtf_path: str | Path,
) -> int:
    """Read Telescope GTF, bulk-load into annotation.herv_loci."""
    print(f"  Reading Telescope HERV GTF: {gtf_path}")
    records = read_telescope_gtf(gtf_path)

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        row = _build_row(layer_id, build, rec)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "herv_loci",
                records=batch,
                columns=COLUMNS,
                schema_name="annotation",
            )
            total_loaded += len(batch)
            print(f"    Loaded {total_loaded:,} rows...")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "herv_loci",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None, gtf_path: str | None = None) -> None:
    """Connect and ingest Telescope HERV loci."""
    if builds is None:
        builds = ["hg38"]

    if gtf_path is None:
        gtf_path = os.environ.get(
            "HERV_GTF",
            "data/herv/telescope_herv_hg38_v2.gtf",
        )

    if not Path(gtf_path).exists():
        print(f"ERROR: Telescope HERV GTF not found at {gtf_path}")
        print("Download from: https://github.com/mlbendall/telescope_annotation_db")
        print("  curl -L -o data/herv/telescope_herv_hg38_v2.gtf \\")
        print('    "https://media.githubusercontent.com/media/mlbendall/telescope_annotation_db/master/builds/HERV_rmsk.hg38.v2/transcripts.gtf"')
        print("Or set HERV_GTF environment variable.")
        return

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    conn = await asyncpg.connect(
        host=host, port=port, database=database, user=user, password=password,
    )

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting Telescope HERV proviral loci - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM annotation.herv_loci WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, gtf_path)
            print(f"\n  Total HERV loci loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Telescope HERV proviral loci into annotation.herv_loci",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build (default: hg38 only)",
    )
    parser.add_argument(
        "--gtf",
        default=None,
        help="Path to Telescope HERV GTF file",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds, gtf_path=args.gtf))


if __name__ == "__main__":
    cli()
