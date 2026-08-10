import type { PathPoint } from '../types'
import {
  cubicPoint,
  cubicExtrema,
  flattenCubic,
  type CubicBezier,
  type Point2D,
} from './curve'

export interface PathMetric {
  totalLength: number
  pointAt(distance: number): Point2D
  tangentAt(distance: number): Point2D
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface MetricPoint extends Point2D {
  distance: number
}

function curveFor(start: PathPoint, end: PathPoint): CubicBezier | null {
  if (!start.outHandle && !end.inHandle) return null
  return {
    start,
    control1: start.outHandle ?? start,
    control2: end.inHandle ?? end,
    end,
  }
}

function interpolate(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function clonePoint(point: PathPoint): PathPoint {
  return {
    ...point,
    inHandle: point.inHandle ? { ...point.inHandle } : undefined,
    outHandle: point.outHandle ? { ...point.outHandle } : undefined,
  }
}

export function createPathMetric(path: readonly PathPoint[], tolerance = 0.25): PathMetric {
  const origin = path[0] ?? { x: 0, y: 0 }
  const points: MetricPoint[] = [{ x: origin.x, y: origin.y, distance: 0 }]
  let totalLength = 0

  const append = (point: Point2D) => {
    const previous = points[points.length - 1]
    const length = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (length <= Number.EPSILON) return
    totalLength += length
    points.push({ ...point, distance: totalLength })
  }

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]
    const end = path[index]
    const curve = curveFor(start, end)
    if (!curve) {
      append(end)
      continue
    }
    for (const point of flattenCubic(curve, tolerance)) append(point)
  }

  const pointAt = (distance: number): Point2D => {
    if (points.length === 1 || totalLength === 0) return { x: origin.x, y: origin.y }
    const target = Math.max(0, Math.min(Number.isFinite(distance) ? distance : 0, totalLength))
    if (target === 0) return { x: points[0].x, y: points[0].y }
    if (target === totalLength) {
      const last = points[points.length - 1]
      return { x: last.x, y: last.y }
    }

    let low = 1
    let high = points.length - 1
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (points[middle].distance < target) low = middle + 1
      else high = middle
    }
    const after = points[low]
    const before = points[low - 1]
    const span = after.distance - before.distance
    return interpolate(before, after, span === 0 ? 0 : (target - before.distance) / span)
  }

  const tangentAt = (distance: number): Point2D => {
    if (totalLength === 0) return { x: 1, y: 0 }
    const target = Math.max(0, Math.min(Number.isFinite(distance) ? distance : 0, totalLength))
    const delta = Math.max(1e-6, Math.min(totalLength / 1000, 0.01))
    const before = pointAt(Math.max(0, target - delta))
    const after = pointAt(Math.min(totalLength, target + delta))
    const dx = after.x - before.x
    const dy = after.y - before.y
    const length = Math.hypot(dx, dy)
    return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length }
  }

  return { totalLength, pointAt, tangentAt }
}

function format(value: number): string {
  return Object.is(value, -0) ? '0' : String(value)
}

export function pathToSvg(path: readonly PathPoint[]): string {
  if (path.length === 0) return ''
  let value = `M ${format(path[0].x)} ${format(path[0].y)}`
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]
    const end = path[index]
    const curve = curveFor(start, end)
    value += curve
      ? ` C ${format(curve.control1.x)} ${format(curve.control1.y)} ${format(curve.control2.x)} ${format(curve.control2.y)} ${format(end.x)} ${format(end.y)}`
      : ` L ${format(end.x)} ${format(end.y)}`
  }
  return value
}

export function pathBounds(path: readonly PathPoint[]): Bounds {
  if (path.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const candidates: Point2D[] = [path[0]]
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]
    const end = path[index]
    candidates.push(end)
    const curve = curveFor(start, end)
    if (curve) candidates.push(...cubicExtrema(curve))
  }
  return {
    minX: Math.min(...candidates.map((point) => point.x)),
    minY: Math.min(...candidates.map((point) => point.y)),
    maxX: Math.max(...candidates.map((point) => point.x)),
    maxY: Math.max(...candidates.map((point) => point.y)),
  }
}

/** Move the 3′ endpoint along its terminal tangent to request a new arc length. */
export function resizePathEnd(path: readonly PathPoint[], targetLength: number): PathPoint[] {
  const resized = path.map(clonePoint)
  if (resized.length === 0) return resized
  const metric = createPathMetric(resized)
  const target = Math.max(0, Number.isFinite(targetLength) ? targetLength : metric.totalLength)
  if (Math.abs(target - metric.totalLength) < 1e-9) return resized

  if (target === 0) {
    const first = clonePoint(resized[0])
    first.inHandle = undefined
    first.outHandle = undefined
    return [first]
  }

  if (target < metric.totalLength) {
    const kept: PathPoint[] = [clonePoint(resized[0])]
    let consumed = 0
    for (let index = 1; index < resized.length; index += 1) {
      const start = resized[index - 1]
      const end = resized[index]
      const segmentMetric = createPathMetric([start, end])
      if (consumed + segmentMetric.totalLength < target - 1e-9) {
        kept.push(clonePoint(end))
        consumed += segmentMetric.totalLength
        continue
      }

      const localTarget = target - consumed
      const curve = curveFor(start, end)
      if (!curve) {
        const point = segmentMetric.pointAt(localTarget)
        kept[kept.length - 1].outHandle = undefined
        kept.push({ id: end.id, x: point.x, y: point.y })
        return kept
      }

      const flattened = [{ ...curve.start, t: 0 }, ...flattenCubic(curve, 0.05)]
      let distance = 0
      let t = 1
      for (let sampleIndex = 1; sampleIndex < flattened.length; sampleIndex += 1) {
        const before = flattened[sampleIndex - 1]
        const after = flattened[sampleIndex]
        const step = Math.hypot(after.x - before.x, after.y - before.y)
        if (distance + step >= localTarget) {
          const fraction = step === 0 ? 0 : (localTarget - distance) / step
          t = before.t + (after.t - before.t) * fraction
          break
        }
        distance += step
      }

      const q0 = interpolate(curve.start, curve.control1, t)
      const q1 = interpolate(curve.control1, curve.control2, t)
      const q2 = interpolate(curve.control2, curve.end, t)
      const r0 = interpolate(q0, q1, t)
      const r1 = interpolate(q1, q2, t)
      const split = cubicPoint(curve, t)
      kept[kept.length - 1].outHandle = q0
      kept.push({ id: end.id, x: split.x, y: split.y, inHandle: r0 })
      // q2/r1 describe the discarded half; computing them here documents the
      // full de Casteljau split and guards against accidentally changing q1.
      void q2
      void r1
      return kept
    }
    return kept
  }

  const delta = target - metric.totalLength
  const tangent = metric.tangentAt(metric.totalLength)
  const last = resized[resized.length - 1]
  const previous = resized.at(-2)
  if (previous && !curveFor(previous, last)) {
    last.x += tangent.x * delta
    last.y += tangent.y * delta
    return resized
  }
  last.outHandle = undefined
  resized.push({
    id: `${last.id}-end`,
    x: last.x + tangent.x * delta,
    y: last.y + tangent.y * delta,
  })
  return resized
}

