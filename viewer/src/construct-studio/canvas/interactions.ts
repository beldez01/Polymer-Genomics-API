import type { CanvasPoint, EditOp, RnaStrand, StrandLayout, Viewport } from '../model/types'
import { dragRope, rotateRope } from '../model/rope'
import { seedRopeLayout, ropeRest } from '../model/ropeLayout'
import { createLayoutSampler } from '../model/layout'
import { geometryPermission } from './pathEditing'
import { panByScreen, zoomAt, type Bounds, type Size } from './viewport'

export type Gesture =
  | { kind: 'idle' }
  | {
      kind: 'pan'
      pointerId: number
      startScreen: CanvasPoint
      currentScreen: CanvasPoint
      startViewport: Viewport
    }
  | {
      kind: 'marquee'
      pointerId: number
      startWorld: CanvasPoint
      currentWorld: CanvasPoint
    }
  | {
      kind: 'move'
      pointerId: number
      strandIds: string[]
      startWorld: CanvasPoint
      currentWorld: CanvasPoint
      originalPlacements: Record<string, CanvasPoint>
    }
  | {
      kind: 'rope'
      pointerId: number
      strandId: string
      grabIndex: number
      originalLayout: StrandLayout
      points: CanvasPoint[]
      rest: number
      placement: CanvasPoint
    }
  | {
      kind: 'rotate'
      pointerId: number
      strandId: string
      center: CanvasPoint
      startAngle: number
      originalLayout: StrandLayout
      originalPoints: CanvasPoint[]
      placement: CanvasPoint
      points: CanvasPoint[]
    }

export const IDLE_GESTURE: Gesture = { kind: 'idle' }

export function beginPan(
  pointerId: number,
  startScreen: CanvasPoint,
  startViewport: Viewport,
): Gesture {
  return { kind: 'pan', pointerId, startScreen, currentScreen: startScreen, startViewport }
}

export function beginMarquee(pointerId: number, startWorld: CanvasPoint): Gesture {
  return { kind: 'marquee', pointerId, startWorld, currentWorld: startWorld }
}

/**
 * Strand ids for a multi-strand move gesture, with the grabbed strand
 * first — it's the gesture's primary strand for proximity-splice purposes.
 */

export function beginMove(
  pointerId: number,
  strands: readonly RnaStrand[],
  startWorld: CanvasPoint,
): Gesture {
  const editable = strands.filter((strand) => geometryPermission(strand).allowed)
  if (editable.length === 0) return IDLE_GESTURE
  return {
    kind: 'move',
    pointerId,
    strandIds: editable.map((strand) => strand.id),
    startWorld,
    currentWorld: startWorld,
    originalPlacements: Object.fromEntries(editable.map((strand) => [strand.id, strand.placement])),
  }
}

export function nearestRopeIndex(points: readonly CanvasPoint[], local: CanvasPoint): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < points.length; i += 1) {
    const distance = Math.hypot(points[i].x - local.x, points[i].y - local.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}

/** Nearest rope-point boundary to a world point, biased 5' of the clicked base. */
export function bladeIndexFor(strand: RnaStrand, world: CanvasPoint): number {
  const layout = strand.layout.mode === 'rope' ? strand.layout : seedRopeLayout(strand)
  const local = { x: world.x - strand.placement.x, y: world.y - strand.placement.y }
  const index = nearestRopeIndex(layout.points, local)
  const len = strand.sequence.length
  return Math.min(Math.max(index === 0 ? 1 : index, 1), Math.max(1, len - 1))
}

export function beginRopeDrag(
  pointerId: number,
  strand: RnaStrand,
  world: CanvasPoint,
): Gesture {
  if (strand.sequence.length === 0) return IDLE_GESTURE
  const layout = strand.layout.mode === 'rope' ? strand.layout : seedRopeLayout(strand)
  const local = { x: world.x - strand.placement.x, y: world.y - strand.placement.y }
  return {
    kind: 'rope',
    pointerId,
    strandId: strand.id,
    grabIndex: nearestRopeIndex(layout.points, local),
    originalLayout: strand.layout,
    points: layout.points,
    rest: ropeRest(strand),
    placement: strand.placement,
  }
}

export function ropeOperation(
  gesture: Extract<Gesture, { kind: 'rope' }>,
): EditOp {
  return {
    op: 'layout',
    strandId: gesture.strandId,
    layout: { mode: 'rope', points: gesture.points },
  }
}

export function beginRotate(
  pointerId: number,
  strand: RnaStrand,
  world: CanvasPoint,
): Gesture {
  if (strand.sequence.length === 0) return IDLE_GESTURE
  const layout = strand.layout.mode === 'rope' ? strand.layout : seedRopeLayout(strand)
  const points = layout.points
  const centroidLocal = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  )
  centroidLocal.x /= points.length
  centroidLocal.y /= points.length
  const center = {
    x: centroidLocal.x + strand.placement.x,
    y: centroidLocal.y + strand.placement.y,
  }
  return {
    kind: 'rotate',
    pointerId,
    strandId: strand.id,
    center,
    startAngle: Math.atan2(world.y - center.y, world.x - center.x),
    originalLayout: strand.layout,
    originalPoints: points,
    placement: strand.placement,
    points,
  }
}

export function rotateOperation(
  gesture: Extract<Gesture, { kind: 'rotate' }>,
): EditOp {
  return {
    op: 'layout',
    strandId: gesture.strandId,
    layout: { mode: 'rope', points: gesture.points },
  }
}

export function updateGesture(
  gesture: Gesture,
  update: { pointerId?: number; screen?: CanvasPoint; world?: CanvasPoint },
): Gesture {
  if (gesture.kind === 'idle') return gesture
  if (update.pointerId !== undefined && update.pointerId !== gesture.pointerId) return gesture
  if (gesture.kind === 'pan' && update.screen) {
    return { ...gesture, currentScreen: update.screen }
  }
  if (gesture.kind === 'rope' && update.world) {
    const local = { x: update.world.x - gesture.placement.x, y: update.world.y - gesture.placement.y }
    return { ...gesture, points: dragRope(gesture.points, gesture.grabIndex, local, gesture.rest) }
  }
  if (gesture.kind === 'rotate' && update.world) {
    const angle = Math.atan2(update.world.y - gesture.center.y, update.world.x - gesture.center.x)
    const localCenter = {
      x: gesture.center.x - gesture.placement.x,
      y: gesture.center.y - gesture.placement.y,
    }
    return {
      ...gesture,
      points: rotateRope(gesture.originalPoints, localCenter, angle - gesture.startAngle),
    }
  }
  if ((gesture.kind === 'marquee' || gesture.kind === 'move') && update.world) {
    return { ...gesture, currentWorld: update.world }
  }
  return gesture
}

export function previewViewport(gesture: Gesture): Viewport | null {
  if (gesture.kind !== 'pan') return null
  return panByScreen(
    gesture.startViewport,
    gesture.currentScreen.x - gesture.startScreen.x,
    gesture.currentScreen.y - gesture.startScreen.y,
  )
}

export function marqueeBounds(gesture: Gesture): Bounds | null {
  if (gesture.kind !== 'marquee') return null
  return {
    minX: Math.min(gesture.startWorld.x, gesture.currentWorld.x),
    minY: Math.min(gesture.startWorld.y, gesture.currentWorld.y),
    maxX: Math.max(gesture.startWorld.x, gesture.currentWorld.x),
    maxY: Math.max(gesture.startWorld.y, gesture.currentWorld.y),
  }
}

export function moveOperations(gesture: Gesture): EditOp[] {
  if (gesture.kind !== 'move') return []
  const dx = gesture.currentWorld.x - gesture.startWorld.x
  const dy = gesture.currentWorld.y - gesture.startWorld.y
  if (Math.hypot(dx, dy) < 1e-9) return []
  return gesture.strandIds.map((strandId) => ({
    op: 'move' as const,
    strandId,
    placement: {
      x: gesture.originalPlacements[strandId].x + dx,
      y: gesture.originalPlacements[strandId].y + dy,
    },
  }))
}

/** World point of a strand's 5′ start or 3′ end, from its rope points or auto layout. */
export function endWorld(strand: RnaStrand, which: 'start' | 'end'): CanvasPoint | null {
  if (strand.layout.mode !== 'rope' || strand.layout.points.length === 0) {
    if (strand.sequence.length === 0) return null
    const sampler = createLayoutSampler(strand)
    return sampler.pointAt(which === 'start' ? 0 : strand.sequence.length - 1)
  }
  const p = which === 'start' ? strand.layout.points[0] : strand.layout.points.at(-1)!
  return { x: p.x + strand.placement.x, y: p.y + strand.placement.y }
}

/**
 * A join offered when the dragged strand's free 3′ end nears another strand's
 * free 5′ start (or vice versa) within 2× rest length. Never a strand to
 * itself, never through a sequence-locked or empty strand.
 */
export function spliceCandidate(
  dragged: RnaStrand,
  strands: readonly RnaStrand[],
): { aStrandId: string; bStrandId: string } | null {
  if (dragged.locked.sequence || dragged.sequence.length === 0) return null
  const radius = 2 * ropeRest(dragged)
  const near = (p: CanvasPoint | null, q: CanvasPoint | null) =>
    p !== null && q !== null && Math.hypot(p.x - q.x, p.y - q.y) <= radius
  for (const other of strands) {
    if (other.id === dragged.id || other.locked.sequence || other.sequence.length === 0) continue
    if (near(endWorld(dragged, 'end'), endWorld(other, 'start'))) {
      return { aStrandId: dragged.id, bStrandId: other.id }
    }
    if (near(endWorld(dragged, 'start'), endWorld(other, 'end'))) {
      return { aStrandId: other.id, bStrandId: dragged.id }
    }
  }
  return null
}

export function zoomFromWheel(
  viewport: Viewport,
  cursor: CanvasPoint,
  deltaY: number,
): Viewport {
  const factor = Math.exp(-deltaY * 0.0015)
  return zoomAt(viewport, cursor, factor)
}

export function zoomAtCanvasCenter(
  viewport: Viewport,
  size: Size,
  factor: number,
): Viewport {
  return zoomAt(viewport, { x: size.width / 2, y: size.height / 2 }, factor)
}

export type CanvasKeyboardCommand = 'undo' | 'redo' | 'fit' | 'zoom-in' | 'zoom-out' | 'toggle-razor' | null

export interface KeyboardCommandInput {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  targetEditable: boolean
}

export function canvasKeyboardCommand(
  input: KeyboardCommandInput,
  canvasFocused: boolean,
): CanvasKeyboardCommand {
  if (!canvasFocused || input.targetEditable) return null
  const key = input.key.toLowerCase()
  if (key === '+' || key === '=') return 'zoom-in'
  if (key === '-' || key === '_') return 'zoom-out'
  if (key === '0' && (input.metaKey || input.ctrlKey)) return 'fit'
  if (key === 'x' && !input.metaKey && !input.ctrlKey && !input.shiftKey) return 'toggle-razor'
  if (key !== 'z' || (!input.metaKey && !input.ctrlKey)) return null
  return input.shiftKey ? 'redo' : 'undo'
}
