# Transposome Explorer — Design Specification

> **Created:** 2026-03-15
> **Status:** Draft
> **Scope:** MVP (Phase 1), with Phase 2 expansion noted

## Overview

A flagship interactive page for Polymer Genomics that renders the human transposome as a navigable landscape — linking TE families to biophysical properties, silencing mechanisms, assay observability, and reactivation potential. The page has dual nature: beautiful and map-like for exploration, practical and drillable for research.

**URL:** `polymerbio.org/transposome`

**Tagline:** *Mechanics, Age, Awakening*

## Architecture

### Technology Stack

Consistent with the existing site:
- Next.js 16 (App Router) + TypeScript + React 19
- Canvas (native) for the hero landscape visualization (performance at scale, dark-theme precision)
- Inline styles using theme tokens from `src/config/theme.ts`
- Zustand store for transposome state (selected family, active lens, filter state, awakening threshold, Y-axis selection). The lens/filter/selection interactions are complex enough to warrant a dedicated store rather than local `useState`.
- No external charting libraries

### File Structure

```
src/app/transposome/
  page.tsx                           # Page layout, hero header, state orchestration

src/components/transposome/
  LandscapeCanvas.tsx                # Canvas-based bubble chart (the hero)
  LensPanel.tsx                      # Left rail: lenses, axis selector, filters
  FamilyInspector.tsx                # Right panel: family dossier
  ModeTabs.tsx                       # Landscape / Clinical Reactivation / etc.
  SilencingBar.tsx                   # Stacked bar for silencing hierarchy
  MaterialProfile.tsx                # Bar chart card for material-channel properties
  MiniIdeogram.tsx                   # Chromosomal distribution minimap
  AwakeningSlider.tsx                # Gradient slider control

src/stores/transposome.ts             # Zustand store
```

### Data Flow

```
API (FastAPI)                        Frontend
─────────────                        ────────
GET /api/v1/transposome/families  →  LandscapeCanvas (all families, pre-aggregated)
GET /api/v1/transposome/family/{id} → FamilyInspector (detail on selection)
GET /api/v1/transposome/region      → Region Tools tab (Phase 2)
Existing probe/gene endpoints       → Probe links, Viewer jumpouts
```

## Page Structure

### 1. Top Bar (BrandBar — existing component)

Standard Polymer BrandBar with "Transposome Explorer" highlighted in nav. The search input in the BrandBar area filters families by name — matching families highlight in the canvas, non-matching fade to 5% opacity. Search is debounced (200ms). Clearing the search restores all bubbles.

### 2. Hero Header

- **Title:** TRANSPOSOME EXPLORER (teal, `TYPE.xl` = 28px, `WEIGHT.bold` = 700)
- **Subtitle:** *Mechanics, Age, Awakening* (12px, italic, `COLOR.text.muted`)
- **Intro paragraph:** One-paragraph description (`TYPE.sm` = 11px, `COLOR.text.tertiary`, max-width 900px)
- **Stats bar:** 4 key numbers — annotated elements (5.6M), families (~1,847), genome fraction (48.5%), EPIC v2 probes in TEs (~35K)

### 3. Mode Tabs

Five tabs controlling the center panel content:

| Tab | MVP? | Description |
|-----|------|-------------|
| **Landscape** | YES | Hero bubble visualization |
| **Clinical Reactivation** | Phase 2 | ERV-focused translational view |
| **Probe Coverage** | Phase 2 | Array observability analysis |
| **Region Tools** | Phase 2 | Region query + DMR upload |
| **Family Directory** | Phase 2 | Searchable/sortable table of all families |

MVP launches with **Landscape tab only**. Other tabs render as disabled with "Coming soon" state.

### 4. Three-Panel Layout

```
display: grid;
grid-template-columns: 220px 1fr 300px;  /* desktop ≥1280px */
```

Height: `calc(100vh - topbar - hero - tabs)`, minimum 500px.

**Responsive breakpoints:**
- `≥1280px`: Full three-panel layout as designed
- `1024-1279px`: Left rail collapses to icon-only (44px) with tooltip labels; expands on hover
- `768-1023px`: Left rail hidden (accessible via hamburger toggle), right panel becomes a slide-up bottom drawer (40vh max-height) triggered by family selection
- `<768px`: Single column — hero header shortened, landscape full-width, inspector below as scrollable section. Lenses accessible via horizontal pill strip above canvas.

## Panel A: Left Rail — Lens System + Filters

### Interpretive Lenses

Six lens buttons that change how the landscape is colored/interpreted. Each lens recolors the same spatial layout (positions don't change — the truth being displayed changes).

| Lens | Color mapping | MVP? |
|------|--------------|------|
| **Material** | CpG density / stacking energy / wrapping energy gradient (sequential teal scale) | YES |
| **Evolution** | Age gradient (young=bright teal → ancient=dim gray) | YES |
| **Silencing** | Dominant mechanism (see unified color table below) | YES (default) |
| **Reactivation** | Predicted reactivation susceptibility (gray→amber→rose) | YES |
| **Probe** | Array coverage (bright teal=well-covered, dim=invisible to arrays) | Phase 2 |
| **Disease** | Clinical implication (cancer, aging, inflammation) | Phase 2 |

Active lens: teal background highlight + teal text. One lens active at a time.

### Unified Silencing Categories

A single 5-category system used consistently across the Silencing Lens colors, the inspector hierarchy bar, and the data model:

| Category | Lens Color | Bar Color | `silencing_primary` value | Includes |
|----------|-----------|-----------|--------------------------|----------|
| DNA Methylation | `#4ECDC4` (teal) | teal | `"methylation"` | DNMT3B de novo + DNMT1 maintenance |
| H3K9me3 Heterochromatin | `#F0A500` (amber) | amber | `"h3k9me3"` | SETDB1/KAP1/KRAB-ZnF pathway + SUV39H |
| Polycomb / H3K27me3 | `#8B5CF6` (violet) | violet | `"h3k27me3"` | PRC2-mediated |
| Mixed / Unstable | `#F43F5E` (rose) | rose | `"mixed"` | Multiple pathways, inducible |
| None / Fossilized | `#555555` (gray) | gray | `"none"` | Sequence-diverged, no active silencing |

The inspector's Silencing Hierarchy bar breaks down the detailed contribution proportionally (e.g., "H3K9me3 Heterochromatin" might show 60% SETDB1 + 40% KRAB-ZnF) via a secondary breakdown within the amber segment. This detail comes from `TEFamilyDetail`, not the landscape-level `TEFamily`.

### Y-Axis Selector

Dropdown (`<select>`) controlling the vertical axis of the landscape:

MVP options: CpG Density, GC Content, Stacking Energy, Wrapping Energy, NDR Score
Phase 2 additions: Periodicity, Deformability, Methylation Susceptibility, Sequence Complexity

X-axis is always evolutionary age (divergence from consensus).

### Class Filters

Pill buttons, multi-select: All | LINE | SINE | LTR | DNA | SVA | Other

Active: teal border + teal-dim background. "All" deselects others; selecting a specific class deselects "All." The "Other" pill captures satellite repeats, simple repeats, and unclassified families (class value `"Other"` in the data model).

### Age Range Filters

Pill buttons, multi-select: All | <10 Mya | 10-50 | 50-150 | >150

### Quick Filters (MVP: 3 of these)

Vertical pill list:
- CpG-rich only (MVP)
- Probe-covered only (MVP)
- Perturbation responsive (MVP)
- Clinically implicated (Phase 2)
- High viral mimicry (Phase 2)

### Awakening Gradient Slider

A range input with gradient track (gray → amber → rose). Moving the slider filters the landscape to show only families above a reactivation susceptibility threshold. Label: "DEEPLY SILENT" (left) ... "EXPOSED" (right).

## Panel B: Center — Hero Landscape

### The Canvas Visualization

This is the soul of the page. A canvas-based bubble chart rendered at device pixel ratio for crisp display.

#### Bubble Encoding

Each bubble = one TE subfamily (not individual element — pre-aggregated).

| Visual Property | Data Mapping |
|----------------|-------------|
| **X position** | Evolutionary age (divergence from consensus, log-scaled). Young left, ancient right. |
| **Y position** | Selected biophysical property (from Y-axis dropdown) |
| **Radius** | Genomic abundance (total base pairs occupied, sqrt-scaled) |
| **Fill color** | Determined by active lens (see lens table) |
| **Fill opacity** | Proportional to data confidence / evidence strength |
| **Border style** | Silencing halo (see below) |
| **Glow** | Reactivation potential (none=stable, subtle=possible, strong=documented) |

#### Silencing Halos

Visible in all lenses as a consistent outer ring. All rendered via canvas drawing operations:
- **Solid ring**: Single `ctx.arc()` with 2px `lineWidth` and `strokeStyle = familyColor`. For glow effect, render an additional `arc()` at larger radius with low-alpha fill using `ctx.shadowBlur`.
- **Dashed ring**: `ctx.setLineDash([4, 3])` before `ctx.stroke()` — creates a dashed arc indicating mixed or uncertain control.
- **Radiating glow**: Three concentric `ctx.arc()` calls with progressively larger radii and decreasing alpha (0.3 → 0.15 → 0.05), plus `ctx.shadowBlur = 20` on the innermost — creates the dangerous inducible glow.

#### Background Atmosphere

- **Contour overlays**: Pre-rendered to an offscreen canvas during initialization using radial gradient fills (`ctx.createRadialGradient()`). Composited beneath the bubble layer on each frame. Teal gradient cloud behind the young methylation-silenced cluster, violet behind the Polycomb region, etc. Subtle elliptical contour strokes (rgba white 4-6%) surround major cluster centroids.
- **Grid lines**: Very faint (rgba white 3%), at 25/50/75% positions
- **Axis labels**: `TYPE.xs` (10px) uppercase, `COLOR.text.faint`, with age ticks (Mya) and property ticks

#### Interactions

| Action | Result |
|--------|--------|
| **Hover** | Bubble scales up 15%, tooltip with family name, class, copy count, dominant silencing, and the current Y-axis value |
| **Click** | Selects family → updates right panel inspector, bubble gets selected state (brighter border, slight scale) |
| **Drag** | Pan the landscape (if zoomed) |
| **Scroll** | Zoom in/out |
| **Lens change** | Bubbles recolor with 300ms transition (positions stay fixed) |
| **Filter change** | Non-matching bubbles fade to 5% opacity with 200ms transition |
| **Awakening slider** | Bubbles below threshold fade; above threshold brighten/glow |

#### Canvas Implementation Notes

- Render at `devicePixelRatio` for Retina sharpness
- Bubble positions computed once on data load, cached in Zustand store
- Lens changes only update color/opacity arrays (no reposition)
- Hover detection via simple distance check on `mousemove` — ~1,847 families is small enough that a linear scan is fast (<1ms)
- Glow effects: multiple `arc()` calls with decreasing alpha for outer rings
- Contour background: pre-rendered to offscreen canvas once on mount, composited beneath bubbles on each redraw
- Animation: `requestAnimationFrame` for smooth transitions on lens/filter changes. Interpolate color values across frames for the 300ms lens transition.

#### Legend Overlay

Floating panel, top-right of canvas, semi-transparent dark background (`rgba(10,10,10,0.85)`) with `backdrop-filter: blur(8px)`:
- Silencing mechanism color key (5 items: teal/amber/violet/rose/gray as per unified table)
- Halo style key (3 items: solid/dashed/glow)
- Legend subtitle updates when lens changes (e.g., "Showing: Material Properties" → "Showing: Silencing Mechanism")
- Rendered as DOM overlay on canvas container, not canvas-drawn

### Data Requirements for Landscape

Pre-aggregated per subfamily (not per element). The API should return a flat array of ~1,847 objects:

```typescript
interface TEFamily {
  id: string;                    // e.g., "L1HS", "AluY", "HERVK_HML2"
  display_name: string;
  class: "LINE" | "SINE" | "LTR" | "DNA" | "SVA" | "Other";
  family: string;                // e.g., "L1", "Alu", "HERVK"

  // Spatial
  divergence_pct: number;        // evolutionary age proxy (x-axis)
  copy_count: number;            // abundance (radius)
  total_bp: number;              // genomic span
  consensus_length: number;

  // Biophysical (y-axis options)
  cpg_density: number;           // CpG observed/expected ratio
  gc_content: number;            // fraction 0-1
  stacking_dg37: number;         // kcal/mol, SantaLucia nearest-neighbor
  wrapping_energy: number;       // kcal/mol, Phase 3 nucleosome wrapping
  ndr_score: number;             // 0-1, Phase 3 NDR prediction
  periodicity_power: number;     // Phase 1 10.5bp periodicity signal

  // Silencing (unified 5-category system)
  silencing_primary: "methylation" | "h3k9me3" | "h3k27me3" | "mixed" | "none";
  silencing_confidence: number;  // 0-1

  // Reactivation
  reactivation_score: number;    // 0-1 composite
  reactivation_contexts: string[];  // e.g., ["aging", "dnmti", "tet2_lof", "setdb1_lof"]

  // Observability
  epic_v2_probes: number;        // count of EPIC v2 probes overlapping this subfamily
  retro_age_probes: number;      // count of Retro-Age clock CpGs (Ndhlovu 2024) in this subfamily

  // Flags
  has_intact_orfs: boolean;
  is_active: boolean;
  clinically_implicated: boolean;
}
```

Estimated payload: ~1,847 rows x ~22 fields = ~250 KB raw JSON, ~40 KB gzipped. Fetched once on page load and cached client-side in Zustand.

## Panel C: Right — Family Inspector

Updates dynamically when a family is selected in the landscape. If nothing selected, shows a prompt: "Select a family in the landscape to inspect."

### Detail API Response

The detail endpoint returns a richer object for the selected family:

```typescript
interface TEFamilyDetail extends TEFamily {
  // Silencing detail (for inspector bar breakdown)
  silencing_breakdown: {
    mechanism: string;        // e.g., "DNMT3B", "SETDB1", "ZNF91", "piRNA", "PRC2"
    proportion: number;       // 0-1, sums to 1.0
    color: string;            // hex color for bar segment
    evidence: "curated" | "heuristic";
  }[];

  // Per-chromosome distribution
  chr_density: {
    chr: string;              // "chr1" through "chrX"
    density: number;          // relative enrichment 0-1
  }[];

  // Probe details
  top_probes: {
    probe_id: string;         // e.g., "cg06545761"
    gene: string | null;
    position: string;         // "chr16:87441441"
    is_retro_age: boolean;
  }[];
  probe_coverage_fraction: number;  // % of loci with ≥1 probe

  // Reactivation evidence
  reactivation_detail: {
    context: string;          // "dnmti" | "aging" | "tet2_lof" | "setdb1_lof"
    evidence: "STRONG" | "MODERATE" | "PREDICTED" | "UNKNOWN";
    notes: string;            // e.g., "dsRNA + RVLPs documented"
  }[];
  viral_mimicry: string | null;  // e.g., "dsRNA + RVLPs" or null

  // Representative loci
  representative_loci: {
    label: string;            // e.g., "HERVK-113 (complete provirus)"
    region: string;           // "chr19:21841536-21850008"
    notes: string;
  }[];

  // Key references
  references: {
    citation: string;         // short form: "Liu et al. 2023"
    journal: string;          // "Cell"
    summary: string;          // one-line finding
  }[];
}
```

### Inspector Sections

#### A. Family Identity

| Field | Source |
|-------|--------|
| Family name | `display_name` |
| Class / subclass | `class` / `family` |
| Consensus length | `consensus_length` |
| Copy count | `copy_count` |
| Genomic span | `total_bp` |
| Approximate age | Derived from `divergence_pct` |
| Activity status | `is_active` + `has_intact_orfs` |
| Divergence from consensus | `divergence_pct` |

#### B. Silencing Hierarchy

Stacked horizontal bar from `silencing_breakdown` array. Each segment colored per its `color` field. Segments labeled with mechanism name and percentage. Matches the unified 5-category color scheme at the top level.

Source: Curated from literature + Pehrsson ChromHMM (Phase 2). MVP uses curated values for top ~50 families, "data pending" for the rest.

#### C. Material-Channel Profile

Horizontal bar chart with 6 rows (all present in `TEFamily` interface):
- CpG density, GC%, stacking ΔG₃₇, wrapping energy, NDR score, periodicity
- Each bar: track background (`COLOR.bg.surface`) + colored fill + numeric value
- Color follows the existing accent palette (biophysical = teal/amber, structural = violet)

Source: Computed from Exp 02 (TE Biophysical Census). MVP uses pre-computed values from existing Phase 1-3.5 tracks intersected with RepeatMasker.

#### D. Genomic Distribution

22 mini chromosome bars from `chr_density` array. Bar height = relative density (0-1). Color = family's silencing color.

#### E. Probe Observability

- Count of EPIC v2 probes: `epic_v2_probes`
- Coverage fraction: `probe_coverage_fraction`
- Retro-Age clock probes: `retro_age_probes` (from Ndhlovu 2024 retroelement epigenetic clock)
- Top 3-5 probe IDs from `top_probes` (clickable → probe detail page)

#### F. Reactivation Profile

Pulsing rose dot indicator if `reactivation_score > 0.5`. Grid from `reactivation_detail` array.

Source: Curated from literature. MVP covers top ~30 families with documented reactivation; others show "UNKNOWN."

#### G. Representative Loci

3-5 entries from `representative_loci`. Each clickable, opens `/view/hg38/{region}` in the Viewer.

## API Endpoints

### New Endpoints Required

```
GET /api/v1/transposome/families
  Returns: TEFamily[] (all ~1,847 subfamilies with aggregated properties)
  Cache: Static (recomputed on data update, not per-request)
  Encoding: gzip (~40 KB)

GET /api/v1/transposome/family/{family_id}
  Returns: TEFamilyDetail (full dossier for inspector panel)
  Example: GET /api/v1/transposome/family/HERVK_HML2

GET /api/v1/transposome/region?build=hg38&region=chr7:1000000-2000000
  Returns: TE composition of a region with biophysical profiles
  (Phase 2)

GET /api/v1/transposome/probe/{probe_id}
  Returns: TE overlap annotation for a probe
  (Phase 2)
```

### Data Pipeline

The `/families` endpoint serves pre-aggregated data computed offline:

1. RepeatMasker hg38 → group by subfamily → copy count, total bp, mean divergence
2. Intersect with Phase 1-3.5 BigWig tracks → per-subfamily mean biophysics
3. Literature curation → silencing mechanism, reactivation context
4. Probe intersection → EPIC v2 probe counts per subfamily

This is the output of **Experiment 02 (TE Biophysical Census)** from the in silico experiment program. The API serves its results.

## MVP Scope

### In Scope (MVP)

- Hero header with stats
- Mode tabs (Landscape active, others disabled with "Coming soon")
- Left rail: 4 lenses (Material, Evolution, Silencing, Reactivation), Y-axis selector (5 options), class filter (with Other), age filter, 3 quick filters, awakening slider
- Center: Canvas landscape with ~1,847 subfamily bubbles, hover tooltips, click selection, lens recoloring, filter transitions
- Right panel: Full inspector with all 7 sections (A-G)
- Search: Debounced name search in BrandBar area, filters canvas by highlighting matches
- "Open in Viewer" links from representative loci
- Responsive layout at 4 breakpoints (see Three-Panel Layout section)
- Loading state: Skeleton shimmer for canvas area + "Loading transposome data..." text
- Error state: Retry prompt if API call fails

### Out of Scope (Phase 2)

- Clinical Reactivation tab
- Probe Coverage tab
- Region Tools tab (region query, DMR upload)
- Family Directory tab (sortable table)
- Probe and Disease lenses
- Export functionality
- Share URLs with encoded state
- Additional Y-axis options (deformability, complexity, methylation susceptibility)
- Perturbation explorer (map recoloring by condition)
- Cross-family comparison mode

### Data MVP

- Biophysical properties: Computed from existing Phase 1-3.5 tracks (intersect RepeatMasker × L0 biophysics at 1kb). No new computation needed beyond what the TE Biophysical Census (Exp 02) will produce.
- Silencing mechanism: Curated for top ~50 families from literature (Groh & Schotta 2017, Walter 2016, Pehrsson 2019). Remaining families classified by heuristic (age-based: young=methylation, intermediate=H3K9me3, ancient=H3K27me3/none).
- Reactivation: Curated for ~30 families with documented evidence. Others: "UNKNOWN."
- Probe counts: Computed from intersecting RepeatMasker × EPIC v2 probe coordinates (both already in API).
- Representative loci: Hand-curated for top ~20 families; auto-selected (longest intact copy) for others.

## Visual Design

### Color Scheme

Consistent with existing Polymer Genomics palette:

| Element | Color | Usage |
|---------|-------|-------|
| DNA methylation silencing | `#4ECDC4` (teal) | Dominant accent for young, methylated TEs |
| H3K9me3/SETDB1 silencing | `#F0A500` (amber) | Active heterochromatin |
| Polycomb/H3K27me3 | `#8B5CF6` (violet) | Facultative heterochromatin |
| Reactivation-prone / Mixed | `#F43F5E` (rose) | Danger/clinical salience |
| Fossilized/exapted | `#555555` (gray) | Ancient, inert |

### Typography

All JetBrains Mono. Sizes per theme.ts `TYPE` scale. Section headers: `TYPE.xs` (10px), `WEIGHT.medium` (500), 0.08em tracking, uppercase, `COLOR.text.faint`.

### Spacing

4px base unit per theme.ts `SPACE` tokens.

### Transitions

- Lens change: 300ms color interpolation on all bubbles via `requestAnimationFrame`
- Filter: 200ms opacity transition on excluded bubbles
- Selection: 150ms border/scale transition
- Panel content: instant swap (no animation on inspector updates)

## Accessibility

- **Canvas accessibility**: A hidden `<div>` overlay positioned absolutely over the canvas contains one `<button role="option">` per bubble, with `aria-label` set to the family name and key stats. Visually hidden via `clip: rect(0,0,0,0)` but navigable by screen readers and keyboard. Focus on a hidden button triggers the same selection behavior as clicking the canvas bubble.
- **Keyboard navigation**: Tab cycles through lenses/filters/hidden bubble buttons. Enter selects. Arrow keys move between adjacent bubbles (sorted by x-position).
- **Color-blind safe**: Silencing halos (solid/dashed/glow) provide shape distinction independent of color. Legend includes text labels alongside color dots.
- **Sufficient contrast**: All text meets WCAG AA on dark backgrounds (verified in existing theme).

## Performance

- Initial load: Single API call (~40 KB gzipped), canvas render <100ms for ~1,847 bubbles
- Lens transitions: Color array update + redraw <16ms (one frame)
- Memory: Negligible (small dataset, single canvas, hidden overlay ~1,847 lightweight DOM nodes)
- No SSR needed for canvas content — page shell can SSR, canvas hydrates client-side
- Detail endpoint: Fetched on family selection (~2 KB per family), cached per session

## Success Criteria

1. Page loads and renders landscape in <2 seconds on broadband
2. Lens switching feels instant (<100ms perceived)
3. Users can find a specific TE family in <10 seconds (search or visual scan)
4. Inspector provides actionable information (probe IDs, locus coordinates, reactivation status) without leaving the page
5. Scientists share the page because the landscape visualization reveals structure they haven't seen before
