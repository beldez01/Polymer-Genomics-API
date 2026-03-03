'use client';

import { useRef, useEffect } from 'react';
import type { GRanges } from '@/lib/api';
import { genomicToPixel, basePairWidth } from '@/lib/coordinates';
import { COLORS } from '@/config/colors';
import { drawGridlines } from '@/lib/gridlines';


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
  showCodons?: boolean;
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
  showCodons,
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
      const yCenter = 26 + rowIdx * ROW_HEIGHT;
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
        } else if (featureType === 'cds' || featureType === 'exon') {
          ctx.fillStyle = color;
          ctx.fillRect(x1, yCenter - EXON_HEIGHT / 2, w, EXON_HEIGHT);
        }
      }

      // --- Exon boundary caps ---
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      for (const f of txFeatures) {
        const ft = f.type?.toLowerCase() ?? '';
        if (ft !== 'exon' && ft !== 'cds') continue;
        const x1 = toX(f.start);
        const x2 = toX(f.end + 1);
        if (x1 >= 0 && x1 <= canvasWidth) {
          ctx.beginPath();
          ctx.moveTo(x1, yCenter - EXON_HEIGHT / 2);
          ctx.lineTo(x1, yCenter + EXON_HEIGHT / 2);
          ctx.stroke();
        }
        if (x2 >= 0 && x2 <= canvasWidth) {
          ctx.beginPath();
          ctx.moveTo(x2, yCenter - EXON_HEIGHT / 2);
          ctx.lineTo(x2, yCenter + EXON_HEIGHT / 2);
          ctx.stroke();
        }
      }
      ctx.lineWidth = 1; // reset

      // --- Codon reading frame overlay ---
      if (showCodons && bpW >= 1) {
        ctx.save();
        const CODON_COLORS = [
          'rgba(78, 205, 196, 0.30)',   // frame 0 — teal
          'rgba(240, 165, 0, 0.30)',    // frame 1 — amber
          'rgba(139, 92, 246, 0.30)',   // frame 2 — violet
        ];

        // Collect CDS/exon features for this transcript (API returns 'exon', not 'cds')
        const cdsFeatures = txFeatures
          .filter(f => { const ft = f.type?.toLowerCase() ?? ''; return ft === 'cds' || ft === 'exon'; })
          .sort((a, b) => a.start - b.start);

        if (cdsFeatures.length > 0) {
          // CDS start: lowest start on + strand; highest end on − strand
          const cdsStart = strand === '+' ? cdsFeatures[0].start : cdsFeatures[cdsFeatures.length - 1].end;

          for (const cds of cdsFeatures) {
            // Iterate codon-by-codon (3bp steps) through this CDS block
            const blockStart = cds.start;
            const blockEnd = cds.end;

            // Snap to nearest codon boundary from cdsStart
            const offsetToBlock = strand === '+' ? blockStart - cdsStart : cdsStart - blockEnd;
            const firstCodonStart = strand === '+'
              ? blockStart - ((offsetToBlock % 3 + 3) % 3)
              : blockEnd + ((offsetToBlock % 3 + 3) % 3);

            if (strand === '+') {
              let pos = firstCodonStart;
              while (pos < blockEnd + 3) {
                const codonEnd = pos + 3;
                const frame = ((pos - cdsStart) % 3 + 3) % 3;
                const cx1 = Math.max(0, toX(Math.max(pos, blockStart)));
                const cx2 = Math.min(canvasWidth, toX(Math.min(codonEnd, blockEnd + 1)));
                if (cx2 > cx1) {
                  ctx.fillStyle = CODON_COLORS[frame];
                  ctx.fillRect(cx1, yCenter - EXON_HEIGHT / 2, cx2 - cx1, EXON_HEIGHT);
                }
                if (bpW >= 3 && cx2 > 0 && cx2 <= canvasWidth) {
                  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.moveTo(cx2, yCenter - EXON_HEIGHT / 2);
                  ctx.lineTo(cx2, yCenter + EXON_HEIGHT / 2);
                  ctx.stroke();
                }
                pos += 3;
              }
            } else {
              // − strand: iterate from high to low
              let pos = firstCodonStart;
              const initialCodonIdx = Math.round((cdsStart - firstCodonStart) / 3);
              let codonIdx = initialCodonIdx;
              while (pos > blockStart) {
                const codonStart = pos - 3;
                const frame = ((codonIdx % 3) + 3) % 3;
                const cx1 = Math.max(0, toX(Math.max(codonStart, blockStart)));
                const cx2 = Math.min(canvasWidth, toX(Math.min(pos, blockEnd + 1)));
                if (cx2 > cx1) {
                  ctx.fillStyle = CODON_COLORS[frame];
                  ctx.fillRect(cx1, yCenter - EXON_HEIGHT / 2, cx2 - cx1, EXON_HEIGHT);
                }
                if (bpW >= 3 && cx1 > 0 && cx1 <= canvasWidth) {
                  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.moveTo(cx1, yCenter - EXON_HEIGHT / 2);
                  ctx.lineTo(cx1, yCenter + EXON_HEIGHT / 2);
                  ctx.stroke();
                }
                pos -= 3;
                codonIdx++;
              }
            }
          }
        }
        ctx.restore();
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

  }, [data, viewStart, viewEnd, canvasWidth, heightProp, showCodons]);

  const rowCount = data ? Math.max(1, new Set(
    Array.from({ length: data.n }, (_, i) =>
      (data.mcols.transcript_id?.[i] as string) ?? (data.mcols.gene_symbol?.[i] as string) ?? '_',
    ),
  ).size) : 1;
  const computedHeight = heightProp ?? Math.min(rowCount * ROW_HEIGHT + 10, 200);

  return <canvas ref={canvasRef} className="block" style={{ height: computedHeight }} />;
}
