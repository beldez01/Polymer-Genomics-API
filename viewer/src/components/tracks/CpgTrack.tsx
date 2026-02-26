'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';

// CpG context colours
const CONTEXT_COLORS: Record<string, string> = {
  island: '#22c55e',     // green
  shore: '#14b8a6',      // teal
  shelf: '#3b82f6',      // blue
  open_sea: '#6b7280',   // gray
  opensea: '#6b7280',    // alternate spelling
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

    if (!data || data.n === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No CpG data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const bpW = basePairWidth(viewStart, viewEnd, canvasWidth);
    const span = viewEnd - viewStart + 1;

    if (bpW >= 2) {
      // ---- Fine zoom: individual tick marks ----
      for (let i = 0; i < data.n; i++) {
        const pos = data.ranges.start[i];
        const end = data.ranges.end[i];
        if (end < viewStart || pos > viewEnd) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        const w = Math.max(1, ((end - pos + 1) / span) * canvasWidth);
        const cpgCtx = data.mcols.cpg_context?.[i] as string | null;

        ctx.fillStyle = contextColor(cpgCtx);
        ctx.fillRect(x, 4, Math.max(1, w), height - 8);
      }
    } else {
      // ---- Coarse zoom: density bars per pixel bin ----
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
        // Track predominant context per bin
        const cpgCtx = data.mcols.cpg_context?.[i] as string | null;
        if (cpgCtx && cpgCtx !== 'open_sea' && cpgCtx !== 'opensea') {
          contextBins[bin] = cpgCtx;
        }
      }

      // Find max for scaling
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
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
