/**
 * Typed Claim Graph — Expanded Schema (v2)
 *
 * The v1 schema (TYPED_CLAIMS.md) used 8 purely topological features. PCA on that
 * vector showed PC1+PC2 = 95% of variance — the space was effectively 2D because
 * all 8 features were aliases of "how big and branchy is the argument". This v2
 * schema adds semantically orthogonal axes (epistemic quality, method, scale) so
 * the landscape spreads across more effective dimensions.
 *
 * Layers:
 *   1. Topology (8)          — graph shape metrics (kept, but acknowledged as redundant)
 *   2. Epistemic quality (6) — how well-constructed the claim is
 *   3. Method signature (5)  — what kind of finding it is (one-hot)
 *   4. Scale (2)             — at what genomic resolution and sample size
 *
 * Total: 21 features per claim.
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type Outcome =
  | 'strong_positive'
  | 'positive'
  | 'qualified_positive'
  | 'negative'
  | 'fail';

export type ClaimType = 'rule' | 'observation' | 'proof';

export type Cluster =
  | 'well_defended_rule'
  | 'simple_positive'
  | 'null_failed'
  | 'qualified_proof';

export type NodeType = 'assertion' | 'evidence' | 'qualifier' | 'exception' | 'context';

export type EdgeRelation =
  | 'supports'
  | 'strengthens'
  | 'qualifies'
  | 'contradicts_within'
  | 'contextualizes';

export interface ClaimGraphNode {
  id: string;
  type: NodeType;
  text: string;
  value?: number | null;
}

export interface ClaimGraphEdge {
  from: string;
  to: string;
  relation: EdgeRelation;
}

export interface ClaimGraph {
  nodes: ClaimGraphNode[];
  edges: ClaimGraphEdge[];
}

// ---------------------------------------------------------------------------
// Feature vector — 21 dimensions across 4 layers
// ---------------------------------------------------------------------------

export interface ClaimFeatures {
  // --- Layer 1: Topology (8) ---
  // Graph shape only. These are highly correlated but kept as the structural spine.
  n_nodes_log: number;          // log2(1 + n_nodes)
  n_edges_log: number;          // log2(1 + n_edges)
  evidence_density: number;     // n_evidence / n_nodes
  qualifier_density: number;    // n_qualifier / n_nodes
  exception_density: number;    // n_exception / n_nodes
  max_depth: number;            // longest path from assertion root
  branching_factor: number;     // mean edges per node
  defense_density: number;      // n_strengthens / n_edges

  // --- Layer 2: Epistemic quality (6) ---
  effect_magnitude_log: number; // log10(1 + |peak evidence value|)
  gc_controlled: 0 | 1 | 2;     // 0=no, 1=partial, 2=fully/within-strata
  within_group_tested: 0 | 1;   // within-age, within-protein, within-strata, etc.
  replicated: 0 | 1;            // independently reproduced
  evidence_entropy: number;     // Shannon entropy over evidence-class mix (M/K/D/S/H)
  data_layer_count: number;     // # distinct data layers the claim touches

  // --- Layer 3: Method signature (5, one-hot; mixed methods can set multiple) ---
  method_statistical: 0 | 1;    // correlation, regression
  method_proof: 0 | 1;          // mathematical (LP, constraint)
  method_ml: 0 | 1;             // classifier, random forest, deep net
  method_partial_corr: 0 | 1;   // partial correlation with covariates
  method_enrichment: 0 | 1;     // overlap / enrichment against null

  // --- Layer 4: Scale (2) ---
  scale_log: number;            // log10(primary resolution in bp)
  n_instances_log: number;      // log10(sample size — # TEs, # genes, # probes, etc.)
}

export interface Claim {
  id: string;
  exp_number: number;
  title: string;
  assertion: string;
  outcome: Outcome;
  claim_type: ClaimType;
  cluster: Cluster;
  domain: string;
  color: string;
  features: ClaimFeatures;
  /** ISO date (YYYY-MM-DD) when the claim was posted to the feed */
  posted_at: string;
  /** Pre-computed PCA projections (populated by scripts/compute_claim_projections.py) */
  projection_2d: [number, number];
  projection_3d: [number, number, number];
  /** Optional full claim graph for the detail panel */
  claim_graph?: ClaimGraph;
}

// Flatten a ClaimFeatures object to a numeric vector (for PCA, distance, etc.)
export function featureVector(f: ClaimFeatures): number[] {
  return [
    f.n_nodes_log, f.n_edges_log,
    f.evidence_density, f.qualifier_density, f.exception_density,
    f.max_depth, f.branching_factor, f.defense_density,
    f.effect_magnitude_log,
    f.gc_controlled, f.within_group_tested, f.replicated,
    f.evidence_entropy, f.data_layer_count,
    f.method_statistical, f.method_proof, f.method_ml, f.method_partial_corr, f.method_enrichment,
    f.scale_log, f.n_instances_log,
  ];
}

export const FEATURE_NAMES = [
  'n_nodes_log', 'n_edges_log',
  'evidence_density', 'qualifier_density', 'exception_density',
  'max_depth', 'branching_factor', 'defense_density',
  'effect_magnitude_log',
  'gc_controlled', 'within_group_tested', 'replicated',
  'evidence_entropy', 'data_layer_count',
  'method_statistical', 'method_proof', 'method_ml', 'method_partial_corr', 'method_enrichment',
  'scale_log', 'n_instances_log',
] as const;

// ---------------------------------------------------------------------------
// Cluster metadata
// ---------------------------------------------------------------------------

export const CLUSTER_COLORS: Record<Cluster, string> = {
  well_defended_rule: '#4ECDC4', // teal
  simple_positive:    '#F0A500', // amber
  null_failed:        '#F43F5E', // rose
  qualified_proof:    '#8B5CF6', // violet
};

export const CLUSTER_LABELS: Record<Cluster, string> = {
  well_defended_rule: 'Well-defended rule',
  simple_positive:    'Simple positive',
  null_failed:        'Null / failed',
  qualified_proof:    'Qualified / proof',
};

export const CLUSTER_DESCRIPTIONS: Record<Cluster, string> = {
  well_defended_rule: 'Rich topology, multiple confound checks, cross-layer.',
  simple_positive:    'Clear evidence but shallow defense — single method, single layer.',
  null_failed:        'No signal, or signal captured entirely by GC control.',
  qualified_proof:    'Mathematical proof or heavily hedged — unique structural signature.',
};

// Principal component axis interpretation (from v2 PCA loadings)
export const PC_AXES = [
  {
    name: 'PC1',
    label: 'Argument richness',
    variance: 0.342,
    description: 'Evidence entropy + layer count + defense density + max depth + branching',
  },
  {
    name: 'PC2',
    label: 'Method rigor / scale',
    variance: 0.176,
    description: 'Proof + replicated at small scale vs statistical at genome-wide scale',
  },
  {
    name: 'PC3',
    label: 'Effect under confounds',
    variance: 0.146,
    description: 'Raw effect magnitude survived by GC + partial correlation control',
  },
] as const;

// ---------------------------------------------------------------------------
// The 10 decomposed claims (re-encoded against v2 schema)
// ---------------------------------------------------------------------------

export const CLAIMS: Claim[] = [
  {
    id: 'exp03_te_silencing',
    exp_number: 3,
    title: 'TE Silencing Mechanism',
    assertion: 'DNA biophysical properties predict TE silencing mechanism (H3K9me3 vs H3K27me3). Stacking energy is the top feature; signal survives GC and within-age controls.',
    outcome: 'positive',
    claim_type: 'rule',
    cluster: 'well_defended_rule',
    domain: 'transposome',
    color: '#4ECDC4',
    features: {
      n_nodes_log: 3.17, n_edges_log: 3.17,
      evidence_density: 0.625, qualifier_density: 0.125, exception_density: 0.0,
      max_depth: 3, branching_factor: 1.0, defense_density: 0.375,
      effect_magnitude_log: 0.235,     // AUROC 0.716
      gc_controlled: 2, within_group_tested: 1, replicated: 0,
      evidence_entropy: 1.10, data_layer_count: 4,
      method_statistical: 0, method_proof: 0, method_ml: 1, method_partial_corr: 0, method_enrichment: 0,
      scale_log: 2.17,                 // 147 bp
      n_instances_log: 6.66,           // ~4.6M TEs
    },
    posted_at: '2026-01-10',
    projection_2d: [2.300, 0.744],
    projection_3d: [2.300, 0.744, 0.644],
  },

  {
    id: 'exp09_nucleosome_fail',
    exp_number: 9,
    title: 'Nucleosome Positioning FAIL',
    assertion: 'Physics does not predict MNase nucleosome positioning at 1 kb resolution. Periodicity r=−0.03; after GC control, partial r=−0.009 (signal is GC).',
    outcome: 'fail',
    claim_type: 'observation',
    cluster: 'null_failed',
    domain: 'chromatin',
    color: '#F43F5E',
    features: {
      n_nodes_log: 2.0, n_edges_log: 1.58,
      evidence_density: 0.667, qualifier_density: 0.0, exception_density: 0.0,
      max_depth: 1, branching_factor: 1.0, defense_density: 0.0,
      effect_magnitude_log: 0.013,     // |r|=0.03
      gc_controlled: 2, within_group_tested: 0, replicated: 0,
      evidence_entropy: 0.30, data_layer_count: 3,
      method_statistical: 0, method_proof: 0, method_ml: 0, method_partial_corr: 1, method_enrichment: 0,
      scale_log: 3.0,                  // 1 kb
      n_instances_log: 6.48,           // ~3M genome-wide bins
    },
    posted_at: '2026-01-28',
    projection_2d: [-1.109, -1.400],
    projection_3d: [-1.109, -1.400, -4.160],
  },

  {
    id: 'exp11_cdi_negative',
    exp_number: 11,
    title: 'CDI Negative',
    assertion: 'Q-weighted entropy (CDI) is not distinct from ThermAge on 450K arrays — r=0.9991 between them.',
    outcome: 'negative',
    claim_type: 'observation',
    cluster: 'null_failed',
    domain: 'clocks',
    color: '#F43F5E',
    features: {
      n_nodes_log: 2.32, n_edges_log: 2.0,
      evidence_density: 0.25, qualifier_density: 0.5, exception_density: 0.0,
      max_depth: 1, branching_factor: 0.75, defense_density: 0.0,
      effect_magnitude_log: 0.300,     // r=0.9991 (correlation with existing clock)
      gc_controlled: 0, within_group_tested: 0, replicated: 0,
      evidence_entropy: 0.0, data_layer_count: 2,
      method_statistical: 1, method_proof: 0, method_ml: 0, method_partial_corr: 0, method_enrichment: 0,
      scale_log: 2.65,                 // probe-level ~450 bp
      n_instances_log: 5.65,           // 450K probes
    },
    posted_at: '2026-02-14',
    projection_2d: [-4.699, -2.536],
    projection_3d: [-4.699, -2.536, 1.844],
  },

  {
    id: 'exp15_te_gene_correlation',
    exp_number: 15,
    title: 'TE-Gene Correlation Atlas',
    assertion: 'TE class correlates with gene expression, GC-independent: SINEs +0.18, LTRs −0.18, LINEs −0.14 (partial r). Random forest R²=37.7%.',
    outcome: 'positive',
    claim_type: 'rule',
    cluster: 'simple_positive',
    domain: 'transposome',
    color: '#F0A500',
    features: {
      n_nodes_log: 3.0, n_edges_log: 2.81,
      evidence_density: 0.714, qualifier_density: 0.143, exception_density: 0.0,
      max_depth: 1, branching_factor: 0.857, defense_density: 0.167,
      effect_magnitude_log: 0.072,     // |r|=0.18
      gc_controlled: 2, within_group_tested: 0, replicated: 0,
      evidence_entropy: 1.20, data_layer_count: 3,
      method_statistical: 0, method_proof: 0, method_ml: 1, method_partial_corr: 1, method_enrichment: 0,
      scale_log: 4.0,                  // gene-level ~10 kb
      n_instances_log: 4.30,           // ~20K genes
    },
    posted_at: '2026-03-02',
    projection_2d: [0.555, -0.150],
    projection_3d: [0.555, -0.150, -1.720],
  },

  {
    id: 'exp16_hla_biophysics',
    exp_number: 16,
    title: 'HLA Expression-Biophysics',
    assertion: 'HLA-A allele expression correlates with non-coding biophysics. HLA-A dG37 vs TPM r=−0.76; within-protein Cohen\'s d=2.49; HLA-A > HLA-B > HLA-C gradient tracks correlation strength.',
    outcome: 'positive',
    claim_type: 'observation',
    cluster: 'simple_positive',
    domain: 'hla',
    color: '#8B5CF6',
    features: {
      n_nodes_log: 3.0, n_edges_log: 2.81,
      evidence_density: 0.571, qualifier_density: 0.143, exception_density: 0.0,
      max_depth: 1, branching_factor: 0.857, defense_density: 0.333,
      effect_magnitude_log: 0.246,     // |r|=0.76
      gc_controlled: 1, within_group_tested: 1, replicated: 0,
      evidence_entropy: 1.10, data_layer_count: 3,
      method_statistical: 1, method_proof: 0, method_ml: 0, method_partial_corr: 0, method_enrichment: 0,
      scale_log: 4.70,                 // HLA gene region ~50 kb
      n_instances_log: 2.00,           // ~100 alleles
    },
    posted_at: '2026-03-10',
    projection_2d: [-0.154, -1.051],
    projection_3d: [-0.154, -1.051, 2.437],
  },

  {
    id: 'exp17_crossover_hotspot',
    exp_number: 17,
    title: 'Crossover Hotspot Biophysics',
    assertion: 'Meiotic crossover hotspots are biophysically distinct from non-crossover sites. AUROC 0.827 without GC. CO and NCO are also distinct from each other.',
    outcome: 'strong_positive',
    claim_type: 'observation',
    cluster: 'simple_positive',
    domain: 'recombination',
    color: '#4ECDC4',
    features: {
      n_nodes_log: 2.58, n_edges_log: 2.32,
      evidence_density: 0.6, qualifier_density: 0.2, exception_density: 0.0,
      max_depth: 1, branching_factor: 0.8, defense_density: 0.25,
      effect_magnitude_log: 0.262,     // AUROC 0.827
      gc_controlled: 2, within_group_tested: 1, replicated: 0,
      evidence_entropy: 1.00, data_layer_count: 4,
      method_statistical: 0, method_proof: 0, method_ml: 1, method_partial_corr: 0, method_enrichment: 0,
      scale_log: 3.0,                  // 1 kb hotspot
      n_instances_log: 4.95,           // 89K hotspots
    },
    posted_at: '2026-03-18',
    projection_2d: [0.033, -0.654],
    projection_3d: [0.033, -0.654, 0.076],
  },

  {
    id: 'exp18_gene_flanking',
    exp_number: 18,
    title: 'Gene-Flanking Biophysics',
    assertion: 'DNA deformability predicts gene expression in gene bodies, GC-independent. Partial r=−0.345 (body); curvature +0.285. 5 of 6 hypotheses supported; promoter deformability failed.',
    outcome: 'positive',
    claim_type: 'rule',
    cluster: 'well_defended_rule',
    domain: 'gene_expression',
    color: '#4ECDC4',
    features: {
      n_nodes_log: 3.32, n_edges_log: 3.46,
      evidence_density: 0.556, qualifier_density: 0.111, exception_density: 0.111,
      max_depth: 3, branching_factor: 1.111, defense_density: 0.4,
      effect_magnitude_log: 0.129,     // |r|=0.345
      gc_controlled: 2, within_group_tested: 1, replicated: 0,
      evidence_entropy: 1.40, data_layer_count: 5,
      method_statistical: 0, method_proof: 0, method_ml: 0, method_partial_corr: 1, method_enrichment: 1,
      scale_log: 4.0,                  // gene-level
      n_instances_log: 4.30,           // ~20K genes
    },
    posted_at: '2026-03-25',
    projection_2d: [4.954, 0.580],
    projection_3d: [4.954, 0.580, 0.855],
  },

  {
    id: 'exp19_rapid_response',
    exp_number: 19,
    title: 'Rapid-Response Gene Biophysics',
    assertion: 'Rapid-response genes (immediate-early, stress) show distinct flanking biophysics vs housekeeping. Signal survives GC control but is weaker than gene-body signal from Exp 18.',
    outcome: 'qualified_positive',
    claim_type: 'observation',
    cluster: 'qualified_proof',
    domain: 'gene_expression',
    color: '#F0A500',
    features: {
      n_nodes_log: 3.0, n_edges_log: 2.81,
      evidence_density: 0.286, qualifier_density: 0.286, exception_density: 0.0,
      max_depth: 1, branching_factor: 0.857, defense_density: 0.167,
      effect_magnitude_log: 0.050,     // small effect, uncertain
      gc_controlled: 2, within_group_tested: 1, replicated: 0,
      evidence_entropy: 0.60, data_layer_count: 3,
      method_statistical: 0, method_proof: 0, method_ml: 0, method_partial_corr: 1, method_enrichment: 0,
      scale_log: 4.0,                  // gene-level
      n_instances_log: 2.70,           // ~500 rapid-response genes
    },
    posted_at: '2026-03-30',
    projection_2d: [-0.259, -0.793],
    projection_3d: [-0.259, -0.793, 0.033],
  },

  {
    id: 'exp21_arrangement_envelope',
    exp_number: 21,
    title: 'Arrangement Envelope (LP Proof)',
    assertion: 'Biophysical arrangement capacity varies 9–87% across 13 parameters at FIXED GC content. LP optimization establishes bounds; this is a proof, not a statistical finding.',
    outcome: 'positive',
    claim_type: 'proof',
    cluster: 'qualified_proof',
    domain: 'biophysics',
    color: '#8B5CF6',
    features: {
      n_nodes_log: 3.17, n_edges_log: 3.0,
      evidence_density: 0.625, qualifier_density: 0.25, exception_density: 0.0,
      max_depth: 1, branching_factor: 0.875, defense_density: 0.0,
      effect_magnitude_log: 0.272,     // 87% arrangement capacity
      gc_controlled: 2, within_group_tested: 0, replicated: 1,
      evidence_entropy: 0.20, data_layer_count: 1,
      method_statistical: 0, method_proof: 1, method_ml: 0, method_partial_corr: 0, method_enrichment: 0,
      scale_log: 0.48,                 // 3-mer window
      n_instances_log: 1.81,           // 64 trimers
    },
    posted_at: '2026-04-07',
    projection_2d: [-3.728, 5.039],
    projection_3d: [-3.728, 5.039, 0.054],
  },

  {
    id: 'exp22_cpg_erosion',
    exp_number: 22,
    title: 'CpG Erosion Chronometer',
    assertion: 'CpG erosion tracks TE evolutionary age — 12 of 13 biophysical parameters correlate with TE age. SINEs maintain a reservoir (0.86 obs/exp young); universal erosion floor 0.15. Roll exception confirms the rule via arrangement-capacity buffering.',
    outcome: 'positive',
    claim_type: 'rule',
    cluster: 'well_defended_rule',
    domain: 'transposome',
    color: '#4ECDC4',
    features: {
      n_nodes_log: 3.0, n_edges_log: 3.17,
      evidence_density: 0.571, qualifier_density: 0.0, exception_density: 0.143,
      max_depth: 2, branching_factor: 1.143, defense_density: 0.125,
      effect_magnitude_log: 0.283,     // 12/13 = 0.92
      gc_controlled: 1, within_group_tested: 1, replicated: 0,
      evidence_entropy: 1.00, data_layer_count: 3,
      method_statistical: 0, method_proof: 0, method_ml: 0, method_partial_corr: 1, method_enrichment: 0,
      scale_log: 3.0,                  // TE-level
      n_instances_log: 6.66,           // ~4.6M TEs
    },
    posted_at: '2026-04-10',
    projection_2d: [2.107, 0.224],
    projection_3d: [2.107, 0.224, -0.063],
  },
];
