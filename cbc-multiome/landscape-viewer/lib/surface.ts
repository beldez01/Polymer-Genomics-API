export interface CtrlPt { x: number; y: number; z: number; }
/** Inverse-distance-weighted height at (x,y) from control points. p=power. */
export function idwHeight(x: number, y: number, pts: CtrlPt[], p = 2): number {
  let num = 0, den = 0;
  for (const c of pts) {
    const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
    if (d2 < 1e-9) return c.z;
    const w = 1 / Math.pow(d2, p / 2);
    num += w * c.z; den += w;
  }
  return den ? num / den : 0;
}
