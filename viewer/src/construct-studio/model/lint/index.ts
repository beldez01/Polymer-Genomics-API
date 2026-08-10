import type { Workspace } from '../types'
import publicPack from './pack.public.json'
import { ALL_RULES } from './rules'
import { UNSOURCED, type LintFinding, type RulePack } from './types'

export * from './types'
export { ALL_RULES }

/**
 * The site build carries ONLY the public pack. The internal pack is not merely
 * unused here, it is absent: a JSON module that is imported is bundled, so an
 * internal citation left in this directory would be readable in the shipped
 * JavaScript even with every rule that quotes it disabled. Do not add
 * pack.default.json to this copy.
 */
export const DEFAULT_PACK = publicPack as unknown as RulePack

/**
 * The subset of findings that name a place on a strand, as paintable ranges.
 * A finding about a design or a panel has nothing to mark, so it is dropped
 * here rather than guessed at.
 */
export function findingRanges(
  findings: readonly LintFinding[],
): Array<{ strandId: string; from: number; to: number }> {
  const ranges: Array<{ strandId: string; from: number; to: number }> = []
  for (const finding of findings) {
    if (!finding.strandId || finding.start === undefined || finding.end === undefined) continue
    ranges.push({ strandId: finding.strandId, from: finding.start, to: finding.end })
  }
  return ranges
}

/** Run every enabled rule, tagging unpacked rules explicitly as unverified. */
export function runLint(workspace: Workspace, pack: RulePack = DEFAULT_PACK): LintFinding[] {
  const findings: LintFinding[] = []
  for (const rule of ALL_RULES) {
    const entry = pack.rules[rule.id] ?? UNSOURCED
    if (entry.enabled === false) continue
    findings.push(...rule.check({ workspace, entry }))
  }
  return findings
}
