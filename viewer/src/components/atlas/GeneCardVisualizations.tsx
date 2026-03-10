'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  COLOR,
  SPACE,
  FONT_FAMILY,
  COMPONENT,
} from '@/config/theme';
import {
  GC_TYPE,
  AA_COST,
  AA_COST_MAP,
  TIER_COLORS,
  COST_REFERENCE,
  costToColor,
  ecpaPercentile,
} from './GeneCardData';
import type { ProteinDomain } from './GeneCardData';
import type { ParsedGene, CanonicalTranscript } from './GeneCard';

// ---------------------------------------------------------------------------
// Gene Structure Diagram — single canonical isoform, exons to scale
// ---------------------------------------------------------------------------

// Domain color palette
const DOMAIN_COLORS = ['#8B5CF6', '#F43F5E', '#F0A500', '#4ECDC4', '#3b82f6', '#10b981'];

// Map protein aa range to exon pixel segments
interface DomainSegment {
  exonIdx: number;
  px_start: number;
  px_end: number;
}

function mapDomainToExonPixels(
  domain: ProteinDomain,
  cdsFeats: { start: number; end: number }[],
  draws: { x: number; w: number; cdsStart: number; cdsEnd: number }[],
  offsetX: number,
): DomainSegment[] {
  const ntStart = (domain.aaStart - 1) * 3;
  const ntEnd = domain.aaEnd * 3;

  const segments: DomainSegment[] = [];
  for (let i = 0; i < cdsFeats.length; i++) {
    const cds = cdsFeats[i];
    const d = draws[i];
    if (!d) continue;

    // CDS nt range for this exon
    if (ntEnd <= d.cdsStart || ntStart >= d.cdsEnd) continue;

    // Overlap in CDS nt space
    const overlapStart = Math.max(ntStart, d.cdsStart);
    const overlapEnd = Math.min(ntEnd, d.cdsEnd);
    const cdsLen = d.cdsEnd - d.cdsStart;
    if (cdsLen <= 0) continue;

    const fracStart = (overlapStart - d.cdsStart) / cdsLen;
    const fracEnd = (overlapEnd - d.cdsStart) / cdsLen;

    segments.push({
      exonIdx: i,
      px_start: d.x + offsetX + fracStart * d.w,
      px_end: d.x + offsetX + fracEnd * d.w,
    });
  }
  return segments;
}

// Assign vertical rows to domains to avoid overlap
function assignDomainRows(domains: ProteinDomain[]): number[] {
  const rows: number[] = new Array(domains.length).fill(0);
  const rowEnds: number[] = []; // track the aa_end of the last domain in each row
  for (let i = 0; i < domains.length; i++) {
    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (domains[i].aaStart > rowEnds[r]) {
        rows[i] = r;
        rowEnds[r] = domains[i].aaEnd;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows[i] = rowEnds.length;
      rowEnds.push(domains[i].aaEnd);
    }
  }
  return rows;
}

export function GeneStructureDiagram({
  gene,
  canonical,
  domains,
}: {
  gene: ParsedGene;
  canonical: CanonicalTranscript;
  domains?: ProteinDomain[] | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const hasDomains = domains != null && domains.length > 0;
  const domainRows = hasDomains ? assignDomainRows(domains!) : [];
  const numDomainRows = hasDomains ? Math.max(...domainRows) + 1 : 0;

  // Dynamic height: base 80 + domain rows
  const DOMAIN_BAR_H = 14;
  const DOMAIN_ROW_GAP = 4;
  const DOMAIN_LABEL_H = 14;
  const DOMAIN_TOP_GAP = 6;
  const DOMAIN_SECTION_H = hasDomains
    ? DOMAIN_TOP_GAP + numDomainRows * (DOMAIN_BAR_H + DOMAIN_ROW_GAP) + DOMAIN_LABEL_H
    : 0;
  const DIAGRAM_H = 80 + DOMAIN_SECTION_H;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = DIAGRAM_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const MARGIN_L = 36;
    const MARGIN_R = 36;
    const trackW = W - MARGIN_L - MARGIN_R;
    const CDS_H = 24;
    const UTR_H = 14;
    const INTRON_W = 30;
    const cy = 40; // fixed center for exon track (half of base 80)

    // Sort features in coding order
    const cdsFeats = canonical.cdsFeatures.slice().sort((a, b) => a.start - b.start);
    const allFeats = canonical.allFeatures.slice().sort((a, b) => a.start - b.start);

    // Separate UTR and CDS regions
    const exonRegions: { start: number; end: number; type: 'cds' | 'utr' }[] = [];

    // Build exon regions from all features
    for (const f of allFeats) {
      const ft = f.feature_type.toLowerCase();
      if (ft === 'cds') {
        exonRegions.push({ start: f.start, end: f.end, type: 'cds' });
      } else if (ft.includes('utr') || ft === 'exon') {
        const overlapsCDS = cdsFeats.some(c => f.start < c.end && f.end > c.start);
        if (!overlapsCDS || ft.includes('utr')) {
          exonRegions.push({ start: f.start, end: f.end, type: 'utr' });
        }
      }
    }

    if (exonRegions.length === 0) {
      for (const c of cdsFeats) {
        exonRegions.push({ start: c.start, end: c.end, type: 'cds' });
      }
    }

    exonRegions.sort((a, b) => a.start - b.start);

    const mergedExons: { start: number; end: number; hasCDS: boolean }[] = [];
    for (const r of exonRegions) {
      const last = mergedExons[mergedExons.length - 1];
      if (last && r.start <= last.end + 1) {
        last.end = Math.max(last.end, r.end);
        if (r.type === 'cds') last.hasCDS = true;
      } else {
        mergedExons.push({ start: r.start, end: r.end, hasCDS: r.type === 'cds' });
      }
    }

    const exons = mergedExons.length > 0 ? mergedExons : cdsFeats.map(c => ({ start: c.start, end: c.end, hasCDS: true }));

    if (exons.length === 0) return;

    const numIntrons = Math.max(0, exons.length - 1);
    const totalExonBp = exons.reduce((s, e) => s + (e.end - e.start + 1), 0);
    const availExonPx = Math.max(50, trackW - numIntrons * INTRON_W);

    const isReverse = gene.strand === '-';

    interface ExonDraw { x: number; w: number; hasCDS: boolean; bp: number; idx: number }
    const draws: ExonDraw[] = [];
    let curX = MARGIN_L;

    const ordered = isReverse ? exons.slice().reverse() : exons;
    const cdsOrdered = isReverse ? cdsFeats.slice().reverse() : cdsFeats;
    let cdsNtAccum = 0;
    const cdsDraws: { x: number; w: number; cdsStart: number; cdsEnd: number }[] = [];

    for (let i = 0; i < ordered.length; i++) {
      const e = ordered[i];
      const bp = e.end - e.start + 1;
      const w = Math.max(2, (bp / totalExonBp) * availExonPx);
      draws.push({ x: curX, w, hasCDS: e.hasCDS, bp, idx: i });
      curX += w;
      if (i < ordered.length - 1) {
        curX += INTRON_W;
      }
    }

    // Build CDS-only draw array for domain mapping
    cdsNtAccum = 0;
    cdsDraws.length = 0;
    for (let i = 0; i < cdsOrdered.length; i++) {
      const cds = cdsOrdered[i];
      const cdsLen = cds.end - cds.start + 1;
      // Find matching exon draw
      for (const d of draws) {
        const exon = ordered[d.idx];
        if (cds.start >= exon.start && cds.end <= exon.end) {
          // Compute pixel sub-range within this exon for the CDS portion
          const exonBp = exon.end - exon.start + 1;
          const fracStart = (cds.start - exon.start) / exonBp;
          const fracEnd = (cds.end - exon.start + 1) / exonBp;
          cdsDraws.push({
            x: d.x + fracStart * d.w,
            w: (fracEnd - fracStart) * d.w,
            cdsStart: cdsNtAccum,
            cdsEnd: cdsNtAccum + cdsLen,
          });
          break;
        }
      }
      cdsNtAccum += cdsLen;
    }

    // Center the drawing if it doesn't fill the track
    const totalDrawW = curX - MARGIN_L;
    const offsetX = Math.max(0, (trackW - totalDrawW) / 2);

    // Draw intron lines
    ctx.strokeStyle = COLOR.border.strong;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < draws.length - 1; i++) {
      const d1 = draws[i];
      const d2 = draws[i + 1];
      const x1 = d1.x + d1.w + offsetX;
      const x2 = d2.x + offsetX;
      ctx.beginPath();
      ctx.moveTo(x1, cy);
      ctx.lineTo(x2, cy);
      ctx.stroke();

      const midX = (x1 + x2) / 2;
      const chevSize = 4;
      ctx.strokeStyle = COLOR.text.faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midX - chevSize, cy - chevSize);
      ctx.lineTo(midX + chevSize, cy);
      ctx.lineTo(midX - chevSize, cy + chevSize);
      ctx.stroke();
      ctx.strokeStyle = COLOR.border.strong;
      ctx.lineWidth = 1.5;
    }

    // Draw exon rectangles
    for (const d of draws) {
      const x = d.x + offsetX;
      if (d.hasCDS) {
        ctx.fillStyle = COLOR.layer.gencode_v44;
        ctx.fillRect(x, cy - CDS_H / 2, d.w, CDS_H);
      } else {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
        ctx.fillRect(x, cy - UTR_H / 2, d.w, UTR_H);
      }
    }

    // Exon labels
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const d of draws) {
      if (d.w >= 18) {
        const label = `E${d.idx + 1}`;
        ctx.fillText(label, d.x + d.w / 2 + offsetX, cy + CDS_H / 2 + 3);
      }
    }

    // 5'/3' labels
    ctx.font = `${GC_TYPE.xs}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.tertiary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText("5'", 4, cy);
    ctx.textAlign = 'right';
    ctx.fillText("3'", W - 4, cy);

    // --- Domain annotations below exon track ---
    if (hasDomains && cdsDraws.length > 0) {
      const domainBaseY = cy + CDS_H / 2 + 18 + DOMAIN_TOP_GAP; // below exon labels

      for (let di = 0; di < domains!.length; di++) {
        const domain = domains![di];
        const row = domainRows[di];
        const color = DOMAIN_COLORS[di % DOMAIN_COLORS.length];
        const barY = domainBaseY + row * (DOMAIN_BAR_H + DOMAIN_ROW_GAP);

        const segments = mapDomainToExonPixels(domain, cdsOrdered, cdsDraws, offsetX);
        if (segments.length === 0) continue;

        // Draw connecting dashed line across intron gaps
        if (segments.length > 1) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(segments[0].px_end, barY + DOMAIN_BAR_H / 2);
          ctx.lineTo(segments[segments.length - 1].px_start, barY + DOMAIN_BAR_H / 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        // Draw domain bar segments
        for (const seg of segments) {
          const segW = Math.max(2, seg.px_end - seg.px_start);
          if (domain.type === 'Active site') {
            // Tick mark for active sites
            ctx.fillStyle = color;
            const tickX = (seg.px_start + seg.px_end) / 2;
            ctx.fillRect(tickX - 1, barY, 3, DOMAIN_BAR_H);
            // Diamond marker
            ctx.beginPath();
            ctx.moveTo(tickX, barY - 2);
            ctx.lineTo(tickX + 4, barY + DOMAIN_BAR_H / 2);
            ctx.lineTo(tickX, barY + DOMAIN_BAR_H + 2);
            ctx.lineTo(tickX - 4, barY + DOMAIN_BAR_H / 2);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(seg.px_start, barY, segW, DOMAIN_BAR_H);
            ctx.globalAlpha = 1;
            // Border
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(seg.px_start, barY, segW, DOMAIN_BAR_H);
          }
        }

        // Domain label
        const totalPxStart = segments[0].px_start;
        const totalPxEnd = segments[segments.length - 1].px_end;
        const totalPxW = totalPxEnd - totalPxStart;
        const labelCenterX = totalPxStart + totalPxW / 2;

        // Build label: short type prefix + description
        let label = domain.description;
        if (!label && domain.type !== 'Domain') label = domain.type;
        if (label.length > 30) label = label.slice(0, 28) + '\u2026';

        ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelMetrics = ctx.measureText(label);
        const labelX = Math.max(MARGIN_L + labelMetrics.width / 2, Math.min(W - MARGIN_R - labelMetrics.width / 2, labelCenterX));
        ctx.fillText(label, labelX, barY + DOMAIN_BAR_H + 2);
      }
    }

    // Scale bar (bottom-right of exon area, before domains)
    if (totalExonBp > 0) {
      const bpPerPx = totalExonBp / availExonPx;
      let scaleBarBp = 100;
      for (const candidate of [50, 100, 200, 500, 1000, 2000, 5000]) {
        if (candidate / bpPerPx >= 20 && candidate / bpPerPx <= 80) {
          scaleBarBp = candidate;
          break;
        }
      }
      const scaleBarPx = scaleBarBp / bpPerPx;
      const sbX = W - MARGIN_R - scaleBarPx;
      const sbY = cy - CDS_H / 2 - 8;
      ctx.strokeStyle = COLOR.text.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sbX, sbY);
      ctx.lineTo(sbX + scaleBarPx, sbY);
      ctx.moveTo(sbX, sbY - 3);
      ctx.lineTo(sbX, sbY + 3);
      ctx.moveTo(sbX + scaleBarPx, sbY - 3);
      ctx.lineTo(sbX + scaleBarPx, sbY + 3);
      ctx.stroke();
      ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
      ctx.fillStyle = COLOR.text.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${scaleBarBp} bp`, sbX + scaleBarPx / 2, sbY - 4);
    }
  }, [gene, canonical, domains, domainRows, numDomainRows, hasDomains, DIAGRAM_H, width]);

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

  // Domain legend items
  const domainLegendItems = hasDomains ? domains!.map((d, i) => ({
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
    label: d.description || d.type,
    range: `${d.aaStart}–${d.aaEnd} aa`,
  })) : [];

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
          Gene Structure ({canonical.transcriptId.replace(/\.[0-9]+$/, '')})
        </span>
        <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.xs, fontFamily: FONT_FAMILY }}>
          {canonical.cdsFeatures.length} exon{canonical.cdsFeatures.length !== 1 ? 's' : ''}
          {hasDomains ? ` · ${domains!.length} domain${domains!.length !== 1 ? 's' : ''}` : ''}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: DIAGRAM_H, imageRendering: 'crisp-edges' }}
      />
      {hasDomains && domainLegendItems.length > 0 && (
        <div style={{
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          borderTop: `1px solid ${COLOR.border.subtle}`,
        }}>
          <div style={{ color: COLOR.text.muted, fontSize: GC_TYPE.xs, fontFamily: FONT_FAMILY, marginBottom: SPACE[1] }}>
            {domainLegendItems.length} domain{domainLegendItems.length !== 1 ? 's' : ''}
          </div>
          <div style={{
            maxHeight: 120,
            overflowY: 'auto',
            display: 'flex',
            gap: SPACE[4],
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {domainLegendItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
                <div style={{
                  width: 10,
                  height: 10,
                  backgroundColor: item.color,
                  opacity: 0.8,
                  flexShrink: 0,
                }} />
                <span style={{
                  color: COLOR.text.muted,
                  fontSize: GC_TYPE.xs,
                  fontFamily: FONT_FAMILY,
                }}>
                  {item.label} <span style={{ color: COLOR.text.faint }}>({item.range})</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AA Histogram — 20 bars ordered by cost tier
// ---------------------------------------------------------------------------

export function AAHistogram({ proteinSeq }: { proteinSeq: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  const HIST_H = 160;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = HIST_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    // Count amino acids
    const counts: Record<string, number> = {};
    for (const aa of AA_COST) counts[aa.aa] = 0;
    for (const ch of proteinSeq) {
      if (counts[ch] !== undefined) counts[ch]++;
    }
    const total = proteinSeq.length || 1;
    const fracs = AA_COST.map(a => ({ ...a, frac: counts[a.aa] / total }));
    const maxFrac = Math.max(...fracs.map(f => f.frac), 0.01);

    const MARGIN_L = 36;
    const MARGIN_R = 12;
    const MARGIN_T = 12;
    const MARGIN_B = 28;
    const plotW = W - MARGIN_L - MARGIN_R;
    const plotH = H - MARGIN_T - MARGIN_B;
    const barW = plotW / 20;
    const barGap = Math.max(1, barW * 0.15);
    const barInner = barW - barGap;

    // Y gridlines
    ctx.strokeStyle = COLOR.border.subtle;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    for (let pct = 0; pct <= maxFrac * 100; pct += 2) {
      const y = MARGIN_T + plotH - (pct / 100 / maxFrac) * plotH;
      if (y < MARGIN_T) break;
      ctx.beginPath();
      ctx.moveTo(MARGIN_L, y);
      ctx.lineTo(W - MARGIN_R, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Y-axis labels
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTickStep = maxFrac > 0.08 ? 4 : 2;
    for (let pct = 0; pct <= maxFrac * 100 + yTickStep; pct += yTickStep) {
      const y = MARGIN_T + plotH - (pct / 100 / maxFrac) * plotH;
      if (y < MARGIN_T - 5) break;
      ctx.fillText(`${pct}%`, MARGIN_L - 4, y);
    }

    // Tier separators
    const tierBoundaries = [7, 11, 17]; // indices where tiers change
    ctx.strokeStyle = COLOR.border.default;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    for (const idx of tierBoundaries) {
      const x = MARGIN_L + idx * barW;
      ctx.beginPath();
      ctx.moveTo(x, MARGIN_T);
      ctx.lineTo(x, MARGIN_T + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Bars
    for (let i = 0; i < fracs.length; i++) {
      const f = fracs[i];
      const x = MARGIN_L + i * barW + barGap / 2;
      const barH = (f.frac / maxFrac) * plotH;
      const y = MARGIN_T + plotH - barH;

      ctx.fillStyle = TIER_COLORS[f.tier];
      ctx.fillRect(x, y, barInner, barH);

      // AA label
      ctx.font = `bold ${Math.min(GC_TYPE.xs, barInner - 1)}px ${FONT_FAMILY}`;
      ctx.fillStyle = TIER_COLORS[f.tier];
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(f.aa, x + barInner / 2, MARGIN_T + plotH + 3);
    }

    // Bottom axis line
    ctx.strokeStyle = COLOR.border.strong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_L, MARGIN_T + plotH);
    ctx.lineTo(W - MARGIN_R, MARGIN_T + plotH);
    ctx.stroke();
  }, [proteinSeq, width]);

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
    <div ref={containerRef} style={{ flex: 1, minWidth: 280 }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: HIST_H, imageRendering: 'crisp-edges' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protein Sequence Cost Heatmap — per-residue color strip
// ---------------------------------------------------------------------------

export function ProteinCostHeatmap({ proteinSeq }: { proteinSeq: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const HEATMAP_H = 60;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = HEATMAP_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const MARGIN_L = 8;
    const MARGIN_R = 8;
    const STRIP_Y = 8;
    const STRIP_H = 28;
    const stripW = W - MARGIN_L - MARGIN_R;

    const len = proteinSeq.length;
    if (len === 0) return;

    const isSmall = len < 80;
    const cellW = stripW / len;

    // Draw residue strip
    for (let i = 0; i < len; i++) {
      const aa = proteinSeq[i];
      const cost = AA_COST_MAP[aa] ?? 22.5;
      ctx.fillStyle = costToColor(cost);
      const x = MARGIN_L + i * cellW;
      ctx.fillRect(x, STRIP_Y, Math.max(1, cellW), STRIP_H);

      // Letter inside cell for small proteins
      if (isSmall && cellW > 5) {
        ctx.font = `${Math.min(10, cellW - 1)}px ${FONT_FAMILY}`;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(aa, x + cellW / 2, STRIP_Y + STRIP_H / 2);
      }
    }

    // Position axis
    const AXIS_Y = STRIP_Y + STRIP_H + 14;
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const tickInterval = len > 1000 ? 200 : len > 500 ? 100 : 50;
    for (let pos = 1; pos <= len; pos += tickInterval) {
      const x = MARGIN_L + (pos - 1) * cellW + cellW / 2;
      ctx.fillText(String(pos), x, AXIS_Y);
      // Tick mark
      ctx.strokeStyle = COLOR.text.faint;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, STRIP_Y + STRIP_H + 1);
      ctx.lineTo(x, STRIP_Y + STRIP_H + 5);
      ctx.stroke();
    }

    // Color scale legend
    const LEGEND_Y = H - 16;
    const LEGEND_W = Math.min(200, stripW * 0.3);
    const LEGEND_X = MARGIN_L;
    const LEGEND_H = 8;
    const steps = 50;
    const stepW = LEGEND_W / steps;
    for (let i = 0; i < steps; i++) {
      const cost = 11.7 + (i / (steps - 1)) * (74.3 - 11.7);
      ctx.fillStyle = costToColor(cost);
      ctx.fillRect(LEGEND_X + i * stepW, LEGEND_Y, Math.ceil(stepW), LEGEND_H);
    }
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Cheap', LEGEND_X, LEGEND_Y - 6);
    ctx.textAlign = 'right';
    ctx.fillText('Expensive', LEGEND_X + LEGEND_W, LEGEND_Y - 6);
  }, [proteinSeq, width]);

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
      }}>
        <span style={{
          ...COMPONENT.sectionHeader,
          fontSize: GC_TYPE.sm,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
        }}>
          Protein Sequence Cost Map
        </span>
        <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.xs, fontFamily: FONT_FAMILY, marginLeft: SPACE[3] }}>
          {proteinSeq.length} residues
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: HEATMAP_H, imageRendering: 'crisp-edges' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CDS GC Content Plot — area chart by codon position
// ---------------------------------------------------------------------------

export function CdsGCPlot({ codonGC, cdsGCAvg }: { codonGC: number[]; cdsGCAvg: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const PLOT_H = 120;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = PLOT_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const MARGIN_L = 40;
    const MARGIN_R = 16;
    const MARGIN_T = 12;
    const MARGIN_B = 24;
    const plotW = W - MARGIN_L - MARGIN_R;
    const plotH = H - MARGIN_T - MARGIN_B;

    if (codonGC.length === 0) return;

    // Moving average
    const WINDOW = 10;
    let smoothed: number[];
    if (codonGC.length > 500) {
      // Bin to ~canvasWidth/2
      const binSize = Math.ceil(codonGC.length / (plotW / 2));
      smoothed = [];
      for (let i = 0; i < codonGC.length; i += binSize) {
        const chunk = codonGC.slice(i, Math.min(i + binSize, codonGC.length));
        smoothed.push(chunk.reduce((s, v) => s + v, 0) / chunk.length);
      }
    } else {
      smoothed = [];
      for (let i = 0; i < codonGC.length; i++) {
        const start = Math.max(0, i - Math.floor(WINDOW / 2));
        const end = Math.min(codonGC.length, i + Math.ceil(WINDOW / 2));
        let sum = 0;
        for (let j = start; j < end; j++) sum += codonGC[j];
        smoothed.push(sum / (end - start));
      }
    }

    const n = smoothed.length;
    function toX(i: number) { return MARGIN_L + (i / (n - 1)) * plotW; }
    function toY(v: number) { return MARGIN_T + (1 - v) * plotH; }

    // Y gridlines at 25% intervals
    ctx.strokeStyle = COLOR.border.subtle;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    for (const pct of [0.25, 0.50, 0.75]) {
      const y = toY(pct);
      ctx.beginPath();
      ctx.moveTo(MARGIN_L, y);
      ctx.lineTo(W - MARGIN_R, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 50% dashed reference
    ctx.strokeStyle = COLOR.text.faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(MARGIN_L, toY(0.5));
    ctx.lineTo(W - MARGIN_R, toY(0.5));
    ctx.stroke();
    ctx.setLineDash([]);

    // CDS average line
    ctx.strokeStyle = COLOR.accent.amber;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(MARGIN_L, toY(cdsGCAvg));
    ctx.lineTo(W - MARGIN_R, toY(cdsGCAvg));
    ctx.stroke();
    ctx.setLineDash([]);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    for (let i = 0; i < n; i++) {
      ctx.lineTo(toX(i), toY(smoothed[i]));
    }
    ctx.lineTo(toX(n - 1), toY(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, MARGIN_T, 0, MARGIN_T + plotH);
    grad.addColorStop(0, 'rgba(78, 205, 196, 0.25)');
    grad.addColorStop(1, 'rgba(78, 205, 196, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.strokeStyle = COLOR.accent.teal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(smoothed[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Y-axis labels
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const pct of [0, 25, 50, 75, 100]) {
      ctx.fillText(`${pct}%`, MARGIN_L - 4, toY(pct / 100));
    }

    // X-axis label
    ctx.fillStyle = COLOR.text.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Codon position', MARGIN_L + plotW / 2, H - 10);

    // CDS avg label
    ctx.fillStyle = COLOR.accent.amber;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.fillText(`CDS avg ${(cdsGCAvg * 100).toFixed(1)}%`, W - MARGIN_R, toY(cdsGCAvg) - 2);
  }, [codonGC, cdsGCAvg, width]);

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
      }}>
        <span style={{
          ...COMPONENT.sectionHeader,
          fontSize: GC_TYPE.sm,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
        }}>
          CDS GC Content
        </span>
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: PLOT_H, imageRendering: 'crisp-edges' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost Context Gauge — ECPA position relative to genome-wide range
// ---------------------------------------------------------------------------

export function CostContextGauge({ ecpa }: { ecpa: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  const GAUGE_H = 36;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = GAUGE_H;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, W, H);

    const MARGIN_L = 12;
    const MARGIN_R = 12;
    const trackY = 16;
    const trackH = 10;
    const trackW = W - MARGIN_L - MARGIN_R;

    const rangeMin = COST_REFERENCE.p5;
    const rangeMax = COST_REFERENCE.p95;
    const spread = rangeMax - rangeMin;

    function toX(v: number) {
      return MARGIN_L + Math.max(0, Math.min(1, (v - rangeMin) / spread)) * trackW;
    }

    // Grey track
    ctx.fillStyle = COLOR.border.default;
    ctx.fillRect(MARGIN_L, trackY, trackW, trackH);

    // Mean dashed line
    const meanX = toX(COST_REFERENCE.mean);
    ctx.strokeStyle = COLOR.text.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(meanX, trackY - 2);
    ctx.lineTo(meanX, trackY + trackH + 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gene marker
    const geneX = toX(ecpa);
    const markerSize = 6;
    ctx.fillStyle = COLOR.accent.teal;
    ctx.beginPath();
    ctx.arc(geneX, trackY + trackH / 2, markerSize, 0, Math.PI * 2);
    ctx.fill();

    // Labels
    ctx.font = `${GC_TYPE.xs - 2}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    const labelY = trackY + trackH + 6;

    ctx.fillStyle = COLOR.text.faint;
    ctx.textAlign = 'left';
    ctx.fillText(`p5: ${rangeMin}`, MARGIN_L, labelY);
    ctx.textAlign = 'center';
    ctx.fillText(`mean: ${COST_REFERENCE.mean}`, meanX, labelY);
    ctx.textAlign = 'right';
    ctx.fillText(`p95: ${rangeMax}`, W - MARGIN_R, labelY);
  }, [ecpa, width]);

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

  const pctl = ecpaPercentile(ecpa);
  const relation = ecpa < COST_REFERENCE.mean - 0.5 ? 'below' : ecpa > COST_REFERENCE.mean + 0.5 ? 'above' : 'near';

  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: GAUGE_H, imageRendering: 'crisp-edges' }}
      />
      <div style={{
        color: COLOR.text.tertiary,
        fontSize: GC_TYPE.xs,
        fontFamily: FONT_FAMILY,
        padding: `${SPACE[1]}px ${SPACE[3]}px`,
      }}>
        {ecpa.toFixed(1)} ATP/aa — {relation} the genome average of {COST_REFERENCE.mean} (≈{pctl.toFixed(0)}th percentile)
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exon/Intron GC Stats — comparison bars
// ---------------------------------------------------------------------------

export function ExonIntronGCStats({ exonGC, intronGC }: { exonGC: number; intronGC: number }) {
  const ratio = intronGC > 0 ? exonGC / intronGC : 0;

  return (
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
        fontSize: GC_TYPE.sm,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: 0,
      }}>
        Exon / Intron GC
      </div>

      {/* Exon bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY, width: 60, flexShrink: 0 }}>
          Exon
        </span>
        <div style={{ flex: 1, height: 12, backgroundColor: COLOR.border.subtle, overflow: 'hidden' }}>
          <div style={{
            width: `${exonGC * 100}%`,
            height: '100%',
            backgroundColor: COLOR.accent.teal,
          }} />
        </div>
        <span style={{ color: COLOR.text.secondary, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY, width: 50, textAlign: 'right' as const, flexShrink: 0 }}>
          {(exonGC * 100).toFixed(1)}%
        </span>
      </div>

      {/* Intron bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <span style={{ color: COLOR.text.muted, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY, width: 60, flexShrink: 0 }}>
          Intron
        </span>
        <div style={{ flex: 1, height: 12, backgroundColor: COLOR.border.subtle, overflow: 'hidden' }}>
          <div style={{
            width: `${intronGC * 100}%`,
            height: '100%',
            backgroundColor: COLOR.accent.amber,
          }} />
        </div>
        <span style={{ color: COLOR.text.secondary, fontSize: GC_TYPE.sm, fontFamily: FONT_FAMILY, width: 50, textAlign: 'right' as const, flexShrink: 0 }}>
          {(intronGC * 100).toFixed(1)}%
        </span>
      </div>

      {/* Ratio */}
      <div style={{
        color: COLOR.text.tertiary,
        fontSize: GC_TYPE.sm,
        fontFamily: FONT_FAMILY,
        marginTop: SPACE[1],
      }}>
        Exon/Intron ratio: {ratio.toFixed(2)}
      </div>
    </div>
  );
}
