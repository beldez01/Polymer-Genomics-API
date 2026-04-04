"""Regulatory elements: cCREs, chromatin state, histone marks, enhancer-gene links."""
from polymer_genomics.queries._common import db_to_api


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

def region_regulatory_query() -> str:
    """ENCODE candidate cis-Regulatory Elements (cCREs V4)."""
    return """
        SELECT r.start_pos, r.end_pos, r.accession, r.score,
               r.encode_label, r.ccre_class, r.z_score, r.description
        FROM regulatory.ccre r
        WHERE r.build = $1::genome_build
          AND r.chr_id = $2
          AND r.coord && int4range($3, $4)
          AND r.layer_id = $5
        ORDER BY r.start_pos
        LIMIT $6
    """


def region_chromatin_state_query() -> str:
    """ChromHMM 15-state chromatin segmentations (Roadmap Epigenomics)."""
    return """
        SELECT cs.start_pos, cs.end_pos,
               cs.epigenome_id, cs.epigenome_name,
               cs.state_id, cs.state_name
        FROM regulatory.chromatin_state cs
        WHERE cs.build = $1::genome_build
          AND cs.chr_id = $2
          AND cs.coord && int4range($3, $4)
          AND cs.layer_id = $5
        ORDER BY cs.start_pos
        LIMIT $6
    """


def region_histone_peaks_query() -> str:
    """ENCODE histone modification peaks."""
    return """
        SELECT hp.start_pos, hp.end_pos,
               hp.mark, hp.cell_type,
               hp.signal_value, hp.p_value, hp.q_value,
               hp.peak_offset
        FROM regulatory.histone_peaks hp
        WHERE hp.build = $1::genome_build
          AND hp.chr_id = $2
          AND hp.coord && int4range($3, $4)
          AND hp.layer_id = $5
        ORDER BY hp.start_pos
        LIMIT $6
    """


# ---------------------------------------------------------------------------
# Row converter functions
# ---------------------------------------------------------------------------

def _convert_regulatory(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    accessions, scores, labels, classes, z_scores = [], [], [], [], []
    descriptions = []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        accessions.append(r["accession"])
        scores.append(r["score"])
        labels.append(r["encode_label"])
        classes.append(r["ccre_class"])
        z_scores.append(r["z_score"])
        descriptions.append(r["description"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "accession": accessions,
            "score": scores,
            "encode_label": labels,
            "ccre_class": classes,
            "z_score": z_scores,
            "description": descriptions,
        },
        "n": len(rows),
    }


def _convert_chromatin_state(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    epi_ids, epi_names, state_ids, state_names = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        epi_ids.append(r["epigenome_id"])
        epi_names.append(r["epigenome_name"])
        state_ids.append(r["state_id"])
        state_names.append(r["state_name"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "epigenome_id": epi_ids, "epigenome_name": epi_names,
            "state_id": state_ids, "state_name": state_names,
        },
        "n": len(rows),
    }


def _convert_histone_peaks(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    marks, cell_types = [], []
    signal_values, p_values, q_values, peak_offsets = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        marks.append(r["mark"])
        cell_types.append(r["cell_type"])
        signal_values.append(r["signal_value"])
        p_values.append(r["p_value"])
        q_values.append(r["q_value"])
        peak_offsets.append(r["peak_offset"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "mark": marks, "cell_type": cell_types,
            "signal_value": signal_values, "p_value": p_values,
            "q_value": q_values, "peak_offset": peak_offsets,
        },
        "n": len(rows),
    }


# ---------------------------------------------------------------------------
# Enhancer-gene links (ABC model, Nasser et al. 2021)
# ---------------------------------------------------------------------------


def region_enhancer_gene_query() -> str:
    """ABC model enhancer-gene predictions (Nasser et al. 2021)."""
    return """
        SELECT e.start_pos, e.end_pos,
               e.target_gene, e.target_gene_tss, e.cell_type,
               e.abc_score, e.distance, e.class
        FROM regulatory.enhancer_gene_links e
        WHERE e.build = $1::genome_build
          AND e.chr_id = $2
          AND e.coord && int4range($3, $4)
          AND e.layer_id = $5
        ORDER BY e.start_pos
        LIMIT $6
    """


def _convert_enhancer_gene(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    genes, tss_list, cells, scores, dists, classes = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        genes.append(r["target_gene"])
        tss_list.append(r["target_gene_tss"])
        cells.append(r["cell_type"])
        scores.append(r["abc_score"])
        dists.append(r["distance"])
        classes.append(r["class"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "target_gene": genes, "target_gene_tss": tss_list,
            "cell_type": cells, "abc_score": scores,
            "distance": dists, "element_class": classes,
        },
        "n": len(rows),
    }


# ---------------------------------------------------------------------------
# TFBS peaks (ENCODE TF ChIP-seq)
# ---------------------------------------------------------------------------


def region_tfbs_query() -> str:
    """ENCODE transcription factor binding site peaks."""
    return """
        SELECT tp.start_pos, tp.end_pos,
               tp.tf_name, tp.cell_type,
               tp.signal_value, tp.p_value, tp.q_value,
               tp.peak_offset, tp.experiment_id
        FROM regulatory.tfbs_peaks tp
        WHERE tp.build = $1::genome_build
          AND tp.chr_id = $2
          AND tp.coord && int4range($3, $4)
          AND tp.layer_id = $5
        ORDER BY tp.start_pos
        LIMIT $6
    """


def _convert_tfbs(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    tf_names, cell_types = [], []
    signal_values, p_values, q_values, peak_offsets = [], [], [], []
    experiment_ids = []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        tf_names.append(r["tf_name"])
        cell_types.append(r["cell_type"])
        signal_values.append(r["signal_value"])
        p_values.append(r["p_value"])
        q_values.append(r["q_value"])
        peak_offsets.append(r["peak_offset"])
        experiment_ids.append(r["experiment_id"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "tf_name": tf_names, "cell_type": cell_types,
            "signal_value": signal_values, "p_value": p_values,
            "q_value": q_values, "peak_offset": peak_offsets,
            "experiment_id": experiment_ids,
        },
        "n": len(rows),
    }
