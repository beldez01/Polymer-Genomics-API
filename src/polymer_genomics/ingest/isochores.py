"""Isochore computation and ingestion into ref.isochores.

Computes GC content in non-overlapping windows across each chromosome of a
reference FASTA, classifies each window into a Bernardi isochore band
(L1/L2/H1/H2/H3), and bulk-loads via the COPY protocol.

The ``ref.isochores`` table is a simple (non-partitioned) table with a GiST
index on ``(chr_id, coord)`` for efficient range queries.

Usage::

    uv run python -m polymer_genomics.ingest.isochores
    uv run python -m polymer_genomics.ingest.isochores --build hg38
    uv run python -m polymer_genomics.ingest.isochores --build hg37
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest.cpg import read_fasta_sequence

# ── Constants ────────────────────────────────────────────────────────────────

# Default window and step size for isochore computation (300 kb).
DEFAULT_WINDOW_SIZE = 300_000
DEFAULT_STEP_SIZE = 300_000

# Bernardi isochore classification thresholds (GC fraction).
# L1: <0.37, L2: 0.37-0.41, H1: 0.41-0.46, H2: 0.46-0.53, H3: >0.53
ISOCHORE_THRESHOLDS: list[tuple[float, str]] = [
    (0.37, "L1"),
    (0.41, "L2"),
    (0.46, "H1"),
    (0.53, "H2"),
    # Anything >= 0.53 is H3 (handled as the default).
]

COLUMNS: list[str] = [
    "layer_id",
    "build",
    "chr_id",
    "start_pos",
    "end_pos",
    "gc_content",
    "isochore_class",
]

BATCH_SIZE = 5_000

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"


# ── GC content computation ───────────────────────────────────────────────────


def compute_gc_content(sequence: str, start: int, end: int) -> float:
    """Compute GC fraction for a substring of a DNA sequence.

    Counts only unambiguous bases (A, T, G, C).  Ambiguous bases (N, etc.)
    are excluded from both numerator and denominator so they do not bias
    the GC estimate.

    Parameters
    ----------
    sequence
        Full chromosome sequence (uppercase).
    start
        0-based start position (inclusive).
    end
        0-based end position (exclusive).

    Returns
    -------
    float
        GC fraction in ``[0.0, 1.0]``, or ``0.0`` if the window contains
        no unambiguous bases.
    """
    subseq = sequence[start:end]
    if not subseq:
        return 0.0

    gc_count = subseq.count("G") + subseq.count("C")
    at_count = subseq.count("A") + subseq.count("T")
    total = gc_count + at_count

    if total == 0:
        return 0.0

    return gc_count / total


# ── Isochore classification ──────────────────────────────────────────────────


def classify_isochore(gc_content: float) -> str:
    """Classify a GC fraction into a Bernardi isochore band.

    Thresholds (Bernardi 2000):

    - **L1**: GC < 37%
    - **L2**: 37% <= GC < 41%
    - **H1**: 41% <= GC < 46%
    - **H2**: 46% <= GC < 53%
    - **H3**: GC >= 53%

    Parameters
    ----------
    gc_content
        GC fraction in ``[0.0, 1.0]``.

    Returns
    -------
    str
        One of ``'L1'``, ``'L2'``, ``'H1'``, ``'H2'``, ``'H3'``.
    """
    for threshold, label in ISOCHORE_THRESHOLDS:
        if gc_content < threshold:
            return label
    return "H3"


# ── Window computation ───────────────────────────────────────────────────────


def compute_isochores(
    sequence: str,
    chr_name: str,
    window_size: int = DEFAULT_WINDOW_SIZE,
    step_size: int = DEFAULT_STEP_SIZE,
) -> list[tuple[int, int, float, str]]:
    """Compute isochore windows across a chromosome sequence.

    Slides a window of ``window_size`` bp across the sequence in steps of
    ``step_size`` bp.  The final window is truncated to the sequence length
    (not extended or padded).

    Parameters
    ----------
    sequence
        Full chromosome sequence (uppercase).
    chr_name
        Chromosome name (for logging; not used in computation).
    window_size
        Window size in bp (default 300,000).
    step_size
        Step size in bp (default 300,000, i.e. non-overlapping).

    Returns
    -------
    list[tuple[int, int, float, str]]
        List of ``(start, end, gc_content, isochore_class)`` tuples.
        Coordinates are 0-based half-open.
    """
    seq_len = len(sequence)
    if seq_len == 0:
        return []

    results: list[tuple[int, int, float, str]] = []
    start = 0

    while start < seq_len:
        end = min(start + window_size, seq_len)
        gc = compute_gc_content(sequence, start, end)
        iso_class = classify_isochore(gc)
        results.append((start, end, gc, iso_class))
        start += step_size

    return results


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
) -> str:
    """Register (or retrieve) the isochore layer in registry.layers.

    Parameters
    ----------
    conn
        Admin connection.
    build
        Genome build (``hg38`` or ``hg37``).

    Returns
    -------
    str
        The layer UUID.
    """
    layer_key = "isochores"
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
            ($1, $2, $3, 'isochore', $4,
             'computed', 'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"Isochores ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Ingestion ────────────────────────────────────────────────────────────────


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    fasta_dir: str | Path,
) -> int:
    """Compute and load isochores for one genome build.

    Reads each chromosome FASTA from ``fasta_dir``, computes GC content in
    300 kb windows, classifies into Bernardi bands, and bulk-loads into
    ``ref.isochores``.

    Parameters
    ----------
    conn
        Database connection with INSERT privilege on ref schema.
    build
        Genome build (``hg38`` or ``hg37``).
    layer_id
        UUID of the registered isochore layer.
    fasta_dir
        Path to a directory containing a reference FASTA file, or
        path to the FASTA file itself.

    Returns
    -------
    int
        Total number of isochore rows loaded.
    """
    fasta_path = Path(fasta_dir)

    total_loaded = 0
    batch: list[tuple] = []

    for chr_name in sorted(CHR_NAME_TO_ID, key=lambda c: CHR_NAME_TO_ID[c]):
        chr_id = CHR_NAME_TO_ID[chr_name]
        print(f"  Processing {chr_name} (chr_id={chr_id})...")

        try:
            sequence = read_fasta_sequence(fasta_path, chr_name)
        except ValueError:
            print(f"    Skipping {chr_name}: not found in FASTA")
            continue

        windows = compute_isochores(sequence, chr_name)
        print(f"    {chr_name}: {len(windows)} isochore windows")

        for start, end, gc, iso_class in windows:
            row = (layer_id, build, chr_id, start, end, gc, iso_class)
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                await conn.copy_records_to_table(
                    "isochores",
                    records=batch,
                    columns=COLUMNS,
                    schema_name="ref",
                )
                total_loaded += len(batch)
                print(f"    Loaded batch: {len(batch)} rows (total: {total_loaded:,})")
                batch = []

        # Free memory after each chromosome.
        del sequence

    # Flush remaining rows.
    if batch:
        await conn.copy_records_to_table(
            "isochores",
            records=batch,
            columns=COLUMNS,
            schema_name="ref",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect as admin and ingest isochores.

    Parameters
    ----------
    builds
        List of builds to ingest. Defaults to ``["hg38", "hg37"]``.
    """
    if builds is None:
        builds = ["hg38", "hg37"]

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    conn = await asyncpg.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
    )

    fasta_env = {"hg38": "FASTA_HG38", "hg37": "FASTA_HG37"}
    fasta_defaults = {
        "hg38": str(DATA_DIR / "hg38.fa"),
        "hg37": str(DATA_DIR / "hg37.fa"),
    }

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting isochores - {build}")
            print(f"{'='*60}")

            # 1. Register layer.
            layer_id = await register_layer(conn, build)

            # 2. Check for existing data to avoid duplicates.
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM ref.isochores WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Resolve FASTA path.
            fasta_path = os.environ.get(fasta_env[build], fasta_defaults[build])
            if not Path(fasta_path).exists():
                print(f"  ERROR: FASTA not found at {fasta_path}")
                print(f"  Set {fasta_env[build]} environment variable to the correct path.")
                continue

            # 4. Compute isochores and bulk load.
            total = await ingest_build(conn, build, layer_id, fasta_path)
            print(f"\n  Total isochore rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Compute and ingest isochores into ref.isochores",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build to ingest (default: both hg38 and hg37)",
    )
    args = parser.parse_args()

    builds = [args.build] if args.build else None
    asyncio.run(main(builds))


if __name__ == "__main__":
    cli()
