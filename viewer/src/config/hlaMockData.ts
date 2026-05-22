/**
 * Polymer-3 HLA mock data — 6 transplant loci, ~30 representative alleles
 * each, with non-coding biophysics divergence scores and expression tiers.
 */

export type HLAClass = 'I' | 'II';
export type ExpressionTier = 'high' | 'medium' | 'low';

export interface HLALocus {
  id: string;
  name: string;            // 'HLA-A'
  class: HLAClass;
  chr: string;
  position: number;
  totalAlleles: number;
  geneLength: number;      // bp
  blurb: string;
}

export interface HLAAllele {
  locus: string;
  name: string;            // 'A*02:01'
  fullName: string;        // 'HLA-A*02:01:01:01'
  population: string;      // 'global high', 'eur', 'eas', etc.
  globalFreq: number;      // 0..1
  expression: ExpressionTier;
  ncds: number;            // non-coding divergence from reference, 0..1
  coding_id: number;       // % protein-identity to reference
  // Non-coding biophysics profile — 60 normalized samples
  profile: number[];
  disease?: string;        // notable disease association
}

// ---------------------------------------------------------------------------
// Loci
// ---------------------------------------------------------------------------

export const LOCI: HLALocus[] = [
  { id: 'A',     name: 'HLA-A',     class: 'I',  chr: 'chr6', position:  29_942_532, totalAlleles: 8_847, geneLength: 3_503, blurb: 'Class I · presents endogenous peptides to CD8+ T cells' },
  { id: 'B',     name: 'HLA-B',     class: 'I',  chr: 'chr6', position:  31_353_872, totalAlleles: 10_481, geneLength: 4_120, blurb: 'Class I · most polymorphic; HIV control alleles here' },
  { id: 'C',     name: 'HLA-C',     class: 'I',  chr: 'chr6', position:  31_268_749, totalAlleles:  6_927, geneLength: 4_209, blurb: 'Class I · NK inhibitory ligand · psoriasis associations' },
  { id: 'DRB1',  name: 'HLA-DRB1',  class: 'II', chr: 'chr6', position:  32_578_775, totalAlleles:  4_104, geneLength: 11_088, blurb: 'Class II β · most polymorphic class II · autoimmunity' },
  { id: 'DQA1',  name: 'HLA-DQA1',  class: 'II', chr: 'chr6', position:  32_628_137, totalAlleles:    288, geneLength: 6_404, blurb: 'Class II α · paired with DQB1 · celiac' },
  { id: 'DQB1',  name: 'HLA-DQB1',  class: 'II', chr: 'chr6', position:  32_659_467, totalAlleles:  2_220, geneLength: 6_811, blurb: 'Class II β · paired with DQA1' },
];

export function getLocus(id: string): HLALocus | undefined {
  return LOCI.find((l) => l.id === id);
}

// ---------------------------------------------------------------------------
// Deterministic noise + profile generation
// ---------------------------------------------------------------------------

function hash(seed: string, i: number): number {
  let h = 2166136261;
  const k = `${seed}:${i}`;
  for (let j = 0; j < k.length; j++) {
    h = Math.imul(h ^ k.charCodeAt(j), 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function profile(seed: string, samples = 60): number[] {
  const phase = hash(seed, 0) * Math.PI * 2;
  const phase2 = hash(seed, 1) * Math.PI * 2;
  return Array.from({ length: samples }, (_, i) => {
    const t = i / samples;
    const slow  = Math.sin(t * Math.PI * 3 + phase) * 0.28;
    const mid   = Math.sin(t * Math.PI * 8 + phase2) * 0.18;
    const noise = (hash(seed, i + 100) - 0.5) * 0.22;
    return Math.max(0.05, Math.min(0.95, 0.5 + slow + mid + noise));
  });
}

// ---------------------------------------------------------------------------
// Hand-curated representative alleles
// (high global frequency or clinically notable)
// ---------------------------------------------------------------------------

interface AlleleSeed {
  locus: string;
  short: string;          // 'A*01:01'
  full: string;           // 'HLA-A*01:01:01:01'
  pop: string;
  freq: number;
  expression: ExpressionTier;
  ncds: number;
  codingId: number;
  disease?: string;
}

const SEEDS: AlleleSeed[] = [
  // HLA-A
  { locus: 'A', short: 'A*01:01', full: 'HLA-A*01:01:01:01', pop: 'global · 15.8 %',  freq: 0.158, expression: 'high',   ncds: 0.000, codingId: 100.0 },
  { locus: 'A', short: 'A*02:01', full: 'HLA-A*02:01:01:01', pop: 'global · 28.4 %',  freq: 0.284, expression: 'high',   ncds: 0.041, codingId: 99.4 },
  { locus: 'A', short: 'A*03:01', full: 'HLA-A*03:01:01:01', pop: 'eur · 14.6 %',     freq: 0.146, expression: 'high',   ncds: 0.038, codingId: 99.2 },
  { locus: 'A', short: 'A*11:01', full: 'HLA-A*11:01:01:01', pop: 'eas · 11.2 %',     freq: 0.092, expression: 'high',   ncds: 0.054, codingId: 98.9 },
  { locus: 'A', short: 'A*24:02', full: 'HLA-A*24:02:01:01', pop: 'global · 9.8 %',   freq: 0.098, expression: 'medium', ncds: 0.071, codingId: 98.6 },
  { locus: 'A', short: 'A*26:01', full: 'HLA-A*26:01:01:01', pop: 'eur · 4.1 %',      freq: 0.041, expression: 'medium', ncds: 0.084, codingId: 98.4 },
  { locus: 'A', short: 'A*33:03', full: 'HLA-A*33:03:01:01', pop: 'eas · 6.4 %',      freq: 0.064, expression: 'medium', ncds: 0.092, codingId: 98.2 },
  { locus: 'A', short: 'A*68:01', full: 'HLA-A*68:01:01:01', pop: 'global · 3.1 %',   freq: 0.031, expression: 'low',    ncds: 0.108, codingId: 97.8 },

  // HLA-B
  { locus: 'B', short: 'B*07:02', full: 'HLA-B*07:02:01:01', pop: 'eur · 11.4 %',     freq: 0.114, expression: 'high',   ncds: 0.000, codingId: 100.0 },
  { locus: 'B', short: 'B*08:01', full: 'HLA-B*08:01:01:01', pop: 'eur · 9.7 %',      freq: 0.097, expression: 'medium', ncds: 0.062, codingId: 98.7, disease: 'celiac' },
  { locus: 'B', short: 'B*15:01', full: 'HLA-B*15:01:01:01', pop: 'global · 5.8 %',   freq: 0.058, expression: 'high',   ncds: 0.078, codingId: 98.3 },
  { locus: 'B', short: 'B*27:05', full: 'HLA-B*27:05:02:01', pop: 'eur · 4.6 %',      freq: 0.046, expression: 'high',   ncds: 0.084, codingId: 98.1, disease: 'ankylosing spondylitis' },
  { locus: 'B', short: 'B*35:01', full: 'HLA-B*35:01:01:01', pop: 'global · 7.4 %',   freq: 0.074, expression: 'medium', ncds: 0.091, codingId: 97.9 },
  { locus: 'B', short: 'B*44:02', full: 'HLA-B*44:02:01:01', pop: 'eur · 9.1 %',      freq: 0.091, expression: 'high',   ncds: 0.067, codingId: 98.5 },
  { locus: 'B', short: 'B*51:01', full: 'HLA-B*51:01:01:01', pop: 'global · 5.2 %',   freq: 0.052, expression: 'medium', ncds: 0.114, codingId: 97.4, disease: 'Behçet' },
  { locus: 'B', short: 'B*57:01', full: 'HLA-B*57:01:01:01', pop: 'eur · 3.9 %',      freq: 0.039, expression: 'high',   ncds: 0.103, codingId: 97.6, disease: 'HIV control · abacavir HSR' },
  { locus: 'B', short: 'B*58:01', full: 'HLA-B*58:01:01:01', pop: 'eas · 5.5 %',      freq: 0.055, expression: 'low',    ncds: 0.121, codingId: 97.1, disease: 'allopurinol SCAR' },

  // HLA-C
  { locus: 'C', short: 'C*06:02', full: 'HLA-C*06:02:01:01', pop: 'eur · 12.7 %',     freq: 0.127, expression: 'high',   ncds: 0.000, codingId: 100.0, disease: 'psoriasis' },
  { locus: 'C', short: 'C*07:01', full: 'HLA-C*07:01:01:01', pop: 'eur · 14.8 %',     freq: 0.148, expression: 'high',   ncds: 0.044, codingId: 99.0 },
  { locus: 'C', short: 'C*07:02', full: 'HLA-C*07:02:01:01', pop: 'global · 11.4 %',  freq: 0.114, expression: 'high',   ncds: 0.048, codingId: 98.9 },
  { locus: 'C', short: 'C*04:01', full: 'HLA-C*04:01:01:01', pop: 'global · 10.8 %',  freq: 0.108, expression: 'medium', ncds: 0.071, codingId: 98.4 },
  { locus: 'C', short: 'C*12:03', full: 'HLA-C*12:03:01:01', pop: 'eur · 5.6 %',      freq: 0.056, expression: 'medium', ncds: 0.082, codingId: 98.1 },
  { locus: 'C', short: 'C*16:01', full: 'HLA-C*16:01:01:01', pop: 'global · 4.8 %',   freq: 0.048, expression: 'low',    ncds: 0.097, codingId: 97.7 },

  // HLA-DRB1
  { locus: 'DRB1', short: 'DRB1*15:01', full: 'HLA-DRB1*15:01:01:01', pop: 'eur · 15.4 %', freq: 0.154, expression: 'high',   ncds: 0.000, codingId: 100.0, disease: 'multiple sclerosis' },
  { locus: 'DRB1', short: 'DRB1*03:01', full: 'HLA-DRB1*03:01:01:01', pop: 'eur · 11.8 %', freq: 0.118, expression: 'high',   ncds: 0.058, codingId: 98.7, disease: 'celiac · SLE' },
  { locus: 'DRB1', short: 'DRB1*04:01', full: 'HLA-DRB1*04:01:01:01', pop: 'eur · 10.6 %', freq: 0.106, expression: 'medium', ncds: 0.073, codingId: 98.3, disease: 'RA' },
  { locus: 'DRB1', short: 'DRB1*07:01', full: 'HLA-DRB1*07:01:01:01', pop: 'global · 13.1 %', freq: 0.131, expression: 'high',   ncds: 0.062, codingId: 98.5 },
  { locus: 'DRB1', short: 'DRB1*11:01', full: 'HLA-DRB1*11:01:01:01', pop: 'eur · 9.2 %',  freq: 0.092, expression: 'medium', ncds: 0.084, codingId: 98.1 },
  { locus: 'DRB1', short: 'DRB1*13:01', full: 'HLA-DRB1*13:01:01:01', pop: 'eur · 7.8 %',  freq: 0.078, expression: 'medium', ncds: 0.078, codingId: 98.2 },
  { locus: 'DRB1', short: 'DRB1*01:01', full: 'HLA-DRB1*01:01:01:01', pop: 'eur · 8.5 %',  freq: 0.085, expression: 'high',   ncds: 0.067, codingId: 98.4, disease: 'RA' },

  // HLA-DQA1
  { locus: 'DQA1', short: 'DQA1*01:01', full: 'HLA-DQA1*01:01:01:01', pop: 'global · 19.4 %', freq: 0.194, expression: 'high',   ncds: 0.000, codingId: 100.0 },
  { locus: 'DQA1', short: 'DQA1*01:02', full: 'HLA-DQA1*01:02:01:01', pop: 'global · 16.8 %', freq: 0.168, expression: 'high',   ncds: 0.041, codingId: 99.2 },
  { locus: 'DQA1', short: 'DQA1*03:01', full: 'HLA-DQA1*03:01:01:01', pop: 'eur · 14.6 %',    freq: 0.146, expression: 'medium', ncds: 0.062, codingId: 98.7 },
  { locus: 'DQA1', short: 'DQA1*05:01', full: 'HLA-DQA1*05:01:01:01', pop: 'eur · 12.4 %',    freq: 0.124, expression: 'high',   ncds: 0.054, codingId: 98.9, disease: 'celiac (DQ2)' },
  { locus: 'DQA1', short: 'DQA1*02:01', full: 'HLA-DQA1*02:01:01:01', pop: 'global · 9.7 %',  freq: 0.097, expression: 'medium', ncds: 0.078, codingId: 98.2 },

  // HLA-DQB1
  { locus: 'DQB1', short: 'DQB1*06:02', full: 'HLA-DQB1*06:02:01:01', pop: 'eur · 14.2 %', freq: 0.142, expression: 'high',   ncds: 0.000, codingId: 100.0, disease: 'narcolepsy' },
  { locus: 'DQB1', short: 'DQB1*02:01', full: 'HLA-DQB1*02:01:01:01', pop: 'eur · 13.6 %', freq: 0.136, expression: 'high',   ncds: 0.047, codingId: 99.0, disease: 'celiac (DQ2)' },
  { locus: 'DQB1', short: 'DQB1*03:02', full: 'HLA-DQB1*03:02:01:01', pop: 'eur · 9.4 %',  freq: 0.094, expression: 'medium', ncds: 0.058, codingId: 98.7, disease: 'T1D (DQ8)' },
  { locus: 'DQB1', short: 'DQB1*05:01', full: 'HLA-DQB1*05:01:01:01', pop: 'global · 12.1 %', freq: 0.121, expression: 'high',   ncds: 0.052, codingId: 98.9 },
  { locus: 'DQB1', short: 'DQB1*03:01', full: 'HLA-DQB1*03:01:01:01', pop: 'global · 10.8 %', freq: 0.108, expression: 'medium', ncds: 0.063, codingId: 98.6 },
];

export const ALLELES: HLAAllele[] = SEEDS.map((s) => ({
  locus: s.locus,
  name: s.short,
  fullName: s.full,
  population: s.pop,
  globalFreq: s.freq,
  expression: s.expression,
  ncds: s.ncds,
  coding_id: s.codingId,
  profile: profile(s.short),
  disease: s.disease,
}));

export function allelesForLocus(locusId: string): HLAAllele[] {
  return ALLELES.filter((a) => a.locus === locusId);
}

// ---------------------------------------------------------------------------
// Pairwise divergence (synthetic) — used for comparison panel
// ---------------------------------------------------------------------------

export function pairwiseDivergence(a: HLAAllele, b: HLAAllele): number {
  // Difference of NCDS scores plus phase-shift contribution. Symmetric.
  const ncdsDiff = Math.abs(a.ncds - b.ncds);
  const profileDiff = a.profile.reduce((s, v, i) => s + Math.abs(v - b.profile[i]), 0) / a.profile.length;
  return Math.min(1, ncdsDiff * 1.3 + profileDiff * 0.8);
}

// ---------------------------------------------------------------------------
// Divergence histogram fixture — all pairwise NCDS deltas at a locus
// ---------------------------------------------------------------------------

export function divergenceHistogram(locusId: string, bins = 24): number[] {
  const alleles = allelesForLocus(locusId);
  const values: number[] = [];
  for (let i = 0; i < alleles.length; i++) {
    for (let j = i + 1; j < alleles.length; j++) {
      values.push(pairwiseDivergence(alleles[i], alleles[j]));
    }
  }
  // Bin to [0, 0.3]
  const max = 0.3;
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) {
    const b = Math.min(bins - 1, Math.floor((v / max) * bins));
    counts[b]++;
  }
  // Normalize to max
  const m = Math.max(...counts, 1);
  return counts.map((c) => c / m);
}
