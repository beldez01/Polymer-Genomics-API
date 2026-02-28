'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';
import { drawTrackLabel } from '@/lib/trackLabel';

const EXON_HEIGHT = 20;
const UTR_HEIGHT = 12;
const INTRON_HEIGHT = 2;
const GENE_COLOR = '#3b82f6';
const GENE_COLOR_MINUS = '#a78bfa';
const LABEL_COLOR = COLORS.canvas.featureLabel;
const ROW_HEIGHT = 40;

export interface GeneTrackProps {
  data: GRanges | undefined;
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

interface Feature {
  start: number;
  end: number;
  strand: string;
  type: string | null;
  geneSymbol: string | null;
  transcriptId: string | null;
}

function groupByTranscript(features: Feature[]): Map<string, Feature[]> {
  const map = new Map<string, Feature[]>();
  for (const f of features) {
    const key = f.transcriptId ?? f.geneSymbol ?? '_unknown_';
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(f);
  }
  return map;
}

export function GeneTrack({
  data,
  viewStart,
  viewEnd,
  canvasWidth,
  height: heightProp,
}: GeneTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const features: Feature[] = [];
    if (data && data.n > 0) {
      for (let i = 0; i < data.n; i++) {
        features.push({
          start: data.ranges.start[i],
          end: data.ranges.end[i],
          strand: data.strand[i] ?? '*',
          type: (data.mcols.feature_type?.[i] as string) ?? null,
          geneSymbol: (data.mcols.gene_symbol?.[i] as string) ?? null,
          transcriptId: (data.mcols.transcript_id?.[i] as string) ?? null,
        });
      }
    }

    const transcripts = groupByTranscript(features);
    const rowCount = Math.max(1, transcripts.size);
    const height = heightProp ?? Math.min(rowCount * ROW_HEIGHT + 10, 200);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);
    drawGridlines(ctx, viewStart, viewEnd, canvasWidth, height);

    if (features.length === 0) {
      ctx.fillStyle = COLORS.canvas.emptyText;
      ctx.font = "12px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('No gene annotations in view', canvasWidth / 2, height / 2 + 4);
      return;
    }

    const toX = (pos: number) => genomicToPixel(pos, viewStart, viewEnd, canvasWidth);
    const bpW = basePairWidth(viewStart, viewEnd, canvasWidth);

    let rowIdx = 0;
    for (const [, txFeatures] of transcripts) {
      const yCenter = 20 + rowIdx * ROW_HEIGHT;
      const strand = txFeatures[0]?.strand ?? '+';
      const color = strand === '-' ? GENE_COLOR_MINUS : GENE_COLOR;

      let txMin = Infinity;
      let txMax = -Infinity;
      for (const f of txFeatures) {
        if (f.start < txMin) txMin = f.start;
        if (f.end > txMax) txMax = f.end;
      }

      const lineX1 = Math.max(0, toX(txMin));
      const lineX2 = Math.min(canvasWidth, toX(txMax + 1));
      ctx.strokeStyle = color;
      ctx.lineWidth = INTRON_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(lineX1, yCenter);
      ctx.lineTo(lineX2, yCenter);
      ctx.stroke();

      const arrowChar = strand === '-' ? '<' : '>';
      ctx.fillStyle = color;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const arrowStep = Math.max(30, bpW * 20);
      for (let ax = lineX1 + 15; ax < lineX2 - 10; ax += arrowStep) {
        ctx.fillText(arrowChar, ax, yCenter);
      }

      for (const f of txFeatures) {
        const x1 = Math.max(0, toX(f.start));
        const x2 = Math.min(canvasWidth, toX(f.end + 1));
        const w = Math.max(1, x2 - x1);

        const featureType = f.type?.toLowerCase() ?? '';

        if (featureType.includes('utr') || featureType === 'utr5' || featureType === 'utr3') {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(x1, yCenter - UTR_HEIGHT / 2, w, UTR_HEIGHT);
          ctx.globalAlpha = 1.0;
        } else if (featureType === 'exon' || featureType === 'cds') {
          ctx.fillStyle = color;
          ctx.fillRect(x1, yCenter - EXON_HEIGHT / 2, w, EXON_HEIGHT);
        }
      }

      // --- Splice site markers (when zoom >= 0.5 px/bp) ---
      if (bpW >= 0.5) {
        const exonFeatures = txFeatures
          .filter(f => {
            const ft = f.type?.toLowerCase() ?? '';
            return ft === 'exon' || ft === 'cds';
          })
          .sort((a, b) => a.start - b.start);

        // Deduplicate by position
        const uniqueExons: Feature[] = [];
        const seenPos = new Set<string>();
        for (const e of exonFeatures) {
          const key = `${e.start}-${e.end}`;
          if (!seenPos.has(key)) { seenPos.add(key); uniqueExons.push(e); }
        }

        const triSize = 4;
        for (let ei = 0; ei < uniqueExons.length; ei++) {
          // Acceptor (exon start) — skip first exon
          if (ei > 0) {
            const ax = toX(uniqueExons[ei].start);
            if (ax >= 0 && ax <= canvasWidth) {
              const accColor = strand === '-' ? '#F43F5E' : '#22c55e';
              ctx.fillStyle = accColor;
              ctx.beginPath();
              ctx.moveTo(ax, yCenter + EXON_HEIGHT / 2 + 2);
              ctx.lineTo(ax - triSize, yCenter + EXON_HEIGHT / 2 + 2 + triSize);
              ctx.lineTo(ax + triSize, yCenter + EXON_HEIGHT / 2 + 2 + triSize);
              ctx.closePath();
              ctx.fill();
            }
          }

          // Donor (exon end) — skip last exon
          if (ei < uniqueExons.length - 1) {
            const dx = toX(uniqueExons[ei].end + 1);
            if (dx >= 0 && dx <= canvasWidth) {
              const donColor = strand === '-' ? '#22c55e' : '#F43F5E';
              ctx.fillStyle = donColor;
              ctx.beginPath();
              ctx.moveTo(dx, yCenter + EXON_HEIGHT / 2 + 2);
              ctx.lineTo(dx - triSize, yCenter + EXON_HEIGHT / 2 + 2 + triSize);
              ctx.lineTo(dx + triSize, yCenter + EXON_HEIGHT / 2 + 2 + triSize);
              ctx.closePath();
              ctx.fill();
            }
          }
        }
      }

      // --- TSS arrow (when zoom >= 0.1 px/bp) ---
      if (bpW >= 0.1) {
        const tssPos = strand === '-' ? txMax : txMin;
        const tx_ = toX(tssPos);
        if (tx_ >= -10 && tx_ <= canvasWidth + 10) {
          const arrowH = EXON_HEIGHT + 4;
          ctx.strokeStyle = COLORS.accent.amber;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx_, yCenter + arrowH / 2);
          ctx.lineTo(tx_, yCenter - arrowH / 2);
          ctx.stroke();
          // Arrow head pointing in transcription direction
          const dir = strand === '-' ? 1 : -1; // arrow points up and toward transcription
          ctx.fillStyle = COLORS.accent.amber;
          ctx.beginPath();
          ctx.moveTo(tx_, yCenter - arrowH / 2);
          ctx.lineTo(tx_ - 4, yCenter - arrowH / 2 + 5);
          ctx.lineTo(tx_ + 4, yCenter - arrowH / 2 + 5);
          ctx.closePath();
          ctx.fill();
        }
      }

      // --- AUG markers (when zoom >= 4 px/bp) ---
      if (bpW >= 4) {
        for (const f of txFeatures) {
          const ft = f.type?.toLowerCase() ?? '';
          if (ft !== 'start_codon') continue;
          const ax = toX(f.start);
          if (ax < 0 || ax > canvasWidth) continue;

          const dSize = 4;
          ctx.fillStyle = COLORS.accent.violet;
          ctx.beginPath();
          ctx.moveTo(ax, yCenter - dSize);
          ctx.lineTo(ax + dSize, yCenter);
          ctx.lineTo(ax, yCenter + dSize);
          ctx.lineTo(ax - dSize, yCenter);
          ctx.closePath();
          ctx.fill();

          // Label when space permits
          if (bpW >= 8) {
            ctx.fillStyle = COLORS.accent.violet;
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('AUG', ax + dSize + 2, yCenter);
          }
        }
      }

      const label = txFeatures[0]?.geneSymbol ?? '';
      if (label) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const labelX = Math.max(2, toX(txMin));
        ctx.fillText(label, labelX, yCenter - EXON_HEIGHT / 2 - 2);
      }

      rowIdx++;
      if (rowIdx * ROW_HEIGHT > height - 10) break;
    }

    drawTrackLabel(ctx, 'Genes', canvasWidth);
  }, [data, viewStart, viewEnd, canvasWidth, heightProp]);

  const rowCount = data ? Math.max(1, new Set(
    Array.from({ length: data.n }, (_, i) =>
      (data.mcols.transcript_id?.[i] as string) ?? (data.mcols.gene_symbol?.[i] as string) ?? '_',
    ),
  ).size) : 1;
  const computedHeight = heightProp ?? Math.min(rowCount * ROW_HEIGHT + 10, 200);

  return <canvas ref={canvasRef} className="block" style={{ height: computedHeight }} />;
}
