'use client';

import { useRef, useEffect, useCallback } from 'react';
import { COLOR, TYPE, FONT_FAMILY, SPACE } from '@/config/theme';
import type { VennData } from '@/lib/dmp/comparison';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VennDiagramProps {
  data: VennData;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
  color: string;
  name: string;
  size: number;
}

function getCircles(data: VennData, w: number, h: number): Circle[] {
  const n = data.sets.length;
  const r = Math.min(w, h) * 0.28;
  const overlap = r * 0.55; // how much circles overlap

  if (n === 2) {
    const cx = w / 2;
    const cy = h / 2;
    return [
      { cx: cx - overlap / 2, cy, r, color: data.sets[0].color, name: data.sets[0].name, size: data.sets[0].size },
      { cx: cx + overlap / 2, cy, r, color: data.sets[1].color, name: data.sets[1].name, size: data.sets[1].size },
    ];
  }

  if (n === 3) {
    const cx = w / 2;
    const cy = h / 2;
    const d = r * 0.6; // distance from center
    // Triangle arrangement: top, bottom-left, bottom-right
    return [
      { cx, cy: cy - d * 0.6, r, color: data.sets[0].color, name: data.sets[0].name, size: data.sets[0].size },
      { cx: cx - d * 0.7, cy: cy + d * 0.5, r, color: data.sets[1].color, name: data.sets[1].name, size: data.sets[1].size },
      { cx: cx + d * 0.7, cy: cy + d * 0.5, r, color: data.sets[2].color, name: data.sets[2].name, size: data.sets[2].size },
    ];
  }

  // Fallback: single circle
  if (n === 1) {
    return [
      { cx: w / 2, cy: h / 2, r, color: data.sets[0].color, name: data.sets[0].name, size: data.sets[0].size },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Intersection label positions
// ---------------------------------------------------------------------------

function getIntersectionLabelPos(
  circles: Circle[],
  setIndices: number[],
): { x: number; y: number } {
  // Centroid of the circles in the intersection
  let sx = 0, sy = 0;
  for (const i of setIndices) {
    sx += circles[i].cx;
    sy += circles[i].cy;
  }
  return { x: sx / setIndices.length, y: sy / setIndices.length };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderVenn(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: VennData,
) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  ctx.fillStyle = COLOR.canvas.background;
  ctx.fillRect(0, 0, w * dpr, h * dpr);

  ctx.save();
  ctx.scale(dpr, dpr);

  const circles = getCircles(data, w, h);

  // Draw filled circles
  for (const c of circles) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    ctx.fillStyle = hexToRGBA(c.color, 0.3);
    ctx.fill();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Draw set names and sizes outside
  ctx.font = `500 ${TYPE.sm.fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';

  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    // Position label outside circle
    const labelOffset = c.r + 16;
    let lx = c.cx;
    let ly: number;

    if (circles.length === 2) {
      ly = c.cy - labelOffset;
    } else if (circles.length === 3) {
      if (i === 0) {
        ly = c.cy - labelOffset;
      } else {
        ly = c.cy + labelOffset + 4;
      }
    } else {
      ly = c.cy - labelOffset;
    }

    // Name
    ctx.fillStyle = c.color;
    ctx.fillText(c.name.length > 20 ? c.name.slice(0, 17) + '...' : c.name, lx, ly);

    // Size in circle (exclusive count: total minus shared)
    // We show total size; intersections shown separately
    ctx.fillStyle = COLOR.text.primary;
    ctx.font = `400 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;

    // Compute exclusive count
    let shared = 0;
    for (const inter of data.intersections) {
      if (inter.sets.includes(i) && inter.sets.length === 2) {
        shared += inter.size;
      }
    }
    // For 3-way: subtract triple overlap already counted in pair
    for (const inter of data.intersections) {
      if (inter.sets.includes(i) && inter.sets.length === 3) {
        shared += inter.size;
      }
    }
    const exclusive = c.size - shared;

    // Place exclusive count in a spot away from center
    const cx_center = circles.reduce((s, cc) => s + cc.cx, 0) / circles.length;
    const cy_center = circles.reduce((s, cc) => s + cc.cy, 0) / circles.length;
    const dx = c.cx - cx_center;
    const dy = c.cy - cy_center;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const exclX = c.cx + (dx / dist) * c.r * 0.4;
    const exclY = c.cy + (dy / dist) * c.r * 0.4;

    ctx.fillText(String(exclusive >= 0 ? exclusive : c.size), exclX, exclY + 4);
    ctx.font = `500 ${TYPE.sm.fontSize}px ${FONT_FAMILY}`;
  }

  // Draw intersection sizes
  ctx.fillStyle = COLOR.text.primary;
  ctx.font = `500 ${TYPE.sm.fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';

  for (const inter of data.intersections) {
    if (inter.size === 0) continue;
    const pos = getIntersectionLabelPos(circles, inter.sets);
    ctx.fillText(String(inter.size), pos.x, pos.y + 4);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VennDiagram({ data, width = 400, height = 300 }: VennDiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderVenn(ctx, width, height, data);
  }, [data, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div style={{
      border: `1px solid ${COLOR.border.subtle}`,
      backgroundColor: COLOR.canvas.background,
      display: 'inline-block',
    }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
