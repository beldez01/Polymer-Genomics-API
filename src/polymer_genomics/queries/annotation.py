"""GWAS, repeats, HERV, non-B DNA, breakpoints, and fragility queries."""
from polymer_genomics.queries._common import db_to_api


# ---------------------------------------------------------------------------
# Query functions
# ---------------------------------------------------------------------------

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
               r.repeat_age, r.is_active, r.superfamily,
               r.sw_score, r.deletion_pct, r.insertion_pct
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
    sw_scores, deletion_pcts, insertion_pcts = [], [], []
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
        sw_scores.append(r["sw_score"])
        deletion_pcts.append(r["deletion_pct"])
        insertion_pcts.append(r["insertion_pct"])
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
            "sw_score": sw_scores, "deletion_pct": deletion_pcts,
            "insertion_pct": insertion_pcts,
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
