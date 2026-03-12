/**
 * Canvas-based Manhattan plot renderer.
 */

import { COLOR, FONT_FAMILY } from '@/config/theme';
import type { DMPRow, ThresholdState } from './types';
import { buildQuadTree, type QuadTree } from './quadtree';
import { CHROMOSOMES } from '@/config/chromosomes';

export interface ManhattanLayout {
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  yMin: number;
  yMax: number;
  totalGenomeLength: number;
  chrOffsets: Map<string, number>;
}

export interface RenderedPoint {
  px: number;
  py: number;
  index: number;
}

const MARGIN = { top: 24, right: 24, bottom: 52, left: 64 };
const POINT_RADIUS = 2.5;
const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

/** Chromosomes used in the Manhattan plot (exclude chrM). */
const MANHATTAN_CHROMOSOMES = CHROMOSOMES.filter(c => c.name !== 'chrM');

/** Genome-wide significance: -log10(5e-8) */
const GENOME_WIDE_THRESHOLD = -Math.log10(5e-8); // ~7.301

/** Suggestive significance: -log10(1e-5) */
const SUGGESTIVE_THRESHOLD = -Math.log10(1e-5); // 5.0

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  let nice: number;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3) nice = 2;
  else if (residual <= 7) nice = 5;
  else nice = 10;
  return nice * mag;
}

export function computeManhattanLayout(
  canvasWidth: number,
  canvasHeight: number,
  rows: DMPRow[],
): ManhattanLayout {
  const plotLeft = MARGIN.left;
  const plotTop = MARGIN.top;
  const plotWidth = canvasWidth - MARGIN.left - MARGIN.right;
  const plotHeight = canvasHeight - MARGIN.top - MARGIN.bottom;

  // Build chromosome offsets
  const chrOffsets = new Map<string, number>();
  let offset = 0;
  for (const chr of MANHATTAN_CHROMOSOMES) {
    chrOffsets.set(chr.name, offset);
    offset += chr.length;
  }
  const totalGenomeLength = offset;

  // Y-axis: -log10(p)
  let yMax = 0;
  for (const r of rows) {
    if (r.chr && r.pos != null && r.neg_log10_p > yMax) {
      yMax = r.neg_log10_p;
    }
  }
  yMax = Math.max(yMax * 1.05, 2);

  return { plotLeft, plotTop, plotWidth, plotHeight, yMin: 0, yMax, totalGenomeLength, chrOffsets };
}

function toPixelX(genomicPos: number, layout: ManhattanLayout): number {
  return layout.plotLeft + (genomicPos / layout.totalGenomeLength) * layout.plotWidth;
}

function toPixelY(val: number, layout: ManhattanLayout): number {
  return layout.plotTop + layout.plotHeight - ((val - layout.yMin) / (layout.yMax - layout.yMin)) * layout.plotHeight;
}

function getChrIndex(chrName: string): number {
  return MANHATTAN_CHROMOSOMES.findIndex(c => c.name === chrName);
}

function getPointColor(
  row: DMPRow,
  chrIndex: number,
  thresholds: ThresholdState,
): { color: string; alpha: number } {
  const isSig = row.adj_p_value < thresholds.adjPValueCutoff &&
    Math.abs(row.delta_beta) >= thresholds.deltaBetaCutoff;
  const baseColor = chrIndex % 2 === 0 ? COLOR.accent.teal : COLOR.text.faint;

  if (isSig) {
    return { color: baseColor, alpha: 1 };
  }
  return { color: baseColor, alpha: 0.7 };
}

interface BinnedPoint {
  genomicPos: number;
  negLog10P: number;
  chrIndex: number;
  originalIndex: number;
}

export function renderManhattan(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  rows: DMPRow[],
  thresholds: ThresholdState,
  selectedIndex: number | null,
  hoveredIndex: number | null,
): { layout: ManhattanLayout; points: RenderedPoint[]; quadtree: QuadTree } {
  const layout = computeManhattanLayout(canvasWidth, canvasHeight, rows);

  // Clear
  ctx.fillStyle = COLOR.canvas.background;
  ctx.fillRect(0, 0, canvasWidth * DPR, canvasHeight * DPR);

  ctx.save();
  ctx.scale(DPR, DPR);

  // Grid lines
  drawGrid(ctx, layout);

  // Significance lines
  drawSignificanceLines(ctx, layout);

  // Build renderable points (only rows with chr + pos)
  const validRows: { row: DMPRow; idx: number; genomicPos: number; chrIndex: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.chr || row.pos == null) continue;
    const chrOffset = layout.chrOffsets.get(row.chr);
    if (chrOffset == null) continue;
    const chrIdx = getChrIndex(row.chr);
    if (chrIdx < 0) continue;
    validRows.push({ row, idx: i, genomicPos: chrOffset + row.pos, chrIndex: chrIdx });
  }

  // Binning for >100K points
  let renderData: BinnedPoint[];
  const BIN_SIZE = 10000; // 10kb
  if (validRows.length > 100000) {
    const bins = new Map<number, { sumNLP: number; count: number; chrIndex: number; bestIdx: number; bestNLP: number }>();
    for (const v of validRows) {
      const binKey = Math.floor(v.genomicPos / BIN_SIZE);
      const existing = bins.get(binKey);
      if (existing) {
        existing.sumNLP += v.row.neg_log10_p;
        existing.count++;
        if (v.row.neg_log10_p > existing.bestNLP) {
          existing.bestNLP = v.row.neg_log10_p;
          existing.bestIdx = v.idx;
        }
      } else {
        bins.set(binKey, {
          sumNLP: v.row.neg_log10_p,
          count: 1,
          chrIndex: v.chrIndex,
          bestIdx: v.idx,
          bestNLP: v.row.neg_log10_p,
        });
      }
    }
    renderData = [];
    bins.forEach((bin, binKey) => {
      renderData.push({
        genomicPos: (binKey + 0.5) * BIN_SIZE,
        negLog10P: bin.sumNLP / bin.count,
        chrIndex: bin.chrIndex,
        originalIndex: bin.bestIdx,
      });
    });
  } else {
    renderData = validRows.map(v => ({
      genomicPos: v.genomicPos,
      negLog10P: v.row.neg_log10_p,
      chrIndex: v.chrIndex,
      originalIndex: v.idx,
    }));
  }

  // Draw points
  const points: RenderedPoint[] = [];
  for (const pt of renderData) {
    const px = toPixelX(pt.genomicPos, layout);
    const py = toPixelY(pt.negLog10P, layout);
    points.push({ px, py, index: pt.originalIndex });

    const isSelected = selectedIndex === pt.originalIndex;
    const isHovered = hoveredIndex === pt.originalIndex;

    const row = rows[pt.originalIndex];
    const { color, alpha } = getPointColor(row, pt.chrIndex, thresholds);

    ctx.beginPath();
    ctx.arc(px, py, isSelected || isHovered ? POINT_RADIUS + 2 : POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = isSelected || isHovered ? 1 : alpha;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = COLOR.text.primary;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // Axes
  drawAxes(ctx, layout);

  // Chromosome labels
  drawChrLabels(ctx, layout);

  ctx.restore();

  const quadtree = buildQuadTree(points, canvasWidth, canvasHeight);
  return { layout, points, quadtree };
}

function drawGrid(ctx: CanvasRenderingContext2D, layout: ManhattanLayout) {
  ctx.strokeStyle = COLOR.canvas.gridLine;
  ctx.lineWidth = 1;

  // Y grid
  const yStep = niceStep(layout.yMax - layout.yMin, 6);
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, py);
    ctx.lineTo(layout.plotLeft + layout.plotWidth, py);
    ctx.stroke();
  }
}

function drawSignificanceLines(ctx: CanvasRenderingContext2D, layout: ManhattanLayout) {
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;

  // Genome-wide significance (5e-8)
  if (GENOME_WIDE_THRESHOLD >= layout.yMin && GENOME_WIDE_THRESHOLD <= layout.yMax) {
    const py = toPixelY(GENOME_WIDE_THRESHOLD, layout);
    ctx.strokeStyle = COLOR.accent.rose;
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, py);
    ctx.lineTo(layout.plotLeft + layout.plotWidth, py);
    ctx.stroke();
  }

  // Suggestive significance (1e-5)
  if (SUGGESTIVE_THRESHOLD >= layout.yMin && SUGGESTIVE_THRESHOLD <= layout.yMax) {
    const py = toPixelY(SUGGESTIVE_THRESHOLD, layout);
    ctx.strokeStyle = COLOR.accent.amber;
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, py);
    ctx.lineTo(layout.plotLeft + layout.plotWidth, py);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawAxes(ctx: CanvasRenderingContext2D, layout: ManhattanLayout) {
  ctx.strokeStyle = COLOR.canvas.tickMark;
  ctx.lineWidth = 1;

  // X axis
  ctx.beginPath();
  ctx.moveTo(layout.plotLeft, layout.plotTop + layout.plotHeight);
  ctx.lineTo(layout.plotLeft + layout.plotWidth, layout.plotTop + layout.plotHeight);
  ctx.stroke();

  // Y axis
  ctx.beginPath();
  ctx.moveTo(layout.plotLeft, layout.plotTop);
  ctx.lineTo(layout.plotLeft, layout.plotTop + layout.plotHeight);
  ctx.stroke();

  // Y tick labels
  ctx.fillStyle = COLOR.canvas.axisLabel;
  ctx.font = `400 10px ${FONT_FAMILY}`;

  const yStep = niceStep(layout.yMax - layout.yMin, 6);
  ctx.textAlign = 'right';
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    ctx.fillText(y.toFixed(1), layout.plotLeft - 8, py + 4);
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft - 4, py);
    ctx.lineTo(layout.plotLeft, py);
    ctx.stroke();
  }

  // Y-axis label
  ctx.fillStyle = COLOR.canvas.featureLabel;
  ctx.font = `500 12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(16, layout.plotTop + layout.plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('-log\u2081\u2080(p)', 0, 0);
  ctx.restore();
}

function drawChrLabels(ctx: CanvasRenderingContext2D, layout: ManhattanLayout) {
  ctx.fillStyle = COLOR.canvas.axisLabel;
  ctx.font = `400 10px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';

  for (const chr of MANHATTAN_CHROMOSOMES) {
    const offset = layout.chrOffsets.get(chr.name);
    if (offset == null) continue;
    const center = offset + chr.length / 2;
    const px = toPixelX(center, layout);

    // Short label: strip "chr" prefix
    const label = chr.name.replace('chr', '');

    // Skip labels for small chromosomes if they'd overlap
    const chrPixelWidth = (chr.length / layout.totalGenomeLength) * layout.plotWidth;
    if (chrPixelWidth < 14 && label.length > 1) continue;

    ctx.fillText(label, px, layout.plotTop + layout.plotHeight + 16);
  }
}

/**
 * Generate an SVG string for export (publication quality).
 */
export function manhattanToSVG(
  width: number,
  height: number,
  rows: DMPRow[],
  thresholds: ThresholdState,
): string {
  const filteredRows = rows.filter(r => r.chr && r.pos != null);
  const layout = computeManhattanLayout(width, height, filteredRows);
  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<rect width="${width}" height="${height}" fill="${COLOR.canvas.background}"/>`);

  // Y grid
  const yStep = niceStep(layout.yMax - layout.yMin, 6);
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    lines.push(`<line x1="${layout.plotLeft}" y1="${py}" x2="${layout.plotLeft + layout.plotWidth}" y2="${py}" stroke="${COLOR.canvas.gridLine}" stroke-width="1"/>`);
  }

  // Significance lines
  if (GENOME_WIDE_THRESHOLD >= layout.yMin && GENOME_WIDE_THRESHOLD <= layout.yMax) {
    const py = toPixelY(GENOME_WIDE_THRESHOLD, layout);
    lines.push(`<line x1="${layout.plotLeft}" y1="${py}" x2="${layout.plotLeft + layout.plotWidth}" y2="${py}" stroke="${COLOR.accent.rose}" stroke-width="1" stroke-dasharray="4,4"/>`);
  }
  if (SUGGESTIVE_THRESHOLD >= layout.yMin && SUGGESTIVE_THRESHOLD <= layout.yMax) {
    const py = toPixelY(SUGGESTIVE_THRESHOLD, layout);
    lines.push(`<line x1="${layout.plotLeft}" y1="${py}" x2="${layout.plotLeft + layout.plotWidth}" y2="${py}" stroke="${COLOR.accent.amber}" stroke-width="1" stroke-dasharray="4,4"/>`);
  }

  // Points
  for (const row of filteredRows) {
    const chrOffset = layout.chrOffsets.get(row.chr!);
    if (chrOffset == null) continue;
    const chrIdx = getChrIndex(row.chr!);
    if (chrIdx < 0) continue;

    const genomicPos = chrOffset + row.pos!;
    const px = toPixelX(genomicPos, layout);
    const py = toPixelY(row.neg_log10_p, layout);
    const { color, alpha } = getPointColor(row, chrIdx, thresholds);

    lines.push(`<circle cx="${px}" cy="${py}" r="${POINT_RADIUS}" fill="${color}" opacity="${alpha}"/>`);
  }

  // Axes
  lines.push(`<line x1="${layout.plotLeft}" y1="${layout.plotTop + layout.plotHeight}" x2="${layout.plotLeft + layout.plotWidth}" y2="${layout.plotTop + layout.plotHeight}" stroke="${COLOR.canvas.tickMark}" stroke-width="1"/>`);
  lines.push(`<line x1="${layout.plotLeft}" y1="${layout.plotTop}" x2="${layout.plotLeft}" y2="${layout.plotTop + layout.plotHeight}" stroke="${COLOR.canvas.tickMark}" stroke-width="1"/>`);

  // Y tick labels
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    lines.push(`<text x="${layout.plotLeft - 8}" y="${py + 4}" fill="${COLOR.canvas.axisLabel}" font-family="${FONT_FAMILY}" font-size="10" text-anchor="end">${y.toFixed(1)}</text>`);
  }

  // Chromosome labels
  for (const chr of MANHATTAN_CHROMOSOMES) {
    const offset = layout.chrOffsets.get(chr.name);
    if (offset == null) continue;
    const center = offset + chr.length / 2;
    const px = toPixelX(center, layout);
    const label = chr.name.replace('chr', '');
    const chrPixelWidth = (chr.length / layout.totalGenomeLength) * layout.plotWidth;
    if (chrPixelWidth < 14 && label.length > 1) continue;
    lines.push(`<text x="${px}" y="${layout.plotTop + layout.plotHeight + 16}" fill="${COLOR.canvas.axisLabel}" font-family="${FONT_FAMILY}" font-size="10" text-anchor="middle">${label}</text>`);
  }

  // Y-axis label
  lines.push(`<text x="16" y="${layout.plotTop + layout.plotHeight / 2}" fill="${COLOR.canvas.featureLabel}" font-family="${FONT_FAMILY}" font-size="12" font-weight="500" text-anchor="middle" transform="rotate(-90,16,${layout.plotTop + layout.plotHeight / 2})">-log\u2081\u2080(p)</text>`);

  lines.push('</svg>');
  return lines.join('\n');
}
