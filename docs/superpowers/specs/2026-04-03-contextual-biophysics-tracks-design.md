# Contextual Biophysics Tracks — Design Spec

## Goal

Add three new canvas-based tracks to the genome browser that visualize the contextual biophysics engine: StabilityTrack (ΔG + bubble propensity + context deviation), StructureTrack (curvature + flexibility), MotifTrack (G4, Z-DNA, homopolymers, inverted repeats).

## Data Source Strategy

- **Coarse zoom (viewport >1Mb)**: fetch from existing precomputed 1kb database layers via `fetchRegion()` (stacking_dG37, curvature)
- **Fine zoom (viewport ≤1Mb)**: call `/v1/biophysics/{build}/{region}` compute endpoint for per-dinucleotide contextual features
- Transition is seamless — same track, different data source based on zoom level

## New Components

### 1. StabilityTrack.tsx

Three overlaid signals in one 80px canvas track:
- **Stacking ΔG₃₇** — line chart, teal color. Y-axis: -2.5 to -0.5 kcal/mol
- **Bubble propensity** — filled area chart, rose color (semi-transparent). Y-axis: 0-1
- **Context deviation** — diverging bars from zero line. Red (positive = vulnerability), blue (negative = anchor)

Coarse fallback: stacking_dG37 line only from 1kb layer.

### 2. StructureTrack.tsx

Two overlaid signals in one 60px canvas track:
- **Curvature** — line chart, amber color. Y-axis: 0 to max in view
- **Flexibility (TRX)** — line chart, violet color. Y-axis: 0-43

Coarse fallback: curvature line only from 1kb layer.

### 3. MotifTrack.tsx

Colored blocks on a 40px track (annotation-style, like RepeatTrack):
- **G-quadruplex** — green blocks
- **Z-DNA-prone** — blue blocks
- **Homopolymer runs** — gray blocks with type label (A/T/G/C)
- **Inverted repeats** — orange blocks

Fine zoom only (≤1Mb). Hidden at coarse zoom.

## API Integration

New function in `src/lib/api.ts`:
```typescript
fetchBiophysicsCompute(build: string, region: string, properties: string): Promise<BiophysicsResponse>
```

Calls `GET /api/v1/biophysics/{build}/{region}?properties={properties}`.

Response type matches existing GRanges envelope with mcols for per-step data and top-level motifs key.

## Sidebar Integration

Add three toggles to the "BIOPHYSICS" category in Sidebar.tsx, below existing DNA Shape / GC tracks:
- Stability (default: off)
- Structure (default: off)
- Motifs (default: off)

Viewport store: add `showStability`, `showStructure`, `showMotifs` boolean flags.

## Canvas Rendering

Follow existing patterns from DNAShapeTrack.tsx:
- Device pixel ratio scaling
- Grid lines via `drawGridlines()` utility
- Coordinate mapping via viewport start/end → canvas pixel
- Left label (80px) with track name and legend dots
- Tooltip on hover showing values at cursor position

## Theme Colors

Add to `config/theme.ts` under a new `stability` key:
```typescript
stability: { dg: '#4ECDC4', bubble: '#FF6B6B', anchor: '#4A9EFF', vuln: '#FF4444' }
structure: { curvature: '#F4A261', flexibility: '#7B68EE' }
motif: { g4: '#2ECC71', zdna: '#3498DB', homopolymer: '#95A5A6', inverted: '#E67E22' }
```
