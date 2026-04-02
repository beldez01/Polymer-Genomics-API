"""Cross-layer correlation engine.

Computes statistical relationships between any two data layers by binning
features into fixed-size genomic windows and computing a statistic on the
paired vectors.

Each layer type has a **correlation mode** determining how it is binned:

- **count mode**: discrete features counted per bin (density = count / bin_size)
- **continuous mode**: numeric values averaged per bin

Statistics:
- pearson_r, spearman_rho: work on all layer combinations
- overlap_enrichment, jaccard, fisher_exact: count x count only
"""

from __future__ import annotations

import math
from typing import Any

# ---------------------------------------------------------------------------
# Layer correlation registry
# ---------------------------------------------------------------------------

# Maps layer_type -> binning config.  Each entry describes:
#   table:      schema.table
#   pos_col:    column name for position (single-point) or start position
#   mode:       "count" | "continuous"
#   fields:     {field_name: sql_expression} — available fields for that layer
#
# For count-mode layers the default field is "density" (count / bin_size).
# For continuous-mode layers the default field is the first listed.

CORRELATION_REGISTRY: dict[str, dict[str, Any]] = {
    # ── Count mode ──────────────────────────────────────────────────
    "cpg": {
        "table": "cpg.sites",
        "pos_col": "pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "avg_gc": "avg(gc_content)",
        },
    },
    "gene_model": {
        "table": "gene.features",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "probe": {
        "table": "probe.coordinates",
        "pos_col": "pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "isochore": {
        "table": "ref.isochores",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "avg_gc": "avg(gc_content)",
        },
    },
    "regulatory": {
        "table": "regulatory.ccre",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "avg_score": "avg(score)",
            "avg_z_score": "avg(z_score)",
        },
    },
    # ── Continuous mode ─────────────────────────────────────────────
    "biophysics": {
        "table": "biophysics.sequence_properties",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "gc_content": "avg(gc_content)",
            "stacking_dg37": "avg(stacking_dg37)",
            "melting_temp": "avg(melting_temp)",
            "curvature": "avg(curvature)",
            "groove_width": "avg(groove_width)",
            "dipole_density": "avg(dipole_density)",
            "periodicity_power": "avg(periodicity_power)",
            "mgw_mean": "avg(mgw_mean)",
            "prot_mean": "avg(prot_mean)",
            "roll_mean": "avg(roll_mean)",
            "helt_mean": "avg(helt_mean)",
            "delta_mgw": "avg(delta_mgw)",
            "delta_prot": "avg(delta_prot)",
            "delta_roll": "avg(delta_roll)",
            "delta_helt": "avg(delta_helt)",
            "melting_cooperativity": "avg(melting_cooperativity)",
            "bubble_propensity": "avg(bubble_propensity)",
            "melting_width": "avg(melting_width)",
            "sbs_c_to_a_ddg": "avg(sbs_c_to_a_ddg)",
            "sbs_c_to_g_ddg": "avg(sbs_c_to_g_ddg)",
            "sbs_c_to_t_ddg": "avg(sbs_c_to_t_ddg)",
            "sbs_t_to_a_ddg": "avg(sbs_t_to_a_ddg)",
            "meth_delta_g": "avg(meth_delta_g)",
            "meth_delta_tm": "avg(meth_delta_tm)",
            "correlation_length": "avg(correlation_length)",
            "integrated_response": "avg(integrated_response)",
            "perturbation_reach": "avg(perturbation_reach)",
            "response_asymmetry": "avg(response_asymmetry)",
            "deformability": "avg(deformability)",
            "g4_density": "avg(g4_density)",
            "g4_max_score": "avg(g4_max_score)",
            "kmer_complexity": "avg(kmer_complexity)",
            "dinucleotide_entropy": "avg(dinucleotide_entropy)",
            "dominant_period": "avg(dominant_period)",
            "phylop_241way_mean": "avg(phylop_241way_mean)",
            "phastcons_241way_mean": "avg(phastcons_241way_mean)",
            "b_score_mean": "avg(b_score_mean)",
            "recomb_rate_cmmb": "avg(recomb_rate_cmmb)",
            "mutation_rate_mean": "avg(mutation_rate_mean)",
        },
    },
    "conservation": {
        "table": "conservation.scores",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "phylop_mean": "avg(phylop_mean)",
            "phastcons_mean": "avg(phastcons_mean)",
            "phylop_max": "avg(phylop_max)",
            "phastcons_max": "avg(phastcons_max)",
        },
    },
    "expression": {
        "table": "expression.gene_tpm",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "median_tpm": "avg(median_tpm)",
            "max_tpm": "avg(max_tpm)",
            "n_tissues_detected": "avg(n_tissues_detected)",
        },
    },
    "constraint": {
        "table": "conservation.gene_constraint",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "pli": "avg(pli)",
            "loeuf": "avg(loeuf)",
            "mis_z": "avg(mis_z)",
            "syn_z": "avg(syn_z)",
        },
    },
    "methylation": {
        "table": "ref.methylation_reference",
        "pos_col": "pos",
        "mode": "continuous",
        "fields": {
            "gran": "avg(gran)",
            "mono": "avg(mono)",
            "nk": "avg(nk)",
            "bcell": "avg(bcell)",
            "cd4t": "avg(cd4t)",
            "cd8t": "avg(cd8t)",
        },
    },
    "gene_cost": {
        "table": "bioenergetics.gene_costs",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "ecpa_b20": "avg(ecpa_b20)",
            "cai": "avg(cai)",
            "mean_tpm": "avg(mean_tpm)",
        },
    },
    "protein_abundance": {
        "table": "bioenergetics.protein_abundance",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "abundance_ppm": "avg(abundance_ppm)",
        },
    },
    "fragility": {
        "table": "fragility.composite_score",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "fragility_score": "avg(fragility_score)",
            "nonb_component": "avg(nonb_component)",
            "curvature_component": "avg(curvature_component)",
        },
    },
    # ── Count mode (newly added) ─────────────────────────────────────
    "chromatin_state": {
        "table": "regulatory.chromatin_state",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "repeat": {
        "table": "annotation.repeats",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "herv": {
        "table": "annotation.herv_loci",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "histone_mark": {
        "table": "regulatory.histone_peaks",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "gwas": {
        "table": "annotation.gwas_associations",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "breakpoint": {
        "table": "fragility.breakpoints",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "protein_atlas": {
        "table": "proteomics.tissue_expression",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    # ── Continuous mode (newly added) ────────────────────────────────
    "nonb_dna": {
        "table": "fragility.nonb_dna",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "g4_density": "avg(g4_density)",
            "z_dna_density": "avg(z_dna_density)",
            "cruciform_density": "avg(cruciform_density)",
            "r_loop_score": "avg(r_loop_score)",
            "triplex_density": "avg(triplex_density)",
            "total_nonb_density": "avg(total_nonb_density)",
        },
    },
    "protein_turnover": {
        "table": "bioenergetics.protein_turnover",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "half_life_hours": "avg(half_life_hours)",
            "k_degradation": "avg(k_degradation)",
        },
    },
    "protein_properties": {
        "table": "bioenergetics.protein_properties",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "pi": "avg(pi)",
            "instability_index": "avg(instability_index)",
            "aliphatic_index": "avg(aliphatic_index)",
            "gravy": "avg(gravy)",
        },
    },
    "protein_evolution": {
        "table": "conservation.protein_evolution",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "dn": "avg(dn)",
            "ds": "avg(ds)",
            "omega": "avg(omega)",
        },
    },
    # ── New layers (Phase 9: correlation engine) ───────────────────
    "tf_binding": {
        "table": "regulatory.tf_binding_signal",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "ctcf_gm12878": "avg(ctcf_gm12878)",
            "sp1_gm12878": "avg(sp1_gm12878)",
            "yy1_gm12878": "avg(yy1_gm12878)",
            "polr2a_gm12878": "avg(polr2a_gm12878)",
            "ezh2_gm12878": "avg(ezh2_gm12878)",
            "suz12_gm12878": "avg(suz12_gm12878)",
            "rest_gm12878": "avg(rest_gm12878)",
            "ctcf_k562": "avg(ctcf_k562)",
            "spi1_k562": "avg(spi1_k562)",
            "gata2_k562": "avg(gata2_k562)",
            "runx1_k562": "avg(runx1_k562)",
            "tal1_k562": "avg(tal1_k562)",
            "sp1_k562": "avg(sp1_k562)",
            "polr2a_k562": "avg(polr2a_k562)",
            "ezh2_k562": "avg(ezh2_k562)",
        },
    },
    "wgbs": {
        "table": "methylation.wgbs_1kb",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "hsc": "avg(hsc)",
            "cmp": "avg(cmp)",
            "gmp": "avg(gmp)",
            "monocyte": "avg(monocyte)",
            "neutrophil": "avg(neutrophil)",
            "eosinophil": "avg(eosinophil)",
            "b_naive": "avg(b_naive)",
            "b_memory": "avg(b_memory)",
            "t_naive": "avg(t_naive)",
            "t_memory": "avg(t_memory)",
            "nk": "avg(nk)",
            "erythroid": "avg(erythroid)",
            "mean_beta": "avg(mean_beta)",
            "beta_variance": "avg(beta_variance)",
        },
    },
    "accessibility": {
        "table": "regulatory.accessibility_signal",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "dnase_gm12878": "avg(dnase_gm12878)",
            "dnase_k562": "avg(dnase_k562)",
            "atac_hsc": "avg(atac_hsc)",
            "atac_monocyte": "avg(atac_monocyte)",
        },
    },
    "mutation_density": {
        "table": "annotation.mutation_density",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "pan_cancer_rate": "avg(pan_cancer_rate)",
            "snv_rate": "avg(snv_rate)",
            "indel_rate": "avg(indel_rate)",
            "liver_rate": "avg(liver_rate)",
            "lung_rate": "avg(lung_rate)",
            "skin_rate": "avg(skin_rate)",
            "blood_rate": "avg(blood_rate)",
        },
    },
    "hic_compartment": {
        "table": "regulatory.hic_compartment",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "pc1_score": "avg(pc1_score)",
        },
    },
    "tad_domain": {
        "table": "regulatory.tad_domains",
        "pos_col": "start_pos",
        "mode": "interval",
        "fields": {
            "corner_score": "avg(corner_score)",
        },
    },
    "insulation_score": {
        "table": "regulatory.insulation_score",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "insulation_score": "avg(insulation_score)",
        },
    },
}

# ---------------------------------------------------------------------------
# Valid statistics and compatibility
# ---------------------------------------------------------------------------

VALID_STATS = {
    "pearson_r",
    "spearman_rho",
    "overlap_enrichment",
    "jaccard",
    "fisher_exact",
}

# Stats that require both layers to be count-mode
_COUNT_ONLY_STATS = {"overlap_enrichment", "jaccard", "fisher_exact"}


def validate_stat_compatibility(
    stat: str, mode_a: str, mode_b: str
) -> str | None:
    """Return an error message if *stat* is incompatible with the layer modes."""
    if stat in _COUNT_ONLY_STATS:
        if mode_a != "count" or mode_b != "count":
            return (
                f"Statistic '{stat}' requires both layers to be count-mode "
                f"(got {mode_a} x {mode_b})."
            )
    return None


# ---------------------------------------------------------------------------
# SQL builder
# ---------------------------------------------------------------------------


def build_correlation_sql(
    reg_a: dict[str, Any],
    field_a: str,
    reg_b: dict[str, Any],
    field_b: str,
) -> str:
    """Generate the two-CTE + FULL OUTER JOIN query.

    Placeholder positions:
        $1 = build, $2 = chr_id, $3 = range_start, $4 = range_end,
        $5 = layer_id_a, $6 = layer_id_b, $7 = resolution
    """
    expr_a = reg_a["fields"][field_a]
    expr_b = reg_b["fields"][field_b]

    cte_a = (
        f"SELECT floor({reg_a['pos_col']} / $7) * $7 AS bin_start,\n"
        f"       {expr_a} AS value_a\n"
        f"FROM {reg_a['table']}\n"
        f"WHERE build = $1::genome_build\n"
        f"  AND chr_id = $2\n"
        f"  AND coord && int4range($3, $4)\n"
        f"  AND layer_id = $5\n"
        f"GROUP BY bin_start"
    )

    cte_b = (
        f"SELECT floor({reg_b['pos_col']} / $7) * $7 AS bin_start,\n"
        f"       {expr_b} AS value_b\n"
        f"FROM {reg_b['table']}\n"
        f"WHERE build = $1::genome_build\n"
        f"  AND chr_id = $2\n"
        f"  AND coord && int4range($3, $4)\n"
        f"  AND layer_id = $6\n"
        f"GROUP BY bin_start"
    )

    return (
        f"WITH bins_a AS (\n{cte_a}\n),\n"
        f"bins_b AS (\n{cte_b}\n)\n"
        f"SELECT COALESCE(a.bin_start, b.bin_start) AS bin_start,\n"
        f"       COALESCE(a.value_a, 0) AS value_a,\n"
        f"       COALESCE(b.value_b, 0) AS value_b\n"
        f"FROM bins_a a FULL OUTER JOIN bins_b b ON a.bin_start = b.bin_start\n"
        f"ORDER BY bin_start"
    )


# ---------------------------------------------------------------------------
# Statistical functions (pure Python, no scipy)
# ---------------------------------------------------------------------------


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs)


def _ranks(xs: list[float]) -> list[float]:
    """Average ranks (handling ties)."""
    n = len(xs)
    indexed = sorted(range(n), key=lambda i: xs[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j < n - 1 and xs[indexed[j + 1]] == xs[indexed[i]]:
            j += 1
        avg_rank = (i + j) / 2.0 + 1.0  # 1-based
        for k in range(i, j + 1):
            ranks[indexed[k]] = avg_rank
        i = j + 1
    return ranks


def compute_pearson(a: list[float], b: list[float]) -> dict:
    """Pearson r with p-value (t-distribution) and 95% CI (Fisher z)."""
    n = len(a)
    if n < 3:
        return {"value": None, "p_value": None, "confidence_interval_95": None,
                "reason": "insufficient_data"}

    ma, mb = _mean(a), _mean(b)
    da = [x - ma for x in a]
    db = [x - mb for x in b]

    ss_a = sum(x * x for x in da)
    ss_b = sum(x * x for x in db)
    if ss_a == 0 or ss_b == 0:
        return {"value": None, "p_value": None, "confidence_interval_95": None,
                "reason": "zero_variance"}

    cov = sum(x * y for x, y in zip(da, db))
    r = cov / math.sqrt(ss_a * ss_b)

    # Clamp for numerical safety
    r = max(-1.0, min(1.0, r))

    # t-test for significance
    if abs(r) >= 1.0:
        p_value = 0.0
    else:
        t_stat = r * math.sqrt((n - 2) / (1 - r * r))
        p_value = _t_pvalue(t_stat, n - 2)

    # Fisher z-transform for CI
    if abs(r) < 1.0 and n > 3:
        z = 0.5 * math.log((1 + r) / (1 - r))
        se = 1.0 / math.sqrt(n - 3)
        z_lo, z_hi = z - 1.96 * se, z + 1.96 * se
        ci = [round(math.tanh(z_lo), 6), round(math.tanh(z_hi), 6)]
    else:
        ci = None

    sd_a = math.sqrt(ss_a / (n - 1))
    sd_b = math.sqrt(ss_b / (n - 1))

    return {
        "value": round(r, 6),
        "p_value": p_value,
        "confidence_interval_95": ci,
        "details": {
            "mean_a": round(ma, 6),
            "mean_b": round(mb, 6),
            "sd_a": round(sd_a, 6),
            "sd_b": round(sd_b, 6),
        },
    }


def compute_spearman(a: list[float], b: list[float]) -> dict:
    """Spearman rho via rank-transform then Pearson."""
    ra = _ranks(a)
    rb = _ranks(b)
    result = compute_pearson(ra, rb)
    return result


def compute_overlap_enrichment(a: list[float], b: list[float]) -> dict:
    """Observed/expected co-occurrence ratio on non-zero bins."""
    n = len(a)
    if n == 0:
        return {"value": None, "p_value": None, "reason": "insufficient_data"}

    n_a = sum(1 for x in a if x > 0)
    n_b = sum(1 for x in b if x > 0)
    n_both = sum(1 for x, y in zip(a, b) if x > 0 and y > 0)

    if n_a == 0 or n_b == 0:
        return {"value": None, "p_value": None, "reason": "no_nonzero_bins",
                "details": {"n_a_nonzero": n_a, "n_b_nonzero": n_b}}

    expected = (n_a * n_b) / n
    enrichment = n_both / expected if expected > 0 else None

    # Fisher exact p-value on 2x2 table
    fe = _fisher_exact_2x2(n_both, n_a - n_both, n_b - n_both,
                           n - n_a - n_b + n_both)

    return {
        "value": round(enrichment, 6) if enrichment is not None else None,
        "p_value": fe["p_value"],
        "details": {
            "n_both_nonzero": n_both,
            "n_a_nonzero": n_a,
            "n_b_nonzero": n_b,
            "expected": round(expected, 2),
        },
    }


def compute_jaccard(a: list[float], b: list[float]) -> dict:
    """|A intersection B| / |A union B| on non-zero bins."""
    n_both = sum(1 for x, y in zip(a, b) if x > 0 and y > 0)
    n_either = sum(1 for x, y in zip(a, b) if x > 0 or y > 0)
    if n_either == 0:
        return {"value": None, "p_value": None, "reason": "no_nonzero_bins"}
    j = n_both / n_either
    return {
        "value": round(j, 6),
        "p_value": None,  # Jaccard has no standard p-value
        "details": {
            "n_intersection": n_both,
            "n_union": n_either,
        },
    }


def compute_fisher_exact(a: list[float], b: list[float]) -> dict:
    """2x2 contingency table, hypergeometric p-value."""
    n = len(a)
    if n == 0:
        return {"value": None, "p_value": None, "reason": "insufficient_data"}

    n_a = sum(1 for x in a if x > 0)
    n_b = sum(1 for x in b if x > 0)
    n_both = sum(1 for x, y in zip(a, b) if x > 0 and y > 0)
    a_only = n_a - n_both
    b_only = n_b - n_both
    neither = n - n_a - n_b + n_both

    result = _fisher_exact_2x2(n_both, a_only, b_only, neither)
    odds_ratio = (n_both * neither) / (a_only * b_only) if (a_only > 0 and b_only > 0) else None

    return {
        "value": round(odds_ratio, 6) if odds_ratio is not None else None,
        "p_value": result["p_value"],
        "details": {
            "contingency_table": {
                "both": n_both,
                "a_only": a_only,
                "b_only": b_only,
                "neither": neither,
            },
        },
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _t_pvalue(t: float, df: int) -> float:
    """Two-tailed p-value from t-statistic using regularized incomplete beta.

    Approximation via the relationship:
        p = I_{df/(df+t^2)}(df/2, 1/2)
    using a continued-fraction expansion.
    """
    if df <= 0:
        return 1.0
    x = df / (df + t * t)
    return _regularized_beta(x, df / 2.0, 0.5)


def _regularized_beta(x: float, a: float, b: float) -> float:
    """Regularized incomplete beta function I_x(a, b) via Lentz algorithm."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0

    # Use symmetry relation when x > (a+1)/(a+b+2)
    if x > (a + 1) / (a + b + 2):
        return 1.0 - _regularized_beta(1 - x, b, a)

    lbeta = _log_beta(a, b)
    front = math.exp(a * math.log(x) + b * math.log(1 - x) - lbeta) / a

    # Lentz continued fraction
    f = 1.0
    c = 1.0
    d = 1.0 - (a + b) * x / (a + 1)
    if abs(d) < 1e-30:
        d = 1e-30
    d = 1.0 / d
    f = d

    for m in range(1, 200):
        # Even step
        num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m))
        d = 1.0 + num * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + num / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        f *= c * d

        # Odd step
        num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))
        d = 1.0 + num * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + num / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        delta = c * d
        f *= delta

        if abs(delta - 1.0) < 1e-10:
            break

    return front * f


def _log_beta(a: float, b: float) -> float:
    """log(Beta(a, b)) = lgamma(a) + lgamma(b) - lgamma(a + b)."""
    return math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)


def _fisher_exact_2x2(a: int, b: int, c: int, d: int) -> dict:
    """Two-tailed Fisher's exact test on a 2x2 table [[a,b],[c,d]].

    Uses hypergeometric probability.  For large tables this is an
    approximation (sums probabilities <= the observed table's probability).
    """
    n = a + b + c + d
    if n == 0:
        return {"p_value": 1.0}

    row1 = a + b
    row2 = c + d
    col1 = a + c
    col2 = b + d

    # Log-probability of the observed table
    log_p_obs = (
        _log_comb(row1, a) + _log_comb(row2, c) - _log_comb(n, col1)
    )

    # Sum probabilities of all tables at least as extreme
    p_sum = 0.0
    lo = max(0, col1 - row2)
    hi = min(row1, col1)
    for k in range(lo, hi + 1):
        log_p = _log_comb(row1, k) + _log_comb(row2, col1 - k) - _log_comb(n, col1)
        if log_p <= log_p_obs + 1e-10:  # as extreme or more extreme
            p_sum += math.exp(log_p)

    return {"p_value": min(1.0, p_sum)}


def _log_comb(n: int, k: int) -> float:
    """log(C(n, k))."""
    if k < 0 or k > n:
        return -math.inf
    return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

STAT_FUNCTIONS = {
    "pearson_r": compute_pearson,
    "spearman_rho": compute_spearman,
    "overlap_enrichment": compute_overlap_enrichment,
    "jaccard": compute_jaccard,
    "fisher_exact": compute_fisher_exact,
}
