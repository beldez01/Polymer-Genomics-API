'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { COLOR, TYPE, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import type { DMPRow, ThresholdState } from '@/lib/dmp/types';
import { renderManhattan, manhattanToSVG } from '@/lib/dmp/manhattan-renderer';
import type { QuadTree } from '@/lib/dmp/quadtree';

interface ManhattanPlotProps {
  rows: DMPRow[];
  thresholds: ThresholdState;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onHoverIndex: (index: number | null) => void;
  hoveredIndex: number | null;
}

export function ManhattanPlot({
  rows,
  thresholds,
  selectedIndex,
  onSelectIndex,
  onHoverIndex,
  hoveredIndex,
}: ManhattanPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quadtreeRef = useRef<QuadTree | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const [tooltipInfo, setTooltipInfo] = useState<{ x: number; y: number; row: DMPRow } | null>(null);
  const [svgHover, setSvgHover] = useState(false);
  const [pngHover, setPngHover] = useState(false);

  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Filter to rows with genomic coordinates
  const genomicRows = rows.filter(r => r.chr && r.pos != null);
  const hasCoords = genomicRows.length > 0;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !hasCoords) return;

    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    sizeRef.current = { w, h };

    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const result = renderManhattan(ctx, w, h, rows, thresholds, selectedIndex, hoveredIndex);
    quadtreeRef.current = result.quadtree;
  }, [rows, thresholds, selectedIndex, hoveredIndex, DPR, hasCoords]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const findPointAt = useCallback((clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    const qt = quadtreeRef.current;
    if (!canvas || !qt) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const nearby = qt.queryRadius(x, y, 8);
    if (nearby.length === 0) return null;

    // Find closest
    let minDist = Infinity;
    let closest = nearby[0];
    for (const p of nearby) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    return closest.index;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const idx = findPointAt(e.clientX, e.clientY);
    onHoverIndex(idx);

    if (idx !== null) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setTooltipInfo({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          row: rows[idx],
        });
      }
    } else {
      setTooltipInfo(null);
    }
  }, [findPointAt, onHoverIndex, rows]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const idx = findPointAt(e.clientX, e.clientY);
    if (idx !== null) {
      const row = rows[idx];
      if (row.chr && row.pos != null) {
        const start = Math.max(0, row.pos - 5000);
        const end = row.pos + 5000;
        window.open(`/view/hg38/${row.chr}:${start}-${end}`, '_blank');
      }
    }
    onSelectIndex(idx);
  }, [findPointAt, onSelectIndex, rows]);

  const handleMouseLeave = useCallback(() => {
    onHoverIndex(null);
    setTooltipInfo(null);
  }, [onHoverIndex]);

  const handleExportSVG = useCallback(() => {
    const { w, h } = sizeRef.current;
    const svg = manhattanToSVG(w || 800, h || 500, rows, thresholds);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manhattan_plot.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, thresholds]);

  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manhattan_plot.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Export buttons */}
      <div style={{
        display: 'flex',
        gap: SPACE[2],
        justifyContent: 'flex-end',
        padding: `${SPACE[1]}px ${SPACE[2]}px`,
      }}>
        <button
          onClick={handleExportSVG}
          onMouseEnter={() => setSvgHover(true)}
          onMouseLeave={() => setSvgHover(false)}
          style={{
            ...COMPONENT.button.small,
            ...(svgHover ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : {}),
          }}
        >
          SVG
        </button>
        <button
          onClick={handleExportPNG}
          onMouseEnter={() => setPngHover(true)}
          onMouseLeave={() => setPngHover(false)}
          style={{
            ...COMPONENT.button.small,
            ...(pngHover ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : {}),
          }}
        >
          PNG
        </button>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          minHeight: 300,
          overflow: 'hidden',
          backgroundColor: COLOR.canvas.background,
          border: `1px solid ${COLOR.border.subtle}`,
        }}
      >
        {hasCoords && (
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: hoveredIndex !== null ? 'pointer' : 'crosshair',
            }}
          />
        )}

        {/* Tooltip */}
        {tooltipInfo && (
          <div style={{
            position: 'absolute',
            left: tooltipInfo.x + 12,
            top: tooltipInfo.y - 8,
            backgroundColor: COLOR.bg.surface,
            border: `1px solid ${COLOR.border.strong}`,
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: 320,
          }}>
            <div style={{
              color: COLOR.text.primary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: 500,
              marginBottom: 2,
            }}>
              {tooltipInfo.row.probe_id}
            </div>
            {tooltipInfo.row.gene_symbol && (
              <div style={{
                color: COLOR.accent.teal,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                marginBottom: 2,
              }}>
                {tooltipInfo.row.gene_symbol}
              </div>
            )}
            <div style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {'\u0394\u03B2'} = {tooltipInfo.row.delta_beta.toFixed(4)}
              {' | '}
              p = {tooltipInfo.row.p_value.toExponential(2)}
              {' | '}
              adj.p = {tooltipInfo.row.adj_p_value.toExponential(2)}
            </div>
            {tooltipInfo.row.chr && tooltipInfo.row.pos != null && (
              <div style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                marginTop: 2,
              }}>
                {tooltipInfo.row.chr}:{tooltipInfo.row.pos.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Empty state — no genomic coordinates */}
        {!hasCoords && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLOR.canvas.emptyText,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            No genomic coordinates available
          </div>
        )}
      </div>
    </div>
  );
}
