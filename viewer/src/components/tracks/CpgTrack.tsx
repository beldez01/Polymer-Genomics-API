'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';
import { drawTrackLabel } from '@/lib/trackLabel';

const CONTEXT_COLORS: Record<string, string> = {
  ...COLORS.cpgContext,
  opensea: COLORS.cpgContext.open_sea,
};

function contextColor(ctx: string | null | undefined): string {
  if (!ctx) return CONTEXT_COLORS.open_sea;
  return CONTEXT_COLORS[ctx.toLowerCase()] ?? CONTEXT_COLORS.open_sea;
}

export interface CpgTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function CpgTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 50,
}: CpgTrackProps) {
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
      ctx.fillText('No CpG data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const bpW = basePairWidth(viewStart, viewEnd, canvasWidth);
    const span = viewEnd - viewStart + 1;

    if (bpW >= 2) {
      for (let i = 0; i < data.n; i++) {
        const pos = data.ranges.start[i];
        const end = data.ranges.end[i];
        if (end < viewStart || pos > viewEnd) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        const w = Math.max(1, ((end - pos + 1) / span) * canvasWidth);
        const cpgCtx = data.mcols.context?.[i] as string | null;

        ctx.fillStyle = contextColor(cpgCtx);
        ctx.fillRect(x, 4, Math.max(1, w), height - 8);
      }
    } else {
      const binCount = Math.ceil(canvasWidth);
      const bins = new Float64Array(binCount);
      const contextBins: string[] = new Array(binCount).fill('open_sea');

      for (let i = 0; i < data.n; i++) {
        const pos = data.ranges.start[i];
        if (pos < viewStart || pos > viewEnd) continue;
        const bin = Math.min(
          binCount - 1,
          Math.floor(((pos - viewStart) / span) * binCount),
        );
        bins[bin]++;
        const cpgCtx = data.mcols.context?.[i] as string | null;
        if (cpgCtx && cpgCtx !== 'open_sea' && cpgCtx !== 'opensea') {
          contextBins[bin] = cpgCtx;
        }
      }

      let maxCount = 0;
      for (let b = 0; b < binCount; b++) {
        if (bins[b] > maxCount) maxCount = bins[b];
      }
      if (maxCount === 0) return;

      const barWidth = canvasWidth / binCount;
      for (let b = 0; b < binCount; b++) {
        if (bins[b] === 0) continue;
        const frac = bins[b] / maxCount;
        const barH = frac * (height - 8);
        ctx.fillStyle = contextColor(contextBins[b]);
        ctx.globalAlpha = 0.5 + frac * 0.5;
        ctx.fillRect(b * barWidth, height - 4 - barH, Math.max(1, barWidth), barH);
      }
      ctx.globalAlpha = 1.0;
    }

    drawTrackLabel(ctx, 'CpG Sites', canvasWidth);
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
