import { describe, it, expect } from "vitest";
import { idwHeight, waddingtonHeight, Seg } from "./surface";
describe("idwHeight", () => {
  const pts = [{x:0,y:0,z:1},{x:10,y:0,z:0}];
  it("returns the control value exactly at a control point", () => {
    expect(idwHeight(0,0,pts)).toBeCloseTo(1,5);
    expect(idwHeight(10,0,pts)).toBeCloseTo(0,5);
  });
  it("interpolates between points (midpoint between 1 and 0 is ~0.5)", () => {
    expect(idwHeight(5,0,pts)).toBeGreaterThan(0.3);
    expect(idwHeight(5,0,pts)).toBeLessThan(0.7);
  });
});

describe("waddingtonHeight", () => {
  // Two control points with similar baseline (~0.5) so B is roughly equal on/off edge.
  // Edge runs along x-axis from (0,0) to (10,0) in segment coordinates.
  const ctrl = [{x:0,y:0,z:0.5},{x:10,y:0,z:0.5}];
  const segs: Seg[] = [{ax:0,ay:0,bx:10,by:0}];
  const opts = {depth:0.6, sigma:0.6};

  it("carves a valley: on-edge point is lower than far-off-edge point at same baseline", () => {
    // On the edge (perpendicular distance=0) → maximum trough
    const onEdge = waddingtonHeight(5, 0, ctrl, segs, opts);
    // Far from edge (perp distance >> sigma) → trough≈0, height≈baseline
    const offEdge = waddingtonHeight(5, 10, ctrl, segs, opts);
    expect(onEdge).toBeLessThan(offEdge);
  });
});
