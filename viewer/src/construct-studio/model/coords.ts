import { segmentAt, sourceCoordAt } from './segments'
import type { CoordSpace, RnaStrand, SegmentOrigin } from './types'

export interface BaseLocation {
  localIndex: number
  accession: string
  referenceBuild: string
  space: CoordSpace
  coord: number
  origin: SegmentOrigin
  gene?: string
}

/** Resolves a local strand index to its source coordinate, or null if untraceable. */
export function locateBase(strand: RnaStrand, localIndex: number): BaseLocation | null {
  if (localIndex < 0 || localIndex >= strand.sequence.length) return null
  const seg = segmentAt(strand.segments, localIndex)
  if (!seg || !seg.coordMap) return null
  const coord = sourceCoordAt(seg, localIndex)
  if (coord === null) return null
  return {
    localIndex,
    accession: seg.coordMap.accession,
    referenceBuild: seg.coordMap.referenceBuild,
    space: seg.coordMap.space,
    coord,
    origin: seg.origin,
    gene: seg.source.gene,
  }
}

export function describeLocation(loc: BaseLocation): string {
  const gene = loc.gene ? `${loc.gene} ` : ''
  return `${gene}${loc.accession}:${loc.coord} (${loc.space}, ${loc.referenceBuild}) · ${loc.origin}`
}
