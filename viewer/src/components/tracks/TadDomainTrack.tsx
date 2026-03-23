'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

// TAD domain color — blue-teal, maps corner_score to opacity
const TAD_BASE = '#3b82f6';

function scoreToAlpha(score: number | null | undefined, minScore: number, maxScore: number): number {
  if (score == null || maxScore <= minScore) return 0.5;
  const norm = (score - minScore) / (maxScore - minScore);
  return 0.2 + Math.min(norm, 1) * 0.6; // range [0.2, 0.8]
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

export interface TadDomainTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function TadDomainTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 50,
}: TadDomainTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<{ x: number; y: number; w: number; h: number; i: number }[]>([]);
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

    const bars: { x: number; y: number; w: number; h: number; i: number }[] = [];

    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No TAD domains in view', canvasWidth / 2, height / 2 + 4);
      barsRef.current = bars;
      return;
    }

    // Compute score range for opacity mapping
    const scores = (data.mcols.corner_score as (number | null)[]) ?? [];
    const validScores = scores.filter((s): s is number => s != null);
    const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
    const maxScore = validScores.length > 0 ? Math.max(...validScores) : 1;

    // Draw TAD domains as nested blocks
    // Sort by size (largest first) so smaller domains render on top
    const indices = Array.from({ length: data.n }, (_, i) => i);
    indices.sort((a, b) => {
      const sizeA = data.ranges.end[a] - data.ranges.start[a];
      const sizeB = data.ranges.end[b] - data.ranges.start[b];
      return sizeB - sizeA; // largest first
    });

    const domainTop = 4;
    const domainHeight = height - 8;

    for (const i of indices) {
      const start = data.ranges.start[i];
      const end = data.ranges.end[i];

      // Skip domains entirely outside viewport
      if (end < viewStart || start > viewEnd) continue;

      const x1 = genomicToPixel(Math.max(start, viewStart), viewStart, viewEnd, canvasWidth);
      const x2 = genomicToPixel(Math.min(end, viewEnd), viewStart, viewEnd, canvasWidth);
      const w = Math.max(x2 - x1, 2); // minimum 2px width

      const score = scores[i];
      const alpha = scoreToAlpha(score, minScore, maxScore);

      // Domain fill
      ctx.fillStyle = hexWithAlpha(TAD_BASE, alpha * 0.4);
      ctx.fillRect(x1, domainTop, w, domainHeight);

      // Boundary lines (left and right edges)
      ctx.strokeStyle = hexWithAlpha(TAD_BASE, alpha);
      ctx.lineWidth = 1.5;

      // Left boundary (only if in view)
      if (start >= viewStart) {
        ctx.beginPath();
        ctx.moveTo(x1, domainTop);
        ctx.lineTo(x1, domainTop + domainHeight);
        ctx.stroke();
      }

      // Right boundary (only if in view)
      if (end <= viewEnd) {
        ctx.beginPath();
        ctx.moveTo(x1 + w, domainTop);
        ctx.lineTo(x1 + w, domainTop + domainHeight);
        ctx.stroke();
      }

      bars.push({ x: x1, y: domainTop, w, h: domainHeight, i });
    }

    barsRef.current = bars;
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find the smallest domain containing the cursor (most specific)
    let best: { x: number; y: number; w: number; h: number; i: number } | null = null;
    let bestArea = Infinity;

    for (const bar of barsRef.current) {
      if (mx >= bar.x && mx <= bar.x + bar.w && my >= bar.y && my <= bar.y + bar.h) {
        const area = bar.w * bar.h;
        if (area < bestArea) {
          bestArea = area;
          best = bar;
        }
      }
    }

    setTooltip(best ? { x: mx, y: best.y, i: best.i } : null);
  };

  const tooltipRows = tooltip && data ? (() => {
    const i = tooltip.i;
    const start = data.ranges.start[i];
    const end = data.ranges.end[i];
    const chr = data.seqnames[i];
    const cellType = data.mcols.cell_type?.[i] as string | null;
    const resolution = data.mcols.resolution_bp?.[i] as number | null;
    const corner = data.mcols.corner_score?.[i] as number | null;
    const width = end - start + 1;

    const rows: { label: string; value: string }[] = [];
    rows.push({ label: 'Position', value: `${chr}:${start.toLocaleString()}-${end.toLocaleString()}` });
    rows.push({ label: 'Size', value: width >= 1_000_000 ? `${(width / 1_000_000).toFixed(2)} Mb` : `${(width / 1_000).toFixed(0)} kb` });
    if (cellType) rows.push({ label: 'Cell type', value: cellType });
    if (corner != null) rows.push({ label: 'Score', value: corner.toFixed(2) });
    if (resolution != null) rows.push({ label: 'Resolution', value: `${(resolution / 1_000).toFixed(0)} kb` });

    return rows;
  })() : null;

  return (
    <div style={{ position: 'relative' }} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} className="block" />
      {tooltip && tooltipRows && tooltipRows.length > 0 && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x, canvasWidth - 260),
          top: tooltip.y - 8,
          transform: 'translateY(-100%)',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          padding: '6px 10px',
          maxWidth: 300,
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {tooltipRows.map((row, ri) => (
            <div key={ri} style={{
              display: 'flex',
              gap: 8,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              lineHeight: 1.5,
            }}>
              <span style={{ color: '#777', flexShrink: 0, width: 56, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
