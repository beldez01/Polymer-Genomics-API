'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

const STACK_ORDER = ['g4', 'zdna', 'cruciform', 'rloop', 'triplex'] as const;

const MCOL_KEYS: Record<typeof STACK_ORDER[number], string> = {
  g4:        'g4_density',
  zdna:      'z_dna_density',
  cruciform: 'cruciform_density',
  rloop:     'r_loop_score',
  triplex:   'triplex_density',
};

const STACK_COLORS: Record<typeof STACK_ORDER[number], string> = {
  g4:        COLOR.nonb.g4,
  zdna:      COLOR.nonb.zdna,
  cruciform: COLOR.nonb.cruciform,
  rloop:     COLOR.nonb.rloop,
  triplex:   COLOR.nonb.triplex,
};

const LEGEND_LABELS: Record<typeof STACK_ORDER[number], string> = {
  g4:        'G4',
  zdna:      'Z-DNA',
  cruciform: 'Cruciform',
  rloop:     'R-loop',
  triplex:   'Triplex',
};

export interface NonBDnaTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function NonBDnaTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 60,
}: NonBDnaTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);
    drawGridlines(ctx, viewStart, viewEnd, canvasWidth, height);

    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No non-B DNA data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // Bin data across viewport
    const binCount = Math.max(1, Math.ceil(canvasWidth / 2));
    const span = viewEnd - viewStart + 1;

    // Accumulate per-bin values for each structure type + total
    const binned: Record<string, number[]> = {};
    for (const key of STACK_ORDER) {
      binned[key] = new Array(binCount).fill(0);
    }
    const binTotal = new Array(binCount).fill(0);
    const binCounts = new Array(binCount).fill(0);

    for (let i = 0; i < data.n; i++) {
      const rStart = data.ranges.start[i];
      const rEnd = data.ranges.end[i];

      if (rEnd < viewStart || rStart > viewEnd) continue;

      const midpoint = (rStart + rEnd) / 2;
      const bin = Math.min(
        binCount - 1,
        Math.max(0, Math.floor(((midpoint - viewStart) / span) * binCount)),
      );

      binCounts[bin]++;

      for (const key of STACK_ORDER) {
        const val = data.mcols[MCOL_KEYS[key]]?.[i];
        if (typeof val === 'number') {
          binned[key][bin] += val;
        }
      }

      const tot = data.mcols.total_nonb_density?.[i];
      if (typeof tot === 'number') {
        binTotal[bin] += tot;
      }
    }

    // Average bins with multiple entries
    for (let b = 0; b < binCount; b++) {
      if (binCounts[b] > 1) {
        for (const key of STACK_ORDER) {
          binned[key][b] /= binCounts[b];
        }
        binTotal[b] /= binCounts[b];
      }
    }

    // Compute stacked cumulative values and find max
    const stacked: number[][] = STACK_ORDER.map(() => new Array(binCount).fill(0));
    let yMax = 0;

    for (let b = 0; b < binCount; b++) {
      let cumulative = 0;
      for (let s = 0; s < STACK_ORDER.length; s++) {
        cumulative += binned[STACK_ORDER[s]][b];
        stacked[s][b] = cumulative;
      }
      yMax = Math.max(yMax, binTotal[b], cumulative);
    }

    if (yMax === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No non-B DNA data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const margin = 4;
    const plotH = height - margin * 2;
    const barW = canvasWidth / binCount;

    // Helper: bin index to x position (center of bin)
    const binX = (b: number) => b * barW + barW / 2;
    // Helper: value to y position
    const valY = (v: number) => margin + plotH * (1 - v / yMax);

    // Draw stacked areas from top layer down so lower layers paint over
    for (let s = STACK_ORDER.length - 1; s >= 0; s--) {
      const color = STACK_COLORS[STACK_ORDER[s]];

      ctx.beginPath();
      ctx.moveTo(binX(0), valY(0));

      // Top edge of this layer (cumulative)
      for (let b = 0; b < binCount; b++) {
        ctx.lineTo(binX(b), valY(stacked[s][b]));
      }

      // Bottom edge: previous layer's top (or baseline)
      if (s > 0) {
        for (let b = binCount - 1; b >= 0; b--) {
          ctx.lineTo(binX(b), valY(stacked[s - 1][b]));
        }
      } else {
        ctx.lineTo(binX(binCount - 1), valY(0));
        ctx.lineTo(binX(0), valY(0));
      }

      ctx.closePath();
      ctx.fillStyle = color + 'AA';
      ctx.fill();
    }

    // Draw total_nonb_density as thin dashed line overlay
    ctx.beginPath();
    let started = false;
    for (let b = 0; b < binCount; b++) {
      const x = binX(b);
      const y = valY(binTotal[b]);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = COLOR.nonb.total;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend in top-right corner
    if (canvasWidth >= 200) {
      const legendX = canvasWidth - 6;
      let legendY = margin + 2;
      const lineH = 10;

      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';

      for (let s = STACK_ORDER.length - 1; s >= 0; s--) {
        const key = STACK_ORDER[s];
        const color = STACK_COLORS[key];
        const label = LEGEND_LABELS[key];

        // Color swatch
        ctx.fillStyle = color + 'AA';
        ctx.fillRect(legendX - ctx.measureText(label).width - 10, legendY + 1, 6, 6);

        // Label
        ctx.fillStyle = COLOR.canvas.axisLabel;
        ctx.fillText(label, legendX, legendY);

        legendY += lineH;
      }

      // Total line legend entry
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = COLOR.nonb.total;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(legendX - ctx.measureText('Total').width - 10, legendY + 4);
      ctx.lineTo(legendX - ctx.measureText('Total').width - 4, legendY + 4);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLOR.canvas.axisLabel;
      ctx.fillText('Total', legendX, legendY);
    }

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
