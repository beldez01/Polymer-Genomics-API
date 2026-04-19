/**
 * Formal Claim IR (v3-formal, schema v1.1) — TypeScript mirror of schema.py
 *
 * Spec:    internal/epistemic_os/13_FORMAL_CLAIM_IR.md §3 (v1.1)
 * Python:  src/polymer_genomics/formal_claims/schema.py
 * Fixture: internal/epistemic_os/fixtures/exp17_formal_claim.json
 *
 * This file provides static types only (no runtime validation). Pydantic
 * on the Python side is the source of truth; keep that and this in sync.
 */

export const FORMAL_CLAIM_SCHEMA_VERSION = 'v1.1' as const;

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
// Root
// ---------------------------------------------------------------------------

export interface FormalClaim {
  $schema?: string | null;
  schema_version: 'v1.1';

  id: string;
  exp_number?: number | null;
  title: string;
  posted_at: string;
  api_version: string;
  data_version: string;
  version: string;

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
