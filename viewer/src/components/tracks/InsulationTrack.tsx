'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

// Insulation: negative = boundary (strong), near zero = domain interior
const BOUNDARY_COLOR = '#f59e0b'; // amber for boundaries
const INTERIOR_COLOR = '#6366f1'; // indigo for domain interior

export interface InsulationTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function InsulationTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 40,
}: InsulationTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const binsRef = useRef<{ x: number; w: number; i: number }[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; i: number } | null>(null);

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

    const bins: { x: number; w: number; i: number }[] = [];

    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No insulation data in view', canvasWidth / 2, height / 2 + 4);
      binsRef.current = bins;
      return;
    }

    const scores = (data.mcols.insulation_score as (number | null)[]) ?? [];

    // Find range for scaling
    const valid = scores.filter((s): s is number => s != null);
    const minVal = valid.length > 0 ? Math.min(...valid) : -1;
    const maxVal = valid.length > 0 ? Math.max(...valid) : 1;
    const range = Math.max(maxVal - minVal, 0.01);

    const pad = 3;
    const plotH = height - 2 * pad;

    // Draw as filled area chart — line + fill below
    ctx.beginPath();
    let started = false;
    const points: { x: number; y: number; i: number }[] = [];

    for (let i = 0; i < data.n; i++) {
      const score = scores[i];
      if (score == null) continue;

      const start = data.ranges.start[i];
      const end = data.ranges.end[i];
      if (end < viewStart || start > viewEnd) continue;

      const midPos = (start + end) / 2;
      const x = genomicToPixel(midPos, viewStart, viewEnd, canvasWidth);
      // Invert: more negative (stronger boundary) = higher on track
      const norm = 1 - (score - minVal) / range;
      const y = pad + norm * plotH;

      points.push({ x, y, i });

      const x1 = genomicToPixel(Math.max(start, viewStart), viewStart, viewEnd, canvasWidth);
      const x2 = genomicToPixel(Math.min(end, viewEnd), viewStart, viewEnd, canvasWidth);
      bins.push({ x: x1, w: Math.max(x2 - x1, 1), i });

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    if (points.length > 1) {
      // Fill under the line
      const firstX = points[0].x;
      const lastX = points[points.length - 1].x;
      ctx.lineTo(lastX, height - pad);
      ctx.lineTo(firstX, height - pad);
      ctx.closePath();

      // Gradient fill: amber at top (boundaries), indigo at bottom (interior)
      const grad = ctx.createLinearGradient(0, pad, 0, height - pad);
      grad.addColorStop(0, `${BOUNDARY_COLOR}66`);
      grad.addColorStop(1, `${INTERIOR_COLOR}22`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw line on top
      ctx.beginPath();
      for (let j = 0; j < points.length; j++) {
        if (j === 0) ctx.moveTo(points[j].x, points[j].y);
        else ctx.lineTo(points[j].x, points[j].y);
      }
      ctx.strokeStyle = `${BOUNDARY_COLOR}cc`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    binsRef.current = bins;
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;

    let best: typeof binsRef.current[0] | null = null;
    for (const bin of binsRef.current) {
      if (mx >= bin.x && mx <= bin.x + bin.w) {
        best = bin;
        break;
      }
    }
    setTooltip(best ? { x: mx, i: best.i } : null);
  };

  const tooltipRows = tooltip && data ? (() => {
    const i = tooltip.i;
    const score = data.mcols.insulation_score?.[i] as number | null;
    const ct = data.mcols.cell_type?.[i] as string | null;
    const start = data.ranges.start[i];
    const end = data.ranges.end[i];
    const chr = data.seqnames[i];
    const rows: { label: string; value: string }[] = [];
    rows.push({ label: 'Position', value: `${chr}:${start.toLocaleString()}-${end.toLocaleString()}` });
    if (score != null) {
      const label = score < -0.5 ? 'strong boundary' : score < -0.1 ? 'weak boundary' : 'domain interior';
      rows.push({ label: 'Insulation', value: `${score.toFixed(3)} (${label})` });
    }
    if (ct) rows.push({ label: 'Cell type', value: ct });
    return rows;
  })() : null;

  return (
    <div style={{ position: 'relative' }} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} className="block" />
      {tooltip && tooltipRows && tooltipRows.length > 0 && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x, canvasWidth - 260),
          top: 0,
          transform: 'translateY(-100%)',
          backgroundColor: '#FAFAFA',
          border: '1px solid #444',
          padding: '6px 10px',
          maxWidth: 300,
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {tooltipRows.map((row, ri) => (
            <div key={ri} style={{
              display: 'flex', gap: 8, fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5,
            }}>
              <span style={{ color: '#777', flexShrink: 0, width: 56, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: '#ddd' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
