"""Gene features, probe coordinates, and biosynthetic cost queries."""
from polymer_genomics.queries._common import db_to_api


def region_gene_features_query() -> str:
    return """
        SELECT g.start_pos, g.end_pos, g.strand, g.gene_symbol,
               g.gene_id, g.transcript_id, g.feature_type
        FROM gene.features g
        WHERE g.build = $1::genome_build
          AND g.chr_id = $2
          AND g.coord && int4range($3, $4)
          AND g.layer_id = $5
        ORDER BY g.start_pos
        LIMIT $6
    """


def region_probe_coordinates_query() -> str:
    return """
        SELECT p.probe_id, p.pos, p.pos + 1 AS end_pos,
               p.gene_symbol, p.cpg_context
        FROM probe.coordinates p
        WHERE p.build = $1::genome_build
          AND p.chr_id = $2
          AND p.coord && int4range($3, $4)
          AND p.layer_id = $5
        ORDER BY p.pos
        LIMIT $6
    """


def region_gene_costs_query() -> str:
    """Gene bioenergetic cost metrics (Akashi-Gojobori, CAI, GTEx EWGC)."""
    return """
        SELECT gc.gene_symbol, gc.start_pos, gc.end_pos, gc.strand,
               gc.protein_length, gc.ecpa_b20, gc.c_protein,
               gc.n_protein, gc.s_protein, gc.cai, gc.tai,
               gc.mean_tpm, gc.max_tpm,
               gc.frac_cheap, gc.frac_expensive,
               gc.uniprot_id, gc.protein_name, gc.mw_kda, gc.cost_per_kda,
               gc.transcript_length_nt, gc.c_transcription, gc.c_rna_total,
               gc.frac_moderate, gc.frac_very_expensive,
               gc.n_cys, gc.n_met, gc.n_trp, gc.n_arg, gc.n_lys,
               gc.cds_length_nt, gc.n_codons, gc.gc3, gc.gc_cds, gc.enc, gc.fop,
               gc.ecpa_h11, gc.c_aa_synthesis, gc.c_translation,
               gc.c_atoms, gc.n_per_kda, gc.s_per_kda,
               gc.burden_total
        FROM bioenergetics.gene_costs gc
        WHERE gc.build = $1::genome_build
          AND gc.chr_id = $2
          AND gc.coord && int4range($3, $4)
          AND gc.layer_id = $5
        ORDER BY gc.start_pos
        LIMIT $6
    """


_GENE_COST_EXTRA_COLS = [
    "uniprot_id", "protein_name", "mw_kda", "cost_per_kda",
    "transcript_length_nt", "c_transcription", "c_rna_total",
    "frac_moderate", "frac_very_expensive",
    "n_cys", "n_met", "n_trp", "n_arg", "n_lys",
    "cds_length_nt", "n_codons", "gc3", "gc_cds", "enc", "fop",
    "ecpa_h11", "c_aa_synthesis", "c_translation",
    "c_atoms", "n_per_kda", "s_per_kda",
    "burden_total",
]


def _convert_gene_model(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, gene_ids, tx_ids, ftypes = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"])
        symbols.append(r["gene_symbol"])
        gene_ids.append(r["gene_id"])
        tx_ids.append(r["transcript_id"])
        ftypes.append(r["feature_type"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "gene_id": gene_ids,
            "transcript_id": tx_ids,
            "feature_type": ftypes,
        },
        "n": len(rows),
    }


def _convert_probe(rows: list, chr_name: str) -> dict:
    starts, ends, widths, probe_ids, symbols, contexts = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        probe_ids.append(r["probe_id"])
        symbols.append(r["gene_symbol"])
        contexts.append(r["cpg_context"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"probe_id": probe_ids, "gene_symbol": symbols, "cpg_context": contexts},
        "n": len(rows),
    }


def _convert_gene_cost(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, protein_lengths = [], []
    ecpa_b20s, c_proteins = [], []
    n_proteins, s_proteins = [], []
    cais, tais = [], []
    mean_tpms, max_tpms = [], []
    frac_cheaps, frac_expensives = [], []
    extra = {col: [] for col in _GENE_COST_EXTRA_COLS}
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        protein_lengths.append(r["protein_length"])
        ecpa_b20s.append(r["ecpa_b20"])
        c_proteins.append(r["c_protein"])
        n_proteins.append(r["n_protein"])
        s_proteins.append(r["s_protein"])
        cais.append(r["cai"])
        tais.append(r["tai"])
        mean_tpms.append(r["mean_tpm"])
        max_tpms.append(r["max_tpm"])
        frac_cheaps.append(r["frac_cheap"])
        frac_expensives.append(r["frac_expensive"])
        for col in _GENE_COST_EXTRA_COLS:
            extra[col].append(r[col])
    mcols = {
        "gene_symbol": symbols,
        "protein_length": protein_lengths,
        "ecpa_b20": ecpa_b20s,
        "c_protein": c_proteins,
        "n_protein": n_proteins,
        "s_protein": s_proteins,
        "cai": cais,
        "tai": tais,
        "mean_tpm": mean_tpms,
        "max_tpm": max_tpms,
        "frac_cheap": frac_cheaps,
        "frac_expensive": frac_expensives,
    }
    mcols.update(extra)
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": mcols,
        "n": len(rows),
    }
