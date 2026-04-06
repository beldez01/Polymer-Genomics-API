'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

const SIGNALS = [
  { keys: ['curvature'], label: 'Angular Var.', color: '#F4A261' },
  { keys: ['local_flexibility', 'deformability'], label: 'Flexibility', color: '#7B68EE' },
] as const;

export interface StructureTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function StructureTrack({
  data, viewStart, viewEnd, canvasWidth, height = 60,
}: StructureTrackProps) {
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
      ctx.fillText('Zoom in for structure data', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const margin = 4;
    const plotH = height - margin * 2;

    for (const signal of SIGNALS) {
      // Find the first available mcols key
      let raw: (string | number | null)[] | undefined;
      for (const k of signal.keys) {
        raw = data.mcols[k];
        if (raw) break;
      }
      if (!raw) continue;

      // Collect visible points
      type Pt = { x: number; v: number };
      const pts: Pt[] = [];
      let min = Infinity, max = -Infinity;

      for (let i = 0; i < data.n; i++) {
        const start = data.ranges.start[i];
        const end = data.ranges.end[i];
        if (end < viewStart || start > viewEnd) continue;
        const v = raw[i];
        if (typeof v !== 'number' || !isFinite(v)) continue;
        const x = genomicToPixel((start + end) / 2, viewStart, viewEnd, canvasWidth);
        pts.push({ x, v });
        if (v < min) min = v;
        if (v > max) max = v;
      }

      if (pts.length < 2 || max <= min) continue;
      pts.sort((a, b) => a.x - b.x);
      const range = max - min;

      // Filled area
      ctx.beginPath();
      ctx.moveTo(pts[0].x, margin + plotH);
      for (const p of pts) ctx.lineTo(p.x, margin + plotH * (1 - (p.v - min) / range));
      ctx.lineTo(pts[pts.length - 1].x, margin + plotH);
      ctx.closePath();
      ctx.fillStyle = signal.color + '26';
      ctx.fill();

      // Stroke
      ctx.beginPath();
      ctx.moveTo(pts[0].x, margin + plotH * (1 - (pts[0].v - min) / range));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, margin + plotH * (1 - (pts[i].v - min) / range));
      }
      ctx.strokeStyle = signal.color + 'CC';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
