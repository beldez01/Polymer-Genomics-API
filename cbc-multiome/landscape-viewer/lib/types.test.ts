import { describe, it, expect } from "vitest";
import { isGridLandscape } from "./types";

describe("isGridLandscape", () => {
  it("is true when a grid is present", () => {
    const ls = { meta: {}, nodes: [], edges: [],
      grid: { nx: 2, ny: 2, x0: 0, x1: 1, y0: 0, y1: 1, z: [0, 1, 2, 3] },
      deformation: { basis: [], coefficients: [], active: false } };
    expect(isGridLandscape(ls)).toBe(true);
  });
  it("is false when grid is absent", () => {
    const ls = { meta: {}, nodes: [], edges: [] };
    expect(isGridLandscape(ls)).toBe(false);
  });
});
