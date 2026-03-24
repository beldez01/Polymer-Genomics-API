"""Conservation scores, gene constraint, and protein evolution queries."""
from polymer_genomics.queries._common import db_to_api


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


def region_gene_constraint_query() -> str:
    """Gene-level constraint metrics (gnomAD pLI, LOEUF, Z-scores)."""
    return """
        SELECT gc.gene_symbol, gc.start_pos, gc.end_pos, gc.strand,
               gc.pli, gc.loeuf, gc.mis_z, gc.syn_z,
               gc.transcript, gc.obs_lof, gc.exp_lof,
               gc.obs_mis, gc.exp_mis, gc.obs_syn, gc.exp_syn,
               gc.gnomad_version
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
               pe.dn, pe.ds, pe.omega, pe.orthology_type,
               pe.ensembl_gene_id, pe.mouse_gene_symbol,
               pe.mouse_ensembl_gene_id, pe.homology_id,
               pe.perc_id_human, pe.perc_id_mouse
        FROM conservation.protein_evolution pe
        WHERE pe.build = $1::genome_build
          AND pe.chr_id = $2
          AND pe.coord && int4range($3, $4)
          AND pe.layer_id = $5
        ORDER BY pe.start_pos
        LIMIT $6
    """


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


def _convert_gene_constraint(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, plis, loeufs, mis_zs, syn_zs = [], [], [], [], []
    transcripts = []
    obs_lofs, exp_lofs, obs_miss, exp_miss, obs_syns, exp_syns = [], [], [], [], [], []
    gnomad_versions = []
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
        transcripts.append(r["transcript"])
        obs_lofs.append(r["obs_lof"])
        exp_lofs.append(r["exp_lof"])
        obs_miss.append(r["obs_mis"])
        exp_miss.append(r["exp_mis"])
        obs_syns.append(r["obs_syn"])
        exp_syns.append(r["exp_syn"])
        gnomad_versions.append(r["gnomad_version"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "pli": plis, "loeuf": loeufs,
            "mis_z": mis_zs, "syn_z": syn_zs,
            "transcript": transcripts,
            "obs_lof": obs_lofs, "exp_lof": exp_lofs,
            "obs_mis": obs_miss, "exp_mis": exp_miss,
            "obs_syn": obs_syns, "exp_syn": exp_syns,
            "gnomad_version": gnomad_versions,
        },
        "n": len(rows),
    }


def _convert_protein_evolution(rows: list, chr_name: str) -> dict:
    starts, ends, widths, strands = [], [], [], []
    symbols, dns, dss, omegas, orth_types = [], [], [], [], []
    ensembl_ids, mouse_symbols, mouse_ensembl_ids = [], [], []
    homology_ids, perc_id_humans, perc_id_mice = [], [], []
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
        ensembl_ids.append(r["ensembl_gene_id"])
        mouse_symbols.append(r["mouse_gene_symbol"])
        mouse_ensembl_ids.append(r["mouse_ensembl_gene_id"])
        homology_ids.append(r["homology_id"])
        perc_id_humans.append(r["perc_id_human"])
        perc_id_mice.append(r["perc_id_mouse"])
    return {
        "class": "GRanges",
        "seqnames": [chr_name] * len(rows),
        "ranges": {"start": starts, "end": ends, "width": widths},
        "strand": strands,
        "mcols": {
            "gene_symbol": symbols,
            "dn": dns, "ds": dss, "omega": omegas,
            "orthology_type": orth_types,
            "ensembl_gene_id": ensembl_ids,
            "mouse_gene_symbol": mouse_symbols,
            "mouse_ensembl_gene_id": mouse_ensembl_ids,
            "homology_id": homology_ids,
            "perc_id_human": perc_id_humans,
            "perc_id_mouse": perc_id_mice,
        },
        "n": len(rows),
    }
