'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

// A compartment = warm (active), B compartment = cool (inactive)
const COLOR_A = '#ef4444'; // red — active/euchromatin
const COLOR_B = '#3b82f6'; // blue — inactive/heterochromatin

export interface HicCompartmentTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function HicCompartmentTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 40,
}: HicCompartmentTrackProps) {
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
      ctx.fillText('No compartment data in view', canvasWidth / 2, height / 2 + 4);
      barsRef.current = bars;
      return;
    }

    const pc1s = (data.mcols.pc1_score as (number | null)[]) ?? [];
    const midY = height / 2;

    // Find max |pc1| for scaling
    const absMax = pc1s.reduce((mx, v) => v != null ? Math.max(mx, Math.abs(v)) : mx, 0.01);
    const scale = (midY - 4) / absMax;

    // Draw zero line
    ctx.strokeStyle = `${COLOR.text.faint}44`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(canvasWidth, midY);
    ctx.stroke();

    // Draw bars — positive (A) goes up (red), negative (B) goes down (blue)
    for (let i = 0; i < data.n; i++) {
      const pc1 = pc1s[i];
      if (pc1 == null) continue;

      const start = data.ranges.start[i];
      const end = data.ranges.end[i];
      if (end < viewStart || start > viewEnd) continue;

      const x1 = genomicToPixel(Math.max(start, viewStart), viewStart, viewEnd, canvasWidth);
      const x2 = genomicToPixel(Math.min(end, viewEnd), viewStart, viewEnd, canvasWidth);
      const w = Math.max(x2 - x1, 1);

      const barH = Math.abs(pc1) * scale;
      const isA = pc1 > 0;
      const barY = isA ? midY - barH : midY;

      ctx.fillStyle = isA ? `${COLOR_A}99` : `${COLOR_B}99`;
      ctx.fillRect(x1, barY, w, barH);

      bars.push({ x: x1, y: barY, w, h: barH, i });
    }

    barsRef.current = bars;
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let best: typeof barsRef.current[0] | null = null;
    for (const bar of barsRef.current) {
      if (mx >= bar.x && mx <= bar.x + bar.w) {
        best = bar;
        break;
      }
    }
    setTooltip(best ? { x: mx, y: best.y, i: best.i } : null);
  };

  const tooltipRows = tooltip && data ? (() => {
    const i = tooltip.i;
    const pc1 = data.mcols.pc1_score?.[i] as number | null;
    const ct = data.mcols.cell_type?.[i] as string | null;
    const start = data.ranges.start[i];
    const end = data.ranges.end[i];
    const chr = data.seqnames[i];
    const rows: { label: string; value: string }[] = [];
    rows.push({ label: 'Position', value: `${chr}:${start.toLocaleString()}-${end.toLocaleString()}` });
    if (pc1 != null) rows.push({ label: 'PC1', value: `${pc1.toFixed(4)} (${pc1 > 0 ? 'A/active' : 'B/inactive'})` });
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
