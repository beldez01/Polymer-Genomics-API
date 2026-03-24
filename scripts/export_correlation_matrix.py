"""Export all 1kb-windowed layers to a single Parquet file for GPU correlation analysis.

Connects to Fly.io Postgres (via fly proxy on port 5432) and JOINs all 1kb
tables on (build, chr_id, start_pos) into a single wide matrix.

Excludes tabled L2 nucleosome tracks (wrapping_energy, predicted_occupancy, etc.).

Output: correlation_matrix_hg38_1kb.parquet (~300 MB, ~3.1M rows × ~100 columns)

Usage::

    # Start proxy first:
    fly proxy 5432 -a polymer-db &

    uv run python scripts/export_correlation_matrix.py
    uv run python scripts/export_correlation_matrix.py --output /path/to/output.parquet
"""

from __future__ import annotations

import argparse
import asyncio
import os
import time

import asyncpg

# Columns from biophysics.sequence_properties to include
# (excludes tabled L2 nucleosome tracks)
BIOPHYSICS_COLUMNS = [
    # L0 core (Phase 1)
    "gc_content", "stacking_dg37", "melting_temp", "curvature",
    "groove_width", "dipole_density", "periodicity_power",
    # DNAshape
    "mgw_mean", "prot_mean", "roll_mean", "helt_mean",
    "delta_mgw", "delta_prot", "delta_roll", "delta_helt",
    # Melting / mutation
    "melting_cooperativity", "bubble_propensity", "melting_width",
    "sbs_c_to_a_ddg", "sbs_c_to_g_ddg", "sbs_c_to_t_ddg", "sbs_t_to_a_ddg",
    # Methylation perturbation (L1)
    "meth_delta_g", "meth_delta_tm",
    # Green's function (L3.5)
    "correlation_length", "integrated_response", "perturbation_reach", "response_asymmetry",
    # Extended biophysics
    "deformability", "g4_density", "g4_max_score", "kmer_complexity",
    "dinucleotide_entropy", "dominant_period",
    # Replication timing (migration 044)
    "repli_gm12878", "repli_k562",
    # Gene density (migration 045)
    "gene_density", "gene_bp_fraction", "median_tpm",
    # TE fractions (migration 048)
    "te_line_fraction", "te_sine_fraction", "te_ltr_fraction",
    "te_dna_fraction", "te_simple_fraction", "te_total_fraction",
    # Derived densities (migration 049)
    "ccre_density", "histone_h3k4me3_gm12878", "histone_h3k27me3_gm12878",
    "histone_h3k4me1_gm12878", "histone_h3k27ac_gm12878",
    "chromhmm_active_frac_e029",
]

# Conservation columns
CONSERVATION_COLUMNS = [
    "phylop_mean", "phastcons_mean", "phylop_max", "phastcons_max",
]

# Fragility columns
FRAGILITY_COLUMNS = [
    "fragility_score", "nonb_component", "curvature_component",
]

# Non-B DNA columns
NONB_COLUMNS = [
    "g4_density AS nonb_g4_density", "z_dna_density", "cruciform_density",
    "r_loop_score", "triplex_density", "total_nonb_density",
]


async def export_matrix(
    conn: asyncpg.Connection,
    build: str,
    output_path: str,
) -> int:
    """Stream-export the correlation matrix to Parquet."""
    import pyarrow as pa
    import pyarrow.parquet as pq

    bp_cols = ", ".join(f"bp.{c}" for c in BIOPHYSICS_COLUMNS)
    cons_cols = ", ".join(f"cons.{c}" for c in CONSERVATION_COLUMNS)
    frag_cols = ", ".join(f"frag.{c}" for c in FRAGILITY_COLUMNS)
    nonb_cols = ", ".join(f"nonb.{c}" for c in NONB_COLUMNS)

    # Get the layer_ids for biophysics
    bp_layer_id = await conn.fetchval("""
        SELECT id FROM registry.layers
        WHERE layer_key = 'sequence_biophysics_l0' AND genome_build = $1
        LIMIT 1
    """, build)

    query = f"""
        SELECT
            bp.chr_id,
            bp.start_pos,
            bp.end_pos,
            iso.gc_content AS isochore_gc,
            {bp_cols},
            {cons_cols},
            {frag_cols},
            {nonb_cols},
            -- TF binding
            tf.ctcf_gm12878 AS tf_ctcf_gm12878,
            tf.sp1_gm12878 AS tf_sp1_gm12878,
            tf.yy1_gm12878 AS tf_yy1_gm12878,
            tf.polr2a_gm12878 AS tf_polr2a_gm12878,
            tf.ezh2_gm12878 AS tf_ezh2_gm12878,
            tf.suz12_gm12878 AS tf_suz12_gm12878,
            tf.rest_gm12878 AS tf_rest_gm12878,
            tf.ctcf_k562 AS tf_ctcf_k562,
            tf.spi1_k562 AS tf_spi1_k562,
            tf.gata2_k562 AS tf_gata2_k562,
            tf.runx1_k562 AS tf_runx1_k562,
            tf.tal1_k562 AS tf_tal1_k562,
            tf.sp1_k562 AS tf_sp1_k562,
            tf.polr2a_k562 AS tf_polr2a_k562,
            tf.ezh2_k562 AS tf_ezh2_k562,
            -- WGBS
            wg.hsc AS wgbs_hsc,
            wg.monocyte AS wgbs_monocyte,
            wg.neutrophil AS wgbs_neutrophil,
            wg.b_naive AS wgbs_b_naive,
            wg.t_naive AS wgbs_t_naive,
            wg.nk AS wgbs_nk,
            wg.mean_beta AS wgbs_mean_beta,
            wg.beta_variance AS wgbs_beta_variance,
            -- Accessibility
            acc.dnase_gm12878,
            acc.dnase_k562,
            acc.atac_hsc,
            acc.atac_monocyte,
            -- Mutation density
            mut.pan_cancer_rate,
            mut.snv_rate,
            -- Hi-C compartment
            hic.pc1_gm12878 AS hic_pc1_gm12878
        FROM biophysics.sequence_properties bp
        LEFT JOIN conservation.scores cons
            ON cons.build = bp.build AND cons.chr_id = bp.chr_id
            AND cons.start_pos = bp.start_pos
        LEFT JOIN fragility.composite_score frag
            ON frag.build = bp.build AND frag.chr_id = bp.chr_id
            AND frag.start_pos = bp.start_pos
        LEFT JOIN fragility.nonb_dna nonb
            ON nonb.build = bp.build AND nonb.chr_id = bp.chr_id
            AND nonb.start_pos = bp.start_pos
        LEFT JOIN ref.isochores iso
            ON iso.build = bp.build AND iso.chr_id = bp.chr_id
            AND bp.coord <@ iso.coord
        LEFT JOIN regulatory.tf_binding_signal tf
            ON tf.build = bp.build AND tf.chr_id = bp.chr_id
            AND tf.start_pos = bp.start_pos
        LEFT JOIN methylation.wgbs_1kb wg
            ON wg.build = bp.build AND wg.chr_id = bp.chr_id
            AND wg.start_pos = bp.start_pos
        LEFT JOIN regulatory.accessibility_signal acc
            ON acc.build = bp.build AND acc.chr_id = bp.chr_id
            AND acc.start_pos = bp.start_pos
        LEFT JOIN annotation.mutation_density mut
            ON mut.build = bp.build AND mut.chr_id = bp.chr_id
            AND mut.start_pos = bp.start_pos
        LEFT JOIN regulatory.hic_compartment hic
            ON hic.build = bp.build AND hic.chr_id = bp.chr_id
            AND bp.coord <@ hic.coord
        WHERE bp.build = $1::genome_build
        ORDER BY bp.chr_id, bp.start_pos
    """

    print("  Executing export query (this may take several minutes)...")
    t0 = time.time()

    rows = await conn.fetch(query, build)
    elapsed = time.time() - t0
    print(f"  Query returned {len(rows):,} rows in {elapsed:.1f}s")

    if not rows:
        print("  ERROR: No rows returned.")
        return 0

    # Convert to PyArrow Table
    print("  Converting to Parquet...")
    col_names = list(rows[0].keys())
    arrays = {}
    for col in col_names:
        vals = [row[col] for row in rows]
        # Detect type from first non-None value
        sample = next((v for v in vals if v is not None), None)
        if isinstance(sample, (int,)):
            arrays[col] = pa.array(vals, type=pa.int32())
        elif isinstance(sample, (float,)):
            arrays[col] = pa.array(vals, type=pa.float32())
        else:
            arrays[col] = pa.array(vals, type=pa.float32())

    table = pa.table(arrays)

    pq.write_table(table, output_path, compression="snappy")
    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  Written: {output_path} ({size_mb:.1f} MB)")
    print(f"  Shape: {table.num_rows:,} rows × {table.num_columns} columns")

    # NaN audit
    print("\n  NaN audit:")
    for col in col_names:
        null_count = table.column(col).null_count
        frac = null_count / table.num_rows
        if frac > 0.5:
            print(f"    WARNING: {col}: {frac:.1%} null (>{50}% threshold)")
        elif frac > 0.1:
            print(f"    {col}: {frac:.1%} null")

    return table.num_rows


async def main(build: str = "hg38", output: str | None = None) -> None:
    if output is None:
        output = f"correlation_matrix_{build}_1kb.parquet"

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "polymer_genomics")
    user = os.environ.get("POSTGRES_USER", "api_reader")
    password = os.environ.get("POSTGRES_USER_PASSWORD", "api_reader_dev")

    conn = await asyncpg.connect(
        host=host, port=port, database=database, user=user, password=password,
        command_timeout=600,  # 10 minutes for the big query
    )

    try:
        print(f"\n{'='*60}")
        print(f"Correlation Matrix Export - {build}")
        print(f"{'='*60}")

        n_rows = await export_matrix(conn, build, output)
        print(f"\n  Export complete: {n_rows:,} rows")
        print("Done.")
    finally:
        await conn.close()


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Export all 1kb layers to Parquet for GPU correlation analysis",
    )
    parser.add_argument("--build", choices=["hg38", "hg37"], default="hg38")
    parser.add_argument("--output", default=None, help="Output Parquet file path")
    args = parser.parse_args()
    asyncio.run(main(args.build, args.output))


if __name__ == "__main__":
    cli()
