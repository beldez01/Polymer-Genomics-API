'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { COLOR, FONT_FAMILY, WEIGHT } from '@/config/theme';
import { useTransposome } from '@/stores/transposome';
import type { TEFamily, TEClass, SilencingPrimary } from '@/lib/transposome-types';

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

const PADDING = { top: 40, right: 30, bottom: 50, left: 60 };
const MIN_DIV = 1.0;
const MAX_DIV = 30.0;
const LOG_MIN = Math.log10(MIN_DIV);
const LOG_MAX = Math.log10(MAX_DIV);
const LOG_RANGE = LOG_MAX - LOG_MIN;

// ---------------------------------------------------------------------------
// Class colors — from theme
// ---------------------------------------------------------------------------

const CLASS_COLORS: Record<TEClass, string> = {
  LINE: COLOR.repeat.LINE,   // #3b82f6 blue
  SINE: COLOR.repeat.SINE,   // #f59e0b amber
  LTR:  COLOR.repeat.LTR,    // #ef4444 red
  DNA:  COLOR.repeat.DNA,    // #22c55e green
  SVA:  '#a855f7',           // purple
  Other: COLOR.repeat.Other, // #555555
};

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Ring style per silencing mechanism
// ---------------------------------------------------------------------------

function applyRingStyle(
  ctx: CanvasRenderingContext2D,
  silencing: SilencingPrimary,
  color: string,
  alpha: number,
  isSelected: boolean,
) {
  ctx.lineWidth = isSelected ? 2.5 : 1.5;
  ctx.strokeStyle = hexToRgba(color, alpha);

  switch (silencing) {
    case 'methylation':
      ctx.setLineDash([]);
      break;
    case 'h3k9me3':
      ctx.setLineDash([5, 3]);
      break;
    case 'h3k27me3':
      ctx.setLineDash([2, 2]);
      break;
    case 'mixed':
      ctx.setLineDash([6, 2, 2, 2]);
      break;
    case 'none':
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = hexToRgba('#555555', alpha * 0.6);
      ctx.setLineDash([]);
      break;
  }
}

// ---------------------------------------------------------------------------
// Contour atmosphere (subtle background zones)
// ---------------------------------------------------------------------------

function drawContours(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Young methylation cluster (teal, left side)
  const g1 = ctx.createRadialGradient(w * 0.2, h * 0.35, 0, w * 0.2, h * 0.35, w * 0.2);
  g1.addColorStop(0, 'rgba(78, 205, 196, 0.04)');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  // Ancient fossilized region (gray, right side)
  const g2 = ctx.createRadialGradient(w * 0.8, h * 0.6, 0, w * 0.8, h * 0.6, w * 0.2);
  g2.addColorStop(0, 'rgba(100, 100, 100, 0.03)');
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
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
  const [showExplainer, setShowExplainer] = useState(false);
  const [glowPhase, setGlowPhase] = useState(0);

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

  // --- Glow animation ---
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setGlowPhase((p) => (p + 0.02) % (Math.PI * 2));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  // --- Y-axis range (CpG density only) ---
  const { yMin, yMax } = useMemo(() => {
    if (allFamilies.length === 0) return { yMin: 0, yMax: 1 };
    const vals = allFamilies.map((f) => f.cpg_density);
    return { yMin: Math.min(...vals), yMax: Math.max(...vals) };
  }, [allFamilies]);

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

      const y = PADDING.top + plotHeight - ((f.cpg_density - yMin) / yRange) * plotHeight;

      const r = Math.max(4, Math.sqrt(f.total_bp / maxBp) * 28);
      map.set(f.id, { x, y, r });
    }
    return map;
  }, [allFamilies, yMin, yMax, width, height]);

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
    const glowIntensity = 0.5 + 0.5 * Math.sin(glowPhase);

    for (const f of sorted) {
      const pos = positions.get(f.id);
      if (!pos) continue;

      const inFilter = filteredIds.has(f.id);
      const isSelected = f.id === selectedFamilyId;
      const isHovered = f.id === hoveredId;
      const classColor = CLASS_COLORS[f.class];

      const displayAlpha = inFilter ? 0.75 : 0.05;
      const displayRadius = isSelected || isHovered ? pos.r * 1.15 : pos.r;

      ctx.save();

      // Reactivation glow for high-risk families
      if (f.reactivation_score > 0.5 && inFilter) {
        const glowStrength = (f.reactivation_score - 0.5) * 2; // 0→1
        ctx.shadowBlur = 12 + 8 * glowIntensity * glowStrength;
        ctx.shadowColor = hexToRgba(
          f.reactivation_score > 0.7 ? '#F43F5E' : '#F0A500',
          0.4 + 0.3 * glowIntensity * glowStrength,
        );
      }

      // Fill
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, displayRadius, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(classColor, displayAlpha * 0.45);
      ctx.fill();

      // Ring — style varies by silencing mechanism
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      applyRingStyle(ctx, f.silencing_primary, classColor, displayAlpha, isSelected);
      ctx.stroke();
      ctx.setLineDash([]);

      // Selected highlight ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, displayRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(classColor, 0.3);
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

    // X-axis — "DIVERGENCE (%)" with underline hint for clickability
    const xLabelX = width / 2;
    const xLabelY = height - 8;
    ctx.fillText('DIVERGENCE (%)', xLabelX, xLabelY);
    // Subtle underline to hint clickability
    const labelWidth = ctx.measureText('DIVERGENCE (%)').width;
    ctx.strokeStyle = hexToRgba(COLOR.text.faint, 0.4);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(xLabelX - labelWidth / 2, xLabelY + 2);
    ctx.lineTo(xLabelX + labelWidth / 2, xLabelY + 2);
    ctx.stroke();

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.text.faint;
    ctx.fillText('CpG DENSITY (obs/exp)', 0, 0);
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

    // Y-axis ticks
    ctx.textAlign = 'right';
    const yRange = yMax - yMin || 1;
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const val = yMin + yRange * frac;
      const yPos = PADDING.top + plotHeight - plotHeight * frac;
      ctx.fillText(val.toFixed(2), PADDING.left - 6, yPos + 3);
    }

    // 8. Tooltip
    if (hoveredId && mousePos) {
      const f = allFamilies.find((fam) => fam.id === hoveredId);
      if (f) {
        const silencingLabel = {
          methylation: 'DNA Methylation',
          h3k9me3: 'H3K9me3',
          h3k27me3: 'Polycomb',
          mixed: 'Mixed',
          none: 'Fossilized',
        }[f.silencing_primary];

        const riskLabel = f.reactivation_score > 0.7
          ? 'High'
          : f.reactivation_score > 0.3
            ? 'Moderate'
            : 'Low';

        const lines = [
          f.display_name,
          `${f.class} · ${f.copy_count.toLocaleString()} copies`,
          `CpG density: ${f.cpg_density.toFixed(2)}`,
          `Silencing: ${silencingLabel}`,
          `Reactivation: ${riskLabel}`,
          `Divergence: ${f.divergence_pct.toFixed(1)}%`,
        ];

        const padding = 8;
        const lineHeight = 14;
        const boxWidth = 200;
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
    yMin,
    yMax,
    selectedFamilyId,
    hoveredId,
    mousePos,
    glowPhase,
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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Check if click is on the X-axis label area
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // X-axis label hit zone
      const labelX = width / 2;
      const labelY = height - 8;
      if (Math.abs(mx - labelX) < 60 && Math.abs(my - labelY) < 12) {
        setShowExplainer((v) => !v);
        return;
      }

      if (hoveredId) {
        setSelectedFamilyId(hoveredId);
      } else {
        setSelectedFamilyId(null);
        setShowExplainer(false);
      }
    },
    [hoveredId, setSelectedFamilyId, width, height],
  );

  // Dismiss explainer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExplainer(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

      {/* Unified Legend */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(10,10,10,0.88)',
          border: `1px solid ${COLOR.border.default}`,
          padding: '10px 12px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          zIndex: 10,
          minWidth: 130,
        }}
      >
        {/* TE Class */}
        <div style={{
          fontSize: 8, color: COLOR.text.faint, letterSpacing: '0.08em',
          textTransform: 'uppercase', marginBottom: 5, fontFamily: FONT_FAMILY,
        }}>
          TE Class
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginBottom: 8 }}>
          {(Object.entries(CLASS_COLORS) as [TEClass, string][]).map(([cls, color]) => (
            <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: hexToRgba(color, 0.45),
                border: `1.5px solid ${color}`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 8, color: COLOR.text.tertiary, fontFamily: FONT_FAMILY }}>
                {cls}
              </span>
            </div>
          ))}
        </div>

        {/* Silencing */}
        <div style={{ borderTop: `1px solid ${COLOR.border.subtle}`, paddingTop: 6, marginBottom: 5 }}>
          <div style={{
            fontSize: 8, color: COLOR.text.faint, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 4, fontFamily: FONT_FAMILY,
          }}>
            Silencing
          </div>
          {([
            { label: 'Methylation', dash: 'none' },
            { label: 'H3K9me3', dash: '5,3' },
            { label: 'Polycomb', dash: '2,2' },
            { label: 'Mixed', dash: '6,2,2,2' },
            { label: 'Fossilized', dash: 'none', faint: true },
          ] as const).map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <svg width={16} height={8} style={{ flexShrink: 0 }}>
                <line
                  x1={0} y1={4} x2={16} y2={4}
                  stroke={'faint' in item ? '#555' : COLOR.text.muted}
                  strokeWidth={1.5}
                  strokeDasharray={item.dash === 'none' ? undefined : item.dash}
                  opacity={'faint' in item ? 0.5 : 1}
                />
              </svg>
              <span style={{ fontSize: 8, color: COLOR.text.tertiary, fontFamily: FONT_FAMILY }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Reactivation */}
        <div style={{ borderTop: `1px solid ${COLOR.border.subtle}`, paddingTop: 6 }}>
          <div style={{
            fontSize: 8, color: COLOR.text.faint, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: 4, fontFamily: FONT_FAMILY,
          }}>
            Reactivation
          </div>
          {[
            { label: 'Low risk', color: COLOR.text.muted, glow: false },
            { label: 'High risk', color: '#F43F5E', glow: true },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: item.glow ? hexToRgba(item.color, 0.3) : 'transparent',
                border: `1.5px solid ${item.color}`,
                boxShadow: item.glow ? `0 0 4px ${item.color}` : 'none',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 8, color: COLOR.text.tertiary, fontFamily: FONT_FAMILY }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Divergence Explainer Popup */}
      {showExplainer && (
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(13, 13, 13, 0.95)',
            border: `1px solid ${COLOR.border.strong}`,
            padding: '14px 18px',
            maxWidth: 360,
            zIndex: 20,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: WEIGHT.bold, color: COLOR.accent.teal,
              letterSpacing: '0.06em', fontFamily: FONT_FAMILY, textTransform: 'uppercase',
            }}>
              Divergence (%)
            </span>
            <button
              onClick={() => setShowExplainer(false)}
              style={{
                background: 'transparent', border: 'none', color: COLOR.text.faint,
                fontSize: 14, cursor: 'pointer', padding: '0 2px', fontFamily: FONT_FAMILY,
              }}
            >
              &times;
            </button>
          </div>
          <div style={{
            fontSize: 10, color: COLOR.text.secondary, fontFamily: FONT_FAMILY,
            lineHeight: 1.6,
          }}>
            <p style={{ margin: '0 0 8px' }}>
              Percent substitution from the family consensus sequence (RepeatMasker).
            </p>
            <p style={{ margin: '0 0 8px' }}>
              Each TE family has a reconstructed consensus — the &ldquo;average&rdquo; of all
              extant copies. After insertion, copies accumulate neutral mutations.
              Higher divergence &asymp; older insertion.
            </p>
            <p style={{ margin: '0 0 8px', color: COLOR.text.tertiary, fontStyle: 'italic' }}>
              Caveat: the consensus is derived from the copies themselves
              (especially the most abundant/youngest), so the relationship
              is somewhat circular.
            </p>
            <div style={{
              borderTop: `1px solid ${COLOR.border.subtle}`, paddingTop: 6, marginTop: 6,
              fontSize: 9, color: COLOR.text.muted, fontFamily: FONT_FAMILY,
            }}>
              ~1% &asymp; 5 Mya &middot; ~5% &asymp; 25 Mya &middot;
              ~10% &asymp; 50 Mya &middot; ~20% &asymp; 100 Mya
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
