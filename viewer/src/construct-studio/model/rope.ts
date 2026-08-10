import type { CanvasPoint } from './types'

/**
 * One-sided distance constraint: rope cannot stretch (no adjacent pair may
 * exceed `rest`) but folds and bunches freely. Slack absorbs motion; only a
 * taut segment transmits pull, so tension propagation stops at the first
 * slack segment — points beyond it are returned untouched (same object).
 */
function follow(points: CanvasPoint[], from: number, direction: -1 | 1, rest: number): number {
  const end = direction === -1 ? 0 : points.length - 1
  let last = from - direction
  for (let i = from; i !== end + direction; i += direction) {
    if (i < 0 || i >= points.length) break
    const leader = points[i - direction]
    const follower = points[i]
    const dx = follower.x - leader.x
    const dy = follower.y - leader.y
    const distance = Math.hypot(dx, dy)
    if (distance <= rest) break
    const scale = rest / distance
    points[i] = { x: leader.x + dx * scale, y: leader.y + dy * scale }
    last = i
  }
  return last
}

/**
 * Bending stiffness: pull each interior point of the moved window toward the
 * midpoint of its neighbors, so tension corners render as curves instead of
 * hard kinks. The pin is never smoothed (the grab must track the cursor
 * exactly), and each round re-runs `follow` so the no-stretch constraint
 * stays exact. Rounds and gain are fixed so drags remain deterministic.
 */
const STIFFNESS_ROUNDS = 6
const STIFFNESS_GAIN = 0.5
/** Minimum opening angle of the V at the pin (radians); π would be straight. */
const PIN_MIN_ANGLE = (130 * Math.PI) / 180

function rotateAbout(point: CanvasPoint, center: CanvasPoint, angle: number): CanvasPoint {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

/**
 * Re-tension sweep for the smoothing rounds: like `follow`, but scans every
 * segment (smoothing and pin-opening can stretch segments past the first
 * slack one). Only stretched followers move, so untouched points keep
 * identity; returns the outermost index it moved.
 */
function tighten(points: CanvasPoint[], from: number, direction: -1 | 1, rest: number): number {
  const end = direction === -1 ? 0 : points.length - 1
  let last = from - direction
  for (let i = from; i !== end + direction; i += direction) {
    if (i < 0 || i >= points.length) break
    const leader = points[i - direction]
    const follower = points[i]
    const dx = follower.x - leader.x
    const dy = follower.y - leader.y
    const distance = Math.hypot(dx, dy)
    if (distance <= rest) continue
    const scale = rest / distance
    points[i] = { x: leader.x + dx * scale, y: leader.y + dy * scale }
    last = i
  }
  return last
}

/** Open the V at the pin symmetrically when it pinches sharper than PIN_MIN_ANGLE. */
function openPinAngle(points: CanvasPoint[], grabIndex: number): void {
  const pin = points[grabIndex]
  const before = points[grabIndex - 1]
  const after = points[grabIndex + 1]
  if (!before || !after) return
  const va = { x: before.x - pin.x, y: before.y - pin.y }
  const vb = { x: after.x - pin.x, y: after.y - pin.y }
  const la = Math.hypot(va.x, va.y)
  const lb = Math.hypot(vb.x, vb.y)
  if (la < 1e-9 || lb < 1e-9) return
  const cos = Math.max(-1, Math.min(1, (va.x * vb.x + va.y * vb.y) / (la * lb)))
  const phi = Math.acos(cos)
  if (phi >= PIN_MIN_ANGLE) return
  const cross = va.x * vb.y - va.y * vb.x
  const open = (PIN_MIN_ANGLE - phi) / 2
  const sign = cross >= 0 ? 1 : -1
  points[grabIndex - 1] = rotateAbout(before, pin, -sign * open)
  points[grabIndex + 1] = rotateAbout(after, pin, sign * open)
}

/** Pin points[grabIndex] to target, then follow-the-leader outward both ways. */
export function dragRope(
  points: readonly CanvasPoint[],
  grabIndex: number,
  target: CanvasPoint,
  rest: number,
): CanvasPoint[] {
  const next = points.slice()
  next[grabIndex] = { x: target.x, y: target.y }
  let lo = follow(next, grabIndex - 1, -1, rest)
  let hi = follow(next, grabIndex + 1, 1, rest)

  for (let round = 0; round < STIFFNESS_ROUNDS; round += 1) {
    for (let i = Math.max(1, lo); i <= Math.min(next.length - 2, hi); i += 1) {
      if (i === grabIndex) continue
      const mid = {
        x: (next[i - 1].x + next[i + 1].x) / 2,
        y: (next[i - 1].y + next[i + 1].y) / 2,
      }
      next[i] = {
        x: next[i].x + (mid.x - next[i].x) * STIFFNESS_GAIN,
        y: next[i].y + (mid.y - next[i].y) * STIFFNESS_GAIN,
      }
    }
    openPinAngle(next, grabIndex)
    lo = Math.min(lo, tighten(next, grabIndex - 1, -1, rest))
    hi = Math.max(hi, tighten(next, grabIndex + 1, 1, rest))
  }
  return next
}

/** Rigid rotation about a center. */
export function rotateRope(
  points: readonly CanvasPoint[],
  center: CanvasPoint,
  angle: number,
): CanvasPoint[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
  })
}

/** One forward tension pass: pulls later points in to close stretched gaps. */
export function settleRope(points: readonly CanvasPoint[], rest: number): CanvasPoint[] {
  const next = points.slice()
  for (let i = 1; i < next.length; i += 1) {
    const leader = next[i - 1]
    const follower = next[i]
    const dx = follower.x - leader.x
    const dy = follower.y - leader.y
    const distance = Math.hypot(dx, dy)
    if (distance <= rest) continue
    const scale = rest / distance
    next[i] = { x: leader.x + dx * scale, y: leader.y + dy * scale }
  }
  return next
}
