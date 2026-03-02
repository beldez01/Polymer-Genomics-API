'use client';

import { useRef, useEffect } from 'react';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';
import { FONT_FAMILY } from '@/config/theme';

// Each frame row
const ROW_H = 14;
const ROW_GAP = 2;
const PAD_TOP = 6;
const PAD_BOT = 6;
export const CODON_FRAME_HEIGHT = PAD_TOP + 3 * ROW_H + 2 * ROW_GAP + PAD_BOT; // 58px

// Alternating solid / dim to make codon boundaries visible
const FRAME_COLORS = [
  { full: 'rgba(78,  205, 196, 0.72)', dim: 'rgba(78,  205, 196, 0.36)' }, // teal   — frame +1
  { full: 'rgba(240, 165,   0, 0.72)', dim: 'rgba(240, 165,   0, 0.36)' }, // amber  — frame +2
  { full: 'rgba(139,  92, 246, 0.72)', dim: 'rgba(139,  92, 246, 0.36)' }, // violet — frame +3
] as const;

const FRAME_LABELS = ['+1', '+2', '+3'];

export interface CodonFrameTrackProps {
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
}

export function CodonFrameTrack({ viewStart, viewEnd, canvasWidth }: CodonFrameTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const height = CODON_FRAME_HEIGHT;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);
    drawGridlines(ctx, viewStart, viewEnd, canvasWidth, height);

    const span = viewEnd - viewStart + 1;
    const bpW  = canvasWidth / span;

    const toX = (pos: number) => genomicToPixel(pos, viewStart, viewEnd, canvasWidth);

    for (let frame = 0; frame < 3; frame++) {
      const rowY = PAD_TOP + frame * (ROW_H + ROW_GAP);

      // First codon of this frame that starts at or before viewEnd.
      // Frame f codons (1-based) start at: f+1, f+4, f+7, …  → f + 1 + 3k
      // First codon start >= viewStart:
      const k0   = Math.max(0, Math.ceil((viewStart - frame - 1) / 3));
      let pos     = frame + 1 + 3 * k0;   // 1-based genomic start of first visible codon
      let codonIdx = k0;                   // parity tracker for alternating shade

      while (pos <= viewEnd + 3) {        // +3 so the last partial codon is drawn
        const cx1 = Math.max(0,           toX(pos));
        const cx2 = Math.min(canvasWidth, toX(pos + 3));
        if (cx2 > cx1) {
          ctx.fillStyle = codonIdx % 2 === 0
            ? FRAME_COLORS[frame].full
            : FRAME_COLORS[frame].dim;
          ctx.fillRect(cx1, rowY, cx2 - cx1, ROW_H);
        }
        pos      += 3;
        codonIdx += 1;
      }

      // Codon-boundary divider lines (only when codons are wide enough)
      if (bpW >= 3) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 0.5;
        const k1 = Math.max(0, Math.ceil((viewStart - frame - 1) / 3));
        let p = frame + 1 + 3 * k1;
        while (p <= viewEnd + 3) {
          const bx = toX(p);
          if (bx >= 0 && bx <= canvasWidth) {
            ctx.beginPath();
            ctx.moveTo(bx, rowY);
            ctx.lineTo(bx, rowY + ROW_H);
            ctx.stroke();
          }
          p += 3;
        }
        ctx.restore();
      }

      // Frame label on the left
      ctx.save();
      ctx.fillStyle = COLORS.canvas.axisLabel;
      ctx.font = `9px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(FRAME_LABELS[frame], 3, rowY + ROW_H / 2);
      ctx.restore();
    }

  }, [viewStart, viewEnd, canvasWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ height: CODON_FRAME_HEIGHT }}
    />
  );
}
