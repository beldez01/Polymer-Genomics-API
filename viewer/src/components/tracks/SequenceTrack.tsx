'use client';

import { useRef, useEffect } from 'react';

// ----- Nucleotide colours (bright, dark-theme friendly) -----
const BASE_COLORS: Record<string, string> = {
  A: '#22c55e', // green
  T: '#ef4444', // red
  G: '#f59e0b', // amber/gold
  C: '#3b82f6', // blue
  N: '#6b7280', // gray
};

function colorForBase(base: string): string {
  return BASE_COLORS[base.toUpperCase()] ?? BASE_COLORS.N;
}

export interface SequenceTrackProps {
  sequence: string | null;
  viewStart: number; // 1-based
  viewEnd: number; // 1-based
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

    if (!sequence || sequence.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No sequence data', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const span = viewEnd - viewStart + 1;
    const bpPerPixel = span / canvasWidth;
    const bpWidth = canvasWidth / span; // pixels per base

    if (bpPerPixel <= 1) {
      // ------- MODE 1: Individual coloured letters -------
      const fontSize = Math.min(Math.floor(bpWidth * 0.85), height - 8);
      ctx.font = `bold ${fontSize}px "Courier New", monospace`;
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
      // ------- MODE 2: Coloured rectangles per base -------
      for (let i = 0; i < sequence.length; i++) {
        const base = sequence[i];
        const x = (i / span) * canvasWidth;
        const w = Math.max(1, bpWidth);

        ctx.fillStyle = colorForBase(base);
        ctx.fillRect(x, 4, w, height - 8);
      }
    } else {
      // ------- MODE 3: GC% summary bars -------
      // Bin bases into pixel-width bins, compute GC fraction per bin
      const binCount = Math.ceil(canvasWidth);
      const barWidth = canvasWidth / binCount;

      for (let bin = 0; bin < binCount; bin++) {
        // Determine which bases fall into this pixel bin
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

        // Colour gradient: low GC = warm brown, high GC = green
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

      // Axis label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('GC%', 4, 12);
    }
  }, [sequence, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
