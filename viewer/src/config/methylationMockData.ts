/**
 * Polymer-3 methylation mock data — deterministic ~3,000 probe fixtures
 * for volcano + manhattan rendering on /dmp.
 *
 * Layout follows real DMP volcano shape: most probes near (Δβ=0, p≈0) with
 * a long tail of significant hits, plus a focused TP53-region cluster so
 * the top-hits table has biologically credible content.
 */

import { KARYOTYPE } from './karyotypeData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProbeClass = 'ns' | 'hyper' | 'hypo';

export interface Probe {
  id: string;            // cg-id
  chr: string;
  position: number;      // bp on chromosome
  delta_beta: number;    // [-0.5, 0.5]
  neglogp: number;       // 0..14
  beta_a: number;        // group A mean beta (0..1)
  beta_b: number;        // group B mean beta
  gene?: string;         // annotated gene (top hits only)
  context?: 'island' | 'shore' | 'shelf' | 'open_sea';
  klass: ProbeClass;
}

// ---------------------------------------------------------------------------
// Deterministic noise
// ---------------------------------------------------------------------------

function hash(seed: string, i: number): number {
  let h = 2166136261;
  const k = `${seed}:${i}`;
  for (let j = 0; j < k.length; j++) {
    h = Math.imul(h ^ k.charCodeAt(j), 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

// Box-Muller approximation for a pseudo-normal sample
function nrand(seed: string, i: number): number {
  const u1 = Math.max(1e-6, hash(seed, i));
  const u2 = hash(seed, i + 100_000);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Stable cg-id formatter
function cgId(n: number): string {
  return 'cg' + String(n).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Probe generation
// ---------------------------------------------------------------------------

const N_BACKGROUND = 2400;  // |Δβ| small, p small
const N_MID        = 400;   // mid-significance
const N_STRONG     = 180;   // strong p, moderate Δβ
const N_TOP_HITS   = 20;    // very strong — table headliners

// Hand-curated top-hit gene/chromosome assignments for biological credibility.
// These probes are the ones that label on the volcano + populate the table.
const TOP_HIT_TEMPLATES: Array<{ gene: string; chr: string; position: number; deltaBeta: number; neglogp: number; context: Probe['context'] }> = [
  { gene: 'TP53',   chr: 'chr17', position: 7_673_221, deltaBeta:  0.247, neglogp: 12.36, context: 'island' },
  { gene: 'TP53',   chr: 'chr17', position: 7_675_108, deltaBeta:  0.218, neglogp: 11.95, context: 'island' },
  { gene: 'TP53',   chr: 'chr17', position: 7_676_419, deltaBeta:  0.193, neglogp: 11.42, context: 'shore'  },
  { gene: 'BRCA1',  chr: 'chr17', position: 43_044_295, deltaBeta:  0.181, neglogp: 11.04, context: 'island' },
  { gene: 'TET2',   chr: 'chr4',  position: 105_276_034, deltaBeta: -0.244, neglogp: 10.87, context: 'shore'  },
  { gene: 'MYC',    chr: 'chr8',  position: 127_736_231, deltaBeta:  0.176, neglogp: 10.55, context: 'island' },
  { gene: 'CDKN2A', chr: 'chr9',  position:  21_968_134, deltaBeta:  0.221, neglogp: 10.32, context: 'island' },
  { gene: 'APC',    chr: 'chr5',  position: 112_707_498, deltaBeta:  0.158, neglogp: 10.04, context: 'shore'  },
  { gene: 'DNMT3A', chr: 'chr2',  position:  25_242_191, deltaBeta: -0.197, neglogp:  9.82, context: 'island' },
  { gene: 'EGFR',   chr: 'chr7',  position:  55_086_725, deltaBeta:  0.143, neglogp:  9.61, context: 'shore'  },
  { gene: 'PTEN',   chr: 'chr10', position:  87_864_481, deltaBeta:  0.169, neglogp:  9.45, context: 'island' },
  { gene: 'RB1',    chr: 'chr13', position:  48_307_244, deltaBeta:  0.135, neglogp:  9.18, context: 'shore'  },
  { gene: 'BCL2',   chr: 'chr18', position:  63_127_882, deltaBeta: -0.182, neglogp:  9.02, context: 'island' },
  { gene: 'JAK2',   chr: 'chr9',  position:   5_021_988, deltaBeta:  0.124, neglogp:  8.71, context: 'open_sea' },
  { gene: 'EZH2',   chr: 'chr7',  position: 148_807_374, deltaBeta:  0.156, neglogp:  8.55, context: 'island' },
  { gene: 'IDH1',   chr: 'chr2',  position: 208_236_227, deltaBeta:  0.187, neglogp:  8.31, context: 'island' },
  { gene: 'HLA-DRB1', chr: 'chr6', position: 32_578_775, deltaBeta: -0.142, neglogp:  8.04, context: 'shore'  },
  { gene: 'MLH1',   chr: 'chr3',  position:  37_034_823, deltaBeta:  0.218, neglogp:  7.92, context: 'island' },
  { gene: 'VHL',    chr: 'chr3',  position:  10_141_635, deltaBeta:  0.165, neglogp:  7.74, context: 'island' },
  { gene: 'ATM',    chr: 'chr11', position: 108_223_067, deltaBeta: -0.121, neglogp:  7.51, context: 'shore'  },
];

const CHR_NAMES = KARYOTYPE.map((c) => c.name);

function pickChromosome(seed: string, i: number): { name: string; length: number } {
  const r = hash(seed, i);
  // Sample roughly proportional to chromosome length for realism
  const total = KARYOTYPE.reduce((s, c) => s + c.length, 0);
  let cum = 0;
  for (const chr of KARYOTYPE) {
    cum += chr.length / total;
    if (r <= cum) return { name: chr.name, length: chr.length };
  }
  return { name: KARYOTYPE[0].name, length: KARYOTYPE[0].length };
}

function classify(deltaBeta: number, neglogp: number): ProbeClass {
  if (neglogp < 7.3 || Math.abs(deltaBeta) < 0.05) return 'ns';
  return deltaBeta > 0 ? 'hyper' : 'hypo';
}

function probeFromTemplate(t: typeof TOP_HIT_TEMPLATES[number], idx: number): Probe {
  const cgNumber = 13580000 + idx;
  const beta_b = 0.50;
  const beta_a = beta_b + t.deltaBeta;
  return {
    id: cgId(cgNumber),
    chr: t.chr,
    position: t.position,
    delta_beta: t.deltaBeta,
    neglogp: t.neglogp,
    beta_a,
    beta_b,
    gene: t.gene,
    context: t.context,
    klass: classify(t.deltaBeta, t.neglogp),
  };
}

function generateProbes(): Probe[] {
  const probes: Probe[] = [];
  let cg = 1;

  // Top hits — hand-curated for the table
  TOP_HIT_TEMPLATES.forEach((t, i) => probes.push(probeFromTemplate(t, i)));
  cg += N_TOP_HITS;

  // Strong-significance background (no specific gene annotation)
  for (let i = 0; i < N_STRONG; i++) {
    const { name, length } = pickChromosome('strong', i);
    const sign = hash('strong-sign', i) > 0.5 ? 1 : -1;
    const dBeta = sign * (0.06 + hash('strong-d', i) * 0.18);
    const neglogp = 7.3 + hash('strong-p', i) * 4.5;
    const beta_b = 0.40 + hash('strong-b', i) * 0.20;
    probes.push({
      id: cgId(cg++),
      chr: name,
      position: Math.floor(hash('strong-pos', i) * length),
      delta_beta: dBeta,
      neglogp,
      beta_a: Math.max(0, Math.min(1, beta_b + dBeta)),
      beta_b,
      klass: classify(dBeta, neglogp),
    });
  }

  // Mid-significance
  for (let i = 0; i < N_MID; i++) {
    const { name, length } = pickChromosome('mid', i);
    const sign = hash('mid-sign', i) > 0.5 ? 1 : -1;
    const dBeta = sign * (0.03 + hash('mid-d', i) * 0.12);
    const neglogp = 3 + hash('mid-p', i) * 4;
    const beta_b = 0.35 + hash('mid-b', i) * 0.30;
    probes.push({
      id: cgId(cg++),
      chr: name,
      position: Math.floor(hash('mid-pos', i) * length),
      delta_beta: dBeta,
      neglogp,
      beta_a: Math.max(0, Math.min(1, beta_b + dBeta)),
      beta_b,
      klass: classify(dBeta, neglogp),
    });
  }

  // Background — concentrated around (0, 0) with normal noise
  for (let i = 0; i < N_BACKGROUND; i++) {
    const { name, length } = pickChromosome('bg', i);
    const dBeta = nrand('bg-d', i) * 0.035;
    const neglogp = Math.max(0, Math.abs(nrand('bg-p', i)) * 1.5);
    const beta_b = 0.30 + hash('bg-b', i) * 0.40;
    probes.push({
      id: cgId(cg++),
      chr: name,
      position: Math.floor(hash('bg-pos', i) * length),
      delta_beta: dBeta,
      neglogp,
      beta_a: Math.max(0, Math.min(1, beta_b + dBeta)),
      beta_b,
      klass: classify(dBeta, neglogp),
    });
  }

  return probes;
}

export const PROBES: Probe[] = generateProbes();

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export const SUMMARY = (() => {
  const total = PROBES.length;
  const hyper = PROBES.filter((p) => p.klass === 'hyper').length;
  const hypo  = PROBES.filter((p) => p.klass === 'hypo').length;
  const sig   = hyper + hypo;
  const meanDb = PROBES.reduce((s, p) => s + p.delta_beta, 0) / total;
  return { total, sig, hyper, hypo, meanDeltaBeta: meanDb };
})();

// Top 10 hits sorted by neglogp descending
export const TOP_HITS: Probe[] = [...PROBES]
  .filter((p) => p.gene)
  .sort((a, b) => b.neglogp - a.neglogp)
  .slice(0, 10);

// ---------------------------------------------------------------------------
// Mode + sub-tab metadata
// ---------------------------------------------------------------------------

export const ANALYSIS_MODES: Array<{ id: string; label: string; active: boolean }> = [
  { id: 'dmp',        label: 'DMP',        active: true  },
  { id: 'te_erv',     label: 'TE / ERV',   active: false },
  { id: 'clustering', label: 'Clustering', active: false },
  { id: 'compare',    label: 'Compare',    active: false },
];

export const DMP_SUBTABS: Array<{ id: string; label: string; available: boolean }> = [
  { id: 'volcano',    label: 'Volcano',    available: true  },
  { id: 'manhattan',  label: 'Manhattan',  available: true  },
  { id: 'enrichment', label: 'Enrichment', available: false },
];

// Chromosome metadata for manhattan plot
export const CHR_AXIS = (() => {
  let cum = 0;
  const total = KARYOTYPE.reduce((s, c) => s + c.length, 0);
  return KARYOTYPE.map((c) => {
    const start = cum / total;
    cum += c.length;
    const end = cum / total;
    return { name: c.name, length: c.length, start, end };
  });
})();
