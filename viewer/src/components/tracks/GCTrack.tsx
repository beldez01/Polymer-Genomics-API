'use client';

import { useRef, useEffect } from 'react';
import type { ViewportData } from '@/lib/genomeFetcher';
import { drawGridlines } from '@/lib/gridlines';
import { COLORS } from '@/config/colors';


const GC_LOW_COLOR = '#4a5568';   // blue-grey
const GC_HIGH_COLOR = '#4ECDC4';  // teal
const REF_LINE_COLOR = '#333333';

export interface GCTrackProps {
  data: ViewportData | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

function interpolateColor(t: number): string {
  // Linear interpolation between GC_LOW_COLOR and GC_HIGH_COLOR
  // Parse hex
  const lo = { r: 0x4a, g: 0x55, b: 0x68 };
  const hi = { r: 0x4e, g: 0xcd, b: 0xc4 };
  const r = Math.round(lo.r + (hi.r - lo.r) * t);
  const g = Math.round(lo.g + (hi.g - lo.g) * t);
  const b = Math.round(lo.b + (hi.b - lo.b) * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * Compute sliding-window GC% from raw sequence string.
 * Returns an array of GC fractions [0,1], one per output bin.
 */
function gcFromSequence(sequence: string, binCount: number): number[] {
  const seqLen = sequence.length;
  if (seqLen === 0) return new Array(binCount).fill(0.5);

  const windowSize = Math.max(10, Math.ceil(seqLen / binCount));
  const result: number[] = [];

  for (let b = 0; b < binCount; b++) {
    const startIdx = Math.round((b / binCount) * seqLen);
    const endIdx = Math.min(seqLen, startIdx + windowSize);

    let gc = 0;
    let total = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const ch = sequence[i].toUpperCase();
      if (ch === 'G' || ch === 'C') { gc++; total++; }
      else if (ch === 'A' || ch === 'T') { total++; }
    }
    result.push(total > 0 ? gc / total : 0.5);
  }

  return result;
}

/**
 * Compute GC% from CpG site gc_content mcol values, binned across viewport.
 */
function gcFromCpgSites(
  data: ViewportData,
  viewStart: number,
  viewEnd: number,
  binCount: number,
): number[] | null {
  const cpg = data.layers?.cpg_sites;
  if (!cpg || cpg.n === 0 || !cpg.mcols.gc_content) return null;

  const span = viewEnd - viewStart + 1;
  const bins: number[][] = Array.from({ length: binCount }, () => []);

  for (let i = 0; i < cpg.n; i++) {
    const pos = cpg.ranges.start[i];
    if (pos < viewStart || pos > viewEnd) continue;
    const gc = cpg.mcols.gc_content[i];
    if (typeof gc !== 'number') continue;
    const bin = Math.min(binCount - 1, Math.floor(((pos - viewStart) / span) * binCount));
    if (bin >= 0 && bin < binCount) bins[bin].push(gc);
  }

  // Check if we have enough data
  let filled = 0;
  for (const b of bins) { if (b.length > 0) filled++; }
  if (filled < binCount * 0.1) return null;

  return bins.map(b => {
    if (b.length === 0) return 0.5;
    return b.reduce((s, v) => s + v, 0) / b.length;
  });
}

/**
 * Build GC% from isochore gc_content for each bin.
 */
function gcFromIsochores(
  data: ViewportData,
  viewStart: number,
  viewEnd: number,
  binCount: number,
): number[] | null {
  const iso = data.layers?.isochores;
  if (!iso || iso.n === 0 || !iso.mcols.gc_content) return null;

  const span = viewEnd - viewStart + 1;
  const result: number[] = [];

  for (let b = 0; b < binCount; b++) {
    const binCenter = viewStart + ((b + 0.5) / binCount) * span;
    let gc = 0.5;
    for (let i = 0; i < iso.n; i++) {
      if (binCenter >= iso.ranges.start[i] && binCenter <= iso.ranges.end[i]) {
        const v = iso.mcols.gc_content[i];
        if (typeof v === 'number') gc = v;
        break;
      }
    }
    result.push(gc);
  }

  return result;
}

export function GCTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 40,
}: GCTrackProps) {
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

    if (!data) {
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No GC data', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const binCount = Math.max(1, Math.ceil(canvasWidth / 2));
    const span = viewEnd - viewStart + 1;

    // Choose data source
    let gcValues: number[] | null = null;
    if (data.sequence && span <= 200) {
      gcValues = gcFromSequence(data.sequence, binCount);
    }
    if (!gcValues) {
      gcValues = gcFromCpgSites(data, viewStart, viewEnd, binCount);
    }
    if (!gcValues) {
      gcValues = gcFromIsochores(data, viewStart, viewEnd, binCount);
    }
    if (!gcValues) {
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No GC data', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const margin = 4;
    const plotH = height - margin * 2;
    const barW = canvasWidth / binCount;

    // Draw filled area chart
    ctx.beginPath();
    ctx.moveTo(0, margin + plotH); // bottom-left

    for (let b = 0; b < binCount; b++) {
      const x = b * barW + barW / 2;
      const frac = Math.max(0, Math.min(1, gcValues[b]));
      const y = margin + plotH * (1 - frac);
      if (b === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.lineTo(canvasWidth, margin + plotH); // bottom-right
    ctx.closePath();

    // Gradient fill
    const grad = ctx.createLinearGradient(0, margin, 0, margin + plotH);
    grad.addColorStop(0, GC_HIGH_COLOR + '88');
    grad.addColorStop(1, GC_LOW_COLOR + '44');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw line on top
    ctx.beginPath();
    for (let b = 0; b < binCount; b++) {
      const x = b * barW + barW / 2;
      const frac = Math.max(0, Math.min(1, gcValues[b]));
      const y = margin + plotH * (1 - frac);
      if (b === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = GC_HIGH_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 50% reference line (dashed)
    const refY = margin + plotH * 0.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = REF_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, refY);
    ctx.lineTo(canvasWidth, refY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw isochore class boundary lines if visible
    const iso = data.layers?.isochores;
    if (iso && iso.n > 1) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 1; i < iso.n; i++) {
        const bStart = iso.ranges.start[i];
        if (bStart > viewStart && bStart < viewEnd) {
          const x = ((bStart - viewStart) / span) * canvasWidth;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // Labels
    ctx.fillStyle = '#555';
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('50%', canvasWidth - 2, refY);

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
