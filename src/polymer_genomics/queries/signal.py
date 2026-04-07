"""Query functions for signal-level data layers.

TF binding, WGBS methylation, chromatin accessibility, and mutation density.
"""

from polymer_genomics.coordinates import db_to_api


def region_tf_binding_query() -> str:
    return """
        SELECT start_pos, end_pos,
               ctcf_gm12878, sp1_gm12878, yy1_gm12878, polr2a_gm12878,
               ezh2_gm12878, suz12_gm12878, rest_gm12878,
               ctcf_k562, spi1_k562, gata2_k562, runx1_k562,
               tal1_k562, sp1_k562, polr2a_k562, ezh2_k562
        FROM regulatory.tf_binding_signal
        WHERE build = $1::genome_build AND chr_id = $2
          AND coord && int4range($3, $4) AND layer_id = $5
        ORDER BY start_pos LIMIT $6
    """


def _convert_tf_binding(rows: list, chr_name: str) -> dict:
    starts, ends, widths, mcols_data = [], [], [], {}
    signal_cols = None
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        if signal_cols is None:
            signal_cols = [k for k in r.keys() if k not in ("start_pos", "end_pos")]
            for c in signal_cols:
                mcols_data[c] = []
        for c in signal_cols:
            mcols_data[c].append(float(r[c]) if r[c] is not None else None)
    return {
        "seqnames": [chr_name] * len(starts),
        "ranges.start": starts,
        "ranges.end": ends,
        "ranges.width": widths,
        "strand": ["*"] * len(starts),
        "mcols": mcols_data,
        "n": len(starts),
    }


def region_wgbs_query() -> str:
    return """
        SELECT start_pos, end_pos,
               hsc, cmp, gmp, monocyte, neutrophil, eosinophil,
               b_naive, b_memory, t_naive, t_memory, nk, erythroid,
               mean_beta, beta_variance
        FROM methylation.wgbs_1kb
        WHERE build = $1::genome_build AND chr_id = $2
          AND coord && int4range($3, $4) AND layer_id = $5
        ORDER BY start_pos LIMIT $6
    """


def _convert_wgbs(rows: list, chr_name: str) -> dict:
    starts, ends, widths, mcols_data = [], [], [], {}
    signal_cols = None
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        if signal_cols is None:
            signal_cols = [k for k in r.keys() if k not in ("start_pos", "end_pos")]
            for c in signal_cols:
                mcols_data[c] = []
        for c in signal_cols:
            mcols_data[c].append(float(r[c]) if r[c] is not None else None)
    return {
        "seqnames": [chr_name] * len(starts),
        "ranges.start": starts,
        "ranges.end": ends,
        "ranges.width": widths,
        "strand": ["*"] * len(starts),
        "mcols": mcols_data,
        "n": len(starts),
    }


def region_accessibility_query() -> str:
    return """
        SELECT start_pos, end_pos,
               dnase_gm12878, dnase_k562, atac_hsc, atac_monocyte
        FROM regulatory.accessibility_signal
        WHERE build = $1::genome_build AND chr_id = $2
          AND coord && int4range($3, $4) AND layer_id = $5
        ORDER BY start_pos LIMIT $6
    """


def _convert_accessibility(rows: list, chr_name: str) -> dict:
    starts, ends, widths, mcols_data = [], [], [], {}
    signal_cols = None
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        if signal_cols is None:
            signal_cols = [k for k in r.keys() if k not in ("start_pos", "end_pos")]
            for c in signal_cols:
                mcols_data[c] = []
        for c in signal_cols:
            mcols_data[c].append(float(r[c]) if r[c] is not None else None)
    return {
        "seqnames": [chr_name] * len(starts),
        "ranges.start": starts,
        "ranges.end": ends,
        "ranges.width": widths,
        "strand": ["*"] * len(starts),
        "mcols": mcols_data,
        "n": len(starts),
    }


def region_mutation_density_query() -> str:
    return """
        SELECT start_pos, end_pos,
               pan_cancer_rate, snv_rate, indel_rate,
               liver_rate, lung_rate, skin_rate, blood_rate
        FROM annotation.mutation_density
        WHERE build = $1::genome_build AND chr_id = $2
          AND coord && int4range($3, $4) AND layer_id = $5
        ORDER BY start_pos LIMIT $6
    """


def _convert_mutation_density(rows: list, chr_name: str) -> dict:
    starts, ends, widths, mcols_data = [], [], [], {}
    signal_cols = None
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        if signal_cols is None:
            signal_cols = [k for k in r.keys() if k not in ("start_pos", "end_pos")]
            for c in signal_cols:
                mcols_data[c] = []
        for c in signal_cols:
            mcols_data[c].append(float(r[c]) if r[c] is not None else None)
    return {
        "seqnames": [chr_name] * len(starts),
        "ranges.start": starts,
        "ranges.end": ends,
        "ranges.width": widths,
        "strand": ["*"] * len(starts),
        "mcols": mcols_data,
        "n": len(starts),
    }
