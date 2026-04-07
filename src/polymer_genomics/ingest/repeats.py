"""RepeatMasker repeat element ingestion into annotation.repeats.

Supports three input modes:
1. UCSC rmsk.txt (legacy, non-commercial license) — tab-separated, no header
2. Polymer-computed TSV (MIT-licensable) — header row, from run_repeatmasker.sh
3. Dfam streaming (--stream-dfam) — streams pre-computed CC0 annotations from
   dfam.org with zero local disk usage. Fetches family classifications from the
   Dfam API for proper repeat_class/repeat_family mapping.

Usage::

    uv run python -m polymer_genomics.ingest.repeats
    uv run python -m polymer_genomics.ingest.repeats --build hg38
    uv run python -m polymer_genomics.ingest.repeats --stream-dfam
    REPEATMASKER_TSV=data/repeatmasker_hg38.tsv uv run python -m polymer_genomics.ingest.repeats
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg

from polymer_genomics.constants import CHR_NAME_TO_ID
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

# Column list matching CREATE TABLE order (minus id and coord which are generated)
COLUMNS: list[str] = [
    "layer_id", "build",
    "chr_id", "start_pos", "end_pos",
    "strand",
    "repeat_name", "repeat_class", "repeat_family",
    "sw_score", "divergence_pct", "deletion_pct", "insertion_pct",
]


# ── TSV reader ──────────────────────────────────────────────────────────────


def _detect_format(tsv_path: str | Path) -> str:
    """Auto-detect whether file is UCSC rmsk.txt or Polymer-computed TSV."""
    with open(tsv_path) as f:
        first_line = f.readline().rstrip("\n")
    if first_line.startswith("chr\t") or first_line.startswith("chr\tstart"):
        return "polymer_tsv"
    return "ucsc_rmsk"


def read_repeatmasker(tsv_path: str | Path) -> tuple[list[dict], str]:
    """Parse a RepeatMasker file (auto-detects format).

    Returns a list of dicts with fields matching the COLUMNS order, plus
    the detected format string ('ucsc_rmsk' or 'polymer_tsv').
    Coordinates are 0-based half-open.
    """
    fmt = _detect_format(tsv_path)
    if fmt == "polymer_tsv":
        return _read_polymer_tsv(tsv_path), fmt
    return _read_ucsc_rmsk(tsv_path), fmt


def _read_polymer_tsv(tsv_path: str | Path) -> list[dict]:
    """Parse Polymer-computed RepeatMasker TSV (from run_repeatmasker.sh)."""
    rows: list[dict] = []
    skipped = 0

    with open(tsv_path) as f:
        header = f.readline()  # skip header
        for line_num, line in enumerate(f, 2):
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            fields = line.split("\t")
            if len(fields) < 11:
                skipped += 1
                continue

            chrom = fields[0]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue

            try:
                rows.append({
                    "chr_id": chr_id,
                    "start_pos": int(fields[1]),
                    "end_pos": int(fields[2]),
                    "strand": fields[3],
                    "repeat_name": fields[4],
                    "repeat_class": fields[5],
                    "repeat_family": fields[6],
                    "sw_score": int(fields[7]),
                    "divergence_pct": float(fields[8]),
                    "deletion_pct": float(fields[9]),
                    "insertion_pct": float(fields[10]),
                })
            except (ValueError, IndexError):
                skipped += 1
                continue

            if line_num % 1_000_000 == 0:
                print(f"    Read {line_num:,} lines ({len(rows):,} kept)...")

    if skipped > 0:
        print(f"  Skipped {skipped:,} malformed lines")
    return rows


def _read_ucsc_rmsk(tsv_path: str | Path) -> list[dict]:
    """Parse the UCSC RepeatMasker dump file (rmsk.txt, no header).

    Returns a list of dicts with fields matching the COLUMNS order.
    Coordinates are 0-based half-open (UCSC format = internal format).
    """
    rows: list[dict] = []
    skipped = 0

    with open(tsv_path) as f:
        for line_num, line in enumerate(f, 1):
            if line.startswith("#"):
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 17:
                skipped += 1
                continue

            chrom = fields[5]
            chr_id = CHR_NAME_TO_ID.get(chrom)
            if chr_id is None:
                continue  # skip alt/random/Un chromosomes

            try:
                start_pos = int(fields[6])   # already 0-based
                end_pos = int(fields[7])     # already half-open
                sw_score = int(fields[1])
                milli_div = int(fields[2])
                milli_del = int(fields[3])
                milli_ins = int(fields[4])
            except (ValueError, IndexError):
                skipped += 1
                continue

            # Strand: UCSC uses '+' or 'C' (complement) -> normalize to '+'/'-'
            raw_strand = fields[9].strip()
            strand = "-" if raw_strand == "C" else raw_strand

            rows.append({
                "chr_id": chr_id,
                "start_pos": start_pos,
                "end_pos": end_pos,
                "strand": strand,
                "repeat_name": fields[10],
                "repeat_class": fields[11],
                "repeat_family": fields[12],
                "sw_score": sw_score,
                "divergence_pct": milli_div / 10.0,
                "deletion_pct": milli_del / 10.0,
                "insertion_pct": milli_ins / 10.0,
            })

            if line_num % 1_000_000 == 0:
                print(f"    Read {line_num:,} lines ({len(rows):,} kept)...")

    if skipped > 0:
        print(f"  Skipped {skipped:,} malformed lines")
    return rows


# ── Dfam streaming ─────────────────────────────────────────────────────────

DFAM_NRPH_URL = (
    "https://www.dfam.org/releases/Dfam_3.8/annotations/hg38/hg38.nrph.hits.gz"
)
DFAM_API_FAMILIES = "https://www.dfam.org/api/families?format=summary&limit=1000&start={offset}"


def _fetch_dfam_classifications() -> dict[str, tuple[str, str]]:
    """Fetch family name -> (repeat_class, repeat_family) from Dfam API.

    Paginates through all ~23K families. Returns a dict mapping family
    name (e.g. 'AluY') to (type, subtype) (e.g. ('SINE', 'Alu')).
    """
    import json
    from urllib.request import urlopen

    lookup: dict[str, tuple[str, str]] = {}
    offset = 0

    while True:
        url = DFAM_API_FAMILIES.format(offset=offset)
        resp = urlopen(url)  # noqa: S310
        data = json.loads(resp.read())
        results = data.get("results", [])
        if not results:
            break
        for r in results:
            name = r.get("name", "")
            rtype = r.get("repeat_type_name") or "Unknown"
            rsubtype = r.get("repeat_subtype_name") or rtype
            lookup[name] = (rtype, rsubtype)
        offset += 1000
        if offset % 5000 == 0:
            print(f"    Fetched {offset} / {data.get('total_count', '?')} families...")
        if offset >= data.get("total_count", 0):
            break

    print(f"  Dfam classification lookup: {len(lookup):,} families")
    return lookup


async def ingest_dfam_streaming(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    classifications: dict[str, tuple[str, str]],
) -> int:
    """Stream Dfam nrph annotations from URL and ingest directly."""
    import gzip
    from urllib.request import urlopen

    print(f"  Streaming from {DFAM_NRPH_URL}...")
    resp = urlopen(DFAM_NRPH_URL)  # noqa: S310
    stream = gzip.open(resp, "rt")

    total_loaded = 0
    skipped = 0
    unknown_families: set[str] = set()
    batch: list[tuple] = []

    for line_num, line in enumerate(stream, 1):
        if line.startswith("#"):
            continue
        fields = line.rstrip("\n").split("\t")
        if len(fields) < 15:
            skipped += 1
            continue

        chrom = fields[0]
        chr_id = CHR_NAME_TO_ID.get(chrom)
        if chr_id is None:
            continue

        family_name = fields[2]
        bits = float(fields[3])
        strand = fields[8]
        ali_start = int(fields[9])
        ali_end = int(fields[10])
        kimura_div = float(fields[14])

        # Ensure start < end (Dfam uses 1-based; minus strand has start > end)
        if ali_start > ali_end:
            ali_start, ali_end = ali_end, ali_start
        # Convert to 0-based half-open
        start_pos = ali_start - 1
        end_pos = ali_end

        # Classify
        repeat_class, repeat_family = classifications.get(
            family_name, ("Unknown", "Unknown")
        )
        if family_name not in classifications:
            unknown_families.add(family_name)

        batch.append((
            layer_id, build,
            chr_id, start_pos, end_pos,
            strand,
            family_name, repeat_class, repeat_family,
            int(bits), kimura_div, 0.0, 0.0,  # deletion_pct/insertion_pct not in nrph
        ))

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "repeats",
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
            "repeats",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)

    stream.close()

    if skipped:
        print(f"  Skipped {skipped:,} malformed lines")
    if unknown_families:
        print(f"  {len(unknown_families)} families not in Dfam lookup (set to Unknown)")

    print(f"  Total rows loaded: {total_loaded:,}")
    return total_loaded


# ── Layer registration ──────────────────────────────────────────────────────


async def register_layer(
    conn: asyncpg.Connection,
    build: str,
    *,
    source: str = "computed_repeatmasker_dfam",
    license_class: str = "cc0_1_0",
) -> str:
    """Register (or retrieve) the RepeatMasker layer."""
    layer_key = "repeatmasker_v1"
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
            ($1, $2, $3, 'repeat', $4,
             $5, $6, 'postgres', true, true)
        RETURNING id
        """,
        layer_key,
        version,
        f"RepeatMasker Repeat Elements ({build})",
        build,
        source,
        license_class,
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
        rec["repeat_name"], rec["repeat_class"], rec["repeat_family"],
        rec["sw_score"], rec["divergence_pct"], rec["deletion_pct"], rec["insertion_pct"],
    )


async def ingest_build(
    conn: asyncpg.Connection,
    build: str,
    layer_id: str,
    tsv_path: str | Path,
) -> int:
    """Read rmsk.txt, bulk-load into annotation.repeats."""
    print(f"  Reading RepeatMasker file: {tsv_path}")
    records, fmt = read_repeatmasker(tsv_path)
    print(f"  Parsed {len(records):,} repeat elements (format: {fmt})")

    total_loaded = 0
    batch: list[tuple] = []

    for rec in records:
        row = _build_row(layer_id, build, rec)
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "repeats",
                records=batch,
                columns=COLUMNS,
                schema_name="annotation",
            )
            total_loaded += len(batch)
            if total_loaded % 100_000 == 0:
                print(f"    Loaded {total_loaded:,} rows...")
            batch = []

    # Flush remaining
    if batch:
        await conn.copy_records_to_table(
            "repeats",
            records=batch,
            columns=COLUMNS,
            schema_name="annotation",
        )
        total_loaded += len(batch)
        print(f"    Loaded final batch: {len(batch)} rows (total: {total_loaded:,})")

    return total_loaded


# ── Main ────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None, *, stream_dfam: bool = False) -> None:
    """Connect and ingest RepeatMasker data."""
    if builds is None:
        builds = ["hg38"]

    if stream_dfam:
        # Phase 1: Fetch classifications before DB connection.
        print("\n" + "=" * 60)
        print("Fetching Dfam family classifications (no DB connection yet)")
        print("=" * 60)
        classifications = _fetch_dfam_classifications()

        # Phase 2: Connect and ingest.
        conn = await get_ingest_connection(admin=True)
        try:
            for build in builds:
                print(f"\n{'='*60}")
                print(f"Streaming Dfam repeat annotations - {build}")
                print(f"  (CC0 licensed, zero disk usage)")
                print(f"{'='*60}")

                layer_id = await register_layer(
                    conn, build, source="Dfam_3.8_nrph_CC0", license_class="cc0_1_0",
                )

                existing_count = await conn.fetchval(
                    "SELECT count(*) FROM annotation.repeats WHERE layer_id = $1",
                    layer_id,
                )
                if existing_count > 0:
                    print(f"  WARNING: {existing_count:,} rows already exist.")
                    print("  Skipping. Delete existing data first to re-ingest.")
                    continue

                async with ingest_transaction(conn):
                    total = await ingest_dfam_streaming(conn, build, layer_id, classifications)
                print(f"\n  Total repeat element rows loaded: {total:,}")

            print("\nDone.")
        finally:
            await conn.close()
        return

    tsv_path = os.environ.get(
        "REPEATMASKER_TSV",
        "/Users/zbb2/Desktop/Research/data/ucsc/rmsk.txt",
    )

    if not Path(tsv_path).exists():
        print(f"ERROR: RepeatMasker file not found at {tsv_path}")
        print("Set REPEATMASKER_TSV environment variable to the correct path.")
        return

    conn = await get_ingest_connection(admin=True)

    try:
        # Detect format upfront for license classification.
        fmt = _detect_format(tsv_path)
        if fmt == "polymer_tsv":
            source = "computed_repeatmasker_dfam"
            license_class = "cc0_1_0"
            print(f"  Detected Polymer-computed TSV (license: CC0)")
        else:
            source = "UCSC_RepeatMasker"
            license_class = "non_commercial"
            print(f"  Detected UCSC rmsk.txt (license: non-commercial)")

        for build in builds:
            print(f"\n{'='*60}")
            print(f"Ingesting RepeatMasker repeat elements - {build}")
            print(f"{'='*60}")

            # 1. Register layer
            layer_id = await register_layer(
                conn, build, source=source, license_class=license_class,
            )

            # 2. Check for existing data
            existing_count = await conn.fetchval(
                "SELECT count(*) FROM annotation.repeats WHERE layer_id = $1",
                layer_id,
            )
            if existing_count > 0:
                print(f"  WARNING: {existing_count:,} rows already exist for this layer.")
                print("  Skipping ingestion. Delete existing data first to re-ingest.")
                continue

            # 3. Ingest
            async with ingest_transaction(conn):
                total = await ingest_build(conn, build, layer_id, tsv_path)
            print(f"\n  Total repeat element rows loaded: {total:,}")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest RepeatMasker repeat elements into annotation.repeats",
    )
    parser.add_argument(
        "--build",
        choices=["hg38", "hg37"],
        default=None,
        help="Genome build (default: hg38 only)",
    )
    parser.add_argument(
        "--stream-dfam",
        action="store_true",
        help="Stream pre-computed CC0 annotations from dfam.org (no local disk needed)",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds, stream_dfam=args.stream_dfam))


if __name__ == "__main__":
    cli()
