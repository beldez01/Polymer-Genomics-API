"""Gene profile ingestion — computes layered feature profiles from existing DB tables.

No external files needed. Everything is derived from gene.features, conservation,
biophysics, regulatory, expression, and bioenergetics schemas.

Usage::

    uv run python -m polymer_genomics.ingest.gene_profiles
    uv run python -m polymer_genomics.ingest.gene_profiles --build hg38 --force
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import math
import os

import asyncpg

log = logging.getLogger(__name__)

BATCH_SIZE = 5_000

# ── Layer dimension definitions ──────────────────────────────────────────────

INTRINSIC_DIMS = [
    "loeuf", "mis_z", "phylop_body", "phastcons_body", "gc_body", "gene_length_log_kb",
]
REGULATORY_DIMS = [
    "promoter_is_cpg_island", "promoter_ccre_count", "distal_ccre_density",
]
EXPRESSION_DIMS = [
    "tau", "log_median_tpm", "log_robust_max_tpm", "n_tissues_detected",
]
PROTEIN_DIMS = [
    "log_max_ppm", "frac_expensive_aa", "ecpa_b20",
]

ALL_LAYERS = {
    "intrinsic": INTRINSIC_DIMS,
    "regulatory": REGULATORY_DIMS,
    "expression": EXPRESSION_DIMS,
    "protein": PROTEIN_DIMS,
}

VERSION_TAG = "gene_profile_v1.0"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _zscore_and_percentile(values: list[float | None]) -> tuple[list[float | None], list[float | None]]:
    """Compute z-scores and percentile ranks, ignoring Nones."""
    valid = [v for v in values if v is not None]
    if len(valid) < 2:
        return [None] * len(values), [None] * len(values)

    mean = sum(valid) / len(valid)
    variance = sum((v - mean) ** 2 for v in valid) / (len(valid) - 1)
    std = math.sqrt(variance) if variance > 0 else 1.0

    z_scores = []
    for v in values:
        if v is None:
            z_scores.append(None)
        else:
            z_scores.append((v - mean) / std)

    # Percentile rank: fraction of valid values <= this value * 100
    sorted_valid = sorted(valid)
    n_valid = len(sorted_valid)

    def _pct(v):
        if v is None:
            return None
        # Count values <= v
        count = 0
        for sv in sorted_valid:
            if sv <= v:
                count += 1
            else:
                break
        return (count / n_valid) * 100.0

    percentiles = [_pct(v) for v in values]
    return z_scores, percentiles


# ── Layer registration ───────────────────────────────────────────────────────


async def register_layer(conn: asyncpg.Connection, build: str) -> str:
    layer_key = "gene_profile_v1"
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
            ($1, $2, $3, 'gene_profile', $4,
             'derived:gene.features+conservation+expression+bioenergetics',
             'public_domain', 'postgres', true, true)
        RETURNING id
        """,
        layer_key, version,
        f"Gene Profiles ({build})", build,
    )
    print(f"  Registered layer: {layer_key} v{version} -> {layer_id}")
    return layer_id


# ── Gene universe ────────────────────────────────────────────────────────────


async def build_gene_universe(conn: asyncpg.Connection, build: str) -> list[dict]:
    """Fetch all protein-coding genes from gene.features."""
    rows = await conn.fetch(
        """
        SELECT DISTINCT gene_id, gene_symbol, chr_id,
               MIN(start_pos) as start_pos, MAX(end_pos) as end_pos, strand
        FROM gene.features
        WHERE build = $1::genome_build
          AND feature_type = 'gene'
          AND gene_id IS NOT NULL
        GROUP BY gene_id, gene_symbol, chr_id, strand
        """,
        build,
    )
    genes = []
    for r in rows:
        length_bp = (r["end_pos"] - r["start_pos"]) if (r["end_pos"] and r["start_pos"]) else None
        tss = None
        if r["start_pos"] is not None and r["end_pos"] is not None:
            tss = r["start_pos"] if r["strand"] == "+" else r["end_pos"]
        genes.append({
            "gene_id": r["gene_id"],
            "gene_symbol": r["gene_symbol"],
            "chr_id": r["chr_id"],
            "start_pos": r["start_pos"],
            "end_pos": r["end_pos"],
            "strand": r["strand"],
            "length_bp": length_bp,
            "tss": tss,
        })
    print(f"  Gene universe: {len(genes):,} genes")
    return genes


# ── Intrinsic layer ──────────────────────────────────────────────────────────


async def fetch_intrinsic_layer(
    conn: asyncpg.Connection, build: str, genes: list[dict],
) -> dict[str, dict]:
    """Returns {gene_id: {loeuf, mis_z, phylop_body, phastcons_body, gc_body, gene_length_log_kb}}."""
    # Constraint data (by symbol)
    constraint_rows = await conn.fetch(
        "SELECT gene_symbol, loeuf, mis_z FROM conservation.gene_constraint WHERE build = $1::genome_build",
        build,
    )
    constraint_by_sym = {}
    for r in constraint_rows:
        sym = r["gene_symbol"]
        if sym:
            constraint_by_sym[sym.upper()] = {"loeuf": r["loeuf"], "mis_z": r["mis_z"]}

    # GC content per gene — bulk-load per chromosome, compute overlaps in-memory
    gc_by_gene = {}
    genes_by_chr: dict[int, list[dict]] = {}
    for g in genes:
        if g["chr_id"] is not None and g["start_pos"] is not None and g["end_pos"] is not None:
            genes_by_chr.setdefault(g["chr_id"], []).append(g)

    for chr_id, chr_genes in genes_by_chr.items():
        try:
            # Bulk-load all 1kb bins for this chromosome
            bins = await conn.fetch(
                """
                SELECT start_pos, end_pos, gc_content
                FROM biophysics.sequence_properties
                WHERE build = $1::genome_build AND chr_id = $2
                ORDER BY start_pos
                """,
                build, chr_id,
            )
            if not bins:
                continue
            # Build sorted arrays for fast overlap
            bin_starts = [r["start_pos"] for r in bins]
            bin_ends = [r["end_pos"] for r in bins]
            bin_gc = [float(r["gc_content"]) if r["gc_content"] is not None else None for r in bins]

            import bisect
            for g in chr_genes:
                gs, ge = g["start_pos"], g["end_pos"]
                # Find overlapping bins via bisect
                lo = bisect.bisect_right(bin_ends, gs) - 1
                hi = bisect.bisect_left(bin_starts, ge) + 1
                lo = max(0, lo)
                hi = min(len(bins), hi)
                gc_vals = [bin_gc[i] for i in range(lo, hi)
                           if bin_gc[i] is not None
                           and bin_starts[i] < ge and bin_ends[i] > gs]
                if gc_vals:
                    gc_by_gene[g["gene_id"]] = sum(gc_vals) / len(gc_vals)
            print(f"    chr{chr_id}: {len(bins):,} bins, {len(chr_genes):,} genes")
        except Exception as e:
            log.warning("GC query failed for chr_id=%s: %s", chr_id, e)

    result = {}
    for g in genes:
        sym = (g["gene_symbol"] or "").upper()
        c = constraint_by_sym.get(sym, {})
        length_log_kb = None
        if g["length_bp"] and g["length_bp"] > 0:
            length_log_kb = math.log2(g["length_bp"] / 1000)
        result[g["gene_id"]] = {
            "loeuf": float(c["loeuf"]) if c.get("loeuf") is not None else None,
            "mis_z": float(c["mis_z"]) if c.get("mis_z") is not None else None,
            "phylop_body": None,  # requires per-base conservation aggregation; deferred
            "phastcons_body": None,
            "gc_body": gc_by_gene.get(g["gene_id"]),
            "gene_length_log_kb": length_log_kb,
        }
    print(f"  Intrinsic layer: {sum(1 for v in result.values() if v.get('loeuf') is not None):,} with constraint")
    return result


# ── Regulatory layer ─────────────────────────────────────────────────────────


async def fetch_regulatory_layer(
    conn: asyncpg.Connection, build: str, genes: list[dict],
) -> dict[str, dict]:
    """Returns {gene_id: {promoter_is_cpg_island, promoter_ccre_count, distal_ccre_density}}."""
    import bisect

    # Bulk-load CGI and cCRE data per chromosome, compute overlaps in-memory
    genes_by_chr: dict[int, list[dict]] = {}
    for g in genes:
        if g["chr_id"] is not None:
            genes_by_chr.setdefault(g["chr_id"], []).append(g)

    result = {}

    for chr_id, chr_genes in genes_by_chr.items():
        # Bulk-load CGIs
        cgi_starts, cgi_ends = [], []
        try:
            cgi_rows = await conn.fetch(
                "SELECT start_pos, end_pos FROM cpg.islands WHERE build = $1::genome_build AND chr_id = $2 ORDER BY start_pos",
                build, chr_id,
            )
            cgi_starts = [r["start_pos"] for r in cgi_rows]
            cgi_ends = [r["end_pos"] for r in cgi_rows]
        except Exception as e:
            log.warning("CGI bulk load failed chr_id=%s: %s", chr_id, e)

        # Bulk-load cCREs
        ccre_starts, ccre_ends = [], []
        try:
            ccre_rows = await conn.fetch(
                "SELECT start_pos, end_pos FROM regulatory.ccre WHERE build = $1::genome_build AND chr_id = $2 ORDER BY start_pos",
                build, chr_id,
            )
            ccre_starts = [r["start_pos"] for r in ccre_rows]
            ccre_ends = [r["end_pos"] for r in ccre_rows]
        except Exception as e:
            log.warning("cCRE bulk load failed chr_id=%s: %s", chr_id, e)

        def _count_overlaps(starts, ends, qstart, qend):
            """Count intervals in [starts,ends] overlapping [qstart,qend)."""
            lo = max(0, bisect.bisect_right(ends, qstart) - 1)
            hi = min(len(starts), bisect.bisect_left(starts, qend) + 1)
            return sum(1 for i in range(lo, hi) if starts[i] < qend and ends[i] > qstart)

        for g in chr_genes:
            tss = g["tss"]
            vals = {"promoter_is_cpg_island": None, "promoter_ccre_count": None, "distal_ccre_density": None}

            if tss is not None:
                # CGI at promoter (TSS +/- 500)
                if cgi_starts:
                    vals["promoter_is_cpg_island"] = 1.0 if _count_overlaps(cgi_starts, cgi_ends, tss - 500, tss + 500) > 0 else 0.0

                # Promoter cCREs (TSS +/- 2000)
                if ccre_starts:
                    vals["promoter_ccre_count"] = float(_count_overlaps(ccre_starts, ccre_ends, tss - 2000, tss + 2000))

            # Distal cCRE density
            if g["start_pos"] is not None and g["end_pos"] is not None and g["length_bp"] and g["length_bp"] > 0 and ccre_starts:
                body_count = _count_overlaps(ccre_starts, ccre_ends, g["start_pos"], g["end_pos"])
                vals["distal_ccre_density"] = float(body_count) / (g["length_bp"] / 1000)

            result[g["gene_id"]] = vals

        print(f"    chr{chr_id}: {len(cgi_starts)} CGIs, {len(ccre_starts)} cCREs, {len(chr_genes)} genes")

    # Fill genes with no chr_id
    for g in genes:
        if g["gene_id"] not in result:
            result[g["gene_id"]] = {"promoter_is_cpg_island": None, "promoter_ccre_count": None, "distal_ccre_density": None}

    print(f"  Regulatory layer: {len(result):,} genes")
    return result


# ── Expression layer ─────────────────────────────────────────────────────────


async def fetch_expression_layer(
    conn: asyncpg.Connection, build: str, genes: list[dict],
) -> dict[str, dict]:
    """Returns {gene_id: {tau, log_median_tpm, log_robust_max_tpm, n_tissues_detected}}."""
    # Discover tissue columns dynamically
    try:
        col_rows = await conn.fetch(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'expression' AND table_name = 'gene_tpm'
              AND column_name NOT IN ('id', 'layer_id', 'build', 'gene_id', 'gene_symbol',
                  'chr_id', 'start_pos', 'end_pos', 'coord', 'strand',
                  'median_tpm', 'max_tpm', 'max_tissue', 'n_tissues_detected')
            ORDER BY ordinal_position
            """
        )
        tissue_cols = [r["column_name"] for r in col_rows]
    except Exception as e:
        log.warning("Could not discover expression columns: %s", e)
        return {g["gene_id"]: {d: None for d in EXPRESSION_DIMS} for g in genes}

    if not tissue_cols:
        return {g["gene_id"]: {d: None for d in EXPRESSION_DIMS} for g in genes}

    # Build select list
    col_list = ", ".join(tissue_cols)
    expr_rows = await conn.fetch(
        f"SELECT gene_id, {col_list} FROM expression.gene_tpm WHERE build = $1::genome_build",
        build,
    )

    expr_by_gene = {}
    for r in expr_rows:
        tpms = []
        for c in tissue_cols:
            v = r[c]
            if v is not None:
                tpms.append(float(v))
        if not tpms:
            continue
        expr_by_gene[r["gene_id"]] = tpms

    result = {}
    for g in genes:
        # gene.features uses versioned ENSG (e.g. ENSG00000223972.6),
        # expression.gene_tpm uses unversioned (ENSG00000223972)
        ensg_base = g["gene_id"].split(".")[0] if g["gene_id"] else g["gene_id"]
        tpms = expr_by_gene.get(ensg_base)
        if not tpms or len(tpms) < 2:
            result[g["gene_id"]] = {d: None for d in EXPRESSION_DIMS}
            continue

        xmax = max(tpms)
        n_tissues = len(tpms)

        # Tau (tissue specificity)
        if xmax > 0:
            tau = sum(1 - (xi / xmax) for xi in tpms) / (n_tissues - 1)
        else:
            tau = None

        sorted_tpms = sorted(tpms, reverse=True)
        median_tpm = sorted(tpms)[len(tpms) // 2]
        robust_max = sum(sorted_tpms[:3]) / min(3, len(sorted_tpms))
        n_detected = sum(1 for t in tpms if t > 1.0)

        result[g["gene_id"]] = {
            "tau": tau,
            "log_median_tpm": math.log2(median_tpm + 1),
            "log_robust_max_tpm": math.log2(robust_max + 1),
            "n_tissues_detected": float(n_detected),
        }

    # Fill missing genes
    for g in genes:
        if g["gene_id"] not in result:
            result[g["gene_id"]] = {d: None for d in EXPRESSION_DIMS}

    print(f"  Expression layer: {sum(1 for v in result.values() if v.get('tau') is not None):,} with expression data")
    return result


# ── Protein layer ────────────────────────────────────────────────────────────


async def fetch_protein_layer(
    conn: asyncpg.Connection, build: str, genes: list[dict],
) -> dict[str, dict]:
    """Returns {gene_id: {log_max_ppm, frac_expensive_aa, ecpa_b20}}."""
    # Build symbol -> gene_id crosswalk
    sym_to_id: dict[str, str] = {}
    for g in genes:
        if g["gene_symbol"]:
            sym_to_id[g["gene_symbol"].upper()] = g["gene_id"]

    # PaxDb max abundance
    paxdb_by_sym: dict[str, float] = {}
    try:
        paxdb_rows = await conn.fetch(
            """
            SELECT gene_symbol, MAX(abundance_ppm) as max_ppm
            FROM bioenergetics.protein_abundance
            WHERE build = $1::genome_build
            GROUP BY gene_symbol
            """,
            build,
        )
        for r in paxdb_rows:
            if r["gene_symbol"]:
                paxdb_by_sym[r["gene_symbol"].upper()] = float(r["max_ppm"]) if r["max_ppm"] else 0.0
    except Exception as e:
        log.warning("PaxDb query failed: %s", e)

    # Gene costs
    cost_by_sym: dict[str, dict] = {}
    try:
        cost_rows = await conn.fetch(
            """
            SELECT gene_symbol, ecpa_b20, frac_expensive, frac_very_expensive
            FROM bioenergetics.gene_costs
            WHERE build = $1::genome_build
            """,
            build,
        )
        for r in cost_rows:
            if r["gene_symbol"]:
                frac_exp = 0.0
                if r["frac_expensive"] is not None:
                    frac_exp += float(r["frac_expensive"])
                if r["frac_very_expensive"] is not None:
                    frac_exp += float(r["frac_very_expensive"])
                cost_by_sym[r["gene_symbol"].upper()] = {
                    "ecpa_b20": float(r["ecpa_b20"]) if r["ecpa_b20"] is not None else None,
                    "frac_expensive_aa": frac_exp,
                }
    except Exception as e:
        log.warning("Gene costs query failed: %s", e)

    result = {}
    for g in genes:
        sym = (g["gene_symbol"] or "").upper()
        max_ppm = paxdb_by_sym.get(sym)
        cost = cost_by_sym.get(sym, {})

        result[g["gene_id"]] = {
            "log_max_ppm": math.log2(max_ppm + 1) if max_ppm is not None else None,
            "frac_expensive_aa": cost.get("frac_expensive_aa"),
            "ecpa_b20": cost.get("ecpa_b20"),
        }

    print(f"  Protein layer: {sum(1 for v in result.values() if v.get('ecpa_b20') is not None):,} with cost data")
    return result


# ── Statistics + anomalies ───────────────────────────────────────────────────


def compute_layer_statistics(
    genes: list[dict],
    layer_data: dict[str, dict],
    dim_names: list[str],
) -> dict[str, dict]:
    """Compute z-scores, percentiles, norm, and missingness for a layer.

    Returns {gene_id: {raw_values, z_scores, percentiles, missingness, norm, n_present}}.
    """
    # Collect per-dimension vectors across all genes
    gene_ids = [g["gene_id"] for g in genes]
    per_dim_values: dict[str, list[float | None]] = {d: [] for d in dim_names}

    for gid in gene_ids:
        gdata = layer_data.get(gid, {})
        for d in dim_names:
            per_dim_values[d].append(gdata.get(d))

    # Compute z-scores and percentiles per dimension
    per_dim_z: dict[str, list[float | None]] = {}
    per_dim_pct: dict[str, list[float | None]] = {}
    for d in dim_names:
        z, pct = _zscore_and_percentile(per_dim_values[d])
        per_dim_z[d] = z
        per_dim_pct[d] = pct

    # Assemble per-gene results
    result = {}
    for i, gid in enumerate(gene_ids):
        raw = [per_dim_values[d][i] for d in dim_names]
        z = [per_dim_z[d][i] for d in dim_names]
        pct = [per_dim_pct[d][i] for d in dim_names]
        missing = [v is None for v in raw]

        # L2 norm (NaN -> 0)
        z_for_norm = [zv if zv is not None else 0.0 for zv in z]
        norm = math.sqrt(sum(v ** 2 for v in z_for_norm))
        n_present = sum(1 for m in missing if not m)

        result[gid] = {
            "raw_values": [v if v is not None else float("nan") for v in raw],
            "z_scores": [v if v is not None else float("nan") for v in z],
            "percentiles": [v if v is not None else float("nan") for v in pct],
            "missingness": missing,
            "norm": norm,
            "n_present": n_present,
        }
    return result


def detect_tail_anomalies(
    genes: list[dict],
    layer_stats: dict[str, dict],
    dim_names: list[str],
    layer_name: str,
) -> list[dict]:
    """Find dimensions with |z| > 2.0."""
    anomalies = []
    for g in genes:
        gid = g["gene_id"]
        stats = layer_stats.get(gid)
        if not stats:
            continue
        for j, d in enumerate(dim_names):
            z = stats["z_scores"][j]
            if math.isnan(z):
                continue
            if abs(z) > 2.0:
                anomalies.append({
                    "gene_id": gid,
                    "layer_name": layer_name,
                    "dimension": d,
                    "score": z,
                    "percentile": stats["percentiles"][j] if not math.isnan(stats["percentiles"][j]) else None,
                    "direction": "high" if z > 0 else "low",
                })
    return anomalies


# ── Bulk insert ──────────────────────────────────────────────────────────────


async def bulk_insert(
    conn: asyncpg.Connection,
    layer_id: str,
    build: str,
    genes: list[dict],
    all_layer_stats: dict[str, dict[str, dict]],
    all_anomalies: list[dict],
    force: bool = False,
) -> None:
    """Insert gene_identity, layer_vectors, anomalies, and metadata."""

    if force:
        print("  --force: deleting existing profile data for this layer...")
        await conn.execute("DELETE FROM profiles.anomalies WHERE layer_id = $1", layer_id)
        await conn.execute("DELETE FROM profiles.layer_vectors WHERE layer_id = $1", layer_id)
        await conn.execute("DELETE FROM profiles.profile_metadata WHERE layer_id = $1", layer_id)

    # 1. Upsert gene_identity
    print("  Inserting gene_identity...")
    identity_records = []
    for g in genes:
        identity_records.append((
            build, g["gene_id"], g["gene_symbol"],
            g["chr_id"], g["start_pos"], g["end_pos"],
            g["strand"], g["length_bp"],
        ))
    # Batch upsert using a temp table + COPY for speed over remote connections
    async with conn.transaction():
        await conn.execute("""
            CREATE TEMP TABLE _gi_staging (
                build text, ensembl_gene_id text, gene_symbol text,
                chr_id smallint, start_pos int, end_pos int,
                strand text, gene_length_bp int
            ) ON COMMIT DROP
        """)
        await conn.copy_records_to_table(
            "_gi_staging", records=identity_records,
            columns=["build", "ensembl_gene_id", "gene_symbol", "chr_id",
                     "start_pos", "end_pos", "strand", "gene_length_bp"],
        )
        await conn.execute("""
            INSERT INTO profiles.gene_identity
                (build, ensembl_gene_id, gene_symbol, chr_id, start_pos, end_pos, strand, gene_length_bp)
            SELECT build::genome_build, ensembl_gene_id, gene_symbol, chr_id, start_pos, end_pos,
                   strand::char(1), gene_length_bp
            FROM _gi_staging
            ON CONFLICT (build, ensembl_gene_id) DO NOTHING
        """)
    print(f"    Upserted {len(identity_records):,} gene identities")

    # Build gene_id -> identity PK mapping
    id_rows = await conn.fetch(
        "SELECT id, ensembl_gene_id FROM profiles.gene_identity WHERE build = $1::genome_build",
        build,
    )
    ensg_to_pk = {r["ensembl_gene_id"]: r["id"] for r in id_rows}

    # 2. Insert layer_vectors via COPY
    print("  Inserting layer_vectors...")
    lv_columns = [
        "gene_id", "layer_id", "layer_name",
        "dimension_names", "raw_values", "z_scores", "percentiles",
        "missingness", "norm", "n_dimensions", "n_present",
    ]
    total_lv = 0
    for layer_name, dim_names in ALL_LAYERS.items():
        stats = all_layer_stats[layer_name]
        batch = []
        for g in genes:
            gid = g["gene_id"]
            pk = ensg_to_pk.get(gid)
            if pk is None:
                continue
            s = stats.get(gid)
            if s is None:
                continue
            batch.append((
                pk, layer_id, layer_name,
                dim_names,
                s["raw_values"], s["z_scores"], s["percentiles"],
                s["missingness"], s["norm"],
                len(dim_names), s["n_present"],
            ))
            if len(batch) >= BATCH_SIZE:
                await conn.copy_records_to_table(
                    "layer_vectors", records=batch, columns=lv_columns,
                    schema_name="profiles",
                )
                total_lv += len(batch)
                batch = []
        if batch:
            await conn.copy_records_to_table(
                "layer_vectors", records=batch, columns=lv_columns,
                schema_name="profiles",
            )
            total_lv += len(batch)
    print(f"    Inserted {total_lv:,} layer_vector rows")

    # 3. Insert anomalies via COPY
    print("  Inserting anomalies...")
    anom_columns = [
        "gene_id", "layer_id", "anomaly_type", "layer_name",
        "dimension", "score", "percentile", "direction",
    ]
    anom_batch = []
    total_anom = 0
    for a in all_anomalies:
        pk = ensg_to_pk.get(a["gene_id"])
        if pk is None:
            continue
        anom_batch.append((
            pk, layer_id, "tail", a["layer_name"],
            a["dimension"], a["score"], a["percentile"], a["direction"],
        ))
        if len(anom_batch) >= BATCH_SIZE:
            await conn.copy_records_to_table(
                "anomalies", records=anom_batch, columns=anom_columns,
                schema_name="profiles",
            )
            total_anom += len(anom_batch)
            anom_batch = []
    if anom_batch:
        await conn.copy_records_to_table(
            "anomalies", records=anom_batch, columns=anom_columns,
            schema_name="profiles",
        )
        total_anom += len(anom_batch)
    print(f"    Inserted {total_anom:,} anomaly rows")

    # 4. Insert profile_metadata
    import json
    dim_manifest = {
        layer_name: dims for layer_name, dims in ALL_LAYERS.items()
    }
    await conn.execute(
        """
        INSERT INTO profiles.profile_metadata
            (layer_id, build, version_tag, n_genes, dimension_manifest, provenance)
        VALUES ($1, $2::genome_build, $3, $4, $5::jsonb, $6::jsonb)
        """,
        layer_id, build, VERSION_TAG, len(genes),
        json.dumps(dim_manifest),
        json.dumps({
            "sources": [
                "gene.features", "conservation.gene_constraint",
                "biophysics.sequence_properties", "cpg.islands",
                "regulatory.ccre", "expression.gene_tpm",
                "bioenergetics.protein_abundance", "bioenergetics.gene_costs",
            ],
            "z_threshold": 2.0,
        }),
    )
    print("    Inserted profile_metadata")


# ── Main ─────────────────────────────────────────────────────────────────────


async def main(builds: list[str] | None = None, force: bool = False) -> None:
    if builds is None:
        builds = ["hg38"]

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_ADMIN_USER", "admin")
    password = os.environ.get("POSTGRES_PASSWORD", "dev_password")

    conn = await asyncpg.connect(
        host=host, port=port, database=database,
        user=user, password=password,
    )

    try:
        for build in builds:
            print(f"\n{'=' * 60}")
            print(f"Computing gene profiles - {build}")
            print(f"{'=' * 60}")

            # 1. Register layer
            layer_id = await register_layer(conn, build)

            # 2. Check existing data
            if not force:
                existing = await conn.fetchval(
                    "SELECT count(*) FROM profiles.layer_vectors WHERE layer_id = $1",
                    layer_id,
                )
                if existing and existing > 0:
                    print(f"  WARNING: {existing:,} rows already exist. Use --force to re-compute.")
                    continue

            # 3. Build gene universe
            genes = await build_gene_universe(conn, build)
            if not genes:
                print("  No genes found. Skipping.")
                continue

            # 4. Fetch all layers
            print("  Fetching intrinsic layer...")
            intrinsic_data = await fetch_intrinsic_layer(conn, build, genes)
            print("  Fetching regulatory layer...")
            regulatory_data = await fetch_regulatory_layer(conn, build, genes)
            print("  Fetching expression layer...")
            expression_data = await fetch_expression_layer(conn, build, genes)
            print("  Fetching protein layer...")
            protein_data = await fetch_protein_layer(conn, build, genes)

            layer_raw = {
                "intrinsic": intrinsic_data,
                "regulatory": regulatory_data,
                "expression": expression_data,
                "protein": protein_data,
            }

            # 5. Compute statistics
            print("  Computing statistics...")
            all_layer_stats = {}
            all_anomalies = []
            for layer_name, dim_names in ALL_LAYERS.items():
                stats = compute_layer_statistics(genes, layer_raw[layer_name], dim_names)
                all_layer_stats[layer_name] = stats
                anomalies = detect_tail_anomalies(genes, stats, dim_names, layer_name)
                all_anomalies.extend(anomalies)

            print(f"  Total anomalies detected: {len(all_anomalies):,}")

            # 6. Bulk insert
            print("  Bulk inserting...")
            await bulk_insert(conn, layer_id, build, genes, all_layer_stats, all_anomalies, force=force)

            print(f"\n  Gene profiles complete for {build}.")

        print("\nDone.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Compute and ingest gene profiles into profiles schema",
    )
    parser.add_argument(
        "--build", choices=["hg38", "hg37"], default=None,
        help="Genome build (default: hg38 only)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Delete existing profile data and recompute",
    )
    args = parser.parse_args()
    builds = [args.build] if args.build else None
    asyncio.run(main(builds, force=args.force))


if __name__ == "__main__":
    cli()
