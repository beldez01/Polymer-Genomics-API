'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchGene,
  fetchGeneCost,
  fetchSequence,
  fetchGeneConstraint,
  fetchProteinAbundance,
  fetchProteinAtlas,
  fetchGenePathways,
  fetchGeneSets,
} from '@/lib/api';
import type {
  GRanges,
  GeneCostData,
  GeneConstraintData,
  ProteinAbundanceData,
  ProteinAtlasData,
  GenePathwaysData,
  GeneSetsData,
} from '@/lib/api';
import {
  COLOR,
  WEIGHT,
  SPACE,
  FONT_FAMILY,
  COMPONENT,
} from '@/config/theme';
import {
  GC_TYPE,
  reverseComplement,
  translateSequence,
  computeCodonGC,
  gcFraction,
  fetchUniProtDomains,
} from './GeneCardData';
import type { ProteinDomain } from './GeneCardData';
import {
  GeneStructureDiagram,
  AAHistogram,
  ProteinCostHeatmap,
  CdsGCPlot,
  CostContextGauge,
  ExonIntronGCStats,
} from './GeneCardVisualizations';
import {
  ConstraintSection,
  ProteinAbundanceSection,
  ProteinAtlasSection,
  PathwaysSection,
  GeneSetsSection,
} from './GeneCardSectionsLP';

// ---------------------------------------------------------------------------
// Types (exported for visualization components)
// ---------------------------------------------------------------------------

interface TranscriptFeatures {
  transcript_id: string;
  featureCounts: Record<string, number>;
  features: { start: number; end: number; feature_type: string }[];
}

export interface ParsedGene {
  chr: string;
  geneStart: number;
  geneEnd: number;
  strand: string;
  geneLength: number;
  geneId: string;
  transcripts: TranscriptFeatures[];
  transcriptCount: number;
}

export interface CanonicalTranscript {
  transcriptId: string;
  cdsFeatures: { start: number; end: number; feature_type: string }[];
  allFeatures: { start: number; end: number; feature_type: string }[];
  totalCdsLength: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBp(n: number): string {
  return n.toLocaleString('en-US');
}

function formatNum(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function formatPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return (n * 100).toFixed(1) + '%';
}

function parseGRanges(gr: GRanges): ParsedGene | null {
  if (!gr || gr.n === 0) return null;

  const seqnames = gr.seqnames;
  const starts = gr.ranges.start;
  const ends = gr.ranges.end;
  const strands = gr.strand;
  const mcols = gr.mcols;

  const geneIds = (mcols['gene_id'] ?? []) as (string | null)[];
  const transcriptIds = (mcols['transcript_id'] ?? []) as (string | null)[];
  const featureTypes = (mcols['feature_type'] ?? []) as (string | null)[];

  const chr = seqnames[0] ?? 'chrUnknown';
  const strand = strands[0] ?? '*';
  const geneId = (geneIds.find(Boolean) ?? '') as string;

  let geneStart = Infinity;
  let geneEnd = -Infinity;
  for (let i = 0; i < gr.n; i++) {
    if (starts[i] < geneStart) geneStart = starts[i];
    if (ends[i] > geneEnd) geneEnd = ends[i];
  }

  const txMap = new Map<string, TranscriptFeatures>();
  for (let i = 0; i < gr.n; i++) {
    const txId = transcriptIds[i] ?? 'unknown';
    const ft = featureTypes[i] ?? 'unknown';
    if (!txMap.has(txId)) {
      txMap.set(txId, { transcript_id: txId, featureCounts: {}, features: [] });
    }
    const tx = txMap.get(txId)!;
    tx.featureCounts[ft] = (tx.featureCounts[ft] ?? 0) + 1;
    tx.features.push({ start: starts[i], end: ends[i], feature_type: ft });
  }

  return {
    chr,
    geneStart,
    geneEnd,
    strand,
    geneLength: geneEnd - geneStart + 1,
    geneId,
    transcripts: Array.from(txMap.values()),
    transcriptCount: txMap.size,
  };
}

// ---------------------------------------------------------------------------
// Find canonical transcript (best CDS length match to protein_length * 3)
// ---------------------------------------------------------------------------

function findCanonicalTranscript(
  gene: ParsedGene,
  expectedProteinLen: number | null,
): CanonicalTranscript | null {
  let best: CanonicalTranscript | null = null;
  let bestScore = -Infinity;

  for (const tx of gene.transcripts) {
    const cdsFeats = tx.features.filter(f => f.feature_type.toLowerCase() === 'cds');
    if (cdsFeats.length === 0) continue;

    const totalCds = cdsFeats.reduce((s, f) => s + (f.end - f.start + 1), 0);
    const candidate: CanonicalTranscript = {
      transcriptId: tx.transcript_id,
      cdsFeatures: cdsFeats,
      allFeatures: tx.features,
      totalCdsLength: totalCds,
    };

    if (expectedProteinLen != null) {
      // Score by closeness to expected CDS length
      const expectedCds = expectedProteinLen * 3;
      const diff = Math.abs(totalCds - expectedCds);
      const score = -diff; // closer = better
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    } else {
      // Fallback: longest CDS
      if (totalCds > bestScore) {
        bestScore = totalCds;
        best = candidate;
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[4]}px ${SPACE[5]}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[3],
    }}>
      <div style={{
        ...COMPONENT.sectionHeader,
        fontSize: GC_TYPE.sm,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: SPACE[1],
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KVRow({ label, value, labelWidth = 110 }: { label: string; value: React.ReactNode; labelWidth?: number }) {
  return (
    <div style={{ display: 'flex', gap: SPACE[3], alignItems: 'baseline', minWidth: 0 }}>
      <span style={{
        color: COLOR.text.muted,
        fontSize: GC_TYPE.sm,
        fontFamily: FONT_FAMILY,
        flexShrink: 0,
        width: labelWidth,
      }}>
        {label}
      </span>
      <span style={{
        color: COLOR.text.secondary,
        fontSize: GC_TYPE.sm,
        fontFamily: FONT_FAMILY,
        wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}

function StrandBadge({ strand }: { strand: string }) {
  const color = strand === '+' ? COLOR.accent.teal : strand === '-' ? COLOR.accent.amber : COLOR.text.muted;
  const bgColor = strand === '+' ? 'rgba(78,205,196,0.10)' : strand === '-' ? 'rgba(240,165,0,0.10)' : 'transparent';
  const label = strand === '+' ? '+ forward' : strand === '-' ? '− reverse' : strand;
  return (
    <span style={{
      color,
      backgroundColor: bgColor,
      border: `1px solid ${color}`,
      borderRadius: 2,
      fontSize: GC_TYPE.xs,
      fontFamily: FONT_FAMILY,
      padding: `1px ${SPACE[2]}px`,
      letterSpacing: '0.05em',
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

function CostBar({ fracs }: { fracs: { frac: number | null; color: string; label: string }[] }) {
  const total = fracs.reduce((s, f) => s + (f.frac ?? 0), 0);
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', height: 8, width: '100%', overflow: 'hidden' }}>
      {fracs.map((f) => {
        const pct = ((f.frac ?? 0) / total) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={f.label}
            title={`${f.label}: ${formatPct(f.frac)}`}
            style={{
              width: `${pct}%`,
              backgroundColor: f.color,
              minWidth: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function LargeCostBar({ fracs }: { fracs: { frac: number | null; color: string; label: string }[] }) {
  const total = fracs.reduce((s, f) => s + (f.frac ?? 0), 0);
  if (total === 0) return null;
  return (
    <div>
      <div style={{ display: 'flex', height: 16, width: '100%', overflow: 'hidden', marginBottom: SPACE[2] }}>
        {fracs.map((f) => {
          const pct = ((f.frac ?? 0) / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={f.label}
              style={{
                width: `${pct}%`,
                backgroundColor: f.color,
                minWidth: 1,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: SPACE[4], flexWrap: 'wrap' }}>
        {fracs.map((f) => (
          <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] }}>
            <div style={{ width: 8, height: 8, backgroundColor: f.color, flexShrink: 0 }} />
            <span style={{
              color: COLOR.text.muted,
              fontSize: GC_TYPE.xs,
              fontFamily: FONT_FAMILY,
            }}>
              {f.label} {formatPct(f.frac)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaugeBar({ label, value, max = 1 }: { label: string; value: number | null; max?: number }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], minWidth: 0 }}>
      <span style={{
        color: COLOR.text.muted,
        fontSize: GC_TYPE.xs,
        fontFamily: FONT_FAMILY,
        width: 36,
        flexShrink: 0,
        textTransform: 'uppercase' as const,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: 6,
        backgroundColor: COLOR.border.subtle,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: COLOR.accent.teal,
        }} />
      </div>
      <span style={{
        color: COLOR.text.secondary,
        fontSize: GC_TYPE.xs,
        fontFamily: FONT_FAMILY,
        width: 48,
        textAlign: 'right' as const,
        flexShrink: 0,
      }}>
        {formatNum(value, 3)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transcript Diagram (existing, font bump)
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 28;
const ROW_GAP = 8;
const LABEL_WIDTH = 130;
const MAX_TX = 8;

function TranscriptDiagram({ gene, symbol }: { gene: ParsedGene; symbol: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const txRows = gene.transcripts.slice(0, MAX_TX);
  const canvasHeight = txRows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const trackW = W - LABEL_WIDTH;
    const gStart = gene.geneStart;
    const gEnd = gene.geneEnd;
    const gLen = gEnd - gStart + 1;

    function toX(bp: number): number {
      return LABEL_WIDTH + ((bp - gStart) / gLen) * trackW;
    }

    txRows.forEach((tx, rowIdx) => {
      const y = ROW_GAP + rowIdx * (ROW_HEIGHT + ROW_GAP);
      const cy = y + ROW_HEIGHT / 2;

      const labelText = tx.transcript_id.replace(/\.[0-9]+$/, '');
      const maxLabelChars = Math.floor((LABEL_WIDTH - 8) / 6.5);
      const truncLabel = labelText.length > maxLabelChars
        ? labelText.slice(0, maxLabelChars - 1) + '\u2026'
        : labelText;

      ctx.font = `${GC_TYPE.xs}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLOR.text.tertiary;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncLabel, LABEL_WIDTH - 6, cy);

      const x0 = toX(gStart);
      const x1 = toX(gEnd);
      ctx.strokeStyle = COLOR.border.strong;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.lineTo(x1, cy);
      ctx.stroke();

      tx.features.forEach((feat) => {
        const fx0 = toX(feat.start);
        const fx1 = toX(feat.end);
        const fw = Math.max(1, fx1 - fx0);
        const ft = (feat.feature_type ?? '').toLowerCase();

        if (ft === 'cds') {
          ctx.fillStyle = COLOR.layer.gencode_v44;
          ctx.fillRect(fx0, cy - ROW_HEIGHT * 0.35, fw, ROW_HEIGHT * 0.7);
        } else if (ft === 'exon' || ft === 'utr' || ft.includes('utr') || ft === 'start_codon' || ft === 'stop_codon') {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
          ctx.fillRect(fx0, cy - ROW_HEIGHT * 0.28, fw, ROW_HEIGHT * 0.56);
        }
      });

      const arrowX = gene.strand === '-' ? x0 - 2 : x1 + 2;
      const arrowDir = gene.strand === '-' ? -1 : 1;
      const arrowLen = 6;
      const arrowHead = 3;
      ctx.strokeStyle = COLOR.text.tertiary;
      ctx.lineWidth = 1;
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
      if (containerRef.current) setWidth(containerRef.current.clientWidth);
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { draw(); }, [draw, width]);

  return (
    <div ref={containerRef} style={{
      backgroundColor: COLOR.bg.track,
      border: `1px solid ${COLOR.border.subtle}`,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          ...COMPONENT.sectionHeader,
          fontSize: GC_TYPE.sm,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
        }}>
          Transcript Structure
        </span>
        <span style={{
          color: COLOR.text.muted,
          fontSize: GC_TYPE.xs,
          fontFamily: FONT_FAMILY,
        }}>
          {gene.strand === '+' ? 'forward strand (+)' : gene.strand === '-' ? 'reverse strand (−)' : 'strand unknown'} &nbsp;&middot;&nbsp; {symbol}
        </span>
      </div>

      <div style={{
        padding: `${SPACE[2]}px ${SPACE[4]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        display: 'flex',
        gap: SPACE[5],
        alignItems: 'center',
      }}>
        {[
          { color: COLOR.layer.gencode_v44, label: 'CDS', h: 10 },
          { color: 'rgba(59,130,246,0.45)', label: 'Exon / UTR', h: 7 },
          { color: COLOR.border.strong, label: 'Intron', h: 1 },
        ].map(({ color, label, h }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
            <div style={{ width: 14, height: h, backgroundColor: color, flexShrink: 0 }} />
            <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.xs, fontFamily: FONT_FAMILY }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: canvasHeight, imageRendering: 'crisp-edges' }}
      />

      {gene.transcriptCount > MAX_TX && (
        <div style={{
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          borderTop: `1px solid ${COLOR.border.subtle}`,
          color: COLOR.text.muted,
          fontSize: GC_TYPE.xs,
          fontFamily: FONT_FAMILY,
        }}>
          Showing {MAX_TX} of {gene.transcriptCount} transcripts
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tissue Expression (existing, font bump)
// ---------------------------------------------------------------------------

function TissueExpression({ expression }: { expression: GeneCostData['expression'] }) {
  const maxEwgc = Math.max(...expression.tissues.map(t => t.ewgc ?? 0), 1);

  const TISSUE_LABELS: Record<string, string> = {
    adipose: 'Adipose', artery: 'Artery', brain: 'Brain', breast: 'Breast',
    colon: 'Colon', esophagus: 'Esophagus', heart: 'Heart', kidney: 'Kidney',
    liver: 'Liver', lung: 'Lung', muscle: 'Muscle', nerve: 'Nerve',
    ovary: 'Ovary', pancreas: 'Pancreas', pituitary: 'Pituitary', prostate: 'Prostate',
    skin: 'Skin', small_intestine: 'Sm. Intestine', spleen: 'Spleen', stomach: 'Stomach',
    testis: 'Testis', thyroid: 'Thyroid', uterus: 'Uterus', whole_blood: 'Whole Blood',
  };

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[4]}px ${SPACE[5]}px`,
    }}>
      <div style={{
        ...COMPONENT.sectionHeader,
        fontSize: GC_TYPE.sm,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: SPACE[3],
      }}>
        Tissue Expression (GTEx)
      </div>

      <div style={{
        display: 'flex',
        gap: SPACE[6],
        marginBottom: SPACE[4],
      }}>
        <KVRow label="Mean TPM" value={formatNum(expression.mean_tpm, 1)} labelWidth={80} />
        <KVRow label="Max TPM" value={formatNum(expression.max_tpm, 1)} labelWidth={80} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {expression.tissues.map((t, i) => {
          const pct = ((t.ewgc ?? 0) / maxEwgc) * 100;
          const isTop5 = i < 5;
          return (
            <div key={t.tissue} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
              <span style={{
                color: COLOR.text.muted,
                fontSize: GC_TYPE.xs,
                fontFamily: FONT_FAMILY,
                width: 100,
                flexShrink: 0,
                textAlign: 'right' as const,
              }}>
                {TISSUE_LABELS[t.tissue] ?? t.tissue}
              </span>
              <div style={{
                flex: 1,
                height: 12,
                backgroundColor: COLOR.border.subtle,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: COLOR.layer.gene_costs_v1,
                  opacity: isTop5 ? 1 : 0.4,
                }} />
              </div>
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: GC_TYPE.xs,
                fontFamily: FONT_FAMILY,
                width: 56,
                textAlign: 'right' as const,
                flexShrink: 0,
              }}>
                {t.tpm != null ? t.tpm.toFixed(1) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading / Error
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 320,
      gap: SPACE[3],
    }}>
      <div style={{
        width: 32,
        height: 2,
        backgroundColor: COLOR.border.strong,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '60%',
          backgroundColor: COLOR.accent.teal,
          animation: 'gcSlide 1.2s ease-in-out infinite',
        }} />
      </div>
      <span style={{
        color: COLOR.text.muted,
        fontSize: GC_TYPE.base,
        fontFamily: FONT_FAMILY,
      }}>
        Loading gene data&hellip;
      </span>
      <style>{`
        @keyframes gcSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 320,
      gap: SPACE[4],
      padding: SPACE[8],
    }}>
      <span style={{
        color: COLOR.text.faint,
        fontSize: GC_TYPE['2xl'],
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.bold,
        letterSpacing: '-0.03em',
      }}>
        404
      </span>
      <span style={{
        color: COLOR.text.tertiary,
        fontSize: GC_TYPE.base,
        fontFamily: FONT_FAMILY,
        textAlign: 'center',
        maxWidth: 400,
      }}>
        {message}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section loading / empty states
// ---------------------------------------------------------------------------

function SectionLoading({ label }: { label: string }) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[5]}px ${SPACE[5]}px`,
      display: 'flex',
      alignItems: 'center',
      gap: SPACE[3],
    }}>
      <div style={{
        width: 16, height: 2,
        backgroundColor: COLOR.border.strong,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%', width: '60%',
          backgroundColor: COLOR.accent.teal,
          animation: 'gcSlide 1.2s ease-in-out infinite',
        }} />
      </div>
      <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>
        Loading {label}&hellip;
      </span>
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[5]}px ${SPACE[5]}px`,
      textAlign: 'center',
    }}>
      <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>
        No {label.toLowerCase()} data available for this gene.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GeneCard
// ---------------------------------------------------------------------------

interface GeneCardProps {
  symbol: string;
  build: string;
  onBack: () => void;
  standalone?: boolean;
}

export function GeneCard({ symbol, build, onBack, standalone = false }: GeneCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gene, setGene] = useState<ParsedGene | null>(null);
  const [cost, setCost] = useState<GeneCostData | null>(null);

  // New sequence-derived state
  const [proteinSeq, setProteinSeq] = useState<string | null>(null);
  const [cdsNucleotides, setCdsNucleotides] = useState<string | null>(null);
  const [canonicalTranscript, setCanonicalTranscript] = useState<CanonicalTranscript | null>(null);
  const [exonGC, setExonGC] = useState<number | null>(null);
  const [intronGC, setIntronGC] = useState<number | null>(null);
  const [codonGC, setCodonGC] = useState<number[] | null>(null);
  const [seqLoading, setSeqLoading] = useState(false);
  const [seqSkipped, setSeqSkipped] = useState<string | null>(null);
  const [domains, setDomains] = useState<ProteinDomain[] | null>(null);

  // Sections L–P data
  const [constraintData, setConstraintData] = useState<GeneConstraintData | null>(null);
  const [abundanceData, setAbundanceData] = useState<ProteinAbundanceData | null>(null);
  const [atlasData, setAtlasData] = useState<ProteinAtlasData | null>(null);
  const [pathwaysData, setPathwaysData] = useState<GenePathwaysData | null>(null);
  const [geneSetsData, setGeneSetsData] = useState<GeneSetsData | null>(null);

  // Section loading status
  const [sectionStatus, setSectionStatus] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({
    constraint: 'loading',
    abundance: 'loading',
    atlas: 'loading',
    pathways: 'loading',
    geneSets: 'loading',
  });

  // Phase 1: fetch gene + cost
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const upperSymbol = symbol.toUpperCase();

    Promise.all([
      fetchGene(build, upperSymbol),
      fetchGeneCost(build, upperSymbol).catch(() => null),
    ])
      .then(([geneRes, costRes]) => {
        if (cancelled) return;

        const rawData = geneRes.data as unknown;
        const geneGR: GRanges | null =
          rawData && typeof rawData === 'object' && 'class' in (rawData as Record<string, unknown>) && (rawData as Record<string, unknown>)['class'] === 'GRanges'
            ? (rawData as GRanges)
            : (rawData as Record<string, GRanges>)?.['gencode_v44'] ??
              (Object.values((rawData ?? {}) as Record<string, unknown>)[0] as GRanges | undefined) ??
              null;

        if (!geneGR || geneGR.n === 0) {
          setError(`No data found for gene "${upperSymbol}" in build ${build}.`);
          setLoading(false);
          return;
        }

        const parsed = parseGRanges(geneGR);
        if (!parsed) {
          setError(`Could not parse gene data for "${upperSymbol}".`);
          setLoading(false);
          return;
        }

        setGene(parsed);
        setCost(costRes?.data ?? null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? `Gene "${upperSymbol}" not found.`);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [build, symbol]);

  // Phase 1b: fetch sections L–P (constraint, abundance, atlas, pathways, gene sets)
  // Fire-and-forget in parallel — each section handles its own null state gracefully
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const upperSymbol = symbol.toUpperCase();

    // Reset all section statuses
    setSectionStatus({ constraint: 'loading', abundance: 'loading', atlas: 'loading', pathways: 'loading', geneSets: 'loading' });

    // All fetches are independent — fire in parallel, catch individually
    fetchGeneConstraint(build, upperSymbol)
      .then(res => { if (!cancelled) { setConstraintData(res.data); setSectionStatus(s => ({ ...s, constraint: 'loaded' })); } })
      .catch(() => { if (!cancelled) setSectionStatus(s => ({ ...s, constraint: 'error' })); });

    fetchProteinAbundance(build, upperSymbol)
      .then(res => { if (!cancelled) { setAbundanceData(res.data); setSectionStatus(s => ({ ...s, abundance: 'loaded' })); } })
      .catch(() => { if (!cancelled) setSectionStatus(s => ({ ...s, abundance: 'error' })); });

    fetchProteinAtlas(build, upperSymbol)
      .then(res => { if (!cancelled) { setAtlasData(res.data); setSectionStatus(s => ({ ...s, atlas: 'loaded' })); } })
      .catch(() => { if (!cancelled) setSectionStatus(s => ({ ...s, atlas: 'error' })); });

    fetchGenePathways(build, upperSymbol)
      .then(res => { if (!cancelled) { setPathwaysData(res.data); setSectionStatus(s => ({ ...s, pathways: 'loaded' })); } })
      .catch(() => { if (!cancelled) setSectionStatus(s => ({ ...s, pathways: 'error' })); });

    fetchGeneSets(build, upperSymbol)
      .then(res => { if (!cancelled) { setGeneSetsData(res.data); setSectionStatus(s => ({ ...s, geneSets: 'loaded' })); } })
      .catch(() => { if (!cancelled) setSectionStatus(s => ({ ...s, geneSets: 'error' })); });

    return () => { cancelled = true; };
  }, [build, symbol]);

  // Phase 1c: fetch UniProt domains
  useEffect(() => {
    if (!cost?.identity.uniprot_id) return;
    let cancelled = false;
    fetchUniProtDomains(cost.identity.uniprot_id)
      .then((result) => {
        if (!cancelled) setDomains(result);
      })
      .catch(() => {
        // Silently skip on failure
      });
    return () => { cancelled = true; };
  }, [cost]);

  // Phase 2: find canonical transcript + fetch sequence + translate
  useEffect(() => {
    if (!gene) return;

    const proteinLen = cost?.identity.protein_length ?? null;

    // Find canonical transcript (works even without cost data)
    let ct = findCanonicalTranscript(gene, proteinLen);

    // Fallback for lncRNAs / non-coding: use longest transcript's features
    if (!ct) {
      const longestTx = gene.transcripts.reduce<TranscriptFeatures | null>((best, tx) => {
        const len = tx.features.reduce((s, f) => s + (f.end - f.start + 1), 0);
        const bestLen = best ? best.features.reduce((s, f) => s + (f.end - f.start + 1), 0) : 0;
        return len > bestLen ? tx : best;
      }, null);
      if (longestTx) {
        ct = {
          transcriptId: longestTx.transcript_id,
          cdsFeatures: [],
          allFeatures: longestTx.features,
          totalCdsLength: 0,
        };
      }
    }

    if (ct) setCanonicalTranscript(ct);

    // If no cost data or no CDS, skip sequence-derived sections
    if (!cost || !ct || ct.cdsFeatures.length === 0) {
      if (!cost) return; // no cost = nothing more to do
      setSeqSkipped('No protein-coding transcript found.');
      return;
    }

    // Guard: gene > 100kb → skip sequence fetch
    if (gene.geneLength > 100_000) {
      setSeqSkipped(`Gene spans ${formatBp(gene.geneLength)} bp (>100kb limit). Sequence-derived sections unavailable.`);
      return;
    }

    let cancelled = false;
    setSeqLoading(true);

    const region = `${gene.chr}:${gene.geneStart}-${gene.geneEnd}`;
    fetchSequence(build, region)
      .then((seqRes) => {
        if (cancelled) return;
        const genomicSeq = seqRes.sequence;

        // Extract CDS subsequences
        const cdsSorted = ct.cdsFeatures.slice().sort((a, b) => a.start - b.start);
        let cdsSeq = '';
        for (const cds of cdsSorted) {
          const relStart = cds.start - gene.geneStart;
          const relEnd = cds.end - gene.geneStart + 1;
          cdsSeq += genomicSeq.slice(relStart, relEnd);
        }

        // Strand handling
        if (gene.strand === '-') {
          cdsSeq = reverseComplement(cdsSeq);
        }

        // Translate
        const protein = translateSequence(cdsSeq);
        if (cost.identity.protein_length != null && Math.abs(protein.length - cost.identity.protein_length) > 1) {
          console.warn(`Translation mismatch: got ${protein.length} aa, expected ${cost.identity.protein_length}`);
        }

        setCdsNucleotides(cdsSeq);
        setProteinSeq(protein);
        setCodonGC(computeCodonGC(cdsSeq));

        // Compute exon/intron GC
        let exonBases = '';
        let intronBases = '';

        // All exon regions for this transcript
        const exonFeats = ct.allFeatures
          .filter(f => {
            const ft = f.feature_type.toLowerCase();
            return ft === 'cds' || ft === 'exon' || ft.includes('utr');
          })
          .sort((a, b) => a.start - b.start);

        for (const feat of exonFeats) {
          const relStart = feat.start - gene.geneStart;
          const relEnd = feat.end - gene.geneStart + 1;
          exonBases += genomicSeq.slice(relStart, relEnd);
        }

        // Intron = gene region minus exon regions
        const exonCoverage = new Set<number>();
        for (const feat of exonFeats) {
          for (let pos = feat.start; pos <= feat.end; pos++) {
            exonCoverage.add(pos);
          }
        }
        // Collect intron bases by excluding exonic positions
        for (let pos = gene.geneStart; pos <= gene.geneEnd; pos++) {
          if (!exonCoverage.has(pos)) {
            intronBases += genomicSeq[pos - gene.geneStart] ?? '';
          }
        }

        setExonGC(gcFraction(exonBases));
        setIntronGC(intronBases.length > 0 ? gcFraction(intronBases) : 0);
        setSeqLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Sequence fetch failed:', err);
        setSeqSkipped('Sequence data unavailable.');
        setSeqLoading(false);
      });

    return () => { cancelled = true; };
  }, [gene, cost, build]);

  const upperSymbol = symbol.toUpperCase();
  const PAD = 5000;
  const viewerHref = gene
    ? `/view/${build}/${gene.chr}:${Math.max(1, gene.geneStart - PAD)}-${gene.geneEnd + PAD}`
    : '#';
  const geneDetailHref = `/gene/${build}/${upperSymbol}`;

  const costFracs = cost ? [
    { frac: cost.composition.frac_cheap, color: COLOR.cost.cheap, label: 'Cheap' },
    { frac: cost.composition.frac_moderate, color: COLOR.cost.moderate, label: 'Moderate' },
    { frac: cost.composition.frac_expensive, color: COLOR.cost.expensive, label: 'Expensive' },
    { frac: cost.composition.frac_very_expensive, color: COLOR.cost.very_expensive, label: 'Very Expensive' },
  ] : [];

  const hasCds = canonicalTranscript != null && (canonicalTranscript.cdsFeatures.length > 0);
  const hasSequenceData = proteinSeq != null && proteinSeq.length > 0;

  return (
    <div style={{
      maxWidth: 1100,
      width: '100%',
      margin: '0 auto',
      padding: `${SPACE[6]}px ${SPACE[6]}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[5],
    }}>
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && gene && (
        <>
          {/* A. Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], flexWrap: 'wrap' }}>
              {!standalone && (
                <button
                  onClick={onBack}
                  style={{
                    ...COMPONENT.button.ghost,
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    fontSize: GC_TYPE.sm,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = COLOR.accent.teal;
                    e.currentTarget.style.color = COLOR.accent.teal;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = COLOR.border.strong;
                    e.currentTarget.style.color = COLOR.text.secondary;
                  }}
                >
                  &larr; Back
                </button>
              )}
              <h1 style={{
                fontSize: GC_TYPE['2xl'],
                fontWeight: WEIGHT.bold,
                letterSpacing: '-0.03em',
                color: COLOR.text.primary,
                fontFamily: FONT_FAMILY,
                margin: 0,
                lineHeight: 1.2,
              }}>
                {upperSymbol}
              </h1>
              <span style={{
                color: COLOR.text.tertiary,
                fontSize: GC_TYPE.md,
                fontFamily: FONT_FAMILY,
              }}>
                {gene.chr}:{formatBp(gene.geneStart)}–{formatBp(gene.geneEnd)}
              </span>
              <StrandBadge strand={gene.strand} />
            </div>
            <div style={{ display: 'flex', gap: SPACE[4], alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>
                {gene.transcriptCount} transcript{gene.transcriptCount !== 1 ? 's' : ''}
              </span>
              <span style={{ color: COLOR.text.faint, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>&middot;</span>
              <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>
                {formatBp(gene.geneLength)} bp
              </span>
              {cost?.identity.protein_name && (
                <>
                  <span style={{ color: COLOR.text.faint, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>&middot;</span>
                  <span style={{ color: COLOR.text.tertiary, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY }}>
                    {cost.identity.protein_name}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* B. Gene Structure Diagram + Domain Annotations */}
          {canonicalTranscript && (
            <GeneStructureDiagram gene={gene} canonical={canonicalTranscript} domains={domains} />
          )}

          {/* C. Protein Identity (left) + AA Histogram (right) */}
          {cost ? (
            <div style={{ display: 'flex', gap: SPACE[4], flexWrap: 'wrap', alignItems: 'stretch' }}>
              <InfoPanel title="Protein Identity">
                {cost.identity.uniprot_id && (
                  <KVRow label="UniProt" value={cost.identity.uniprot_id} />
                )}
                {cost.identity.protein_name && (
                  <KVRow label="Protein" value={cost.identity.protein_name} />
                )}
                <KVRow label="Length" value={cost.identity.protein_length != null ? `${cost.identity.protein_length} aa` : '—'} />
                <KVRow label="MW" value={cost.elemental.mw_kda != null ? `${formatNum(cost.elemental.mw_kda, 1)} kDa` : '—'} />
                <KVRow label="Cost/kDa" value={formatNum(cost.elemental.cost_per_kda, 1)} />
                <KVRow label="N atoms" value={cost.elemental.n_protein?.toString() ?? '—'} />
                <KVRow label="S atoms" value={cost.elemental.s_protein?.toString() ?? '—'} />
                <KVRow label="C atoms" value={cost.elemental.c_atoms?.toString() ?? '—'} />
              </InfoPanel>

              {/* AA Histogram */}
              <div style={{
                flex: 1,
                minWidth: 280,
                backgroundColor: COLOR.bg.elevated,
                border: `1px solid ${COLOR.border.subtle}`,
                padding: `${SPACE[4]}px ${SPACE[5]}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE[3],
              }}>
                <div style={{
                  ...COMPONENT.sectionHeader,
                  fontSize: GC_TYPE.sm,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  marginBottom: SPACE[1],
                }}>
                  Amino Acid Composition
                </div>
                {hasSequenceData ? (
                  <AAHistogram proteinSeq={proteinSeq!} />
                ) : seqLoading ? (
                  <div style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY, padding: SPACE[4] }}>
                    Loading sequence&hellip;
                  </div>
                ) : (
                  <>
                    <LargeCostBar fracs={costFracs} />
                    <div style={{ color: COLOR.text.muted, fontSize: GC_TYPE.xs, fontFamily: FONT_FAMILY }}>
                      {seqSkipped ?? 'Sequence unavailable — showing tier fractions only.'}
                    </div>
                    <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap', marginTop: SPACE[2] }}>
                      <KVRow label="Cys" value={cost.composition.n_cys?.toString() ?? '—'} labelWidth={36} />
                      <KVRow label="Met" value={cost.composition.n_met?.toString() ?? '—'} labelWidth={36} />
                      <KVRow label="Trp" value={cost.composition.n_trp?.toString() ?? '—'} labelWidth={36} />
                      <KVRow label="Arg" value={cost.composition.n_arg?.toString() ?? '—'} labelWidth={36} />
                      <KVRow label="Lys" value={cost.composition.n_lys?.toString() ?? '—'} labelWidth={36} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: COLOR.bg.elevated,
              border: `1px solid ${COLOR.border.subtle}`,
              padding: `${SPACE[6]}px ${SPACE[5]}px`,
              textAlign: 'center',
            }}>
              <span style={{
                color: COLOR.text.muted,
                fontSize: GC_TYPE.sm,
                fontFamily: FONT_FAMILY,
              }}>
                No bioenergetic data available for this gene.
              </span>
            </div>
          )}

          {/* D. Protein Sequence Cost Heatmap */}
          {hasSequenceData && (
            <ProteinCostHeatmap proteinSeq={proteinSeq!} />
          )}

          {/* E. Biosynthetic Cost with Context */}
          {cost && (
            <InfoPanel title="Biosynthetic Cost">
              <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap' }}>
                <KVRow label="ECPA (B20)" value={`${formatNum(cost.biosynthetic_cost.ecpa_b20)} ATP/aa`} />
                <KVRow label="ECPA (H11)" value={`${formatNum(cost.biosynthetic_cost.ecpa_h11)} ATP/aa`} />
              </div>
              <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap' }}>
                <KVRow label="C_protein" value={formatNum(cost.biosynthetic_cost.c_protein, 1)} />
                <KVRow label="C_aa_synth" value={formatNum(cost.biosynthetic_cost.c_aa_synthesis, 1)} />
                <KVRow label="C_translation" value={formatNum(cost.biosynthetic_cost.c_translation, 1)} />
              </div>
              {cost.biosynthetic_cost.ecpa_b20 != null && (
                <CostContextGauge ecpa={cost.biosynthetic_cost.ecpa_b20} />
              )}
              <LargeCostBar fracs={costFracs} />
            </InfoPanel>
          )}

          {/* F. CDS GC Content Plot */}
          {codonGC && codonGC.length > 0 && cdsNucleotides && (
            <CdsGCPlot codonGC={codonGC} cdsGCAvg={gcFraction(cdsNucleotides)} />
          )}

          {/* G. Exon/Intron GC Stats */}
          {exonGC != null && intronGC != null && (
            <ExonIntronGCStats exonGC={exonGC} intronGC={intronGC} />
          )}

          {/* H. Codon Optimization */}
          {cost && (
            <InfoPanel title="Codon Optimization">
              <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap', marginBottom: SPACE[2] }}>
                <KVRow label="CDS length" value={cost.codon_optimization.cds_length_nt != null ? `${formatBp(cost.codon_optimization.cds_length_nt)} nt` : '—'} />
                <KVRow label="Codons" value={cost.codon_optimization.n_codons?.toString() ?? '—'} labelWidth={60} />
                <KVRow label="GC₃" value={formatPct(cost.codon_optimization.gc3)} labelWidth={36} />
                <KVRow label="GC_CDS" value={formatPct(cost.codon_optimization.gc_cds)} labelWidth={60} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
                <GaugeBar label="CAI" value={cost.codon_optimization.cai} />
                <GaugeBar label="tAI" value={cost.codon_optimization.tai} />
                <GaugeBar label="ENC" value={cost.codon_optimization.enc} max={61} />
                <GaugeBar label="FOP" value={cost.codon_optimization.fop} />
              </div>
            </InfoPanel>
          )}

          {/* I. Transcript Structure */}
          <TranscriptDiagram gene={gene} symbol={upperSymbol} />

          {/* J. Tissue Expression */}
          {cost && <TissueExpression expression={cost.expression} />}

          {/* L. Evolutionary Constraint (gnomAD) */}
          {constraintData ? <ConstraintSection data={constraintData} />
            : sectionStatus.constraint === 'loading' ? <SectionLoading label="Evolutionary Constraint" />
            : <EmptySection label="Evolutionary Constraint" />}

          {/* M. Protein Abundance (PaxDb) */}
          {abundanceData ? <ProteinAbundanceSection data={abundanceData} />
            : sectionStatus.abundance === 'loading' ? <SectionLoading label="Protein Abundance" />
            : <EmptySection label="Protein Abundance" />}

          {/* N. Protein Atlas (HPA) */}
          {atlasData ? <ProteinAtlasSection data={atlasData} />
            : sectionStatus.atlas === 'loading' ? <SectionLoading label="Protein Atlas" />
            : <EmptySection label="Protein Atlas" />}

          {/* O. Pathways (Reactome) */}
          {pathwaysData ? <PathwaysSection data={pathwaysData} />
            : sectionStatus.pathways === 'loading' ? <SectionLoading label="Pathways" />
            : <EmptySection label="Pathways" />}

          {/* P. Gene Sets (MSigDB Hallmark) */}
          {geneSetsData ? <GeneSetsSection data={geneSetsData} />
            : sectionStatus.geneSets === 'loading' ? <SectionLoading label="Gene Sets" />
            : <EmptySection label="Gene Sets" />}

          {/* K. Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: SPACE[4],
            paddingTop: SPACE[2],
            paddingBottom: SPACE[4],
            flexWrap: 'wrap',
          }}>
            <FooterLink href={viewerHref} label="Open in Viewer &rarr;" />
            {!standalone && <FooterLink href={geneDetailHref} label="View Gene Detail &rarr;" />}
          </div>
        </>
      )}
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
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
        fontSize: GC_TYPE.base,
        textDecoration: 'none',
        transition: 'background-color 0.15s',
        letterSpacing: '0.03em',
      }}
    >
      {label}
    </Link>
  );
}
