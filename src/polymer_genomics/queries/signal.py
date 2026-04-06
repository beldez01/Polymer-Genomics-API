"""Query functions for signal-level data layers.

TF binding, WGBS methylation, chromatin accessibility, and mutation density.
These tables existed in the DB and CORRELATION_REGISTRY but lacked region
query functions, so they were inaccessible via /v1/regions/ and /v1/query.
"""


def region_tf_binding_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  ctcf_gm12878, sp1_gm12878, yy1_gm12878, polr2a_gm12878,
                  ezh2_gm12878, suz12_gm12878, rest_gm12878,
                  ctcf_k562, spi1_k562, gata2_k562, runx1_k562,
                  tal1_k562, sp1_k562, polr2a_k562, ezh2_k562
           FROM regulatory.tf_binding_signal
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_tf_binding(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }


def region_wgbs_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  hsc, cmp, gmp, monocyte, neutrophil, eosinophil,
                  b_naive, b_memory, t_naive, t_memory, nk, erythroid,
                  mean_beta, beta_variance
           FROM methylation.wgbs_1kb
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_wgbs(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }


def region_accessibility_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  dnase_gm12878, dnase_k562, atac_hsc, atac_monocyte
           FROM regulatory.accessibility_signal
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_accessibility(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }


def region_mutation_density_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  pan_cancer_rate, snv_rate, indel_rate,
                  liver_rate, lung_rate, skin_rate, blood_rate
           FROM annotation.mutation_density
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_mutation_density(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }
