/**
 * Simple quadtree for efficient canvas hit detection on volcano plots.
 */

export interface QTPoint {
  x: number;
  y: number;
  index: number;
}

interface QTBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_POINTS = 16;
const MAX_DEPTH = 8;

export class QuadTree {
  private bounds: QTBounds;
  private points: QTPoint[] = [];
  private divided = false;
  private nw: QuadTree | null = null;
  private ne: QuadTree | null = null;
  private sw: QuadTree | null = null;
  private se: QuadTree | null = null;
  private depth: number;

  constructor(bounds: QTBounds, depth = 0) {
    this.bounds = bounds;
    this.depth = depth;
  }

  private contains(p: QTPoint): boolean {
    const b = this.bounds;
    return p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
  }

  private subdivide() {
    const { x, y, w, h } = this.bounds;
    const hw = w / 2;
    const hh = h / 2;
    const d = this.depth + 1;
    this.nw = new QuadTree({ x, y, w: hw, h: hh }, d);
    this.ne = new QuadTree({ x: x + hw, y, w: hw, h: hh }, d);
    this.sw = new QuadTree({ x, y: y + hh, w: hw, h: hh }, d);
    this.se = new QuadTree({ x: x + hw, y: y + hh, w: hw, h: hh }, d);
    this.divided = true;
  }

  insert(p: QTPoint): boolean {
    if (!this.contains(p)) return false;

    if (this.points.length < MAX_POINTS || this.depth >= MAX_DEPTH) {
      this.points.push(p);
      return true;
    }

    if (!this.divided) this.subdivide();
    return (
      this.nw!.insert(p) ||
      this.ne!.insert(p) ||
      this.sw!.insert(p) ||
      this.se!.insert(p)
    );
  }

  queryRadius(cx: number, cy: number, radius: number): QTPoint[] {
    const results: QTPoint[] = [];
    const b = this.bounds;
    // Quick reject: circle vs rectangle
    if (
      cx + radius < b.x ||
      cx - radius >= b.x + b.w ||
      cy + radius < b.y ||
      cy - radius >= b.y + b.h
    ) {
      return results;
    }

    const r2 = radius * radius;
    for (const p of this.points) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (dx * dx + dy * dy <= r2) {
        results.push(p);
      }
    }

    if (this.divided) {
      results.push(...this.nw!.queryRadius(cx, cy, radius));
      results.push(...this.ne!.queryRadius(cx, cy, radius));
      results.push(...this.sw!.queryRadius(cx, cy, radius));
      results.push(...this.se!.queryRadius(cx, cy, radius));
    }

    return results;
  }
}

export function buildQuadTree(
  points: Array<{ px: number; py: number; index: number }>,
  width: number,
  height: number,
): QuadTree {
  const qt = new QuadTree({ x: 0, y: 0, w: width, h: height });
  for (const p of points) {
    qt.insert({ x: p.px, y: p.py, index: p.index });
  }
  return qt;
}
