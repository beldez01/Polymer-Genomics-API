'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { GRanges } from '@/lib/api';
import { displaySeries } from '@/lib/quantitative';
import { genomicToPixel } from '@/lib/coordinates';

export function MetricPlot({ data, keys, label, units, note, viewStart, viewEnd, canvasWidth, height = 65 }: {
  data?: GRanges; keys: string[]; label: string; units: string; note: string;
  viewStart: number; viewEnd: number; canvasWidth: number; height?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raw = keys.map(key => data?.mcols[key]).find(Boolean);
  const series = useMemo(() => displaySeries(raw ?? [], data?.ranges.start ?? [], data?.ranges.end ?? [], viewStart, viewEnd, canvasWidth), [data, raw, viewStart, viewEnd, canvasWidth]);
  const { extent } = series;
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = canvasWidth * dpr; el.height = height * dpr;
    const ctx = el.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, canvasWidth, height);
    if (!extent) {
      ctx.fillStyle = '#71717a'; ctx.font = '11px monospace';
      ctx.fillText('No current values', 6, height / 2); return;
    }
    // Scale the visible summary, with headroom; raw extrema are retained in the description.
    const rawRange = (series.rawMax ?? 0) - (series.rawMin ?? 0);
    const padding = Math.max((extent.max - extent.min) * .12, rawRange * .08, Math.abs(extent.max) * .015, .01);
    const lo = extent.min - padding, hi = extent.max + padding;
    ctx.font = '10px monospace'; ctx.fillStyle = '#52525b';
    ctx.fillText(hi.toPrecision(3), 3, 11); ctx.fillText(lo.toPrecision(3), 3, height - 2);
    ctx.strokeStyle = '#a1a1aa'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, height - 8); ctx.stroke();
    ctx.strokeStyle = '#0f62fe'; ctx.lineWidth = 1.2; ctx.beginPath();
    let started = false;
    for (const point of series.points) {
      if (!point) { started = false; continue; }
      const x = genomicToPixel(point.position, viewStart, viewEnd, canvasWidth);
      const y = 8 + (1 - (point.value - lo) / (hi - lo)) * (height - 16);
      if (started) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      if (!series.aggregated) { ctx.fillStyle = '#0f62fe'; ctx.fillRect(x - 1, y - 1, 2, 2); }
      started = true;
    }
    ctx.stroke();
  }, [series, viewStart, viewEnd, canvasWidth, height, extent]);
  const mode = series.aggregated ? `mean / ~${series.binBp.toPrecision(3)} bp display bin` : 'individual samples';
  const description = `${label} · ${units} · ${mode}. Raw sample range ${series.rawMin ?? 'n/a'} to ${series.rawMax ?? 'n/a'}. ${note}`;
  return <div className="viewer-metric-plot" style={{ padding: '3px 0' }}>
    <p className="viewer-track-copy" tabIndex={0} title={description} aria-label={description} style={{ margin: '0 6px', fontSize: 11, color: '#52525b' }}>{label} · {units} · {extent ? mode : 'n/a'} · ℹ</p>
    <canvas ref={canvas} style={{ width: canvasWidth, height }} role="img" aria-label={`${description} ${series.count} finite samples; displayed means ${extent?.min ?? 'n/a'} to ${extent?.max ?? 'n/a'}.`} />
  </div>;
}
