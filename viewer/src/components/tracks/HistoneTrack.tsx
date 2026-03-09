'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

const MARK_COLORS: Record<string, string> = {
  H3K4me3:  COLOR.histone.H3K4me3,
  H3K27ac:  COLOR.histone.H3K27ac,
  H3K4me1:  COLOR.histone.H3K4me1,
  H3K27me3: COLOR.histone.H3K27me3,
  H3K9me3:  COLOR.histone.H3K9me3,
  H3K36me3: COLOR.histone.H3K36me3,
};

const MARK_ORDER = ['H3K4me3', 'H3K27ac', 'H3K4me1', 'H3K36me3', 'H3K27me3', 'H3K9me3'];

function markColor(mark: string | null | undefined): string {
  if (!mark) return '#555555';
  return MARK_COLORS[mark] ?? '#555555';
}

export interface HistoneTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function HistoneTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 60,
}: HistoneTrackProps) {
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
      ctx.fillText('No histone data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // Group features by mark to stack rows
    const markIndices: Record<string, number[]> = {};
    for (let i = 0; i < data.n; i++) {
      const mark = (data.mcols.mark?.[i] as string) ?? 'unknown';
      if (!markIndices[mark]) markIndices[mark] = [];
      markIndices[mark].push(i);
    }

    // Determine visible marks in canonical order
    const visibleMarks = MARK_ORDER.filter(m => markIndices[m]?.length);
    // Add any marks not in MARK_ORDER
    for (const m of Object.keys(markIndices)) {
      if (!visibleMarks.includes(m)) visibleMarks.push(m);
    }

    if (visibleMarks.length === 0) return;

    const rowHeight = Math.max(6, Math.min(12, (height - 4) / visibleMarks.length));
    const gap = 1;

    for (let rowIdx = 0; rowIdx < visibleMarks.length; rowIdx++) {
      const mark = visibleMarks[rowIdx];
      const indices = markIndices[mark];
      if (!indices) continue;

      const y = 2 + rowIdx * (rowHeight + gap);
      const color = markColor(mark);

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;

      for (const i of indices) {
        const rStart = data.ranges.start[i];
        const rEnd = data.ranges.end[i];

        if (rEnd < viewStart || rStart > viewEnd) continue;

        const clippedStart = Math.max(rStart, viewStart);
        const clippedEnd = Math.min(rEnd, viewEnd);

        const x1 = genomicToPixel(clippedStart, viewStart, viewEnd, canvasWidth);
        const x2 = genomicToPixel(clippedEnd + 1, viewStart, viewEnd, canvasWidth);
        const w = Math.max(1, x2 - x1);

        ctx.fillRect(x1, y, w, rowHeight);
      }

      // Row label
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = COLOR.canvas.axisLabel;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(mark, 4, y + rowHeight / 2);
    }

    ctx.globalAlpha = 1.0;

    // Legend in top-right
    if (canvasWidth >= 300) {
      const legendY = 2;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';

      // Show cell type if available
      const cellTypes = new Set<string>();
      for (let i = 0; i < data.n; i++) {
        const ct = data.mcols.cell_type?.[i] as string;
        if (ct) cellTypes.add(ct);
      }
      if (cellTypes.size > 0) {
        ctx.fillStyle = COLOR.text.muted;
        ctx.fillText([...cellTypes].join(', '), canvasWidth - 4, legendY);
      }
    }

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
