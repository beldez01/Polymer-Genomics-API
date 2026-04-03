'use client';

import { useRef, useEffect } from 'react';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

interface Motif {
  start: number;
  end: number;
  type?: string;
  sequence?: string;
  stem_length?: number;
  length?: number;
  g_run_lengths?: number[];
  mean_z_penalty?: number;
}

interface MotifData {
  g_quadruplex?: Motif[];
  z_dna_prone?: Motif[];
  homopolymer_runs?: Motif[];
  inverted_repeats?: Motif[];
}

const MOTIF_COLORS: Record<string, string> = {
  g_quadruplex: '#2ECC71',
  z_dna_prone: '#3498DB',
  homopolymer_runs: '#95A5A6',
  inverted_repeats: '#E67E22',
};

const MOTIF_LABELS: Record<string, string> = {
  g_quadruplex: 'G4',
  z_dna_prone: 'Z-DNA',
  homopolymer_runs: 'Homo',
  inverted_repeats: 'Hairpin',
};

export interface MotifTrackProps {
  motifs: MotifData | undefined;
  regionStart: number;  // genomic start of the queried region (to offset motif coords)
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function MotifTrack({
  motifs, regionStart, viewStart, viewEnd, canvasWidth, height = 40,
}: MotifTrackProps) {
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

    if (!motifs) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('Zoom in for motif detection', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const categories = Object.keys(MOTIF_COLORS) as (keyof MotifData)[];
    const laneH = Math.floor((height - 4) / categories.length);
    let totalMotifs = 0;

    for (let lane = 0; lane < categories.length; lane++) {
      const cat = categories[lane];
      const items = motifs[cat];
      if (!items || items.length === 0) continue;

      const color = MOTIF_COLORS[cat];
      const label = MOTIF_LABELS[cat];
      const y = 2 + lane * laneH;
      const blockH = laneH - 2;

      for (const m of items) {
        // Motif coords are 0-based relative to the queried region
        const gStart = regionStart + m.start;
        const gEnd = regionStart + (m.end || m.start + (m.length || 1));
        if (gEnd < viewStart || gStart > viewEnd) continue;

        const x1 = genomicToPixel(gStart, viewStart, viewEnd, canvasWidth);
        const x2 = genomicToPixel(gEnd, viewStart, viewEnd, canvasWidth);
        const w = Math.max(2, x2 - x1);

        ctx.fillStyle = color + '99';
        ctx.fillRect(x1, y, w, blockH);
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x1, y, w, blockH);

        // Label if wide enough
        if (w > 20) {
          ctx.fillStyle = '#FFFFFFCC';
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          const displayLabel = m.type ? m.type.replace('poly_', '') : label;
          ctx.fillText(displayLabel, x1 + w / 2, y + blockH / 2 + 3);
        }

        totalMotifs++;
      }

      // Lane label on left
      ctx.fillStyle = color + 'AA';
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillText(label, 2, y + blockH / 2 + 3);
    }

    if (totalMotifs === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No motifs detected', canvasWidth / 2, height / 2 + 4);
    }
  }, [motifs, regionStart, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
