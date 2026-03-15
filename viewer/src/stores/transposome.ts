// src/stores/transposome.ts
// Zustand store for the Transposome Explorer feature.
import { create } from 'zustand';
import type { TEFamily, TEFamilyDetail, Lens, YAxis, TEClass } from '@/lib/transposome-types';

interface TransposomeState {
  // Data
  families: TEFamily[];
  selectedFamilyId: string | null;
  selectedDetail: TEFamilyDetail | null;
  loading: boolean;
  loadingDetail: boolean;
  error: string | null;

  // Lens & axes
  activeLens: Lens;
  yAxis: YAxis;

  // Filters
  classFilter: TEClass[];       // empty = all
  ageRange: number[];           // [min, max] divergence_pct, empty = all
  cpgRichOnly: boolean;
  probeCoveredOnly: boolean;
  perturbationResponsiveOnly: boolean;
  awakeningThreshold: number;   // 0-100 slider value
  searchQuery: string;

  // Actions
  setFamilies: (families: TEFamily[]) => void;
  setSelectedFamilyId: (id: string | null) => void;
  setSelectedDetail: (detail: TEFamilyDetail | null) => void;
  setLoading: (loading: boolean) => void;
  setLoadingDetail: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveLens: (lens: Lens) => void;
  setYAxis: (axis: YAxis) => void;
  toggleClassFilter: (cls: TEClass) => void;
  setAllClasses: () => void;
  setAgeRange: (range: number[]) => void;
  toggleCpgRich: () => void;
  toggleProbeCovered: () => void;
  togglePerturbationResponsive: () => void;
  setAwakeningThreshold: (val: number) => void;
  setSearchQuery: (query: string) => void;
}

export const useTransposome = create<TransposomeState>((set) => ({
  families: [],
  selectedFamilyId: null,
  selectedDetail: null,
  loading: true,
  loadingDetail: false,
  error: null,

  activeLens: 'silencing',
  yAxis: 'cpg_density',

  classFilter: [],
  ageRange: [],
  cpgRichOnly: false,
  probeCoveredOnly: false,
  perturbationResponsiveOnly: false,
  awakeningThreshold: 0,
  searchQuery: '',

  setFamilies: (families) => set({ families, loading: false }),
  setSelectedFamilyId: (id) => set({ selectedFamilyId: id }),
  setSelectedDetail: (detail) => set({ selectedDetail: detail, loadingDetail: false }),
  setLoading: (loading) => set({ loading }),
  setLoadingDetail: (loading) => set({ loadingDetail: loading }),
  setError: (error) => set({ error, loading: false }),
  setActiveLens: (lens) => set({ activeLens: lens }),
  setYAxis: (axis) => set({ yAxis: axis }),
  toggleClassFilter: (cls) =>
    set((s) => ({
      classFilter: s.classFilter.includes(cls)
        ? s.classFilter.filter((c) => c !== cls)
        : [...s.classFilter, cls],
    })),
  setAllClasses: () => set({ classFilter: [] }),
  setAgeRange: (range) => set({ ageRange: range }),
  toggleCpgRich: () => set((s) => ({ cpgRichOnly: !s.cpgRichOnly })),
  toggleProbeCovered: () => set((s) => ({ probeCoveredOnly: !s.probeCoveredOnly })),
  togglePerturbationResponsive: () =>
    set((s) => ({ perturbationResponsiveOnly: !s.perturbationResponsiveOnly })),
  setAwakeningThreshold: (val) => set({ awakeningThreshold: val }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

// Derived: filter families based on current state
export function filterFamilies(state: TransposomeState): TEFamily[] {
  let result = state.families;

  if (state.classFilter.length > 0) {
    result = result.filter((f) => state.classFilter.includes(f.class));
  }

  if (state.ageRange.length === 2) {
    result = result.filter(
      (f) => f.divergence_pct >= state.ageRange[0] && f.divergence_pct <= state.ageRange[1],
    );
  }

  if (state.cpgRichOnly) {
    result = result.filter((f) => f.cpg_density > 0.6);
  }

  if (state.probeCoveredOnly) {
    result = result.filter((f) => f.epic_v2_probes > 0);
  }

  if (state.perturbationResponsiveOnly) {
    result = result.filter((f) => f.reactivation_contexts.length > 0);
  }

  if (state.awakeningThreshold > 0) {
    const threshold = state.awakeningThreshold / 100;
    result = result.filter((f) => f.reactivation_score >= threshold);
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    result = result.filter(
      (f) =>
        f.display_name.toLowerCase().includes(q) ||
        f.family.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q),
    );
  }

  return result;
}
