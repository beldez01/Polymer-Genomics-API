import { describe, it, expect } from "vitest";
import { idwHeight } from "./surface";
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
