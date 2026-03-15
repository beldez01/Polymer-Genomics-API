"""Parameterized SQL queries and row converters for genomic interval lookups.

Each entry in TRACK_REGISTRY has:
  - query_fn: callable returning parameterized SQL (args: build, chr_id, start, end, layer_id, limit)
  - convert_fn: callable(rows, chr_name) -> GRanges dict

To add a new layer type, add a query function, a convert function, and an entry here.
"""

from polymer_genomics.coordinates import db_to_api


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

def region_cpg_sites_query() -> str:
    return """
        SELECT s.pos, s.pos + 2 AS end_pos, s.context, s.gc_content, s.island_id
        FROM cpg.sites s
        WHERE s.build = $1::genome_build
          AND s.chr_id = $2
          AND s.coord && int4range($3, $4)
          AND s.layer_id = $5
        ORDER BY s.pos
        LIMIT $6
    """


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


def region_isochores_query() -> str:
    return """
        SELECT i.start_pos, i.end_pos, i.gc_content, i.isochore_class
        FROM ref.isochores i
        WHERE i.build = $1::genome_build
          AND i.chr_id = $2
          AND i.coord && int4range($3, $4)
          AND i.layer_id = $5
        ORDER BY i.start_pos
        LIMIT $6
    """


def region_methylation_reference_query() -> str:
    """Cell-type reference methylation betas (Salas 2018 FlowSorted.Blood.EPIC)."""
    return """
        SELECT m.probe_id, m.pos, m.pos + 1 AS end_pos,
               m.gran, m.mono, m.nk, m.bcell, m.cd4t, m.cd8t
        FROM ref.methylation_reference m
        WHERE m.build = $1::genome_build
          AND m.chr_id = $2
          AND m.coord && int4range($3, $4)
          AND m.layer_id = $5
        ORDER BY m.pos
        LIMIT $6
    """


def region_conservation_query() -> str:
    """Conservation scores (PhyloP/PhastCons 100-way, 1kb bins)."""
    return """
        SELECT c.start_pos, c.end_pos,
               c.phylop_mean, c.phylop_max,
               c.phastcons_mean, c.phastcons_max
        FROM conservation.scores c
        WHERE c.build = $1::genome_build
          AND c.chr_id = $2
          AND c.coord && int4range($3, $4)
          AND c.layer_id = $5
        ORDER BY c.start_pos
        LIMIT $6
    """


def region_regulatory_query() -> str:
    """ENCODE candidate cis-Regulatory Elements (cCREs V4)."""
    return """
        SELECT r.start_pos, r.end_pos, r.accession, r.score,
               r.encode_label, r.ccre_class, r.z_score
        FROM regulatory.ccre r
        WHERE r.build = $1::genome_build
          AND r.chr_id = $2
          AND r.coord && int4range($3, $4)
          AND r.layer_id = $5
        ORDER BY r.start_pos
        LIMIT $6
    """


def region_expression_query() -> str:
    """Gene expression summary (GTEx v10, 54 tissues)."""
    return """
        SELECT e.gene_symbol, e.gene_id, e.start_pos, e.end_pos, e.strand,
               e.median_tpm, e.max_tpm, e.max_tissue, e.n_tissues_detected
        FROM expression.gene_tpm e
        WHERE e.build = $1::genome_build
          AND e.chr_id = $2
          AND e.coord && int4range($3, $4)
          AND e.layer_id = $5
        ORDER BY e.start_pos
        LIMIT $6
    """


def region_gene_costs_query() -> str:
    """Gene bioenergetic cost metrics (Akashi-Gojobori, CAI, GTEx EWGC)."""
    return """
        SELECT gc.gene_symbol, gc.start_pos, gc.end_pos, gc.strand,
               gc.protein_length, gc.ecpa_b20, gc.c_protein,
               gc.n_protein, gc.s_protein, gc.cai, gc.tai,
               gc.mean_tpm, gc.max_tpm,
               gc.frac_cheap, gc.frac_expensive
        FROM bioenergetics.gene_costs gc
        WHERE gc.build = $1::genome_build
          AND gc.chr_id = $2
          AND gc.coord && int4range($3, $4)
          AND gc.layer_id = $5
        ORDER BY gc.start_pos
        LIMIT $6
    """


def region_protein_abundance_query() -> str:
    """Tissue-specific protein abundance (PaxDb v6.0)."""
    return """
        SELECT pa.gene_symbol, pa.start_pos, pa.end_pos, pa.strand,
               pa.tissue, pa.organ_group, pa.abundance_ppm
        FROM bioenergetics.protein_abundance pa
        WHERE pa.build = $1::genome_build
          AND pa.chr_id = $2
          AND pa.coord && int4range($3, $4)
          AND pa.layer_id = $5
        ORDER BY pa.start_pos
        LIMIT $6
    """


def region_protein_turnover_query() -> str:
    """Protein half-life measurements (Mathieson et al. 2018)."""
    return """
        SELECT pt.gene_symbol, pt.start_pos, pt.end_pos, pt.strand,
               pt.cell_type, pt.half_life_hours, pt.k_degradation
        FROM bioenergetics.protein_turnover pt
        WHERE pt.build = $1::genome_build
          AND pt.chr_id = $2
          AND pt.coord && int4range($3, $4)
          AND pt.layer_id = $5
        ORDER BY pt.start_pos
        LIMIT $6
    """


def region_protein_properties_query() -> str:
    """Protein physicochemical properties (UniProt ProtParam)."""
    return """
        SELECT pp.gene_symbol, pp.start_pos, pp.end_pos, pp.strand,
               pp.h_atoms, pp.o_atoms, pp.p_atoms, pp.total_atoms,
               pp.pi, pp.instability_index, pp.aliphatic_index, pp.gravy
        FROM bioenergetics.protein_properties pp
        WHERE pp.build = $1::genome_build
          AND pp.chr_id = $2
          AND pp.coord && int4range($3, $4)
          AND pp.layer_id = $5
        ORDER BY pp.start_pos
        LIMIT $6
    """


def region_gene_constraint_query() -> str:
    """Gene-level constraint metrics (gnomAD pLI, LOEUF, Z-scores)."""
    return """
        SELECT gc.gene_symbol, gc.start_pos, gc.end_pos, gc.strand,
               gc.pli, gc.loeuf, gc.mis_z, gc.syn_z
        FROM conservation.gene_constraint gc
        WHERE gc.build = $1::genome_build
          AND gc.chr_id = $2
          AND gc.coord && int4range($3, $4)
          AND gc.layer_id = $5
        ORDER BY gc.start_pos
        LIMIT $6
    """


def region_protein_evolution_query() -> str:
    """Protein-level evolutionary rates (dN/dS from Ensembl Compara)."""
    return """
        SELECT pe.gene_symbol, pe.start_pos, pe.end_pos, pe.strand,
               pe.dn, pe.ds, pe.omega, pe.orthology_type
        FROM conservation.protein_evolution pe
        WHERE pe.build = $1::genome_build
          AND pe.chr_id = $2
          AND pe.coord && int4range($3, $4)
          AND pe.layer_id = $5
        ORDER BY pe.start_pos
        LIMIT $6
    """


def region_protein_atlas_query() -> str:
    """Protein tissue expression (Human Protein Atlas)."""
    return """
        SELECT te.gene_symbol, te.start_pos, te.end_pos, te.strand,
               te.tissue, te.cell_type, te.expression_level, te.reliability
        FROM proteomics.tissue_expression te
        WHERE te.build = $1::genome_build
          AND te.chr_id = $2
          AND te.coord && int4range($3, $4)
          AND te.layer_id = $5
        ORDER BY te.start_pos
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


def region_biophysics_query() -> str:
    """Sequence biophysical properties (Polymer Evolution L0, 1kb bins)."""
    return """
        SELECT b.start_pos, b.end_pos,
               b.gc_content, b.stacking_dg37, b.melting_temp,
               b.curvature, b.groove_width, b.dipole_density,
               b.periodicity_power,
               b.mgw_mean, b.prot_mean, b.roll_mean, b.helt_mean,
               b.delta_mgw, b.delta_prot, b.delta_roll, b.delta_helt,
               b.melting_cooperativity, b.bubble_propensity, b.melting_width,
               b.sbs_c_to_a_ddg, b.sbs_c_to_g_ddg, b.sbs_c_to_t_ddg, b.sbs_t_to_a_ddg
        FROM biophysics.sequence_properties b
        WHERE b.build = $1::genome_build
          AND b.chr_id = $2
          AND b.coord && int4range($3, $4)
          AND b.layer_id = $5
        ORDER BY b.start_pos
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


def region_gwas_query() -> str:
    """EBI GWAS Catalog associations (genome-wide significant)."""
    return """
        SELECT ga.start_pos, ga.end_pos,
               ga.rsid, ga.p_value, ga.or_beta,
               ga.ci_95, ga.trait, ga.mapped_gene,
               ga.study_accession, ga.pubmed_id
        FROM annotation.gwas_associations ga
        WHERE ga.build = $1::genome_build
          AND ga.chr_id = $2
          AND ga.coord && int4range($3, $4)
          AND ga.layer_id = $5
        ORDER BY ga.start_pos
        LIMIT $6
    """


def region_repeats_query() -> str:
    """Repeat element annotations (RepeatMasker)."""
    return """
        SELECT r.start_pos, r.end_pos, r.strand,
               r.repeat_name, r.repeat_class, r.repeat_family,
               r.divergence_pct,
               r.repeat_age, r.is_active, r.superfamily
        FROM annotation.repeats r
        WHERE r.build = $1::genome_build
          AND r.chr_id = $2
          AND r.coord && int4range($3, $4)
          AND r.layer_id = $5
        ORDER BY r.start_pos
        LIMIT $6
    """


def region_herv_loci_query() -> str:
    """Telescope HERV proviral loci."""
    return """
        SELECT h.start_pos, h.end_pos, h.strand,
               h.locus_id, h.subfamily, h.n_fragments, h.locus_length
        FROM annotation.herv_loci h
        WHERE h.build = $1::genome_build
          AND h.chr_id = $2
          AND h.coord && int4range($3, $4)
          AND h.layer_id = $5
        ORDER BY h.start_pos
        LIMIT $6
    """


def region_nonb_dna_query() -> str:
    """Non-B DNA structure predictions at 1kb resolution."""
    return """
        SELECT n.start_pos, n.end_pos,
               n.g4_density, n.z_dna_density, n.cruciform_density,
               n.r_loop_score, n.triplex_density, n.total_nonb_density
        FROM fragility.nonb_dna n
        WHERE n.build = $1::genome_build
          AND n.chr_id = $2
          AND n.coord && int4range($3, $4)
          AND n.layer_id = $5
        ORDER BY n.start_pos
        LIMIT $6
    """


def region_breakpoints_query() -> str:
    """Curated breakpoint and fragile site catalog."""
    return """
        SELECT b.start_pos, b.end_pos,
               b.breakpoint_type, b.name, b.gene_a, b.gene_b, b.source
        FROM fragility.breakpoints b
        WHERE b.build = $1::genome_build
          AND b.chr_id = $2
          AND b.coord && int4range($3, $4)
          AND b.layer_id = $5
        ORDER BY b.start_pos
        LIMIT $6
    """


def region_fragility_query() -> str:
    """Composite fragility score (1kb bins)."""
    return """
        SELECT f.start_pos, f.end_pos,
               f.nonb_component, f.curvature_component,
               f.stacking_component, f.breakpoint_proximity,
               f.fragility_score, f.fragility_class
        FROM fragility.composite_score f
        WHERE f.build = $1::genome_build
          AND f.chr_id = $2
          AND f.coord && int4range($3, $4)
          AND f.layer_id = $5
        ORDER BY f.start_pos
        LIMIT $6
    """


# ---------------------------------------------------------------------------
# Row converter functions
# ---------------------------------------------------------------------------

def _convert_cpg(rows: list, chr_name: str) -> dict:
    starts, ends, widths, contexts, gc_contents = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        contexts.append(r["context"])
        gc_contents.append(r["gc_content"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"context": contexts, "gc_content": gc_contents},
        "n": len(rows),
    }


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


def _convert_isochore(rows: list, chr_name: str) -> dict:
    starts, ends, widths, gc_contents, classes = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        gc_contents.append(r["gc_content"])
        classes.append(r["isochore_class"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {"gc_content": gc_contents, "isochore_class": classes},
        "n": len(rows),
    }


def _convert_methylation(rows: list, chr_name: str) -> dict:
    starts, ends, widths, probe_ids = [], [], [], []
    gran, mono, nk, bcell, cd4t, cd8t = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        probe_ids.append(r["probe_id"])
        gran.append(r["gran"])
        mono.append(r["mono"])
        nk.append(r["nk"])
        bcell.append(r["bcell"])
        cd4t.append(r["cd4t"])
        cd8t.append(r["cd8t"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "probe_id": probe_ids,
            "Gran": gran, "Mono": mono, "NK": nk,
            "Bcell": bcell, "CD4T": cd4t, "CD8T": cd8t,
        },
        "n": len(rows),
    }


def _convert_conservation(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    phylop_means, phylop_maxs = [], []
    phastcons_means, phastcons_maxs = [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        phylop_means.append(r["phylop_mean"])
        phylop_maxs.append(r["phylop_max"])
        phastcons_means.append(r["phastcons_mean"])
        phastcons_maxs.append(r["phastcons_max"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "phylop_mean": phylop_means,
            "phylop_max": phylop_maxs,
            "phastcons_mean": phastcons_means,
            "phastcons_max": phastcons_maxs,
        },
        "n": len(rows),
    }


def _convert_regulatory(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    accessions, scores, labels, classes, z_scores = [], [], [], [], []
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
        },
        "n": len(rows),
    }


def _convert_expression(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, gene_ids = [], []
    median_tpms, max_tpms, max_tissues, n_detected = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        gene_ids.append(r["gene_id"])
        median_tpms.append(r["median_tpm"])
        max_tpms.append(r["max_tpm"])
        max_tissues.append(r["max_tissue"])
        n_detected.append(r["n_tissues_detected"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "gene_id": gene_ids,
            "median_tpm": median_tpms,
            "max_tpm": max_tpms,
            "max_tissue": max_tissues,
            "n_tissues_detected": n_detected,
        },
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
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
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
        },
        "n": len(rows),
    }


def _convert_protein_abundance(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, tissues, organ_groups, ppms = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        tissues.append(r["tissue"])
        organ_groups.append(r["organ_group"])
        ppms.append(r["abundance_ppm"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "tissue": tissues,
            "organ_group": organ_groups,
            "abundance_ppm": ppms,
        },
        "n": len(rows),
    }


def _convert_protein_turnover(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, cell_types, half_lives, k_degs = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        cell_types.append(r["cell_type"])
        half_lives.append(r["half_life_hours"])
        k_degs.append(r["k_degradation"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "cell_type": cell_types,
            "half_life_hours": half_lives,
            "k_degradation": k_degs,
        },
        "n": len(rows),
    }


def _convert_protein_properties(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols = []
    h_atoms, o_atoms, p_atoms, total_atoms = [], [], [], []
    pis, instabilities, aliphatics, gravys = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        h_atoms.append(r["h_atoms"])
        o_atoms.append(r["o_atoms"])
        p_atoms.append(r["p_atoms"])
        total_atoms.append(r["total_atoms"])
        pis.append(r["pi"])
        instabilities.append(r["instability_index"])
        aliphatics.append(r["aliphatic_index"])
        gravys.append(r["gravy"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "h_atoms": h_atoms, "o_atoms": o_atoms,
            "p_atoms": p_atoms, "total_atoms": total_atoms,
            "pi": pis, "instability_index": instabilities,
            "aliphatic_index": aliphatics, "gravy": gravys,
        },
        "n": len(rows),
    }


def _convert_gene_constraint(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, plis, loeufs, mis_zs, syn_zs = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        plis.append(r["pli"])
        loeufs.append(r["loeuf"])
        mis_zs.append(r["mis_z"])
        syn_zs.append(r["syn_z"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "pli": plis, "loeuf": loeufs,
            "mis_z": mis_zs, "syn_z": syn_zs,
        },
        "n": len(rows),
    }


def _convert_protein_evolution(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, dns, dss, omegas, orth_types = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        dns.append(r["dn"])
        dss.append(r["ds"])
        omegas.append(r["omega"])
        orth_types.append(r["orthology_type"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "dn": dns, "ds": dss, "omega": omegas,
            "orthology_type": orth_types,
        },
        "n": len(rows),
    }


def _convert_protein_atlas(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, tissues, cell_types, levels, reliabilities = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        symbols.append(r["gene_symbol"])
        tissues.append(r["tissue"])
        cell_types.append(r["cell_type"])
        levels.append(r["expression_level"])
        reliabilities.append(r["reliability"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "tissue": tissues, "cell_type": cell_types,
            "expression_level": levels, "reliability": reliabilities,
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


def _convert_biophysics(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    gc, stacking, tm, curv, groove, dipole, period = [], [], [], [], [], [], []
    mgw, prot, roll, helt = [], [], [], []
    d_mgw, d_prot, d_roll, d_helt = [], [], [], []
    melt_coop, bubble, melt_w = [], [], []
    sbs_ca, sbs_cg, sbs_ct, sbs_ta = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        gc.append(r["gc_content"])
        stacking.append(r["stacking_dg37"])
        tm.append(r["melting_temp"])
        curv.append(r["curvature"])
        groove.append(r["groove_width"])
        dipole.append(r["dipole_density"])
        period.append(r["periodicity_power"])
        mgw.append(r["mgw_mean"])
        prot.append(r["prot_mean"])
        roll.append(r["roll_mean"])
        helt.append(r["helt_mean"])
        d_mgw.append(r["delta_mgw"])
        d_prot.append(r["delta_prot"])
        d_roll.append(r["delta_roll"])
        d_helt.append(r["delta_helt"])
        melt_coop.append(r["melting_cooperativity"])
        bubble.append(r["bubble_propensity"])
        melt_w.append(r["melting_width"])
        sbs_ca.append(r["sbs_c_to_a_ddg"])
        sbs_cg.append(r["sbs_c_to_g_ddg"])
        sbs_ct.append(r["sbs_c_to_t_ddg"])
        sbs_ta.append(r["sbs_t_to_a_ddg"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "gc_content": gc, "stacking_dg37": stacking,
            "melting_temp": tm, "curvature": curv,
            "groove_width": groove, "dipole_density": dipole,
            "periodicity_power": period,
            "mgw_mean": mgw, "prot_mean": prot,
            "roll_mean": roll, "helt_mean": helt,
            "delta_mgw": d_mgw, "delta_prot": d_prot,
            "delta_roll": d_roll, "delta_helt": d_helt,
            "melting_cooperativity": melt_coop,
            "bubble_propensity": bubble,
            "melting_width": melt_w,
            "sbs_c_to_a_ddg": sbs_ca, "sbs_c_to_g_ddg": sbs_cg,
            "sbs_c_to_t_ddg": sbs_ct, "sbs_t_to_a_ddg": sbs_ta,
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


def _convert_gwas(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    rsids, p_values, or_betas, ci_95s = [], [], [], []
    traits, mapped_genes, study_accessions, pubmed_ids = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        rsids.append(r["rsid"])
        p_values.append(r["p_value"])
        or_betas.append(r["or_beta"])
        ci_95s.append(r["ci_95"])
        traits.append(r["trait"])
        mapped_genes.append(r["mapped_gene"])
        study_accessions.append(r["study_accession"])
        pubmed_ids.append(r["pubmed_id"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "rsid": rsids, "p_value": p_values,
            "or_beta": or_betas, "ci_95": ci_95s,
            "trait": traits, "mapped_gene": mapped_genes,
            "study_accession": study_accessions, "pubmed_id": pubmed_ids,
        },
        "n": len(rows),
    }


def _convert_repeats(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    names, classes, families, divergences = [], [], [], []
    ages, actives, superfamilies = [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        names.append(r["repeat_name"])
        classes.append(r["repeat_class"])
        families.append(r["repeat_family"])
        divergences.append(r["divergence_pct"])
        ages.append(r["repeat_age"])
        actives.append(r["is_active"])
        superfamilies.append(r["superfamily"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "repeat_name": names, "repeat_class": classes,
            "repeat_family": families, "divergence_pct": divergences,
            "repeat_age": ages, "is_active": actives,
            "superfamily": superfamilies,
        },
        "n": len(rows),
    }


def _convert_herv_loci(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    locus_ids, subfamilies, n_frags, lengths = [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        strands.append(r["strand"] or "*")
        locus_ids.append(r["locus_id"])
        subfamilies.append(r["subfamily"])
        n_frags.append(r["n_fragments"])
        lengths.append(r["locus_length"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "locus_id": locus_ids, "subfamily": subfamilies,
            "n_fragments": n_frags, "locus_length": lengths,
        },
        "n": len(rows),
    }


def _convert_nonb_dna(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    g4, zdna, cruciform, rloop, triplex, total = [], [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        g4.append(r["g4_density"])
        zdna.append(r["z_dna_density"])
        cruciform.append(r["cruciform_density"])
        rloop.append(r["r_loop_score"])
        triplex.append(r["triplex_density"])
        total.append(r["total_nonb_density"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "g4_density": g4, "z_dna_density": zdna,
            "cruciform_density": cruciform, "r_loop_score": rloop,
            "triplex_density": triplex, "total_nonb_density": total,
        },
        "n": len(rows),
    }


def _convert_breakpoints(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    types, names, genes_a, genes_b, sources = [], [], [], [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        types.append(r["breakpoint_type"])
        names.append(r["name"])
        genes_a.append(r["gene_a"])
        genes_b.append(r["gene_b"])
        sources.append(r["source"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "breakpoint_type": types, "name": names,
            "gene_a": genes_a, "gene_b": genes_b, "source": sources,
        },
        "n": len(rows),
    }


def _convert_fragility(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    nonb, curv, stack, bp_prox = [], [], [], []
    scores, classes = [], []
    for r in rows:
        api = db_to_api(r["start_pos"], r["end_pos"])
        starts.append(api["start"])
        ends.append(api["end"])
        widths.append(api["width"])
        nonb.append(r["nonb_component"])
        curv.append(r["curvature_component"])
        stack.append(r["stacking_component"])
        bp_prox.append(r["breakpoint_proximity"])
        scores.append(r["fragility_score"])
        classes.append(r["fragility_class"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": ["*"] * len(rows),
        "mcols": {
            "nonb_component": nonb, "curvature_component": curv,
            "stacking_component": stack, "breakpoint_proximity": bp_prox,
            "fragility_score": scores, "fragility_class": classes,
        },
        "n": len(rows),
    }


# ---------------------------------------------------------------------------
# Declarative track registry
# ---------------------------------------------------------------------------

TRACK_REGISTRY: dict[str, dict] = {
    "cpg": {
        "query_fn": region_cpg_sites_query,
        "convert_fn": _convert_cpg,
    },
    "gene_model": {
        "query_fn": region_gene_features_query,
        "convert_fn": _convert_gene_model,
    },
    "probe": {
        "query_fn": region_probe_coordinates_query,
        "convert_fn": _convert_probe,
    },
    "isochore": {
        "query_fn": region_isochores_query,
        "convert_fn": _convert_isochore,
    },
    "methylation": {
        "query_fn": region_methylation_reference_query,
        "convert_fn": _convert_methylation,
    },
    "gene_cost": {
        "query_fn": region_gene_costs_query,
        "convert_fn": _convert_gene_cost,
    },
    "expression": {
        "query_fn": region_expression_query,
        "convert_fn": _convert_expression,
    },
    "regulatory": {
        "query_fn": region_regulatory_query,
        "convert_fn": _convert_regulatory,
    },
    "conservation": {
        "query_fn": region_conservation_query,
        "convert_fn": _convert_conservation,
    },
    "protein_abundance": {
        "query_fn": region_protein_abundance_query,
        "convert_fn": _convert_protein_abundance,
    },
    "protein_turnover": {
        "query_fn": region_protein_turnover_query,
        "convert_fn": _convert_protein_turnover,
    },
    "protein_properties": {
        "query_fn": region_protein_properties_query,
        "convert_fn": _convert_protein_properties,
    },
    "constraint": {
        "query_fn": region_gene_constraint_query,
        "convert_fn": _convert_gene_constraint,
    },
    "protein_evolution": {
        "query_fn": region_protein_evolution_query,
        "convert_fn": _convert_protein_evolution,
    },
    "protein_atlas": {
        "query_fn": region_protein_atlas_query,
        "convert_fn": _convert_protein_atlas,
    },
    "chromatin_state": {
        "query_fn": region_chromatin_state_query,
        "convert_fn": _convert_chromatin_state,
    },
    "repeat": {
        "query_fn": region_repeats_query,
        "convert_fn": _convert_repeats,
    },
    "herv": {
        "query_fn": region_herv_loci_query,
        "convert_fn": _convert_herv_loci,
    },
    "biophysics": {
        "query_fn": region_biophysics_query,
        "convert_fn": _convert_biophysics,
    },
    "sequence_biophysics": {
        "query_fn": region_biophysics_query,
        "convert_fn": _convert_biophysics,
    },
    "histone_mark": {
        "query_fn": region_histone_peaks_query,
        "convert_fn": _convert_histone_peaks,
    },
    "gwas": {
        "query_fn": region_gwas_query,
        "convert_fn": _convert_gwas,
    },
    "nonb_dna": {
        "query_fn": region_nonb_dna_query,
        "convert_fn": _convert_nonb_dna,
    },
    "breakpoint": {
        "query_fn": region_breakpoints_query,
        "convert_fn": _convert_breakpoints,
    },
    "fragility": {
        "query_fn": region_fragility_query,
        "convert_fn": _convert_fragility,
    },
}

# Backwards-compat alias (used by existing tests)
LAYER_QUERY_MAP = {k: v["query_fn"] for k, v in TRACK_REGISTRY.items()}
