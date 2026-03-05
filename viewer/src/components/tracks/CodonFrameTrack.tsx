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

const CODON_TABLE: Record<string, string> = {
  'TTT':'F','TTC':'F','TTA':'L','TTG':'L','CTT':'L','CTC':'L','CTA':'L','CTG':'L',
  'ATT':'I','ATC':'I','ATA':'I','ATG':'M','GTT':'V','GTC':'V','GTA':'V','GTG':'V',
  'TCT':'S','TCC':'S','TCA':'S','TCG':'S','CCT':'P','CCC':'P','CCA':'P','CCG':'P',
  'ACT':'T','ACC':'T','ACA':'T','ACG':'T','GCT':'A','GCC':'A','GCA':'A','GCG':'A',
  'TAT':'Y','TAC':'Y','TAA':'*','TAG':'*','TGT':'C','TGC':'C','TGA':'*','TGG':'W',
  'CGT':'R','CGC':'R','CGA':'R','CGG':'R','AGT':'S','AGC':'S','AGA':'R','AGG':'R',
  'GAT':'D','GAC':'D','GAA':'E','GAG':'E','GGT':'G','GGC':'G','GGA':'G','GGG':'G',
};

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

export interface CodonFrameTrackProps {
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  sequence?: string | null;
}

export function CodonFrameTrack({ viewStart, viewEnd, canvasWidth, sequence }: CodonFrameTrackProps) {
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

      // Codon text / highlights when sequence available
      if (sequence && bpW >= 4) {
        ctx.save();
        const k1 = Math.max(0, Math.ceil((viewStart - frame - 1) / 3));
        let p2 = frame + 1 + 3 * k1;
        while (p2 <= viewEnd + 3) {
          const seqIdx = p2 - viewStart;
          if (seqIdx >= 0 && seqIdx + 2 < sequence.length) {
            const codon = sequence.substring(seqIdx, seqIdx + 3).toUpperCase();
            const cx1 = Math.max(0, toX(p2));
            const cx2 = Math.min(canvasWidth, toX(p2 + 3));
            if (cx2 > cx1) {
              // Start/stop codon highlights
              if (codon === 'ATG') {
                ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
                ctx.fillRect(cx1, rowY, cx2 - cx1, ROW_H);
              } else if (STOP_CODONS.has(codon)) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
                ctx.fillRect(cx1, rowY, cx2 - cx1, ROW_H);
              }

              // Text label
              const centerX = (cx1 + cx2) / 2;
              ctx.fillStyle = '#e0e0e0';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              if (bpW >= 8) {
                ctx.font = `bold ${Math.min(10, ROW_H - 3)}px ${FONT_FAMILY}`;
                ctx.fillText(codon, centerX, rowY + ROW_H / 2);
              } else {
                const aa = CODON_TABLE[codon] ?? '?';
                ctx.font = `bold ${Math.min(10, ROW_H - 3)}px ${FONT_FAMILY}`;
                ctx.fillText(aa, centerX, rowY + ROW_H / 2);
              }
            }
          }
          p2 += 3;
        }
        ctx.restore();
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

      // Frame label badge on the left
      ctx.save();
      ctx.fillStyle = 'rgba(30, 30, 30, 0.7)';
      const badgeW = 20;
      const badgeH = ROW_H - 2;
      const badgeX = 1;
      const badgeY = rowY + 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.fillStyle = COLORS.canvas.axisLabel;
      ctx.font = `bold 9px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(FRAME_LABELS[frame], badgeX + badgeW / 2, rowY + ROW_H / 2);
      ctx.restore();
    }

  }, [viewStart, viewEnd, canvasWidth, sequence]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ height: CODON_FRAME_HEIGHT }}
    />
  );
}
