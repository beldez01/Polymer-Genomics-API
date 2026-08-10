import { nextId } from './factories'
import { sourceCoordAt } from './segments'
import type { Annotation, Duplex, DuplexEnd, SourceSegment } from './types'

export function splitSegmentsAt(
  segments: SourceSegment[],
  at: number,
): { left: SourceSegment[]; right: SourceSegment[] } {
  const left: SourceSegment[] = []
  const right: SourceSegment[] = []
  for (const seg of segments) {
    if (seg.end <= at) { left.push(seg); continue }
    if (seg.start >= at) { right.push({ ...seg, start: seg.start - at, end: seg.end - at }); continue }
    left.push({ ...seg, end: at })
    const coord = sourceCoordAt(seg, at)
    right.push({
      ...seg,
      start: 0,
      end: seg.end - at,
      coordMap: seg.coordMap && coord !== null ? { ...seg.coordMap, sourceStart: coord } : seg.coordMap,
    })
  }
  return { left, right }
}

export function splitAnnotationsAt(
  annotations: Annotation[],
  at: number,
): { left: Annotation[]; right: Annotation[] } {
  const left: Annotation[] = []
  const right: Annotation[] = []
  for (const annotation of annotations) {
    if (annotation.end <= at) { left.push(annotation); continue }
    if (annotation.start >= at) {
      right.push({ ...annotation, start: annotation.start - at, end: annotation.end - at })
      continue
    }
    left.push({ ...annotation, end: at })
    right.push({ ...annotation, id: nextId('ann'), start: 0, end: annotation.end - at })
  }
  return { left, right }
}

/** Registration making base aGlobal pair with bGlobal in the given ends. */
export function registrationFor(
  aEnd: DuplexEnd,
  bEnd: DuplexEnd,
  aGlobal: number,
  bGlobal: number,
): number {
  const bLength = bEnd.end - bEnd.start
  return (bGlobal - bEnd.start) - (bLength - 1 - (aGlobal - aEnd.start))
}

type Side = 'a' | 'b'

/** Global base on the partner strand paired with `ownGlobal` (own side of duplex). */
function partnerGlobal(duplex: Duplex, side: Side, ownGlobal: number): number {
  const own = duplex[side]
  const other = duplex[side === 'a' ? 'b' : 'a']
  const bLength = duplex.b.end - duplex.b.start
  const ownLocal = ownGlobal - own.start
  const partnerLocal = bLength - 1 - ownLocal + duplex.registration
  return other.start + partnerLocal
}

function shiftEnd(end: DuplexEnd, at: number, newStrandId: string): DuplexEnd {
  return { strandId: newStrandId, start: end.start - at, end: end.end - at }
}

/**
 * Reassign/split every duplex end on strandId across a cut at `at`.
 * A spanning end splits its duplex into two whose base pairings are
 * identical to the original (verified by tests through pairedRanges).
 */
export function splitDuplexesAt(
  duplexes: Duplex[],
  strandId: string,
  at: number,
  newStrandId: string,
): Duplex[] {
  let out: Duplex[] = duplexes
  for (const side of ['a', 'b'] as const) {
    out = out.flatMap((duplex) => {
      const end = duplex[side]
      if (end.strandId !== strandId) return [duplex]
      if (end.end <= at) return [duplex]
      if (end.start >= at) return [{ ...duplex, [side]: shiftEnd(end, at, newStrandId), evaluated: undefined }]

      // Spanning: split into two pieces, [end.start, at) staying on strandId
      // and [at, end.end) moving to newStrandId (shifted by -at).
      const other = duplex[side === 'a' ? 'b' : 'a']
      const pieceRanges: Array<{ start: number; end: number; moved: boolean }> = [
        { start: end.start, end: at, moved: false },
        { start: at, end: end.end, moved: true },
      ]

      const halves: Duplex[] = []
      pieceRanges.forEach((range) => {
        if (range.end <= range.start) return // degenerate piece (cut at an end boundary)

        // Partner subrange: partnerGlobal is decreasing in ownGlobal, so the
        // piece's first base maps to the partner's high end and its last
        // base maps to the partner's low end.
        const partnerAtFirst = partnerGlobal(duplex, side, range.start)
        const partnerAtLast = partnerGlobal(duplex, side, range.end - 1)
        const rawLow = Math.min(partnerAtFirst, partnerAtLast)
        const rawHigh = Math.max(partnerAtFirst, partnerAtLast)
        const clampedLow = Math.max(other.start, rawLow)
        const clampedHigh = Math.min(other.end - 1, rawHigh)
        if (clampedLow > clampedHigh) return // no in-range partner bases for this piece

        const piece: DuplexEnd = range.moved
          ? shiftEnd({ strandId, start: range.start, end: range.end }, at, newStrandId)
          : { strandId, start: range.start, end: range.end }
        const partnerEnd: DuplexEnd = { strandId: other.strandId, start: clampedLow, end: clampedHigh + 1 }

        const aEndNew = side === 'a' ? piece : partnerEnd
        const bEndNew = side === 'a' ? partnerEnd : piece

        // Derive registration from one known original pairing, expressed in
        // the new ends' frames.
        const aGlobalOriginal = side === 'a' ? range.start : partnerAtFirst
        const bGlobalOriginal = side === 'a' ? partnerAtFirst : range.start
        const aGlobalNewFrame = range.moved && side === 'a' ? aGlobalOriginal - at : aGlobalOriginal
        const bGlobalNewFrame = range.moved && side === 'b' ? bGlobalOriginal - at : bGlobalOriginal
        const registration = registrationFor(aEndNew, bEndNew, aGlobalNewFrame, bGlobalNewFrame)

        halves.push({
          ...duplex,
          id: halves.length === 0 ? duplex.id : nextId('duplex'),
          a: aEndNew,
          b: bEndNew,
          registration,
          evaluated: undefined,
        })
      })
      return halves
    })
  }
  return out
}
