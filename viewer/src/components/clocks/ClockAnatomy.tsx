'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT, COMPONENT } from '@/config/theme';
import type { ClockMetadata, ClockProbe } from '@/lib/api';

// ---------------------------------------------------------------------------
// Coefficient histogram (canvas)
// ---------------------------------------------------------------------------

function CoefficientHistogram({ probes }: { probes: ClockProbe[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const H = 160;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !probes.length) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = width * dpr;
    ctx.canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, H);

    const coeffs = probes.map((p) => p.coefficient);
    const minC = Math.min(...coeffs);
    const maxC = Math.max(...coeffs);
    const range = maxC - minC || 1;
    const nBins = Math.min(80, Math.max(30, Math.floor(width / 8)));
    const binWidth = range / nBins;
    const bins = new Array(nBins).fill(0);

    for (const c of coeffs) {
      const idx = Math.min(nBins - 1, Math.floor((c - minC) / binWidth));
      bins[idx]++;
    }

    const maxBin = Math.max(...bins, 1);
    const pad = { top: 20, bottom: 28, left: 4, right: 4 };
    const plotW = width - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const barW = plotW / nBins;

    // Zero line
    const zeroX = pad.left + ((0 - minC) / range) * plotW;
    if (zeroX > pad.left && zeroX < width - pad.right) {
      ctx.strokeStyle = COLOR.border.strong;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(zeroX, pad.top);
      ctx.lineTo(zeroX, H - pad.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLOR.text.faint;
      ctx.font = `9px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('0', zeroX, H - pad.bottom + 12);
    }

    // Bars
    for (let i = 0; i < nBins; i++) {
      if (bins[i] === 0) continue;
      const barH = (bins[i] / maxBin) * plotH;
      const x = pad.left + i * barW;
      const y = pad.top + plotH - barH;
      const binCenter = minC + (i + 0.5) * binWidth;
      ctx.fillStyle = binCenter < 0
        ? 'rgba(59, 130, 246, 0.7)'   // blue for negative (losing)
        : 'rgba(78, 205, 196, 0.7)';  // teal for positive (gaining)
      ctx.fillRect(x, y, Math.max(barW - 1, 1), barH);
    }

    // Axis labels
    ctx.fillStyle = COLOR.text.muted;
    ctx.font = `9px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(minC.toFixed(1), pad.left, H - pad.bottom + 12);
    ctx.textAlign = 'right';
    ctx.fillText(maxC.toFixed(1), width - pad.right, H - pad.bottom + 12);

    // Direction labels
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.font = `bold 9px ${FONT_FAMILY}`;
    const negCount = coeffs.filter((c) => c < 0).length;
    const posCount = coeffs.filter((c) => c >= 0).length;
    if (negCount > 0) ctx.fillText(`← ${negCount} losing`, pad.left + plotW * 0.2, 14);
    ctx.fillStyle = 'rgba(78, 205, 196, 0.5)';
    if (posCount > 0) ctx.fillText(`${posCount} gaining →`, pad.left + plotW * 0.8, 14);
  }, [probes, width]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: H, display: 'block' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Probe table
// ---------------------------------------------------------------------------

function ProbeTable({ probes, clockName }: { probes: ClockProbe[]; clockName: string }) {
  const [sortBy, setSortBy] = useState<'abs' | 'asc' | 'desc'>('abs');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...probes];
    switch (sortBy) {
      case 'abs': return arr.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
      case 'asc': return arr.sort((a, b) => a.coefficient - b.coefficient);
      case 'desc': return arr.sort((a, b) => b.coefficient - a.coefficient);
    }
  }, [probes, sortBy]);

  const visible = showAll ? sorted : sorted.slice(0, 30);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: SPACE[2], alignItems: 'center' }}>
        <span style={{ color: COLOR.text.muted, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
          Sort:
        </span>
        {(['abs', 'desc', 'asc'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortBy(mode)}
            style={{
              ...(sortBy === mode ? COMPONENT.button.smallActive : COMPONENT.button.small) as React.CSSProperties,
              padding: `2px 6px`,
            }}
          >
            {mode === 'abs' ? '|w|' : mode === 'desc' ? 'w↓' : 'w↑'}
          </button>
        ))}
        <span style={{
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginLeft: 'auto',
        }}>
          {probes.length} probes
        </span>
      </div>

      {/* Table */}
      <div style={{
        maxHeight: showAll ? 'none' : 520,
        overflowY: showAll ? 'visible' : 'auto',
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr>
              {['#', 'Probe', 'Coefficient', 'Direction', ''].map((h) => (
                <th key={h} style={{
                  textAlign: 'left',
                  color: COLOR.text.muted,
                  fontWeight: WEIGHT.medium,
                  padding: `${SPACE[1]}px ${SPACE[2]}px`,
                  borderBottom: `1px solid ${COLOR.border.subtle}`,
                  position: 'sticky',
                  top: 0,
                  backgroundColor: COLOR.bg.elevated,
                  letterSpacing: '0.04em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <tr
                key={p.probe_id}
                style={{ transition: 'background-color 0.1s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = COLOR.bg.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <td style={{ color: COLOR.text.faint, padding: `3px ${SPACE[2]}px`, width: 32 }}>
                  {i + 1}
                </td>
                <td style={{ padding: `3px ${SPACE[2]}px` }}>
                  <Link
                    href={`/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores`}
                    style={{
                      color: COLOR.accent.teal,
                      textDecoration: 'none',
                      fontWeight: WEIGHT.medium,
                    }}
                    title="View in genome browser"
                  >
                    {p.probe_id}
                  </Link>
                </td>
                <td style={{
                  padding: `3px ${SPACE[2]}px`,
                  color: COLOR.text.secondary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {p.coefficient >= 0 ? '+' : ''}{p.coefficient.toFixed(4)}
                </td>
                <td style={{ padding: `3px ${SPACE[2]}px`, width: 20 }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    backgroundColor: p.coefficient >= 0
                      ? 'rgba(78, 205, 196, 0.6)'
                      : 'rgba(59, 130, 246, 0.6)',
                  }} />
                </td>
                <td style={{ padding: `3px ${SPACE[2]}px`, width: 16 }} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {probes.length > 30 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            ...COMPONENT.button.small as React.CSSProperties,
            alignSelf: 'center',
          }}
        >
          {showAll ? 'Show top 30' : `Show all ${probes.length}`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  clock: ClockMetadata;
  probes: ClockProbe[];
}

export function ClockAnatomy({ clock, probes }: Props) {
  const negCount = probes.filter((p) => p.coefficient < 0).length;
  const posCount = probes.filter((p) => p.coefficient >= 0).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[4],
    }}>
      {/* Metadata */}
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
          CLOCK ANATOMY
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.02em',
            textTransform: 'none' as const,
            fontWeight: 400,
          }}>
            {clock.display_name}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: `${SPACE[1]}px ${SPACE[6]}px`,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          {[
            ['Probes', `${clock.n_probes} (${posCount}↑ ${negCount}↓)`],
            ['Platform', clock.platform.toUpperCase()],
            ['Tissue', clock.tissue],
            ['Outcome', clock.outcome.replace(/_/g, ' ')],
            ['Transform', clock.age_transform],
            ['Intercept', clock.intercept != null ? clock.intercept.toFixed(3) : 'N/A'],
            ['PMID', clock.pmid],
            ['Citation', clock.source_citation],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: SPACE[2] }}>
              <span style={{ color: COLOR.text.muted, minWidth: 70 }}>{label}</span>
              <span style={{ color: COLOR.text.secondary }}>
                {label === 'PMID' && value ? (
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: COLOR.accent.teal, textDecoration: 'none' }}
                  >
                    {value}
                  </a>
                ) : (
                  value ?? 'N/A'
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Coefficient distribution */}
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
          COEFFICIENT DISTRIBUTION
        </div>
        <CoefficientHistogram probes={probes} />
      </div>

      {/* Probe table */}
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
          PROBE COEFFICIENTS
        </div>
        <ProbeTable probes={probes} clockName={clock.clock_name} />
      </div>
    </div>
  );
}
