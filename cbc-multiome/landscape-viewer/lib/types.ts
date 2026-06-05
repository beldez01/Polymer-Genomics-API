export type Layer = "methylation" | "atac";
export type Metric = "elevation" | "elevation_alt";
export interface LNode { id: string; label: string; compartment?: string; lineage?: string;
  modalities?: string[]; x: number; y: number; elevation: number; elevation_alt?: number;
  z?: number; pseudotime?: number; density?: number; projection_confidence?: number;
  out_of_manifold?: boolean; }
export interface EdgeLayer { n: number; by_chrom?: Record<string, number>;
  by_class?: Record<string, number>; top?: { id: string; chr: string; start: number; class: string; delta: number }[]; }
export interface LEdge { from: string; to: string; branch_nature: string; layers: Partial<Record<Layer, EdgeLayer>>; }
export interface Landscape { meta: Record<string, unknown>; nodes: LNode[]; edges: LEdge[]; }
export interface Grid {
  nx: number; ny: number;
  x0: number; x1: number; y0: number; y1: number;
  z: number[]; // row-major length nx*ny
}
export interface Deformation {
  basis: number[][]; coefficients: number[]; active: boolean;
}
export interface GridLandscape extends Landscape {
  grid: Grid;
  deformation: Deformation;
}
export function isGridLandscape(ls: Landscape): ls is GridLandscape {
  return (ls as GridLandscape).grid !== undefined;
}
