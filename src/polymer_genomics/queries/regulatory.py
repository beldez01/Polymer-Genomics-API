"""Regulatory elements: cCREs, chromatin state, and histone marks queries."""
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
