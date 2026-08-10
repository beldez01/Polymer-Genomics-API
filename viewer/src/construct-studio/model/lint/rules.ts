import { longestHelix } from '../duplex'
import type { LintFinding, LintRule, RuleContext } from './types'

/**
 * The PUBLIC subset of the rule pack.
 *
 * The studio repository implements seven rules; this copy carries one. The
 * others are not merely disabled here, they are absent, because a rule
 * discloses through its message template as much as through its citation and a
 * string literal ships in the bundle whether or not the rule ever runs.
 *
 * Do not copy a rule in from the studio repository without checking the Polymer
 * Biologics document register first.
 */

function finding(
  context: RuleContext,
  ruleId: string,
  partial: Omit<LintFinding, 'ruleId' | 'provenance' | 'source'>,
): LintFinding {
  return {
    ruleId,
    provenance: context.entry.provenance,
    source: context.entry.source,
    ...partial,
  }
}

/** Long uninterrupted dsRNA helices activate PKR. Pure geometry, no folding engine. */
const pkrHelix: LintRule = {
  id: 'PKR-DSRNA-HELIX',
  check(context) {
    const minimum = context.entry.thresholds?.minHelixBp
    if (minimum === undefined) return []

    const findings: LintFinding[] = []
    for (const duplex of context.workspace.duplexes) {
      const helix = longestHelix(duplex, context.workspace.strands)
      if (helix.length < minimum) continue

      const wobbleNote = helix.wobbles > 0
        ? ` ${helix.wobbles} of those pairs are G-U wobbles, which still stack as helix.`
        : ''
      findings.push(
        finding(context, 'PKR-DSRNA-HELIX', {
          severity: 'warn',
          message:
            `Duplex ${duplex.id} holds an uninterrupted ${helix.length} bp helix, at or past the ` +
            `${minimum} bp threshold reported to activate PKR, the innate immune dsRNA sensor.` +
            wobbleNote,
          strandId: duplex.a.strandId,
          start: helix.aStart,
          end: helix.aEnd,
        }),
      )
    }
    return findings
  },
}

export const ALL_RULES: LintRule[] = [pkrHelix]
