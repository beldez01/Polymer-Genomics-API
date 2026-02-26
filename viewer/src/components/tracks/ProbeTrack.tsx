'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';

// Context colours matching CpG track for consistency
const CONTEXT_COLORS: Record<string, string> = {
  island: '#22c55e',
  shore: '#14b8a6',
  shelf: '#3b82f6',
  open_sea: '#6b7280',
  opensea: '#6b7280',
};

function contextColor(ctx: string | null | undefined): string {
  if (!ctx) return '#a78bfa'; // default purple for probes
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

    if (!data || data.n === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
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

      // Draw inverted triangle (diamond marker)
      const markerSize = Math.min(8, Math.max(3, bpW * 0.4));
      const tipY = height - 6;
      const topY = tipY - markerSize * 1.6;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, tipY);                       // bottom tip
      ctx.lineTo(x - markerSize, topY);           // top-left
      ctx.lineTo(x + markerSize, topY);           // top-right
      ctx.closePath();
      ctx.fill();

      // Draw stem line from top of marker to top of track
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, 4);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Label with probe_id at fine zoom
      if (bpW >= 8 && probeId) {
        ctx.fillStyle = '#d1d5db';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(probeId, x, topY - 2);
      }
    }
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
