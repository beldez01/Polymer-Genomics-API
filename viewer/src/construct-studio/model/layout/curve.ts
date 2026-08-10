export interface Point2D {
  x: number
  y: number
}

export interface CubicBezier {
  start: Point2D
  control1: Point2D
  control2: Point2D
  end: Point2D
}

export function cubicPoint(curve: CubicBezier, t: number): Point2D {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  return {
    x: uu * u * curve.start.x
      + 3 * uu * t * curve.control1.x
      + 3 * u * tt * curve.control2.x
      + tt * t * curve.end.x,
    y: uu * u * curve.start.y
      + 3 * uu * t * curve.control1.y
      + 3 * u * tt * curve.control2.y
      + tt * t * curve.end.y,
  }
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distanceToLine(point: Point2D, start: Point2D, end: Point2D): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length
}

export interface FlattenedCurvePoint extends Point2D {
  t: number
}

/** Adaptive de Casteljau subdivision. The start point is omitted. */
export function flattenCubic(curve: CubicBezier, tolerance: number): FlattenedCurvePoint[] {
  const output: FlattenedCurvePoint[] = []
  const safeTolerance = Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0.25

  function visit(value: CubicBezier, t0: number, t1: number, depth: number): void {
    const flatness = Math.max(
      distanceToLine(value.control1, value.start, value.end),
      distanceToLine(value.control2, value.start, value.end),
    )
    if (flatness <= safeTolerance || depth >= 18) {
      output.push({ ...value.end, t: t1 })
      return
    }

    const a = midpoint(value.start, value.control1)
    const b = midpoint(value.control1, value.control2)
    const c = midpoint(value.control2, value.end)
    const d = midpoint(a, b)
    const e = midpoint(b, c)
    const split = midpoint(d, e)
    const tm = (t0 + t1) / 2
    visit({ start: value.start, control1: a, control2: d, end: split }, t0, tm, depth + 1)
    visit({ start: split, control1: e, control2: c, end: value.end }, tm, t1, depth + 1)
  }

  visit(curve, 0, 1, 0)
  return output
}

function derivativeRoots(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 3 * p0 - 6 * p1 + 3 * p2
  const c = -3 * p0 + 3 * p1
  const qa = 3 * a
  const qb = 2 * b
  const qc = c
  const epsilon = 1e-12

  if (Math.abs(qa) < epsilon) {
    if (Math.abs(qb) < epsilon) return []
    return [-qc / qb]
  }
  const discriminant = qb * qb - 4 * qa * qc
  if (discriminant < 0) return []
  if (discriminant === 0) return [-qb / (2 * qa)]
  const root = Math.sqrt(discriminant)
  return [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)]
}

export function cubicExtrema(curve: CubicBezier): Point2D[] {
  const roots = new Set([
    ...derivativeRoots(curve.start.x, curve.control1.x, curve.control2.x, curve.end.x),
    ...derivativeRoots(curve.start.y, curve.control1.y, curve.control2.y, curve.end.y),
  ])
  return [...roots]
    .filter((t) => t > 0 && t < 1)
    .map((t) => cubicPoint(curve, t))
}
