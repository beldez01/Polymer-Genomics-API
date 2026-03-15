'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

const CLASS_COLORS: Record<string, string> = {
  SINE:          COLOR.repeat.SINE,
  LINE:          COLOR.repeat.LINE,
  LTR:           COLOR.repeat.LTR,
  DNA:           COLOR.repeat.DNA,
  Simple_repeat: COLOR.repeat.Simple_repeat,
  Satellite:     COLOR.repeat.Satellite,
  Other:         COLOR.repeat.Other,
};

const CLASS_ORDER = ['SINE', 'LINE', 'LTR', 'DNA', 'Simple_repeat', 'Satellite', 'Other'];

function classColor(cls: string | null | undefined): string {
  if (!cls) return '#555555';
  return CLASS_COLORS[cls] ?? '#555555';
}

/** Map divergence_pct (0–40+) to alpha (1.0–0.3). */
function divergenceToAlpha(div: number | null | undefined): number {
  if (div == null || div <= 0) return 1.0;
  if (div >= 40) return 0.3;
  return 1.0 - (div / 40) * 0.7;
}

export interface RepeatTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function RepeatTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 70,
}: RepeatTrackProps) {
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
      ctx.fillText('No repeat data in view', canvasWidth / 2, height / 2 + 4);
      barsRef.current = bars;
      return;
    }

    // Group features by repeat_class
    const classIndices: Record<string, number[]> = {};
    for (let i = 0; i < data.n; i++) {
      const cls = (data.mcols.repeat_class?.[i] as string) ?? 'Other';
      if (!classIndices[cls]) classIndices[cls] = [];
      classIndices[cls].push(i);
    }

    // Determine visible classes in canonical order
    const visibleClasses = CLASS_ORDER.filter(c => classIndices[c]?.length);
    // Add any classes not in CLASS_ORDER
    for (const c of Object.keys(classIndices)) {
      if (!visibleClasses.includes(c)) visibleClasses.push(c);
    }

    if (visibleClasses.length === 0) {
      barsRef.current = bars;
      return;
    }

    const rowHeight = Math.max(6, Math.min(12, (height - 4) / visibleClasses.length));
    const gap = 1;

    for (let rowIdx = 0; rowIdx < visibleClasses.length; rowIdx++) {
      const cls = visibleClasses[rowIdx];
      const indices = classIndices[cls];
      if (!indices) continue;

      const y = 2 + rowIdx * (rowHeight + gap);
      const color = classColor(cls);

      for (const i of indices) {
        const rStart = data.ranges.start[i];
        const rEnd = data.ranges.end[i];

        if (rEnd < viewStart || rStart > viewEnd) continue;

        const clippedStart = Math.max(rStart, viewStart);
        const clippedEnd = Math.min(rEnd, viewEnd);

        const x1 = genomicToPixel(clippedStart, viewStart, viewEnd, canvasWidth);
        const x2 = genomicToPixel(clippedEnd + 1, viewStart, viewEnd, canvasWidth);
        const w = Math.max(1, x2 - x1);

        const div = data.mcols.divergence_pct?.[i] as number | null;
        ctx.globalAlpha = divergenceToAlpha(div);
        ctx.fillStyle = color;
        ctx.fillRect(x1, y, w, rowHeight);

        bars.push({ x: x1, y, w, h: rowHeight, i });
      }

      // Row label
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = COLOR.canvas.axisLabel;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(cls, 4, y + rowHeight / 2);
    }

    ctx.globalAlpha = 1.0;
    barsRef.current = bars;

  }, [data, viewStart, viewEnd, canvasWidth, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hit: { x: number; y: number; w: number; h: number; i: number } | null = null;

    for (const bar of barsRef.current) {
      if (mx >= bar.x && mx <= bar.x + bar.w && my >= bar.y && my <= bar.y + bar.h) {
        hit = bar;
        break;
      }
    }

    if (hit) {
      setTooltip({ x: hit.x + hit.w / 2, y: hit.y, i: hit.i });
    } else {
      setTooltip(null);
    }
  };

  const tooltipRows = tooltip && data ? (() => {
    const i = tooltip.i;
    const repeatName = data.mcols.repeat_name?.[i] as string | null;
    const repeatClass = data.mcols.repeat_class?.[i] as string | null;
    const repeatFamily = data.mcols.repeat_family?.[i] as string | null;
    const divergencePct = data.mcols.divergence_pct?.[i] as number | null;
    const repeatAge = data.mcols.repeat_age?.[i] as string | number | null;
    const isActive = data.mcols.is_active?.[i] as boolean | null;

    const rows: { label: string; value: string }[] = [];
    if (repeatName) rows.push({ label: 'Name', value: repeatName });
    if (repeatClass) rows.push({ label: 'Class', value: repeatClass });
    if (repeatFamily) rows.push({ label: 'Family', value: repeatFamily });
    if (divergencePct != null) rows.push({ label: 'Div %', value: divergencePct.toFixed(1) + '%' });
    if (repeatAge != null) rows.push({ label: 'Age', value: String(repeatAge) });
    if (isActive != null) rows.push({ label: 'Active', value: isActive ? 'yes' : 'no' });

    return rows;
  })() : null;

  return (
    <div style={{ position: 'relative' }} onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} className="block" />
      {tooltip && tooltipRows && tooltipRows.length > 0 && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x, canvasWidth - 310),
          top: tooltip.y - 8,
          transform: 'translateY(-100%)',
          backgroundColor: '#1a1a1a',
          border: '1px solid #444',
          padding: '6px 10px',
          maxWidth: 340,
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
              <span style={{ color: '#777', flexShrink: 0, width: 48, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
