/**
 * HLA biophysics glossary — maps metric keys to human-readable names and units.
 * Used by Term tooltips, table headers, and detail panel labels.
 */

export interface GlossaryEntry {
  name: string;
  unit: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Whole-allele metrics
  gc_content:           { name: 'GC Content',              unit: 'fraction (0–1)' },
  cpg_count:            { name: 'CpG Dinucleotide Count',  unit: 'count' },
  cpg_density:          { name: 'CpG Density',             unit: 'CpGs per 100 bp' },
  cpg_obs_exp:          { name: 'CpG Observed / Expected', unit: 'ratio; <0.6 = depleted' },
  cpg_island_count:     { name: 'CpG Islands',             unit: 'count' },
  mean_stacking_dg37:   { name: 'Stacking Free Energy ΔG₃₇', unit: 'kcal/mol; more negative = more stable' },
  melting_temp_est:     { name: 'Melting Temperature Tm',   unit: '°C; temp at 50% denaturation' },
  mean_a_form_prop:     { name: 'A-form DNA Propensity',    unit: 'fraction; RNA:DNA hybrid conformation' },
  mean_z_form_prop:     { name: 'Z-form DNA Propensity',    unit: 'fraction; left-handed helix' },
  total_z_penalty:      { name: 'Z-DNA Formation Penalty',  unit: 'kcal/mol' },
  mean_major_groove_w:  { name: 'Major Groove Width',       unit: 'Å' },
  mean_minor_groove_w:  { name: 'Minor Groove Width',       unit: 'Å' },

  // Non-coding metrics (nc_ prefix)
  nc_gc_content:          { name: 'Non-coding GC Content',    unit: 'fraction (0–1)' },
  nc_cpg_count:           { name: 'Non-coding CpG Count',     unit: 'count' },
  nc_cpg_density:         { name: 'Non-coding CpG Density',   unit: 'CpGs per 100 bp' },
  nc_mean_stacking_dg37:  { name: 'Non-coding ΔG₃₇',         unit: 'kcal/mol' },
  nc_melting_temp_est:    { name: 'Non-coding Tm',            unit: '°C' },
  nc_mean_a_form_prop:    { name: 'Non-coding A-form',        unit: 'fraction' },
  nc_mean_z_form_prop:    { name: 'Non-coding Z-form',        unit: 'fraction' },
  nc_total_z_penalty:     { name: 'Non-coding Z-DNA Penalty', unit: 'kcal/mol' },
  nc_cpg_island_count:    { name: 'Non-coding CpG Islands',   unit: 'count' },

  // Sequence
  sequence_length:      { name: 'Sequence Length',          unit: 'bp' },

  // Expression
  expression_suffix:    { name: 'IMGT Expression Suffix',   unit: 'N=null L=low S=secreted C=cytoplasmic A=aberrant Q=questionable' },

  // Effect sizes (for expression tab)
  cohens_d:             { name: "Cohen's d Effect Size",    unit: '|d| ≥ 0.8 large, ≥ 0.5 medium, ≥ 0.2 small' },
};

/** Label aliases — maps short display labels to glossary keys. */
export const LABEL_TO_KEY: Record<string, string> = {
  'GC':       'gc_content',
  'ΔG₃₇':    'mean_stacking_dg37',
  'Tm':       'melting_temp_est',
  'nc GC':    'nc_gc_content',
  'nc ΔG₃₇':  'nc_mean_stacking_dg37',
  'nc Tm':    'nc_melting_temp_est',
  'Expr':     'expression_suffix',
  'Seq':      'has_genomic',
  'Length':    'sequence_length',
  'CpG count':     'cpg_count',
  'CpG obs/exp':   'cpg_obs_exp',
  'CpG islands':   'cpg_island_count',
  'A-form':        'mean_a_form_prop',
  'Z-form':        'mean_z_form_prop',
  'Z penalty':     'total_z_penalty',
  'major groove':  'mean_major_groove_w',
  'minor groove':  'mean_minor_groove_w',
  'nc CpG':        'nc_cpg_count',
  'nc A-form':     'nc_mean_a_form_prop',
  'nc Z-form':     'nc_mean_z_form_prop',
  'nc CpG islands':'nc_cpg_island_count',
  "Cohen's d":     'cohens_d',
};
