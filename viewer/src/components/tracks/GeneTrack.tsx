'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';

// ---- Constants ----
const EXON_HEIGHT = 20;
const UTR_HEIGHT = 12;
const INTRON_HEIGHT = 2;
const GENE_COLOR = '#3b82f6';
const GENE_COLOR_MINUS = '#a78bfa'; // purple-ish for minus strand
const LABEL_COLOR = '#d1d5db';
const ROW_HEIGHT = 40; // per-transcript row

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

/**
 * Group features by transcript, then lay out each transcript on a row.
 */
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

    // Parse features from GRanges
    const features: Feature[] = [];
    if (data && data.n > 0) {
      for (let i = 0; i < data.n; i++) {
        features.push({
          start: data.ranges.start[i],
          end: data.ranges.end[i],
          strand: data.strand[i] ?? '*',
          type: (data.mcols.type?.[i] as string) ?? null,
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

    if (features.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
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

      // Determine transcript span for intron line
      let txMin = Infinity;
      let txMax = -Infinity;
      for (const f of txFeatures) {
        if (f.start < txMin) txMin = f.start;
        if (f.end > txMax) txMax = f.end;
      }

      // Draw intron line (thin horizontal across full transcript span)
      const lineX1 = Math.max(0, toX(txMin));
      const lineX2 = Math.min(canvasWidth, toX(txMax + 1));
      ctx.strokeStyle = color;
      ctx.lineWidth = INTRON_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(lineX1, yCenter);
      ctx.lineTo(lineX2, yCenter);
      ctx.stroke();

      // Draw strand direction arrows on intron line
      const arrowChar = strand === '-' ? '<' : '>';
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const arrowStep = Math.max(30, bpW * 20);
      for (let ax = lineX1 + 15; ax < lineX2 - 10; ax += arrowStep) {
        ctx.fillText(arrowChar, ax, yCenter);
      }

      // Draw features (exons, UTRs)
      for (const f of txFeatures) {
        const x1 = Math.max(0, toX(f.start));
        const x2 = Math.min(canvasWidth, toX(f.end + 1));
        const w = Math.max(1, x2 - x1);

        const featureType = f.type?.toLowerCase() ?? '';

        if (featureType.includes('utr') || featureType === 'utr5' || featureType === 'utr3') {
          // UTR: medium height
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.fillRect(x1, yCenter - UTR_HEIGHT / 2, w, UTR_HEIGHT);
          ctx.globalAlpha = 1.0;
        } else if (featureType === 'exon' || featureType === 'cds') {
          // Exon / CDS: full height
          ctx.fillStyle = color;
          ctx.fillRect(x1, yCenter - EXON_HEIGHT / 2, w, EXON_HEIGHT);
        }
        // Other types (gene, transcript, etc.) are just spanned by the intron line
      }

      // Gene label
      const label = txFeatures[0]?.geneSymbol ?? '';
      if (label) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const labelX = Math.max(2, toX(txMin));
        ctx.fillText(label, labelX, yCenter - EXON_HEIGHT / 2 - 2);
      }

      rowIdx++;
      if (rowIdx * ROW_HEIGHT > height - 10) break; // prevent overflow
    }
  }, [data, viewStart, viewEnd, canvasWidth, heightProp]);

  // Compute height for the outer element (mirror logic in effect)
  const rowCount = data ? Math.max(1, new Set(
    Array.from({ length: data.n }, (_, i) =>
      (data.mcols.transcript_id?.[i] as string) ?? (data.mcols.gene_symbol?.[i] as string) ?? '_',
    ),
  ).size) : 1;
  const computedHeight = heightProp ?? Math.min(rowCount * ROW_HEIGHT + 10, 200);

  return <canvas ref={canvasRef} className="block" style={{ height: computedHeight }} />;
}
