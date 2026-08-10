import type { CanvasPoint, PathPoint } from '../types'

/**
 * Centripetal-flavored Catmull-Rom through the points, emitted as PathPoint
 * bezier handles (standard CR→bezier: handles at ±(next − prev)/6).
 * `stride` decimates dense ropes for overview rendering; endpoints always kept.
 */
export function catmullRomPath(
  points: readonly CanvasPoint[],
  idPrefix: string,
  stride = 1,
): PathPoint[] {
  const kept: CanvasPoint[] = []
  for (let i = 0; i < points.length; i += Math.max(1, stride)) kept.push(points[i])
  if (points.length > 0 && kept.at(-1) !== points.at(-1)) kept.push(points.at(-1)!)
  return kept.map((point, i) => {
    const prev = kept[Math.max(0, i - 1)]
    const next = kept[Math.min(kept.length - 1, i + 1)]
    const tx = (next.x - prev.x) / 6
    const ty = (next.y - prev.y) / 6
    return {
      id: `${idPrefix}-rope-${i}`,
      x: point.x,
      y: point.y,
      inHandle: i === 0 ? undefined : { x: point.x - tx, y: point.y - ty },
      outHandle: i === kept.length - 1 ? undefined : { x: point.x + tx, y: point.y + ty },
    }
  })
}
