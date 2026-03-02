'use client';

import { useRef, useEffect } from 'react';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';


const BASE_COLORS: Record<string, string> = {
  A: '#22c55e',
  T: '#ef4444',
  G: '#f59e0b',
  C: '#3b82f6',
  N: '#6b7280',
};

function colorForBase(base: string): string {
  return BASE_COLORS[base.toUpperCase()] ?? BASE_COLORS.N;
}

export interface SequenceTrackProps {
  sequence: string | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function SequenceTrack({
  sequence,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 60,
}: SequenceTrackProps) {
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

    if (!sequence || sequence.length === 0) {
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No sequence data', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const span = viewEnd - viewStart + 1;
    const bpPerPixel = span / canvasWidth;
    const bpWidth = canvasWidth / span;

    if (bpPerPixel <= 1) {
      const fontSize = Math.min(Math.floor(bpWidth * 0.85), height - 8);
      ctx.font = `bold ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < sequence.length; i++) {
        const base = sequence[i];
        const genomicPos = viewStart + i;
        const x = ((genomicPos - viewStart) / span) * canvasWidth;
        const centerX = x + bpWidth / 2;

        ctx.fillStyle = colorForBase(base);
        ctx.fillText(base.toUpperCase(), centerX, height / 2);
      }
    } else if (bpPerPixel <= 10) {
      for (let i = 0; i < sequence.length; i++) {
        const base = sequence[i];
        const x = (i / span) * canvasWidth;
        const w = Math.max(1, bpWidth);

        ctx.fillStyle = colorForBase(base);
        ctx.fillRect(x, 4, w, height - 8);
      }
    } else {
      const binCount = Math.ceil(canvasWidth);
      const barWidth = canvasWidth / binCount;

      for (let bin = 0; bin < binCount; bin++) {
        const binStartBp = Math.floor((bin / binCount) * span);
        const binEndBp = Math.min(
          Math.floor(((bin + 1) / binCount) * span),
          sequence.length,
        );

        if (binEndBp <= binStartBp) continue;

        let gc = 0;
        let total = 0;
        for (let j = binStartBp; j < binEndBp; j++) {
          const b = sequence[j]?.toUpperCase();
          if (b === 'G' || b === 'C') gc++;
          if (b === 'A' || b === 'T' || b === 'G' || b === 'C') total++;
        }

        if (total === 0) continue;
        const gcFrac = gc / total;
        const barHeight = gcFrac * (height - 8);

        const r = Math.round(180 - gcFrac * 130);
        const g = Math.round(100 + gcFrac * 100);
        const b2 = Math.round(50);
        ctx.fillStyle = `rgb(${r},${g},${b2})`;
        ctx.fillRect(
          bin * barWidth,
          height - 4 - barHeight,
          Math.max(1, barWidth),
          barHeight,
        );
      }

      ctx.fillStyle = COLORS.canvas.axisLabel;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillText('GC%', 4, 12);
    }
  }, [sequence, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
