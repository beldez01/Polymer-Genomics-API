'use client';

import { useRef, useEffect, useState } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLOR } from '@/config/theme';
import { drawGridlines } from '@/lib/gridlines';

// Named colors for common cell types; others get hash-assigned
const NAMED_COLORS: Record<string, string> = {
  GM12878: '#3b82f6', // blue
  K562:    '#f59e0b', // amber
  HUES64:  '#10b981', // emerald
  'IMR-90': '#f472b6', // pink
  HepG2:   '#a78bfa', // violet
  HCT116:  '#fb923c', // orange
};

// 20-color palette for deterministic assignment
const PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#f472b6', '#a78bfa',
  '#fb923c', '#06b6d4', '#ef4444', '#84cc16', '#8b5cf6',
  '#14b8a6', '#f97316', '#6366f1', '#22c55e', '#e879f9',
  '#0ea5e9', '#eab308', '#ec4899', '#64748b', '#d946ef',
];

function cellColor(ct: string): string {
  if (NAMED_COLORS[ct]) return NAMED_COLORS[ct];
  // Deterministic hash to palette index
  let hash = 0;
  for (let i = 0; i < ct.length; i++) hash = ((hash << 5) - hash + ct.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function scoreToAlpha(score: number | null | undefined, minScore: number, maxScore: number): number {
  if (score == null || maxScore <= minScore) return 0.5;
  const norm = (score - minScore) / (maxScore - minScore);
  return 0.25 + Math.min(norm, 1) * 0.55;
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
  visibleCellTypes?: string[];
}

export function TadDomainTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 50,
  visibleCellTypes,
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

    // Determine which cell types are present and visible
    const cellTypes = (data.mcols.cell_type as string[]) ?? [];
    const uniqueCellTypes = [...new Set(cellTypes)].sort();
    const activeCells = visibleCellTypes
      ? uniqueCellTypes.filter(ct => visibleCellTypes.includes(ct))
      : uniqueCellTypes;

    if (activeCells.length === 0) {
      ctx.fillStyle = COLOR.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No TAD domains in view', canvasWidth / 2, height / 2 + 4);
      barsRef.current = bars;
      return;
    }

    // Compute score range across all visible domains
    const scores = (data.mcols.corner_score as (number | null)[]) ?? [];
    const validScores = scores.filter((s, i): s is number =>
      s != null && activeCells.includes(cellTypes[i])
    );
    const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
    const maxScore = validScores.length > 0 ? Math.max(...validScores) : 1;

    // Allocate vertical lanes per cell type
    const padding = 2;
    const laneGap = 1;
    const totalGap = (activeCells.length - 1) * laneGap;
    const laneHeight = Math.max(8, (height - 2 * padding - totalGap) / activeCells.length);
    const cellLaneY = new Map<string, number>();
    activeCells.forEach((ct, idx) => {
      cellLaneY.set(ct, padding + idx * (laneHeight + laneGap));
    });

    // Sort by size (largest first) so smaller domains render on top
    const indices = Array.from({ length: data.n }, (_, i) => i);
    indices.sort((a, b) => {
      const sizeA = data.ranges.end[a] - data.ranges.start[a];
      const sizeB = data.ranges.end[b] - data.ranges.start[b];
      return sizeB - sizeA;
    });

    for (const i of indices) {
      const ct = cellTypes[i];
      if (!activeCells.includes(ct)) continue;

      const start = data.ranges.start[i];
      const end = data.ranges.end[i];
      if (end < viewStart || start > viewEnd) continue;

      const x1 = genomicToPixel(Math.max(start, viewStart), viewStart, viewEnd, canvasWidth);
      const x2 = genomicToPixel(Math.min(end, viewEnd), viewStart, viewEnd, canvasWidth);
      const w = Math.max(x2 - x1, 2);

      const laneY = cellLaneY.get(ct) ?? padding;
      const color = cellColor(ct);
      const alpha = scoreToAlpha(scores[i], minScore, maxScore);

      // Domain fill
      ctx.fillStyle = hexWithAlpha(color, alpha * 0.4);
      ctx.fillRect(x1, laneY, w, laneHeight);

      // Boundary lines
      ctx.strokeStyle = hexWithAlpha(color, alpha);
      ctx.lineWidth = 1.5;

      if (start >= viewStart) {
        ctx.beginPath();
        ctx.moveTo(x1, laneY);
        ctx.lineTo(x1, laneY + laneHeight);
        ctx.stroke();
      }
      if (end <= viewEnd) {
        ctx.beginPath();
        ctx.moveTo(x1 + w, laneY);
        ctx.lineTo(x1 + w, laneY + laneHeight);
        ctx.stroke();
      }

      bars.push({ x: x1, y: laneY, w, h: laneHeight, i });
    }

    barsRef.current = bars;
  }, [data, viewStart, viewEnd, canvasWidth, height, visibleCellTypes]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

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
              <span style={{ color: '#777', flexShrink: 0, width: 56, textAlign: 'right' }}>{row.label}</span>
              <span style={{ color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
