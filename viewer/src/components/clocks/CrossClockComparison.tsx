'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT, COMPONENT } from '@/config/theme';
import type { ClockProbe } from '@/lib/api';
import { fetchClockProbeSearch } from '@/lib/api';

// ---------------------------------------------------------------------------
// UpSet-style intersection visualization (canvas)
// ---------------------------------------------------------------------------

interface IntersectionSet {
  clocks: string[];
  count: number;
  label: string;
}

function UpSetPlot({
  clockProbes,
  clockNames,
}: {
  clockProbes: Record<string, ClockProbe[]>;
  clockNames: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [hovered, setHovered] = useState<number | null>(null);

  // Compute intersections
  const intersections = useMemo(() => {
    // Build probe → clock membership
    const probeClocks = new Map<string, Set<string>>();
    for (const [clockName, probes] of Object.entries(clockProbes)) {
      for (const p of probes) {
        if (!probeClocks.has(p.probe_id)) probeClocks.set(p.probe_id, new Set());
        probeClocks.get(p.probe_id)!.add(clockName);
      }
    }

    // Group by membership signature
    const sigCounts = new Map<string, { clocks: string[]; count: number }>();
    for (const [, clocks] of probeClocks) {
      const key = [...clocks].sort().join('|');
      if (!sigCounts.has(key)) {
        sigCounts.set(key, { clocks: [...clocks].sort(), count: 0 });
      }
      sigCounts.get(key)!.count++;
    }

    // Sort by count descending, take top 20
    return [...sigCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((s) => ({
        ...s,
        label: s.clocks.length === 1
          ? s.clocks[0].replace(/_\d{4}$/, '').replace(/_/g, ' ')
          : `${s.clocks.length} clocks`,
      }));
  }, [clockProbes]);

  // Summary stats
  const stats = useMemo(() => {
    const probeClocks = new Map<string, Set<string>>();
    for (const [clockName, probes] of Object.entries(clockProbes)) {
      for (const p of probes) {
        if (!probeClocks.has(p.probe_id)) probeClocks.set(p.probe_id, new Set());
        probeClocks.get(p.probe_id)!.add(clockName);
      }
    }
    const total = probeClocks.size;
    let unique = 0;
    let shared = 0;
    let maxShared = 0;
    for (const [, clocks] of probeClocks) {
      if (clocks.size === 1) unique++;
      else { shared++; maxShared = Math.max(maxShared, clocks.size); }
    }
    return { total, unique, shared, maxShared };
  }, [clockProbes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const H = 240;
  const MATRIX_H = 90;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !intersections.length) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = width * dpr;
    ctx.canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, H);

    const pad = { top: 20, bottom: 8, left: 120, right: 16 };
    const plotW = width - pad.left - pad.right;
    const barRegionH = H - MATRIX_H - pad.top - pad.bottom;
    const nBars = intersections.length;
    const barW = Math.min(Math.floor(plotW / nBars) - 2, 24);
    const barGap = Math.floor((plotW - nBars * barW) / Math.max(nBars, 1));
    const maxCount = Math.max(...intersections.map((s) => s.count));

    // Short clock display names for matrix
    const shortNames = clockNames.map((n) =>
      n.replace(/_\d{4}$/, '').replace(/_/g, ' ').replace('retro age', 'retro'),
    );

    // Matrix region: clock rows on left
    const rowH = Math.floor(MATRIX_H / clockNames.length);
    const matrixTop = H - pad.bottom - MATRIX_H;

    // Clock labels (left)
    ctx.fillStyle = COLOR.text.muted;
    ctx.font = `9px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    for (let r = 0; r < clockNames.length; r++) {
      const y = matrixTop + r * rowH + rowH / 2 + 3;
      ctx.fillText(shortNames[r], pad.left - 8, y);
    }

    // Bars + matrix dots
    for (let i = 0; i < nBars; i++) {
      const x = pad.left + i * (barW + barGap) + barGap / 2;
      const isHov = hovered === i;

      // Bar
      const barH = (intersections[i].count / maxCount) * barRegionH;
      const barY = pad.top + barRegionH - barH;
      ctx.fillStyle = intersections[i].clocks.length > 1
        ? (isHov ? COLOR.accent.amber : 'rgba(240, 165, 0, 0.6)')
        : (isHov ? COLOR.accent.teal : 'rgba(78, 205, 196, 0.4)');
      ctx.fillRect(x, barY, barW, barH);

      // Count label
      ctx.fillStyle = isHov ? COLOR.text.primary : COLOR.text.muted;
      ctx.font = `bold 9px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        intersections[i].count.toLocaleString(),
        x + barW / 2,
        barY - 4,
      );

      // Matrix dots
      for (let r = 0; r < clockNames.length; r++) {
        const dotX = x + barW / 2;
        const dotY = matrixTop + r * rowH + rowH / 2;
        const isMember = intersections[i].clocks.includes(clockNames[r]);

        if (isMember) {
          ctx.beginPath();
          ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
          ctx.fillStyle = isHov ? COLOR.accent.teal : 'rgba(78, 205, 196, 0.7)';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          ctx.fillStyle = COLOR.border.default;
          ctx.fill();
        }
      }

      // Connector lines between dots
      const memberRows = clockNames
        .map((n, r) => ({ r, isMember: intersections[i].clocks.includes(n) }))
        .filter((m) => m.isMember);
      if (memberRows.length > 1) {
        const dotX = x + barW / 2;
        ctx.strokeStyle = isHov ? COLOR.accent.teal : 'rgba(78, 205, 196, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dotX, matrixTop + memberRows[0].r * rowH + rowH / 2);
        ctx.lineTo(dotX, matrixTop + memberRows[memberRows.length - 1].r * rowH + rowH / 2);
        ctx.stroke();
      }
    }
  }, [intersections, clockNames, width, hovered]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pad = { left: 120, right: 16 };
      const plotW = width - pad.left - pad.right;
      const nBars = intersections.length;
      const barW = Math.min(Math.floor(plotW / nBars) - 2, 24);
      const barGap = Math.floor((plotW - nBars * barW) / Math.max(nBars, 1));

      for (let i = 0; i < nBars; i++) {
        const bx = pad.left + i * (barW + barGap) + barGap / 2;
        if (x >= bx && x <= bx + barW) {
          setHovered(i);
          return;
        }
      }
      setHovered(null);
    },
    [width, intersections.length],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
      {/* Summary stats */}
      <div style={{
        display: 'flex',
        gap: SPACE[6],
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        color: COLOR.text.muted,
      }}>
        <span><strong style={{ color: COLOR.text.secondary }}>{stats.total.toLocaleString()}</strong> unique CpGs</span>
        <span><strong style={{ color: COLOR.accent.teal }}>{((stats.unique / stats.total) * 100).toFixed(0)}%</strong> unique to one clock</span>
        <span><strong style={{ color: COLOR.accent.amber }}>{stats.shared}</strong> shared across clocks</span>
        <span>max overlap: <strong style={{ color: COLOR.text.secondary }}>{stats.maxShared}</strong> clocks</span>
      </div>

      <div ref={containerRef} style={{ width: '100%' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: H, display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Probe search
// ---------------------------------------------------------------------------

function ProbeSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ clock_name: string; display_name: string; coefficient: number }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchClockProbeSearch(q);
      if (res.data.n === 0) {
        setResults([]);
      } else {
        setResults(
          res.data.clocks.map((c) => ({
            clock_name: c.clock_name,
            display_name: c.display_name,
            coefficient: c.coefficient,
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
      <div style={{ display: 'flex', gap: SPACE[2], alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder="cg16867657"
          style={{
            ...COMPONENT.input.default as React.CSSProperties,
            flex: 1,
            maxWidth: 200,
          }}
        />
        <button
          onClick={doSearch}
          disabled={loading || !query.trim()}
          style={{
            ...COMPONENT.button.small as React.CSSProperties,
            opacity: loading || !query.trim() ? 0.4 : 1,
          }}
        >
          {loading ? '...' : 'Search'}
        </button>
        <span style={{
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          Which clocks use this probe?
        </span>
      </div>

      {error && (
        <div style={{ color: COLOR.accent.rose, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
          {error}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div style={{ color: COLOR.text.muted, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
          Probe not found in any clock.
        </div>
      )}

      {results && results.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[1],
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLOR.text.muted,
            marginBottom: SPACE[1],
          }}>
            Found in <strong style={{ color: COLOR.accent.teal }}>{results.length}</strong> clock{results.length > 1 ? 's' : ''}:
          </div>
          {results.map((r) => (
            <div key={r.clock_name} style={{
              display: 'flex',
              gap: SPACE[3],
              padding: `${SPACE[1]}px 0`,
              borderBottom: `1px solid ${COLOR.border.subtle}`,
            }}>
              <span style={{ color: COLOR.text.secondary, minWidth: 180 }}>{r.display_name}</span>
              <span style={{
                color: r.coefficient >= 0 ? COLOR.accent.teal : '#3b82f6',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {r.coefficient >= 0 ? '+' : ''}{r.coefficient.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  clockProbes: Record<string, ClockProbe[]>;
  clockNames: string[];
}

export function CrossClockComparison({ clockProbes, clockNames }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
      {/* UpSet plot */}
      <div style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[2],
      }}>
        <div style={{
          ...COMPONENT.sectionHeader,
          textTransform: 'uppercase' as const,
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[3],
        }}>
          PROBE MEMBERSHIP
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.02em',
            textTransform: 'none' as const,
            fontWeight: 400,
          }}>
            Which probes are shared across clocks?
          </span>
        </div>
        <UpSetPlot clockProbes={clockProbes} clockNames={clockNames} />
      </div>

      {/* Probe search */}
      <div style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[2],
      }}>
        <div style={{
          ...COMPONENT.sectionHeader,
          textTransform: 'uppercase' as const,
        }}>
          PROBE LOOKUP
        </div>
        <ProbeSearch />
      </div>
    </div>
  );
}
