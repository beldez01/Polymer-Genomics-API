"""TCGA Pan-Cancer methylation queries: tumor vs normal delta-betas."""

from polymer_genomics.queries._common import db_to_api


def region_tcga_methylation_query() -> str:
    """TCGA Pan-Cancer methylation summaries (delta-beta per probe per cancer type)."""
    return """
        SELECT tc.start_pos, tc.end_pos,
               tc.probe_id, tc.cancer_type,
               tc.n_tumor, tc.n_normal,
               tc.mean_tumor, tc.mean_normal,
               tc.delta_beta, tc.p_value, tc.fdr,
               tc.direction
        FROM methylation.tcga_pan_cancer tc
        WHERE tc.build = $1::genome_build
          AND tc.chr_id = $2
          AND tc.coord && int4range($3, $4)
          AND tc.layer_id = $5
        ORDER BY tc.start_pos
        LIMIT $6
    """


def _convert_tcga_methylation(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    probe_ids, cancer_types = [], []
    n_tumors, n_normals = [], []
    mean_tumors, mean_normals = [], []
    delta_betas, p_values, fdrs = [], [], []
    directions = []

    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        probe_ids.append(r["probe_id"])
        cancer_types.append(r["cancer_type"])
        n_tumors.append(r["n_tumor"])
        n_normals.append(r["n_normal"])
        mean_tumors.append(r["mean_tumor"])
        mean_normals.append(r["mean_normal"])
        delta_betas.append(r["delta_beta"])
        p_values.append(r["p_value"])
        fdrs.append(r["fdr"])
        directions.append(r["direction"])

    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "probe_id": probe_ids,
            "cancer_type": cancer_types,
            "n_tumor": n_tumors,
            "n_normal": n_normals,
            "mean_tumor": mean_tumors,
            "mean_normal": mean_normals,
            "delta_beta": delta_betas,
            "p_value": p_values,
            "fdr": fdrs,
            "direction": directions,
        },
        "n": len(rows),
    }
