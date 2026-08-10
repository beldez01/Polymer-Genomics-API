import { canPair } from './duplex'
import type { RnaStrand } from './types'

export interface CounterTargetHit {
  strandId: string
  name: string
  pairs: number
  offset: number
}

export interface SpecificityReport {
  onTargetPairs: number
  counterTargets: CounterTargetHit[]
  /** On-target pairs minus the worst counter-target's pairs. Higher is safer. */
  margin: number
}

/**
 * Find the best gapless antiparallel alignment of `probe` in `targetSeq`.
 * probe[i] is compared with target[offset + probe.length - 1 - i].
 */
export function bestAlignment(probe: string, targetSeq: string): { offset: number; pairs: number } {
  const probeLength = probe.length
  let bestPairs = 0
  let bestOffset = 0

  for (let offset = 0; offset + probeLength <= targetSeq.length; offset += 1) {
    let pairs = 0
    for (let i = 0; i < probeLength; i += 1) {
      const kind = canPair(probe[i], targetSeq[offset + probeLength - 1 - i])
      if (kind === 'canonical' || kind === 'wobble') pairs += 1
    }
    if (pairs > bestPairs) {
      bestPairs = pairs
      bestOffset = offset
    }
  }

  return { offset: bestOffset, pairs: bestPairs }
}

/**
 * Score a probe against its intended target and every counter-target.
 * A fusion sensor that scores as well on a parental transcript as it does on
 * the fusion has a zero specificity margin.
 */
export function evaluateSpecificity(
  probeSeq: string,
  onTarget: RnaStrand,
  counterTargets: RnaStrand[],
): SpecificityReport {
  const onTargetPairs = bestAlignment(probeSeq, onTarget.sequence).pairs

  const hits: CounterTargetHit[] = counterTargets.map((counterTarget) => {
    const best = bestAlignment(probeSeq, counterTarget.sequence)
    return {
      strandId: counterTarget.id,
      name: counterTarget.name,
      pairs: best.pairs,
      offset: best.offset,
    }
  })
  hits.sort((a, b) => b.pairs - a.pairs)

  const worstPairs = hits.length > 0 ? hits[0].pairs : 0
  return {
    onTargetPairs,
    counterTargets: hits,
    margin: onTargetPairs - worstPairs,
  }
}
