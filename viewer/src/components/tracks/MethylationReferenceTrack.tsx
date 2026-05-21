'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';

// Six hematopoietic cell types — ordered as displayed top-to-bottom
const CELL_TYPES = [
  { key: 'Gran',  label: 'Gran',  color: '#f59e0b' },
  { key: 'Mono',  label: 'Mono',  color: '#fb923c' },
  { key: 'NK',    label: 'NK',    color: '#a78bfa' },
  { key: 'Bcell', label: 'B',     color: '#60a5fa' },
  { key: 'CD4T',  label: 'CD4T',  color: '#34d399' },
  { key: 'CD8T',  label: 'CD8T',  color: '#4ade80' },
] as const;

const N_CELLS = CELL_TYPES.length;

// Beta=0 → blue (hypomethylated), Beta=0.5 → near-white, Beta=1 → red (hypermethylated)
function betaToColor(beta: number | null | undefined): string {
  if (beta == null || isNaN(beta)) return '#A1A1AA';
  const t = Math.max(0, Math.min(1, beta));
  // Blue (#1e40af) → white (#e8e8e8) → Red (#b91c1c)
  if (t <= 0.5) {
    const s = t * 2;
    const r = Math.round(30  + s * (232 - 30));
    const g = Math.round(64  + s * (232 - 64));
    const b = Math.round(175 + s * (232 - 175));
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) * 2;
    const r = Math.round(232 + s * (185 - 232));
    const g = Math.round(232 + s * (28  - 232));
    const b = Math.round(232 + s * (28  - 232));
    return `rgb(${r},${g},${b})`;
  }
}

export interface MethylationReferenceTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
  visibleCellTypes?: string[];
  /** When true, skip rendering cell type labels on canvas (label column handles them) */
  hideLabels?: boolean;
}

export function MethylationReferenceTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height = 80,
  visibleCellTypes,
  hideLabels = false,
}: MethylationReferenceTrackProps) {
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
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No methylation reference in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    // Filter to visible cell types
    const activeCells = visibleCellTypes
      ? CELL_TYPES.filter((ct) => visibleCellTypes.includes(ct.key))
      : CELL_TYPES;
    const nVisible = activeCells.length;
    if (nVisible === 0) return;

    const rowH = height / nVisible;
    const viewWidth = viewEnd - viewStart + 1;
    const bpPerPixel = viewWidth / canvasWidth;

    // Draw cell-type label strip on the left (first 32px)
    const LABEL_W = 32;

    for (let ci = 0; ci < nVisible; ci++) {
      const ct = activeCells[ci];
      const y = ci * rowH;

      // Row background
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(0, y, canvasWidth, rowH);

      // Cell type label (only when labels aren't handled by the label column)
      if (!hideLabels) {
        ctx.fillStyle = ct.color;
        ctx.font = `bold 8px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(ct.label, 2, y + rowH / 2);
      }
    }

    // Draw probe marks
    for (let i = 0; i < data.n; i++) {
      const pos = data.ranges.start[i];
      if (pos < viewStart || pos > viewEnd) continue;

      const x = genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
      const markW = Math.max(1, Math.min(8, 1 / bpPerPixel));

      for (let ci = 0; ci < nVisible; ci++) {
        const ct = activeCells[ci];
        const beta = (data.mcols as Record<string, unknown[]>)[ct.key.toLowerCase()]?.[i] as number | undefined
               ?? (data.mcols as Record<string, unknown[]>)[ct.key]?.[i] as number | undefined;
        const color = betaToColor(beta);
        const y = ci * rowH;

        ctx.fillStyle = color;
        ctx.fillRect(x - markW / 2, y + 1, markW, rowH - 2);
      }

      // Probe ID label at fine zoom
      if (bpPerPixel < 0.5) {
        const probeId = data.mcols.probe_id?.[i] as string | null;
        if (probeId) {
          ctx.fillStyle = COLORS.canvas.featureLabel;
          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(probeId, x, height - 1);
        }
      }
    }

    // Row dividers
    ctx.strokeStyle = '#D4D4D8';
    ctx.lineWidth = 0.5;
    for (let ci = 1; ci < nVisible; ci++) {
      const y = ci * rowH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

  }, [data, viewStart, viewEnd, canvasWidth, height, visibleCellTypes, hideLabels]);

  return <canvas ref={canvasRef} className="block" />;
}
