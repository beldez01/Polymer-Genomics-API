/**
 * Polymer-3 newsroom mock data — claim dispatches feed.
 * Each entry is a formal claim with provenance and outcome.
 */

export type ClaimOutcome =
  | 'strong_positive'
  | 'positive'
  | 'qualified_positive'
  | 'negative'
  | 'fail';

export type ClaimCluster =
  | 'recombination'
  | 'methylation'
  | 'TE_silencing'
  | 'biophysics_proof'
  | 'HLA'
  | 'cancer';

export interface Claim {
  id: string;
  exp_number: number;
  title: string;
  blurb: string;
  outcome: ClaimOutcome;
  cluster: ClaimCluster;
  posted_at: string;          // ISO date
  metric: string;             // headline result, e.g. 'AUROC 0.827'
  region?: string;
}

export const CLAIMS: Claim[] = [
  {
    id: 'exp22',
    exp_number: 22,
    title: 'CpG erosion chronometer recovers transposon age',
    blurb: 'A per-TE methylation-based chronometer dates L1HS and AluY copies to within 1.4 MYA of phylogenetic estimates, validating mC erosion as an evolutionary clock.',
    outcome: 'positive',
    cluster: 'TE_silencing',
    posted_at: '2026-05-18',
    metric: 'r = 0.81 · MAE 1.4 MYA',
  },
  {
    id: 'exp21',
    exp_number: 21,
    title: 'GC-arrangement decomposition · LP proof',
    blurb: 'Roll, twist, rise, and groove geometry are 60–87 % arrangement-determined, isolating GC-independent biophysical signal genome-wide.',
    outcome: 'strong_positive',
    cluster: 'biophysics_proof',
    posted_at: '2026-05-12',
    metric: 'Arrangement variance up to 87 %',
  },
  {
    id: 'exp19',
    exp_number: 19,
    title: 'Replication-timing partial correlations',
    blurb: 'Z-form propensity emerges as the top biophysical correlate of replication timing once GC and TE density are controlled for.',
    outcome: 'positive',
    cluster: 'biophysics_proof',
    posted_at: '2026-05-04',
    metric: 'Partial r = 0.100 · rank #1',
  },
  {
    id: 'exp18',
    exp_number: 18,
    title: 'Gene-flanking deformability predicts expression breadth',
    blurb: 'Deformability of 10 kb flanking regions partially correlates with cross-tissue expression breadth independent of GC and CpG content.',
    outcome: 'positive',
    cluster: 'biophysics_proof',
    posted_at: '2026-04-28',
    metric: 'Partial r = −0.345',
  },
  {
    id: 'exp17',
    exp_number: 17,
    title: 'Crossover hotspots predicted from arrangement biophysics',
    blurb: 'A 7-feature arrangement-only model (no GC) discriminates meiotic crossover hotspots from background with AUROC 0.827.',
    outcome: 'strong_positive',
    cluster: 'recombination',
    posted_at: '2026-04-20',
    metric: 'AUROC 0.827 · GC-controlled',
  },
  {
    id: 'exp16',
    exp_number: 16,
    title: 'HLA expression mismatch from non-coding biophysics',
    blurb: 'Non-coding biophysics divergence between HLA alleles predicts expression-level mismatch better than coding identity alone.',
    outcome: 'qualified_positive',
    cluster: 'HLA',
    posted_at: '2026-04-12',
    metric: 'r² = 0.41 · n = 188 pairs',
  },
  {
    id: 'exp23',
    exp_number: 23,
    title: 'Meiotic groove-width effect size · cancer null',
    blurb: 'Groove-width is strongly arrangement-dominated in meiotic hotspots (Cohen d = −0.41) but does not transfer to cancer breakpoints in this cohort.',
    outcome: 'qualified_positive',
    cluster: 'recombination',
    posted_at: '2026-04-06',
    metric: 'Meiotic d = −0.41 · cancer null',
  },
  {
    id: 'exp15',
    exp_number: 15,
    title: 'Stacking energy distinguishes essential genes',
    blurb: 'Mean stacking ΔG₃₇ across gene body separates essential (LOF-intolerant) from non-essential genes after constraint correction.',
    outcome: 'positive',
    cluster: 'biophysics_proof',
    posted_at: '2026-03-28',
    metric: 'd = 0.62',
  },
  {
    id: 'exp11',
    exp_number: 11,
    title: 'Biophysical similarity does not predict shared regulation',
    blurb: 'A 64-feature biophysics fingerprint fails to recover known co-regulated gene clusters above chance.',
    outcome: 'negative',
    cluster: 'biophysics_proof',
    posted_at: '2026-03-20',
    metric: 'AUROC 0.51 (n.s.)',
  },
  {
    id: 'exp09',
    exp_number: 9,
    title: 'Curvature does not encode promoter strength alone',
    blurb: 'Intrinsic curvature in core promoters does not predict TPM rank above the GC-content baseline.',
    outcome: 'negative',
    cluster: 'biophysics_proof',
    posted_at: '2026-03-12',
    metric: 'ΔAUROC = +0.01 (n.s.)',
  },
  {
    id: 'exp03',
    exp_number: 3,
    title: 'TE silencing predicted from CpG context + age',
    blurb: 'A two-feature model (CpG density × TE age) discriminates silenced from active TEs in lymphoblastoid lines at AUROC 0.84.',
    outcome: 'positive',
    cluster: 'TE_silencing',
    posted_at: '2026-02-28',
    metric: 'AUROC 0.84',
  },
  {
    id: 'exp01',
    exp_number: 1,
    title: 'Stacking ΔG₃₇ is calibrated to nearest-neighbor parameters',
    blurb: 'Within-database calibration of stacking ΔG₃₇ against SantaLucia 2004 nearest-neighbor parameters yields r = 0.998 on a 5,000-region benchmark.',
    outcome: 'strong_positive',
    cluster: 'biophysics_proof',
    posted_at: '2026-02-04',
    metric: 'r = 0.998',
  },
];

export const CLUSTER_LABEL: Record<ClaimCluster, string> = {
  recombination:     'Recombination',
  methylation:       'Methylation',
  TE_silencing:      'TE silencing',
  biophysics_proof:  'Biophysics proofs',
  HLA:               'HLA',
  cancer:            'Cancer',
};

export const CLUSTER_COLOR: Record<ClaimCluster, string> = {
  recombination:     '#0F62FE',
  methylation:       '#BE123C',
  TE_silencing:      '#7C3AED',
  biophysics_proof:  '#08A097',
  HLA:               '#B45309',
  cancer:            '#52525B',
};

export interface OutcomeBadge {
  label: string;
  color: string;
  bg: string;
}

export function getOutcomeBadge(o: ClaimOutcome): OutcomeBadge {
  switch (o) {
    case 'strong_positive':
      return { label: 'STRONG +', color: '#0F62FE', bg: '#0F62FE1F' };
    case 'positive':
      return { label: 'POSITIVE', color: '#0F62FE', bg: '#0F62FE12' };
    case 'qualified_positive':
      return { label: 'QUALIFIED', color: '#B45309', bg: '#B453091F' };
    case 'negative':
      return { label: 'NEGATIVE', color: '#BE123C', bg: '#BE123C1F' };
    case 'fail':
      return { label: 'FAIL', color: '#BE123C', bg: '#BE123C2A' };
  }
}
