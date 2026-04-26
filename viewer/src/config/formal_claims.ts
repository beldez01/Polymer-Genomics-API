/**
 * Formal Claim IR (schema v1.2) — TypeScript mirror of schema.py
 *
 * Spec:    internal/epistemic_os/MASTER_PLAN.md §5 (v1.2 additions)
 *          internal/epistemic_os/13_FORMAL_CLAIM_IR.md §3 (v1.1 base)
 * Python:  src/polymer_genomics/formal_claims/schema.py
 * Fixture: internal/epistemic_os/fixtures/exp17_formal_claim.json  (v1.1)
 *
 * This file provides static types only (no runtime validation). Pydantic
 * on the Python side is the source of truth; keep that and this in sync.
 *
 * v1.2 adds: polymorphic `subject` slot (10 kinds), `domain` discriminator,
 * per-domain `context` envelope. v1.1 fixtures remain type-valid (the
 * v1.2 fields are all optional on `FormalClaim`).
 */

export const FORMAL_CLAIM_SCHEMA_VERSION = 'v1.2' as const;
export const FORMAL_CLAIM_SCHEMA_VERSIONS_SUPPORTED = ['v1.1', 'v1.2'] as const;
export type FormalClaimSchemaVersion =
  (typeof FORMAL_CLAIM_SCHEMA_VERSIONS_SUPPORTED)[number];

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type ProvenanceState =
  | 'fly_postgres'
  | 'local_rds'
  | 'remote_url'
  | 'reference_genome'
  | 'unknown';

export type EvidenceClass = 'M' | 'R' | 'D' | 'S' | 'K' | 'H' | 'L';

export type Outcome =
  | 'strong_positive'
  | 'positive'
  | 'qualified_positive'
  | 'negative'
  | 'fail';

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

export interface LayerRef {
  layer: string;
  version: string;
  provenance_state: ProvenanceState;
  note?: string | null;
}

export interface DataDerivedConstant {
  kind: 'derived';
  source_operation: string;
  fn: 'quantile' | 'mean' | 'median' | 'sd' | 'min' | 'max' | 'count';
  col: string;
  params?: Record<string, unknown> | null;
}

export interface FeatureSet {
  label: string;
  select?: string[] | null;
  exclude?: string[] | null;
  parent?: string | null;
  resolved?: string[] | null;
}

// ---------------------------------------------------------------------------
// SetExpression — predicates over layers (recursive)
// ---------------------------------------------------------------------------

export type CmpRhs =
  | number
  | boolean
  | string
  | number[]
  | string[]
  | boolean[]
  | DataDerivedConstant;

export type SetExpression =
  | { kind: 'and'; terms: SetExpression[] }
  | { kind: 'or'; terms: SetExpression[] }
  | { kind: 'not'; term: SetExpression }
  | {
      kind: 'cmp';
      col: string;
      op: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'overlaps';
      rhs: CmpRhs;
    }
  | { kind: 'join'; on: string; other: LayerRef; where?: SetExpression | null };

// ---------------------------------------------------------------------------
// Premise
// ---------------------------------------------------------------------------

export interface Premise {
  id: string;
  source: LayerRef;
  predicate: SetExpression;
  cardinality: number | null;
  content_hash: string;
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Operation — typed DAG nodes (discriminated on `kind`)
// ---------------------------------------------------------------------------

export interface Agg {
  col: string;
  fn: 'mean' | 'median' | 'sum' | 'count' | 'min' | 'max' | 'sd';
  na_rm?: boolean;
}

export type CVScheme =
  | { kind: 'k_fold_by_chromosome'; k: number; seed: number }
  | { kind: 'k_fold_random'; k: number; seed: number }
  | { kind: 'leave_one_out' }
  | { kind: 'stratified_k_fold'; k: number; by: string; seed: number };

export interface EstimatorSpec {
  name: string;
  impl: string;
  version: string;
  response?: string | null;
  features?: FeatureSet | null;
  params: Record<string, unknown>;
}

export interface NullModelSpec {
  kind: 'label_shuffle' | 'circular_shift' | 'parametric' | 'block_bootstrap';
  n_perms?: number | null;
  seed?: number | null;
  params?: Record<string, unknown>;
}

export type Operation =
  | { id: string; kind: 'filter'; inputs: [string]; predicate: SetExpression; note?: string | null }
  | { id: string; kind: 'project'; inputs: [string]; cols: string[]; note?: string | null }
  | { id: string; kind: 'join'; inputs: [string, string]; on: string; note?: string | null }
  | { id: string; kind: 'aggregate'; inputs: [string]; by: string[]; agg: Agg[]; note?: string | null }
  | { id: string; kind: 'cv_split'; inputs: [string]; scheme: CVScheme; note?: string | null }
  | { id: string; kind: 'estimator'; inputs: string[]; estimator: EstimatorSpec; note?: string | null }
  | { id: string; kind: 'null_model'; inputs: string[]; spec: NullModelSpec; note?: string | null }
  | {
      id: string;
      kind: 'correct';
      inputs: [string];
      method: 'bh' | 'bonf' | 'perm' | 'knockoff';
      note?: string | null;
    };

// ---------------------------------------------------------------------------
// Statistic
// ---------------------------------------------------------------------------

export interface LabeledValue {
  label: string;
  value: number;
}

export type StatValue =
  | number
  | string
  | number[]
  | string[]
  | LabeledValue[];

export interface Statistic {
  id: string;
  produced_by: string;
  name: string;
  value: StatValue;
  ci?: [number, number] | null;
  n?: number | null;
  evidence_class: EvidenceClass;
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Inference rule — predicate over statistics (recursive)
// ---------------------------------------------------------------------------

export interface StatRef {
  stat_id: string;
  transform?: 'abs' | 'neg' | 'log' | null;
}

export type InferenceExpression =
  | { kind: 'and'; terms: InferenceExpression[] }
  | { kind: 'or'; terms: InferenceExpression[] }
  | { kind: 'not'; term: InferenceExpression }
  | {
      kind: 'cmp';
      lhs: StatRef;
      op: '<' | '<=' | '=' | '!=' | '>' | '>=';
      rhs: number | StatRef;
    };

export interface InferenceRule {
  expression: InferenceExpression;
  justification: string;
  failure_mode?: string | null;
}

// ---------------------------------------------------------------------------
// Conclusion
// ---------------------------------------------------------------------------

export interface ScopeBlock {
  layers: LayerRef[];
  restrictions?: SetExpression | null;
  scale_note?: string | null;
}

export interface Confidence {
  type: 'frequentist' | 'bayesian' | 'proof';
  value?: number | null;
  note?: string | null;
}

export interface CompositeConfidence {
  procedure: 'bootstrap' | 'permutation' | 'bayesian_posterior' | 'proof_certificate';
  impl: string;
  n_resamples?: number | null;
  seed?: number | null;
  interval?: [number, number] | null;
  prob_inference_holds?: number | null;
  note?: string | null;
}

export interface Conclusion {
  assertion: string;
  formal?: SetExpression | null;
  scope: ScopeBlock;
  confidence: Confidence;
  composite_confidence?: CompositeConfidence | null;
  outcome: Outcome;
}

// ---------------------------------------------------------------------------
// External assumptions + audits
// ---------------------------------------------------------------------------

export interface Audit {
  auditor: string;
  verdict: 'endorse' | 'contest' | 'revise_confidence' | 'defer';
  revised_confidence?: number | null;
  rationale: string;
  timestamp: string; // ISO-8601
}

export interface ExternalAssumption {
  statement: string;
  kind: 'literature' | 'mechanistic' | 'design_choice' | 'training_data_not_in_api';
  citation?: string | null;
  confidence: number; // [0, 1]
  audits?: Audit[] | null;
}

// ---------------------------------------------------------------------------
// v1.2 — Domain discriminator
// ---------------------------------------------------------------------------

export type Domain =
  | 'genomic'
  | 'transcriptomic'
  | 'single_cell'
  | 'clinical'
  | 'multi_modal'
  | 'other';

// ---------------------------------------------------------------------------
// v1.2 — polymorphic SubjectRef (10 kinds; discriminated on `kind`)
// ---------------------------------------------------------------------------

interface SubjectBase {
  id: string;
  display: string;
  note?: string | null;
}

export interface GenomicRegionSubject extends SubjectBase {
  kind: 'genomic_region';
  assembly: string;
  chrom: string;
  start: number;
  end: number;
  strand: '+' | '-' | '.';
}

export interface VariantVRSSubject extends SubjectBase {
  kind: 'variant_vrs';
  vrs_version: string;
  assembly?: string | null;
  hgvs?: string | null;
  canonical_allele?: Record<string, unknown> | null;
}

export interface S4ObjectRefSubject extends SubjectBase {
  kind: 's4_object';
  bioc_class: string;
  bioc_version: string;
  blob_uri: string;
  blob_hash: string;
  projection?: string | null;
  dims?: number[] | null;
}

export interface PhenopacketRetrieval {
  mode: 'reference' | 'inline';
  uri?: string | null;
  hash?: string | null;
}

export interface PhenopacketRefSubject extends SubjectBase {
  kind: 'phenopacket';
  phenopacket_version: string;
  retrieval: PhenopacketRetrieval;
  inline?: Record<string, unknown> | null;
}

export type OntologyVocabulary =
  | 'HPO'
  | 'MONDO'
  | 'GO'
  | 'EFO'
  | 'UBERON'
  | 'CL'
  | 'CHEBI'
  | 'PR'
  | 'DOID'
  | 'NCIT'
  | 'SO'
  | 'ECO'
  | 'other';

export interface OntologyTermSubject extends SubjectBase {
  kind: 'ontology_term';
  ontology: OntologyVocabulary;
  ontology_release: string; // ISO date
  uri: string;
  propagation:
    | 'self_only'
    | 'self_or_descendant'
    | 'self_or_ancestor'
    | 'exact_match';
}

export interface GeneOrProteinIdentifiers {
  hgnc?: string | null;
  ensembl_gene?: string | null;
  ensembl_transcript?: string | null;
  ensembl_protein?: string | null;
  ncbi_gene?: number | null;
  uniprot?: string | null;
  refseq?: string | null;
  symbol?: string | null;
}

export interface GeneOrProteinSubject extends SubjectBase {
  kind: 'gene_or_protein';
  identifiers: GeneOrProteinIdentifiers;
  entity_type: 'gene' | 'protein' | 'transcript' | 'isoform';
  assembly_context?: string | null;
}

export interface PathwayMembers {
  retrieval: 'reference' | 'inline';
  uri?: string | null;
  count_hint?: number | null;
  inline?: string[] | null;
}

export interface PathwayRefSubject extends SubjectBase {
  kind: 'pathway';
  source: 'Reactome' | 'KEGG' | 'WikiPathways' | 'MSigDB' | 'other';
  source_version: string;
  members?: PathwayMembers | null;
}

export interface CohortSourceDataset {
  name: string;
  version?: string | null;
  tissue?: string | null;
  extra?: Record<string, unknown> | null;
}

export interface CohortDefinition {
  source_dataset?: CohortSourceDataset | null;
  inclusion: SetExpression[];
  exclusion: SetExpression[];
  cardinality?: number | null;
  random_seed?: number | null;
}

export interface CohortSubject extends SubjectBase {
  kind: 'cohort';
  definition: CohortDefinition;
  members_hash: string;
}

export interface LiteralSubject extends SubjectBase {
  kind: 'literal';
  prose: string;
  structured?: Record<string, unknown> | null;
}

export interface CompositeSubject extends SubjectBase {
  kind: 'composite';
  parts: SubjectRef[];
  relation:
    | 'co_occurrence'
    | 'conditional'
    | 'causal_hypothesis'
    | 'temporal_sequence'
    | 'correlational';
}

export type SubjectRef =
  | GenomicRegionSubject
  | VariantVRSSubject
  | S4ObjectRefSubject
  | PhenopacketRefSubject
  | OntologyTermSubject
  | GeneOrProteinSubject
  | PathwayRefSubject
  | CohortSubject
  | LiteralSubject
  | CompositeSubject;

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface FormalClaim {
  $schema?: string | null;
  schema_version: FormalClaimSchemaVersion;

  id: string;
  exp_number?: number | null;
  title: string;
  posted_at: string;
  api_version: string;
  data_version: string;
  version: string;

  /** v1.2 additions — required when schema_version === 'v1.2'. */
  domain?: Domain | null;
  subject?: SubjectRef | null;
  context?: Record<string, unknown> | null;

  premises: Premise[];
  operations: Operation[];
  statistics: Statistic[];
  inference: InferenceRule;
  conclusion: Conclusion;

  depends_on: string[];
  external_assumptions: ExternalAssumption[];
  notebook?: string | null;
}

// ---------------------------------------------------------------------------
// Convenience type guards (used by the dev visualizer)
// ---------------------------------------------------------------------------

export const isDerivedConstant = (rhs: CmpRhs): rhs is DataDerivedConstant =>
  typeof rhs === 'object' && rhs !== null && !Array.isArray(rhs) && (rhs as DataDerivedConstant).kind === 'derived';

export const isStatRef = (rhs: number | StatRef): rhs is StatRef =>
  typeof rhs === 'object' && rhs !== null && 'stat_id' in rhs;
