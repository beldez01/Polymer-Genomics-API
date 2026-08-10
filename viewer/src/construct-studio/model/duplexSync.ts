import type { Duplex, DuplexEnd } from './types'

export interface PairedRange {
  duplexId: string
  strandId: string
  from: number
  to: number
}

/**
 * Map a half-open local window on one duplex end to its antiparallel
 * counterpart. Pairing follows evaluateDuplex: a-side local i pairs with
 * b-side local (bLen - 1 - i + registration); the relation is symmetric, so
 * the same formula maps either direction with `ownLocal`/partner swapped.
 */
function mapWindow(
  own: DuplexEnd,
  partner: DuplexEnd,
  bLength: number,
  registration: number,
  from: number,
  to: number,
): { from: number; to: number } | null {
  const overlapFrom = Math.max(from, own.start)
  const overlapTo = Math.min(to, own.end)
  if (overlapFrom >= overlapTo) return null

  const localFrom = overlapFrom - own.start
  const localTo = overlapTo - own.start
  const partnerLength = partner.end - partner.start
  // partnerLocal = bLen - 1 - ownLocal + reg, decreasing in ownLocal
  const mappedFrom = Math.max(0, bLength - localTo + registration)
  const mappedTo = Math.min(partnerLength, bLength - localFrom + registration)
  if (mappedFrom >= mappedTo) return null

  return { from: partner.start + mappedFrom, to: partner.start + mappedTo }
}

/** Counterpart ranges, on their partner strands, of a half-open base range. */
export function pairedRanges(
  duplexes: readonly Duplex[],
  strandId: string,
  from: number,
  to: number,
): PairedRange[] {
  const out: PairedRange[] = []
  for (const duplex of duplexes) {
    const bLength = duplex.b.end - duplex.b.start
    if (duplex.a.strandId === strandId) {
      const mapped = mapWindow(duplex.a, duplex.b, bLength, duplex.registration, from, to)
      if (mapped) out.push({ duplexId: duplex.id, strandId: duplex.b.strandId, ...mapped })
    }
    if (duplex.b.strandId === strandId) {
      const mapped = mapWindow(duplex.b, duplex.a, bLength, duplex.registration, from, to)
      if (mapped) out.push({ duplexId: duplex.id, strandId: duplex.a.strandId, ...mapped })
    }
  }
  return out
}
