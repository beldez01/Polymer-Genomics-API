import { create } from 'zustand';

export type GenomeBuild = 'hg37' | 'hg38';

export interface ViewportState {
  // Core viewport
  build: GenomeBuild;
  chr: string;
  start: number;  // 1-based
  end: number;    // 1-based, inclusive

  // Derived
  width: number;  // end - start + 1

  // Active annotation layers
  activeLayers: string[];

  // Actions
  setBuild: (build: GenomeBuild) => void;
  setRegion: (chr: string, start: number, end: number) => void;
  zoomIn: (factor?: number) => void;
  zoomOut: (factor?: number) => void;
  panLeft: (fraction?: number) => void;
  panRight: (fraction?: number) => void;
  zoomToBase: (chr: string, position: number) => void;
  toggleLayer: (layerKey: string) => void;
  setLayers: (layers: string[]) => void;
}

/**
 * Auto-select the best resolution tier for data fetching based on viewport width.
 * At very fine zoom (< 200bp), we fetch individual features + raw sequence.
 * At coarser zoom, we use tiled/aggregated data.
 */
export function dataResolution(viewportWidth: number): number {
  if (viewportWidth <= 200) return 1;         // bp resolution -- fetch sequence
  if (viewportWidth <= 50_000) return 1_000;
  if (viewportWidth <= 500_000) return 10_000;
  if (viewportWidth <= 5_000_000) return 100_000;
  return 1_000_000;
}

export const useViewport = create<ViewportState>((set, get) => ({
  build: 'hg38',
  chr: 'chr1',
  start: 1,
  end: 100_000,
  width: 100_000,
  activeLayers: ['gencode_v44', 'cpg_sites'],

  setBuild: (build) => set({ build }),

  setRegion: (chr, start, end) => {
    const s = Math.max(1, Math.round(start));
    const e = Math.max(s, Math.round(end));
    set({ chr, start: s, end: e, width: e - s + 1 });
  },

  zoomIn: (factor = 2) => {
    const { start, end } = get();
    const center = (start + end) / 2;
    const halfWidth = Math.max(0.5, (end - start + 1) / (2 * factor));
    const newStart = Math.max(1, Math.round(center - halfWidth));
    const newEnd = Math.max(newStart, Math.round(center + halfWidth));
    set({ start: newStart, end: newEnd, width: newEnd - newStart + 1 });
  },

  zoomOut: (factor = 2) => {
    const { start, end } = get();
    const center = (start + end) / 2;
    const halfWidth = (end - start + 1) * factor / 2;
    const newStart = Math.max(1, Math.round(center - halfWidth));
    const newEnd = Math.round(center + halfWidth);
    set({ start: newStart, end: newEnd, width: newEnd - newStart + 1 });
  },

  panLeft: (fraction = 0.25) => {
    const { start, end } = get();
    const width = end - start + 1;
    const shift = Math.max(1, Math.round(width * fraction));
    const newStart = Math.max(1, start - shift);
    const newEnd = newStart + width - 1;
    set({ start: newStart, end: newEnd });
  },

  panRight: (fraction = 0.25) => {
    const { start, end } = get();
    const width = end - start + 1;
    const shift = Math.max(1, Math.round(width * fraction));
    set({ start: start + shift, end: end + shift });
  },

  zoomToBase: (chr, position) => {
    // Zoom to a 50bp window centered on the given position
    const halfWidth = 25;
    const s = Math.max(1, position - halfWidth);
    const e = s + 50;
    set({ chr, start: s, end: e, width: 51 });
  },

  toggleLayer: (layerKey) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layerKey)
        ? state.activeLayers.filter((l) => l !== layerKey)
        : [...state.activeLayers, layerKey],
    })),

  setLayers: (layers) => set({ activeLayers: layers }),
}));
