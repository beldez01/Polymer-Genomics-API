import { createPathMetric } from '../model/layout'
import type { CanvasPoint, Viewport } from '../model/types'
import type { CanvasRenderPlan, StrandRenderPlan } from './renderPlan'
import { boundsIntersect, screenToWorld, worldToScreen, type Bounds } from './viewport'

export type CanvasHit =
  | { type: 'base'; strandId: string; index: number }
  | { type: 'strand'; strandId: string }

export interface HitTestOptions {
  baseRadius?: number
  strandRadius?: number
}

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

function squaredDistance(a: CanvasPoint, b: CanvasPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function screenDistance(
  world: CanvasPoint,
  screen: CanvasPoint,
  viewport: Viewport,
): number {
  return Math.sqrt(squaredDistance(worldToScreen(world, viewport), screen))
}

function hitBase(
  plan: CanvasRenderPlan,
  screen: CanvasPoint,
  viewport: Viewport,
  radius: number,
): CanvasHit | null {
  let closest: { hit: CanvasHit; distance: number } | null = null
  for (const strand of plan.strands) {
    for (const base of strand.bases) {
      const distance = screenDistance(base, screen, viewport)
      if (distance <= radius && (!closest || distance < closest.distance)) {
        closest = {
          hit: { type: 'base', strandId: strand.strandId, index: base.index },
          distance,
        }
      }
    }
  }
  return closest?.hit ?? null
}

function expanded(bounds: Bounds, amount: number): Bounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  }
}

function distanceToStrand(
  strand: StrandRenderPlan,
  screen: CanvasPoint,
  viewport: Viewport,
): number {
  const metric = createPathMetric(strand.pathPoints)
  if (metric.totalLength === 0) return screenDistance(metric.pointAt(0), screen, viewport)
  const screenLength = metric.totalLength * viewport.zoom
  const sampleCount = Math.max(1, Math.min(2_048, Math.ceil(screenLength / 4)))
  let closest = Infinity
  for (let sample = 0; sample <= sampleCount; sample += 1) {
    const point = metric.pointAt(metric.totalLength * sample / sampleCount)
    closest = Math.min(closest, screenDistance(point, screen, viewport))
  }
  return closest
}

function hitStrand(
  plan: CanvasRenderPlan,
  screen: CanvasPoint,
  viewport: Viewport,
  radius: number,
): CanvasHit | null {
  const world = screenToWorld(screen, viewport)
  let closest: { strandId: string; distance: number } | null = null
  for (const strand of plan.strands) {
    const radiusWorld = radius / viewport.zoom
    if (!boundsIntersect(expanded(strand.bounds, radiusWorld), {
      minX: world.x,
      minY: world.y,
      maxX: world.x,
      maxY: world.y,
    })) continue
    const distance = distanceToStrand(strand, screen, viewport)
    if (distance <= radius && (!closest || distance < closest.distance)) {
      closest = { strandId: strand.strandId, distance }
    }
  }
  return closest ? { type: 'strand', strandId: closest.strandId } : null
}

export function hitTestCanvas(
  plan: CanvasRenderPlan,
  screen: CanvasPoint,
  viewport: Viewport,
  options: HitTestOptions = {},
): CanvasHit | null {
  const base = hitBase(plan, screen, viewport, options.baseRadius ?? 10)
  if (base) return base
  return hitStrand(plan, screen, viewport, options.strandRadius ?? 16)
}

export function strandsInMarquee(
  plan: CanvasRenderPlan,
  rectangle: ScreenRect,
  viewport: Viewport,
): string[] {
  const x1 = Math.min(rectangle.x, rectangle.x + rectangle.width)
  const x2 = Math.max(rectangle.x, rectangle.x + rectangle.width)
  const y1 = Math.min(rectangle.y, rectangle.y + rectangle.height)
  const y2 = Math.max(rectangle.y, rectangle.y + rectangle.height)
  const start = screenToWorld({ x: x1, y: y1 }, viewport)
  const end = screenToWorld({ x: x2, y: y2 }, viewport)
  const bounds: Bounds = {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
  return plan.strands
    .filter((strand) => boundsIntersect(strand.bounds, bounds))
    .map((strand) => strand.strandId)
}
