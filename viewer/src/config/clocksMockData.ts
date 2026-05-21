/**
 * Polymer-3 epigenetic clocks mock data.
 *
 * Six canonical methylation clocks with realistic metadata + a small
 * synthetic top-probe table per clock for the anatomy panel.
 */

export interface ClockProbe {
  cgId: string;
  chr: string;
  position: number;
  coefficient: number;        // weighting in linear model
  meanBeta: number;           // mean across reference samples
  gene?: string;
}

export interface Clock {
  id: string;
  name: string;
  year: number;
  citation: string;
  probes: number;
  tissue: string;
  type: 'chronological' | 'biological' | 'pace';
  unit: 'years' | 'pace';
  blurb: string;
  /** Years per (chronological) year — 1.0 for chronological-trained, varies for biological */
  agePerYear: number;
  /** Intercept of the predicted-age line at chrono age 0 */
  ageIntercept: number;
  /** RMSE of prediction in years */
  rmseYears: number;
  /** Top weighted probes (5 each) */
  topProbes: ClockProbe[];
  /** Hyper vs hypo split (% of coefficients > 0) */
  hyperPct: number;
}

// Hand-tuned but deterministic probe samples per clock
function probes(seed: string, items: Array<[string, string, number, number, number, string?]>): ClockProbe[] {
  return items.map(([cgId, chr, position, coefficient, meanBeta, gene]) => ({
    cgId, chr, position, coefficient, meanBeta, gene,
  }));
}

export const CLOCKS: Clock[] = [
  {
    id: 'horvath',
    name: 'Horvath',
    year: 2013,
    citation: 'Horvath, Genome Biol.',
    probes: 353,
    tissue: 'pan-tissue',
    type: 'chronological',
    unit: 'years',
    blurb: 'Multi-tissue chronological-age predictor; widely used as the reference.',
    agePerYear: 1.00,
    ageIntercept: 0,
    rmseYears: 3.6,
    hyperPct: 56,
    topProbes: probes('horvath', [
      ['cg16867657', 'chr6',  11_044_634,  0.142, 0.421, 'ELOVL2'],
      ['cg22454769', 'chr16', 88_536_312,  0.118, 0.388, 'FHL2'],
      ['cg14361627', 'chr12', 53_996_447, -0.108, 0.412, 'KLF14'],
      ['cg06419846', 'chr7',  151_555_117, 0.098, 0.296, 'PRKAG2'],
      ['cg17861230', 'chr1',  207_073_466, -0.087, 0.521, 'PGLYRP4'],
    ]),
  },
  {
    id: 'hannum',
    name: 'Hannum',
    year: 2013,
    citation: 'Hannum et al., Mol. Cell',
    probes: 71,
    tissue: 'whole blood',
    type: 'chronological',
    unit: 'years',
    blurb: 'Blood-specific predictor with fewer probes than Horvath.',
    agePerYear: 1.00,
    ageIntercept: 0,
    rmseYears: 4.9,
    hyperPct: 62,
    topProbes: probes('hannum', [
      ['cg16867657', 'chr6',  11_044_634,  0.187, 0.421, 'ELOVL2'],
      ['cg22736354', 'chr6',  144_385_037, 0.144, 0.337, 'NHLRC1'],
      ['cg24724428', 'chr11',  68_607_624,  0.131, 0.460, 'CCND1'],
      ['cg02228185', 'chr1',   16_879_226, -0.108, 0.345, 'NBPF3'],
      ['cg06493994', 'chr5',  103_223_558,  0.094, 0.293, 'NUDT12'],
    ]),
  },
  {
    id: 'phenoage',
    name: 'PhenoAge',
    year: 2018,
    citation: 'Levine et al., Aging',
    probes: 513,
    tissue: 'whole blood',
    type: 'biological',
    unit: 'years',
    blurb: 'Biological-age estimator trained on 9 clinical biomarkers + chronological age.',
    agePerYear: 0.91,
    ageIntercept: 2.4,
    rmseYears: 5.3,
    hyperPct: 51,
    topProbes: probes('phenoage', [
      ['cg23606718', 'chr2',  131_525_447,  0.176, 0.448, 'POTEKP'],
      ['cg06493994', 'chr5',  103_223_558,  0.121, 0.293, 'NUDT12'],
      ['cg16386080', 'chr1',  207_096_073, -0.108, 0.422, 'TLR5'],
      ['cg26097427', 'chr16', 89_166_252,   0.094, 0.371, 'CDH15'],
      ['cg27434047', 'chr4',   95_242_417, -0.082, 0.546, 'PDLIM5'],
    ]),
  },
  {
    id: 'grimage',
    name: 'GrimAge',
    year: 2019,
    citation: 'Lu et al., Aging',
    probes: 1030,
    tissue: 'whole blood',
    type: 'biological',
    unit: 'years',
    blurb: 'Mortality-trained composite of 7 DNAm-based plasma protein surrogates + smoking.',
    agePerYear: 0.93,
    ageIntercept: 1.1,
    rmseYears: 4.4,
    hyperPct: 54,
    topProbes: probes('grimage', [
      ['cg18933331', 'chr6',  32_059_415,   0.224, 0.392, 'TNXB'],
      ['cg05575921', 'chr5',  373_378,      0.198, 0.661, 'AHRR'],
      ['cg23161492', 'chr8',  37_652_127,  -0.142, 0.413, 'ANK1'],
      ['cg15342087', 'chr3',  101_901_234, -0.121, 0.288, 'NFKBIZ'],
      ['cg00574958', 'chr11', 17_412_905,  -0.117, 0.473, 'PIK3C2A'],
    ]),
  },
  {
    id: 'retro_age',
    name: 'Retro-Age',
    year: 2025,
    citation: 'Polymer Genomics',
    probes: 248,
    tissue: 'whole blood',
    type: 'biological',
    unit: 'years',
    blurb: 'Polymer in-house clock built on TE/ERV-overlapping probes; tracks transposon awakening.',
    agePerYear: 0.88,
    ageIntercept: 3.1,
    rmseYears: 4.9,
    hyperPct: 67,
    topProbes: probes('retro_age', [
      ['cg10502896', 'chr1',  98_312_447,   0.211, 0.524, 'LTR12C'],
      ['cg26341932', 'chr19', 53_217_809,   0.196, 0.487, 'LINE1-PA3'],
      ['cg11071401', 'chr11', 5_270_500,   -0.158, 0.392, 'HERV-K'],
      ['cg14517050', 'chrX',  53_991_734,   0.148, 0.408, 'L1HS'],
      ['cg21889537', 'chr17', 7_678_421,    0.121, 0.367, 'TP53'],
    ]),
  },
  {
    id: 'dunedinpace',
    name: 'DunedinPACE',
    year: 2022,
    citation: 'Belsky et al., eLife',
    probes: 173,
    tissue: 'whole blood',
    type: 'pace',
    unit: 'pace',
    blurb: 'Pace-of-aging estimator (years of biological age per 1 yr of chronological age).',
    agePerYear: 1.04,             // ~1.04 years biol per chrono yr in healthy
    ageIntercept: 0,
    rmseYears: 0.08,              // pace, dimensionless · 0.08 yr/yr
    hyperPct: 58,
    topProbes: probes('dunedinpace', [
      ['cg06639320', 'chr15', 78_812_847,  0.187, 0.391, 'CHRNA3'],
      ['cg14624207', 'chr10', 102_374_119, 0.142, 0.305, 'PAX2'],
      ['cg21879725', 'chr17', 76_249_822, -0.108, 0.451, 'BIRC5'],
      ['cg06493994', 'chr5',  103_223_558, 0.097, 0.293, 'NUDT12'],
      ['cg24084894', 'chr20', 36_146_188, -0.083, 0.408, 'BLCAP'],
    ]),
  },
];

export function getClock(id: string): Clock | undefined {
  return CLOCKS.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Cross-clock probe overlap (Jaccard-ish indices, hand-tuned)
// Symmetric 6x6 matrix, diagonal = 100. Values are % of smaller set's
// probes also present in the other.
// ---------------------------------------------------------------------------

export const OVERLAP_MATRIX: number[][] = [
  /* H   Hn  Ph  Gr  Ra  Dp */
  [100, 28, 16,  9,  4, 12],   // Horvath
  [ 28,100, 22, 14,  7, 19],   // Hannum
  [ 16, 22,100, 31,  8, 23],   // PhenoAge
  [  9, 14, 31,100, 11, 17],   // GrimAge
  [  4,  7,  8, 11,100,  5],   // Retro-Age
  [ 12, 19, 23, 17,  5,100],   // DunedinPACE
];

// ---------------------------------------------------------------------------
// Sample reference samples for the calculator scatter (one per clock)
// 8 hypothetical individuals at chronological ages 25, 35, 45, 55, 65, 75, 85
// ---------------------------------------------------------------------------

export const REFERENCE_AGES = [25, 35, 45, 55, 65, 75, 85];

function hash(seed: string, i: number): number {
  let h = 2166136261;
  const k = `${seed}:${i}`;
  for (let j = 0; j < k.length; j++) {
    h = Math.imul(h ^ k.charCodeAt(j), 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

export function predictAge(clock: Clock, chronoAge: number): number {
  // Deterministic per-clock noise
  const noise = (hash(clock.id, Math.round(chronoAge * 100)) - 0.5) * clock.rmseYears * 1.6;
  if (clock.unit === 'pace') {
    // For pace clock, return years of bio age per year of chrono (around 1)
    return clock.agePerYear + noise * 0.02;
  }
  return clock.ageIntercept + clock.agePerYear * chronoAge + noise;
}
