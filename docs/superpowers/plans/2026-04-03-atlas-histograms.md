# Atlas Histograms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 pre-computed distribution histograms to the atlas page (genome-wide overview + per-chromosome detail with ghost overlay).

**Architecture:** A Python script queries the production database via fly proxy to compute histogram bins for 6 metrics (exon length, intron length, gene length, GC content, protein length, biosynthetic cost), grouped genome-wide and per-chromosome. Output is a static TypeScript config file. A reusable canvas-based `CanvasHistogram` component renders the data. A `GenomeAtAGlance` wrapper lays out all 6 in a grid below the karyotype. `ChromosomeDetail` gets the same 6 with genome-wide ghost overlay.

**Tech Stack:** Python 3 + asyncpg (data generation), TypeScript + React 19 + HTML5 Canvas (rendering), Next.js 15 (framework)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `viewer/scripts/generate-atlas-histograms.py` | Queries Fly Postgres, computes 6 histogram bin arrays, writes TS file |
| Create | `viewer/src/config/atlasHistograms.ts` | Generated static data — 6 metrics × bin edges + genome + per-chr counts |
| Create | `viewer/src/components/atlas/CanvasHistogram.tsx` | Reusable canvas histogram with ghost overlay, hover tooltip, median line |
| Create | `viewer/src/components/atlas/GenomeAtAGlance.tsx` | 3×2 grid of histograms with section header and row labels |
| Modify | `viewer/src/components/atlas/KaryotypeOverview.tsx` | Import and render `GenomeAtAGlance` between isochore legend and Genome Overview box |
| Modify | `viewer/src/components/atlas/ChromosomeDetail.tsx` | Add per-chromosome histogram section with ghost overlay |

---

### Task 1: Data Generation Script

**Files:**
- Create: `viewer/scripts/generate-atlas-histograms.py`

This script connects to the production Fly Postgres (via `fly proxy` on localhost:5433), runs 6 aggregate SQL queries, and writes the static TypeScript config file.

- [ ] **Step 1: Create the generation script**

```python
#!/usr/bin/env python3
"""
Generate pre-computed histogram data for the atlas page.

Connects to Fly Postgres via fly proxy (localhost:5433).
Output: viewer/src/config/atlasHistograms.ts

Usage:
  fly proxy 5433 -a polymer-db  # in another terminal
  python scripts/generate-atlas-histograms.py
"""
import asyncio
import json
import math
import os
import sys
from pathlib import Path

import asyncpg

DB_HOST = os.environ.get("POSTGRES_HOST", "localhost")
DB_PORT = int(os.environ.get("POSTGRES_PORT", "5433"))
DB_NAME = os.environ.get("POSTGRES_DB", "polymer_genomics")
DB_USER = os.environ.get("POSTGRES_USER", "admin")
DB_PASS = os.environ.get("POSTGRES_PASSWORD", "dev_password")

BUILD = "hg38"

# ---------------------------------------------------------------------------
# Bin edge definitions
# ---------------------------------------------------------------------------

def log_edges(lo: float, hi: float, n: int) -> list[float]:
    """Generate n+1 log-spaced bin edges from lo to hi."""
    return [round(10 ** (math.log10(lo) + i * (math.log10(hi) - math.log10(lo)) / n), 2)
            for i in range(n + 1)]

def linear_edges(lo: float, hi: float, n: int) -> list[float]:
    """Generate n+1 linearly-spaced bin edges from lo to hi."""
    step = (hi - lo) / n
    return [round(lo + i * step, 4) for i in range(n + 1)]

METRICS = [
    {
        "id": "exon_length",
        "label": "Exon Length",
        "xLabel": "Length (bp)",
        "unit": "bp",
        "logScale": True,
        "edges": log_edges(10, 50_000, 30),
        "sql": """
            SELECT c.chr_name, width_bucket(ln(f.end_pos - f.start_pos + 1), ln(10), ln(50000), 30) AS bin,
                   count(*) AS cnt
            FROM gene.features f
            JOIN ref.chromosomes c ON c.chr_id = f.chr_id
            WHERE f.feature_type = 'exon' AND f.build = $1
              AND (f.end_pos - f.start_pos + 1) BETWEEN 10 AND 50000
            GROUP BY c.chr_name, bin ORDER BY c.chr_name, bin
        """,
        "stats_sql": """
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY len) AS median,
                   avg(len) AS mean, count(*) AS total
            FROM (SELECT (end_pos - start_pos + 1)::float AS len
                  FROM gene.features WHERE feature_type = 'exon' AND build = $1
                  AND (end_pos - start_pos + 1) BETWEEN 10 AND 50000) t
        """,
    },
    {
        "id": "intron_length",
        "label": "Intron Length",
        "xLabel": "Length (bp)",
        "unit": "bp",
        "logScale": True,
        "edges": log_edges(50, 2_000_000, 30),
        "sql": """
            SELECT c.chr_name, width_bucket(ln(f.end_pos - f.start_pos + 1), ln(50), ln(2000000), 30) AS bin,
                   count(*) AS cnt
            FROM gene.features f
            JOIN ref.chromosomes c ON c.chr_id = f.chr_id
            WHERE f.feature_type = 'intron' AND f.build = $1
              AND (f.end_pos - f.start_pos + 1) BETWEEN 50 AND 2000000
            GROUP BY c.chr_name, bin ORDER BY c.chr_name, bin
        """,
        "stats_sql": """
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY len) AS median,
                   avg(len) AS mean, count(*) AS total
            FROM (SELECT (end_pos - start_pos + 1)::float AS len
                  FROM gene.features WHERE feature_type = 'intron' AND build = $1
                  AND (end_pos - start_pos + 1) BETWEEN 50 AND 2000000) t
        """,
    },
    {
        "id": "gene_length",
        "label": "Gene Length",
        "xLabel": "Length (bp)",
        "unit": "bp",
        "logScale": True,
        "edges": log_edges(500, 5_000_000, 30),
        "sql": """
            SELECT c.chr_name, width_bucket(ln(g.gene_length_bp), ln(500), ln(5000000), 30) AS bin,
                   count(*) AS cnt
            FROM profiles.gene_identity g
            JOIN ref.chromosomes c ON c.chr_id = g.chr_id
            WHERE g.build = $1 AND g.gene_length_bp BETWEEN 500 AND 5000000
            GROUP BY c.chr_name, bin ORDER BY c.chr_name, bin
        """,
        "stats_sql": """
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY gene_length_bp::float) AS median,
                   avg(gene_length_bp::float) AS mean, count(*) AS total
            FROM profiles.gene_identity
            WHERE build = $1 AND gene_length_bp BETWEEN 500 AND 5000000
        """,
    },
    {
        "id": "gc_content",
        "label": "GC Content",
        "xLabel": "GC Fraction",
        "unit": "%",
        "logScale": False,
        "edges": linear_edges(0.20, 0.80, 40),
        "sql": """
            SELECT c.chr_name, width_bucket(s.gc_content, 0.20, 0.80, 40) AS bin,
                   count(*) AS cnt
            FROM biophysics.sequence_properties s
            JOIN ref.chromosomes c ON c.chr_id = s.chr_id
            WHERE s.build = $1 AND s.gc_content BETWEEN 0.20 AND 0.80
            GROUP BY c.chr_name, bin ORDER BY c.chr_name, bin
        """,
        "stats_sql": """
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY gc_content) AS median,
                   avg(gc_content) AS mean, count(*) AS total
            FROM biophysics.sequence_properties
            WHERE build = $1 AND gc_content BETWEEN 0.20 AND 0.80
        """,
    },
    {
        "id": "protein_length",
        "label": "Protein Length",
        "xLabel": "Length (aa)",
        "unit": "aa",
        "logScale": True,
        "edges": log_edges(20, 35_000, 30),
        "sql": """
            SELECT c.chr_name, width_bucket(ln(g.protein_length), ln(20), ln(35000), 30) AS bin,
                   count(*) AS cnt
            FROM bioenergetics.gene_costs g
            JOIN ref.chromosomes c ON c.chr_id = g.chr_id
            WHERE g.build = $1 AND g.protein_length BETWEEN 20 AND 35000
            GROUP BY c.chr_name, bin ORDER BY c.chr_name, bin
        """,
        "stats_sql": """
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY protein_length::float) AS median,
                   avg(protein_length::float) AS mean, count(*) AS total
            FROM bioenergetics.gene_costs
            WHERE build = $1 AND protein_length BETWEEN 20 AND 35000
        """,
    },
    {
        "id": "biosynthetic_cost",
        "label": "Biosynthetic Cost",
        "xLabel": "ECPA (ATP eq./aa)",
        "unit": "ATP eq.",
        "logScale": True,
        "edges": log_edges(15, 40, 30),
        "sql": """
            SELECT c.chr_name, width_bucket(ln(g.ecpa_b20), ln(15), ln(40), 30) AS bin,
                   count(*) AS cnt
            FROM bioenergetics.gene_costs g
            JOIN ref.chromosomes c ON c.chr_id = g.chr_id
            WHERE g.build = $1 AND g.ecpa_b20 BETWEEN 15 AND 40
            GROUP BY c.chr_name, bin ORDER BY c.chr_name, bin
        """,
        "stats_sql": """
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ecpa_b20) AS median,
                   avg(ecpa_b20) AS mean, count(*) AS total
            FROM bioenergetics.gene_costs
            WHERE build = $1 AND ecpa_b20 BETWEEN 15 AND 40
        """,
    },
]

# ---------------------------------------------------------------------------
# Query execution
# ---------------------------------------------------------------------------

async def fetch_metric(conn: asyncpg.Connection, metric: dict) -> dict:
    """Run binning + stats queries for one metric, return assembled dict."""
    print(f"  Querying {metric['id']}...")

    rows = await conn.fetch(metric["sql"], BUILD)
    stats_row = await conn.fetchrow(metric["stats_sql"], BUILD)

    n_bins = len(metric["edges"]) - 1

    # Assemble per-chromosome counts
    by_chr: dict[str, list[int]] = {}
    for row in rows:
        chr_name = row["chr_name"]
        bin_idx = row["bin"]  # width_bucket returns 1..n_bins (0 = below, n_bins+1 = above)
        cnt = row["cnt"]
        if chr_name not in by_chr:
            by_chr[chr_name] = [0] * n_bins
        if 1 <= bin_idx <= n_bins:
            by_chr[chr_name][bin_idx - 1] += cnt

    # Genome-wide = sum across chromosomes
    genome = [0] * n_bins
    for counts in by_chr.values():
        for i, c in enumerate(counts):
            genome[i] += c

    return {
        "id": metric["id"],
        "label": metric["label"],
        "xLabel": metric["xLabel"],
        "unit": metric["unit"],
        "logScale": metric["logScale"],
        "binEdges": metric["edges"],
        "genome": genome,
        "byChr": by_chr,
        "stats": {
            "median": round(float(stats_row["median"]), 2) if stats_row["median"] else 0,
            "mean": round(float(stats_row["mean"]), 2) if stats_row["mean"] else 0,
            "total": int(stats_row["total"]) if stats_row["total"] else 0,
        },
    }


async def main():
    print("Connecting to database...")
    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT, database=DB_NAME,
        user=DB_USER, password=DB_PASS,
    )
    print(f"Connected. Generating histogram data for {len(METRICS)} metrics...")

    results = []
    for metric in METRICS:
        result = await fetch_metric(conn, metric)
        total = sum(result["genome"])
        print(f"    {metric['id']}: {total:,} features across {len(result['byChr'])} chromosomes")
        results.append(result)

    await conn.close()

    # Write TypeScript file
    out_path = Path(__file__).parent.parent / "src" / "config" / "atlasHistograms.ts"
    total_points = sum(
        len(m["genome"]) * (1 + len(m["byChr"])) for m in results
    )

    lines = [
        "/**",
        " * Pre-computed histogram data for the Atlas page (Genome at a Glance).",
        f" * Generated by: python scripts/generate-atlas-histograms.py",
        f" * Generated on: {__import__('datetime').date.today().isoformat()}",
        f" * Total data points: {total_points:,}",
        " *",
        " * This eliminates database queries on every atlas page load.",
        " */",
        "",
        "export interface HistogramMetric {",
        "  id: string;",
        "  label: string;",
        "  xLabel: string;",
        "  unit: string;",
        "  logScale: boolean;",
        "  binEdges: number[];",
        "  genome: number[];",
        "  byChr: Record<string, number[]>;",
        "  stats: { median: number; mean: number; total: number };",
        "}",
        "",
        f"export const ATLAS_HISTOGRAMS: HistogramMetric[] = {json.dumps(results, separators=(',', ':'))};",
        "",
    ]

    out_path.write_text("\n".join(lines))
    print(f"\nWrote {out_path} ({total_points:,} data points)")


if __name__ == "__main__":
    asyncio.run(main())
```

Write this to `viewer/scripts/generate-atlas-histograms.py`.

- [ ] **Step 2: Start fly proxy and run the script**

In one terminal:
```bash
fly proxy 5433 -a polymer-db
```

In another terminal:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer
python scripts/generate-atlas-histograms.py
```

Expected output: 6 metrics queried, file written to `src/config/atlasHistograms.ts`.

- [ ] **Step 3: Verify the generated file**

```bash
npx tsc --noEmit
```

Expected: clean compile, no errors. Spot-check the file: should have 6 entries in the array, each with `binEdges`, `genome`, `byChr` with 24 chromosome keys, and `stats`.

- [ ] **Step 4: Commit**

```bash
git add viewer/scripts/generate-atlas-histograms.py viewer/src/config/atlasHistograms.ts
git commit -m "feat(atlas): pre-compute histogram data for 6 genomic/proteomic distributions"
```

---

### Task 2: CanvasHistogram Component

**Files:**
- Create: `viewer/src/components/atlas/CanvasHistogram.tsx`

A reusable canvas-based histogram component. Supports genome-wide view (primary bars only) and per-chromosome view (primary bars + genome-wide ghost overlay). Hover tooltip, median line, formatted axis labels.

- [ ] **Step 1: Create the CanvasHistogram component**

```tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { COLOR, FONT_FAMILY, TYPE } from '@/config/theme';
import type { HistogramMetric } from '@/config/atlasHistograms';

interface CanvasHistogramProps {
  metric: HistogramMetric;
  chrName?: string;
  width?: number;
  height?: number;
}

// Margins inside the canvas for axes
const MARGIN = { top: 28, right: 12, bottom: 32, left: 44 };

/** Format a number for axis labels: 100 → "100", 1500 → "1.5K", 1000000 → "1M" */
function fmtAxis(v: number, isGC: boolean): string {
  if (isGC) return (v * 100).toFixed(0) + '%';
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1) + 'K';
  return v.toFixed(v < 1 ? 2 : 0);
}

/** Format a count for the tooltip */
function fmtCount(n: number): string {
  return n.toLocaleString();
}

export function CanvasHistogram({ metric, chrName, width = 350, height = 200 }: CanvasHistogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; binIdx: number } | null>(null);

  const primary = chrName ? (metric.byChr[chrName] ?? []) : metric.genome;
  const ghost = chrName ? metric.genome : null;
  const title = chrName ? `${metric.label} \u2014 ${chrName}` : metric.label;
  const isGC = metric.id === 'gc_content';

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const nBins = metric.binEdges.length - 1;
  const barW = plotW / nBins;

  // Determine y-axis max from whichever dataset is taller
  const maxPrimary = Math.max(...primary, 1);
  const maxGhost = ghost ? Math.max(...ghost, 1) : 0;
  const yMax = Math.max(maxPrimary, maxGhost) * 1.08;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = COLOR.bg.elevated;
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = COLOR.border.subtle;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    // Title (top-left)
    ctx.font = `500 ${TYPE.sm.fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.secondary;
    ctx.textAlign = 'left';
    ctx.fillText(title, MARGIN.left, 16);

    // Count badge (top-right)
    const totalCount = chrName
      ? primary.reduce((s, c) => s + c, 0)
      : metric.stats.total;
    ctx.font = `400 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`n = ${fmtCount(totalCount)}`, width - MARGIN.right, 16);

    // Plot area
    const toX = (binIdx: number) => MARGIN.left + binIdx * barW;
    const toY = (count: number) => MARGIN.top + plotH - (count / yMax) * plotH;

    // Ghost bars (genome-wide silhouette)
    if (ghost) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      for (let i = 0; i < nBins; i++) {
        const bh = (ghost[i] / yMax) * plotH;
        if (bh > 0.5) {
          ctx.fillRect(toX(i) + 1, toY(ghost[i]), barW - 2, bh);
        }
      }
    }

    // Primary bars
    ctx.fillStyle = COLOR.accent.teal + 'CC'; // ~0.8 opacity
    for (let i = 0; i < nBins; i++) {
      const bh = (primary[i] / yMax) * plotH;
      if (bh > 0.5) {
        ctx.fillRect(toX(i) + 1, toY(primary[i]), barW - 2, bh);
      }
    }

    // Hover highlight
    if (hover && hover.binIdx >= 0 && hover.binIdx < nBins) {
      const i = hover.binIdx;
      const bh = (primary[i] / yMax) * plotH;
      ctx.fillStyle = COLOR.accent.teal;
      if (bh > 0.5) {
        ctx.fillRect(toX(i) + 1, toY(primary[i]), barW - 2, bh);
      }
    }

    // Median line
    if (metric.stats.median > 0) {
      const edges = metric.binEdges;
      // Find fractional bin position for median
      let medBin = 0;
      for (let i = 0; i < nBins; i++) {
        if (metric.stats.median >= edges[i] && metric.stats.median < edges[i + 1]) {
          medBin = i + (metric.stats.median - edges[i]) / (edges[i + 1] - edges[i]);
          break;
        }
      }
      const mx = toX(medBin);
      if (mx > MARGIN.left && mx < width - MARGIN.right) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = COLOR.accent.amber + '99';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, MARGIN.top);
        ctx.lineTo(mx, MARGIN.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Median label
        ctx.font = `400 8px ${FONT_FAMILY}`;
        ctx.fillStyle = COLOR.accent.amber + '99';
        ctx.textAlign = 'center';
        ctx.fillText('med', mx, MARGIN.top + plotH + 10);
      }
    }

    // X-axis ticks — show ~5-7 evenly spaced labels
    const tickStep = Math.max(1, Math.floor(nBins / 6));
    ctx.font = `400 ${TYPE.xs.fontSize - 1}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.faint;
    ctx.textAlign = 'center';
    for (let i = 0; i <= nBins; i += tickStep) {
      const x = toX(i);
      const label = fmtAxis(metric.binEdges[i], isGC);
      ctx.fillText(label, x, height - 8);
      // Tick mark
      ctx.strokeStyle = COLOR.border.strong;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, MARGIN.top + plotH);
      ctx.lineTo(x, MARGIN.top + plotH + 3);
      ctx.stroke();
    }

    // Y-axis: just a few tick marks
    const yTicks = 4;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR.text.faint;
    ctx.font = `400 ${TYPE.xs.fontSize - 1}px ${FONT_FAMILY}`;
    for (let i = 0; i <= yTicks; i++) {
      const val = (yMax / yTicks) * i;
      const y = toY(val);
      ctx.fillText(fmtCount(Math.round(val)), MARGIN.left - 4, y + 3);
      // Grid line
      ctx.strokeStyle = COLOR.border.subtle;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(width - MARGIN.right, y);
      ctx.stroke();
    }

    // X-axis label
    ctx.font = `400 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'center';
    ctx.fillText(metric.xLabel, MARGIN.left + plotW / 2, height - 1);
  }, [width, height, primary, ghost, hover, metric, chrName, title, isGC, plotW, plotH, barW, nBins, yMax]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const binIdx = Math.floor((x - MARGIN.left) / barW);
    if (binIdx >= 0 && binIdx < nBins && y >= MARGIN.top && y <= MARGIN.top + plotH) {
      setHover({ x, y, binIdx });
    } else {
      setHover(null);
    }
  }, [barW, nBins, plotH]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  // Tooltip data
  const tooltipBin = hover?.binIdx;
  const tooltipCount = tooltipBin != null ? primary[tooltipBin] : 0;
  const tooltipTotal = primary.reduce((s, c) => s + c, 0);
  const tooltipPct = tooltipTotal > 0 && tooltipBin != null
    ? ((tooltipCount / tooltipTotal) * 100).toFixed(1) : '0';
  const tooltipRange = tooltipBin != null
    ? `${fmtAxis(metric.binEdges[tooltipBin], isGC)} \u2013 ${fmtAxis(metric.binEdges[tooltipBin + 1], isGC)}`
    : '';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', cursor: hover ? 'crosshair' : 'default' }}
      />
      {hover && tooltipBin != null && (
        <div style={{
          position: 'absolute',
          left: hover.x + 12,
          top: hover.y - 40,
          backgroundColor: COLOR.bg.surface,
          border: `1px solid ${COLOR.border.strong}`,
          padding: '4px 8px',
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          color: COLOR.text.secondary,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 50,
        }}>
          <div>{tooltipRange}</div>
          <div style={{ color: COLOR.accent.teal }}>{fmtCount(tooltipCount)} ({tooltipPct}%)</div>
        </div>
      )}
    </div>
  );
}
```

Write this to `viewer/src/components/atlas/CanvasHistogram.tsx`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add viewer/src/components/atlas/CanvasHistogram.tsx
git commit -m "feat(atlas): add CanvasHistogram component with ghost overlay and hover tooltip"
```

---

### Task 3: GenomeAtAGlance Section Component

**Files:**
- Create: `viewer/src/components/atlas/GenomeAtAGlance.tsx`

Renders 6 histograms in a 3×2 grid with section header and row labels. For the overview (genome-wide), no `chrName` prop. For per-chromosome use, pass `chrName`.

- [ ] **Step 1: Create the GenomeAtAGlance component**

```tsx
'use client';

import { ATLAS_HISTOGRAMS } from '@/config/atlasHistograms';
import { CanvasHistogram } from './CanvasHistogram';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';

interface GenomeAtAGlanceProps {
  /** If provided, shows per-chromosome distributions with genome-wide ghost overlay */
  chrName?: string;
}

// Row definitions — metric IDs in display order
const ROW_1 = ['exon_length', 'intron_length', 'gene_length'];
const ROW_2 = ['gc_content', 'protein_length', 'biosynthetic_cost'];

const ROW_LABELS: Record<string, string> = {
  row1: 'Structure',
  row2: 'Composition & Proteome',
};

function getMetric(id: string) {
  return ATLAS_HISTOGRAMS.find(m => m.id === id);
}

export function GenomeAtAGlance({ chrName }: GenomeAtAGlanceProps) {
  const sectionTitle = chrName
    ? `${chrName} at a Glance`
    : 'Genome at a Glance';

  return (
    <div style={{
      maxWidth: 1200,
      margin: `${SPACE[6]}px auto`,
      padding: `0 ${SPACE[4]}px`,
    }}>
      {/* Section header */}
      <div style={{
        color: COLOR.accent.teal,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        marginBottom: SPACE[4],
        textAlign: 'center',
      }}>
        {sectionTitle}
      </div>

      {/* Row 1: Structure */}
      <HistogramRow ids={ROW_1} label={ROW_LABELS.row1} chrName={chrName} />

      {/* Row 2: Composition & Proteome */}
      <HistogramRow ids={ROW_2} label={ROW_LABELS.row2} chrName={chrName} />
    </div>
  );
}

function HistogramRow({ ids, label, chrName }: { ids: string[]; label: string; chrName?: string }) {
  return (
    <div style={{ marginBottom: SPACE[4] }}>
      {/* Row label */}
      <div style={{
        color: COLOR.text.faint,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        letterSpacing: '0.04em',
        marginBottom: SPACE[2],
      }}>
        {label}
      </div>

      {/* Histogram grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: SPACE[3],
      }}>
        {ids.map(id => {
          const metric = getMetric(id);
          if (!metric) return null;
          return (
            <CanvasHistogram
              key={id}
              metric={metric}
              chrName={chrName}
              width={370}
              height={200}
            />
          );
        })}
      </div>
    </div>
  );
}
```

Write this to `viewer/src/components/atlas/GenomeAtAGlance.tsx`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add viewer/src/components/atlas/GenomeAtAGlance.tsx
git commit -m "feat(atlas): add GenomeAtAGlance section with 3x2 histogram grid"
```

---

### Task 4: Integrate into KaryotypeOverview

**Files:**
- Modify: `viewer/src/components/atlas/KaryotypeOverview.tsx`

Add the `GenomeAtAGlance` component between the isochore legend and the Genome Overview stats box.

- [ ] **Step 1: Add the import**

At the top of `viewer/src/components/atlas/KaryotypeOverview.tsx`, add after the existing imports:

```tsx
import { GenomeAtAGlance } from './GenomeAtAGlance';
```

- [ ] **Step 2: Insert GenomeAtAGlance between the isochore legend and Genome Overview box**

In `KaryotypeOverview.tsx`, find the closing `</div>` of the isochore legend section (the `div` with the `AT-rich ← → GC-rich` label). Insert the `GenomeAtAGlance` component immediately after it, before the Genome Overview stats section (the `{(() => {` block).

Insert this JSX:

```tsx
      {/* Genome at a Glance — distribution histograms */}
      <GenomeAtAGlance />
```

Place it right after the isochore legend closing `</div>` and before the `{/* Genome Overview summary */}` comment.

- [ ] **Step 3: Verify TypeScript compiles and visually inspect**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit
```

Then run the dev server:
```bash
npm run dev
```

Navigate to `http://localhost:3000/atlas` and verify:
- 6 histograms appear below the karyotype in a 3×2 grid
- Row labels "Structure" and "Composition & Proteome" are visible
- Bars render in teal
- Hovering shows tooltip with bin range + count + percentage
- Median amber dashed line appears on each histogram

- [ ] **Step 4: Commit**

```bash
git add viewer/src/components/atlas/KaryotypeOverview.tsx
git commit -m "feat(atlas): integrate Genome at a Glance histograms into karyotype overview"
```

---

### Task 5: Integrate into ChromosomeDetail

**Files:**
- Modify: `viewer/src/components/atlas/ChromosomeDetail.tsx`

Add per-chromosome histograms with genome-wide ghost overlay below the existing chromosome detail content.

- [ ] **Step 1: Add the import**

At the top of `viewer/src/components/atlas/ChromosomeDetail.tsx`, add:

```tsx
import { GenomeAtAGlance } from './GenomeAtAGlance';
```

- [ ] **Step 2: Add the histogram section below the two-column layout**

In `ChromosomeDetail.tsx`, find the closing `</div>` of the two-column layout (the `div` with `display: 'flex', gap: SPACE[8]`). Insert the `GenomeAtAGlance` component after it, before the component's final closing `</div>`:

```tsx
      {/* Per-chromosome distribution histograms with genome-wide ghost overlay */}
      <div style={{ marginTop: SPACE[8] }}>
        <GenomeAtAGlance chrName={chr.name} />
      </div>
```

Insert this between the two-column layout closing `</div>` and the component's outer closing `</div>`.

- [ ] **Step 3: Verify TypeScript compiles and visually inspect**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit
```

Run dev server and navigate to `http://localhost:3000/atlas`, click any chromosome. Verify:
- 6 histograms appear below the chromosome detail
- Title shows "Exon Length — chr16" format
- Ghost bars (faint white) show genome-wide distribution behind the chromosome's bars
- Chromosome-specific bars are teal

- [ ] **Step 4: Commit**

```bash
git add viewer/src/components/atlas/ChromosomeDetail.tsx
git commit -m "feat(atlas): add per-chromosome histograms with genome-wide ghost overlay"
```

---

### Task 6: Polish and Responsive Layout

**Files:**
- Modify: `viewer/src/components/atlas/GenomeAtAGlance.tsx`
- Modify: `viewer/src/components/atlas/CanvasHistogram.tsx`

Make the histogram grid responsive and ensure the canvas resizes properly.

- [ ] **Step 1: Make CanvasHistogram width-responsive**

In `CanvasHistogram.tsx`, wrap the canvas in a container that uses a ResizeObserver to track width. Replace the outer `<div>` and add a resize hook:

Replace the component's return statement and add state for measured width. Add this at the top of the component function body, after the existing state:

```tsx
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredW, setMeasuredW] = useState(width);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setMeasuredW(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
```

Then use `measuredW` instead of `width` for all calculations (plotW, barW, toX, draw, etc.). Update the `draw` callback and hover handler to use `measuredW`. Change the outer `<div>` to include `ref={containerRef}` and `style={{ position: 'relative', width: '100%' }}`.

- [ ] **Step 2: Update GenomeAtAGlance grid for responsiveness**

In `GenomeAtAGlance.tsx`, update the grid `gridTemplateColumns` to be responsive:

```tsx
gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
```

And remove the fixed `width={370}` from `CanvasHistogram` calls (let it fill its grid cell):

```tsx
<CanvasHistogram key={id} metric={metric} chrName={chrName} height={200} />
```

- [ ] **Step 3: Verify responsive behavior**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit
```

Run dev server. Resize the browser window:
- At full width: 3 columns
- At medium width (~900px): 2 columns
- At narrow width (~600px): 1 column
- Canvas bars should re-render at the new width without distortion

- [ ] **Step 4: Commit**

```bash
git add viewer/src/components/atlas/CanvasHistogram.tsx viewer/src/components/atlas/GenomeAtAGlance.tsx
git commit -m "feat(atlas): responsive histogram layout with ResizeObserver"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Production build**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npm run build
```

Expected: successful build with no errors.

- [ ] **Step 3: Visual verification checklist**

Run `npm run dev` and verify on `http://localhost:3000/atlas`:

1. **Overview**: 6 histograms in 3×2 grid below karyotype, above Genome Overview stats
2. **Bar colors**: teal bars at ~0.8 opacity
3. **Hover**: tooltip shows bin range, count, percentage
4. **Median**: amber dashed vertical line on each histogram
5. **Title**: top-left of each histogram, count badge top-right
6. **Section header**: "Genome at a Glance" in uppercase teal
7. **Row labels**: "Structure" and "Composition & Proteome" in faint text
8. **Chromosome detail**: click chr16 → 6 histograms with ghost overlay
9. **Ghost bars**: faint white silhouette behind chromosome-specific teal bars
10. **Responsive**: resize browser → grid collapses gracefully
