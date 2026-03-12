/**
 * Canvas renderer for overlaying multiple volcano datasets.
 */

import { COLOR, FONT_FAMILY } from '@/config/theme';
import type { ThresholdState } from './types';
import type { StudyDataset } from './comparison';
import { buildQuadTree, type QuadTree } from './quadtree';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MultiVolcanoLayout {
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface MultiVolcanoPoint {
  px: number;
  py: number;
  studyIdx: number;
  rowIdx: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARGIN = { top: 24, right: 24, bottom: 52, left: 64 };
const POINT_RADIUS = 2.5;
const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function toPixelX(val: number, layout: MultiVolcanoLayout): number {
  return layout.plotLeft + ((val - layout.xMin) / (layout.xMax - layout.xMin)) * layout.plotWidth;
}

function toPixelY(val: number, layout: MultiVolcanoLayout): number {
  return layout.plotTop + layout.plotHeight - ((val - layout.yMin) / (layout.yMax - layout.yMin)) * layout.plotHeight;
}

function computeSharedLayout(
  canvasWidth: number,
  canvasHeight: number,
  studies: StudyDataset[],
): MultiVolcanoLayout {
  const plotLeft = MARGIN.left;
  const plotTop = MARGIN.top;
  const plotWidth = canvasWidth - MARGIN.left - MARGIN.right;
  const plotHeight = canvasHeight - MARGIN.top - MARGIN.bottom;

  let xMin = 0, xMax = 0, yMax = 0;
  for (const study of studies) {
    for (const r of study.rows) {
      if (r.delta_beta < xMin) xMin = r.delta_beta;
      if (r.delta_beta > xMax) xMax = r.delta_beta;
      if (r.neg_log10_p > yMax) yMax = r.neg_log10_p;
    }
  }

  const xAbs = Math.max(Math.abs(xMin), Math.abs(xMax), 0.1);
  xMin = -xAbs * 1.1;
  xMax = xAbs * 1.1;
  yMax = Math.max(yMax * 1.05, 2);

  return { plotLeft, plotTop, plotWidth, plotHeight, xMin, xMax, yMin: 0, yMax };
}

// ---------------------------------------------------------------------------
// Grid, threshold lines, axes (shared drawing utilities)
// ---------------------------------------------------------------------------

function drawGrid(ctx: CanvasRenderingContext2D, layout: MultiVolcanoLayout) {
  ctx.strokeStyle = COLOR.canvas.gridLine;
  ctx.lineWidth = 1;

  const yStep = niceStep(layout.yMax - layout.yMin, 6);
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, py);
    ctx.lineTo(layout.plotLeft + layout.plotWidth, py);
    ctx.stroke();
  }

  const xStep = niceStep(layout.xMax - layout.xMin, 8);
  for (let x = Math.ceil(layout.xMin / xStep) * xStep; x <= layout.xMax; x += xStep) {
    const px = toPixelX(x, layout);
    ctx.beginPath();
    ctx.moveTo(px, layout.plotTop);
    ctx.lineTo(px, layout.plotTop + layout.plotHeight);
    ctx.stroke();
  }
}

function drawThresholdLines(
  ctx: CanvasRenderingContext2D,
  layout: MultiVolcanoLayout,
  thresholds: ThresholdState,
) {
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;

  const pThresholdY = thresholds.pValueCutoff;
  if (pThresholdY >= layout.yMin && pThresholdY <= layout.yMax) {
    const py = toPixelY(pThresholdY, layout);
    ctx.strokeStyle = COLOR.accent.amber + '88';
    ctx.beginPath();
    ctx.moveTo(layout.plotLeft, py);
    ctx.lineTo(layout.plotLeft + layout.plotWidth, py);
    ctx.stroke();
  }

  const dbCut = thresholds.deltaBetaCutoff;
  ctx.strokeStyle = COLOR.accent.amber + '88';
  for (const x of [-dbCut, dbCut]) {
    if (x >= layout.xMin && x <= layout.xMax) {
      const px = toPixelX(x, layout);
      ctx.beginPath();
      ctx.moveTo(px, layout.plotTop);
      ctx.lineTo(px, layout.plotTop + layout.plotHeight);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
}

function drawAxes(ctx: CanvasRenderingContext2D, layout: MultiVolcanoLayout) {
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

  // Tick labels
  ctx.fillStyle = COLOR.canvas.axisLabel;
  ctx.font = `400 10px ${FONT_FAMILY}`;

  const xStep = niceStep(layout.xMax - layout.xMin, 8);
  ctx.textAlign = 'center';
  for (let x = Math.ceil(layout.xMin / xStep) * xStep; x <= layout.xMax; x += xStep) {
    const px = toPixelX(x, layout);
    ctx.fillText(x.toFixed(2), px, layout.plotTop + layout.plotHeight + 16);
    ctx.beginPath();
    ctx.moveTo(px, layout.plotTop + layout.plotHeight);
    ctx.lineTo(px, layout.plotTop + layout.plotHeight + 4);
    ctx.stroke();
  }

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

  // Axis labels
  ctx.fillStyle = COLOR.canvas.featureLabel;
  ctx.font = `500 12px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    '\u0394\u03B2 (delta beta)',
    layout.plotLeft + layout.plotWidth / 2,
    layout.plotTop + layout.plotHeight + 40,
  );

  ctx.save();
  ctx.translate(16, layout.plotTop + layout.plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('-log\u2081\u2080(p)', 0, 0);
  ctx.restore();
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  layout: MultiVolcanoLayout,
  studies: StudyDataset[],
) {
  const x = layout.plotLeft + layout.plotWidth - 8;
  let y = layout.plotTop + 16;

  ctx.textAlign = 'right';
  ctx.font = `400 10px ${FONT_FAMILY}`;

  for (const study of studies) {
    // Color dot
    ctx.beginPath();
    ctx.arc(x - ctx.measureText(study.name).width - 10, y - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = study.color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = COLOR.text.secondary;
    ctx.fillText(study.name, x, y);

    y += 16;
  }
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export function renderMultiVolcano(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  studies: StudyDataset[],
  thresholds: ThresholdState,
  selectedStudyIndex: number | null,
  selectedPointIndex: number | null,
  hoveredStudyIndex: number | null,
  hoveredPointIndex: number | null,
): {
  layout: MultiVolcanoLayout;
  quadtree: QuadTree;
  studyPointMap: Map<number, MultiVolcanoPoint[]>;
} {
  const layout = computeSharedLayout(width, height, studies);

  // Clear
  ctx.fillStyle = COLOR.canvas.background;
  ctx.fillRect(0, 0, width * DPR, height * DPR);

  ctx.save();
  ctx.scale(DPR, DPR);

  drawGrid(ctx, layout);
  drawThresholdLines(ctx, layout, thresholds);

  // Collect all points for quadtree
  const allPoints: Array<{ px: number; py: number; index: number }> = [];
  const studyPointMap = new Map<number, MultiVolcanoPoint[]>();
  let globalIdx = 0;

  for (let si = 0; si < studies.length; si++) {
    const study = studies[si];
    const pts: MultiVolcanoPoint[] = [];

    for (let ri = 0; ri < study.rows.length; ri++) {
      const row = study.rows[ri];
      const px = toPixelX(row.delta_beta, layout);
      const py = toPixelY(row.neg_log10_p, layout);

      const isSig = row.adj_p_value < thresholds.adjPValueCutoff &&
        Math.abs(row.delta_beta) >= thresholds.deltaBetaCutoff;

      const isSelected = selectedStudyIndex === si && selectedPointIndex === ri;
      const isHovered = hoveredStudyIndex === si && hoveredPointIndex === ri;

      ctx.beginPath();
      ctx.arc(px, py, isSelected || isHovered ? POINT_RADIUS + 2 : POINT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = study.color;
      ctx.globalAlpha = isSig ? 0.8 : 0.5;
      if (isSelected || isHovered) ctx.globalAlpha = 1;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = COLOR.text.primary;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      const point: MultiVolcanoPoint = { px, py, studyIdx: si, rowIdx: ri };
      pts.push(point);
      allPoints.push({ px, py, index: globalIdx });
      globalIdx++;
    }

    studyPointMap.set(si, pts);
  }

  drawAxes(ctx, layout);
  drawLegend(ctx, layout, studies);

  ctx.restore();

  const quadtree = buildQuadTree(allPoints, width, height);

  return { layout, quadtree, studyPointMap };
}

// ---------------------------------------------------------------------------
// SVG export
// ---------------------------------------------------------------------------

export function multiVolcanoToSVG(
  width: number,
  height: number,
  studies: StudyDataset[],
  thresholds: ThresholdState,
): string {
  const layout = computeSharedLayout(width, height, studies);
  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<rect width="${width}" height="${height}" fill="${COLOR.canvas.background}"/>`);

  // Grid
  const yStep = niceStep(layout.yMax - layout.yMin, 6);
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    lines.push(`<line x1="${layout.plotLeft}" y1="${py}" x2="${layout.plotLeft + layout.plotWidth}" y2="${py}" stroke="${COLOR.canvas.gridLine}" stroke-width="1"/>`);
  }
  const xStep = niceStep(layout.xMax - layout.xMin, 8);
  for (let x = Math.ceil(layout.xMin / xStep) * xStep; x <= layout.xMax; x += xStep) {
    const px = toPixelX(x, layout);
    lines.push(`<line x1="${px}" y1="${layout.plotTop}" x2="${px}" y2="${layout.plotTop + layout.plotHeight}" stroke="${COLOR.canvas.gridLine}" stroke-width="1"/>`);
  }

  // Threshold lines
  const pY = toPixelY(thresholds.pValueCutoff, layout);
  lines.push(`<line x1="${layout.plotLeft}" y1="${pY}" x2="${layout.plotLeft + layout.plotWidth}" y2="${pY}" stroke="${COLOR.accent.amber}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5"/>`);
  for (const dbx of [-thresholds.deltaBetaCutoff, thresholds.deltaBetaCutoff]) {
    const px = toPixelX(dbx, layout);
    lines.push(`<line x1="${px}" y1="${layout.plotTop}" x2="${px}" y2="${layout.plotTop + layout.plotHeight}" stroke="${COLOR.accent.amber}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5"/>`);
  }

  // Points
  for (const study of studies) {
    for (const row of study.rows) {
      const px = toPixelX(row.delta_beta, layout);
      const py = toPixelY(row.neg_log10_p, layout);
      const isSig = row.adj_p_value < thresholds.adjPValueCutoff &&
        Math.abs(row.delta_beta) >= thresholds.deltaBetaCutoff;
      lines.push(`<circle cx="${px}" cy="${py}" r="${POINT_RADIUS}" fill="${study.color}" opacity="${isSig ? 0.8 : 0.5}"/>`);
    }
  }

  // Axes
  lines.push(`<line x1="${layout.plotLeft}" y1="${layout.plotTop + layout.plotHeight}" x2="${layout.plotLeft + layout.plotWidth}" y2="${layout.plotTop + layout.plotHeight}" stroke="${COLOR.canvas.tickMark}" stroke-width="1"/>`);
  lines.push(`<line x1="${layout.plotLeft}" y1="${layout.plotTop}" x2="${layout.plotLeft}" y2="${layout.plotTop + layout.plotHeight}" stroke="${COLOR.canvas.tickMark}" stroke-width="1"/>`);

  // Tick labels
  for (let x = Math.ceil(layout.xMin / xStep) * xStep; x <= layout.xMax; x += xStep) {
    const px = toPixelX(x, layout);
    lines.push(`<text x="${px}" y="${layout.plotTop + layout.plotHeight + 16}" fill="${COLOR.canvas.axisLabel}" font-family="${FONT_FAMILY}" font-size="10" text-anchor="middle">${x.toFixed(2)}</text>`);
  }
  for (let y = 0; y <= layout.yMax; y += yStep) {
    const py = toPixelY(y, layout);
    lines.push(`<text x="${layout.plotLeft - 8}" y="${py + 4}" fill="${COLOR.canvas.axisLabel}" font-family="${FONT_FAMILY}" font-size="10" text-anchor="end">${y.toFixed(1)}</text>`);
  }

  // Axis labels
  lines.push(`<text x="${layout.plotLeft + layout.plotWidth / 2}" y="${layout.plotTop + layout.plotHeight + 40}" fill="${COLOR.canvas.featureLabel}" font-family="${FONT_FAMILY}" font-size="12" font-weight="500" text-anchor="middle">\u0394\u03B2 (delta beta)</text>`);
  lines.push(`<text x="16" y="${layout.plotTop + layout.plotHeight / 2}" fill="${COLOR.canvas.featureLabel}" font-family="${FONT_FAMILY}" font-size="12" font-weight="500" text-anchor="middle" transform="rotate(-90,16,${layout.plotTop + layout.plotHeight / 2})">-log\u2081\u2080(p)</text>`);

  // Legend
  let ly = layout.plotTop + 16;
  for (const study of studies) {
    lines.push(`<circle cx="${layout.plotLeft + layout.plotWidth - 90}" cy="${ly - 3}" r="4" fill="${study.color}" opacity="0.9"/>`);
    lines.push(`<text x="${layout.plotLeft + layout.plotWidth - 82}" y="${ly}" fill="${COLOR.text.secondary}" font-family="${FONT_FAMILY}" font-size="10">${study.name}</text>`);
    ly += 16;
  }

  lines.push('</svg>');
  return lines.join('\n');
}
