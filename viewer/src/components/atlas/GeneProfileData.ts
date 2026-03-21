// ---------------------------------------------------------------------------
// GeneProfileData.ts — Static data tables & sequence utilities for GeneProfile
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Local font sizes (bigger than global TYPE for GeneProfile readability)
// ---------------------------------------------------------------------------

export const GC_TYPE = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 18,
  lg: 22,
  xl: 30,
  '2xl': 38,
} as const;

// ---------------------------------------------------------------------------
// Standard genetic code (64 codons → 1-letter amino acid, '*' = stop)
// ---------------------------------------------------------------------------

export const CODON_TABLE: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

// ---------------------------------------------------------------------------
// Amino acid biosynthetic cost (Akashi-Gojobori B20 ATP values)
// Ordered by ascending cost for histogram display
// ---------------------------------------------------------------------------

export interface AACostEntry {
  aa: string;          // 1-letter code
  name: string;        // 3-letter code
  cost: number;        // B20 ATP
  tier: 'cheap' | 'moderate' | 'expensive' | 'very_expensive';
}

export const AA_COST: AACostEntry[] = [
  { aa: 'G', name: 'Gly', cost: 11.7, tier: 'cheap' },
  { aa: 'A', name: 'Ala', cost: 11.7, tier: 'cheap' },
  { aa: 'S', name: 'Ser', cost: 11.7, tier: 'cheap' },
  { aa: 'P', name: 'Pro', cost: 12.3, tier: 'cheap' },
  { aa: 'D', name: 'Asp', cost: 12.7, tier: 'cheap' },
  { aa: 'N', name: 'Asn', cost: 14.7, tier: 'cheap' },
  { aa: 'E', name: 'Glu', cost: 15.3, tier: 'cheap' },
  { aa: 'Q', name: 'Gln', cost: 16.3, tier: 'moderate' },
  { aa: 'T', name: 'Thr', cost: 18.7, tier: 'moderate' },
  { aa: 'V', name: 'Val', cost: 23.3, tier: 'moderate' },
  { aa: 'C', name: 'Cys', cost: 24.7, tier: 'moderate' },
  { aa: 'L', name: 'Leu', cost: 27.3, tier: 'expensive' },
  { aa: 'R', name: 'Arg', cost: 27.3, tier: 'expensive' },
  { aa: 'K', name: 'Lys', cost: 30.3, tier: 'expensive' },
  { aa: 'I', name: 'Ile', cost: 32.3, tier: 'expensive' },
  { aa: 'M', name: 'Met', cost: 34.3, tier: 'expensive' },
  { aa: 'H', name: 'His', cost: 38.3, tier: 'expensive' },
  { aa: 'Y', name: 'Tyr', cost: 50.0, tier: 'very_expensive' },
  { aa: 'F', name: 'Phe', cost: 52.0, tier: 'very_expensive' },
  { aa: 'W', name: 'Trp', cost: 74.3, tier: 'very_expensive' },
];

export const AA_COST_MAP: Record<string, number> = Object.fromEntries(
  AA_COST.map(e => [e.aa, e.cost])
);

// ---------------------------------------------------------------------------
// Genome-wide ECPA reference (Akashi-Gojobori, published values)
// ---------------------------------------------------------------------------

export const COST_REFERENCE = {
  mean: 22.5,   // genome-wide mean ECPA (B20 ATP/aa)
  p5: 19.5,     // 5th percentile
  p95: 25.5,    // 95th percentile
  min: 11.7,    // theoretical min (all Gly/Ala)
  max: 74.3,    // theoretical max (all Trp)
  sd: 1.8,      // approximate genome-wide SD
} as const;

// ---------------------------------------------------------------------------
// Tier color mapping
// ---------------------------------------------------------------------------

export const TIER_COLORS: Record<string, string> = {
  cheap: '#22c55e',
  moderate: '#eab308',
  expensive: '#f97316',
  very_expensive: '#ef4444',
};

// ---------------------------------------------------------------------------
// Reverse complement
// ---------------------------------------------------------------------------

const COMP: Record<string, string> = {
  A: 'T', T: 'A', G: 'C', C: 'G',
  a: 't', t: 'a', g: 'c', c: 'g',
  N: 'N', n: 'n',
};

export function reverseComplement(seq: string): string {
  let rc = '';
  for (let i = seq.length - 1; i >= 0; i--) {
    rc += COMP[seq[i]] ?? 'N';
  }
  return rc;
}

// ---------------------------------------------------------------------------
// Translate nucleotide sequence → protein (1-letter codes)
// ---------------------------------------------------------------------------

export function translateSequence(cdsSeq: string): string {
  const upper = cdsSeq.toUpperCase();
  let protein = '';
  for (let i = 0; i + 2 < upper.length; i += 3) {
    const codon = upper.slice(i, i + 3);
    const aa = CODON_TABLE[codon];
    if (!aa || aa === '*') break;
    protein += aa;
  }
  return protein;
}

// ---------------------------------------------------------------------------
// Compute per-codon GC fraction
// ---------------------------------------------------------------------------

export function computeCodonGC(cdsSeq: string): number[] {
  const upper = cdsSeq.toUpperCase();
  const gcArr: number[] = [];
  for (let i = 0; i + 2 < upper.length; i += 3) {
    const codon = upper.slice(i, i + 3);
    let gc = 0;
    for (const ch of codon) {
      if (ch === 'G' || ch === 'C') gc++;
    }
    gcArr.push(gc / 3);
  }
  return gcArr;
}

// ---------------------------------------------------------------------------
// GC fraction for a nucleotide string
// ---------------------------------------------------------------------------

export function gcFraction(seq: string): number {
  if (!seq.length) return 0;
  const upper = seq.toUpperCase();
  let gc = 0;
  for (const ch of upper) {
    if (ch === 'G' || ch === 'C') gc++;
  }
  return gc / upper.length;
}

// ---------------------------------------------------------------------------
// Cost interpolation color (green → yellow → orange → red)
// ---------------------------------------------------------------------------

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

const COST_GRADIENT: [number, [number, number, number]][] = [
  [11.7, [34, 197, 94]],    // green
  [25, [234, 179, 8]],      // yellow
  [40, [249, 115, 22]],     // orange
  [74.3, [239, 68, 68]],    // red
];

export function costToColor(cost: number): string {
  for (let i = 0; i < COST_GRADIENT.length - 1; i++) {
    const [v0, c0] = COST_GRADIENT[i];
    const [v1, c1] = COST_GRADIENT[i + 1];
    if (cost <= v1) {
      const t = Math.max(0, Math.min(1, (cost - v0) / (v1 - v0)));
      const [r, g, b] = lerpColor(c0, c1, t);
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(239,68,68)`;
}

// ---------------------------------------------------------------------------
// Percentile estimate via normal approximation
// ---------------------------------------------------------------------------

export function ecpaPercentile(value: number): number {
  const z = (value - COST_REFERENCE.mean) / COST_REFERENCE.sd;
  // Simple approximation of CDF for standard normal
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? (1 - p) * 100 : p * 100;
}

// ---------------------------------------------------------------------------
// UniProt protein domain types & fetch
// ---------------------------------------------------------------------------

export interface ProteinDomain {
  type: string;       // 'Domain', 'Zinc finger', 'DNA binding', 'Region', 'Motif', 'Active site'
  description: string;
  aaStart: number;
  aaEnd: number;
}

const UNIPROT_FEATURE_TYPES = new Set([
  'Domain', 'Zinc finger', 'DNA binding', 'Region', 'Motif', 'Active site',
]);

export async function fetchUniProtDomains(uniprotId: string): Promise<ProteinDomain[]> {
  const res = await fetch(
    `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(uniprotId)}.json`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return [];

  const data = await res.json();
  const features: unknown[] = data?.features ?? [];

  const domains: ProteinDomain[] = [];
  for (const f of features) {
    const feat = f as Record<string, unknown>;
    const type = feat.type as string | undefined;
    if (!type || !UNIPROT_FEATURE_TYPES.has(type)) continue;

    const desc = (feat.description as string) ?? '';
    // Skip disordered regions and compositional bias
    if (type === 'Region' && /disordered/i.test(desc)) continue;

    const loc = feat.location as Record<string, unknown> | undefined;
    const start = (loc?.start as Record<string, unknown>)?.value as number | undefined;
    const end = (loc?.end as Record<string, unknown>)?.value as number | undefined;
    if (start == null || end == null) continue;

    domains.push({ type, description: desc, aaStart: start, aaEnd: end });
  }

  return domains.sort((a, b) => a.aaStart - b.aaStart);
}
