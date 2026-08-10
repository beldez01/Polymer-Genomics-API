import { IUPAC_AMBIGUITY } from './sequence'
import type { Duplex, DuplexEvaluation, Mismatch, RnaStrand } from './types'

export type PairKind = 'canonical' | 'wobble' | 'mismatch' | 'ambiguous'

const CANONICAL = new Set(['AU', 'UA', 'GC', 'CG'])
const WOBBLE = new Set(['GU', 'UG'])

export function canPair(a: string, b: string): PairKind {
  if (IUPAC_AMBIGUITY.includes(a) || IUPAC_AMBIGUITY.includes(b)) return 'ambiguous'
  const key = `${a}${b}`
  if (CANONICAL.has(key)) return 'canonical'
  if (WOBBLE.has(key)) return 'wobble'
  return 'mismatch'
}

const COMPLEMENT: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' }

export function reverseComplement(seq: string): string {
  let out = ''
  for (let i = seq.length - 1; i >= 0; i -= 1) {
    out += COMPLEMENT[seq[i]] ?? 'N'
  }
  return out
}

export interface HelixRun {
  /** Base pairs in the run, canonical and wobble together. */
  length: number
  wobbles: number
  /** Half-open, in strand A's coordinates, so the canvas can mark the run. */
  aStart: number
  aEnd: number
}

/**
 * The longest uninterrupted run of base pairs in a duplex — pure geometry, no
 * folding. A mismatch, an ambiguity code or an overhanging position ends a run;
 * a G-U wobble does not, since it holds the helix together, but it is counted
 * separately so a caller can decide whether to treat the helix as perfect.
 */
export function longestHelix(duplex: Duplex, strands: RnaStrand[]): HelixRun {
  const strandA = strands.find((strand) => strand.id === duplex.a.strandId)
  const strandB = strands.find((strand) => strand.id === duplex.b.strandId)
  if (!strandA || !strandB) {
    throw new Error(`duplex ${duplex.id} references a missing strand`)
  }

  const sequenceA = strandA.sequence.slice(duplex.a.start, duplex.a.end)
  const sequenceB = strandB.sequence.slice(duplex.b.start, duplex.b.end)
  const bLength = sequenceB.length

  let best: HelixRun = { length: 0, wobbles: 0, aStart: duplex.a.start, aEnd: duplex.a.start }
  let runStart = 0
  let runLength = 0
  let runWobbles = 0

  const close = () => {
    if (runLength > best.length) {
      best = {
        length: runLength,
        wobbles: runWobbles,
        aStart: duplex.a.start + runStart,
        aEnd: duplex.a.start + runStart + runLength,
      }
    }
    runLength = 0
    runWobbles = 0
  }

  for (let aIndex = 0; aIndex < sequenceA.length; aIndex += 1) {
    const bIndex = bLength - 1 - aIndex + duplex.registration
    const kind = bIndex < 0 || bIndex >= bLength
      ? 'mismatch'
      : canPair(sequenceA[aIndex], sequenceB[bIndex])

    if (kind === 'canonical' || kind === 'wobble') {
      if (runLength === 0) runStart = aIndex
      runLength += 1
      if (kind === 'wobble') runWobbles += 1
    } else {
      close()
    }
  }
  close()

  return best
}

/**
 * Evaluate an antiparallel duplex.
 * Range A runs 5'->3'; its base i pairs with range B's base
 * (bLength - 1 - i + registration).
 */
export function evaluateDuplex(duplex: Duplex, strands: RnaStrand[]): DuplexEvaluation {
  const strandA = strands.find((strand) => strand.id === duplex.a.strandId)
  const strandB = strands.find((strand) => strand.id === duplex.b.strandId)
  if (!strandA || !strandB) {
    throw new Error(`duplex ${duplex.id} references a missing strand`)
  }

  const sequenceA = strandA.sequence.slice(duplex.a.start, duplex.a.end)
  const sequenceB = strandB.sequence.slice(duplex.b.start, duplex.b.end)
  const bLength = sequenceB.length

  const mismatches: Mismatch[] = []
  let pairs = 0
  let wobbles = 0
  let gcCount = 0
  let compared = 0

  for (let aIndex = 0; aIndex < sequenceA.length; aIndex += 1) {
    const bIndex = bLength - 1 - aIndex + duplex.registration
    if (bIndex < 0 || bIndex >= bLength) continue

    compared += 1
    const kind = canPair(sequenceA[aIndex], sequenceB[bIndex])
    if (kind === 'canonical') {
      pairs += 1
      if (sequenceA[aIndex] === 'G' || sequenceA[aIndex] === 'C') gcCount += 1
    } else if (kind === 'wobble') {
      pairs += 1
      wobbles += 1
      mismatches.push({ aIndex, bIndex, kind })
    } else {
      mismatches.push({ aIndex, bIndex, kind })
    }
  }

  return {
    length: compared,
    pairs,
    wobbles,
    mismatches,
    gc: compared === 0 ? 0 : gcCount / compared,
  }
}
