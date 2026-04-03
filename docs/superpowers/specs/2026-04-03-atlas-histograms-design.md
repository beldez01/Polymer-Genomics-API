# Atlas Page: Genome-at-a-Glance Histograms

**Date**: 2026-04-03
**Status**: Approved
**Scope**: Pre-computed distribution histograms for the atlas overview and per-chromosome detail views

## Summary

Add 6 distribution histograms to the atlas page, rendered from pre-computed static data (zero API calls). The histograms appear genome-wide below the karyotype, and per-chromosome in the detail view with a ghost overlay of the genome-wide distribution for context.

## Metrics

| # | Metric | Source Table | Bin Strategy | Scale |
|---|--------|-------------|-------------|-------|
| 1 | Exon length | gene.features (type=exon) | ~30 log bins, 10 bp - 50 kb | log |
| 2 | Intron length | gene.features (type=intron) | ~30 log bins, 50 bp - 2 Mb | log |
| 3 | Gene length | bioenergetics.gene_costs.gene_length_bp | ~30 log bins, 500 bp - 5 Mb | log |
| 4 | GC content | sequence_biophysics.l0.gc_content | ~40 linear bins, 0.20 - 0.80 | linear |
| 5 | Protein length | bioenergetics.gene_costs.protein_length | ~30 log bins, 20 - 35,000 aa | log |
| 6 | Biosynthetic cost | bioenergetics.gene_costs.ecpa_b20 | ~30 log bins | log |

## Data Shape

```typescript
interface HistogramMetric {
  id: string;              // e.g. "exon_length"
  label: string;           // "Exon Length"
  xLabel: string;          // "Length (bp)"
  unit: string;            // "bp", "aa", "%", "ATP eq."
  logScale: boolean;
  binEdges: number[];      // N+1 edges for N bins
  genome: number[];        // counts per bin, genome-wide
  byChr: Record<string, number[]>;  // counts per bin, per chromosome
  stats: {
    median: number;
    mean: number;
    total: number;         // total features counted
  };
}
```

Static file: `viewer/src/config/atlasHistograms.ts`
Generator script: `viewer/scripts/generate-atlas-histograms.py`

Estimated file size: ~15K data points (6 metrics x ~35 bins x 25 groups). Trivially small as a TS file.

## Data Generation

Python script connecting to Fly Postgres via `fly proxy`. Runs 6 aggregate SQL queries using `width_bucket()` for linear bins and `floor(log10())` for log-spaced bins. Each query returns bin index + count, grouped by chromosome. The script writes the static TypeScript config file.

Requirements: `psycopg2`, active `fly proxy` session on port 5433.

### SQL Strategy

- **Exon/intron lengths**: `SELECT chr_id, floor(log10(end_pos - start_pos + 1) * N) AS bin, count(*) FROM gene.features WHERE feature_type = 'exon' GROUP BY chr_id, bin`
- **Gene length**: `SELECT chr_id, floor(log10(gene_length_bp) * N) AS bin, count(*) FROM bioenergetics.gene_costs GROUP BY chr_id, bin`
- **GC content**: `SELECT chr_id, width_bucket(gc_content, 0.20, 0.80, 40) AS bin, count(*) FROM sequence_biophysics.l0 GROUP BY chr_id, bin`
- **Protein length**: `SELECT chr_id, floor(log10(protein_length) * N) AS bin, count(*) FROM bioenergetics.gene_costs WHERE protein_length > 0 GROUP BY chr_id, bin`
- **ECPA**: `SELECT chr_id, floor(log10(ecpa_b20) * N) AS bin, count(*) FROM bioenergetics.gene_costs WHERE ecpa_b20 > 0 GROUP BY chr_id, bin`

Joins to `ref.chromosomes` for chr_id-to-name mapping.

## Visual Design

### CanvasHistogram Component

New file: `viewer/src/components/atlas/CanvasHistogram.tsx`

- Canvas-based rendering (consistent with existing viz, no charting library)
- Dark theme using existing design tokens:
  - Background: `COLOR.bg.elevated`
  - Border: `COLOR.border.subtle`
  - Text: `COLOR.text.tertiary` (labels), `COLOR.text.secondary` (title)
- Primary bars: `COLOR.accent.teal` at 0.8 opacity
- Ghost overlay bars (per-chr view): white at 0.12 opacity
- Hover interaction: highlight bar, tooltip with bin range + count + percentage of total
- Median line: dashed vertical rule with small label
- Title: top-left, metric name
- Count badge: top-right, "n = 20,142" format
- X-axis: tick labels formatted for log scale ("100", "1K", "10K", "100K", "1M")
- Y-axis: count, auto-scaled to data range
- Component accepts flexible width/height, default ~350x200

### Props

```typescript
interface CanvasHistogramProps {
  metric: HistogramMetric;
  chrName?: string;        // if set, shows per-chr with genome ghost overlay
  width?: number;
  height?: number;
}
```

When `chrName` is provided:
- Primary bars use `metric.byChr[chrName]`
- Ghost bars use `metric.genome` (normalized to same y-scale)
- Title shows "Exon Length -- chr16"

When `chrName` is omitted:
- Primary bars use `metric.genome`
- No ghost overlay
- Title shows "Exon Length"

### Layout: Atlas Overview

Below the karyotype, above the existing "Genome Overview" stats box:

```
[Karyotype row]

--- Genome at a Glance -------------------------------------------
| Exon Length     | Intron Length    | Gene Length      |  <- Structure
| GC Content      | Protein Length   | Biosynthetic Cost|  <- Composition & Proteome
------------------------------------------------------------------

[Genome Overview stats box]
```

- Section header: "Genome at a Glance" in uppercase teal (same style as "Genome Overview")
- 3-column x 2-row grid, gap of SPACE[4]
- Row labels: subtle left-side text "Structure" / "Composition & Proteome"
- Responsive: collapses to 2 columns on narrower screens
- Container: max-width 1200px, centered (matches karyotype)

### Layout: Chromosome Detail

Same 6 histograms in the same grid layout, placed in the chromosome detail view. Each histogram shows:
- That chromosome's distribution as primary bars
- Genome-wide distribution as ghost overlay behind
- Title: "Metric -- chrN"

## Files to Create

1. `viewer/scripts/generate-atlas-histograms.py` -- data generation script
2. `viewer/src/config/atlasHistograms.ts` -- generated static data
3. `viewer/src/components/atlas/CanvasHistogram.tsx` -- histogram component
4. `viewer/src/components/atlas/GenomeAtAGlance.tsx` -- overview section with 6 histograms

## Files to Modify

1. `viewer/src/components/atlas/KaryotypeOverview.tsx` -- add GenomeAtAGlance section below karyotype
2. `viewer/src/components/atlas/ChromosomeDetail.tsx` -- add per-chromosome histogram section

## Non-Goals

- No real-time API fetching for histogram data
- No interactivity beyond hover tooltips (no zoom, brush, or click-to-filter)
- No TE/repeat distributions (future addition)
- No per-gene drill-down from histogram bars
