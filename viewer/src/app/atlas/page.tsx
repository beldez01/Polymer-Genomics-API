'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { CHROMOSOMES, ChromosomeInfo } from '@/config/chromosomes';
import { fetchAggregation, AggregationResponse } from '@/lib/api';
import { COLOR, TYPE, WEIGHT, SPACE, FONT_FAMILY, LAYOUT } from '@/config/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUILD = 'hg38';
const LAYERS = ['gencode_v44', 'cpg_islands', 'probe_epic_v2'] as const;
const AGG_RESOLUTION = 1_000_000; // 1 Mb bins

// Known layer totals (from /v1/layers row_counts — hardcoded to avoid extra round-trip)
const GENOME_STATS = {
  genes:    '63.0K genes',
  cpg:      '28.4M CpG sites',
  probes:   '937K EPIC v2 probes',
  chrCount: '25 chromosomes',
} as const;

// Reference: chr1 is the longest chromosome (248,956,422 bp)
const MAX_CHR_LENGTH = CHROMOSOMES[0].length; // chr1

// Diagram dimensions
const DIAG_W = 200;
const DIAG_H = 24;
const BAR_H  = 10;
const BAR_Y  = (DIAG_H - BAR_H) / 2;
const CORNER = 4; // px corner radius for chromosome bar ends

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChrStats {
  genes: number | null;
  cpgIslands: number | null;
  probes: number | null;
  loaded: boolean;
  error: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMb(bp: number): string {
  return (bp / 1_000_000).toFixed(1) + ' Mb';
}

function fmtKb(bp: number): string {
  return (bp / 1_000).toFixed(1) + ' kb';
}

function fmtDensity(count: number, lengthBp: number): string {
  const perMb = count / (lengthBp / 1_000_000);
  if (perMb >= 1000) return Math.round(perMb / 1000).toFixed(1) + 'K/Mb';
  return Math.round(perMb).toString() + '/Mb';
}

function sumBinCounts(agg: AggregationResponse, layer: string): number {
  const layerData = agg.data[layer];
  if (!layerData) return 0;
  return layerData.bins.reduce((s, b) => s + b.count, 0);
}

function viewerHref(chr: ChromosomeInfo): string {
  const center = Math.round((chr.centromereStart + chr.centromereEnd) / 2);
  const half   = 500_000;
  const start  = Math.max(1, center - half);
  const end    = Math.min(chr.length, center + half);
  // For chrM use the full chromosome
  if (chr.name === 'chrM') {
    return `/view/${BUILD}/${chr.name}:1-${chr.length}`;
  }
  return `/view/${BUILD}/${chr.name}:${start}-${end}`;
}

// ---------------------------------------------------------------------------
// Canvas chromosome ideogram
// ---------------------------------------------------------------------------

function drawIdeogram(
  canvas: HTMLCanvasElement,
  chr: ChromosomeInfo,
  dpr: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = DIAG_W * dpr;
  const H = DIAG_H * dpr;
  canvas.width  = W;
  canvas.height = H;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, DIAG_W, DIAG_H);

  // chrM — draw a small circle
  if (chr.name === 'chrM') {
    const cx = DIAG_W / 2;
    const cy = DIAG_H / 2;
    const r  = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = COLOR.layer.gencode_v44 + '55'; // translucent blue
    ctx.fill();
    ctx.strokeStyle = COLOR.layer.gencode_v44 + 'AA';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = COLOR.text.muted;
    ctx.font = `${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('circular', cx + 16, cy);
    return;
  }

  // Fraction of max length → pixel width of this chromosome bar
  const barW = Math.round((chr.length / MAX_CHR_LENGTH) * DIAG_W);

  // Gradient: teal-tinted left → blue right
  const grad = ctx.createLinearGradient(0, 0, barW, 0);
  grad.addColorStop(0,   COLOR.layer.gencode_v44 + '60');  // blue, transparent
  grad.addColorStop(0.4, COLOR.layer.gencode_v44 + '90');
  grad.addColorStop(1,   COLOR.layer.gencode_v44 + '40');

  // Rounded pill
  ctx.beginPath();
  ctx.moveTo(CORNER, BAR_Y);
  ctx.lineTo(barW - CORNER, BAR_Y);
  ctx.quadraticCurveTo(barW, BAR_Y, barW, BAR_Y + CORNER);
  ctx.lineTo(barW, BAR_Y + BAR_H - CORNER);
  ctx.quadraticCurveTo(barW, BAR_Y + BAR_H, barW - CORNER, BAR_Y + BAR_H);
  ctx.lineTo(CORNER, BAR_Y + BAR_H);
  ctx.quadraticCurveTo(0, BAR_Y + BAR_H, 0, BAR_Y + BAR_H - CORNER);
  ctx.lineTo(0, BAR_Y + CORNER);
  ctx.quadraticCurveTo(0, BAR_Y, CORNER, BAR_Y);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Centromere notch
  if (chr.centromereStart > 0 && chr.centromereEnd > 0) {
    const cStart = Math.round((chr.centromereStart / chr.length) * barW);
    const cEnd   = Math.round((chr.centromereEnd   / chr.length) * barW);
    const notchW = Math.max(cEnd - cStart, 3); // at least 3px visible

    ctx.fillStyle = COLOR.bg.primary + 'CC'; // dark notch
    ctx.fillRect(cStart, BAR_Y + 1, notchW, BAR_H - 2);

    // Thin teal line at centromere center
    const cMid = cStart + notchW / 2;
    ctx.strokeStyle = COLOR.accent.teal + '88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cMid, BAR_Y);
    ctx.lineTo(cMid, BAR_Y + BAR_H);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// ChromosomeCard
// ---------------------------------------------------------------------------

interface CardProps {
  chr: ChromosomeInfo;
  stats: ChrStats;
}

function ChromosomeCard({ chr, stats }: CardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState(false);

  // Draw ideogram once canvas is mounted
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    drawIdeogram(canvas, chr, dpr);
  }, [chr]);

  const statRow = (
    label: string,
    value: number | null,
    color: string,
    lengthBp: number,
  ) => {
    const text = value === null
      ? '—'
      : fmtDensity(value, lengthBp);
    return (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: TYPE.xs.letterSpacing,
        }}>
          {label}
        </span>
        <span style={{
          color: value === null ? COLOR.text.faint : color,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: TYPE.xs.letterSpacing,
        }}>
          {text}
        </span>
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${hovered ? COLOR.border.strong : COLOR.border.subtle}`,
        padding: SPACE[4],
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[3],
        transition: 'border-color 0.15s',
        minWidth: 0,
      }}
    >
      {/* Header row: name + size */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.md.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.bold,
          letterSpacing: '-0.01em',
        }}>
          {chr.name}
        </span>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: TYPE.xs.letterSpacing,
        }}>
          {chr.name === 'chrM' ? fmtKb(chr.length) : fmtMb(chr.length)}
        </span>
      </div>

      {/* Mini ideogram canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width:  DIAG_W,
          height: DIAG_H,
          display: 'block',
          imageRendering: 'crisp-edges',
        }}
      />

      {/* Density stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] + 2 }}>
        {statRow('genes',    stats.genes,      COLOR.layer.gencode_v44,   chr.length)}
        {statRow('CpG isl.', stats.cpgIslands, COLOR.layer.cpg_sites,     chr.length)}
        {statRow('probes',   stats.probes,     COLOR.layer.probe_epic_v2, chr.length)}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: COLOR.border.subtle }} />

      {/* View link */}
      <Link
        href={viewerHref(chr)}
        style={{
          color: hovered ? COLOR.accent.teal : COLOR.text.tertiary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          textDecoration: 'none',
          letterSpacing: '0.04em',
          transition: 'color 0.15s',
          alignSelf: 'flex-end',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.accent.teal; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = hovered ? COLOR.accent.teal : COLOR.text.tertiary; }}
      >
        View →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AtlasPage() {
  const [chrStats, setChrStats] = useState<Record<string, ChrStats>>(() => {
    const init: Record<string, ChrStats> = {};
    for (const chr of CHROMOSOMES) {
      init[chr.name] = { genes: null, cpgIslands: null, probes: null, loaded: false, error: false };
    }
    return init;
  });

  const [, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const promises = CHROMOSOMES.map(async (chr) => {
        // Skip chrM — too small for 1Mb aggregation
        if (chr.name === 'chrM') {
          if (!cancelled) {
            setChrStats((prev) => ({
              ...prev,
              [chr.name]: { genes: null, cpgIslands: null, probes: null, loaded: true, error: false },
            }));
          }
          return;
        }

        try {
          const region = `${chr.name}:1-${chr.length}`;
          const agg: AggregationResponse = await fetchAggregation(
            BUILD,
            region,
            AGG_RESOLUTION,
            [...LAYERS],
          );

          if (cancelled) return;

          const genes      = sumBinCounts(agg, 'gencode_v44');
          const cpgIslands = sumBinCounts(agg, 'cpg_islands');
          const probes     = sumBinCounts(agg, 'probe_epic_v2');

          setChrStats((prev) => ({
            ...prev,
            [chr.name]: { genes, cpgIslands, probes, loaded: true, error: false },
          }));
        } catch {
          if (!cancelled) {
            setChrStats((prev) => ({
              ...prev,
              [chr.name]: { genes: null, cpgIslands: null, probes: null, loaded: true, error: true },
            }));
          }
        }
      });

      await Promise.allSettled(promises);
      if (!cancelled) setLoading(false);
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  // Derived: how many chromosomes have loaded so far
  const loadedCount = Object.values(chrStats).filter((s) => s.loaded).length;
  const totalCount  = CHROMOSOMES.length;
  const allLoaded   = loadedCount === totalCount;

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      fontFamily: FONT_FAMILY,
    }}>

      {/* ─── Top bar ─── */}
      <header style={{
        height: LAYOUT.headerHeight,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${SPACE[6]}px`,
        gap: SPACE[4],
        backgroundColor: COLOR.bg.primary,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <Link
          href="/"
          style={{
            color: COLOR.accent.teal,
            textDecoration: 'none',
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.bold,
            letterSpacing: '0.10em',
          }}
        >
          POLYMER GENOMICS
        </Link>
        <span style={{
          color: COLOR.border.strong,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          /
        </span>
        <span style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.02em',
        }}>
          Chromosome Atlas · hg38
        </span>

        {/* Loading indicator in header */}
        {!allLoaded && (
          <span style={{
            marginLeft: 'auto',
            color: COLOR.text.faint,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: TYPE.xs.letterSpacing,
          }}>
            loading {loadedCount}/{totalCount}
          </span>
        )}
      </header>

      {/* ─── Stats header bar ─── */}
      <div style={{
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[3]}px ${SPACE[6]}px`,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[6],
        flexWrap: 'wrap',
      }}>
        {[
          { label: GENOME_STATS.genes,    color: COLOR.layer.gencode_v44   },
          { label: GENOME_STATS.cpg,      color: COLOR.layer.cpg_sites     },
          { label: GENOME_STATS.probes,   color: COLOR.layer.probe_epic_v2 },
          { label: GENOME_STATS.chrCount, color: COLOR.text.tertiary       },
        ].map(({ label, color }) => (
          <span key={label} style={{
            color,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.02em',
          }}>
            {label}
          </span>
        ))}

        <span style={{
          marginLeft: 'auto',
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: TYPE.xs.letterSpacing,
        }}>
          {allLoaded
            ? 'all chromosomes loaded'
            : `${loadedCount} / ${totalCount} chromosomes loaded`}
        </span>
      </div>

      {/* ─── Card grid ─── */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: `${SPACE[6]}px ${SPACE[6]}px ${SPACE[12]}px`,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: SPACE[4],
        }}>
          {CHROMOSOMES.map((chr) => (
            <ChromosomeCard
              key={chr.name}
              chr={chr}
              stats={chrStats[chr.name]}
            />
          ))}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <footer style={{
        borderTop: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[6]}px ${SPACE[6]}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACE[4],
      }}>
        <span style={{
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: TYPE.xs.letterSpacing,
        }}>
          hg38 · GRCh38.p14 · Genome Reference Consortium
        </span>
        <span style={{
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: TYPE.xs.letterSpacing,
        }}>
          Density = features / Mb · centromere positions from UCSC
        </span>
      </footer>
    </main>
  );
}
