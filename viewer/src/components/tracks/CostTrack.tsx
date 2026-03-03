'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

// ECPAgene cost tier thresholds and colors
const COST_TIERS: Array<{ max: number; color: string }> = [
  { max: 18, color: COLOR.cost.cheap },
  { max: 25, color: COLOR.cost.moderate },
  { max: 30, color: COLOR.cost.expensive },
  { max: Infinity, color: COLOR.cost.very_expensive },
];

function costColor(ecpa: number | null | undefined): string {
  if (ecpa == null) return '#333333';
  for (const tier of COST_TIERS) {
    if (ecpa < tier.max) return tier.color;
  }
  return COLOR.cost.very_expensive;
}

export interface CostTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function CostTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 36,
}: CostTrackProps) {
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
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No gene cost data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // Compute max c_protein for height normalization
    let maxCost = 0;
    for (let i = 0; i < data.n; i++) {
      const cp = data.mcols.c_protein?.[i] as number | null;
      if (cp != null && cp > maxCost) maxCost = cp;
    }
    const logMax = maxCost > 0 ? Math.log2(maxCost) : 1;

    for (let i = 0; i < data.n; i++) {
      const rStart = data.ranges.start[i];
      const rEnd = data.ranges.end[i];

      if (rEnd < viewStart || rStart > viewEnd) continue;

      const clippedStart = Math.max(rStart, viewStart);
      const clippedEnd = Math.min(rEnd, viewEnd);

      const x1 = genomicToPixel(clippedStart, viewStart, viewEnd, canvasWidth);
      const x2 = genomicToPixel(clippedEnd + 1, viewStart, viewEnd, canvasWidth);
      const w = Math.max(1, x2 - x1);

      const ecpa = data.mcols.ecpa_b20?.[i] as number | null;
      const cProtein = data.mcols.c_protein?.[i] as number | null;
      const symbol = data.mcols.gene_symbol?.[i] as string | null;

      // Bar height proportional to log2(c_protein)
      const barHeight = cProtein != null && cProtein > 0
        ? Math.max(4, ((Math.log2(cProtein) / logMax) * (height - 6)))
        : height - 6;

      const y = height - 2 - barHeight;

      ctx.fillStyle = costColor(ecpa);
      ctx.fillRect(x1, y, w, barHeight);

      // Gene symbol label when bar is wide enough
      if (w >= 40 && symbol) {
        ctx.fillStyle = '#CCCCCC';
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.beginPath();
        ctx.rect(x1, 0, w, height);
        ctx.clip();
        ctx.fillText(symbol, x1 + w / 2, y + barHeight / 2);
        ctx.restore();
      }
    }

    // Legend when zoomed out
    const span = viewEnd - viewStart + 1;
    if (canvasWidth >= 400 && span > 100_000) {
      const legend = [
        { label: '<18', color: COLOR.cost.cheap },
        { label: '18-25', color: COLOR.cost.moderate },
        { label: '25-30', color: COLOR.cost.expensive },
        { label: '>30', color: COLOR.cost.very_expensive },
      ];
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      let lx = canvasWidth - 10;
      for (let li = legend.length - 1; li >= 0; li--) {
        const { label, color } = legend[li];
        const labelW = ctx.measureText(label).width + 14;
        lx -= labelW;
        ctx.fillStyle = color;
        ctx.fillRect(lx, height - 12, 8, 8);
        ctx.fillStyle = COLORS.canvas.axisLabel;
        ctx.fillText(label, lx + labelW - 4, height - 8);
      }
    }

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
