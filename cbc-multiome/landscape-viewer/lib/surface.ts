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

export interface Seg { ax: number; ay: number; bx: number; by: number; }
export function distToSegment(px: number, py: number, s: Seg): number {
  const dx = s.bx - s.ax, dy = s.by - s.ay; const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - s.ax) * dx + (py - s.ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const cx = s.ax + t * dx, cy = s.ay + t * dy; return Math.hypot(px - cx, py - cy);
}
/** Waddington height: developmental baseline minus valleys carved along edges. */
export function waddingtonHeight(x: number, y: number, ctrl: CtrlPt[],
  segs: Seg[], opts: { depth: number; sigma: number }): number {
  const B = idwHeight(x, y, ctrl);
  if (!segs.length) return B;
  let best = Infinity; for (const s of segs) { const d = distToSegment(x, y, s); if (d < best) best = d; }
  const trough = Math.exp(-(best * best) / (2 * opts.sigma * opts.sigma));
  const depthEff = opts.depth * (1 + 0.6 * (1 - B));
  return B - depthEff * trough;
}
