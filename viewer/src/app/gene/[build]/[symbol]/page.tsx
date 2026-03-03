'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchGene } from '@/lib/api';
import type { GRanges } from '@/lib/api';
import { BrandBar } from '@/components/BrandBar';
import {
  COLOR,
  TYPE,
  WEIGHT,
  SPACE,
  FONT_FAMILY,
  COMPONENT,
} from '@/config/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranscriptFeatures {
  transcript_id: string;
  featureCounts: Record<string, number>;
  features: { start: number; end: number; feature_type: string }[];
}

interface ParsedGene {
  chr: string;
  geneStart: number;
  geneEnd: number;
  strand: string;
  geneLength: number;
  geneId: string;
  transcripts: TranscriptFeatures[];
  transcriptCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBp(n: number): string {
  return n.toLocaleString('en-US');
}

function parseGRanges(gr: GRanges): ParsedGene | null {
  if (!gr || gr.n === 0) return null;

  const seqnames = gr.seqnames;
  const starts   = gr.ranges.start;
  const ends     = gr.ranges.end;
  const strands  = gr.strand;
  const mcols    = gr.mcols;

  const geneIds      = (mcols['gene_id']      ?? []) as (string | null)[];
  const transcriptIds = (mcols['transcript_id'] ?? []) as (string | null)[];
  const featureTypes  = (mcols['feature_type']  ?? []) as (string | null)[];

  const chr    = seqnames[0] ?? 'chrUnknown';
  const strand = strands[0]  ?? '*';
  const geneId = (geneIds.find(Boolean) ?? '') as string;

  let geneStart = Infinity;
  let geneEnd   = -Infinity;
  for (let i = 0; i < gr.n; i++) {
    if (starts[i] < geneStart) geneStart = starts[i];
    if (ends[i]   > geneEnd)   geneEnd   = ends[i];
  }

  // Group features by transcript_id
  const txMap = new Map<string, TranscriptFeatures>();

  for (let i = 0; i < gr.n; i++) {
    const txId = transcriptIds[i] ?? 'unknown';
    const ft   = featureTypes[i]  ?? 'unknown';
    if (!txMap.has(txId)) {
      txMap.set(txId, { transcript_id: txId, featureCounts: {}, features: [] });
    }
    const tx = txMap.get(txId)!;
    tx.featureCounts[ft] = (tx.featureCounts[ft] ?? 0) + 1;
    tx.features.push({ start: starts[i], end: ends[i], feature_type: ft });
  }

  const transcripts = Array.from(txMap.values());

  return {
    chr,
    geneStart,
    geneEnd,
    strand,
    geneLength: geneEnd - geneStart + 1,
    geneId,
    transcripts,
    transcriptCount: transcripts.length,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackLink({ href }: { href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color: hovered ? COLOR.accent.teal : COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        textDecoration: 'none',
        transition: 'color 0.15s',
        letterSpacing: '0.01em',
      }}
    >
      ← Back to viewer
    </Link>
  );
}

function InfoPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[4]}px ${SPACE[5]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[3],
      }}
    >
      <div
        style={{
          ...COMPONENT.sectionHeader,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          marginBottom: SPACE[1],
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: SPACE[3],
        alignItems: 'baseline',
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          flexShrink: 0,
          width: 90,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript diagram canvas
// ---------------------------------------------------------------------------

const ROW_HEIGHT  = 28;
const ROW_GAP     = 8;
const LABEL_WIDTH = 130;
const MAX_TX      = 8;

function TranscriptDiagram({
  gene,
  symbol,
}: {
  gene: ParsedGene;
  symbol: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const txRows = gene.transcripts.slice(0, MAX_TX);
  const canvasHeight = txRows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const trackW = W - LABEL_WIDTH;
    const gStart = gene.geneStart;
    const gEnd   = gene.geneEnd;
    const gLen   = gEnd - gStart + 1;

    function toX(bp: number): number {
      return LABEL_WIDTH + ((bp - gStart) / gLen) * trackW;
    }

    txRows.forEach((tx, rowIdx) => {
      const y = ROW_GAP + rowIdx * (ROW_HEIGHT + ROW_GAP);
      const cy = y + ROW_HEIGHT / 2;

      // Label
      const labelText = tx.transcript_id.replace(/\.[0-9]+$/, '');
      const maxLabelChars = Math.floor((LABEL_WIDTH - 8) / 6.5);
      const truncLabel =
        labelText.length > maxLabelChars
          ? labelText.slice(0, maxLabelChars - 1) + '\u2026'
          : labelText;

      ctx.font        = `${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
      ctx.fillStyle   = COLOR.text.tertiary;
      ctx.textAlign   = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncLabel, LABEL_WIDTH - 6, cy);

      // Intron line (full span)
      const x0 = toX(gStart);
      const x1 = toX(gEnd);
      ctx.strokeStyle = COLOR.border.strong;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.lineTo(x1, cy);
      ctx.stroke();

      // Draw features
      tx.features.forEach((feat) => {
        const fx0 = toX(feat.start);
        const fx1 = toX(feat.end);
        const fw  = Math.max(1, fx1 - fx0);

        const ft = (feat.feature_type ?? '').toLowerCase();

        if (ft === 'cds') {
          ctx.fillStyle = COLOR.layer.gencode_v44; // #3b82f6
          ctx.fillRect(fx0, cy - ROW_HEIGHT * 0.35, fw, ROW_HEIGHT * 0.7);
        } else if (
          ft === 'exon' ||
          ft === 'utr' ||
          ft.includes('utr') ||
          ft === 'start_codon' ||
          ft === 'stop_codon'
        ) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
          ctx.fillRect(fx0, cy - ROW_HEIGHT * 0.28, fw, ROW_HEIGHT * 0.56);
        }
      });

      // Strand arrow at end
      const arrowX = gene.strand === '-' ? x0 - 2 : x1 + 2;
      const arrowDir = gene.strand === '-' ? -1 : 1;
      const arrowLen = 6;
      const arrowHead = 3;
      ctx.strokeStyle = COLOR.text.tertiary;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(arrowX, cy);
      ctx.lineTo(arrowX + arrowDir * arrowLen, cy);
      ctx.stroke();
      ctx.fillStyle = COLOR.text.tertiary;
      ctx.beginPath();
      ctx.moveTo(arrowX + arrowDir * arrowLen, cy);
      ctx.lineTo(arrowX + arrowDir * arrowLen - arrowDir * arrowHead, cy - arrowHead);
      ctx.lineTo(arrowX + arrowDir * arrowLen - arrowDir * arrowHead, cy + arrowHead);
      ctx.closePath();
      ctx.fill();
    });
  }, [gene, txRows]);

  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    draw();
  }, [draw, width]);

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: COLOR.bg.track,
        border: `1px solid ${COLOR.border.subtle}`,
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          borderBottom: `1px solid ${COLOR.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            ...COMPONENT.sectionHeader,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
          }}
        >
          Transcript Structure
        </span>
        <span
          style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}
        >
          {gene.strand === '+' ? 'forward strand (+)' : gene.strand === '-' ? 'reverse strand (−)' : 'strand unknown'} &nbsp;&middot;&nbsp; {symbol}
        </span>
      </div>

      {/* Legend */}
      <div
        style={{
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          borderBottom: `1px solid ${COLOR.border.subtle}`,
          display: 'flex',
          gap: SPACE[5],
          alignItems: 'center',
        }}
      >
        {[
          { color: COLOR.layer.gencode_v44,    label: 'CDS',       h: 10 },
          { color: 'rgba(59,130,246,0.45)',     label: 'Exon / UTR', h: 7 },
          { color: COLOR.border.strong,         label: 'Intron',    h: 1 },
        ].map(({ color, label, h }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
            <div
              style={{
                width: 14,
                height: h,
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: canvasHeight,
          imageRendering: 'crisp-edges',
        }}
      />

      {gene.transcriptCount > MAX_TX && (
        <div
          style={{
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            borderTop: `1px solid ${COLOR.border.subtle}`,
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}
        >
          Showing {MAX_TX} of {gene.transcriptCount} transcripts
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error states
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        gap: SPACE[3],
      }}
    >
      <div
        style={{
          width: 32,
          height: 2,
          backgroundColor: COLOR.border.strong,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '60%',
            backgroundColor: COLOR.accent.teal,
            animation: 'pgSlide 1.2s ease-in-out infinite',
          }}
        />
      </div>
      <span
        style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
        }}
      >
        Loading gene data&hellip;
      </span>
      <style>{`
        @keyframes pgSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

function ErrorState({ message, build }: { message: string; build: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        gap: SPACE[4],
        padding: SPACE[8],
      }}
    >
      <span
        style={{
          color: COLOR.text.faint,
          fontSize: TYPE['2xl'].fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.bold,
          letterSpacing: '-0.03em',
        }}
      >
        404
      </span>
      <span
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          textAlign: 'center',
          maxWidth: 400,
        }}
      >
        {message}
      </span>
      <Link
        href="/"
        style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          textDecoration: 'none',
          border: `1px solid ${COLOR.accent.teal}`,
          padding: `${SPACE[2]}px ${SPACE[5]}px`,
          transition: 'background-color 0.15s',
        }}
      >
        Return home
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GenePage() {
  const params = useParams<{ build: string; symbol: string }>();
  const build  = params.build  ?? 'hg38';
  const symbol = (params.symbol ?? '').toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [gene, setGene]       = useState<ParsedGene | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchGene(build, symbol)
      .then((res) => {
        if (cancelled) return;
        // fetchGene returns a RegionResponse; the gene data is in res.data['gencode_v44']
        // or fall back to first available GRanges in data
        const geneGR =
          (res.data?.['gencode_v44'] as GRanges | undefined) ??
          (Object.values(res.data ?? {})[0] as GRanges | undefined) ??
          null;

        if (!geneGR || geneGR.n === 0) {
          setError(`No data found for gene "${symbol}" in build ${build}.`);
          setLoading(false);
          return;
        }

        const parsed = parseGRanges(geneGR);
        if (!parsed) {
          setError(`Could not parse gene data for "${symbol}".`);
          setLoading(false);
          return;
        }

        setGene(parsed);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? `Gene "${symbol}" not found.`);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [build, symbol]);

  const PAD = 5000;
  const viewerHref = gene
    ? `/view/${build}/${gene.chr}:${Math.max(1, gene.geneStart - PAD)}-${gene.geneEnd + PAD}`
    : '/';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Top bar */}
      <BrandBar subtitle={<BackLink href={viewerHref} />} />

      {/* Content */}
      <div
        style={{
          maxWidth: 960,
          width: '100%',
          margin: '0 auto',
          padding: `${SPACE[8]}px ${SPACE[6]}px`,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[6],
        }}
      >
        {loading && <LoadingState />}

        {!loading && error && (
          <ErrorState message={error} build={build} />
        )}

        {!loading && !error && gene && (
          <>
            {/* 2. Gene header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[4], flexWrap: 'wrap' }}>
                <h1
                  style={{
                    fontSize: TYPE['2xl'].fontSize,
                    fontWeight: WEIGHT.bold,
                    letterSpacing: TYPE['2xl'].letterSpacing,
                    color: COLOR.text.primary,
                    fontFamily: FONT_FAMILY,
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {symbol}
                </h1>
                <span
                  style={{
                    color: COLOR.text.tertiary,
                    fontSize: TYPE.md.fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: WEIGHT.normal,
                    letterSpacing: '0em',
                  }}
                >
                  {gene.chr}:{formatBp(gene.geneStart)}–{formatBp(gene.geneEnd)}
                </span>
                <StrandBadge strand={gene.strand} />
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: SPACE[4],
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    color: COLOR.text.muted,
                    fontSize: TYPE.sm.fontSize,
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {gene.transcriptCount} transcript{gene.transcriptCount !== 1 ? 's' : ''}
                </span>
                <span style={{ color: COLOR.text.faint, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
                  &middot;
                </span>
                <span
                  style={{
                    color: COLOR.text.muted,
                    fontSize: TYPE.sm.fontSize,
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {formatBp(gene.geneLength)} bp
                </span>
                <span style={{ color: COLOR.text.faint, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
                  &middot;
                </span>
                <span
                  style={{
                    color: COLOR.layer.gencode_v44,
                    fontSize: TYPE.sm.fontSize,
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  GENCODE v44
                </span>
              </div>
            </div>

            {/* 3. Three info panels */}
            <div
              style={{
                display: 'flex',
                gap: SPACE[4],
                flexWrap: 'wrap',
                alignItems: 'stretch',
              }}
            >
              {/* Locus panel */}
              <InfoPanel title="Locus">
                <KVRow label="Chromosome" value={gene.chr} />
                <KVRow label="Start"      value={formatBp(gene.geneStart)} />
                <KVRow label="End"        value={formatBp(gene.geneEnd)} />
                <KVRow label="Length"     value={`${formatBp(gene.geneLength)} bp`} />
                <KVRow
                  label="Strand"
                  value={
                    <span style={{ color: gene.strand === '+' ? COLOR.accent.teal : COLOR.accent.amber }}>
                      {gene.strand === '+' ? '+ (forward)' : gene.strand === '-' ? '− (reverse)' : gene.strand}
                    </span>
                  }
                />
                {gene.geneId && (
                  <KVRow label="GENCODE ID" value={
                    <span style={{ color: COLOR.text.tertiary, fontSize: TYPE.xs.fontSize }}>
                      {gene.geneId}
                    </span>
                  } />
                )}
              </InfoPanel>

              {/* Transcripts panel */}
              <InfoPanel title="Transcripts">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE[2],
                  }}
                >
                  {gene.transcripts.slice(0, MAX_TX).map((tx) => {
                    const shortId = tx.transcript_id.replace(/\.[0-9]+$/, '');
                    const featSummary = Object.entries(tx.featureCounts)
                      .map(([ft, n]) => `${ft}×${n}`)
                      .join(' ');
                    return (
                      <div key={tx.transcript_id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span
                          style={{
                            color: COLOR.text.secondary,
                            fontSize: TYPE.sm.fontSize,
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {shortId}
                        </span>
                        <span
                          style={{
                            color: COLOR.text.muted,
                            fontSize: TYPE.xs.fontSize,
                            fontFamily: FONT_FAMILY,
                          }}
                        >
                          {featSummary || 'no features'}
                        </span>
                      </div>
                    );
                  })}
                  {gene.transcriptCount > MAX_TX && (
                    <span
                      style={{
                        color: COLOR.text.faint,
                        fontSize: TYPE.xs.fontSize,
                        fontFamily: FONT_FAMILY,
                        marginTop: SPACE[1],
                      }}
                    >
                      +{gene.transcriptCount - MAX_TX} more
                    </span>
                  )}
                </div>
              </InfoPanel>

              {/* CpG Profile panel */}
              <InfoPanel title="CpG & Probe Coverage">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE[3],
                    flex: 1,
                    justifyContent: 'center',
                    padding: `${SPACE[4]}px 0`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE[2],
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        backgroundColor: COLOR.layer.cpg_sites,
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: COLOR.text.muted,
                        fontSize: TYPE.sm.fontSize,
                        fontFamily: FONT_FAMILY,
                      }}
                    >
                      CpG sites
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE[2],
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        backgroundColor: COLOR.layer.probe_epic_v2,
                        borderRadius: '50%',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: COLOR.text.muted,
                        fontSize: TYPE.sm.fontSize,
                        fontFamily: FONT_FAMILY,
                      }}
                    >
                      EPIC v2 probes
                    </span>
                  </div>
                  <span
                    style={{
                      color: COLOR.text.faint,
                      fontSize: TYPE.xs.fontSize,
                      fontFamily: FONT_FAMILY,
                      lineHeight: 1.5,
                      marginTop: SPACE[2],
                    }}
                  >
                    Enable in viewer &rarr; click gene to load
                  </span>
                </div>
              </InfoPanel>
            </div>

            {/* 4. Transcript structure diagram */}
            <TranscriptDiagram gene={gene} symbol={symbol} />

            {/* 5. Open in Viewer button */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: SPACE[4] }}>
              <OpenInViewerButton href={viewerHref} />
            </div>
          </>
        )}
      </div>

      {/* 6. Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: `${SPACE[6]}px ${SPACE[4]}px`,
          borderTop: `1px solid ${COLOR.border.subtle}`,
        }}
      >
        <p
          style={{
            color: COLOR.text.faint,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            margin: 0,
          }}
        >
          {build} &middot; GENCODE v44 &middot; Polymer Genomics
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable bits
// ---------------------------------------------------------------------------

function StrandBadge({ strand }: { strand: string }) {
  const color   = strand === '+' ? COLOR.accent.teal : strand === '-' ? COLOR.accent.amber : COLOR.text.muted;
  const bgColor = strand === '+' ? 'rgba(78,205,196,0.10)' : strand === '-' ? 'rgba(240,165,0,0.10)' : 'transparent';
  const label   = strand === '+' ? '+ forward' : strand === '-' ? '− reverse' : strand;

  return (
    <span
      style={{
        color,
        backgroundColor: bgColor,
        border: `1px solid ${color}`,
        borderRadius: 2,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        padding: `1px ${SPACE[2]}px`,
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function OpenInViewerButton({ href }: { href: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE[3],
        padding: `${SPACE[3]}px ${SPACE[8]}px`,
        backgroundColor: hovered ? 'rgba(78,205,196,0.10)' : 'transparent',
        color: COLOR.accent.teal,
        border: `1px solid ${COLOR.accent.teal}`,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        fontSize: TYPE.base.fontSize,
        textDecoration: 'none',
        transition: 'background-color 0.15s',
        letterSpacing: '0.03em',
      }}
    >
      Open in Viewer &rarr;
    </Link>
  );
}
