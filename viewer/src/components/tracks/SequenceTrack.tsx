'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';


const BASE_COLORS: Record<string, string> = {
  A: '#22c55e',
  T: '#ef4444',
  G: '#f59e0b',
  C: '#3b82f6',
  N: '#6b7280',
};

const CPG_OUTLINE = '#4ECDC4';

function colorForBase(base: string): string {
  return BASE_COLORS[base.toUpperCase()] ?? BASE_COLORS.N;
}

/** Build a Set of genomic positions that are part of a CpG dinucleotide. */
function buildCpgSet(cpgData: GRanges | undefined): Set<number> {
  const s = new Set<number>();
  if (!cpgData) return s;
  for (let i = 0; i < cpgData.n; i++) {
    const pos = cpgData.ranges.start[i];
    s.add(pos);       // C position
    s.add(pos + 1);   // G position
  }
  return s;
}

export interface SequenceTrackProps {
  sequence: string | null;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
  cpgData?: GRanges;
}

export function SequenceTrack({
  sequence,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 60,
  cpgData,
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
    const cpgSet = buildCpgSet(cpgData);
    const showCpgOverlay = cpgSet.size > 0;

    // ── 5' / 3' strand labels ──
    const labelPad = 4;
    const labelFontSize = Math.min(11, height * 0.28);
    ctx.font = `bold ${labelFontSize}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8a8a8a';
    ctx.textAlign = 'left';
    ctx.fillText("5'", labelPad, height / 2);
    ctx.textAlign = 'right';
    ctx.fillText("3'", canvasWidth - labelPad, height / 2);

    const labelInset = labelFontSize * 1.8;

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

        // CpG outline: thin rounded box around the base letter
        if (showCpgOverlay && cpgSet.has(genomicPos)) {
          ctx.strokeStyle = CPG_OUTLINE;
          ctx.lineWidth = 1.5;
          const boxH = fontSize + 2;
          const boxW = bpWidth - 1;
          const boxX = x + 0.5;
          const boxY = (height - boxH) / 2;
          const r = Math.min(3, boxW * 0.2);
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, r);
          ctx.stroke();
        }
      }
    } else if (bpPerPixel <= 10) {
      for (let i = 0; i < sequence.length; i++) {
        const base = sequence[i];
        const x = (i / span) * canvasWidth;
        const w = Math.max(1, bpWidth);

        ctx.fillStyle = colorForBase(base);
        ctx.fillRect(x, 4, w, height - 8);
      }

      // CpG overlay: teal tick marks along the top
      if (showCpgOverlay && cpgData) {
        ctx.fillStyle = CPG_OUTLINE;
        for (let i = 0; i < cpgData.n; i++) {
          const pos = cpgData.ranges.start[i];
          if (pos < viewStart || pos > viewEnd) continue;
          const x = ((pos - viewStart) / span) * canvasWidth;
          const w = Math.max(1, bpWidth * 2);
          ctx.fillRect(x, 0, w, 3);
        }
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

      // CpG density ticks at zoomed-out view
      if (showCpgOverlay && cpgData) {
        ctx.fillStyle = CPG_OUTLINE;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < cpgData.n; i++) {
          const pos = cpgData.ranges.start[i];
          if (pos < viewStart || pos > viewEnd) continue;
          const x = ((pos - viewStart) / span) * canvasWidth;
          ctx.fillRect(x, 0, 1, 3);
        }
        ctx.globalAlpha = 1.0;
      }

      ctx.fillStyle = COLORS.canvas.axisLabel;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillText('GC%', 4, 12);
    }

    // Redraw 5'/3' labels on top of everything
    ctx.font = `bold ${labelFontSize}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = 'middle';
    // Background pill for readability
    const metrics5 = ctx.measureText("5'");
    const metrics3 = ctx.measureText("3'");
    ctx.fillStyle = 'rgba(10,10,10,0.85)';
    ctx.fillRect(0, height / 2 - labelFontSize * 0.6, metrics5.width + labelPad * 2, labelFontSize * 1.2);
    ctx.fillRect(canvasWidth - metrics3.width - labelPad * 2, height / 2 - labelFontSize * 0.6, metrics3.width + labelPad * 2, labelFontSize * 1.2);
    ctx.fillStyle = '#8a8a8a';
    ctx.textAlign = 'left';
    ctx.fillText("5'", labelPad, height / 2);
    ctx.textAlign = 'right';
    ctx.fillText("3'", canvasWidth - labelPad, height / 2);

  }, [sequence, cpgData, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
