'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

/** -log10(5e-8) = 7.3 — genome-wide significance threshold. */
const GWAS_THRESHOLD = 7.3;

function pToNegLog10(p: number | null): number {
  if (p == null || p <= 0) return 0;
  return -Math.log10(p);
}

/** Interpolate dot color from magenta (just significant) to red (extremely significant). */
function dotColor(negLog10P: number): string {
  if (negLog10P >= 20) return COLOR.gwas.dotHigh;
  if (negLog10P <= GWAS_THRESHOLD) return COLOR.gwas.dot;
  const t = (negLog10P - GWAS_THRESHOLD) / (20 - GWAS_THRESHOLD);
  // Lerp magenta → red via hue
  return `hsl(${310 - t * 310 + t * 348}, ${80 + t * 20}%, ${55 - t * 10}%)`;
}

export interface GwasTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function GwasTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 80,
}: GwasTrackProps) {
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
      ctx.fillText('No GWAS hits in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // Compute -log10(p) for all points
    const plotTop = 8;
    const plotBottom = height - 14;
    const plotH = plotBottom - plotTop;

    let maxNLP = GWAS_THRESHOLD;
    const nlps: number[] = [];
    for (let i = 0; i < data.n; i++) {
      const p = data.mcols.p_value?.[i] as number | null;
      const nlp = pToNegLog10(p);
      nlps.push(nlp);
      if (nlp > maxNLP) maxNLP = nlp;
    }

    // Scale: Y from GWAS_THRESHOLD at bottom to maxNLP at top
    const yMin = GWAS_THRESHOLD;
    const yMax = Math.max(maxNLP, GWAS_THRESHOLD + 5);

    function nlpToY(nlp: number): number {
      const frac = (nlp - yMin) / (yMax - yMin);
      return plotBottom - frac * plotH;
    }

    // Draw significance threshold line
    ctx.strokeStyle = COLOR.text.faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const threshY = nlpToY(GWAS_THRESHOLD);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(canvasWidth, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-axis label
    ctx.fillStyle = COLOR.canvas.axisLabel;
    ctx.font = "8px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('-log₁₀(p)', 2, threshY - 2);

    // Draw lollipops
    const dotRadius = 3;

    for (let i = 0; i < data.n; i++) {
      const pos = data.ranges.start[i];
      if (pos < viewStart || pos > viewEnd) continue;

      const nlp = nlps[i];
      if (nlp < yMin) continue;

      const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
      const y = nlpToY(nlp);

      // Stem
      ctx.strokeStyle = COLOR.gwas.stem;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, plotBottom);
      ctx.lineTo(x, y);
      ctx.stroke();

      // Dot
      ctx.fillStyle = dotColor(nlp);
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom labels: show gene/trait for top hits when enough space
    if (canvasWidth >= 200) {
      // Collect top hits with labels
      type LabeledHit = { x: number; label: string; nlp: number };
      const labeled: LabeledHit[] = [];

      for (let i = 0; i < data.n; i++) {
        const pos = data.ranges.start[i];
        if (pos < viewStart || pos > viewEnd) continue;

        const nlp = nlps[i];
        if (nlp < yMin) continue;

        const gene = data.mcols.mapped_gene?.[i] as string | null;
        const trait = data.mcols.trait?.[i] as string | null;
        const label = gene || (trait ? trait.substring(0, 20) : '');
        if (!label) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        labeled.push({ x, label, nlp });
      }

      // Sort by significance, take top labels that don't overlap
      labeled.sort((a, b) => b.nlp - a.nlp);
      const placed: number[] = [];
      const minGap = 60;

      ctx.fillStyle = COLOR.text.muted;
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (const hit of labeled) {
        if (placed.length >= 8) break;
        if (placed.some(px => Math.abs(px - hit.x) < minGap)) continue;
        placed.push(hit.x);
        ctx.fillText(hit.label, hit.x, plotBottom + 2);
      }
    }

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} className="block" />;
}
