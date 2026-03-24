"""3D genome: Hi-C compartments, insulation scores, and TAD domains queries."""
from polymer_genomics.queries._common import db_to_api


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

def region_hic_compartment_query() -> str:
    """Hi-C A/B compartment PC1 eigenvector scores."""
    return """
        SELECT h.start_pos, h.end_pos,
               h.cell_type, h.pc1_score, h.resolution_bp
        FROM regulatory.hic_compartment h
        WHERE h.build = $1::genome_build
          AND h.chr_id = $2
          AND h.coord && int4range($3, $4)
          AND h.layer_id = $5
        ORDER BY h.start_pos
        LIMIT $6
    """


def region_insulation_score_query() -> str:
    """Diamond insulation scores from 4DN."""
    return """
        SELECT s.start_pos, s.end_pos,
               s.cell_type, s.insulation_score, s.resolution_bp
        FROM regulatory.insulation_score s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.start_pos
        LIMIT $6
    """


def region_tad_domains_query() -> str:
    """TAD domains from ENCODE Arrowhead calls."""
    return """
        SELECT t.start_pos, t.end_pos,
               t.cell_type, t.resolution_bp,
               t.corner_score, t.uvar_score, t.lvar_score
        FROM regulatory.tad_domains t
        WHERE t.build = $1::genome_build
          AND t.chr_id = $2
          AND t.coord && int4range($3, $4)
          AND t.layer_id = $5
        ORDER BY t.start_pos
        LIMIT $6
    """


# ---------------------------------------------------------------------------
# Row converter functions
# ---------------------------------------------------------------------------

def _convert_hic_compartment(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    cell_types, pc1s, resolutions = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        cell_types.append(r["cell_type"])
        pc1s.append(r["pc1_score"])
        resolutions.append(r["resolution_bp"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "cell_type": cell_types, "pc1_score": pc1s,
            "resolution_bp": resolutions,
        },
        "n": len(rows),
    }


def _convert_insulation_score(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    cell_types, scores, resolutions = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        cell_types.append(r["cell_type"])
        scores.append(r["insulation_score"])
        resolutions.append(r["resolution_bp"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "cell_type": cell_types, "insulation_score": scores,
            "resolution_bp": resolutions,
        },
        "n": len(rows),
    }


def _convert_tad_domains(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    cell_types, resolutions = [], []
    corners, uvars, lvars = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        cell_types.append(r["cell_type"])
        resolutions.append(r["resolution_bp"])
        corners.append(r["corner_score"])
        uvars.append(r["uvar_score"])
        lvars.append(r["lvar_score"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "cell_type": cell_types, "resolution_bp": resolutions,
            "corner_score": corners, "uvar_score": uvars, "lvar_score": lvars,
        },
        "n": len(rows),
    }
