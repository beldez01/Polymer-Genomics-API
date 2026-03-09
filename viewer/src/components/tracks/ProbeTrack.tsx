'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';


const CONTEXT_COLORS: Record<string, string> = {
  island:   '#10B981',  // emerald-500
  shore:    '#06B6D4',  // cyan-500
  shelf:    '#6366F1',  // indigo-500
  open_sea: '#F59E0B',  // amber-500
  opensea:  '#F59E0B',
};

/** Per-array opacity so overlaid arrays are visually distinguishable. */
const ARRAY_OPACITY: Record<string, number> = {
  probe_epic_v2: 1.0,
  probe_epic_v1: 0.7,
  probe_450k:    0.5,
};

function contextColor(ctx: string | null | undefined): string {
  if (!ctx) return '#F43F5E';  // rose-500
  return CONTEXT_COLORS[ctx.toLowerCase()] ?? '#F43F5E';
}

export interface ProbeDataset {
  key: string;
  data: GRanges;
}

export interface ProbeTrackProps {
  /** @deprecated Use `datasets` instead for multi-array support. */
  data?: GRanges | undefined;
  datasets?: ProbeDataset[];
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function ProbeTrack({
  data,
  datasets,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 40,
}: ProbeTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Normalise: if legacy `data` prop is used, wrap it as a single dataset
  const resolvedDatasets: ProbeDataset[] = datasets
    ?? (data ? [{ key: 'probe_epic_v2', data }] : []);

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

    const totalProbes = resolvedDatasets.reduce((sum, ds) => sum + ds.data.n, 0);
    if (totalProbes === 0) {
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No probes in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const bpW = basePairWidth(viewStart, viewEnd, canvasWidth);

    for (const ds of resolvedDatasets) {
      const opacity = ARRAY_OPACITY[ds.key] ?? 0.6;

      for (let i = 0; i < ds.data.n; i++) {
        const pos = ds.data.ranges.start[i];
        if (pos < viewStart || pos > viewEnd) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        const cpgCtx = ds.data.mcols.cpg_context?.[i] as string | null;
        const probeId = ds.data.mcols.probe_id?.[i] as string | null;
        const color = contextColor(cpgCtx);

        const markerSize = Math.min(8, Math.max(3, bpW * 0.4));
        const tipY = height - 6;
        const topY = tipY - markerSize * 1.6;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, tipY);
        ctx.lineTo(x - markerSize, topY);
        ctx.lineTo(x + markerSize, topY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6 * opacity;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, 4);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        if (bpW >= 8 && probeId) {
          ctx.fillStyle = COLORS.canvas.featureLabel;
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(probeId, x, topY - 2);
        }
      }
    }

  }, [resolvedDatasets, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
