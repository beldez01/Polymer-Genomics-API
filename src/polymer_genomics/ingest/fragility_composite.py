"""Composite fragility score computation.

Combines non-B DNA density, curvature, stacking instability, and breakpoint
proximity into a single fragility score per 1kb window.

F(x) = 0.35*nonb + 0.25*curvature + 0.25*stacking + 0.15*bp_proximity

Each component is normalized to [0,1] using per-chromosome percentile rank.
"""

from __future__ import annotations

import math


# ── Weights ──────────────────────────────────────────────────────────────────

WEIGHTS = {
    "nonb": 0.35,
    "curvature": 0.25,
    "stacking": 0.25,
    "bp_prox": 0.15,
}

# Breakpoint proximity decay: half-life at 500kb
BP_DECAY_HALFLIFE = 500_000  # bp


def normalize_component(values: list[float]) -> list[float]:
    """Normalize values to [0, 1] using min-max scaling.

    Returns list of same length with values in [0, 1].
    Handles edge case where all values are identical (returns all 0.0).
    """
    if not values:
        return []
    vmin = min(values)
    vmax = max(values)
    span = vmax - vmin
    if span == 0:
        return [0.0] * len(values)
    return [(v - vmin) / span for v in values]


def compute_breakpoint_proximity(
    start: int,
    end: int,
    breakpoints: list[tuple[int, int]],
) -> float:
    """Compute proximity score to nearest breakpoint.

    Uses exponential decay: score = exp(-d * ln(2) / half_life)
    where d = distance to nearest breakpoint edge.

    Returns value in [0, 1] where 1 = at breakpoint, 0 = far away.
    """
    if not breakpoints:
        return 0.0

    mid = (start + end) // 2
    min_dist = float("inf")

    for bp_start, bp_end in breakpoints:
        if bp_start <= mid <= bp_end:
            return 1.0  # inside breakpoint
        dist = min(abs(mid - bp_start), abs(mid - bp_end))
        min_dist = min(min_dist, dist)

    decay = math.log(2) / BP_DECAY_HALFLIFE
    return math.exp(-decay * min_dist)


def compute_fragility_score(
    nonb: float,
    curvature: float,
    stacking: float,
    bp_prox: float,
) -> float:
    """Weighted composite fragility score. All inputs should be [0,1]."""
    return (
        WEIGHTS["nonb"] * nonb
        + WEIGHTS["curvature"] * curvature
        + WEIGHTS["stacking"] * stacking
        + WEIGHTS["bp_prox"] * bp_prox
    )


def classify_fragility(score: float) -> str:
    """Classify fragility score into qualitative category."""
    if score >= 0.8:
        return "extreme"
    if score >= 0.6:
        return "high"
    if score >= 0.3:
        return "moderate"
    return "low"


# ── Ingestion ────────────────────────────────────────────────────────────────


async def ingest_fragility_composite(
    conn,
    build: str = "hg38",
    batch_size: int = 5000,
):
    """Compute and insert composite fragility scores for all chromosomes.

    Queries non-B DNA density, biophysics (curvature + stacking), and
    breakpoint coordinates from existing tables, then normalises per
    chromosome, computes the weighted composite, and bulk-inserts into
    ``fragility.composite_score``.
    """
    from polymer_genomics.constants import CHR_NAME_TO_ID

    # ── Ensure 'fragility' layer_type exists ─────────────────────────────
    has_fragility = await conn.fetchval(
        "SELECT EXISTS ("
        "  SELECT 1 FROM pg_enum "
        "  WHERE enumtypid = 'layer_type'::regtype "
        "    AND enumlabel = 'fragility'"
        ")"
    )
    if not has_fragility:
        await conn.execute(
            "ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'fragility'"
        )
        # Must commit for enum value to be visible in same session
        await conn.execute("COMMIT")

    # ── Resolve or register layer ────────────────────────────────────────
    layer_id = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'fragility_composite'"
    )
    if layer_id is None:
        layer_id = await conn.fetchval(
            """INSERT INTO registry.layers
               (layer_key, version, name, layer_type, genome_build,
                source, license_class, storage_type, row_count,
                is_active, is_default, evidence_class, tier,
                equilibrium_regime, statefulness, validation_status,
                interpretability, is_composite)
               VALUES ('fragility_composite', '1.0', 'Composite Fragility Score',
                       'fragility', $1::genome_build,
                       'Derived: non-B DNA + biophysics + breakpoints',
                       'derived', 'postgres', 0, true, true,
                       'D', 'intrinsic', 'equilibrium', 'reference_static',
                       'internally_validated', 'mechanistic', true)
               ON CONFLICT (layer_key, version) DO UPDATE SET name = EXCLUDED.name
               RETURNING id""",
            build,
        )

    # ── Get biophysics layer_id (needed for queries) ─────────────────────
    bio_layer_id = await conn.fetchval(
        "SELECT id FROM registry.layers "
        "WHERE layer_key = 'sequence_biophysics_l0' AND is_default = true"
    )
    if bio_layer_id is None:
        raise RuntimeError("No default sequence_biophysics_l0 layer found")

    nonb_layer_id = await conn.fetchval(
        "SELECT id FROM registry.layers WHERE layer_key = 'nonb_dna' AND is_default = true"
    )
    if nonb_layer_id is None:
        raise RuntimeError("No default nonb_dna layer found")

    chroms = sorted(CHR_NAME_TO_ID.keys(), key=lambda c: CHR_NAME_TO_ID[c])
    total_inserted = 0

    for chrom in chroms:
        chr_id = CHR_NAME_TO_ID[chrom]
        print(f"  {chrom}: ", end="", flush=True)

        # 1. Non-B DNA density per 1kb window
        nonb_rows = await conn.fetch(
            "SELECT start_pos, end_pos, total_nonb_density "
            "FROM fragility.nonb_dna "
            "WHERE build = $1::genome_build AND chr_id = $2 AND layer_id = $3 "
            "ORDER BY start_pos",
            build, chr_id, nonb_layer_id,
        )
        if not nonb_rows:
            print("no nonb_dna rows, skipping")
            continue

        # Build lookup: start_pos -> row data
        nonb_by_start = {r["start_pos"]: r for r in nonb_rows}

        # 2. Biophysics: curvature + stacking_dg37 per 1kb window
        bio_rows = await conn.fetch(
            "SELECT start_pos, curvature, stacking_dg37 "
            "FROM biophysics.sequence_properties "
            "WHERE build = $1::genome_build AND chr_id = $2 AND layer_id = $3 "
            "ORDER BY start_pos",
            build, chr_id, bio_layer_id,
        )
        bio_by_start = {r["start_pos"]: r for r in bio_rows}

        # 3. Breakpoints for this chromosome
        bp_rows = await conn.fetch(
            "SELECT start_pos, end_pos FROM fragility.breakpoints "
            "WHERE build = $1::genome_build AND chr_id = $2",
            build, chr_id,
        )
        breakpoints = [(r["start_pos"], r["end_pos"]) for r in bp_rows]

        # Use the intersection of nonb and biophysics windows
        common_starts = sorted(set(nonb_by_start.keys()) & set(bio_by_start.keys()))
        if not common_starts:
            print("no overlapping windows, skipping")
            continue

        # Collect raw values for per-chromosome normalisation
        raw_nonb = []
        raw_curvature = []
        raw_stacking = []
        window_info = []  # (start_pos, end_pos)

        for start in common_starts:
            nr = nonb_by_start[start]
            br = bio_by_start[start]

            nonb_val = float(nr["total_nonb_density"]) if nr["total_nonb_density"] is not None else 0.0
            curv_val = float(br["curvature"]) if br["curvature"] is not None else 0.0
            stack_val = float(br["stacking_dg37"]) if br["stacking_dg37"] is not None else 0.0

            raw_nonb.append(nonb_val)
            raw_curvature.append(curv_val)
            raw_stacking.append(stack_val)
            window_info.append((start, int(nr["end_pos"])))

        # 4. Normalise components to [0,1]
        norm_nonb = normalize_component(raw_nonb)
        norm_curvature = normalize_component(raw_curvature)

        # Invert stacking: more negative = more stable = LESS fragile
        # So fragility_stacking = max(stacking) - stacking (per chr)
        stacking_max = max(raw_stacking) if raw_stacking else 0.0
        inverted_stacking = [stacking_max - v for v in raw_stacking]
        norm_stacking = normalize_component(inverted_stacking)

        # 5-6. Compute breakpoint proximity, fragility score, classification
        batch: list[tuple] = []
        for i, (start, end) in enumerate(window_info):
            bp_prox = compute_breakpoint_proximity(start, end, breakpoints)

            score = compute_fragility_score(
                norm_nonb[i],
                norm_curvature[i],
                norm_stacking[i],
                bp_prox,
            )
            fclass = classify_fragility(score)

            batch.append((
                layer_id, build, chr_id, start, end,
                norm_nonb[i], norm_curvature[i], norm_stacking[i],
                bp_prox, score, fclass,
            ))

            # 7. Bulk insert in batches
            if len(batch) >= batch_size:
                await conn.executemany(
                    """INSERT INTO fragility.composite_score
                       (layer_id, build, chr_id, start_pos, end_pos,
                        nonb_component, curvature_component, stacking_component,
                        breakpoint_proximity, fragility_score, fragility_class)
                       VALUES ($1, $2::genome_build, $3, $4, $5,
                               $6, $7, $8, $9, $10, $11)""",
                    batch,
                )
                total_inserted += len(batch)
                batch.clear()

        if batch:
            await conn.executemany(
                """INSERT INTO fragility.composite_score
                   (layer_id, build, chr_id, start_pos, end_pos,
                    nonb_component, curvature_component, stacking_component,
                    breakpoint_proximity, fragility_score, fragility_class)
                   VALUES ($1, $2::genome_build, $3, $4, $5,
                           $6, $7, $8, $9, $10, $11)""",
                batch,
            )
            total_inserted += len(batch)
            batch.clear()

        print(f"{len(window_info)} windows inserted")

    # Update row count in registry
    await conn.execute(
        "UPDATE registry.layers SET row_count = $1 WHERE id = $2",
        total_inserted, layer_id,
    )

    return total_inserted


# ── CLI entry point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import asyncio


    from polymer_genomics.ingest._connection import get_ingest_connection
    from polymer_genomics.ingest._transaction import ingest_transaction

    parser = argparse.ArgumentParser(
        description="Compute and ingest composite fragility scores"
    )
    parser.add_argument("--build", default="hg38", help="Genome build (default: hg38)")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--db", default=None)
    parser.add_argument("--user", default=None)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    async def main():
        conn = await get_ingest_connection(
            admin=True,
            host=args.host, port=args.port,
            database=args.db, user=args.user, password=args.password,
        )
        try:
            async with ingest_transaction(conn):
                total = await ingest_fragility_composite(conn, build=args.build)
            print(f"\nTotal rows inserted: {total:,}")
        finally:
            await conn.close()

    asyncio.run(main())
