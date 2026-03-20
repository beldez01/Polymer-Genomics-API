"""Probe manifest ingestion into probe.coordinates and probe.map_edges.

Reads pre-exported CSV manifests (from sesameData / Bioconductor) containing
probe coordinates for Illumina methylation arrays.  Derives gene_symbol (nearest
gene from GENCODE in DB) and cpg_context (from CpG islands in DB), then
cross-maps probes across platforms by exact probe_id match and exact coordinate
match.

Supports three platforms (epic_v2, epic_v1, 450k) across two builds (hg38, hg37),
yielding 6 layer registrations.

Usage::

    uv run python -m polymer_genomics.ingest.probes
    uv run python -m polymer_genomics.ingest.probes --build hg38
    uv run python -m polymer_genomics.ingest.probes --platform epic_v2
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
from collections import defaultdict
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest.loader import batch_load, compute_content_hash, update_layer_stats

# ── Constants ────────────────────────────────────────────────────────────────

PLATFORMS = ["epic_v2", "epic_v1", "450k"]
BUILDS = ["hg38", "hg37"]

# Layer keys follow the pattern: probe_{platform}
LAYER_KEY_PREFIX = "probe"

# Columns for COPY into probe.coordinates (must match tuple order in _build_row).
COLUMNS_PROBES = [
    "layer_id",
    "probe_id",
    "build",
    "chr_id",
    "pos",
    "gene_symbol",
    "cpg_context",
]

# Columns for COPY into probe.map_edges.
COLUMNS_MAP_EDGES = [
    "src_platform",
    "src_probe_id",
    "dst_platform",
    "dst_probe_id",
    "build",
    "chr_id",
    "pos",
    "method",
    "confidence",
]

BATCH_SIZE = 50_000

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"

# Gene annotation window: look for the nearest gene within this many bp.
GENE_WINDOW_BP = 10_000

# CpG context classification distances (matching cpg.py).
SHORE_DISTANCE = 2000
SHELF_DISTANCE = 4000


# ── CSV Parsing ──────────────────────────────────────────────────────────────


def parse_manifest_csv(csv_path: str | Path) -> list[dict]:
    """Parse a probe manifest CSV into a list of dicts.

    Expected columns: probe_id, chr, pos, strand, platform.
    The ``chr`` column should use chrN format (e.g. chr1, chrX).
    The ``pos`` column should be 0-based.

    Parameters
    ----------
    csv_path
        Path to the CSV file.

    Returns
    -------
    list[dict]
        List of dicts with keys: probe_id, chr, chr_id, pos, strand, platform.
        Rows with unrecognised chromosomes are silently skipped.
    """
    csv_path = Path(csv_path)
    records: list[dict] = []

    # Auto-detect delimiter (TSV from export_probes.R or CSV).
    with open(csv_path, encoding="utf-8") as peek:
        first_line = peek.readline()
    delimiter = "\t" if "\t" in first_line else ","

    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter=delimiter)
        for row in reader:
            probe_id = row["probe_id"].strip()
            chr_name = row["chr"].strip()
            pos_str = row["pos"].strip()
            strand = row.get("strand", "+").strip()
            platform = row["platform"].strip()

            # Skip rows with unrecognised chromosomes.
            chr_id = CHR_NAME_TO_ID.get(chr_name)
            if chr_id is None:
                continue

            # Validate platform.
            if platform not in PLATFORMS:
                continue

            records.append({
                "probe_id": probe_id,
                "chr": chr_name,
                "chr_id": chr_id,
                "pos": int(pos_str),
                "strand": strand,
                "platform": platform,
            })

    return records


def filter_by_platform(records: list[dict], platform: str) -> list[dict]:
    """Filter parsed manifest records to a single platform.

    Parameters
    ----------
    records
        Full list of parsed probe records.
    platform
        Platform to keep (e.g. ``'epic_v2'``).

    Returns
    -------
    list[dict]
        Filtered list.
    """
    return [r for r in records if r["platform"] == platform]


# ── Gene Symbol Derivation ───────────────────────────────────────────────────


async def derive_gene_symbols_batch(
    conn: asyncpg.Connection,
    build: str,
    probes: list[dict],
) -> dict[str, str | None]:
    """Find the nearest gene for each probe position from gene.features.

    Processes probes per-chromosome so Postgres can use partition pruning
    and the GiST coord index on each sub-partition.

    Parameters
    ----------
    conn
        Database connection.
    build
        Genome build.
    probes
        List of probe dicts with ``chr_id`` and ``pos`` keys.

    Returns
    -------
    dict[str, str | None]
        Mapping of probe_id to nearest gene_symbol (or None if no gene nearby).
    """
    if not probes:
        return {}

    # Group probes by chromosome for partition-pruned queries.
    by_chr: dict[int, list[dict]] = defaultdict(list)
    for p in probes:
        by_chr[p["chr_id"]].append(p)

    result: dict[str, str | None] = {}

    for chr_id, chr_probes in by_chr.items():
        await conn.execute(
            "CREATE TEMP TABLE _probe_pos (probe_id text, pos int) ON COMMIT DROP"
        )
        probe_rows = [(p["probe_id"], p["pos"]) for p in chr_probes]
        await conn.copy_records_to_table(
            "_probe_pos",
            records=probe_rows,
            columns=["probe_id", "pos"],
        )

        rows = await conn.fetch(
            f"""
            SELECT pp.probe_id, g.gene_symbol
            FROM _probe_pos pp
            LEFT JOIN LATERAL (
                SELECT DISTINCT ON (gene_symbol) gene_symbol
                FROM gene.features
                WHERE build = $1::genome_build
                  AND chr_id = {int(chr_id)}
                  AND feature_type = 'gene'
                  AND coord && int4range(pp.pos - $2, pp.pos + $2)
                ORDER BY gene_symbol, ABS(start_pos - pp.pos)
                LIMIT 1
            ) g ON true
            """,
            build,
            GENE_WINDOW_BP,
        )

        await conn.execute("DROP TABLE IF EXISTS _probe_pos")

        for r in rows:
            result[r["probe_id"]] = r["gene_symbol"]

    return result


async def derive_gene_symbol(
    conn: asyncpg.Connection,
    build: str,
    chr_id: int,
    pos: int,
) -> str | None:
    """Find the nearest gene from gene.features within a 10kb window.

    Parameters
    ----------
    conn
        Database connection.
    build
        Genome build.
    chr_id
        Chromosome ID.
    pos
        0-based probe position.

    Returns
    -------
    str | None
        Nearest gene symbol, or None if no gene is nearby.
    """
    result = await conn.fetchval(
        """
        SELECT gene_symbol
        FROM gene.features
        WHERE build = $1::genome_build
          AND chr_id = $2
          AND feature_type = 'gene'
          AND coord && int4range($3 - $4, $3 + $4)
        ORDER BY ABS(start_pos - $3)
        LIMIT 1
        """,
        build,
        chr_id,
        pos,
        GENE_WINDOW_BP,
    )
    return result


# ── CpG Context Derivation ──────────────────────────────────────────────────


async def derive_cpg_contexts_batch(
    conn: asyncpg.Connection,
    build: str,
    probes: list[dict],
) -> dict[str, str | None]:
    """Derive CpG context (island/shore/shelf/open_sea) for each probe.

    First checks if the probe position overlaps a CpG island, then classifies
    by distance to the nearest island.

    Parameters
    ----------
    conn
        Database connection.
    build
        Genome build.
    probes
        List of probe dicts with ``chr_id`` and ``pos`` keys.

    Returns
    -------
    dict[str, str | None]
        Mapping of probe_id to CpG context string.
    """
    if not probes:
        return {}

    # Group probes by chromosome for partition-pruned queries.
    by_chr: dict[int, list[dict]] = defaultdict(list)
    for p in probes:
        by_chr[p["chr_id"]].append(p)

    result: dict[str, str | None] = {}

    for chr_id, chr_probes in by_chr.items():
        await conn.execute(
            "CREATE TEMP TABLE _probe_ctx (probe_id text, pos int) ON COMMIT DROP"
        )
        probe_rows = [(p["probe_id"], p["pos"]) for p in chr_probes]
        await conn.copy_records_to_table(
            "_probe_ctx",
            records=probe_rows,
            columns=["probe_id", "pos"],
        )

        # Find island overlaps and nearest island distances.
        rows = await conn.fetch(
            f"""
            SELECT
                pp.probe_id,
                pp.pos,
                isl.start_pos AS isl_start,
                isl.end_pos AS isl_end
            FROM _probe_ctx pp
            LEFT JOIN LATERAL (
                SELECT start_pos, end_pos
                FROM cpg.islands
                WHERE build = $1::genome_build
                  AND chr_id = {int(chr_id)}
                  AND coord && int4range(pp.pos - $2, pp.pos + $2)
                ORDER BY ABS(start_pos - pp.pos)
                LIMIT 1
            ) isl ON true
            """,
            build,
            SHELF_DISTANCE,
        )

        await conn.execute("DROP TABLE IF EXISTS _probe_ctx")

        for r in rows:
            probe_id = r["probe_id"]
            pos = r["pos"]
            isl_start = r["isl_start"]
            isl_end = r["isl_end"]

            if isl_start is None:
                result[probe_id] = "open_sea"
                continue

            result[probe_id] = _classify_context_from_island(pos, isl_start, isl_end)

    return result


def _classify_context_from_island(pos: int, isl_start: int, isl_end: int) -> str:
    """Classify CpG context given probe position and nearest island boundaries.

    Parameters
    ----------
    pos
        0-based probe position.
    isl_start
        Island start (0-based, inclusive).
    isl_end
        Island end (0-based, exclusive).

    Returns
    -------
    str
        One of: 'island', 'n_shore', 's_shore', 'n_shelf', 's_shelf', 'open_sea'.
    """
    # Inside island.
    if isl_start <= pos < isl_end:
        return "island"

    # Upstream (north) of island.
    if pos < isl_start:
        dist = isl_start - pos
        if dist <= SHORE_DISTANCE:
            return "n_shore"
        if dist <= SHELF_DISTANCE:
            return "n_shelf"
        return "open_sea"

    # Downstream (south) of island.
    dist = pos - isl_end + 1
    if dist <= SHORE_DISTANCE:
        return "s_shore"
    if dist <= SHELF_DISTANCE:
        return "s_shelf"
    return "open_sea"


async def derive_cpg_context(
    conn: asyncpg.Connection,
    build: str,
    chr_id: int,
    pos: int,
) -> str | None:
    """Derive CpG context for a single probe position.

    Parameters
    ----------
    conn
        Database connection.
    build
        Genome build.
    chr_id
        Chromosome ID.
    pos
        0-based probe position.

    Returns
    -------
    str | None
        CpG context string.
    """
    row = await conn.fetchrow(
        """
        SELECT start_pos, end_pos
        FROM cpg.islands
        WHERE build = $1::genome_build
          AND chr_id = $2
          AND coord && int4range($3 - $4, $3 + $4)
        ORDER BY ABS(start_pos - $3)
        LIMIT 1
        """,
        build,
        chr_id,
        pos,
        SHELF_DISTANCE,
    )

    if row is None:
        return "open_sea"

    return _classify_context_from_island(pos, row["start_pos"], row["end_pos"])


# ── Cross-Mapping ────────────────────────────────────────────────────────────


def cross_map_probes(
    platform_probes: dict[str, list[dict]],
) -> list[tuple]:
    """Cross-map probes across platforms by exact_id and coord_overlap.

    For each pair of platforms, finds probes that share either:
    - The same probe_id (method = 'exact_id', confidence = 1.0)
    - The same (chr_id, pos) (method = 'coord_overlap', confidence = 1.0)

    Parameters
    ----------
    platform_probes
        Mapping of platform name to list of probe dicts.

    Returns
    -------
    list[tuple]
        List of tuples matching ``COLUMNS_MAP_EDGES``:
        (src_platform, src_probe_id, dst_platform, dst_probe_id,
         build, chr_id, pos, method, confidence).
    """
    edges: list[tuple] = []
    platforms = sorted(platform_probes.keys())

    for i, src_plat in enumerate(platforms):
        src_probes = platform_probes[src_plat]

        # Build indices for the source platform.
        src_by_id: dict[str, dict] = {p["probe_id"]: p for p in src_probes}
        src_by_coord: dict[tuple[int, int], dict] = {
            (p["chr_id"], p["pos"]): p for p in src_probes
        }

        for dst_plat in platforms[i + 1 :]:
            dst_probes = platform_probes[dst_plat]

            # Track which pairs we've already matched to avoid duplicates.
            matched_pairs: set[tuple[str, str]] = set()

            # Pass 1: exact_id match.
            for dp in dst_probes:
                if dp["probe_id"] in src_by_id:
                    sp = src_by_id[dp["probe_id"]]
                    pair_key = (sp["probe_id"], dp["probe_id"])
                    if pair_key not in matched_pairs:
                        matched_pairs.add(pair_key)
                        # Forward edge.
                        edges.append((
                            src_plat,
                            sp["probe_id"],
                            dst_plat,
                            dp["probe_id"],
                            sp.get("build", "hg38"),
                            sp["chr_id"],
                            sp["pos"],
                            "exact_id",
                            1.0,
                        ))
                        # Reverse edge.
                        edges.append((
                            dst_plat,
                            dp["probe_id"],
                            src_plat,
                            sp["probe_id"],
                            dp.get("build", "hg38"),
                            dp["chr_id"],
                            dp["pos"],
                            "exact_id",
                            1.0,
                        ))

            # Pass 2: exact coordinate match (only for probes not matched by ID).
            for dp in dst_probes:
                coord_key = (dp["chr_id"], dp["pos"])
                if coord_key in src_by_coord:
                    sp = src_by_coord[coord_key]
                    pair_key = (sp["probe_id"], dp["probe_id"])
                    if pair_key not in matched_pairs:
                        matched_pairs.add(pair_key)
                        edges.append((
                            src_plat,
                            sp["probe_id"],
                            dst_plat,
                            dp["probe_id"],
                            sp.get("build", "hg38"),
                            sp["chr_id"],
                            sp["pos"],
                            "coord_overlap",
                            1.0,
                        ))
                        edges.append((
                            dst_plat,
                            dp["probe_id"],
                            src_plat,
                            sp["probe_id"],
                            dp.get("build", "hg38"),
                            dp["chr_id"],
                            dp["pos"],
                            "coord_overlap",
                            1.0,
                        ))

    return edges


# ── Layer Registration ───────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    platform: str,
    build: str,
) -> str:
    """Register (or retrieve) a probe manifest layer in registry.layers.

    Uses ``layer_key='probe_{platform}'`` with a build-specific version.

    Parameters
    ----------
    conn
        Admin connection.
    platform
        Probe platform (e.g. ``'epic_v2'``).
    build
        Genome build (``hg38`` or ``hg37``).

    Returns
    -------
    str
        The layer UUID.
    """
    layer_key = f"{LAYER_KEY_PREFIX}_{platform}"
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
            ($1, $2, $3, 'probe', $4,
             'derived:sesameData', 'proprietary_free_use', 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"{platform.upper()} Probes ({build})",
        build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Platform Ingestion ───────────────────────────────────────────────────────


async def ingest_platform(
    conn: asyncpg.Connection,
    build: str,
    platform: str,
    probes: list[dict],
    layer_id: str,
    *,
    derive_annotations: bool = True,
) -> int:
    """Ingest one platform's probes for one build into probe.coordinates.

    Parameters
    ----------
    conn
        Database connection with INSERT privilege on probe schema.
    build
        Genome build.
    platform
        Platform name.
    probes
        List of probe dicts for this platform.
    layer_id
        UUID of the registered layer.
    derive_annotations
        If True, derive gene_symbol and cpg_context from the database.
        Set to False for testing without DB gene/CpG data.

    Returns
    -------
    int
        Total number of rows loaded.
    """
    if not probes:
        print(f"  No probes for {platform}/{build}")
        return 0

    # Derive annotations if requested.
    gene_symbols: dict[str, str | None] = {}
    cpg_contexts: dict[str, str | None] = {}

    if derive_annotations:
        print(f"  Deriving gene symbols for {len(probes):,} probes...")
        # Process in chunks to avoid overloading the temp table.
        chunk_size = 10_000
        for i in range(0, len(probes), chunk_size):
            chunk = probes[i : i + chunk_size]
            async with conn.transaction():
                symbols = await derive_gene_symbols_batch(conn, build, chunk)
                gene_symbols.update(symbols)

        print(f"  Deriving CpG contexts for {len(probes):,} probes...")
        for i in range(0, len(probes), chunk_size):
            chunk = probes[i : i + chunk_size]
            async with conn.transaction():
                contexts = await derive_cpg_contexts_batch(conn, build, chunk)
                cpg_contexts.update(contexts)

    # Build rows for batch load.
    total_loaded = 0
    batch: list[tuple] = []

    for p in probes:
        pid = p["probe_id"]
        row = (
            layer_id,
            pid,
            build,
            p["chr_id"],
            p["pos"],
            gene_symbols.get(pid),
            cpg_contexts.get(pid),
        )
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            n = await batch_load(conn, "probe", "coordinates", batch, COLUMNS_PROBES)
            total_loaded += n
            print(f"    Loaded batch: {n} rows (total: {total_loaded:,})")
            batch = []

    if batch:
        n = await batch_load(conn, "probe", "coordinates", batch, COLUMNS_PROBES)
        total_loaded += n
        print(f"    Loaded final batch: {n} rows (total: {total_loaded:,})")

    return total_loaded


# ── Cross-Map Ingestion ──────────────────────────────────────────────────────


def deduplicate_edges(edges: list[tuple]) -> list[tuple]:
    """Remove duplicate destination edges that arise from multi-platform sources.

    When a probe_id (e.g. cg00000029) exists on multiple source platforms
    (450k and epic_v1), ``cross_map_probes`` produces separate edges from each
    source to the same destination (e.g. epic_v2/cg00000029_TC21).  This
    creates apparent duplicates when the crossmap is queried by src_probe_id
    without filtering on src_platform.

    Deduplicates on ``(src_probe_id, dst_platform, dst_probe_id, build)``,
    preferring ``exact_id`` over ``coord_overlap`` and keeping the first edge
    encountered as a tiebreaker.

    Parameters
    ----------
    edges
        List of edge tuples matching ``COLUMNS_MAP_EDGES``.

    Returns
    -------
    list[tuple]
        Deduplicated edges.
    """
    METHOD_PRIORITY = {"exact_id": 0, "coord_overlap": 1, "liftover": 2, "sequence_match": 3}

    # Key: (src_probe_id, dst_platform, dst_probe_id, build) -> best edge
    best: dict[tuple, tuple] = {}
    for edge in edges:
        _src_plat, src_id, dst_plat, dst_id, build, _chr, _pos, method, _conf = edge
        key = (src_id, dst_plat, dst_id, build)
        if key not in best:
            best[key] = edge
        else:
            existing_method = best[key][7]
            if METHOD_PRIORITY.get(method, 99) < METHOD_PRIORITY.get(existing_method, 99):
                best[key] = edge

    return list(best.values())


async def ingest_map_edges(
    conn: asyncpg.Connection,
    edges: list[tuple],
) -> int:
    """Load cross-mapping edges into probe.map_edges.

    Deduplicates edges before loading to prevent the same destination from
    appearing multiple times when queried by ``src_probe_id``.

    Parameters
    ----------
    conn
        Database connection with INSERT privilege on probe schema.
    edges
        List of edge tuples matching ``COLUMNS_MAP_EDGES``.

    Returns
    -------
    int
        Number of edges loaded.
    """
    if not edges:
        return 0

    # Deduplicate edges that share the same (src_probe_id, dst_platform,
    # dst_probe_id, build) but differ only in src_platform.
    deduped = deduplicate_edges(edges)
    if len(deduped) < len(edges):
        print(f"    Deduplicated {len(edges):,} -> {len(deduped):,} edges "
              f"({len(edges) - len(deduped):,} redundant removed)")

    total = 0
    for i in range(0, len(deduped), BATCH_SIZE):
        batch = deduped[i : i + BATCH_SIZE]
        await conn.copy_records_to_table(
            "map_edges",
            records=batch,
            columns=COLUMNS_MAP_EDGES,
            schema_name="probe",
        )
        total += len(batch)
        print(f"    Map edges: loaded batch {len(batch)} (total: {total:,})")

    return total


# ── Main Pipeline ────────────────────────────────────────────────────────────


async def main(
    builds: list[str] | None = None,
    platforms: list[str] | None = None,
    csv_path: str | Path | None = None,
) -> None:
    """Full ingestion pipeline for probe manifests.

    Parameters
    ----------
    builds
        List of builds to ingest. Defaults to ``["hg38", "hg37"]``.
    platforms
        List of platforms to ingest. Defaults to all three.
    csv_path
        Path to the manifest CSV file. If None, looks in ``data/`` directory
        for ``probe_manifest_{build}.csv``.
    """
    if builds is None:
        builds = list(BUILDS)
    if platforms is None:
        platforms = list(PLATFORMS)

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

    try:
        for build in builds:
            print(f"\n{'=' * 60}")
            print(f"Ingesting probe manifests — {build}")
            print(f"{'=' * 60}")

            # Determine CSV path.
            if csv_path is not None:
                manifest_path = Path(csv_path)
            else:
                manifest_path = DATA_DIR / f"probe_manifest_{build}.csv"

            if not manifest_path.exists():
                print(f"  ERROR: Manifest not found at {manifest_path}")
                print("  Provide --csv or place file in data/ directory.")
                continue

            # Parse full manifest.
            print(f"  Parsing {manifest_path}...")
            all_records = parse_manifest_csv(manifest_path)
            print(f"  Parsed {len(all_records):,} probe records")

            # 1. Register layers and ingest each platform.
            platform_probes: dict[str, list[dict]] = {}
            for platform in platforms:
                probes = filter_by_platform(all_records, platform)
                if not probes:
                    print(f"\n  Skipping {platform}: no probes found in manifest")
                    continue

                # Annotate with build for cross-mapping.
                for p in probes:
                    p["build"] = build

                platform_probes[platform] = probes

                print(f"\n  --- {platform} ({len(probes):,} probes) ---")

                # Register layer.
                layer_id = await register_layer(conn, platform, build)

                # Check for existing data.
                existing_count = await conn.fetchval(
                    "SELECT count(*) FROM probe.coordinates WHERE layer_id = $1",
                    layer_id,
                )
                if existing_count > 0:
                    print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                    print("  Skipping ingestion. Delete existing data first to re-ingest.")
                    continue

                # Ingest probes.
                total = await ingest_platform(conn, build, platform, probes, layer_id)
                print(f"  Total rows loaded: {total:,}")

                # Update layer stats.
                if total > 0:
                    print("  Computing content hash...")
                    content_hash = await compute_content_hash(
                        conn, "probe", "coordinates", str(layer_id)
                    )
                    await update_layer_stats(conn, str(layer_id), total, content_hash)
                    print(f"  Content hash: {content_hash[:30]}...")

            # 2. Cross-map probes across platforms.
            if len(platform_probes) >= 2:
                print(f"\n  --- Cross-mapping probes ({len(platform_probes)} platforms) ---")
                edges = cross_map_probes(platform_probes)
                print(f"  Found {len(edges):,} cross-map edges")

                if edges:
                    n_edges = await ingest_map_edges(conn, edges)
                    print(f"  Loaded {n_edges:,} map edges")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest probe manifests into probe.coordinates and probe.map_edges",
    )
    parser.add_argument(
        "--build",
        choices=BUILDS,
        default=None,
        help="Genome build to ingest (default: both hg38 and hg37)",
    )
    parser.add_argument(
        "--platform",
        choices=PLATFORMS,
        default=None,
        help="Platform to ingest (default: all three)",
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help="Path to the probe manifest CSV file",
    )
    args = parser.parse_args()

    builds = [args.build] if args.build else None
    platforms = [args.platform] if args.platform else None
    asyncio.run(main(builds=builds, platforms=platforms, csv_path=args.csv))


if __name__ == "__main__":
    cli()
