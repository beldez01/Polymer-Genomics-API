"""ChromHMM 15-state segmentation ingestion into regulatory.chromatin_state.

Reads Roadmap Epigenomics ChromHMM BED files (15-state core marks model),
maps chromosome names to chr_id, and bulk-loads via the COPY protocol.

Each epigenome has a BED file named ``E0NN_15_coreMarks_dense.bed`` with
tab-separated fields: chr, start, end, state_label, score, strand,
thickStart, thickEnd, itemRgb.

Usage::

    uv run python -m polymer_genomics.ingest.chromatin_state
    uv run python -m polymer_genomics.ingest.chromatin_state --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 5_000

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "epigenome_id", "epigenome_name",
    "state_id", "state_name",
]

# ChromHMM 15-state core marks model
STATE_MAP: dict[int, str] = {
    1: "TssA",
    2: "TssAFlnk",
    3: "TxFlnk",
    4: "Tx",
    5: "TxWk",
    6: "EnhG",
    7: "Enh",
    8: "ZNF/Rpts",
    9: "Het",
    10: "TssBiv",
    11: "BivFlnk",
    12: "EnhBiv",
    13: "ReprPC",
    14: "ReprPCWk",
    15: "Quies",
}

# Key Roadmap Epigenomics epigenome IDs and names
EPIGENOME_MAP: dict[str, str] = {
    "E062": "Primary mononuclear cells from peripheral blood",
    "E034": "Primary T cells from peripheral blood",
    "E045": "Primary T cells effector/memory enriched from peripheral blood",
    "E038": "Primary T helper naive cells from peripheral blood",
    "E047": "Primary T killer naive cells from peripheral blood",
    "E029": "Primary monocytes from peripheral blood",
    "E032": "Primary B cells from peripheral blood",
    "E116": "GM12878 Lymphoblastoid Cells",
    "E123": "K562 Leukemia Cells",
    "E118": "HepG2 Hepatocellular Carcinoma Cell Line",
}


# ── BED reader ──────────────────────────────────────────────────────────────


def read_chromhmm_bed(bed_path: str | Path, epigenome_id: str) -> list[dict]:
    """Parse a single ChromHMM 15-state BED file for one epigenome.

    Expected BED format (tab-separated):
        chr  start  end  state_label  score  strand  thickStart  thickEnd  itemRgb

    state_label format: "1_TssA", "2_TssAFlnk", etc.
    Coordinates are 0-based half-open (BED format = internal format).
    """
    epigenome_name = EPIGENOME_MAP.get(epigenome_id, epigenome_id)
    rows: list[dict] = []

    with open(bed_path) as f:
        for line in f:
            if line.startswith("#") or line.startswith("track"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 4:
                continue

            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue  # skip alt/random/Un chromosomes

            try:
                start_pos = int(fields[1])  # already 0-based
                end_pos = int(fields[2])    # already half-open
            except (ValueError, IndexError):
                continue

            # Parse state_label: "1_TssA" -> state_id=1, state_name="TssA"
            state_label = fields[3]
            parts = state_label.split("_", 1)
            if len(parts) < 2:
                continue
            try:
                state_id = int(parts[0])
            except ValueError:
                continue
            state_name = STATE_MAP.get(state_id, parts[1])

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "epigenome_id": epigenome_id,
                "epigenome_name": epigenome_name,
                "state_id": state_id,
                "state_name": state_name,
            })
    return rows


# ── Layer registration ──────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the ChromHMM 15-state layer."""
    layer_key = "chromhmm_15state_v1"
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
            ($1, $2, $3, 'chromatin_state', $4,
             'Roadmap_Epigenomics', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"ChromHMM 15-state Segmentation ({build})",
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
        rec["epigenome_id"], rec["epigenome_name"],
        rec["state_id"], rec["state_name"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    chromhmm_dir: str | Path,
) -> int:
    """Scan directory for ChromHMM BED files and bulk-load into regulatory.chromatin_state."""
    chromhmm_dir = Path(chromhmm_dir)
    bed_files = sorted(chromhmm_dir.glob("*_15_coreMarks_*.bed"))
    if not bed_files:
        print(f"  ERROR: No *_15_coreMarks_*.bed files found in {chromhmm_dir}")
        return 0

    print(f"  Found {len(bed_files)} ChromHMM BED files in {chromhmm_dir}")

    total_loaded = 0

    for bed_path in bed_files:
        # Extract epigenome_id from filename (e.g., E001_15_coreMarks_dense.bed -> E001)
        epigenome_id = bed_path.name.split("_")[0]
        epigenome_name = EPIGENOME_MAP.get(epigenome_id, epigenome_id)
        print(f"\n  Processing {epigenome_id}: {epigenome_name}")

        print(f"    Reading BED file: {bed_path}")
        records = read_chromhmm_bed(bed_path, epigenome_id)
        print(f"    Parsed {len(records):,} segments")

        batch: list[tuple] = []
        file_loaded = 0

        for rec in records:
            row = _build_row(layer_id, build, rec)
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                await conn.copy_records_to_table(
                    "chromatin_state",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="regulatory",
                )
                file_loaded += len(batch)
                batch = []

        # Flush remaining
        if batch:
            await conn.copy_records_to_table(
                "chromatin_state",
                records=batch,
                columns=COLUMNS,
                schema_name="regulatory",
            )
            file_loaded += len(batch)

        total_loaded += file_loaded
        print(f"    Loaded {file_loaded:,} rows for {epigenome_id} (total: {total_loaded:,})")

    return total_loaded


# ── Main ────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect and ingest ChromHMM chromatin state data."""
    if builds is None:
        builds = ["hg38"]

    chromhmm_dir = os.environ.get(
        "CHROMHMM_DIR",
        "/Users/zbb2/Desktop/Research/data/roadmap/chromhmm/",
    )

    if not Path(chromhmm_dir).is_dir():
        print(f"ERROR: ChromHMM directory not found at {chromhmm_dir}")
        print("Set CHROMHMM_DIR environment variable to the correct path.")
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
            print(f"Ingesting ChromHMM 15-state segmentations - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM regulatory.chromatin_state WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            total = await ingest_build(conn, build, layer_id, chromhmm_dir)
            print(f"\n  Total chromatin state rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest ChromHMM 15-state segmentations into regulatory.chromatin_state",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build (default: hg38 only)",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds))


if __name__ == "__main__":
    cli()
