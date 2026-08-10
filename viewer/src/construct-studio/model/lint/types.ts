import type { Workspace } from '../types'

/**
 * The tag vocabulary of `docs/rna-design/CONVENTIONS.md`, which is the authority.
 * A tag says how much a rule can be trusted to hold, not how plausible it sounds.
 *
 * - `PRIMARY` — a peer-reviewed study reporting the data the rule came from.
 * - `REVIEW` — a review or benchmark restating someone else's result.
 * - `VENDOR` — a supplier or kit-maker page; often right, never independently checked.
 * - `UNVERIFIED` — stated somewhere, never traced past the same statement repeated.
 * - `CONFLICT` — sources disagree; both recorded, with a recommendation.
 * - `EMPIRICAL` — observed in our own hands. Say where the data lives.
 */
export type Provenance =
  | 'PRIMARY' | 'REVIEW' | 'VENDOR' | 'UNVERIFIED' | 'CONFLICT' | 'EMPIRICAL'

export interface LintFinding {
  ruleId: string
  provenance: Provenance
  source: string
  severity: 'warn' | 'info'
  message: string
  strandId?: string
  designId?: string
  panelId?: string
  start?: number
  end?: number
}

export interface RuleEntry {
  provenance: Provenance
  source: string
  thresholds?: Record<string, number>
  enabled?: boolean
}

export interface RulePack {
  packVersion: string
  rules: Record<string, RuleEntry>
}

export interface RuleContext {
  workspace: Workspace
  entry: RuleEntry
}

export interface LintRule {
  id: string
  check(context: RuleContext): LintFinding[]
}

export const UNSOURCED: RuleEntry = {
  provenance: 'UNVERIFIED',
  source: 'no source recorded for this rule',
}
