'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { COLOR, FONT_FAMILY } from '@/config/theme';
import { useTransposome } from '@/stores/transposome';
import { Y_AXIS_OPTIONS, SILENCING_COLORS } from '@/lib/transposome-types';
import type { TEFamily, Lens, YAxis } from '@/lib/transposome-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LandscapeCanvasProps {
  families: TEFamily[];      // pre-filtered by parent
  allFamilies: TEFamily[];   // full set (filtered = 1.0, not filtered = 0.05)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PADDING = { top: 30, right: 20, bottom: 40, left: 50 };
const MIN_DIV = 1.0;
const MAX_DIV = 30.0;
const LOG_MIN = Math.log10(MIN_DIV);
const LOG_MAX = Math.log10(MAX_DIV);
const LOG_RANGE = LOG_MAX - LOG_MIN;

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16),
    ag = parseInt(a.slice(3, 5), 16),
    ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16),
    bg = parseInt(b.slice(3, 5), 16),
    bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Color per lens
// ---------------------------------------------------------------------------

function getFamilyColor(
  f: TEFamily,
  lens: Lens,
  yAxis: YAxis,
  yMin: number,
  yMax: number,
): { fill: string; alpha: number } {
  switch (lens) {
    case 'silencing':
      return {
        fill: SILENCING_COLORS[f.silencing_primary],
        alpha: 0.85 * f.silencing_confidence + 0.15,
      };
    case 'evolution': {
      const t = Math.min(f.divergence_pct / 25, 1);
      return { fill: lerpColor('#4ECDC4', '#555555', t), alpha: 0.7 };
    }
    case 'material': {
      const yRange = yMax - yMin || 1;
      const t = (f[yAxis] - yMin) / yRange;
      return { fill: lerpColor('#4ECDC4', '#F0A500', t), alpha: 0.7 };
    }
    case 'reactivation': {
      const s = f.reactivation_score;
      if (s < 0.3)
        return { fill: lerpColor('#555555', '#F0A500', s / 0.3), alpha: 0.5 + s };
      return {
        fill: lerpColor('#F0A500', '#F43F5E', (s - 0.3) / 0.7),
        alpha: 0.5 + s * 0.5,
      };
    }
    default:
      return { fill: '#555555', alpha: 0.5 };
  }
}

// ---------------------------------------------------------------------------
// Contour atmosphere
// ---------------------------------------------------------------------------

function drawContours(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Young methylation cluster (teal, upper-left)
  const g1 = ctx.createRadialGradient(w * 0.15, h * 0.3, 0, w * 0.15, h * 0.3, w * 0.25);
  g1.addColorStop(0, 'rgba(78, 205, 196, 0.06)');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // Polycomb region (violet, center)
  const g2 = ctx.createRadialGradient(w * 0.55, h * 0.5, 0, w * 0.55, h * 0.5, w * 0.2);
  g2.addColorStop(0, 'rgba(139, 92, 246, 0.04)');
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  // Reactivation hot zone (rose, upper-left corner)
  const g3 = ctx.createRadialGradient(w * 0.08, h * 0.2, 0, w * 0.08, h * 0.2, w * 0.12);
  g3.addColorStop(0, 'rgba(244, 63, 94, 0.05)');
  g3.addColorStop(1, 'transparent');
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, w, h);

  // Amber region (intermediate H3K9me3)
  const g4 = ctx.createRadialGradient(w * 0.35, h * 0.4, 0, w * 0.35, h * 0.4, w * 0.18);
  g4.addColorStop(0, 'rgba(240, 165, 0, 0.04)');
  g4.addColorStop(1, 'transparent');
  ctx.fillStyle = g4;
  ctx.fillRect(0, 0, w, h);

  // Subtle contour ellipses
  ctx.strokeStyle = 'rgba(78, 205, 196, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(w * 0.15, h * 0.3, w * 0.15, h * 0.12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w * 0.15, h * 0.3, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Legend configuration per lens
// ---------------------------------------------------------------------------

interface LegendItem {
  color: string;
  label: string;
  dashed?: boolean;
}

function getLegendConfig(lens: Lens): { title: string; items: LegendItem[] } {
  switch (lens) {
    case 'silencing':
      return {
        title: 'Silencing Mechanism',
        items: [
          { color: '#4ECDC4', label: 'Methylation' },
          { color: '#F0A500', label: 'H3K9me3' },
          { color: '#8B5CF6', label: 'Polycomb' },
          { color: '#F43F5E', label: 'Mixed' },
          { color: '#555555', label: 'Fossilized' },
        ],
      };
    case 'evolution':
      return {
        title: 'Evolutionary Age',
        items: [
          { color: '#4ECDC4', label: 'Young' },
          { color: '#555555', label: 'Ancient' },
        ],
      };
    case 'material':
      return {
        title: 'Material Property',
        items: [
          { color: '#4ECDC4', label: 'Low' },
          { color: '#F0A500', label: 'High' },
        ],
      };
    case 'reactivation':
      return {
        title: 'Reactivation Risk',
        items: [
          { color: '#555555', label: 'Stable' },
          { color: '#F0A500', label: 'Moderate' },
          { color: '#F43F5E', label: 'High Risk' },
        ],
      };
    default:
      return { title: 'Lens', items: [] };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LandscapeCanvas({ families, allFamilies }: LandscapeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const activeLens = useTransposome((s) => s.activeLens);
  const yAxis = useTransposome((s) => s.yAxis);
  const selectedFamilyId = useTransposome((s) => s.selectedFamilyId);
  const setSelectedFamilyId = useTransposome((s) => s.setSelectedFamilyId);

  const { width, height } = dims;

  // --- ResizeObserver ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        const h = Math.floor(e.contentRect.height);
        if (w > 0 && h > 0) setDims({ width: w, height: h });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // --- Y-axis range ---
  const { yMin, yMax } = useMemo(() => {
    if (allFamilies.length === 0) return { yMin: 0, yMax: 1 };
    const vals = allFamilies.map((f) => f[yAxis]);
    return { yMin: Math.min(...vals), yMax: Math.max(...vals) };
  }, [allFamilies, yAxis]);

  // --- Position map ---
  const positions = useMemo(() => {
    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    const maxBp = allFamilies.length > 0 ? Math.max(...allFamilies.map((f) => f.total_bp)) : 1;
    const yRange = yMax - yMin || 1;

    const map = new Map<string, { x: number; y: number; r: number }>();
    for (const f of allFamilies) {
      const logDiv = Math.log10(Math.max(f.divergence_pct, MIN_DIV));
      const x = PADDING.left + ((logDiv - LOG_MIN) / LOG_RANGE) * plotWidth;

      const yVal = f[yAxis];
      const y = PADDING.top + plotHeight - ((yVal - yMin) / yRange) * plotHeight;

      const r = Math.max(4, Math.sqrt(f.total_bp / maxBp) * 28);
      map.set(f.id, { x, y, r });
    }
    return map;
  }, [allFamilies, yAxis, yMin, yMax, width, height]);

  // --- Legend config ---
  const legend = useMemo(() => getLegendConfig(activeLens), [activeLens]);

  // --- Draw ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;

    // 1. Clear
    ctx.fillStyle = COLOR.bg.primary;
    ctx.fillRect(0, 0, width, height);

    // 2. Contour atmosphere
    drawContours(ctx, width, height);

    // 3. Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(PADDING.left, PADDING.top + plotHeight * frac);
      ctx.lineTo(width - PADDING.right, PADDING.top + plotHeight * frac);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING.left + plotWidth * frac, PADDING.top);
      ctx.lineTo(PADDING.left + plotWidth * frac, height - PADDING.bottom);
      ctx.stroke();
    }

    // 4. Bubbles (largest first = behind)
    const filteredIds = new Set(families.map((f) => f.id));
    const sorted = [...allFamilies].sort((a, b) => b.total_bp - a.total_bp);

    for (const f of sorted) {
      const pos = positions.get(f.id);
      if (!pos) continue;

      const inFilter = filteredIds.has(f.id);
      const isSelected = f.id === selectedFamilyId;
      const isHovered = f.id === hoveredId;

      const { fill, alpha } = getFamilyColor(f, activeLens, yAxis, yMin, yMax);
      const displayAlpha = inFilter ? alpha : 0.05;
      const displayRadius = isSelected || isHovered ? pos.r * 1.15 : pos.r;

      ctx.save();

      // Glow for reactivation-prone families
      if (f.reactivation_score > 0.5 && inFilter) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = fill;
      }

      // Fill
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, displayRadius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(fill, displayAlpha * 0.4);
      ctx.fill();

      // Halo ring
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeStyle = hexToRgba(fill, displayAlpha);
      if (f.silencing_primary === 'mixed') {
        ctx.setLineDash([4, 3]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Selected highlight
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, displayRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(fill, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Labels for large families in filter
    ctx.font = `8px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'left';
    for (const f of allFamilies) {
      const pos = positions.get(f.id);
      if (!pos || pos.r < 12 || !filteredIds.has(f.id)) continue;
      ctx.fillText(f.display_name, pos.x + pos.r + 4, pos.y + 3);
    }

    // 6. Axis labels
    ctx.fillStyle = COLOR.text.faint;
    ctx.font = `9px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('EVOLUTIONARY AGE', width / 2, height - 6);

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    const yLabel = Y_AXIS_OPTIONS.find((o) => o.value === yAxis)?.label ?? '';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // 7. Axis ticks
    ctx.fillStyle = COLOR.text.faint;
    ctx.font = `8px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    for (const { label, frac } of [
      { label: '~5 Mya', frac: 0.15 },
      { label: '~15 Mya', frac: 0.45 },
      { label: '~50 Mya', frac: 0.7 },
      { label: '~150 Mya', frac: 0.9 },
    ]) {
      ctx.fillText(label, PADDING.left + plotWidth * frac, height - PADDING.bottom + 14);
    }

    // 8. Tooltip
    if (hoveredId && mousePos) {
      const f = allFamilies.find((fam) => fam.id === hoveredId);
      if (f) {
        const lines = [
          f.display_name,
          `${f.class} \u00b7 ${f.copy_count.toLocaleString()} copies`,
          `Silencing: ${f.silencing_primary}`,
          `${Y_AXIS_OPTIONS.find((o) => o.value === yAxis)?.label ?? yAxis}: ${f[yAxis].toFixed(2)}`,
        ];

        const padding = 8;
        const lineHeight = 14;
        const boxWidth = 190;
        const boxHeight = lines.length * lineHeight + padding * 2;
        let tx = mousePos.x + 12;
        let ty = mousePos.y - boxHeight - 4;
        if (tx + boxWidth > width) tx = mousePos.x - boxWidth - 12;
        if (ty < 0) ty = mousePos.y + 12;

        ctx.fillStyle = 'rgba(13, 13, 13, 0.92)';
        ctx.strokeStyle = COLOR.border.default;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tx, ty, boxWidth, boxHeight, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = COLOR.text.primary;
        ctx.font = `bold 10px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(lines[0], tx + padding, ty + padding + 10);

        ctx.fillStyle = COLOR.text.tertiary;
        ctx.font = `9px ${FONT_FAMILY}`;
        for (let i = 1; i < lines.length; i++) {
          ctx.fillText(lines[i], tx + padding, ty + padding + 10 + i * lineHeight);
        }
      }
    }
  }, [
    width,
    height,
    families,
    allFamilies,
    positions,
    activeLens,
    yAxis,
    yMin,
    yMax,
    selectedFamilyId,
    hoveredId,
    mousePos,
  ]);

  // --- Hit testing ---
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setMousePos({ x: mx, y: my });

      // Iterate smallest-first for priority
      const sortedSmallFirst = [...allFamilies].sort((a, b) => a.total_bp - b.total_bp);
      let found: string | null = null;
      for (const f of sortedSmallFirst) {
        const pos = positions.get(f.id);
        if (!pos) continue;
        const dx = mx - pos.x;
        const dy = my - pos.y;
        if (dx * dx + dy * dy <= pos.r * pos.r) {
          found = f.id;
          break;
        }
      }
      setHoveredId(found);
    },
    [allFamilies, positions],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setMousePos(null);
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredId) {
      setSelectedFamilyId(hoveredId);
    } else {
      setSelectedFamilyId(null);
    }
  }, [hoveredId, setSelectedFamilyId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: hoveredId ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(10,10,10,0.85)',
          border: `1px solid ${COLOR.border.default}`,
          padding: '10px 12px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: 8,
            color: COLOR.text.faint,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 6,
            fontFamily: FONT_FAMILY,
          }}
        >
          {legend.title}
        </div>
        {legend.items.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 3,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: hexToRgba(item.color, 0.4),
                border: `1.5px ${item.dashed ? 'dashed' : 'solid'} ${item.color}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 8,
                color: COLOR.text.tertiary,
                fontFamily: FONT_FAMILY,
              }}
            >
              {item.label}
            </span>
          </div>
        ))}

        {/* Halo section */}
        <div
          style={{
            borderTop: `1px solid ${COLOR.border.subtle}`,
            marginTop: 6,
            paddingTop: 6,
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: COLOR.text.faint,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 4,
              fontFamily: FONT_FAMILY,
            }}
          >
            Ring Style
          </div>
          {[
            { label: 'Stable', style: 'solid' },
            { label: 'Mixed', style: 'dashed' },
            { label: 'Inducible', style: 'glow' },
          ].map((h) => (
            <div
              key={h.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor:
                    h.style === 'glow' ? 'rgba(78,205,196,0.3)' : 'transparent',
                  border: `1.5px ${h.style === 'dashed' ? 'dashed' : 'solid'} ${COLOR.text.muted}`,
                  boxShadow:
                    h.style === 'glow' ? `0 0 4px ${COLOR.accent.teal}` : 'none',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  color: COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY,
                }}
              >
                {h.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
