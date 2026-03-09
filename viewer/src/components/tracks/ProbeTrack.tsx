'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';


/** One color per array platform (gold / amber / brown). */
const ARRAY_COLORS: Record<string, string> = {
  probe_epic_v2: '#F0A500',  // gold
  probe_epic_v1: '#d97706',  // amber
  probe_450k:    '#92400e',  // brown
};

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
      const color = ARRAY_COLORS[ds.key] ?? '#F43F5E';

      for (let i = 0; i < ds.data.n; i++) {
        const pos = ds.data.ranges.start[i];
        if (pos < viewStart || pos > viewEnd) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        const probeId = ds.data.mcols.probe_id?.[i] as string | null;

        const markerSize = Math.min(8, Math.max(3, bpW * 0.4));
        const tipY = height - 6;
        const topY = tipY - markerSize * 1.6;

        ctx.save();
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
        ctx.globalAlpha = 0.6;
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
