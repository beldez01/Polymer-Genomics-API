/**
 * Polymer-3 atlas mock data — all 24 hg38 chromosomes with simplified
 * banding and deterministic per-layer density fixtures.
 *
 * Lengths are real hg38 values. Centromere positions are approximate.
 * Bands are simplified (alternating gpos/gneg with the real centromere
 * position) — good enough for an atlas overview, not for cytogenetics.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BandStain = 'gpos' | 'gneg' | 'acen';
export type DensityLayer = 'gene' | 'cpg' | 'te' | 'probe';

export interface KaryotypeBand {
  start: number;  // normalized [0,1] across chromosome length
  end: number;
  stain: BandStain;
}

export interface KaryotypeChr {
  name: string;
  length: number;            // bp (hg38)
  centromereStart: number;   // normalized
  centromereEnd: number;
  bands: KaryotypeBand[];
}

// ---------------------------------------------------------------------------
// Band synthesizer
// ---------------------------------------------------------------------------

function buildBands(cs: number, ce: number, pCount: number, qCount: number): KaryotypeBand[] {
  const bands: KaryotypeBand[] = [];
  const pStep = cs / pCount;
  for (let i = 0; i < pCount; i++) {
    bands.push({
      start: i * pStep,
      end: (i + 1) * pStep,
      stain: i % 2 === 0 ? 'gpos' : 'gneg',
    });
  }
  bands.push({ start: cs, end: ce, stain: 'acen' });
  const qStep = (1 - ce) / qCount;
  for (let i = 0; i < qCount; i++) {
    bands.push({
      start: ce + i * qStep,
      end: ce + (i + 1) * qStep,
      stain: i % 2 === 0 ? 'gneg' : 'gpos',
    });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// 24 chromosomes (autosomes 1-22, sex chromosomes X, Y)
// Lengths from hg38 reference; centromere positions from approximate Mb
// values converted to normalized fractions.
// ---------------------------------------------------------------------------

export const KARYOTYPE: KaryotypeChr[] = [
  { name: 'chr1',  length: 248_956_422, centromereStart: 0.488, centromereEnd: 0.504, bands: buildBands(0.488, 0.504, 6, 6) },
  { name: 'chr2',  length: 242_193_529, centromereStart: 0.385, centromereEnd: 0.397, bands: buildBands(0.385, 0.397, 5, 7) },
  { name: 'chr3',  length: 198_295_559, centromereStart: 0.453, centromereEnd: 0.466, bands: buildBands(0.453, 0.466, 5, 5) },
  { name: 'chr4',  length: 190_214_555, centromereStart: 0.262, centromereEnd: 0.276, bands: buildBands(0.262, 0.276, 4, 7) },
  { name: 'chr5',  length: 181_538_259, centromereStart: 0.265, centromereEnd: 0.282, bands: buildBands(0.265, 0.282, 4, 7) },
  { name: 'chr6',  length: 170_805_979, centromereStart: 0.343, centromereEnd: 0.359, bands: buildBands(0.343, 0.359, 4, 6) },
  { name: 'chr7',  length: 159_345_973, centromereStart: 0.368, centromereEnd: 0.385, bands: buildBands(0.368, 0.385, 4, 6) },
  { name: 'chr8',  length: 145_138_636, centromereStart: 0.310, centromereEnd: 0.331, bands: buildBands(0.310, 0.331, 4, 6) },
  { name: 'chr9',  length: 138_394_717, centromereStart: 0.303, centromereEnd: 0.330, bands: buildBands(0.303, 0.330, 4, 5) },
  { name: 'chr10', length: 133_797_422, centromereStart: 0.291, centromereEnd: 0.306, bands: buildBands(0.291, 0.306, 4, 6) },
  { name: 'chr11', length: 135_086_622, centromereStart: 0.378, centromereEnd: 0.391, bands: buildBands(0.378, 0.391, 4, 5) },
  { name: 'chr12', length: 133_275_309, centromereStart: 0.263, centromereEnd: 0.282, bands: buildBands(0.263, 0.282, 4, 6) },
  { name: 'chr13', length: 114_364_328, centromereStart: 0.150, centromereEnd: 0.166, bands: buildBands(0.150, 0.166, 2, 6) },  // acrocentric
  { name: 'chr14', length: 107_043_718, centromereStart: 0.158, centromereEnd: 0.175, bands: buildBands(0.158, 0.175, 2, 6) },  // acrocentric
  { name: 'chr15', length: 101_991_189, centromereStart: 0.180, centromereEnd: 0.196, bands: buildBands(0.180, 0.196, 2, 6) },  // acrocentric
  { name: 'chr16', length:  90_338_345, centromereStart: 0.420, centromereEnd: 0.443, bands: buildBands(0.420, 0.443, 4, 4) },
  { name: 'chr17', length:  83_257_441, centromereStart: 0.285, centromereEnd: 0.321, bands: buildBands(0.285, 0.321, 3, 5) },
  { name: 'chr18', length:  80_373_285, centromereStart: 0.213, centromereEnd: 0.236, bands: buildBands(0.213, 0.236, 3, 5) },
  { name: 'chr19', length:  58_617_616, centromereStart: 0.432, centromereEnd: 0.461, bands: buildBands(0.432, 0.461, 3, 3) },
  { name: 'chr20', length:  64_444_167, centromereStart: 0.410, centromereEnd: 0.429, bands: buildBands(0.410, 0.429, 3, 4) },
  { name: 'chr21', length:  46_709_983, centromereStart: 0.279, centromereEnd: 0.301, bands: buildBands(0.279, 0.301, 2, 4) },  // acrocentric
  { name: 'chr22', length:  50_818_468, centromereStart: 0.286, centromereEnd: 0.314, bands: buildBands(0.286, 0.314, 2, 4) },  // acrocentric
  { name: 'chrX',  length: 156_040_895, centromereStart: 0.385, centromereEnd: 0.395, bands: buildBands(0.385, 0.395, 4, 6) },
  { name: 'chrY',  length:  57_227_415, centromereStart: 0.193, centromereEnd: 0.227, bands: buildBands(0.193, 0.227, 2, 3) },
];

// Longest chromosome — used to scale all others proportionally
export const KARYOTYPE_MAX_LEN = KARYOTYPE[0].length;

// ---------------------------------------------------------------------------
// Deterministic hash → noise → density fixtures
// ---------------------------------------------------------------------------

function hash(seed: string, i: number): number {
  let h = 2166136261;
  const k = `${seed}:${i}`;
  for (let j = 0; j < k.length; j++) {
    h = Math.imul(h ^ k.charCodeAt(j), 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

const DENSITY_CACHE = new Map<string, number[]>();

export function getDensity(chrName: string, layer: DensityLayer, bins = 80): number[] {
  const key = `${chrName}:${layer}:${bins}`;
  const cached = DENSITY_CACHE.get(key);
  if (cached) return cached;

  const seed = `${chrName}:${layer}`;
  // Different layers have different spatial profiles. Encode rough biology:
  //   gene  — variable, denser on q-arms
  //   cpg   — clustered, sparse elsewhere
  //   te    — relatively uniform
  //   probe — clustered around genes (proxy for cpg)
  const profile = {
    gene:  { slowAmp: 0.32, midAmp: 0.18, noise: 0.34, base: 0.46 },
    cpg:   { slowAmp: 0.38, midAmp: 0.22, noise: 0.46, base: 0.38 },
    te:    { slowAmp: 0.18, midAmp: 0.12, noise: 0.28, base: 0.55 },
    probe: { slowAmp: 0.30, midAmp: 0.20, noise: 0.40, base: 0.40 },
  }[layer];

  const seedPhase1 = hash(seed, 0) * Math.PI * 2;
  const seedPhase2 = hash(seed, 1) * Math.PI * 2;

  const values = Array.from({ length: bins }, (_, i) => {
    const t = i / bins;
    const slow  = Math.sin(t * Math.PI * 3 + seedPhase1) * profile.slowAmp;
    const mid   = Math.sin(t * Math.PI * 9 + seedPhase2) * profile.midAmp;
    const noise = (hash(seed, i + 100) - 0.5) * profile.noise;
    return Math.max(0, Math.min(1, profile.base + slow + mid + noise));
  });

  DENSITY_CACHE.set(key, values);
  return values;
}

// ---------------------------------------------------------------------------
// chrM (mitochondrial DNA) — small circle in the karyotype
// ---------------------------------------------------------------------------

export const CHR_M = { name: 'chrM', length: 16_569 };

// ---------------------------------------------------------------------------
// Isochore class fixtures — per-chromosome bins of L1/L2/H1/H2/H3
// ---------------------------------------------------------------------------

export type IsochoreClass = 'L1' | 'L2' | 'H1' | 'H2' | 'H3';

export interface IsochoreBin {
  start: number;     // normalized [0,1]
  end: number;
  klass: IsochoreClass;
}

const ISOCHORE_CACHE = new Map<string, IsochoreBin[]>();

// Smoothed 5-class label via a single noise field + spatial autocorrelation.
// Result reads as contiguous AT-rich / GC-rich regions, not random per-bin
// flicker — which is how real isochore tracks look.
export function getIsochoreBins(chrName: string, bins = 96): IsochoreBin[] {
  const cached = ISOCHORE_CACHE.get(chrName);
  if (cached) return cached;

  const seed = `iso:${chrName}`;
  const phase1 = hash(seed, 0) * Math.PI * 2;
  const phase2 = hash(seed, 1) * Math.PI * 2;
  const phase3 = hash(seed, 2) * Math.PI * 2;

  // Sample a continuous "GC-fraction" field, then quantize to 5 classes
  const field: number[] = Array.from({ length: bins }, (_, i) => {
    const t = i / bins;
    const slow  = Math.sin(t * Math.PI * 2.2 + phase1) * 0.42;
    const mid   = Math.sin(t * Math.PI * 6.1 + phase2) * 0.22;
    const fast  = Math.sin(t * Math.PI * 13  + phase3) * 0.08;
    const noise = (hash(seed, i + 50) - 0.5) * 0.18;
    return 0.5 + slow + mid + fast + noise;
  });

  const classOrder: IsochoreClass[] = ['L1', 'L2', 'H1', 'H2', 'H3'];
  const result: IsochoreBin[] = field.map((v, i) => {
    // Quantize to 5 classes by quintile of [0,1]
    const clamped = Math.max(0, Math.min(0.9999, v));
    const idx = Math.min(4, Math.floor(clamped * 5));
    return { start: i / bins, end: (i + 1) / bins, klass: classOrder[idx] };
  });

  ISOCHORE_CACHE.set(chrName, result);
  return result;
}

// ---------------------------------------------------------------------------
// Genome-wide stats — for the flanking columns on the atlas page
// ---------------------------------------------------------------------------

export const GENOME_STATS = {
  left: [
    { label: 'Genome size',         value: '3.20 Gb' },
    { label: 'Chromosomes',         value: '24' },
    { label: 'Protein-coding genes',value: '19,427' },
  ],
  right: [
    { label: 'CpG sites',           value: '29,439,827' },
    { label: 'CpG islands',         value: '235,847' },
    { label: 'EPIC v2 probes',      value: '937,690' },
  ],
};
