/**
 * Polymer-3 transposome mock data — TE / ERV / DNA repeat families,
 * subfamily breakdowns, age distributions, and reactivation-risk fixtures.
 */

export type Superfamily = 'SINE' | 'LINE' | 'LTR' | 'DNA';

export interface TESubfamily {
  superfamily: Superfamily;
  name: string;
  blurb: string;
  count: number;             // copies in genome
  meanAgeMya: number;        // mean evolutionary age, millions of years
  awakening: number;         // reactivation propensity, 0..1
  epicProbes: number;        // # EPIC v2 probes overlapping
  meanBeta: number;          // mean methylation across reference (0..1; lower = more open/active)
}

export interface SuperfamilyMeta {
  id: Superfamily;
  name: string;
  blurb: string;
  count: number;
  fractionOfGenome: number;  // 0..1
  oldestMya: number;
  youngestMya: number;
}

export const SUPERFAMILIES: SuperfamilyMeta[] = [
  {
    id: 'SINE',
    name: 'SINE',
    blurb: 'Short interspersed nuclear elements. Alu dominates (~10.6 % of the genome).',
    count: 1_771_000,
    fractionOfGenome: 0.131,
    oldestMya: 80,
    youngestMya: 0,
  },
  {
    id: 'LINE',
    name: 'LINE',
    blurb: 'Long interspersed nuclear elements. Only L1 retains retrotransposition activity.',
    count: 1_038_000,
    fractionOfGenome: 0.207,
    oldestMya: 170,
    youngestMya: 0,
  },
  {
    id: 'LTR',
    name: 'LTR / ERV',
    blurb: 'Long terminal repeat retrotransposons including endogenous retroviruses.',
    count: 567_000,
    fractionOfGenome: 0.082,
    oldestMya: 200,
    youngestMya: 0.1,
  },
  {
    id: 'DNA',
    name: 'DNA',
    blurb: 'DNA transposons. Inactive in human germline since ~37 MYA.',
    count: 397_000,
    fractionOfGenome: 0.032,
    oldestMya: 200,
    youngestMya: 37,
  },
];

export const SUBFAMILIES: TESubfamily[] = [
  // SINEs
  { superfamily: 'SINE', name: 'AluY',     blurb: 'Most recent Alu lineage; some active copies', count:   78_200, meanAgeMya:  6,  awakening: 0.72, epicProbes: 28_412, meanBeta: 0.71 },
  { superfamily: 'SINE', name: 'AluS',     blurb: 'Older Alu lineage, broadly distributed',       count:  663_000, meanAgeMya: 30,  awakening: 0.24, epicProbes: 184_200, meanBeta: 0.81 },
  { superfamily: 'SINE', name: 'AluJ',     blurb: 'Most ancient Alu lineage',                     count:  336_000, meanAgeMya: 65,  awakening: 0.08, epicProbes: 71_344, meanBeta: 0.85 },
  { superfamily: 'SINE', name: 'MIR',      blurb: 'Mammalian-wide interspersed repeat',           count:  595_000, meanAgeMya: 130, awakening: 0.03, epicProbes: 88_711, meanBeta: 0.86 },

  // LINEs
  { superfamily: 'LINE', name: 'L1HS',     blurb: 'Human-specific L1 · only active retrotransposon', count:    4_842, meanAgeMya:  4,  awakening: 0.91, epicProbes:  3_724, meanBeta: 0.68 },
  { superfamily: 'LINE', name: 'L1PA2',    blurb: 'Hominoid-specific',                            count:    6_117, meanAgeMya:  8,  awakening: 0.62, epicProbes:  4_980, meanBeta: 0.73 },
  { superfamily: 'LINE', name: 'L1PA3',    blurb: 'Hominoid',                                     count:   12_488, meanAgeMya: 13,  awakening: 0.41, epicProbes:  9_188, meanBeta: 0.76 },
  { superfamily: 'LINE', name: 'L1PA4-7',  blurb: 'Older L1 lineages',                            count:   52_300, meanAgeMya: 26,  awakening: 0.18, epicProbes: 27_900, meanBeta: 0.82 },
  { superfamily: 'LINE', name: 'L2',       blurb: 'Ancient LINE-2',                               count:  466_000, meanAgeMya: 170, awakening: 0.02, epicProbes: 71_440, meanBeta: 0.87 },

  // LTRs / ERVs
  { superfamily: 'LTR',  name: 'HERV-K',   blurb: 'Youngest ERV family; some intact ORFs',        count:    2_345, meanAgeMya: 30,  awakening: 0.84, epicProbes:  1_872, meanBeta: 0.69 },
  { superfamily: 'LTR',  name: 'HERV-H',   blurb: 'Pluripotency-associated; active in stem cells',count:    1_028, meanAgeMya: 30,  awakening: 0.58, epicProbes:    922, meanBeta: 0.74 },
  { superfamily: 'LTR',  name: 'HERV-W',   blurb: 'Syncytin-1; placental fusion',                 count:      678, meanAgeMya: 40,  awakening: 0.49, epicProbes:    611, meanBeta: 0.71 },
  { superfamily: 'LTR',  name: 'HERV-E',   blurb: 'Tissue-specific expression',                   count:    1_415, meanAgeMya: 50,  awakening: 0.32, epicProbes:    988, meanBeta: 0.77 },
  { superfamily: 'LTR',  name: 'MaLR',     blurb: 'Mammalian-apparent LTR retrotransposons',      count:  173_800, meanAgeMya: 90,  awakening: 0.07, epicProbes: 38_240, meanBeta: 0.83 },

  // DNA transposons
  { superfamily: 'DNA',  name: 'hAT',      blurb: 'Charlie family · ancient, inactive',           count:   95_200, meanAgeMya: 110, awakening: 0.02, epicProbes: 22_341, meanBeta: 0.85 },
  { superfamily: 'DNA',  name: 'Tigger',   blurb: 'pogo-like · inactive',                         count:   72_811, meanAgeMya: 95,  awakening: 0.03, epicProbes: 19_472, meanBeta: 0.84 },
  { superfamily: 'DNA',  name: 'Mariner',  blurb: 'Tc1/mariner · inactive',                       count:   24_113, meanAgeMya: 80,  awakening: 0.04, epicProbes:  6_120, meanBeta: 0.83 },
];

// ---------------------------------------------------------------------------
// Age histogram — bimodal: ancient peak ~100 MYA, recent peak ~5-20 MYA
// ---------------------------------------------------------------------------

const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const N_BINS = 50;
const MAX_AGE = 200;

// Density at each age bin (deterministic mixture of two gaussians + noise)
export const AGE_HISTOGRAM = (() => {
  return Array.from({ length: N_BINS }, (_, i) => {
    const ageMid = (i + 0.5) * (MAX_AGE / N_BINS);
    // Two-peak mixture: recent (mu=10, sigma=12), ancient (mu=110, sigma=30)
    const recent  = Math.exp(-((ageMid - 10) ** 2) / (2 * 12 * 12));
    const ancient = 0.7 * Math.exp(-((ageMid - 110) ** 2) / (2 * 30 * 30));
    const noise = (hash(i + 700) - 0.5) * 0.05;
    const density = Math.max(0, recent + ancient + noise);
    return { ageStart: i * (MAX_AGE / N_BINS), ageEnd: (i + 1) * (MAX_AGE / N_BINS), density, ageMid };
  });
})();

// Normalize density to [0,1]
const maxD = Math.max(...AGE_HISTOGRAM.map((b) => b.density));
AGE_HISTOGRAM.forEach((b) => (b.density = b.density / maxD));

// ---------------------------------------------------------------------------
// Awakening-risk top elements — individual loci, not families
// ---------------------------------------------------------------------------

export interface AwakeningLocus {
  family: string;
  chr: string;
  position: number;
  length: number;
  awakening: number;          // 0..1
  ageMya: number;
  meanBeta: number;
  context: string;
}

export const AWAKENING_RISK: AwakeningLocus[] = [
  { family: 'L1HS',   chr: 'chr1',  position:  92_412_847, length: 6_088, awakening: 0.94, ageMya: 1.8, meanBeta: 0.61, context: 'intergenic · TET2-bound' },
  { family: 'HERV-K', chr: 'chr5',  position:  29_124_500, length: 9_142, awakening: 0.91, ageMya: 5.0, meanBeta: 0.58, context: 'KRAB-ZF dependency' },
  { family: 'L1HS',   chr: 'chr8',  position: 105_344_017, length: 6_119, awakening: 0.89, ageMya: 2.4, meanBeta: 0.64, context: 'antisense to oncogene' },
  { family: 'HERV-K', chr: 'chr19', position:  47_628_771, length: 8_983, awakening: 0.87, ageMya: 6.1, meanBeta: 0.62, context: 'enhancer overlap' },
  { family: 'L1HS',   chr: 'chr11', position:   8_842_004, length: 5_988, awakening: 0.84, ageMya: 3.0, meanBeta: 0.65, context: 'replication-late' },
  { family: 'AluY',   chr: 'chrX',  position:  53_991_447, length:   312, awakening: 0.81, ageMya: 5.5, meanBeta: 0.66, context: 'X-inactivation escape' },
  { family: 'HERV-H', chr: 'chr2',  position: 127_842_011, length: 5_724, awakening: 0.78, ageMya: 32,  meanBeta: 0.62, context: 'pluripotency lncRNA' },
  { family: 'L1PA2',  chr: 'chr17', position:  43_544_021, length: 6_017, awakening: 0.75, ageMya: 8.2, meanBeta: 0.68, context: 'BRCA1 5\' UTR neighbor' },
  { family: 'HERV-K', chr: 'chr11', position: 102_716_409, length: 9_018, awakening: 0.74, ageMya: 6.8, meanBeta: 0.64, context: 'cancer-up-regulated' },
  { family: 'L1HS',   chr: 'chr14', position:  72_184_512, length: 6_142, awakening: 0.71, ageMya: 3.8, meanBeta: 0.69, context: 'somatic-mosaicism hot' },
];

// ---------------------------------------------------------------------------
// Color helper per superfamily
// ---------------------------------------------------------------------------

export const SUPERFAMILY_COLOR: Record<Superfamily, string> = {
  SINE: '#B45309',  // amber — matches viewer's TE coloring
  LINE: '#0F62FE',  // electric blue
  LTR:  '#BE123C',  // rose
  DNA:  '#7C3AED',  // violet
};
