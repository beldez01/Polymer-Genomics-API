'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

const SUBFAMILY_COLORS: Record<string, string> = {
  'HERV-K': COLOR.herv['HERV-K'],
  'HERV-H': COLOR.herv['HERV-H'],
  'HERV-W': COLOR.herv['HERV-W'],
  'HERV-E': COLOR.herv['HERV-E'],
  'HERV-L': COLOR.herv['HERV-L'],
  Other:    COLOR.herv.Other,
};

const SUBFAMILY_ORDER = ['HERV-K', 'HERV-H', 'HERV-W', 'HERV-E', 'HERV-L', 'Other'];

function subfamilyColor(subfamily: string | null | undefined): string {
  if (!subfamily) return SUBFAMILY_COLORS.Other;
  return SUBFAMILY_COLORS[subfamily] ?? SUBFAMILY_COLORS.Other;
}

/** Map n_fragments to opacity: 1 → 0.4, 5+ → 1.0 (linear interpolation). */
function fragmentsToOpacity(n: number | null | undefined): number {
  if (n == null || n <= 1) return 0.4;
  if (n >= 5) return 1.0;
  return 0.4 + ((n - 1) / 4) * 0.6;
}

export interface HervTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
  /** When true, skip rendering subfamily labels on canvas */
  hideLabels?: boolean;
}

export function HervTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 50,
  hideLabels = false,
}: HervTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rectsRef = useRef<{ x: number; y: number; w: number; h: number; i: number }[]>([]);
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

    const rects: { x: number; y: number; w: number; h: number; i: number }[] = [];

    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No HERV data in view', canvasWidth / 2, height / 2 + 4);
      rectsRef.current = rects;
      return;
    }

    // Group features by subfamily to stack rows
    const subfamilyIndices: Record<string, number[]> = {};
    for (let i = 0; i < data.n; i++) {
      const sf = (data.mcols.subfamily?.[i] as string) ?? 'Other';
      if (!subfamilyIndices[sf]) subfamilyIndices[sf] = [];
      subfamilyIndices[sf].push(i);
    }

    // Determine visible subfamilies in canonical order
    const visibleSubfamilies = SUBFAMILY_ORDER.filter(s => subfamilyIndices[s]?.length);
    // Add any subfamilies not in SUBFAMILY_ORDER
    for (const s of Object.keys(subfamilyIndices)) {
      if (!visibleSubfamilies.includes(s)) visibleSubfamilies.push(s);
    }

    if (visibleSubfamilies.length === 0) return;

    const rowHeight = Math.max(6, Math.min(10, (height - 4) / visibleSubfamilies.length));
    const gap = 1;

    for (let rowIdx = 0; rowIdx < visibleSubfamilies.length; rowIdx++) {
      const subfamily = visibleSubfamilies[rowIdx];
      const indices = subfamilyIndices[subfamily];
      if (!indices) continue;

      const y = 2 + rowIdx * (rowHeight + gap);
      const color = subfamilyColor(subfamily);

      for (const i of indices) {
        const rStart = data.ranges.start[i];
        const rEnd = data.ranges.end[i];

        if (rEnd < viewStart || rStart > viewEnd) continue;

        const clippedStart = Math.max(rStart, viewStart);
        const clippedEnd = Math.min(rEnd, viewEnd);

        const x1 = genomicToPixel(clippedStart, viewStart, viewEnd, canvasWidth);
        const x2 = genomicToPixel(clippedEnd + 1, viewStart, viewEnd, canvasWidth);
        const w = Math.max(1, x2 - x1);

        const nFragments = data.mcols.n_fragments?.[i] as number | null;
        ctx.globalAlpha = fragmentsToOpacity(nFragments);
        ctx.fillStyle = color;
        ctx.fillRect(x1, y, w, rowHeight);

        rects.push({ x: x1, y, w, h: rowHeight, i });
      }

      // Row label (only when labels aren't handled by the label column)
      if (!hideLabels) {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = COLOR.canvas.axisLabel;
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(subfamily, 4, y + rowHeight / 2);
      }
    }

    ctx.globalAlpha = 1.0;
    rectsRef.current = rects;
  }, [data, viewStart, viewEnd, canvasWidth, height, hideLabels]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let hit: { x: number; y: number; w: number; h: number; i: number } | null = null;
    for (const r of rectsRef.current) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        hit = r;
        break;
      }
    }

    setTooltip(hit ? { x: mx, y: hit.y, i: hit.i } : null);
  };

  const tooltipRows = tooltip && data ? (() => {
    const i = tooltip.i;
    const subfamily = data.mcols.subfamily?.[i] as string | null;
    const nFragments = data.mcols.n_fragments?.[i] as number | null;
    const locusLength = data.mcols.locus_length?.[i] as number | null;
    const start = data.ranges.start[i];
    const end = data.ranges.end[i];
    const chr = data.seqnames[i];

    const rows: { label: string; value: string }[] = [];
    if (subfamily) rows.push({ label: 'Subfamily', value: subfamily });
    if (nFragments != null) rows.push({ label: 'Fragments', value: String(nFragments) });
    if (locusLength != null) rows.push({ label: 'Locus len', value: locusLength.toLocaleString() + ' bp' });
    rows.push({ label: 'Position', value: `${chr}:${start.toLocaleString()}-${end.toLocaleString()}` });

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
          backgroundColor: '#FAFAFA',
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
              <span style={{ color: '#777', flexShrink: 0, width: 60, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
