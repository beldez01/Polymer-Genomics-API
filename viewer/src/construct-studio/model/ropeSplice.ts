import { settleRope } from './rope'
import type { Splice } from './anchors'
import type { CanvasPoint } from './types'

/** Splice the points array in step with the sequence splice. */
export function spliceRopePoints(
  points: readonly CanvasPoint[],
  splice: Splice,
  rest: number,
): CanvasPoint[] {
  const before = points.slice(0, splice.start)
  const after = points.slice(splice.start + splice.deleted)
  const inserted: CanvasPoint[] = []
  if (splice.inserted > 0) {
    const anchor = before.at(-1) ?? after[0] ?? { x: 0, y: 0 }
    const toward = before.length > 0
      ? (after[0] ?? { x: anchor.x + rest, y: anchor.y })
      : (after[1] ?? { x: anchor.x + rest, y: anchor.y })
    let dx = toward.x - anchor.x
    let dy = toward.y - anchor.y
    const length = Math.hypot(dx, dy)
    if (length > 0) { dx /= length; dy /= length } else { dx = 1; dy = 0 }
    const sign = before.length === 0 && after.length > 0 ? -1 : 1
    for (let k = 1; k <= splice.inserted; k += 1) {
      inserted.push({ x: anchor.x + dx * rest * k * sign, y: anchor.y + dy * rest * k * sign })
    }
    if (sign === -1) inserted.reverse()
  }
  return settleRope([...before, ...inserted, ...after], rest)
}
