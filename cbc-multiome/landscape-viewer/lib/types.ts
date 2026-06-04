export type Layer = "methylation" | "atac";
export type Metric = "elevation" | "elevation_alt";
export interface LNode { id: string; label: string; compartment: string; lineage: string;
  modalities: string[]; x: number; y: number; elevation: number; elevation_alt: number; }
export interface EdgeLayer { n: number; by_chrom?: Record<string, number>;
  by_class?: Record<string, number>; top?: { id: string; chr: string; start: number; class: string; delta: number }[]; }
export interface LEdge { from: string; to: string; branch_nature: string; layers: Partial<Record<Layer, EdgeLayer>>; }
export interface Landscape { meta: Record<string, unknown>; nodes: LNode[]; edges: LEdge[]; }
