import type { PathPoint, RnaStrand } from '../types'
import { clampRange, type LayoutResult } from './linear'
import { createPathMetric } from './path'

export interface SerpentineOptions {
  perRow: number
  rowGap: number
}

function requirePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`)
  }
}

/** A local, continuous snake whose arc length exactly fits the strand. */
export function serpentinePath(
  strand: RnaStrand,
  options: SerpentineOptions,
): PathPoint[] {
  requirePositive('perRow', options.perRow)
  requirePositive('rowGap', options.rowGap)
  requirePositive('ntPerUnit', strand.ntPerUnit)

  const totalLength = Math.max(0, strand.sequence.length - 1) * strand.ntPerUnit
  const path: PathPoint[] = [{ id: `${strand.id}-auto-start`, x: 0, y: 0 }]
  if (totalLength === 0) return path

  // A cycle is approximately `perRow` bases. When rowGap itself exceeds that
  // budget, retain a one-base horizontal run so the path stays meaningful.
  const runLength = Math.max(
    strand.ntPerUnit,
    options.perRow * strand.ntPerUnit - options.rowGap,
  )
  let remaining = totalLength
  let x = 0
  let y = 0
  let direction = 1
  let horizontal = true
  let pointIndex = 0

  while (remaining > 1e-12) {
    const available = horizontal ? runLength : options.rowGap
    const distance = Math.min(remaining, available)
    if (horizontal) x += direction * distance
    else y += distance
    remaining -= distance
    pointIndex += 1
    path.push({ id: `${strand.id}-auto-turn-${pointIndex}`, x, y })

    if (distance === available) {
      horizontal = !horizontal
      if (horizontal) direction *= -1
    }
  }

  path[path.length - 1] = { ...path[path.length - 1], id: `${strand.id}-auto-end` }
  return path
}

/** Wrapped rows alternate direction so a long transcript stays readable. */
export function layoutSerpentine(
  strand: RnaStrand,
  from: number,
  to: number,
  options: SerpentineOptions,
): LayoutResult {
  const range = clampRange(strand, from, to)
  const length = range.to - range.from
  const xs = new Float32Array(length)
  const ys = new Float32Array(length)
  const metric = createPathMetric(serpentinePath(strand, options))

  for (let offset = 0; offset < length; offset += 1) {
    const index = range.from + offset
    const point = metric.pointAt(index * strand.ntPerUnit)
    xs[offset] = strand.placement.x + point.x
    ys[offset] = strand.placement.y + point.y
  }

  return { ...range, xs, ys }
}
