// src/lib/hla/types.ts
// Types for the HLA Allele Biophysics module.

export type HLAClass = 1 | 2;
export type ExpressionSuffix = 'N' | 'L' | 'S' | 'C' | 'A' | 'Q' | null;

export const HLA_LOCI = ['HLA-A', 'HLA-B', 'HLA-C', 'HLA-DRB1', 'HLA-DQB1', 'HLA-DPB1'] as const;
export type HLALocus = (typeof HLA_LOCI)[number];

export const CLASS_I_LOCI: HLALocus[] = ['HLA-A', 'HLA-B', 'HLA-C'];
export const CLASS_II_LOCI: HLALocus[] = ['HLA-DRB1', 'HLA-DQB1', 'HLA-DPB1'];

/** Summary returned by /v1/hla/loci */
export interface LocusSummary {
  locus: HLALocus;
  hla_class: HLAClass;
  total_alleles: number;
  genomic_alleles: number;
  mean_gc_content: number | null;
  mean_stacking_dg37: number | null;
  mean_melting_temp: number | null;
  mean_nc_gc_content: number | null;
  mean_nc_stacking_dg37: number | null;
}

/** Allele list item from /v1/hla/alleles/{locus} */
export interface AlleleListItem {
  allele_name: string;
  allele_group: string;
  protein: string;
  synonymous: string | null;
  noncoding: string | null;
  expression_suffix: ExpressionSuffix;
  has_genomic: boolean;
  sequence_length: number | null;
  cds_length: number | null;
  gc_content: number | null;
  mean_stacking_dg37: number | null;
  melting_temp_est: number | null;
  nc_gc_content: number | null;
  nc_mean_stacking_dg37: number | null;
  nc_melting_temp_est: number | null;
}

/** Biophysics summary block */
export interface BiophysicsSummary {
  gc_content: number | null;
  cpg_count: number | null;
  cpg_density: number | null;
  cpg_obs_exp: number | null;
  cpg_island_count: number | null;
  mean_stacking_dg37: number | null;
  melting_temp_est: number | null;
  mean_a_form_prop: number | null;
  mean_z_form_prop: number | null;
  total_z_penalty: number | null;
  mean_major_groove_w: number | null;
  mean_minor_groove_w: number | null;
}

/** Non-coding biophysics summary */
export interface NCBiophysicsSummary {
  gc_content: number | null;
  cpg_count: number | null;
  cpg_density: number | null;
  mean_stacking_dg37: number | null;
  melting_temp_est: number | null;
  mean_a_form_prop: number | null;
  mean_z_form_prop: number | null;
  total_z_penalty: number | null;
  cpg_island_count: number | null;
}

/** Feature (exon/intron/UTR) biophysics */
export interface AlleleFeature {
  feature_type: string;
  feature_number: number;
  feature_label: string;
  start_pos: number;
  end_pos: number;
  length_bp: number;
  sequence_hash: string | null;
  gc_content: number | null;
  cpg_count: number | null;
  cpg_density: number | null;
  cpg_obs_exp: number | null;
  mean_stacking_dg37: number | null;
  melting_temp_est: number | null;
  mean_a_form_prop: number | null;
  mean_z_form_prop: number | null;
  total_z_penalty: number | null;
  mean_major_groove_w: number | null;
  mean_minor_groove_w: number | null;
  cpg_island_count: number | null;
  flag_count: number;
}

/** Full allele detail from /v1/hla/allele/{name} */
export interface AlleleDetail {
  identity: {
    allele_name: string;
    locus: HLALocus;
    allele_group: string;
    protein: string;
    synonymous: string | null;
    noncoding: string | null;
    hla_class: HLAClass;
    expression_suffix: ExpressionSuffix;
  };
  sequence_metadata: {
    has_genomic: boolean;
    sequence_length: number | null;
    cds_length: number | null;
    n_exons: number | null;
    n_introns: number | null;
  };
  biophysics: BiophysicsSummary;
  noncoding_biophysics: NCBiophysicsSummary;
  flag_counts: { total: number; warnings: number };
  features: AlleleFeature[];
}

/** Compare response */
export interface CompareResult {
  n_alleles: number;
  reference: string;
  focus: 'noncoding' | 'full' | 'coding';
  shared_protein: boolean;
  comparison: Record<string, {
    allele_name: string;
    locus: string;
    expression_suffix: ExpressionSuffix;
    sequence_length: number | null;
    biophysics: BiophysicsSummary;
    noncoding_biophysics: NCBiophysicsSummary;
  }>;
  deltas_vs_reference: Record<string, Record<string, number>>;
}

/** Non-coding divergence response */
export interface DivergenceResult {
  query: { locus: string; allele_group: string; protein: string };
  n_alleles: number;
  alleles: AlleleListItem[];
  metric_variance: Record<string, {
    n: number;
    mean: number;
    variance: number;
    range: [number, number];
  }>;
  ranked_by_variance: Array<{
    metric: string;
    n: number;
    mean: number;
    variance: number;
    range: [number, number];
  }>;
  most_variable_metric: string | null;
}

/** Expression correlation response */
export interface ExprClassStats {
  n: number;
  mean: number;
  sd: number | null;
}

export interface EffectSize {
  metric: string;
  expression_class: string;
  cohens_d: number;
  abs_d: number;
  normal_mean: number;
  normal_sd: number;
  normal_n: number;
  class_mean: number;
  class_sd: number;
  class_n: number;
  direction: string;
}

export interface PooledEffect {
  metric: string;
  cohens_d: number;
  abs_d: number;
  normal_mean: number;
  normal_n: number;
  aberrant_mean: number;
  aberrant_n: number;
  direction: string;
}

export interface ExpressionCorrelationResult {
  focus: string;
  locus: string | null;
  n_alleles: number;
  class_distribution: Record<string, { n: number; suffix: string | null }>;
  per_class_stats: Record<string, Record<string, ExprClassStats>>;
  effect_sizes: EffectSize[];
  pooled_normal_vs_aberrant: PooledEffect[];
}

/** UI state */
export type HLATab = 'alleles' | 'compare' | 'divergence' | 'expression';
