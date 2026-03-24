# Transposome Explorer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Transposome Explorer page — a three-panel interactive landscape of TE families with canvas visualization, lens system, and family inspector.

**Architecture:** Next.js App Router page at `/transposome` with Zustand store for state (lens, filters, selection), canvas-based bubble chart in center panel, and React components for left rail (lenses/filters) and right panel (family dossier). Static mock data initially; API wired later when Exp 02 data is ready.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Canvas API / Zustand / theme.ts tokens

**Spec:** `docs/superpowers/specs/2026-03-15-transposome-explorer-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/transposome/page.tsx` | Page layout, hero header, three-panel grid, mode tabs |
| Create | `src/stores/transposome.ts` | Zustand store: lens, filters, selection, Y-axis, awakening |
| Create | `src/lib/transposome-types.ts` | `TEFamily`, `TEFamilyDetail`, lens/filter enums |
| Create | `src/lib/transposome-mock.ts` | Static mock data (~30 representative families for dev) |
| Create | `src/components/transposome/LandscapeCanvas.tsx` | Canvas bubble chart with hover/click/lens/filter |
| Create | `src/components/transposome/LensPanel.tsx` | Left rail: lenses, Y-axis select, class/age/quick filters, awakening slider |
| Create | `src/components/transposome/FamilyInspector.tsx` | Right panel: orchestrates inspector sections |
| Create | `src/components/transposome/SilencingBar.tsx` | Stacked horizontal bar for silencing hierarchy |
| Create | `src/components/transposome/MaterialProfile.tsx` | Horizontal bar chart for 6 biophysical properties |
| Create | `src/components/transposome/MiniIdeogram.tsx` | 22 mini chromosome bars for genomic distribution |
| Create | `src/components/transposome/ModeTabs.tsx` | Tab bar (Landscape active, others disabled) |
| Modify | `src/components/BrandBar.tsx` | Add "Transposome" nav link |
| Modify | `src/lib/api.ts` | Add `fetchTEFamilies`, `fetchTEFamilyDetail` (wired to mock initially) |

---

## Chunk 1: Foundation (Types, Store, Mock Data)

### Task 1: TypeScript Types

**Files:**
- Create: `src/lib/transposome-types.ts`

- [ ] **Step 1: Create type definitions file**

```typescript
// src/lib/transposome-types.ts

export type TEClass = 'LINE' | 'SINE' | 'LTR' | 'DNA' | 'SVA' | 'Other';

export type SilencingPrimary = 'methylation' | 'h3k9me3' | 'h3k27me3' | 'mixed' | 'none';

export type Lens = 'material' | 'evolution' | 'silencing' | 'reactivation' | 'probe' | 'disease';

export type YAxis = 'cpg_density' | 'gc_content' | 'stacking_dg37' | 'wrapping_energy' | 'ndr_score';

export type ReactivationContext = 'aging' | 'dnmti' | 'tet2_lof' | 'setdb1_lof';

export type EvidenceLevel = 'STRONG' | 'MODERATE' | 'PREDICTED' | 'UNKNOWN';

export interface TEFamily {
  id: string;
  display_name: string;
  class: TEClass;
  family: string;
  divergence_pct: number;
  copy_count: number;
  total_bp: number;
  consensus_length: number;
  cpg_density: number;
  gc_content: number;
  stacking_dg37: number;
  wrapping_energy: number;
  ndr_score: number;
  periodicity_power: number;
  silencing_primary: SilencingPrimary;
  silencing_confidence: number;
  reactivation_score: number;
  reactivation_contexts: ReactivationContext[];
  epic_v2_probes: number;
  retro_age_probes: number;
  has_intact_orfs: boolean;
  is_active: boolean;
  clinically_implicated: boolean;
}

export interface SilencingBreakdown {
  mechanism: string;
  proportion: number;
  color: string;
  evidence: 'curated' | 'heuristic';
}

export interface ChrDensity {
  chr: string;
  density: number;
}

export interface ProbeInfo {
  probe_id: string;
  gene: string | null;
  position: string;
  is_retro_age: boolean;
}

export interface ReactivationDetail {
  context: string;
  evidence: EvidenceLevel;
  notes: string;
}

export interface RepresentativeLocus {
  label: string;
  region: string;
  notes: string;
}

export interface TEFamilyReference {
  citation: string;
  journal: string;
  summary: string;
}

export interface TEFamilyDetail extends TEFamily {
  silencing_breakdown: SilencingBreakdown[];
  chr_density: ChrDensity[];
  top_probes: ProbeInfo[];
  probe_coverage_fraction: number;
  reactivation_detail: ReactivationDetail[];
  viral_mimicry: string | null;
  representative_loci: RepresentativeLocus[];
  references: TEFamilyReference[];
}

// Y-axis display config
export const Y_AXIS_OPTIONS: { value: YAxis; label: string }[] = [
  { value: 'cpg_density', label: 'CpG Density (obs/exp)' },
  { value: 'gc_content', label: 'GC Content (%)' },
  { value: 'stacking_dg37', label: 'Stacking Energy (kcal/mol)' },
  { value: 'wrapping_energy', label: 'Wrapping Energy' },
  { value: 'ndr_score', label: 'NDR Score' },
];

// Lens display config
export const LENS_OPTIONS: { value: Lens; label: string; icon: string; mvp: boolean }[] = [
  { value: 'material', label: 'Material Lens', icon: 'M', mvp: true },
  { value: 'evolution', label: 'Evolution Lens', icon: 'E', mvp: true },
  { value: 'silencing', label: 'Silencing Lens', icon: 'S', mvp: true },
  { value: 'reactivation', label: 'Reactivation Lens', icon: 'R', mvp: true },
  { value: 'probe', label: 'Probe Lens', icon: 'P', mvp: false },
  { value: 'disease', label: 'Disease Lens', icon: 'D', mvp: false },
];

// Silencing color map (unified across lens + inspector)
export const SILENCING_COLORS: Record<SilencingPrimary, string> = {
  methylation: '#4ECDC4',
  h3k9me3: '#F0A500',
  h3k27me3: '#8B5CF6',
  mixed: '#F43F5E',
  none: '#555555',
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit src/lib/transposome-types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/transposome-types.ts
git commit -m "feat(transposome): add TypeScript type definitions for TE families and lenses"
```

---

### Task 2: Zustand Store

**Files:**
- Create: `src/stores/transposome.ts`

- [ ] **Step 1: Create the store**

```typescript
// src/stores/transposome.ts
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
  toggleClassFilter: (cls) => set((s) => ({
    classFilter: s.classFilter.includes(cls)
      ? s.classFilter.filter((c) => c !== cls)
      : [...s.classFilter, cls],
  })),
  setAllClasses: () => set({ classFilter: [] }),
  setAgeRange: (range) => set({ ageRange: range }),
  toggleCpgRich: () => set((s) => ({ cpgRichOnly: !s.cpgRichOnly })),
  toggleProbeCovered: () => set((s) => ({ probeCoveredOnly: !s.probeCoveredOnly })),
  togglePerturbationResponsive: () => set((s) => ({ perturbationResponsiveOnly: !s.perturbationResponsiveOnly })),
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
    result = result.filter((f) => f.divergence_pct >= state.ageRange[0] && f.divergence_pct <= state.ageRange[1]);
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
    result = result.filter((f) =>
      f.display_name.toLowerCase().includes(q) ||
      f.family.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    );
  }

  return result;
}
```

- [ ] **Step 2: Verify store compiles**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit src/stores/transposome.ts`

- [ ] **Step 3: Commit**

```bash
git add src/stores/transposome.ts
git commit -m "feat(transposome): add Zustand store with lens, filter, and selection state"
```

---

### Task 3: Mock Data

**Files:**
- Create: `src/lib/transposome-mock.ts`

- [ ] **Step 1: Create mock data with ~30 representative families**

This file contains static mock data representing the major TE families across the evolutionary landscape. Used for frontend development before the API is ready. Each family has biologically plausible values derived from the research report.

The file should contain:
- `MOCK_FAMILIES: TEFamily[]` — ~30 entries covering: HERVK_HML2, L1HS, AluY, SVA, HERVH, L1PA2, L1PA3, L1PA4, L1PA5, AluSx, AluSp, AluSq, ERV1, ERVL_MaLR, HERVL, AluJb, AluJo, L1M1, L1M2, L1M3, L1M4, L1M5, MIR, MIRb, MIRc, L2, L2a, hAT_Charlie, TcMar_Tigger, HERV_W
- `MOCK_HERVK_DETAIL: TEFamilyDetail` — full dossier for HERVK (the example in the mockup)

Values should span the full range: young (HERVK, 2.3% divergence) to ancient (MIR, 26% divergence), CpG-rich (AluY, 1.1) to CpG-poor (L2, 0.2), high reactivation (HERVK, 0.9) to none (MIR, 0.0).

- [ ] **Step 2: Verify mock data compiles and type-checks**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit src/lib/transposome-mock.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/transposome-mock.ts
git commit -m "feat(transposome): add mock data for 30 representative TE families"
```

---

### Task 4: API Client Functions

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add transposome types and fetch functions to api.ts**

Add at the end of `src/lib/api.ts`:

```typescript
// ─── Transposome ────────────────────────────────────────────────────
import type { TEFamily, TEFamilyDetail } from './transposome-types';
import { MOCK_FAMILIES, MOCK_HERVK_DETAIL } from './transposome-mock';

export interface TEFamiliesResponse {
  status: string;
  data: { families: TEFamily[] };
}

export interface TEFamilyDetailResponse {
  status: string;
  data: TEFamilyDetail;
}

export async function fetchTEFamilies(): Promise<TEFamiliesResponse> {
  // TODO: Replace with real API call when Exp 02 data is ready
  // return fetchJSON<TEFamiliesResponse>('/api/v1/transposome/families');
  return { status: 'ok', data: { families: MOCK_FAMILIES } };
}

export async function fetchTEFamilyDetail(familyId: string): Promise<TEFamilyDetailResponse> {
  // TODO: Replace with real API call
  // return fetchJSON<TEFamilyDetailResponse>(`/api/v1/transposome/family/${familyId}`);
  return { status: 'ok', data: MOCK_HERVK_DETAIL };
}
```

- [ ] **Step 2: Verify api.ts still compiles**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit src/lib/api.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(transposome): add fetchTEFamilies and fetchTEFamilyDetail API functions (mock)"
```

---

## Chunk 2: Page Shell + Left Rail

### Task 5: Mode Tabs Component

**Files:**
- Create: `src/components/transposome/ModeTabs.tsx`

- [ ] **Step 1: Create the tab bar component**

Props: `{ activeTab: string; onTabChange: (tab: string) => void }`

5 tabs: Landscape (active), Clinical Reactivation (disabled), Probe Coverage (disabled), Region Tools (disabled), Family Directory (disabled).

Follow the exact tab style from `clocks/page.tsx` lines 189-238: transparent background, 2px bottom border for active, teal color for active, faint for disabled, `TYPE.sm.fontSize`, `FONT_FAMILY`, `0.04em` letter-spacing.

Disabled tabs show "Coming soon" tooltip on hover and `opacity: 0.4`.

- [ ] **Step 2: Verify component renders without errors**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/transposome/ModeTabs.tsx
git commit -m "feat(transposome): add ModeTabs component with Landscape tab active"
```

---

### Task 6: Page Shell

**Files:**
- Create: `src/app/transposome/page.tsx`

- [ ] **Step 1: Create the page with hero header and three-panel grid**

Structure:
1. `'use client'` directive
2. Import BrandBar, Footer, ModeTabs, and theme tokens
3. `useEffect` on mount to load families via `fetchTEFamilies()` → `useTransposome.setFamilies()`
4. Hero header section with title, subtitle, intro, stats bar (match clocks page pattern exactly)
5. ModeTabs component
6. Three-panel grid: left rail placeholder `<div>`, center placeholder `<div>`, right panel placeholder `<div>`

The three-panel grid CSS:
```css
display: grid;
grid-template-columns: 220px 1fr 300px;
height: calc(100vh - 44px - heroHeight - tabsHeight);
min-height: 500px;
```

Left rail: `background: COLOR.bg.elevated`, `border-right: 1px solid COLOR.border.subtle`, `overflow-y: auto`
Center: `background: COLOR.bg.primary`, `position: relative`, `overflow: hidden`
Right panel: `background: COLOR.bg.elevated`, `border-left: 1px solid COLOR.border.subtle`, `overflow-y: auto`

Each panel renders placeholder text ("Lens Panel", "Landscape", "Inspector") initially.

- [ ] **Step 2: Start dev server and verify page renders at /transposome**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npm run dev`
Navigate to: `http://localhost:3000/transposome`
Expected: Hero header + tabs + three gray panels visible

- [ ] **Step 3: Commit**

```bash
git add src/app/transposome/page.tsx
git commit -m "feat(transposome): add page shell with hero header and three-panel layout"
```

---

### Task 7: Lens Panel (Left Rail)

**Files:**
- Create: `src/components/transposome/LensPanel.tsx`
- Create: `src/components/transposome/AwakeningSlider.tsx`

- [ ] **Step 1: Create AwakeningSlider component**

Props: `{ value: number; onChange: (val: number) => void }`

A range input (0-100) with:
- Gradient track label: "DEEPLY SILENT" (left, `COLOR.text.faint`) to "EXPOSED" (right, `COLOR.accent.rose`)
- 4px gradient bar below labels: linear-gradient from `COLOR.text.faint` → `COLOR.accent.amber` → `COLOR.accent.rose`
- Native `<input type="range">` with `accent-color: COLOR.accent.teal`
- Section title above: "AWAKENING GRADIENT" (standard rail section title style)

- [ ] **Step 2: Create LensPanel component**

Props: none (reads/writes Zustand store directly)

Sections, top to bottom:
1. **Interpretive Lens** — 6 buttons from `LENS_OPTIONS`. Each button: 14px circle icon with letter + label text. Active lens: `teal-dim` background + teal border + teal text. Non-MVP lenses (probe, disease): show but with `opacity: 0.3` and `cursor: default`. Click handler: `useTransposome.setActiveLens()`.

2. **Y-Axis** — `<select>` dropdown from `Y_AXIS_OPTIONS`. Style: `COLOR.bg.surface` background, `COLOR.border.default` border, `COLOR.text.secondary` text, `TYPE.xs.fontSize`, full width. Change handler: `useTransposome.setYAxis()`.

3. **Class Filter** — Pill buttons: All, LINE, SINE, LTR, DNA, SVA, Other. "All" active when `classFilter` is empty. Clicking a class toggles it via `toggleClassFilter()`. Clicking "All" calls `setAllClasses()`. Pill style matches clocks filter pills: `COMPONENT.button.small` / `COMPONENT.button.smallActive`.

4. **Age Range** — Pill buttons: All, <10 Mya, 10-50, 50-150, >150. Maps to divergence_pct ranges: [0,3], [3,10], [10,20], [20,100]. Single-select: clicking sets `setAgeRange()`.

5. **Quick Filters** — Three vertical toggle pills: "CpG-rich only", "Probe-covered only", "Perturbation responsive". Each toggles its boolean in store.

6. **AwakeningSlider** component.

- [ ] **Step 3: Wire LensPanel into page.tsx left rail slot**

Replace the left rail placeholder div with `<LensPanel />`.

- [ ] **Step 4: Verify all controls render and update store**

Run dev server, open `/transposome`, click lenses/filters, verify no console errors. Open React DevTools to confirm Zustand state updates.

- [ ] **Step 5: Commit**

```bash
git add src/components/transposome/LensPanel.tsx src/components/transposome/AwakeningSlider.tsx src/app/transposome/page.tsx
git commit -m "feat(transposome): add LensPanel with lenses, filters, and awakening slider"
```

---

## Chunk 3: The Hero Landscape (Canvas)

### Task 8: Landscape Canvas

**Files:**
- Create: `src/components/transposome/LandscapeCanvas.tsx`

This is the most complex component. It renders ~1,847 bubbles on a canvas with hover, click, lens coloring, and filter opacity.

- [ ] **Step 1: Create the canvas component with basic bubble rendering**

Props: `{ families: TEFamily[] }` (filtered families from parent)

Implementation outline:
1. Two refs: `canvasRef` for `<canvas>`, `containerRef` for the parent `<div>`
2. `ResizeObserver` on container to track width/height (same pattern as `ClockAnatomy.tsx`)
3. DPI-aware setup: `const dpr = window.devicePixelRatio || 1; canvas.width = width * dpr; ...`
4. Read from Zustand: `activeLens`, `yAxis`, `selectedFamilyId`, `awakeningThreshold` (via `useTransposome()`)
5. Layout constants: `PADDING = { top: 30, right: 20, bottom: 40, left: 50 }`

**Position computation** (run once when families or yAxis change):
- X: `log10(divergence_pct)` mapped to `[PADDING.left, width - PADDING.right]`. Young (low divergence) on left, ancient on right.
- Y: `family[yAxis]` mapped to `[height - PADDING.bottom, PADDING.top]`. Low values at bottom, high at top. Use min/max of the dataset for range.
- Radius: `Math.sqrt(total_bp / maxTotalBp) * 30` — sqrt-scaled, max 30px.

**Color computation** (update when lens changes):
- `silencing` lens: `SILENCING_COLORS[family.silencing_primary]`
- `evolution` lens: interpolate teal→gray based on `divergence_pct / maxDivergence`
- `material` lens: interpolate teal→amber based on `family[yAxis]` normalized
- `reactivation` lens: interpolate gray→amber→rose based on `reactivation_score`

**Draw loop** (`drawFrame` called via `requestAnimationFrame` during transitions, otherwise on state change):
1. Clear canvas
2. Draw contour background (pre-rendered offscreen canvas)
3. Draw grid lines (very faint, rgba white 3%)
4. For each family:
   - Compute opacity: 1.0 if in filtered set, 0.05 if not
   - Draw filled circle with lens color at computed opacity
   - Draw halo ring based on `silencing_primary`:
     - `methylation`/`h3k9me3`/`h3k27me3`: solid `ctx.arc()` stroke
     - `mixed`: `ctx.setLineDash([4, 3])` then stroke
     - `none`: no halo
   - If `reactivation_score > 0.5`: add glow (`ctx.shadowBlur = 12`, `ctx.shadowColor = rose`)
   - If selected: brighter border, slight scale up (radius * 1.15)
5. Draw axis labels and ticks
6. If hovering: draw tooltip box near cursor

- [ ] **Step 2: Add hover detection**

On `mousemove`: iterate families, find closest bubble within radius. Set `hoveredId` in local state. On `mouseleave`: clear hover.

Tooltip (DOM overlay, not canvas): absolute-positioned div showing family name, class, copy count, silencing, and current Y-axis value. Style: `COLOR.bg.elevated` background, `COLOR.border.default` border, `TYPE.xs`, padding 8px, max-width 200px.

- [ ] **Step 3: Add click selection**

On `click`: if hovering a bubble, call `useTransposome.setSelectedFamilyId(family.id)`. If clicking empty space, deselect.

- [ ] **Step 4: Add contour background**

Create an offscreen canvas on mount. Draw 4 radial gradients at positions corresponding to major TE clusters (young-CpG-rich, intermediate-Polycomb, ancient-fossilized, ERV-reactivation). Use `ctx.createRadialGradient()` with very low alpha (0.04-0.06). Add elliptical contour strokes around cluster centroids.

Composite this offscreen canvas at the start of each draw frame.

- [ ] **Step 5: Add lens transition animation**

When `activeLens` changes: interpolate between old and new color arrays over 300ms using `requestAnimationFrame`. Store `transitionProgress` (0→1) and lerp colors. At completion, snap to final colors.

- [ ] **Step 6: Wire into page.tsx center panel**

Replace center placeholder with:
```tsx
<LandscapeCanvas families={filteredFamilies} />
```

Where `filteredFamilies` is computed by calling `filterFamilies(useTransposome.getState())` — or use `useMemo` with the relevant store slices.

- [ ] **Step 7: Verify canvas renders with mock data**

Run dev server, open `/transposome`. Should see ~30 bubbles positioned across the canvas with correct colors for the default silencing lens. Hover should show tooltips. Click should highlight.

- [ ] **Step 8: Commit**

```bash
git add src/components/transposome/LandscapeCanvas.tsx src/app/transposome/page.tsx
git commit -m "feat(transposome): add LandscapeCanvas with bubble rendering, hover, click, lens coloring"
```

---

### Task 9: Legend Overlay

**Files:**
- Modify: `src/components/transposome/LandscapeCanvas.tsx`

- [ ] **Step 1: Add legend as DOM overlay inside the canvas container**

Position: absolute, top-right of canvas container. Style matches the mockup:
- `background: rgba(10,10,10,0.85)`, `backdrop-filter: blur(8px)`
- `border: 1px solid COLOR.border.default`, `padding: 10px 12px`
- Title: "SILENCING MECHANISM" (8px, uppercase, faint)
- 5 legend items: colored dot (8px circle) + label text (9px, tertiary)
- Halo style section below with 3 items (solid dot, dashed dot, glow dot)
- Legend title updates when lens changes (e.g., "MATERIAL PROPERTIES", "REACTIVATION RISK")

- [ ] **Step 2: Verify legend appears and updates with lens changes**

- [ ] **Step 3: Commit**

```bash
git add src/components/transposome/LandscapeCanvas.tsx
git commit -m "feat(transposome): add legend overlay to landscape canvas"
```

---

## Chunk 4: Family Inspector (Right Panel)

### Task 10: Sub-components

**Files:**
- Create: `src/components/transposome/SilencingBar.tsx`
- Create: `src/components/transposome/MaterialProfile.tsx`
- Create: `src/components/transposome/MiniIdeogram.tsx`

- [ ] **Step 1: Create SilencingBar**

Props: `{ breakdown: SilencingBreakdown[] }`

A stacked horizontal bar (6px tall, rounded) where each segment's width = `proportion * 100%` and color = `segment.color`. Below the bar: small labels showing mechanism name and percentage for each segment.

- [ ] **Step 2: Create MaterialProfile**

Props: `{ family: TEFamily }`

6 rows in a CSS grid (`grid-template-columns: 70px 1fr 40px`):
- Label (9px, muted)
- Bar track (4px, `COLOR.bg.surface` background, colored fill proportional to normalized value)
- Numeric value (9px, tertiary, right-aligned)

Properties: cpg_density, gc_content, stacking_dg37, wrapping_energy, ndr_score, periodicity_power.

Normalize each to 0-1 range using biologically plausible min/max:
- cpg_density: [0, 1.5]
- gc_content: [0.3, 0.7]
- stacking_dg37: [-1.8, -1.0]
- wrapping_energy: [14, 22]
- ndr_score: [0, 1]
- periodicity_power: [0, 1]

Bar colors: teal for first two, amber for middle two, violet for last two.

- [ ] **Step 3: Create MiniIdeogram**

Props: `{ chrDensity: ChrDensity[] }`

22 mini bars in a flex-wrap container (gap 2px). Each bar: 10px wide, 28px tall, `COLOR.bg.surface` background, rounded (5px). Fill from bottom: height = `density * 28px`, color = teal at varying opacity (opacity = density).

Below: "chr1-22 enrichment" label (8px, faint).

- [ ] **Step 4: Verify sub-components compile**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/transposome/SilencingBar.tsx src/components/transposome/MaterialProfile.tsx src/components/transposome/MiniIdeogram.tsx
git commit -m "feat(transposome): add SilencingBar, MaterialProfile, and MiniIdeogram sub-components"
```

---

### Task 11: Family Inspector

**Files:**
- Create: `src/components/transposome/FamilyInspector.tsx`

- [ ] **Step 1: Create the inspector component**

Reads `selectedFamilyId` and `selectedDetail` from Zustand store.

When `selectedFamilyId` changes: call `fetchTEFamilyDetail(id)` and store result via `setSelectedDetail()`.

When no family selected: show centered prompt "Select a family in the landscape to inspect" (same style as clocks page empty state).

When loading detail: show "Loading family data..." in muted text.

When detail loaded: render 7 sections, each in a div with bottom border (`COLOR.border.subtle`), `padding-bottom: 14px`, `margin-bottom: 14px`:

**A. Family Identity** — stat rows: family name (16px, bold), class/subclass (10px, muted), then key-value pairs using the stat-row pattern from the mockup (flex, space-between, 10px font). Include badges: "REACTIVATION-PRONE" (rose) if `reactivation_score > 0.5`, "PROBE-COVERED" (teal) if `epic_v2_probes > 0`.

**B. Silencing Hierarchy** — `<SilencingBar breakdown={detail.silencing_breakdown} />`

**C. Material-Channel Profile** — `<MaterialProfile family={detail} />`

**D. Genomic Distribution** — `<MiniIdeogram chrDensity={detail.chr_density} />`

**E. Probe Observability** — stat rows for probe count, coverage fraction, retro-age count. Then list of `top_probes` as clickable teal links (probe_id + gene).

**F. Reactivation Profile** — If `reactivation_score > 0.5`: pulsing rose dot with "High reactivation potential" text (CSS animation `pulse`, 2s ease-in-out infinite, opacity 0.6↔1.0). Then grid of reactivation_detail entries as stat rows with colored evidence levels (STRONG=rose, MODERATE=amber, PREDICTED=teal, UNKNOWN=faint).

**G. Representative Loci** — List of `representative_loci` as clickable rows. Each shows label + region. Click navigates to `/view/hg38/${region}`.

Section title style: 9px, `WEIGHT.medium`, 0.08em tracking, uppercase, `COLOR.text.faint`.

- [ ] **Step 2: Wire inspector into page.tsx right panel slot**

Replace right panel placeholder with `<FamilyInspector />`.

- [ ] **Step 3: Verify inspector renders when a family is clicked in the canvas**

Run dev server, click a bubble in the landscape, verify the right panel populates with the HERVK mock detail.

- [ ] **Step 4: Commit**

```bash
git add src/components/transposome/FamilyInspector.tsx src/app/transposome/page.tsx
git commit -m "feat(transposome): add FamilyInspector with all 7 dossier sections"
```

---

## Chunk 5: Integration + Polish

### Task 12: BrandBar Integration

**Files:**
- Modify: `src/components/BrandBar.tsx`

- [ ] **Step 1: Add Transposome nav link to BrandBar**

Add after the Clocks link (line 84) and before the DMP link:

```tsx
<Link href="/transposome" style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>Transposome</Link>
```

- [ ] **Step 2: Verify link appears in nav bar on all pages**

- [ ] **Step 3: Commit**

```bash
git add src/components/BrandBar.tsx
git commit -m "feat(transposome): add Transposome link to BrandBar navigation"
```

---

### Task 13: Search Integration

**Files:**
- Modify: `src/app/transposome/page.tsx`

- [ ] **Step 1: Add search input to the BrandBar area**

Pass search input as `children` to BrandBar:

```tsx
<BrandBar subtitle="Transposome Explorer" sticky>
  <input
    type="text"
    placeholder="Search families..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    style={{
      ...COMPONENT.input.default,
      width: 180,
    }}
  />
</BrandBar>
```

Wire `searchQuery` to Zustand store. The `filterFamilies()` function already handles search filtering — filtered families flow to `LandscapeCanvas` which renders non-matching bubbles at 5% opacity.

- [ ] **Step 2: Verify search filters the landscape**

Type "HERV" in search — only HERV family bubbles should be fully opaque.

- [ ] **Step 3: Commit**

```bash
git add src/app/transposome/page.tsx
git commit -m "feat(transposome): add search input that filters landscape bubbles"
```

---

### Task 14: Loading + Error States

**Files:**
- Modify: `src/app/transposome/page.tsx`

- [ ] **Step 1: Add loading state**

When `loading` is true (from Zustand): render a skeleton shimmer in the center panel instead of the canvas. Use a div with `background: linear-gradient(90deg, COLOR.bg.surface 25%, COLOR.bg.elevated 50%, COLOR.bg.surface 75%)` and CSS animation `shimmer` (background-position slide).

- [ ] **Step 2: Add error state**

When `error` is set: render centered error message with "Retry" button that re-calls `fetchTEFamilies()`.

- [ ] **Step 3: Commit**

```bash
git add src/app/transposome/page.tsx
git commit -m "feat(transposome): add loading shimmer and error retry states"
```

---

### Task 15: Responsive Layout

**Files:**
- Modify: `src/app/transposome/page.tsx`

- [ ] **Step 1: Add responsive breakpoints**

Use `useIsTablet()` and `useIsMobile()` from `src/hooks/useBreakpoint.ts`.

- Desktop (≥1280px via media query or `!isTablet`): Full three-panel grid as designed.
- Tablet (1024-1279px, `isTablet && !isMobile`): Left rail collapses — set `grid-template-columns: 44px 1fr 300px`. LensPanel receives a `collapsed` prop that shows only icons.
- Mobile (<1024px, `isMobile`): Single column — hide left rail, stack canvas and inspector vertically. Canvas takes full width. Inspector renders below.

For MVP, a clean two-breakpoint approach is sufficient. The canvas is always full-width of its container (ResizeObserver handles this).

- [ ] **Step 2: Verify layout at different viewport widths**

Test at 1400px, 1100px, and 800px viewport widths.

- [ ] **Step 3: Commit**

```bash
git add src/app/transposome/page.tsx src/components/transposome/LensPanel.tsx
git commit -m "feat(transposome): add responsive layout for tablet and mobile breakpoints"
```

---

### Task 16: Final Build Verification

- [ ] **Step 1: Run production build**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Visual smoke test**

Run: `npm run start`
Navigate to `http://localhost:3000/transposome`
Verify:
- Hero header renders with stats
- Landscape shows ~30 bubbles with correct positioning
- Clicking lenses recolors bubbles
- Filters reduce visible bubbles
- Clicking a bubble populates the inspector
- Awakening slider fades low-score families
- Search filters by name
- Nav link in BrandBar works

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(transposome): complete MVP Transposome Explorer page"
```
