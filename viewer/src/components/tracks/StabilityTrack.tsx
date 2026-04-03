'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

export interface StabilityTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function StabilityTrack({
  data, viewStart, viewEnd, canvasWidth, height = 80,
}: StabilityTrackProps) {
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
      ctx.fillText('Zoom in for stability data', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const margin = 4;
    const plotH = height - margin * 2;
    const zeroY = margin + plotH / 2; // for context deviation

    // Collect visible points
    type Pt = { x: number; dg: number | null; bubble: number | null; dev: number | null };
    const points: Pt[] = [];
    const dgRaw = data.mcols['delta_g_37'] as number[] | undefined;
    const bubbleRaw = data.mcols['bubble_propensity'] as number[] | undefined;
    const devRaw = data.mcols['context_deviation'] as number[] | undefined;
    // Also check for coarse-zoom 1kb layer key
    const dgAlt = data.mcols['stacking_dg37'] as number[] | undefined;

    const dgArr = dgRaw || dgAlt;

    let dgMin = Infinity, dgMax = -Infinity;
    let devMax = 0;

    for (let i = 0; i < data.n; i++) {
      const start = data.ranges.start[i];
      const end = data.ranges.end[i];
      if (end < viewStart || start > viewEnd) continue;
      const mid = (start + end) / 2;
      const x = genomicToPixel(mid, viewStart, viewEnd, canvasWidth);

      const dg = dgArr?.[i] ?? null;
      const bubble = bubbleRaw?.[i] ?? null;
      const dev = devRaw?.[i] ?? null;

      if (dg !== null && isFinite(dg)) { dgMin = Math.min(dgMin, dg); dgMax = Math.max(dgMax, dg); }
      if (dev !== null && isFinite(dev)) { devMax = Math.max(devMax, Math.abs(dev)); }

      points.push({ x, dg, bubble, dev });
    }

    if (points.length === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No stability data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    points.sort((a, b) => a.x - b.x);
    const dgRange = dgMax - dgMin || 1;
    if (devMax === 0) devMax = 1;

    // 1. Bubble propensity — filled area (bottom = 0, top = 1)
    if (bubbleRaw) {
      ctx.beginPath();
      let started = false;
      for (const p of points) {
        if (p.bubble === null || !isFinite(p.bubble)) continue;
        const y = margin + plotH * (1 - p.bubble);
        if (!started) { ctx.moveTo(p.x, margin + plotH); started = true; }
        ctx.lineTo(p.x, y);
      }
      if (started) {
        ctx.lineTo(points[points.length - 1].x, margin + plotH);
        ctx.closePath();
        ctx.fillStyle = '#FF6B6B4D'; // rose, alpha ~0.3
        ctx.fill();
      }
    }

    // 2. Context deviation — diverging bars from center
    if (devRaw) {
      for (const p of points) {
        if (p.dev === null || !isFinite(p.dev)) continue;
        const barH = (Math.abs(p.dev) / devMax) * (plotH / 2 - 2);
        if (p.dev > 0) {
          ctx.fillStyle = '#FF444466'; // vulnerability — red
          ctx.fillRect(p.x - 0.5, zeroY - barH, 1.5, barH);
        } else {
          ctx.fillStyle = '#4A9EFF66'; // anchor — blue
          ctx.fillRect(p.x - 0.5, zeroY, 1.5, barH);
        }
      }
    }

    // 3. Stacking dG37 — line on top
    if (dgArr) {
      ctx.beginPath();
      let started = false;
      for (const p of points) {
        if (p.dg === null || !isFinite(p.dg)) continue;
        const y = margin + plotH * (1 - (p.dg - dgMin) / dgRange);
        if (!started) { ctx.moveTo(p.x, y); started = true; }
        else ctx.lineTo(p.x, y);
      }
      ctx.strokeStyle = '#4ECDC4CC';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
