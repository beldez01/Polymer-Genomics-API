"""Somatic mutation density ingestion from PCAWG open-tier data.

Reads PCAWG simple somatic mutation summary files, bins to 1kb windows,
and loads pan-cancer + per-type mutation rates.

Source: ICGC/TCGA PCAWG open tier (syn7364923).

Requires: asyncpg

Usage::

    uv run python -m polymer_genomics.ingest.mutation_density
    uv run python -m polymer_genomics.ingest.mutation_density --data-dir /path/to/pcawg
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
from collections import defaultdict
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

BATCH_SIZE = 50_000
WINDOW_SIZE = 1000

# Expected input file: PCAWG consensus SNV/indel calls (open tier)
# Format: chr, pos, ref, alt, donor_id, project_code
# Each mutation counted once per window for rate computation.

# Cancer type groupings for per-type rates
CANCER_GROUPS: dict[str, list[str]] = {
    "liver": ["Liver-HCC"],
    "lung": ["Lung-AdenoCA", "Lung-SCC"],
    "skin": ["Skin-Melanoma"],
    "blood": ["Lymph-BNHL", "Lymph-CLL"],
}

RATE_COLUMNS = [
    "pan_cancer_rate", "snv_rate", "indel_rate", "sv_rate",
    "liver_rate", "lung_rate", "skin_rate", "blood_rate",
]

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    *RATE_COLUMNS,
]

DEFAULT_DATA_DIR = os.path.expanduser(
    "~/Desktop/PolymerGenomicsAPI/data/pcawg"
)


def _bin_mutations(
    filepath: str,
    chr_name_to_id: dict[str, int],
) -> dict[tuple[int, int], dict[str, int]]:
    """Parse PCAWG mutation file and bin to 1kb windows.

    Returns {(chr_id, window_start): {"total": N, "snv": N, "indel": N, ...}}
    """
    windows: dict[tuple[int, int], dict[str, int]] = defaultdict(
        lambda: defaultdict(int)
    )

    opener = gzip.open if filepath.endswith(".gz") else open
    with opener(filepath, "rt") as f:
        header = next(f, None)  # skip header
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 6:
                continue

            chrom = parts[0]
            if not chrom.startswith("chr"):
                chrom = f"chr{chrom}"
            chr_id = chr_name_to_id.get(chrom)
            if chr_id is None:
                continue

            pos = int(parts[1])
            ref = parts[2]
            alt = parts[3]
            project = parts[5] if len(parts) > 5 else ""

            window_start = (pos // WINDOW_SIZE) * WINDOW_SIZE
            key = (chr_id, window_start)

            # Classify mutation type
            if len(ref) == 1 and len(alt) == 1:
                mut_type = "snv"
            else:
                mut_type = "indel"

            windows[key]["total"] += 1
            windows[key][mut_type] += 1

            # Cancer type grouping
            for group, projects in CANCER_GROUPS.items():
                if project in projects:
                    windows[key][group] += 1

    return dict(windows)


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "mutation_density_pcawg"
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
            ($1, $2, $3, 'mutation_density', $4,
             'PCAWG open tier (ICGC/TCGA, syn7364923)',
             'cc0_1_0', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"Somatic Mutation Density ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


async def ingest_mutation_density(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    data_dir: str,
    n_donors: int = 2583,  # PCAWG total donors
) -> int:
    """Parse PCAWG files and load mutation density."""
    # Find mutation file
    candidates = [
        "final_consensus_passonly.snv_mnv_indel.icgc.public.maf.gz",
        "pcawg_consensus_snv_indel.tsv.gz",
        "pcawg_mutations.tsv.gz",
        "pcawg_mutations.tsv",
    ]

    mut_file = None
    for c in candidates:
        path = os.path.join(data_dir, c)
        if Path(path).exists():
            mut_file = path
            break

    if mut_file is None:
        print(f"  ERROR: No PCAWG mutation file found in {data_dir}")
        print(f"  Expected one of: {candidates}")
        return 0

    print(f"  Parsing mutations from {Path(mut_file).name}...")
    windows = _bin_mutations(mut_file, CHR_NAME_TO_ID)
    print(f"  {len(windows):,} windows with mutations")

    # Normalize to mutations per Mb per sample
    norm_factor = n_donors * (WINDOW_SIZE / 1_000_000)

    total_loaded = 0
    batch: list[tuple] = []

    for (chr_id, window_start) in sorted(windows.keys()):
        end_pos = window_start + WINDOW_SIZE
        counts = windows[(chr_id, window_start)]

        pan_cancer = counts.get("total", 0) / norm_factor
        snv_rate = counts.get("snv", 0) / norm_factor
        indel_rate = counts.get("indel", 0) / norm_factor
        sv_rate = counts.get("sv", 0) / norm_factor

        liver_rate = counts.get("liver", 0) / norm_factor if counts.get("liver") else None
        lung_rate = counts.get("lung", 0) / norm_factor if counts.get("lung") else None
        skin_rate = counts.get("skin", 0) / norm_factor if counts.get("skin") else None
        blood_rate = counts.get("blood", 0) / norm_factor if counts.get("blood") else None

        batch.append((
            layer_id, build, chr_id, window_start, end_pos,
            pan_cancer, snv_rate, indel_rate, sv_rate,
            liver_rate, lung_rate, skin_rate, blood_rate,
        ))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "mutation_density",
                records=batch,
                columns=COLUMNS,
                schema_name="annotation",
            )
            total_loaded += len(batch)
            if total_loaded % 500_000 == 0:
                print(f"    Loaded {total_loaded:,} rows...")
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "mutation_density",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)

    print(f"  Total rows loaded: {total_loaded:,}")
    return total_loaded


async def main(build: str = "hg38", data_dir: str | None = None) -> None:
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR

    if not Path(data_dir).is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("Download PCAWG open-tier mutation calls to this directory.")
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
        print(f"\n{'='*60}")
        print(f"Somatic Mutation Density Ingestion - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        existing_count = await conn.fetchval(
            "SELECT count(*) FROM annotation.mutation_density WHERE layer_id = $1",
            layer_id,
        )
        if existing_count > 0:
            print(f"  WARNING: {existing_count:,} rows already exist. Skipping.")
            return

        total = await ingest_mutation_density(conn, build, layer_id, data_dir)
        print(f"\n  Mutation density rows loaded: {total:,}")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest PCAWG somatic mutation density (1kb bins)",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.build, args.data_dir))


if __name__ == "__main__":
    cli()
