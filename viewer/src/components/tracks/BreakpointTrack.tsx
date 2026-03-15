'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

const TYPE_COLORS: Record<string, string> = {
  fragile_site:   COLOR.breakpoint.fragile_site,
  translocation:  COLOR.breakpoint.translocation,
  constitutional: COLOR.breakpoint.constitutional,
};

function breakpointColor(bpType: string | null | undefined): string {
  if (!bpType) return '#6b7280';
  return TYPE_COLORS[bpType] ?? '#6b7280';
}

export interface BreakpointTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

export function BreakpointTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 40,
}: BreakpointTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef<{ x: number; y: number; i: number }[]>([]);
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

    const markers: { x: number; y: number; i: number }[] = [];

    if (!data || data.n === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No breakpoints in view', canvasWidth / 2, height / 2 + 4);
      markersRef.current = markers;
      return;
    }

    const markerTop = 6;
    const markerSize = 7; // half-width and height of the inverted triangle
    const labelZone = height - 12;

    // Draw inverted triangular markers at each breakpoint position
    for (let i = 0; i < data.n; i++) {
      const pos = data.ranges.start[i];
      if (pos < viewStart || pos > viewEnd) continue;

      const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
      const bpType = data.mcols.breakpoint_type?.[i] as string | null;
      const color = breakpointColor(bpType);

      // Stem line from triangle tip down to label zone
      ctx.strokeStyle = COLOR.gwas.stem;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, markerTop + markerSize);
      ctx.lineTo(x, labelZone - 2);
      ctx.stroke();

      // Inverted triangle: flat top, point at bottom
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - markerSize, markerTop);
      ctx.lineTo(x + markerSize, markerTop);
      ctx.lineTo(x, markerTop + markerSize);
      ctx.closePath();
      ctx.fill();

      markers.push({ x, y: markerTop + markerSize / 2, i });
    }

    // Labels for breakpoints (name or gene_a)
    if (canvasWidth >= 200) {
      type LabeledBP = { x: number; label: string };
      const labeled: LabeledBP[] = [];

      for (let i = 0; i < data.n; i++) {
        const pos = data.ranges.start[i];
        if (pos < viewStart || pos > viewEnd) continue;

        const name = data.mcols.name?.[i] as string | null;
        const geneA = data.mcols.gene_a?.[i] as string | null;
        const label = name || geneA || '';
        if (!label) continue;

        const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
        labeled.push({ x, label });
      }

      const placed: number[] = [];
      const minGap = 50;

      ctx.fillStyle = COLOR.text.muted;
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (const bp of labeled) {
        if (placed.length >= 10) break;
        if (placed.some(px => Math.abs(px - bp.x) < minGap)) continue;
        placed.push(bp.x);
        ctx.fillText(bp.label, bp.x, labelZone);
      }
    }

    markersRef.current = markers;
  }, [data, viewStart, viewEnd, canvasWidth, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const THRESHOLD = 10;

    let closest: { x: number; y: number; i: number } | null = null;
    let closestDist = THRESHOLD;

    for (const marker of markersRef.current) {
      const dist = Math.sqrt((mx - marker.x) ** 2 + (my - marker.y) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = marker;
      }
    }

    setTooltip(closest);
  };

  const tooltipRows = tooltip && data ? (() => {
    const i = tooltip.i;
    const bpType = data.mcols.breakpoint_type?.[i] as string | null;
    const name = data.mcols.name?.[i] as string | null;
    const geneA = data.mcols.gene_a?.[i] as string | null;
    const geneB = data.mcols.gene_b?.[i] as string | null;
    const source = data.mcols.source?.[i] as string | null;
    const start = data.ranges.start[i];
    const end = data.ranges.end[i];
    const chr = data.seqnames[i];

    const rows: { label: string; value: string }[] = [];
    if (bpType) rows.push({ label: 'Type', value: bpType.replace(/_/g, ' ') });
    if (name) rows.push({ label: 'Name', value: name });
    if (geneA) rows.push({ label: 'Gene A', value: geneA });
    if (geneB) rows.push({ label: 'Gene B', value: geneB });
    if (source) rows.push({ label: 'Source', value: source });
    rows.push({ label: 'Position', value: `${chr}:${start.toLocaleString()}${end !== start ? '-' + end.toLocaleString() : ''}` });

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
              <span style={{ color: '#777', flexShrink: 0, width: 48, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
