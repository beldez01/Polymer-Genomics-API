"""TCGA Pan-Cancer methylation summary ingestion into methylation.tcga_pan_cancer.

Pre-computed tumor vs normal delta-betas per probe per cancer type.
Probe coordinates resolved from the probe.coordinates table in the database.

Usage::

    uv run python -m polymer_genomics.ingest.tcga_pan_cancer --build hg38
"""

from __future__ import annotations

import argparse
import asyncio
import csv
from pathlib import Path

import asyncpg

from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 50_000

COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "probe_id", "cancer_type",
    "n_tumor", "n_normal",
    "mean_tumor", "mean_normal",
    "delta_beta", "p_value", "fdr",
    "direction",
]

DATA_DIR = Path("data/downloads/tcga_methylation")

CANCER_TYPES: list[str] = [
    "ACC", "BLCA", "BRCA", "CESC", "CHOL", "COAD", "DLBC", "ESCA",
    "GBM", "HNSC", "KICH", "KIRC", "KIRP", "LAML", "LGG", "LIHC",
    "LUAD", "LUSC", "MESO", "OV", "PAAD", "PCPG", "PRAD", "READ",
    "SARC", "SKCM", "STAD", "TGCT", "THCA", "THYM", "UCEC", "UCS",
    "UVM",
]


# ── Probe coordinate lookup ────────────────────────────────────────────────


async def load_probe_coordinates(
    conn: asyncpg.Connection, build: str,
) -> dict[str, tuple[int, int, int]]:
    """Load probe_id -> (chr_id, start_pos, end_pos) from probe.coordinates."""
    rows = await conn.fetch(
        "SELECT probe_id, chr_id, start_pos, end_pos "
        "FROM probe.coordinates WHERE build = $1::genome_build",
        build,
    )
    lookup: dict[str, tuple[int, int, int]] = {}
    for r in rows:
        lookup[r["probe_id"]] = (r["chr_id"], r["start_pos"], r["end_pos"])
    print(f"  Loaded {len(lookup):,} probe coordinates for {build}")
    return lookup


# ── TSV reader ──────────────────────────────────────────────────────────────


def _safe_int(val: str | None) -> int | None:
    if val is None or val == "" or val == "NA":
        return None
    return int(val)


def _safe_float(val: str | None) -> float | None:
    if val is None or val == "" or val == "NA" or val == "nan":
        return None
    return float(val)


def _derive_direction(delta_beta: float, raw_direction: str | None) -> str:
    """Return direction from file or derive from delta_beta sign."""
    if raw_direction and raw_direction.strip():
        return raw_direction.strip()
    return "hyper" if delta_beta > 0 else "hypo"


def read_cancer_type_tsv(
    tsv_path: Path,
    cancer_type: str,
    probe_lookup: dict[str, tuple[int, int, int]],
) -> list[dict]:
    """Parse a single cancer-type TSV file.

    TSV columns: probe_id, n_tumor, n_normal, mean_tumor, mean_normal,
                 delta_beta, p_value, fdr, direction
    """
    rows: list[dict] = []
    skipped_no_coord = 0

    with open(tsv_path, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for rec in reader:
            probe_id = rec["probe_id"]
            coord = probe_lookup.get(probe_id)
            if coord is None:
                skipped_no_coord += 1
                continue

            chr_id, start_pos, end_pos = coord

            delta_beta = _safe_float(rec["delta_beta"])
            if delta_beta is None:
                continue

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "probe_id": probe_id,
                "cancer_type": cancer_type,
                "n_tumor": _safe_int(rec.get("n_tumor")),
                "n_normal": _safe_int(rec.get("n_normal")),
                "mean_tumor": _safe_float(rec.get("mean_tumor")),
                "mean_normal": _safe_float(rec.get("mean_normal")),
                "delta_beta": delta_beta,
                "p_value": _safe_float(rec.get("p_value")),
                "fdr": _safe_float(rec.get("fdr")),
                "direction": _derive_direction(delta_beta, rec.get("direction")),
            })

    if skipped_no_coord:
        print(f"    Skipped {skipped_no_coord:,} probes (no coordinates in DB)")
    return rows


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "tcga_pan_cancer_meth_v1"
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
           VALUES ($1, $2, $3, 'tcga_methylation', $4,
                   'TCGA Pan-Cancer (GDC/Xena, Goldman et al. 2020 Nature Biotechnology)',
                   'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version,
        f"TCGA Pan-Cancer Methylation ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: dict) -> tuple:
    return (
        layer_id, build,
        rec["chr_id"], rec["start_pos"], rec["end_pos"],
        rec["probe_id"], rec["cancer_type"],
        rec["n_tumor"], rec["n_normal"],
        rec["mean_tumor"], rec["mean_normal"],
        rec["delta_beta"], rec["p_value"], rec["fdr"],
        rec["direction"],
    )


async def ingest_cancer_type(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    cancer_type: str,
    probe_lookup: dict[str, tuple[int, int, int]],
    data_dir: Path,
) -> int:
    tsv_path = data_dir / f"{cancer_type}.tsv"
    if not tsv_path.is_file():
        print(f"  WARNING: {tsv_path} not found, skipping {cancer_type}")
        return 0

    print(f"\n  Reading {cancer_type}: {tsv_path}")
    records = read_cancer_type_tsv(tsv_path, cancer_type, probe_lookup)
    if not records:
        print(f"  WARNING: No records parsed for {cancer_type}")
        return 0

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        batch.append(_build_row(layer_id, build, rec))
        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "tcga_pan_cancer", records=batch,
                columns=COLUMNS, schema_name="methylation",
            )
            total_loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "tcga_pan_cancer", records=batch,
            columns=COLUMNS, schema_name="methylation",
        )
        total_loaded += len(batch)

    print(f"  Loaded {total_loaded:,} rows for {cancer_type}")
    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    if builds is None:
        builds = ["hg38"]

    data_dir = DATA_DIR
    if not data_dir.is_dir():
        print(f"ERROR: Data directory not found: {data_dir}")
        print("  Expected one TSV per cancer type (e.g., LAML.tsv, GBM.tsv)")
        return

    conn = await get_ingest_connection(admin=True)
    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting TCGA Pan-Cancer Methylation - {build}")
            print(f"{'='*60}")

            layer_id = await register_layer(conn, build)

            existing = await conn.fetchval(
                "SELECT count(*) FROM methylation.tcga_pan_cancer "
                "WHERE layer_id = $1",
                layer_id,
            )
            if existing > 0:
                print(f"  WARNING: {existing:,} rows already exist. Skipping.")
                continue

            probe_lookup = await load_probe_coordinates(conn, build)
            if not probe_lookup:
                print("  ERROR: No probe coordinates loaded. Run probes ingestion first.")
                continue

            grand_total = 0
            async with ingest_transaction(conn):
                for cancer_type in CANCER_TYPES:
                    total = await ingest_cancer_type(
                        conn, build, layer_id, cancer_type,
                        probe_lookup, data_dir,
                    )
                    grand_total += total

            print(f"\n  Grand total TCGA rows loaded: {grand_total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest TCGA Pan-Cancer methylation summaries",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default=None)
    args = parser.parse_args()
    asyncio.run(main([args.build] if args.build else None))


if __name__ == "__main__":
    cli()
