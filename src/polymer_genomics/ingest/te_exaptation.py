"""TE exaptation catalog — derived from RepeatMasker x ENCODE cCRE overlap.

A "domesticated" or "exapted" TE is a transposable element co-opted by the
host genome to serve a regulatory function. We detect these computationally
by finding TEs (annotation.repeats) that overlap ENCODE cCREs (regulatory.ccre).

No external data download required: this module queries existing DB tables
and writes derived results into evolution.te_exaptation.

Usage::

    uv run python -m polymer_genomics.ingest.te_exaptation
"""

from __future__ import annotations

import asyncio

import asyncpg

from polymer_genomics.constants import CHR_ID_TO_NAME
from polymer_genomics.ingest._connection import get_ingest_connection
from polymer_genomics.ingest._transaction import ingest_transaction

# ── Constants ────────────────────────────────────────────────────────────────

BATCH_SIZE = 10_000

COLUMNS: list[str] = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "te_name", "te_family", "te_age_mya",
    "regulatory_function", "target_gene", "evidence", "source_study",
]

# Map cCRE class to regulatory function
CCRE_TO_FUNCTION: dict[str, str] = {
    "PLS": "promoter",
    "pELS": "enhancer",
    "dELS": "enhancer",
    "CTCF-only": "insulator",
    "DNase-H3K4me3": "promoter",
}

# Per-chromosome overlap query. Runs against existing DB tables.
# Excludes simple/low-complexity/satellite repeats (not true TEs).
_OVERLAP_SQL = """
SELECT r.chr_id, r.start_pos, r.end_pos,
       r.repeat_name, r.repeat_family, r.repeat_class,
       r.estimated_age_mya,
       c.ccre_class, c.encode_label
FROM annotation.repeats r
JOIN regulatory.ccre c
  ON r.build = c.build AND r.chr_id = c.chr_id AND r.coord && c.coord
WHERE r.build = 'hg38'::genome_build
  AND c.build = 'hg38'::genome_build
  AND r.chr_id = $1
  AND r.repeat_class NOT IN ('Simple_repeat', 'Low_complexity', 'Satellite')
"""

EVIDENCE = "computational"
SOURCE_STUDY = "ENCODE cCRE v4 \u00d7 RepeatMasker overlap"
STATEMENT_TIMEOUT_MS = 300_000  # 5 min per chromosome query (shared-cpu DB is slow)


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    """Register or retrieve the te_exaptation layer."""
    layer_key = "te_exaptation_encode_v1"
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
           VALUES ($1, $2, $3, 'te_exaptation', $4,
                   'ENCODE cCRE v4 \u00d7 RepeatMasker overlap (computational)',
                   'open_access', 'postgres', true, true)
           RETURNING id""",
        layer_key, version, f"TE Exaptation Catalog ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Row building ─────────────────────────────────────────────────────────────


def _build_row(layer_id: str, build: str, rec: asyncpg.Record) -> tuple:
    """Convert a query result record into a COPY-compatible tuple."""
    ccre_class = rec["ccre_class"] or ""
    regulatory_function = CCRE_TO_FUNCTION.get(ccre_class, ccre_class.lower() or None)

    return (
        layer_id,
        build,
        rec["chr_id"],
        rec["start_pos"],
        rec["end_pos"],
        rec["repeat_name"],       # te_name
        rec["repeat_family"],     # te_family
        rec["estimated_age_mya"], # te_age_mya (may be None)
        regulatory_function,
        None,                     # target_gene (skip for speed)
        EVIDENCE,
        SOURCE_STUDY,
    )


# ── Per-chromosome ingestion ─────────────────────────────────────────────────


async def ingest_chromosome(
    conn: asyncpg.Connection,
    chr_id: int,
    layer_id: str,
    build: str,
) -> int:
    """Query overlaps for one chromosome and COPY results into te_exaptation."""
    chr_name = CHR_ID_TO_NAME.get(chr_id, f"chr{chr_id}")

    # Set a generous timeout for the overlap join
    await conn.execute(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}")

    try:
        records = await conn.fetch(_OVERLAP_SQL, chr_id)
    finally:
        # Reset timeout for COPY operations
        await conn.execute("SET statement_timeout = 0")

    if not records:
        print(f"    {chr_name}: 0 overlaps")
        return 0

    # Build rows and COPY in batches
    loaded = 0
    batch: list[tuple] = []

    for rec in records:
        batch.append(_build_row(layer_id, build, rec))
        if len(batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "te_exaptation", records=batch,
                columns=COLUMNS, schema_name="evolution",
            )
            loaded += len(batch)
            batch = []

    if batch:
        await conn.copy_records_to_table(
            "te_exaptation", records=batch,
            columns=COLUMNS, schema_name="evolution",
        )
        loaded += len(batch)

    print(f"    {chr_name}: {loaded:,} exapted TEs")
    return loaded


# ── Main ─────────────────────────────────────────────────────────────────────


async def main() -> None:
    build = "hg38"

    conn = await get_ingest_connection(admin=True)
    try:
        print(f"\n{'='*60}")
        print(f"TE Exaptation Catalog - {build}")
        print(f"{'='*60}")

        layer_id = await register_layer(conn, build)

        # Idempotency check
        existing = await conn.fetchval(
            "SELECT count(*) FROM evolution.te_exaptation WHERE layer_id = $1",
            layer_id,
        )
        if existing > 0:
            print(f"  WARNING: {existing:,} rows already exist. Skipping.")
            print("  To re-ingest, DELETE rows and remove the layer first.")
            return

        # Verify source tables have data
        repeat_count = await conn.fetchval(
            "SELECT count(*) FROM annotation.repeats WHERE build = 'hg38'::genome_build"
        )
        ccre_count = await conn.fetchval(
            "SELECT count(*) FROM regulatory.ccre WHERE build = 'hg38'::genome_build"
        )
        print(f"  Source: {repeat_count:,} repeats, {ccre_count:,} cCREs")

        if repeat_count == 0 or ccre_count == 0:
            print("  ERROR: Source tables are empty. Ingest repeats and cCREs first.")
            return

        # Process chromosome by chromosome (no wrapping transaction — each chr auto-commits)
        grand_total = 0

        for chr_id in range(1, 26):  # chr1-22, X(23), Y(24), M(25)
            try:
                count = await ingest_chromosome(conn, chr_id, layer_id, build)
                grand_total += count
            except Exception as e:
                print(f"    chr{chr_id} FAILED: {e} — skipping")
                # Reset connection state if in failed transaction
                try:
                    await conn.execute("SELECT 1")
                except Exception:
                    # Connection is in failed state — reconnect
                    await conn.close()
                    conn = await get_ingest_connection(admin=True)
                continue

        # Summary
        print(f"\n  Total exapted TEs loaded: {grand_total:,}")

        if grand_total > 0:
            # Print family breakdown
            family_counts = await conn.fetch("""
                SELECT te_family, count(*) as n
                FROM evolution.te_exaptation
                WHERE layer_id = $1
                GROUP BY te_family
                ORDER BY n DESC
                LIMIT 10
            """, layer_id)
            print("\n  Top TE families:")
            for row in family_counts:
                print(f"    {row['te_family'] or 'unknown':>15s}: {row['n']:>8,}")

            # Print regulatory function breakdown
            func_counts = await conn.fetch("""
                SELECT regulatory_function, count(*) as n
                FROM evolution.te_exaptation
                WHERE layer_id = $1
                GROUP BY regulatory_function
                ORDER BY n DESC
            """, layer_id)
            print("\n  Regulatory functions:")
            for row in func_counts:
                print(f"    {row['regulatory_function'] or 'unknown':>15s}: {row['n']:>8,}")

        print("\nDone.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
