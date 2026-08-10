import type { Splice } from './anchors'
import type { SourceSegment } from './types'

/** Source coordinate of a local index, or null when the segment is untraceable. */
export function sourceCoordAt(segment: SourceSegment, localIndex: number): number | null {
  const map = segment.coordMap
  if (!map) return null
  const delta = localIndex - segment.start
  return map.strand === '+' ? map.sourceStart + delta : map.sourceStart - delta
}

export function segmentAt(segments: SourceSegment[], localIndex: number): SourceSegment | undefined {
  return segments.find((s) => localIndex >= s.start && localIndex < s.end)
}

/**
 * Splice the segment partition.
 *
 * A deletion SPLITS a segment rather than downgrading it: the surviving bases
 * are still exactly what the corpus said, they just have a coordinate
 * discontinuity between them. Only inserted bases create a `user-edited`
 * segment, because only inserted bases are actually new.
 */
export function spliceSegments(segments: SourceSegment[], splice: Splice): SourceSegment[] {
  const delStart = splice.start
  const delEnd = splice.start + splice.deleted
  const shift = splice.inserted - splice.deleted
  const out: SourceSegment[] = []

  for (const seg of segments) {
    const leftEnd = Math.min(seg.end, delStart)
    if (leftEnd > seg.start) {
      out.push({ ...seg, start: seg.start, end: leftEnd })
    }

    const rightStart = Math.max(seg.start, delEnd)
    if (seg.end > rightStart) {
      const firstSurviving = rightStart
      const coord = sourceCoordAt(seg, firstSurviving)
      out.push({
        ...seg,
        start: firstSurviving + shift,
        end: seg.end + shift,
        coordMap: seg.coordMap && coord !== null ? { ...seg.coordMap, sourceStart: coord } : seg.coordMap,
      })
    }
  }

  if (splice.inserted > 0) {
    out.push({
      start: delStart,
      end: delStart + splice.inserted,
      origin: 'user-edited',
      source: { type: 'custom' },
    })
  }

  out.sort((a, b) => a.start - b.start)
  return out
}

/** Development guard: segments must tile [0, length) with no gaps or overlaps. */
export function assertPartition(segments: SourceSegment[], length: number): void {
  let cursor = 0
  for (const seg of segments) {
    if (seg.start !== cursor) {
      throw new Error(`segment partition broken: expected start ${cursor}, got ${seg.start}`)
    }
    if (seg.end <= seg.start) {
      throw new Error(`empty segment at ${seg.start}`)
    }
    cursor = seg.end
  }
  if (cursor !== length) {
    throw new Error(`segment partition ends at ${cursor}, sequence length is ${length}`)
  }
}
