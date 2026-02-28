'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';
import { drawTrackLabel } from '@/lib/trackLabel';

const CONTEXT_COLORS: Record<string, string> = {
  island: '#22c55e',
  shore: '#14b8a6',
  shelf: '#3b82f6',
  open_sea: '#6b7280',
  opensea: '#6b7280',
};

function contextColor(ctx: string | null | undefined): string {
  if (!ctx) return '#a78bfa';
  return CONTEXT_COLORS[ctx.toLowerCase()] ?? '#a78bfa';
}

export interface ProbeTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function ProbeTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 40,
}: ProbeTrackProps) {
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
      ctx.fillText('No probes in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const bpW = basePairWidth(viewStart, viewEnd, canvasWidth);

    for (let i = 0; i < data.n; i++) {
      const pos = data.ranges.start[i];
      if (pos < viewStart || pos > viewEnd) continue;

      const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
      const cpgCtx = data.mcols.cpg_context?.[i] as string | null;
      const probeId = data.mcols.probe_id?.[i] as string | null;
      const color = contextColor(cpgCtx);

      const markerSize = Math.min(8, Math.max(3, bpW * 0.4));
      const tipY = height - 6;
      const topY = tipY - markerSize * 1.6;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, tipY);
      ctx.lineTo(x - markerSize, topY);
      ctx.lineTo(x + markerSize, topY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
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

    drawTrackLabel(ctx, 'Probes', canvasWidth);
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
