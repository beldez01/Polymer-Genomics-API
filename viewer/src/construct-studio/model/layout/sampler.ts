import type { PathPoint, RnaStrand } from '../types'
import { clampRange, type LayoutResult } from './linear'
import { createPathMetric, type PathMetric } from './path'
import type { Point2D } from './curve'
import { serpentinePath } from './serpentine'
import { catmullRomPath } from './catmullRom'

export interface LayoutOptions {
  perRow?: number
  rowGap?: number
  tolerance?: number
}

export interface LayoutSampler {
  path: PathPoint[]
  metric: PathMetric
  spacing: number
  pointAt(index: number): Point2D
  tangentAt(index: number): Point2D
  range(from: number, to: number): LayoutResult
}

const DEFAULTS = { perRow: 60, rowGap: 24 }

function requirePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number`)
  }
}

function linearPath(strand: RnaStrand): PathPoint[] {
  requirePositive('ntPerUnit', strand.ntPerUnit)
  const end = Math.max(0, strand.sequence.length - 1) * strand.ntPerUnit
  return [
    { id: `${strand.id}-auto-start`, x: 0, y: 0 },
    { id: `${strand.id}-auto-end`, x: end, y: 0 },
  ]
}

export function automaticPath(strand: RnaStrand, options: LayoutOptions = {}): PathPoint[] {
  if (strand.renderMode === 'serpentine') {
    return serpentinePath(strand, {
      perRow: options.perRow ?? DEFAULTS.perRow,
      rowGap: options.rowGap ?? DEFAULTS.rowGap,
    })
  }
  return linearPath(strand)
}

export function createLayoutSampler(
  strand: RnaStrand,
  options: LayoutOptions = {},
): LayoutSampler {
  if (strand.layout.mode === 'rope') {
    const points = strand.layout.points
    const path = catmullRomPath(points, strand.id)
    // `metric` is unused by this branch's own pointAt/tangentAt (they index
    // `points` directly), so build it lazily — it's otherwise dead work on
    // every sampler construction, including once per preview frame per rope
    // strand during drags.
    let metricCache: PathMetric | undefined
    const spacing = strand.ntPerUnit
    const clamp = (index: number) =>
      Math.max(0, Math.min(Math.round(index), Math.max(0, points.length - 1)))
    const pointAt = (index: number): Point2D => {
      if (points.length === 0) return { x: strand.placement.x, y: strand.placement.y }
      const local = points[clamp(index)]
      return { x: local.x + strand.placement.x, y: local.y + strand.placement.y }
    }
    const tangentAt = (index: number): Point2D => {
      if (points.length < 2) return { x: 1, y: 0 }
      const i = clamp(index)
      const a = points[Math.max(0, i - 1)]
      const b = points[Math.min(points.length - 1, i + 1)]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const length = Math.hypot(dx, dy) || 1
      return { x: dx / length, y: dy / length }
    }
    const range = (from: number, to: number): LayoutResult => {
      const bounded = clampRange(strand, from, to)
      const length = bounded.to - bounded.from
      const xs = new Float32Array(length)
      const ys = new Float32Array(length)
      for (let offset = 0; offset < length; offset += 1) {
        const point = pointAt(bounded.from + offset)
        xs[offset] = point.x
        ys[offset] = point.y
      }
      return { ...bounded, xs, ys }
    }
    return {
      path,
      get metric() {
        if (!metricCache) metricCache = createPathMetric(path, options.tolerance)
        return metricCache
      },
      spacing,
      pointAt,
      tangentAt,
      range,
    }
  }

  const path = automaticPath(strand, options)
  const metric = createPathMetric(path, options.tolerance)
  const spacing = strand.sequence.length > 1 ? metric.totalLength / (strand.sequence.length - 1) : 0

  const localPointAt = (index: number): Point2D => {
    return metric.pointAt(Math.max(0, Math.min(index, Math.max(0, strand.sequence.length - 1))) * spacing)
  }

  const pointAt = (index: number): Point2D => {
    const local = localPointAt(index)
    return { x: local.x + strand.placement.x, y: local.y + strand.placement.y }
  }

  const tangentAt = (index: number): Point2D => {
    return metric.tangentAt(index * spacing)
  }

  const range = (from: number, to: number): LayoutResult => {
    const bounded = clampRange(strand, from, to)
    const length = bounded.to - bounded.from
    const xs = new Float32Array(length)
    const ys = new Float32Array(length)
    for (let offset = 0; offset < length; offset += 1) {
      const point = pointAt(bounded.from + offset)
      xs[offset] = point.x
      ys[offset] = point.y
    }
    return { ...bounded, xs, ys }
  }

  return { path, metric, spacing, pointAt, tangentAt, range }
}
