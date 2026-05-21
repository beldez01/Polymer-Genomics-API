/**
 * Polymer-3 evaluate page mock data.
 *
 * Example DNA sequence + pre-computed deterministic result that looks like
 * what the live /v1/evaluate endpoint would return. Mirrors the EvalResult
 * shape used in viewer/src/app/evaluate/page.tsx so the port-back diff is
 * mostly the rendering layer + the fetch call.
 */

// ---------------------------------------------------------------------------
// Example sequence — 474 bp synthetic promoter-like region
// (TP53-inspired but engineered to surface multiple flag types)
// ---------------------------------------------------------------------------

export const EXAMPLE_SEQUENCE =
  'ATGCGATCGATCGATCGAGGTCAATCGGATCGATGACTGATCGATCGATGCATCGGATCG' +
  'CTAGCTAGGTCGACGTAGCTAGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCG' +
  'CGCCGCGCCGCGCCGCGCCGCGCCGCGCCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCG' +
  'CCGGGCCGGGCCGGGCCGGGCCGCGCCGCGCCGCGCCGCGCCGCGCCGCGCGCGCGCGCG' +
  'TATATATATATATATATATATATATATAGCGCGCATCGATCGATCGATCGATCGATCGAT' +
  'AAAAAAAAAATTTTTTTTTTGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA' +
  'CCGCGCGCGCCGCGCGCGCCGCGCGCGCCGCGCGCGCCGCGCGCGCCGCGCGCGCCGCGC' +
  'GCATCGATGGGCCCATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAT';

// ---------------------------------------------------------------------------
// Types — shape mirrors viewer/src/app/evaluate/page.tsx EvalResult
// ---------------------------------------------------------------------------

export interface EvalFlag {
  type: 'warning' | 'info';
  code: string;
  region: string;
  message: string;
}

export interface CpgIsland {
  start: number;
  end: number;
  length_bp: number;
  gc: number;
  obs_exp_cpg: number;
  cpg_count: number;
}

export interface EvalResult {
  length_bp: number;
  summary: {
    gc_content: number;          // fraction
    cpg_count: number;
    cpg_density: number;
    cpg_island_count: number;
    melting_temp_estimate_C: number;
    mean_stacking_dG37_kcal: number;
    mean_a_form_propensity: number;
    mean_z_form_propensity: number;
  };
  thermodynamics: {
    profile: number[];           // normalized [0, 1] stacking trace
    window_size_bp: number;
    range_kcal: { min: number; max: number };
  };
  cpg_islands: CpgIsland[];
  structural: {
    z_form_total_penalty_kcal: number;
    major_groove_width_A: number;
    minor_groove_width_A: number;
  };
  flags: EvalFlag[];
  flag_counts: { total: number; warnings: number; info: number };
}

// ---------------------------------------------------------------------------
// Deterministic noise (same hash style as mockTrackData)
// ---------------------------------------------------------------------------

const hash = (i: number): number => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

function generateThermoProfile(samples = 160): number[] {
  return Array.from({ length: samples }, (_, i) => {
    const t = i / (samples - 1);
    const slow  = Math.sin(t * Math.PI * 2.4 - 0.3) * 0.32;
    const mid   = Math.sin(t * Math.PI * 8.1 + 0.8) * 0.18;
    const fast  = Math.sin(t * Math.PI * 21  - 1.4) * 0.08;
    const noise = (hash(i + 200) - 0.5) * 0.16;
    return Math.max(0.05, Math.min(0.95, 0.5 + slow + mid + fast + noise));
  });
}

// ---------------------------------------------------------------------------
// Pre-computed result for EXAMPLE_SEQUENCE
// ---------------------------------------------------------------------------

export const MOCK_RESULT: EvalResult = {
  length_bp: 474,
  summary: {
    gc_content: 0.524,
    cpg_count: 47,
    cpg_density: 47 / 474 * 1000,         // per kb
    cpg_island_count: 2,
    melting_temp_estimate_C: 71.3,
    mean_stacking_dG37_kcal: -8.42,
    mean_a_form_propensity: 0.31,
    mean_z_form_propensity: 0.18,
  },
  thermodynamics: {
    profile: generateThermoProfile(160),
    window_size_bp: 30,
    range_kcal: { min: -9.8, max: -7.1 },
  },
  cpg_islands: [
    { start: 120, end: 250, length_bp: 131, gc: 0.642, obs_exp_cpg: 0.78, cpg_count: 12 },
    { start: 320, end: 410, length_bp:  91, gc: 0.710, obs_exp_cpg: 0.84, cpg_count: 14 },
  ],
  structural: {
    z_form_total_penalty_kcal: 3.8,
    major_groove_width_A: 11.4,
    minor_groove_width_A: 5.9,
  },
  flags: [
    { type: 'warning', code: 'CPG_ISLAND',     region: '120–250', message: 'CpG island detected (GC 64.2 %)' },
    { type: 'warning', code: 'CPG_ISLAND',     region: '320–410', message: 'CpG island detected (GC 71.0 %)' },
    { type: 'warning', code: 'Z_FORM_HIGH',    region: '410–450', message: 'Z-form propensity 0.74 above threshold' },
    { type: 'warning', code: 'TANDEM_REPEAT',  region: '240–270', message: '(TA)ₙ repeat — possible secondary structure' },
    { type: 'warning', code: 'POLY_A',         region: '300–320', message: 'poly-A stretch ≥ 10 bp · pause-prone' },
    { type: 'info',    code: 'HIGH_GC',        region: '60–230',  message: 'Region GC > 70 % over 170 bp' },
    { type: 'info',    code: 'LOW_GC',         region: '280–310', message: 'Region GC < 25 % over 30 bp' },
    { type: 'info',    code: 'AT_RICH',        region: '300–330', message: 'AT-rich segment (TM est. 58 °C)' },
    { type: 'info',    code: 'GROOVE_NARROW',  region: '90–160',  message: 'Minor groove width compressed' },
    { type: 'info',    code: 'A_TRACT',        region: '300–315', message: 'A-tract — intrinsic curvature' },
    { type: 'info',    code: 'STACKING_LOW',   region: '305–340', message: 'Stacking ΔG above −7.4 kcal/mol' },
    { type: 'info',    code: 'CODON_USAGE',    region: '0–450',   message: 'No ORF context — codon flags suppressed' },
    { type: 'info',    code: 'BATCH_HINT',     region: '0–474',   message: 'Batch endpoint available for ≥ 100 sequences' },
  ],
  flag_counts: { total: 13, warnings: 5, info: 8 },
};
