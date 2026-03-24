"""CpG site scanner and island ingestion into cpg.sites / cpg.islands.

Scans a reference FASTA for all CG dinucleotides, downloads the UCSC CpG island
track, classifies each CpG site by genomic context (island / shore / shelf / open
sea), computes local GC content, and bulk-loads via the COPY protocol.

Usage::

    uv run python -m polymer_genomics.ingest.cpg
    uv run python -m polymer_genomics.ingest.cpg --build hg38
    uv run python -m polymer_genomics.ingest.cpg --build hg37
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import os
import urllib.request
from bisect import bisect_right
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction
from polymer_genomics.ingest.loader import batch_load, compute_content_hash, update_layer_stats
from polymer_genomics.ingest.partitions import ensure_partitions

# ── Constants ────────────────────────────────────────────────────────────────

ISLAND_URLS: dict[str, str] = {
    "hg38": "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cpgIslandExt.txt.gz",
    "hg37": "https://hgdownload.soe.ucsc.edu/goldenPath/hg19/database/cpgIslandExt.txt.gz",
}

ISLAND_FILENAMES: dict[str, str] = {
    "hg38": "cpgIslandExt.hg38.txt.gz",
    "hg37": "cpgIslandExt.hg19.txt.gz",
}

SITE_COLUMNS: list[str] = [
    "layer_id",
    "build",
    "chr_id",
    "pos",
    "island_id",
    "context",
    "gc_content",
]

ISLAND_COLUMNS: list[str] = [
    "layer_id",
    "build",
    "chr_id",
    "start_pos",
    "end_pos",
    "island_name",
]

BATCH_SIZE = 100_000

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

# Context classification distances (bp).
SHORE_DISTANCE = 2000
SHELF_DISTANCE = 4000

# GC content window size (bp) — symmetric around site.
GC_WINDOW = 500


# ── FASTA reading ────────────────────────────────────────────────────────────


def read_fasta_sequence(fasta_path: str | Path, chr_name: str) -> str:
    """Read a single chromosome sequence from a FASTA file.

    Supports both plain and gzip-compressed FASTA files. Reads the entire
    sequence for the requested chromosome into memory as an uppercase string.

    Parameters
    ----------
    fasta_path
        Path to the FASTA file (plain or ``.gz``).
    chr_name
        Chromosome name to extract (e.g. ``chr1``).

    Returns
    -------
    str
        The chromosome sequence in uppercase.

    Raises
    ------
    ValueError
        If the chromosome is not found in the FASTA file.
    """
    fasta_path = Path(fasta_path)
    opener = gzip.open if fasta_path.suffix == ".gz" else open
    found = False
    parts: list[str] = []

    with opener(fasta_path, "rt") as fh:  # type: ignore[arg-type]
        for line in fh:
            line = line.rstrip("\n\r")
            if line.startswith(">"):
                if found:
                    # Hit the next chromosome header — done.
                    break
                # Check if this header matches the requested chromosome.
                header_name = line[1:].split()[0]
                if header_name == chr_name:
                    found = True
                continue
            if found:
                parts.append(line.upper())

    if not found:
        msg = f"Chromosome {chr_name!r} not found in {fasta_path}"
        raise ValueError(msg)

    return "".join(parts)


# ── CpG scanning ────────────────────────────────────────────────────────────


def scan_cpg_sites(sequence: str) -> list[int]:
    """Scan a DNA sequence for all CG dinucleotide positions.

    Returns 0-based positions of the ``C`` in each ``CG`` dinucleotide.

    Parameters
    ----------
    sequence
        DNA sequence string (should be uppercase).

    Returns
    -------
    list[int]
        Sorted list of 0-based positions where ``CG`` occurs.
    """
    positions: list[int] = []
    seq_upper = sequence.upper()
    start = 0
    while True:
        idx = seq_upper.find("CG", start)
        if idx == -1:
            break
        positions.append(idx)
        start = idx + 1
    return positions


# ── GC content ───────────────────────────────────────────────────────────────


def compute_gc_content(sequence: str, pos: int, window: int = GC_WINDOW) -> float:
    """Compute local GC fraction in a window centered on a position.

    The window is ``[pos - window, pos + window)``, clipped to sequence bounds.

    Parameters
    ----------
    sequence
        Full chromosome sequence (uppercase).
    pos
        0-based position of the CpG site.
    window
        Half-window size in bp (default 500, giving a 1000 bp window).

    Returns
    -------
    float
        Fraction of G + C bases in the window, in ``[0.0, 1.0]``.
    """
    start = max(0, pos - window)
    end = min(len(sequence), pos + window + 1)  # +1 for symmetric window
    subseq = sequence[start:end]
    if not subseq:
        return 0.0
    gc_count = subseq.count("G") + subseq.count("C")
    return gc_count / len(subseq)


# ── CpG island download and parsing ─────────────────────────────────────────


def download_cpg_islands(build: str, dest_dir: Path | None = None) -> Path:
    """Download UCSC CpG island track if not already present.

    Parameters
    ----------
    build
        Genome build (``hg38`` or ``hg37``).
    dest_dir
        Directory to save the file. Defaults to ``data/``.

    Returns
    -------
    Path
        Path to the downloaded (or already existing) file.
    """
    if dest_dir is None:
        dest_dir = DATA_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)

    filename = ISLAND_FILENAMES[build]
    dest = dest_dir / filename

    if dest.exists():
        size_mb = dest.stat().st_size / (1024 * 1024)
        print(f"  CpG islands already downloaded: {dest} ({size_mb:.1f} MB)")
        return dest

    url = ISLAND_URLS[build]
    print(f"  Downloading {url} ...")
    urllib.request.urlretrieve(url, dest)
    size_mb = dest.stat().st_size / (1024 * 1024)
    print(f"  Saved: {dest} ({size_mb:.1f} MB)")
    return dest


def parse_cpg_islands(bed_path: Path) -> dict[str, list[tuple[int, int, str]]]:
    """Parse UCSC cpgIslandExt.txt into per-chromosome island lists.

    The cpgIslandExt.txt format is tab-separated with columns:
    bin, chrom, chromStart, chromEnd, name, ...

    Coordinates are 0-based half-open (BED convention).

    Parameters
    ----------
    bed_path
        Path to the cpgIslandExt file (plain or gzipped).

    Returns
    -------
    dict[str, list[tuple[int, int, str]]]
        Mapping of chromosome name to sorted list of ``(start, end, name)``
        tuples for each CpG island.
    """
    islands: dict[str, list[tuple[int, int, str]]] = {}
    opener = gzip.open if bed_path.suffix == ".gz" else open

    with opener(bed_path, "rt") as fh:  # type: ignore[arg-type]
        for line in fh:
            line = line.rstrip("\n\r")
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) < 5:
                continue

            # col 0: bin (skip), col 1: chrom, col 2: start, col 3: end, col 4: name
            chrom = fields[1]
            start = int(fields[2])
            end = int(fields[3])
            name = fields[4]

            if chrom not in CHR_NAME_TO_ID:
                continue

            if chrom not in islands:
                islands[chrom] = []
            islands[chrom].append((start, end, name))

    # Sort each chromosome's islands by start position.
    for chrom in islands:
        islands[chrom].sort(key=lambda x: x[0])

    return islands


# ── Context classification ───────────────────────────────────────────────────


def _build_island_index(
    islands: list[tuple[int, int, str]],
) -> tuple[list[int], list[int]]:
    """Build sorted start/end arrays for binary search.

    Parameters
    ----------
    islands
        Sorted list of ``(start, end, name)`` island tuples.

    Returns
    -------
    tuple[list[int], list[int]]
        ``(starts, ends)`` arrays, both sorted by start position.
    """
    starts = [isl[0] for isl in islands]
    ends = [isl[1] for isl in islands]
    return starts, ends


def classify_context(
    pos: int,
    islands: list[tuple[int, int, str]],
    *,
    _index: tuple[list[int], list[int]] | None = None,
) -> str:
    """Classify a CpG site position into its genomic context.

    Uses binary search for efficient lookup against sorted island boundaries.

    Context rules (given a CpG site at ``pos`` and islands as ``[start, end)``):

    - **island**: ``start <= pos < end`` for any island
    - **n_shore**: within 2 kb upstream of an island start
      (``island_start - 2000 <= pos < island_start``)
    - **s_shore**: within 2 kb downstream of an island end
      (``island_end <= pos < island_end + 2000``)
    - **n_shelf**: 2-4 kb upstream of an island start
      (``island_start - 4000 <= pos < island_start - 2000``)
    - **s_shelf**: 2-4 kb downstream of an island end
      (``island_end + 2000 <= pos < island_end + 4000``)
    - **open_sea**: everything else

    When a site falls in overlapping regions (e.g. between two nearby islands),
    the closest island determines the context, with proximity to island taking
    priority: island > shore > shelf > open_sea.

    Parameters
    ----------
    pos
        0-based CpG site position.
    islands
        Sorted list of ``(start, end, name)`` island tuples.
    _index
        Pre-built ``(starts, ends)`` arrays for performance.  If ``None``,
        built on the fly (fine for single calls / tests).

    Returns
    -------
    str
        One of: ``'island'``, ``'n_shore'``, ``'s_shore'``,
        ``'n_shelf'``, ``'s_shelf'``, ``'open_sea'``.
    """
    if not islands:
        return "open_sea"

    if _index is not None:
        starts, ends = _index
    else:
        starts, ends = _build_island_index(islands)

    # Find the rightmost island whose start <= pos.
    idx = bisect_right(starts, pos) - 1

    best_context = "open_sea"
    best_distance = float("inf")

    # Check the island at idx and the next one (idx+1), since pos could be
    # near the boundary between two islands.
    for i in (idx, idx + 1):
        if i < 0 or i >= len(islands):
            continue

        isl_start = starts[i]
        isl_end = ends[i]

        # Check island overlap.
        if isl_start <= pos < isl_end:
            return "island"

        # Upstream of island (north).
        if pos < isl_start:
            dist = isl_start - pos
            if dist <= SHORE_DISTANCE and dist < best_distance:
                best_context = "n_shore"
                best_distance = dist
            elif SHORE_DISTANCE < dist <= SHELF_DISTANCE and dist < best_distance:
                best_context = "n_shelf"
                best_distance = dist

        # Downstream of island (south).
        if pos >= isl_end:
            dist = pos - isl_end  # end is exclusive, so pos - isl_end = 0 at boundary
            if dist <= SHORE_DISTANCE and dist < best_distance:
                best_context = "s_shore"
                best_distance = dist
            elif SHORE_DISTANCE < dist <= SHELF_DISTANCE and dist < best_distance:
                best_context = "s_shelf"
                best_distance = dist

    return best_context


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    layer_key: str,
    build: str,
    *,
    name: str,
    layer_type: str,
) -> str:
    """Register (or retrieve) a layer in registry.layers.

    Parameters
    ----------
    conn
        Admin connection.
    layer_key
        Unique layer key (e.g. ``cpg_sites``, ``cpg_islands``).
    build
        Genome build (``hg38`` or ``hg37``).
    name
        Human-readable layer name.
    layer_type
        Layer type value for the registry.

    Returns
    -------
    str
        The layer UUID.
    """
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
            ($1, $2, $3, $4, $5,
             'computed', 'non_commercial', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        name,
        layer_type,
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Island ingestion ─────────────────────────────────────────────────────────


async def ingest_islands(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    islands_by_chr: dict[str, list[tuple[int, int, str]]],
) -> int:
    """Load parsed CpG islands into cpg.islands.

    Parameters
    ----------
    conn
        Database connection with INSERT privilege.
    build
        Genome build.
    layer_id
        UUID of the CpG islands layer.
    islands_by_chr
        Per-chromosome island data from ``parse_cpg_islands``.

    Returns
    -------
    int
        Total number of island rows loaded.
    """
    total = 0
    batch: list[tuple] = []

    for chr_name in sorted(islands_by_chr, key=lambda c: CHR_NAME_TO_ID.get(c, 999)):
        chr_id = CHR_NAME_TO_ID.get(chr_name)
        if chr_id is None:
            continue

        for start, end, name in islands_by_chr[chr_name]:
            row = (layer_id, build, chr_id, start, end, name)
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                n = await batch_load(conn, "cpg", "islands", batch, ISLAND_COLUMNS)
                total += n
                print(f"    Islands: loaded batch {n} rows (total: {total:,})")
                batch = []

    if batch:
        n = await batch_load(conn, "cpg", "islands", batch, ISLAND_COLUMNS)
        total += n
        print(f"    Islands: loaded final batch {n} rows (total: {total:,})")

    return total


# ── Site ingestion ───────────────────────────────────────────────────────────


async def ingest_sites_for_chr(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    chr_name: str,
    chr_id: int,
    sequence: str,
    islands: list[tuple[int, int, str]],
) -> int:
    """Scan and load CpG sites for a single chromosome.

    Parameters
    ----------
    conn
        Database connection.
    build
        Genome build.
    layer_id
        UUID of the CpG sites layer.
    chr_name
        Chromosome name (e.g. ``chr1``).
    chr_id
        Chromosome ID (1-25).
    sequence
        Full chromosome sequence (uppercase).
    islands
        Sorted island list for this chromosome.

    Returns
    -------
    int
        Number of site rows loaded for this chromosome.
    """
    # Scan for CpG sites.
    positions = scan_cpg_sites(sequence)
    print(f"    {chr_name}: {len(positions):,} CpG sites found")

    if not positions:
        return 0

    # Pre-build island index for binary search.
    index = _build_island_index(islands) if islands else ([], [])

    total = 0
    batch: list[tuple] = []

    for pos in positions:
        context = classify_context(pos, islands, _index=index)
        gc = compute_gc_content(sequence, pos)
        # island_id is NULL for now — populated later via JOIN.
        row = (layer_id, build, chr_id, pos, None, context, gc)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            n = await batch_load(conn, "cpg", "sites", batch, SITE_COLUMNS)
            total += n
            batch = []

    if batch:
        n = await batch_load(conn, "cpg", "sites", batch, SITE_COLUMNS)
        total += n

    print(f"    {chr_name}: {total:,} sites loaded")
    return total


# ── Full build ingestion ─────────────────────────────────────────────────────


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    fasta_path: str | Path,
) -> tuple[int, int]:
    """Full ingestion pipeline for one genome build.

    Steps:
    1. Register layers for islands and sites.
    2. Download and parse CpG island track.
    3. Ensure partitions exist for cpg.sites.
    4. Scan FASTA chromosome-by-chromosome, classify contexts, load sites.

    Parameters
    ----------
    conn
        Database connection with admin privileges.
    build
        Genome build (``hg38`` or ``hg37``).
    fasta_path
        Path to the reference FASTA file.

    Returns
    -------
    tuple[int, int]
        ``(island_count, site_count)`` total rows loaded.
    """
    # 1. Register layers.
    island_layer_id = await register_layer(
        conn,
        "cpg_islands",
        build,
        name=f"CpG Islands ({build})",
        layer_type="cpg",
    )
    site_layer_id = await register_layer(
        conn,
        "cpg_sites",
        build,
        name=f"CpG Sites ({build})",
        layer_type="cpg",
    )

    # 2. Download and parse islands.
    island_bed = download_cpg_islands(build)
    islands_by_chr = parse_cpg_islands(island_bed)
    total_islands_parsed = sum(len(v) for v in islands_by_chr.values())
    print(f"  Parsed {total_islands_parsed:,} CpG islands across {len(islands_by_chr)} chromosomes")

    # 3. Load islands into cpg.islands.
    island_count = await ingest_islands(conn, build, island_layer_id, islands_by_chr)

    # 4. Ensure partitions exist for cpg.sites.
    chr_ids = list(range(1, 26))
    await ensure_partitions(conn, "cpg", "sites", build, chr_ids)

    # 5. Scan FASTA and load sites, one chromosome at a time.
    total_sites = 0
    for chr_name in sorted(CHR_NAME_TO_ID, key=lambda c: CHR_NAME_TO_ID[c]):
        chr_id = CHR_NAME_TO_ID[chr_name]
        print(f"\n  Processing {chr_name} (chr_id={chr_id})...")

        try:
            sequence = read_fasta_sequence(fasta_path, chr_name)
        except ValueError:
            print(f"    Skipping {chr_name}: not found in FASTA")
            continue

        chr_islands = islands_by_chr.get(chr_name, [])
        n = await ingest_sites_for_chr(
            conn, build, site_layer_id, chr_name, chr_id, sequence, chr_islands
        )
        total_sites += n

        # Free memory after each chromosome.
        del sequence

    # 6. Update layer stats.
    print("\n  Computing content hashes...")
    if island_count > 0:
        island_hash = await compute_content_hash(conn, "cpg", "islands", str(island_layer_id))
        await update_layer_stats(conn, str(island_layer_id), island_count, island_hash)
        print(f"  Islands hash: {island_hash[:30]}...")

    if total_sites > 0:
        site_hash = await compute_content_hash(conn, "cpg", "sites", str(site_layer_id))
        await update_layer_stats(conn, str(site_layer_id), total_sites, site_hash)
        print(f"  Sites hash: {site_hash[:30]}...")

    return island_count, total_sites


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None) -> None:
    """Connect as admin and ingest CpG sites and islands.

    Parameters
    ----------
    builds
        List of builds to ingest. Defaults to ``["hg38", "hg37"]``.
    """
    if builds is None:
        builds = ["hg38", "hg37"]

    conn = await get_ingest_connection(admin=True)

    fasta_env = {"hg38": "FASTA_HG38", "hg37": "FASTA_HG37"}
    fasta_defaults = {
        "hg38": str(DATA_DIR / "hg38.fa"),
        "hg37": str(DATA_DIR / "hg37.fa"),
    }

    try:
        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting CpG sites + islands — {build}")
            print(f"{'='*60}")

            fasta_path = os.environ.get(fasta_env[build], fasta_defaults[build])
            if not Path(fasta_path).exists():
                print(f"  ERROR: FASTA not found at {fasta_path}")
                print(f"  Set {fasta_env[build]} environment variable to the correct path.")
                continue

            async with ingest_transaction(conn):
                island_count, site_count = await ingest_build(conn, build, fasta_path)
                print(f"\n  Summary: {island_count:,} islands, {site_count:,} sites loaded")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest CpG sites and islands into cpg.sites / cpg.islands",
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
