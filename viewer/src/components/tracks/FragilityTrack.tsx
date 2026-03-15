'use client';

import { useEffect, useRef } from 'react';
import type { GRanges } from '@/lib/api';
import { COLOR } from '@/config/theme';

interface FragilityTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

const CLASS_COLORS: Record<string, string> = {
  low: '#2dd4bf22',
  moderate: '#f59e0b55',
  high: '#f43f5e88',
  extreme: '#f43f5ecc',
};

export function FragilityTrack({ data, viewStart, viewEnd, canvasWidth, height = 40 }: FragilityTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bpPerPx = (viewEnd - viewStart) / canvasWidth;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data?.n) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = canvasWidth * dpr;
    ctx.canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);

    const { start, end } = data.ranges;
    const scores = (data.mcols?.fragility_score ?? []) as (number | null)[];
    const classes = (data.mcols?.fragility_class ?? []) as (string | null)[];

    for (let i = 0; i < data.n; i++) {
      const s = start[i];
      const e = end[i];
      if (e < viewStart || s > viewEnd) continue;

      const x = Math.max(0, (s - viewStart) / bpPerPx);
      const w = Math.max(1, (e - s) / bpPerPx);
      const score = (scores[i] as number) ?? 0;
      const cls = (classes[i] as string) ?? 'low';

      // Background bar colored by class
      ctx.fillStyle = CLASS_COLORS[cls] ?? CLASS_COLORS.low;
      ctx.fillRect(x, 0, w, height);

      // Score bar (height proportional to score)
      const barH = score * (height - 4);
      const hue = score < 0.3 ? 170 : score < 0.6 ? 40 : 0; // teal → amber → red
      const sat = 70 + score * 30;
      ctx.fillStyle = `hsla(${hue}, ${sat}%, 50%, 0.7)`;
      ctx.fillRect(x, height - barH - 2, w, barH);
    }

    // Baseline
    ctx.strokeStyle = COLOR.border.subtle;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, height - 2);
    ctx.lineTo(canvasWidth, height - 2);
    ctx.stroke();
  }, [data, viewStart, viewEnd, canvasWidth, height, bpPerPx]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasWidth, height, display: 'block' }}
    />
  );
}
