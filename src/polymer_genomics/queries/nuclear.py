"""Nuclear compartment queries: LADs, NADs, DMVs, super-enhancers."""

from polymer_genomics.queries._common import db_to_api


def region_lad_query() -> str:
    """Lamina-associated domains (Kind et al. 2015)."""
    return """
        SELECT l.start_pos, l.end_pos,
               l.lad_type, l.cell_type, l.damid_score
        FROM nuclear.lads l
        WHERE l.build = $1::genome_build
          AND l.chr_id = $2
          AND l.coord && int4range($3, $4)
          AND l.layer_id = $5
        ORDER BY l.start_pos
        LIMIT $6
    """


def _convert_lad(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    types, cells, scores = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        types.append(r["lad_type"])
        cells.append(r["cell_type"])
        scores.append(r["damid_score"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"lad_type": types, "cell_type": cells, "damid_score": scores},
        "n": len(rows),
    }


def region_nad_query() -> str:
    """Nucleolus-associated domains (Dillinger et al. 2017)."""
    return """
        SELECT n.start_pos, n.end_pos,
               n.cell_type, n.enrichment_score
        FROM nuclear.nads n
        WHERE n.build = $1::genome_build
          AND n.chr_id = $2
          AND n.coord && int4range($3, $4)
          AND n.layer_id = $5
        ORDER BY n.start_pos
        LIMIT $6
    """


def _convert_nad(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    cells, scores = [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        cells.append(r["cell_type"])
        scores.append(r["enrichment_score"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"cell_type": cells, "enrichment_score": scores},
        "n": len(rows),
    }


def region_dmv_query() -> str:
    """DNA Methylation Valleys (Xie et al. 2013)."""
    return """
        SELECT d.start_pos, d.end_pos,
               d.length_kb, d.mean_methylation, d.nearest_gene, d.developmental_tf
        FROM nuclear.dmvs d
        WHERE d.build = $1::genome_build
          AND d.chr_id = $2
          AND d.coord && int4range($3, $4)
          AND d.layer_id = $5
        ORDER BY d.start_pos
        LIMIT $6
    """


def _convert_dmv(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    lengths, meths, genes, tfs = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        lengths.append(r["length_kb"])
        meths.append(r["mean_methylation"])
        genes.append(r["nearest_gene"])
        tfs.append(r["developmental_tf"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "length_kb": lengths, "mean_methylation": meths,
            "nearest_gene": genes, "developmental_tf": tfs,
        },
        "n": len(rows),
    }


def region_super_enhancer_query() -> str:
    """Super-enhancers (dbSUPER)."""
    return """
        SELECT s.start_pos, s.end_pos,
               s.cell_type, s.se_rank, s.constituent_count,
               s.target_gene, s.h3k27ac_signal
        FROM nuclear.super_enhancers s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.start_pos
        LIMIT $6
    """


def _convert_super_enhancer(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    cells, ranks, counts, genes, signals = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        cells.append(r["cell_type"])
        ranks.append(r["se_rank"])
        counts.append(r["constituent_count"])
        genes.append(r["target_gene"])
        signals.append(r["h3k27ac_signal"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "cell_type": cells, "se_rank": ranks, "constituent_count": counts,
            "target_gene": genes, "h3k27ac_signal": signals,
        },
        "n": len(rows),
    }
