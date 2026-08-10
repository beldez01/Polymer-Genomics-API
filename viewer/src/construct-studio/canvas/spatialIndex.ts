import { createLayoutSampler, type LayoutOptions } from '../model/layout'
import type { RnaStrand } from '../model/types'
import type { Bounds } from './viewport'

export const STRAND_CHUNK_SIZE = 128

export interface StrandChunk {
  from: number
  to: number
  bounds: Bounds
}

const cache = new WeakMap<RnaStrand, Map<string, StrandChunk[]>>()

function optionsKey(options: LayoutOptions): string {
  return [options.perRow ?? '', options.rowGap ?? '', options.tolerance ?? ''].join(':')
}

function chunkBounds(
  strand: RnaStrand,
  sampler: ReturnType<typeof createLayoutSampler>,
  from: number,
  to: number,
): Bounds {
  if (to <= from) {
    return {
      minX: strand.placement.x,
      minY: strand.placement.y,
      maxX: strand.placement.x,
      maxY: strand.placement.y,
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = from; index < to; index += 1) {
    const point = sampler.pointAt(index)
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  // Any curve point between adjacent bases is at most one arc-spacing away
  // from an endpoint. Padding by that distance is therefore conservative.
  const padding = Math.max(0.25, sampler.spacing)
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  }
}

export function buildSpatialIndex(
  strand: RnaStrand,
  options: LayoutOptions = {},
): StrandChunk[] {
  const key = optionsKey(options)
  const strandCache = cache.get(strand)
  const cached = strandCache?.get(key)
  if (cached) return cached

  const chunks: StrandChunk[] = []
  const sampler = createLayoutSampler(strand, options)
  for (let from = 0; from < strand.sequence.length; from += STRAND_CHUNK_SIZE) {
    const to = Math.min(strand.sequence.length, from + STRAND_CHUNK_SIZE)
    chunks.push({ from, to, bounds: chunkBounds(strand, sampler, from, to) })
  }

  const nextCache = strandCache ?? new Map<string, StrandChunk[]>()
  nextCache.set(key, chunks)
  if (!strandCache) cache.set(strand, nextCache)
  return chunks
}
