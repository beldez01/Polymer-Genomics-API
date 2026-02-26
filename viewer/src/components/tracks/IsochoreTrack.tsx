'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';

// Isochore class colours (Bernardi classification)
const ISOCHORE_COLORS: Record<string, string> = {
  L1: '#1e3a5f', // dark blue  (AT-rich)
  L2: '#2563eb', // blue
  H1: '#16a34a', // green
  H2: '#eab308', // yellow
  H3: '#dc2626', // red        (GC-rich)
};

function isochoreColor(cls: string | null | undefined): string {
  if (!cls) return '#374151';
  return ISOCHORE_COLORS[cls.toUpperCase()] ?? '#374151';
}

export interface IsochoreTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function IsochoreTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 30,
}: IsochoreTrackProps) {
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
      ctx.fillText('No isochore data in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const span = viewEnd - viewStart + 1;

    for (let i = 0; i < data.n; i++) {
      const rStart = data.ranges.start[i];
      const rEnd = data.ranges.end[i];

      // Skip features entirely outside viewport
      if (rEnd < viewStart || rStart > viewEnd) continue;

      // Clip to viewport
      const clippedStart = Math.max(rStart, viewStart);
      const clippedEnd = Math.min(rEnd, viewEnd);

      const x1 = genomicToPixel(clippedStart, viewStart, viewEnd, canvasWidth);
      const x2 = genomicToPixel(clippedEnd + 1, viewStart, viewEnd, canvasWidth);
      const w = Math.max(1, x2 - x1);

      const isoClass = data.mcols.class?.[i] as string | null
        ?? data.mcols.isochore_class?.[i] as string | null;
      const gcContent = data.mcols.gc_content?.[i] as number | null;

      ctx.fillStyle = isochoreColor(isoClass);
      ctx.fillRect(x1, 2, w, height - 4);

      // Label: show isochore class + GC% if there is enough room
      const labelMinPx = 50;
      if (w >= labelMinPx) {
        ctx.fillStyle = '#f3f4f6';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let label = isoClass?.toUpperCase() ?? '';
        if (gcContent != null) {
          label += ` (${(gcContent * 100).toFixed(1)}%)`;
        }
        // Clip text to band width
        const textX = x1 + w / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x1, 0, w, height);
        ctx.clip();
        ctx.fillText(label, textX, height / 2);
        ctx.restore();
      }
    }

    // Legend at bottom-right if viewport is large enough
    if (canvasWidth >= 400 && span > 100_000) {
      const legend = Object.entries(ISOCHORE_COLORS);
      const legendX = canvasWidth - 10;
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      let lx = legendX;
      for (let li = legend.length - 1; li >= 0; li--) {
        const [cls, clr] = legend[li];
        const labelW = ctx.measureText(cls).width + 14;
        lx -= labelW;
        ctx.fillStyle = clr;
        ctx.fillRect(lx, height - 12, 8, 8);
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(cls, lx + labelW - 4, height - 8);
      }
    }
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
