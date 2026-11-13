import { create } from 'zustand';
import { boundedRegion } from '@/lib/reference';
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
  showStability: boolean;
  showStructure: boolean;
  showMotifs: boolean;
  showContext: boolean;
  codonTranscript: string | null;

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
  toggleStability: () => void;
  toggleStructure: () => void;
  toggleMotifs: () => void;
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
  showStability: false,
  showStructure: false,
  showMotifs: false,
  showContext: true,
  codonTranscript: null,
  visibleCellTypes: ['Gran', 'Mono', 'NK', 'Bcell', 'CD4T', 'CD8T'],
  enabledMotifs: [],

  setBuild: (build) => {
    const { chr, start, end } = get();
    const region = boundedRegion(build, chr, start, end);
    if (region) set({ build, ...region });
  },

  setRegion: (chr, start, end) => {
    const region = boundedRegion(get().build, chr, start, end);
    if (region) set(region);
  },

  zoomIn: (factor = 2) => {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const { chr, start, width, setRegion } = get();
    const nextWidth = Math.max(1, Math.round(width / factor));
    const s = Math.round(start + (width - nextWidth) / 2);
    setRegion(chr, s, s + nextWidth - 1);
  },
  zoomOut: (factor = 2) => get().zoomIn(1 / factor),
  panLeft: (fraction = 0.25) => {
    const { chr, start, end, width, setRegion } = get();
    const shift = Math.max(1, Math.round(width * fraction));
    setRegion(chr, start - shift, end - shift);
  },
  panRight: (fraction = 0.25) => {
    const { chr, start, end, width, setRegion } = get();
    const shift = Math.max(1, Math.round(width * fraction));
    setRegion(chr, start + shift, end + shift);
  },
  zoomToBase: (chr, position) => get().setRegion(chr, position - 25, position + 25),

  toggleLayer: (layerKey) =>
    set((state) => ({
      activeLayers: state.activeLayers.includes(layerKey)
        ? state.activeLayers.filter((l) => l !== layerKey)
        : [...state.activeLayers, layerKey],
    })),

  setLayers: (layers) => set({ activeLayers: layers }),

  toggleCodons: () => set((state) => ({ showCodons: !state.showCodons })),
  toggleGC: () => set((state) => ({ showGC: !state.showGC })),
  toggleStability: () => set((state) => ({ showStability: !state.showStability })),
  toggleStructure: () => set((state) => ({ showStructure: !state.showStructure })),
  toggleMotifs: () => set((state) => ({ showMotifs: !state.showMotifs })),

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
