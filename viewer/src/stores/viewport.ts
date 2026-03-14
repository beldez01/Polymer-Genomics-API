import { create } from 'zustand';
import { MOTIF_NAMES } from '@/lib/motifs';

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

  // Gene track options
  showCodons: boolean;
  showGC: boolean;

  // Methylation atlas cell type visibility
  visibleCellTypes: string[];

  // Sequence motif markers
  enabledMotifs: string[];

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
  toggleCodons: () => void;
  toggleGC: () => void;
  toggleCellType: (cellType: string) => void;
  toggleMotif: (motifName: string) => void;
  toggleAllProbes: () => void;
  toggleAllCellTypes: () => void;
  toggleAllMotifs: () => void;
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
  showCodons: false,
  showGC: true,
  visibleCellTypes: ['Gran', 'Mono', 'NK', 'Bcell', 'CD4T', 'CD8T'],
  enabledMotifs: [],

  setBuild: (build) => set({ build }),

  setRegion: (chr, start, end) => {
    const MAX_CHR_LENGTH = 250_000_000;
    const s = Math.max(1, Math.round(start));
    const e = Math.min(MAX_CHR_LENGTH, Math.max(s, Math.round(end)));
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
    const MAX_CHR_LENGTH = 250_000_000;
    const center = (start + end) / 2;
    const halfWidth = (end - start + 1) * factor / 2;
    const newStart = Math.max(1, Math.round(center - halfWidth));
    const newEnd = Math.min(MAX_CHR_LENGTH, Math.round(center + halfWidth));
    set({ start: newStart, end: newEnd, width: newEnd - newStart + 1 });
  },

  panLeft: (fraction = 0.25) => {
    const { start, end } = get();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const width = end - start + 1;
    const shift = Math.max(1, Math.round(width * fraction));
    const newStart = Math.max(1, start - shift);
    const newEnd = newStart + width - 1;
    set({ start: newStart, end: newEnd, width: newEnd - newStart + 1 });
  },

  panRight: (fraction = 0.25) => {
    const MAX_CHR_LENGTH = 250_000_000;
    const state = get();
    if (!Number.isFinite(state.start) || !Number.isFinite(state.end)) return;
    const width = state.end - state.start + 1;
    const shift = Math.max(1, Math.round(width * fraction));
    const newEnd = Math.min(MAX_CHR_LENGTH, state.end + shift);
    const newStart = Math.max(1, newEnd - width + 1);
    set({ start: newStart, end: newEnd, width: newEnd - newStart + 1 });
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

  toggleCodons: () => set((state) => ({ showCodons: !state.showCodons })),
  toggleGC: () => set((state) => ({ showGC: !state.showGC })),

  toggleMotif: (motifName) =>
    set((state) => ({
      enabledMotifs: state.enabledMotifs.includes(motifName)
        ? state.enabledMotifs.filter((m) => m !== motifName)
        : [...state.enabledMotifs, motifName],
    })),

  toggleCellType: (cellType) =>
    set((state) => {
      const next = state.visibleCellTypes.includes(cellType)
        ? state.visibleCellTypes.filter((c) => c !== cellType)
        : [...state.visibleCellTypes, cellType];
      // If all cell types unchecked, also remove methylation_atlas from activeLayers
      if (next.length === 0 && state.activeLayers.includes('methylation_atlas')) {
        return { visibleCellTypes: next, activeLayers: state.activeLayers.filter((l) => l !== 'methylation_atlas') };
      }
      // If re-enabling a cell type and methylation_atlas not active, add it
      if (next.length > 0 && !state.activeLayers.includes('methylation_atlas')) {
        return { visibleCellTypes: next, activeLayers: [...state.activeLayers, 'methylation_atlas'] };
      }
      return { visibleCellTypes: next };
    }),

  toggleAllProbes: () =>
    set((state) => {
      const probeKeys = ['probe_epic_v2', 'probe_epic_v1', 'probe_450k'];
      const anyActive = probeKeys.some((k) => state.activeLayers.includes(k));
      if (anyActive) {
        return { activeLayers: state.activeLayers.filter((l) => !probeKeys.includes(l)) };
      }
      const toAdd = probeKeys.filter((k) => !state.activeLayers.includes(k));
      return { activeLayers: [...state.activeLayers, ...toAdd] };
    }),

  toggleAllCellTypes: () =>
    set((state) => {
      const allTypes = ['Gran', 'Mono', 'NK', 'Bcell', 'CD4T', 'CD8T'];
      if (state.visibleCellTypes.length > 0) {
        return {
          visibleCellTypes: [],
          activeLayers: state.activeLayers.filter((l) => l !== 'methylation_atlas'),
        };
      }
      return {
        visibleCellTypes: allTypes,
        activeLayers: state.activeLayers.includes('methylation_atlas')
          ? state.activeLayers
          : [...state.activeLayers, 'methylation_atlas'],
      };
    }),
  toggleAllMotifs: () =>
    set((state) => {
      if (state.enabledMotifs.length > 0) {
        return { enabledMotifs: [] };
      }
      return { enabledMotifs: [...MOTIF_NAMES] };
    }),
}));
