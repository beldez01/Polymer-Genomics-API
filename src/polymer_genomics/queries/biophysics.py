"""Sequence biophysics and isochore queries (L0 + L1 + L3.5 + extended)."""
from polymer_genomics.queries._common import db_to_api


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
               b.sbs_c_to_a_ddg, b.sbs_c_to_g_ddg, b.sbs_c_to_t_ddg, b.sbs_t_to_a_ddg,
               -- L1 methylation perturbation (Phase 2)
               b.cpg_count, b.cpg_density, b.cpg_obs_exp,
               b.meth_delta_g, b.meth_delta_tm, b.meth_sensitivity,
               b.methylation_capacity, b.demethylation_cost,
               b.oxidation_depth, b.taut_relaxed,
               -- L3.5 Green's function (Phase 3.5)
               b.correlation_length, b.integrated_response,
               b.perturbation_reach, b.response_asymmetry,
               -- L0 extended (Phase 1 extended)
               b.deformability, b.g4_density, b.g4_max_score,
               b.kmer_complexity, b.dinucleotide_entropy, b.dominant_period,
               -- Replication timing (Phase 9)
               b.repli_gm12878, b.repli_k562,
               -- Gene density (Phase 9)
               b.gene_density, b.gene_bp_fraction, b.median_tpm,
               -- TE fractions (Phase 9)
               b.te_line_fraction, b.te_sine_fraction, b.te_ltr_fraction,
               b.te_dna_fraction, b.te_simple_fraction, b.te_total_fraction,
               -- Derived densities (Phase 9)
               b.ccre_density,
               b.histone_h3k4me3_gm12878, b.histone_h3k27me3_gm12878,
               b.histone_h3k4me1_gm12878, b.histone_h3k27ac_gm12878,
               b.chromhmm_active_frac_e029,
               -- Evolutionary physics (Phase 10)
               b.phylop_241way_mean, b.phastcons_241way_mean,
               b.b_score_mean, b.recomb_rate_cmmb, b.mutation_rate_mean
        FROM biophysics.sequence_properties b
        WHERE b.build = $1::genome_build
          AND b.chr_id = $2
          AND b.coord && int4range($3, $4)
          AND b.layer_id = $5
        ORDER BY b.start_pos
        LIMIT $6
    """


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


def _convert_biophysics(rows: list, chr_name: str) -> dict:
    starts, ends, widths = [], [], []
    # L0 core
    gc, stacking, tm, curv, groove, dipole, period = [], [], [], [], [], [], []
    mgw, prot, roll, helt = [], [], [], []
    d_mgw, d_prot, d_roll, d_helt = [], [], [], []
    melt_coop, bubble, melt_w = [], [], []
    sbs_ca, sbs_cg, sbs_ct, sbs_ta = [], [], [], []
    # L1 methylation perturbation
    cpg_cnt, cpg_dens, cpg_oe = [], [], []
    m_dg, m_dtm, m_sens = [], [], []
    m_cap, m_demeth, m_ox, m_taut = [], [], [], []
    # L3.5 Green's function
    corr_len, integ_resp, pert_reach, resp_asym = [], [], [], []
    # L0 extended
    deform, g4_dens, g4_max, kmer_cx, dinuc_ent, dom_per = [], [], [], [], [], []
    # Phase 9: replication timing, gene density, TE fractions, derived densities
    repli_gm, repli_k5 = [], []
    g_dens, g_bp_frac, med_tpm = [], [], []
    te_line, te_sine, te_ltr, te_dna, te_simple, te_total = [], [], [], [], [], []
    ccre_d = []
    h_k4me3, h_k27me3, h_k4me1, h_k27ac = [], [], [], []
    chromhmm_act = []
    # Evolutionary physics (Phase 10)
    phylop_241, phastcons_241, b_score, recomb, mut_rate = [], [], [], [], []
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
        # L1
        cpg_cnt.append(r["cpg_count"])
        cpg_dens.append(r["cpg_density"])
        cpg_oe.append(r["cpg_obs_exp"])
        m_dg.append(r["meth_delta_g"])
        m_dtm.append(r["meth_delta_tm"])
        m_sens.append(r["meth_sensitivity"])
        m_cap.append(r["methylation_capacity"])
        m_demeth.append(r["demethylation_cost"])
        m_ox.append(r["oxidation_depth"])
        m_taut.append(r["taut_relaxed"])
        # L3.5
        corr_len.append(r["correlation_length"])
        integ_resp.append(r["integrated_response"])
        pert_reach.append(r["perturbation_reach"])
        resp_asym.append(r["response_asymmetry"])
        # L0 extended
        deform.append(r["deformability"])
        g4_dens.append(r["g4_density"])
        g4_max.append(r["g4_max_score"])
        kmer_cx.append(r["kmer_complexity"])
        dinuc_ent.append(r["dinucleotide_entropy"])
        dom_per.append(r["dominant_period"])
        # Phase 9
        repli_gm.append(r["repli_gm12878"])
        repli_k5.append(r["repli_k562"])
        g_dens.append(r["gene_density"])
        g_bp_frac.append(r["gene_bp_fraction"])
        med_tpm.append(r["median_tpm"])
        te_line.append(r["te_line_fraction"])
        te_sine.append(r["te_sine_fraction"])
        te_ltr.append(r["te_ltr_fraction"])
        te_dna.append(r["te_dna_fraction"])
        te_simple.append(r["te_simple_fraction"])
        te_total.append(r["te_total_fraction"])
        ccre_d.append(r["ccre_density"])
        h_k4me3.append(r["histone_h3k4me3_gm12878"])
        h_k27me3.append(r["histone_h3k27me3_gm12878"])
        h_k4me1.append(r["histone_h3k4me1_gm12878"])
        h_k27ac.append(r["histone_h3k27ac_gm12878"])
        chromhmm_act.append(r["chromhmm_active_frac_e029"])
        # Evolutionary physics
        phylop_241.append(r["phylop_241way_mean"])
        phastcons_241.append(r["phastcons_241way_mean"])
        b_score.append(r["b_score_mean"])
        recomb.append(r["recomb_rate_cmmb"])
        mut_rate.append(r["mutation_rate_mean"])
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
            # L1 methylation perturbation
            "cpg_count": cpg_cnt, "cpg_density": cpg_dens,
            "cpg_obs_exp": cpg_oe,
            "meth_delta_g": m_dg, "meth_delta_tm": m_dtm,
            "meth_sensitivity": m_sens,
            "methylation_capacity": m_cap, "demethylation_cost": m_demeth,
            "oxidation_depth": m_ox, "taut_relaxed": m_taut,
            # L3.5 Green's function
            "correlation_length": corr_len, "integrated_response": integ_resp,
            "perturbation_reach": pert_reach, "response_asymmetry": resp_asym,
            # L0 extended
            "deformability": deform, "g4_density": g4_dens,
            "g4_max_score": g4_max, "kmer_complexity": kmer_cx,
            "dinucleotide_entropy": dinuc_ent, "dominant_period": dom_per,
            # Phase 9: replication timing
            "repli_gm12878": repli_gm, "repli_k562": repli_k5,
            # Gene density
            "gene_density": g_dens, "gene_bp_fraction": g_bp_frac,
            "median_tpm": med_tpm,
            # TE fractions
            "te_line_fraction": te_line, "te_sine_fraction": te_sine,
            "te_ltr_fraction": te_ltr, "te_dna_fraction": te_dna,
            "te_simple_fraction": te_simple, "te_total_fraction": te_total,
            # Derived densities
            "ccre_density": ccre_d,
            "histone_h3k4me3_gm12878": h_k4me3,
            "histone_h3k27me3_gm12878": h_k27me3,
            "histone_h3k4me1_gm12878": h_k4me1,
            "histone_h3k27ac_gm12878": h_k27ac,
            "chromhmm_active_frac_e029": chromhmm_act,
            # Evolutionary physics (Phase 10)
            "phylop_241way_mean": phylop_241, "phastcons_241way_mean": phastcons_241,
            "b_score_mean": b_score, "recomb_rate_cmmb": recomb,
            "mutation_rate_mean": mut_rate,
        },
        "n": len(rows),
    }
