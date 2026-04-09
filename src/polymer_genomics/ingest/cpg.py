"""CpG site scanner and island ingestion into cpg.sites / cpg.islands.

Scans a reference FASTA for all CG dinucleotides, computes CpG islands de novo
using the Gardiner-Garden & Frommer (1987) algorithm, classifies each CpG site
by genomic context (island / shore / shelf / open sea), computes local GC
content, and bulk-loads via the COPY protocol.

The CpG island computation uses only the public-domain reference genome and the
published algorithm — no UCSC data is downloaded. This makes all output freely
licensable (MIT).

Algorithm reference:
    Gardiner-Garden M, Frommer M. CpG islands in vertebrate genomes.
    J Mol Biol. 1987;196(2):261-282. doi:10.1016/0022-2836(87)90689-9

Usage::

    uv run python -m polymer_genomics.ingest.cpg
    uv run python -m polymer_genomics.ingest.cpg --build hg38
    uv run python -m polymer_genomics.ingest.cpg --build hg37
    uv run python -m polymer_genomics.ingest.cpg --validate-ucsc   # compare with UCSC
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

# ── CpG island algorithm parameters (Gardiner-Garden & Frommer 1987) ──────
# These match the UCSC cpgIslandExt definition for concordance.
CGI_MIN_LENGTH = 200      # Minimum island length (bp)
CGI_MIN_GC = 0.50         # Minimum GC fraction
CGI_MIN_OE = 0.60         # Minimum observed/expected CpG ratio
CGI_WINDOW = 200          # Sliding window size (bp)
CGI_STEP = 1              # Step size for sliding window
CGI_MERGE_GAP = 100       # Merge islands within this distance (bp)

# Legacy UCSC download URLs — kept only for --validate-ucsc mode.
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
    end = min(len(sequence), pos + window)
    subseq = sequence[start:end]
    if not subseq:
        return 0.0
    gc_count = subseq.count("G") + subseq.count("C")
    return gc_count / len(subseq)


# ── CpG island computation (Gardiner-Garden & Frommer 1987) ───────────────


def _window_stats(seq: str, start: int, end: int) -> tuple[float, float]:
    """Compute GC fraction and observed/expected CpG ratio for a window.

    Parameters
    ----------
    seq
        Full chromosome sequence (uppercase).
    start, end
        0-based half-open window coordinates.

    Returns
    -------
    tuple[float, float]
        ``(gc_frac, obs_exp_cpg)``
    """
    window = seq[start:end]
    length = len(window)
    if length < 2:
        return 0.0, 0.0

    c_count = window.count("C")
    g_count = window.count("G")
    cg_count = window.count("CG")

    gc_frac = (c_count + g_count) / length

    # Obs/Exp = (CpG_count * length) / (C_count * G_count)
    denom = c_count * g_count
    if denom == 0:
        obs_exp = 0.0
    else:
        obs_exp = (cg_count * length) / denom

    return gc_frac, obs_exp


def compute_cpg_islands_for_chr(
    sequence: str,
    chr_name: str,
    *,
    min_length: int = CGI_MIN_LENGTH,
    min_gc: float = CGI_MIN_GC,
    min_oe: float = CGI_MIN_OE,
    window: int = CGI_WINDOW,
    step: int = CGI_STEP,
    merge_gap: int = CGI_MERGE_GAP,
) -> list[tuple[int, int, str]]:
    """Compute CpG islands for a chromosome using the Gardiner-Garden & Frommer
    (1987) algorithm.

    Slides a window across the sequence, identifies seed regions that pass
    GC and O/E thresholds, extends them, merges nearby islands, and applies
    a final length + quality filter.

    All parameters match the UCSC cpgIslandExt defaults for concordance.

    Parameters
    ----------
    sequence
        Full chromosome sequence (uppercase).
    chr_name
        Chromosome name (for island naming).
    min_length
        Minimum island length in bp (default 200).
    min_gc
        Minimum GC fraction (default 0.50).
    min_oe
        Minimum observed/expected CpG ratio (default 0.60).
    window
        Sliding window size in bp (default 200).
    step
        Step size for initial scan (default 1).
    merge_gap
        Merge islands within this distance (default 100).

    Returns
    -------
    list[tuple[int, int, str]]
        List of ``(start, end, name)`` tuples (0-based half-open), sorted by
        start position. Compatible with ``parse_cpg_islands`` output format.
    """
    seq_len = len(sequence)
    if seq_len < window:
        return []

    # Phase 1: Identify seed windows that pass both thresholds.
    # Use coarser step for speed on initial scan, then refine boundaries.
    scan_step = max(1, step)
    passing: list[tuple[int, int]] = []  # (start, end) of passing windows

    pos = 0
    while pos + window <= seq_len:
        gc_frac, obs_exp = _window_stats(sequence, pos, pos + window)
        if gc_frac >= min_gc and obs_exp >= min_oe:
            passing.append((pos, pos + window))
        pos += scan_step

    if not passing:
        return []

    # Phase 2: Merge overlapping/adjacent passing windows into candidate regions.
    merged: list[list[int]] = [[passing[0][0], passing[0][1]]]
    for start, end in passing[1:]:
        if start <= merged[-1][1]:
            # Overlapping or contiguous — extend.
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])

    # Phase 3: Merge candidates that are within merge_gap of each other.
    final_merged: list[list[int]] = [merged[0]]
    for region in merged[1:]:
        if region[0] - final_merged[-1][1] <= merge_gap:
            final_merged[-1][1] = max(final_merged[-1][1], region[1])
        else:
            final_merged.append(region)

    # Phase 4: Final quality filter on merged regions.
    islands: list[tuple[int, int, str]] = []
    counter = 0
    for start, end in final_merged:
        length = end - start
        if length < min_length:
            continue

        gc_frac, obs_exp = _window_stats(sequence, start, end)
        if gc_frac >= min_gc and obs_exp >= min_oe:
            counter += 1
            name = f"CpG: {chr_name}:{start}-{end}"
            islands.append((start, end, name))

    return islands


def compute_all_cpg_islands(
    fasta_path: str | Path,
) -> dict[str, list[tuple[int, int, str]]]:
    """Compute CpG islands genome-wide from a reference FASTA.

    Parameters
    ----------
    fasta_path
        Path to the reference genome FASTA.

    Returns
    -------
    dict[str, list[tuple[int, int, str]]]
        Per-chromosome island lists, same format as ``parse_cpg_islands``.
    """
    islands_by_chr: dict[str, list[tuple[int, int, str]]] = {}

    for chr_name in sorted(CHR_NAME_TO_ID, key=lambda c: CHR_NAME_TO_ID[c]):
        print(f"    Computing CpG islands for {chr_name}...")
        try:
            sequence = read_fasta_sequence(fasta_path, chr_name)
        except ValueError:
            print(f"    Skipping {chr_name}: not in FASTA")
            continue

        chr_islands = compute_cpg_islands_for_chr(sequence, chr_name)
        if chr_islands:
            islands_by_chr[chr_name] = chr_islands
        print(f"    {chr_name}: {len(chr_islands):,} islands found")

        del sequence  # free memory

    return islands_by_chr


# ── UCSC validation (optional) ────────────────────────────────────────────


def validate_against_ucsc(
    computed: dict[str, list[tuple[int, int, str]]],
    ucsc: dict[str, list[tuple[int, int, str]]],
) -> dict[str, object]:
    """Compare computed islands against UCSC reference for validation.

    Returns a summary dict with concordance metrics.
    """
    total_computed = sum(len(v) for v in computed.values())
    total_ucsc = sum(len(v) for v in ucsc.values())

    # Count overlaps: a computed island "matches" if it overlaps any UCSC island
    # by ≥50% reciprocal overlap.
    matched = 0
    for chr_name in computed:
        if chr_name not in ucsc:
            continue
        ucsc_islands = ucsc[chr_name]
        ucsc_starts = [s for s, _, _ in ucsc_islands]
        ucsc_ends = [e for _, e, _ in ucsc_islands]

        for c_start, c_end, _ in computed[chr_name]:
            c_len = c_end - c_start
            # Binary search for nearby UCSC islands.
            idx = bisect_right(ucsc_starts, c_start) - 1
            for i in range(max(0, idx - 1), min(len(ucsc_islands), idx + 3)):
                u_start = ucsc_starts[i]
                u_end = ucsc_ends[i]
                overlap = max(0, min(c_end, u_end) - max(c_start, u_start))
                u_len = u_end - u_start
                if overlap >= 0.5 * c_len and overlap >= 0.5 * u_len:
                    matched += 1
                    break

    return {
        "computed_count": total_computed,
        "ucsc_count": total_ucsc,
        "matched": matched,
        "precision": matched / total_computed if total_computed else 0,
        "recall": matched / total_ucsc if total_ucsc else 0,
    }


# ── Legacy UCSC download (for validation only) ───────────────────────────


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
            # Downstream coordinates are 0-based half-open at the island end,
            # so add 1 to keep shore/shelf widths symmetric with upstream logic.
            dist = pos - isl_end + 1
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
             'computed_ggf1987', 'open_access', 'postgres', true, true)
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
    islands_by_chr: dict[str, list[tuple[int, int, str]]],
) -> tuple[int, int]:
    """Load pre-computed CpG islands and scan sites into the database.

    The DB connection is only used here (not during the long computation
    phase), preventing connection timeouts on slow proxy links.

    Parameters
    ----------
    conn
        Database connection with admin privileges.
    build
        Genome build (``hg38`` or ``hg37``).
    fasta_path
        Path to the reference FASTA file.
    islands_by_chr
        Pre-computed islands from ``compute_all_cpg_islands``.

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

    # 2. Load islands into cpg.islands.
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


async def main(builds: list[str] | None = None, *, validate_ucsc: bool = False) -> None:
    """Compute CpG islands from FASTA, then connect and ingest.

    Island computation runs before DB connection is opened to prevent
    connection timeouts during the long CPU-bound phase.

    Parameters
    ----------
    builds
        List of builds to ingest. Defaults to ``["hg38", "hg37"]``.
    validate_ucsc
        If True, download UCSC islands and compare for concordance.
    """
    if builds is None:
        builds = ["hg38", "hg37"]

    fasta_env = {"hg38": "FASTA_HG38", "hg37": "FASTA_HG37"}
    fasta_defaults = {
        "hg38": str(DATA_DIR / "hg38.fa"),
        "hg37": str(DATA_DIR / "hg37.fa"),
    }

    # Phase 1: Compute islands from FASTA (CPU-bound, no DB needed).
    precomputed: dict[str, tuple[str, dict[str, list[tuple[int, int, str]]]]] = {}
    for build in builds:
        fasta_path = os.environ.get(fasta_env[build], fasta_defaults[build])
        if not Path(fasta_path).exists():
            print(f"  ERROR: FASTA not found at {fasta_path}")
            print(f"  Set {fasta_env[build]} environment variable to the correct path.")
            continue

        print(f"\n{'='*60}")
        print(f"Computing CpG islands — {build} (no DB connection yet)")
        print(f"{'='*60}")
        print("  Computing CpG islands from reference FASTA (Gardiner-Garden & Frommer 1987)...")
        islands_by_chr = compute_all_cpg_islands(fasta_path)
        total_islands = sum(len(v) for v in islands_by_chr.values())
        print(f"  Computed {total_islands:,} CpG islands across {len(islands_by_chr)} chromosomes")

        if validate_ucsc:
            print("\n  Validating against UCSC precomputed islands...")
            ucsc_bed = download_cpg_islands(build)
            ucsc_islands = parse_cpg_islands(ucsc_bed)
            metrics = validate_against_ucsc(islands_by_chr, ucsc_islands)
            print(f"  Validation: computed={metrics['computed_count']:,}, "
                  f"UCSC={metrics['ucsc_count']:,}, matched={metrics['matched']:,}")
            print(f"  Precision: {metrics['precision']:.3f}, Recall: {metrics['recall']:.3f}")

        precomputed[build] = (fasta_path, islands_by_chr)

    if not precomputed:
        print("No builds to ingest.")
        return

    # Phase 2: Connect to DB and load.
    # Uses fresh connections per operation to survive fly proxy timeouts.
    for build, (fasta_path, islands_by_chr) in precomputed.items():
        print(f"\n{'='*60}")
        print(f"Loading CpG sites + islands — {build}")
        print(f"{'='*60}")

        # 2a. Register layers + load islands (short operation).
        conn = await get_ingest_connection(admin=True)
        try:
            island_layer_id = await register_layer(
                conn, "cpg_islands", build,
                name=f"CpG Islands ({build})", layer_type="cpg",
            )
            site_layer_id = await register_layer(
                conn, "cpg_sites", build,
                name=f"CpG Sites ({build})", layer_type="cpg",
            )
            island_count = await ingest_islands(conn, build, island_layer_id, islands_by_chr)
            print(f"  Islands loaded: {island_count:,}")

            chr_ids = list(range(1, 26))
            await ensure_partitions(conn, "cpg", "sites", build, chr_ids)
        finally:
            await conn.close()

        # 2b. Load sites per-chromosome with fresh connections.
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

            conn = await get_ingest_connection(admin=True)
            try:
                n = await ingest_sites_for_chr(
                    conn, build, site_layer_id, chr_name, chr_id, sequence, chr_islands
                )
                total_sites += n
            finally:
                await conn.close()

            del sequence

        # 2c. Update layer stats.
        conn = await get_ingest_connection(admin=True)
        try:
            if island_count > 0:
                island_hash = await compute_content_hash(conn, "cpg", "islands", str(island_layer_id))
                await update_layer_stats(conn, str(island_layer_id), island_count, island_hash)
            if total_sites > 0:
                site_hash = await compute_content_hash(conn, "cpg", "sites", str(site_layer_id))
                await update_layer_stats(conn, str(site_layer_id), total_sites, site_hash)
        finally:
            await conn.close()

        print(f"\n  Summary: {island_count:,} islands, {total_sites:,} sites loaded")

    print("\nDone.")


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
    parser.add_argument(
        "--validate-ucsc",
        action="store_true",
        help="Download UCSC islands and print concordance metrics (non-commercial, validation only)",
    )
    args = parser.parse_args()

    builds = [args.build] if args.build else None
    asyncio.run(main(builds, validate_ucsc=args.validate_ucsc))


if __name__ == "__main__":
    cli()
