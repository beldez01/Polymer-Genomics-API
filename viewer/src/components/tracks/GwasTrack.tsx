'use client';

import { useRef, useEffect, useState } from 'react';
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
  const dotsRef = useRef<{ x: number; y: number; i: number }[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; i: number } | null>(null);

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

    const dots: { x: number; y: number; i: number }[] = [];

    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No GWAS hits in view', canvasWidth / 2, height / 2 + 4);
      dotsRef.current = dots;
      return;
    }

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

    const yMin = GWAS_THRESHOLD;
    const yMax = Math.max(maxNLP, GWAS_THRESHOLD + 5);

    function nlpToY(nlp: number): number {
      const frac = (nlp - yMin) / (yMax - yMin);
      return plotBottom - frac * plotH;
    }

    // Significance threshold line
    ctx.strokeStyle = COLOR.text.faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const threshY = nlpToY(GWAS_THRESHOLD);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(canvasWidth, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLOR.canvas.axisLabel;
    ctx.font = "8px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('-log\u2081\u2080(p)', 2, threshY - 2);

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

      dots.push({ x, y, i });
    }

    dotsRef.current = dots;

    // Bottom labels: gene + trait for top hits
    if (canvasWidth >= 200) {
      type LabeledHit = { x: number; label: string; label2: string; nlp: number };
      const labeled: LabeledHit[] = [];

      for (let i = 0; i < data.n; i++) {
        const pos = data.ranges.start[i];
        if (pos < viewStart || pos > viewEnd) continue;
        const nlp = nlps[i];
        if (nlp < yMin) continue;

        const gene = data.mcols.mapped_gene?.[i] as string | null;
        const trait = data.mcols.trait?.[i] as string | null;
        const label = gene || (trait ? trait.substring(0, 30) : '');
        const label2 = gene && trait ? trait.substring(0, 40) : '';
        if (!label) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        labeled.push({ x, label, label2, nlp });
      }

      labeled.sort((a, b) => b.nlp - a.nlp);
      const placed: number[] = [];
      const minGap = 60;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (const hit of labeled) {
        if (placed.length >= 8) break;
        if (placed.some(px => Math.abs(px - hit.x) < minGap)) continue;
        placed.push(hit.x);

        ctx.fillStyle = COLOR.text.muted;
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillText(hit.label, hit.x, plotBottom + 2);
      }
    }

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const THRESHOLD = 8;

    let closest: { x: number; y: number; i: number } | null = null;
    let closestDist = THRESHOLD;

    for (const dot of dotsRef.current) {
      const dist = Math.sqrt((mx - dot.x) ** 2 + (my - dot.y) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = dot;
      }
    }

    setTooltip(closest);
  };

  const tooltipContent = tooltip && data ? (() => {
    const i = tooltip.i;
    const rsid = data.mcols.rsid?.[i] as string | null;
    const trait = data.mcols.trait?.[i] as string | null;
    const pVal = data.mcols.p_value?.[i] as number | null;
    const orVal = data.mcols.or_beta?.[i] as number | null;
    const ciLo = data.mcols.ci_lower?.[i] as number | null;
    const ciHi = data.mcols.ci_upper?.[i] as number | null;
    const gene = data.mcols.mapped_gene?.[i] as string | null;
    const pmid = data.mcols.pmid?.[i] as string | null;
    const study = data.mcols.study_accession?.[i] as string | null;

    const lines: string[] = [];
    if (rsid) lines.push(rsid);
    if (trait) lines.push(trait);
    const stats: string[] = [];
    if (pVal != null) stats.push(`p = ${pVal.toExponential(1)}`);
    if (orVal != null) {
      let orStr = `OR = ${orVal.toFixed(2)}`;
      if (ciLo != null && ciHi != null) orStr += ` [${ciLo.toFixed(2)}\u2013${ciHi.toFixed(2)}]`;
      stats.push(orStr);
    }
    if (stats.length) lines.push(stats.join(' | '));
    if (gene) lines.push(`Gene: ${gene}`);
    const refs: string[] = [];
    if (pmid) refs.push(`PMID: ${pmid}`);
    if (study) refs.push(study);
    if (refs.length) lines.push(refs.join(' | '));

    return lines;
  })() : null;

  return (
    <div style={{ position: 'relative' }} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} className="block" />
      {tooltip && tooltipContent && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x, canvasWidth - 310),
          top: tooltip.y - 8,
          transform: 'translateY(-100%)',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          padding: '4px 8px',
          maxWidth: 300,
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {tooltipContent.map((line, li) => (
            <div key={li} style={{
              color: li === 0 ? '#ccc' : '#999',
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
