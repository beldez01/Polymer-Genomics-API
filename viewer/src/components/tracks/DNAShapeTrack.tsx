'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

// ---------------------------------------------------------------------------
// Shape parameter definitions
// ---------------------------------------------------------------------------

const SHAPE_PARAMS = [
  { key: 'mgw_mean',  label: 'MGW',  color: COLOR.shape.mgw  },
  { key: 'prot_mean', label: 'ProT', color: COLOR.shape.prot },
  { key: 'roll_mean', label: 'Roll', color: COLOR.shape.roll },
  { key: 'helt_mean', label: 'HelT', color: COLOR.shape.helt },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DNAShapeTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DNAShapeTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 60,
}: DNAShapeTrackProps) {
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

    // ---- Empty-state check ------------------------------------------------
    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No shape data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // ---- Filter to visible range & collect per-parameter arrays -----------
    const margin = 4;
    const plotH = height - margin * 2;
    const span = viewEnd - viewStart + 1;

    // Build arrays of { x, value } for each parameter, filtered to viewport
    type Point = { x: number; value: number };
    const series: { param: typeof SHAPE_PARAMS[number]; points: Point[]; min: number; max: number }[] = [];

    for (const param of SHAPE_PARAMS) {
      const raw = data.mcols[param.key];
      if (!raw) continue;

      const points: Point[] = [];
      let min = Infinity;
      let max = -Infinity;

      for (let i = 0; i < data.n; i++) {
        const start = data.ranges.start[i];
        const end = data.ranges.end[i];
        const mid = (start + end) / 2;
        if (end < viewStart || start > viewEnd) continue;

        const v = raw[i];
        if (typeof v !== 'number' || !isFinite(v)) continue;

        const x = genomicToPixel(mid, viewStart, viewEnd, canvasWidth);
        points.push({ x, value: v });
        if (v < min) min = v;
        if (v > max) max = v;
      }

      if (points.length > 0 && max > min) {
        series.push({ param, points, min, max });
      }
    }

    if (series.length === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No shape data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // ---- Draw each parameter as filled area + stroke ----------------------
    for (const s of series) {
      const { param, points, min, max } = s;
      const range = max - min;

      // Normalize to [0,1] then map to pixel Y (inverted: 0 = top)
      const toY = (v: number) => margin + plotH * (1 - (v - min) / range);

      // Sort by x for correct path drawing
      points.sort((a, b) => a.x - b.x);

      // Filled area
      ctx.beginPath();
      ctx.moveTo(points[0].x, margin + plotH); // baseline
      for (const p of points) {
        ctx.lineTo(p.x, toY(p.value));
      }
      ctx.lineTo(points[points.length - 1].x, margin + plotH); // back to baseline
      ctx.closePath();
      ctx.fillStyle = param.color + '26'; // alpha ~0.15
      ctx.fill();

      // Stroke line
      ctx.beginPath();
      ctx.moveTo(points[0].x, toY(points[0].value));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, toY(points[i].value));
      }
      ctx.strokeStyle = param.color + 'CC'; // alpha ~0.8
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Legend moved to Sidebar
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
