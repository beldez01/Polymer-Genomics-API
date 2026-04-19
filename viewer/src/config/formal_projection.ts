/**
 * Typed re-export of the FormalClaim 3D projection artifact.
 *
 * Source of truth: /internal/InSilico/projection/formal_claim_projection_v1.json
 * Built by:        /scripts/build_formal_claim_projection.py (`make projection`)
 *
 * Coords are pre-computed via PCA on a structural feature vector extracted
 * from each FormalClaim DAG (see src/polymer_genomics/formal_claims/feature_extractor.py).
 *
 * Re-runs of the builder are byte-deterministic — bumping this file should be
 * a side-effect of bumping the artifact, not vice-versa.
 */

import type { Outcome } from './formal_claims';
// JSON import — Next.js / TypeScript with resolveJsonModule=true treats this
// as a typed module. The relative path crosses out of viewer/ into the repo
// root; symlink-free import works because the JSON is committed to the repo.
import projectionData from '../../../internal/InSilico/projection/formal_claim_projection_v1.json';

export interface FormalProjectionClaim {
  id: string;
  topic: string;
  outcome: Outcome;
  depends_on: string[];
  /** [x, y, z] from PCA on a 48-dim feature vector. */
  projection_3d: [number, number, number];
}

export interface FormalProjectionArtifact {
  schema_version: string;
  method: string;
  generated_at: string;
  random_state: number;
  n_claims: number;
  feature_dim_total: number;
  feature_dim_kept_after_zero_var_drop: number;
  feature_names: string[];
  dropped_zero_variance_features: string[];
  explained_variance: [number, number, number];
  top_features_per_pc: [string, number][][]; // 3 PCs × 5 (name, signed loading)
  silhouette: { by_topic: number | null; by_outcome: number | null };
  depends_on_distance: {
    n_edges: number;
    mean_observed: number | null;
    mean_null: number | null;
    p_value: number | null;
    n_perm: number;
  };
  claims: FormalProjectionClaim[];
}

export const PROJECTION: FormalProjectionArtifact =
  projectionData as unknown as FormalProjectionArtifact;

/** Color palette by outcome — drawn from theme accent tokens for consistency. */
export const OUTCOME_COLORS: Record<Outcome, string> = {
  positive: '#4ECDC4',         // accent.teal
  strong_positive: '#8B5CF6',  // accent.violet
  qualified_positive: '#F0A500', // accent.amber
  negative: '#F43F5E',         // accent.rose
  fail: '#6B7280',             // gray (unused in current corpus)
};

/** Index of claims by id for O(1) edge lookup. */
export const CLAIMS_BY_ID: Record<string, FormalProjectionClaim> = Object.fromEntries(
  PROJECTION.claims.map((c) => [c.id, c]),
);

/** Resolved depends_on edges as [source, target] coordinate pairs. */
export interface ResolvedEdge {
  source: FormalProjectionClaim;
  target: FormalProjectionClaim;
}

export const EDGES: ResolvedEdge[] = PROJECTION.claims.flatMap((source) =>
  source.depends_on
    .map((targetId) => CLAIMS_BY_ID[targetId])
    .filter((target): target is FormalProjectionClaim => target !== undefined)
    .map((target) => ({ source, target })),
);
