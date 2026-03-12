/**
 * Canvas-based heatmap renderer with dendrograms.
 */

import { COLOR, FONT_FAMILY } from '@/config/theme';
import type { ClusterResult, DendrogramNode } from './clustering';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const DENDRO_LEFT_WIDTH = 80;
const DENDRO_TOP_HEIGHT = 60;
const GROUP_SIDEBAR_WIDTH = 12;
const LABEL_RIGHT_WIDTH = 80;
const LABEL_BOTTOM_HEIGHT = 60;

const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

// ---------------------------------------------------------------------------
// Color interpolation
// ---------------------------------------------------------------------------

function betaToColor(beta: number): string {
  // teal (0) -> white (0.5) -> rose (1)
  if (beta <= 0.5) {
    const t = beta / 0.5;
    const r = Math.round(78 + (255 - 78) * t);
    const g = Math.round(205 + (255 - 205) * t);
    const b = Math.round(196 + (255 - 196) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (beta - 0.5) / 0.5;
    const r = Math.round(255 - (255 - 244) * t);
    const g = Math.round(255 - (255 - 63) * t);
    const b = Math.round(255 - (255 - 94) * t);
    return `rgb(${r},${g},${b})`;
  }
}

function betaToRGB(beta: number): [number, number, number] {
  if (beta <= 0.5) {
    const t = beta / 0.5;
    return [
      Math.round(78 + (255 - 78) * t),
      Math.round(205 + (255 - 205) * t),
      Math.round(196 + (255 - 196) * t),
    ];
  } else {
    const t = (beta - 0.5) / 0.5;
    return [
      Math.round(255 - (255 - 244) * t),
      Math.round(255 - (255 - 63) * t),
      Math.round(255 - (255 - 94) * t),
    ];
  }
}

// ---------------------------------------------------------------------------
// Dendrogram drawing helpers
// ---------------------------------------------------------------------------

function getMaxHeight(node: DendrogramNode): number {
  if (!node.left && !node.right) return 0;
  return Math.max(
    node.height,
    node.left ? getMaxHeight(node.left) : 0,
    node.right ? getMaxHeight(node.right) : 0,
  );
}

function drawRowDendrogram(
  ctx: CanvasRenderingContext2D,
  node: DendrogramNode,
  originX: number,
  originY: number,
  width: number,
  cellHeight: number,
  maxHeight: number,
): void {
  if (!node.left || !node.right) return;

  const scaleX = maxHeight > 0 ? width / maxHeight : 1;

  function nodeY(n: DendrogramNode): number {
    return originY + (n.x ?? 0) * cellHeight + cellHeight / 2;
  }

  function nodeX(height: number): number {
    return originX + width - height * scaleX;
  }

  function drawBranch(n: DendrogramNode): void {
    if (!n.left || !n.right) return;

    const x = nodeX(n.height);
    const leftY = nodeY(n.left);
    const rightY = nodeY(n.right);
    const leftX = n.left.left ? nodeX(n.left.height) : originX + width;
    const rightX = n.right.left ? nodeX(n.right.height) : originX + width;

    ctx.beginPath();
    ctx.moveTo(leftX, leftY);
    ctx.lineTo(x, leftY);
    ctx.lineTo(x, rightY);
    ctx.lineTo(rightX, rightY);
    ctx.stroke();

    drawBranch(n.left);
    drawBranch(n.right);
  }

  ctx.strokeStyle = COLOR.text.faint;
  ctx.lineWidth = 1;
  drawBranch(node);
}

function drawColDendrogram(
  ctx: CanvasRenderingContext2D,
  node: DendrogramNode,
  originX: number,
  originY: number,
  height: number,
  cellWidth: number,
  maxHeight: number,
): void {
  if (!node.left || !node.right) return;

  const scaleY = maxHeight > 0 ? height / maxHeight : 1;

  function nodeX(n: DendrogramNode): number {
    return originX + (n.x ?? 0) * cellWidth + cellWidth / 2;
  }

  function nodeY(h: number): number {
    return originY + height - h * scaleY;
  }

  function drawBranch(n: DendrogramNode): void {
    if (!n.left || !n.right) return;

    const y = nodeY(n.height);
    const leftX = nodeX(n.left);
    const rightX = nodeX(n.right);
    const leftY = n.left.left ? nodeY(n.left.height) : originY + height;
    const rightY = n.right.left ? nodeY(n.right.height) : originY + height;

    ctx.beginPath();
    ctx.moveTo(leftX, leftY);
    ctx.lineTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.lineTo(rightX, rightY);
    ctx.stroke();

    drawBranch(n.left);
    drawBranch(n.right);
  }

  ctx.strokeStyle = COLOR.text.faint;
  ctx.lineWidth = 1;
  drawBranch(node);
}

// ---------------------------------------------------------------------------
// Canvas renderer
// ---------------------------------------------------------------------------

export interface HeatmapOptions {
  groupColors?: Record<string, string>;
  sampleIds?: string[];
  probeIds?: string[];
}

export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  result: ClusterResult,
  groups: (string | undefined)[],
  options: HeatmapOptions = {},
): void {
  const { groupColors = {}, sampleIds, probeIds } = options;
  const hasGroups = groups.some(g => g !== undefined);

  // Scale by DPR
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Clear
  ctx.fillStyle = COLOR.canvas.background;
  ctx.fillRect(0, 0, width, height);

  const nRows = result.matrix.length;
  const nCols = result.matrix[0]?.length || 0;
  if (nRows === 0 || nCols === 0) return;

  // Compute layout regions
  const sidebarW = hasGroups ? GROUP_SIDEBAR_WIDTH : 0;
  const showRowLabels = sampleIds && nRows <= 60;
  const showColLabels = probeIds && nCols <= 100;
  const rightMargin = showRowLabels ? LABEL_RIGHT_WIDTH : 8;
  const bottomMargin = showColLabels ? LABEL_BOTTOM_HEIGHT : 8;

  const heatX = DENDRO_LEFT_WIDTH + sidebarW;
  const heatY = DENDRO_TOP_HEIGHT;
  const heatW = width - heatX - rightMargin;
  const heatH = height - heatY - bottomMargin;

  const cellW = heatW / nCols;
  const cellH = heatH / nRows;

  // 1. Draw heatmap cells
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      const val = result.matrix[i][j];
      ctx.fillStyle = isNaN(val) ? COLOR.bg.surface : betaToColor(val);
      ctx.fillRect(
        heatX + j * cellW,
        heatY + i * cellH,
        Math.ceil(cellW),
        Math.ceil(cellH),
      );
    }
  }

  // 2. Draw row dendrogram (left)
  const rowMaxH = getMaxHeight(result.rowTree);
  drawRowDendrogram(
    ctx,
    result.rowTree,
    2,
    heatY,
    DENDRO_LEFT_WIDTH - 4,
    cellH,
    rowMaxH,
  );

  // 3. Draw column dendrogram (top)
  const colMaxH = getMaxHeight(result.colTree);
  drawColDendrogram(
    ctx,
    result.colTree,
    heatX,
    2,
    DENDRO_TOP_HEIGHT - 4,
    cellW,
    colMaxH,
  );

  // 4. Draw group sidebar
  if (hasGroups) {
    const defaultColors = [
      COLOR.accent.teal,
      COLOR.accent.amber,
      COLOR.accent.violet,
      COLOR.accent.rose,
    ];
    const uniqueGroups = [...new Set(groups.filter(g => g !== undefined))] as string[];
    const autoColors: Record<string, string> = {};
    uniqueGroups.forEach((g, i) => {
      autoColors[g] = groupColors[g] || defaultColors[i % defaultColors.length];
    });

    for (let i = 0; i < nRows; i++) {
      const origIdx = result.rowOrder[i];
      const g = groups[origIdx];
      if (g) {
        ctx.fillStyle = autoColors[g] || COLOR.text.faint;
        ctx.fillRect(
          DENDRO_LEFT_WIDTH,
          heatY + i * cellH,
          GROUP_SIDEBAR_WIDTH,
          Math.ceil(cellH),
        );
      }
    }
  }

  // 5. Row labels (sample IDs) on right
  if (showRowLabels && sampleIds) {
    ctx.fillStyle = COLOR.text.tertiary;
    ctx.font = `${Math.min(10, cellH * 0.8)}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < nRows; i++) {
      const origIdx = result.rowOrder[i];
      const label = sampleIds[origIdx] || '';
      ctx.fillText(label, heatX + heatW + 4, heatY + i * cellH + cellH / 2, rightMargin - 8);
    }
  }

  // 6. Column labels (probe IDs) on bottom, rotated 90 degrees
  if (showColLabels && probeIds) {
    ctx.fillStyle = COLOR.text.tertiary;
    ctx.font = `${Math.min(9, cellW * 0.8)}px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < nCols; j++) {
      const origIdx = result.colOrder[j];
      const label = probeIds[origIdx] || '';
      ctx.save();
      ctx.translate(heatX + j * cellW + cellW / 2, heatY + heatH + 4);
      ctx.rotate(Math.PI / 2);
      ctx.fillText(label, 0, 0, bottomMargin - 8);
      ctx.restore();
    }
  }

  // Reset transform
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------------------------------------------------------------------------
// SVG export
// ---------------------------------------------------------------------------

export function heatmapToSVG(
  width: number,
  height: number,
  result: ClusterResult,
  groups: (string | undefined)[],
  options: HeatmapOptions = {},
): string {
  const { groupColors = {}, sampleIds, probeIds } = options;
  const hasGroups = groups.some(g => g !== undefined);

  const nRows = result.matrix.length;
  const nCols = result.matrix[0]?.length || 0;
  if (nRows === 0 || nCols === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
  }

  const sidebarW = hasGroups ? GROUP_SIDEBAR_WIDTH : 0;
  const showRowLabels = sampleIds && nRows <= 60;
  const showColLabels = probeIds && nCols <= 100;
  const rightMargin = showRowLabels ? LABEL_RIGHT_WIDTH : 8;
  const bottomMargin = showColLabels ? LABEL_BOTTOM_HEIGHT : 8;

  const heatX = DENDRO_LEFT_WIDTH + sidebarW;
  const heatY = DENDRO_TOP_HEIGHT;
  const heatW = width - heatX - rightMargin;
  const heatH = height - heatY - bottomMargin;
  const cellW = heatW / nCols;
  const cellH = heatH / nRows;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:${COLOR.canvas.background}">`);

  // Heatmap cells
  for (let i = 0; i < nRows; i++) {
    for (let j = 0; j < nCols; j++) {
      const val = result.matrix[i][j];
      const color = isNaN(val) ? COLOR.bg.surface : betaToColor(val);
      parts.push(`<rect x="${heatX + j * cellW}" y="${heatY + i * cellH}" width="${cellW + 0.5}" height="${cellH + 0.5}" fill="${color}"/>`);
    }
  }

  // Group sidebar
  if (hasGroups) {
    const defaultColors = [
      COLOR.accent.teal,
      COLOR.accent.amber,
      COLOR.accent.violet,
      COLOR.accent.rose,
    ];
    const uniqueGroups = [...new Set(groups.filter(g => g !== undefined))] as string[];
    const autoColors: Record<string, string> = {};
    uniqueGroups.forEach((g, i) => {
      autoColors[g] = groupColors[g] || defaultColors[i % defaultColors.length];
    });

    for (let i = 0; i < nRows; i++) {
      const origIdx = result.rowOrder[i];
      const g = groups[origIdx];
      if (g) {
        parts.push(`<rect x="${DENDRO_LEFT_WIDTH}" y="${heatY + i * cellH}" width="${GROUP_SIDEBAR_WIDTH}" height="${cellH + 0.5}" fill="${autoColors[g] || COLOR.text.faint}"/>`);
      }
    }
  }

  // Row dendrogram (SVG paths)
  function svgRowDendro(node: DendrogramNode, maxH: number): void {
    if (!node.left || !node.right) return;
    const scaleX = maxH > 0 ? (DENDRO_LEFT_WIDTH - 4) / maxH : 1;

    function nY(n: DendrogramNode): number {
      return heatY + (n.x ?? 0) * cellH + cellH / 2;
    }
    function nX(h: number): number {
      return 2 + (DENDRO_LEFT_WIDTH - 4) - h * scaleX;
    }

    function walk(n: DendrogramNode): void {
      if (!n.left || !n.right) return;
      const x = nX(n.height);
      const ly = nY(n.left);
      const ry = nY(n.right);
      const lx = n.left.left ? nX(n.left.height) : 2 + (DENDRO_LEFT_WIDTH - 4);
      const rx = n.right.left ? nX(n.right.height) : 2 + (DENDRO_LEFT_WIDTH - 4);
      parts.push(`<path d="M${lx},${ly}L${x},${ly}L${x},${ry}L${rx},${ry}" fill="none" stroke="${COLOR.text.faint}" stroke-width="1"/>`);
      walk(n.left);
      walk(n.right);
    }
    walk(node);
  }

  const rowMaxH = getMaxHeight(result.rowTree);
  svgRowDendro(result.rowTree, rowMaxH);

  // Column dendrogram
  function svgColDendro(node: DendrogramNode, maxH: number): void {
    if (!node.left || !node.right) return;
    const scaleY = maxH > 0 ? (DENDRO_TOP_HEIGHT - 4) / maxH : 1;

    function nX(n: DendrogramNode): number {
      return heatX + (n.x ?? 0) * cellW + cellW / 2;
    }
    function nY(h: number): number {
      return 2 + (DENDRO_TOP_HEIGHT - 4) - h * scaleY;
    }

    function walk(n: DendrogramNode): void {
      if (!n.left || !n.right) return;
      const y = nY(n.height);
      const lx = nX(n.left);
      const rx = nX(n.right);
      const ly = n.left.left ? nY(n.left.height) : 2 + (DENDRO_TOP_HEIGHT - 4);
      const ry = n.right.left ? nY(n.right.height) : 2 + (DENDRO_TOP_HEIGHT - 4);
      parts.push(`<path d="M${lx},${ly}L${lx},${y}L${rx},${y}L${rx},${ry}" fill="none" stroke="${COLOR.text.faint}" stroke-width="1"/>`);
      walk(n.left);
      walk(n.right);
    }
    walk(node);
  }

  const colMaxH = getMaxHeight(result.colTree);
  svgColDendro(result.colTree, colMaxH);

  // Row labels
  if (showRowLabels && sampleIds) {
    const fontSize = Math.min(10, cellH * 0.8);
    for (let i = 0; i < nRows; i++) {
      const origIdx = result.rowOrder[i];
      const label = sampleIds[origIdx] || '';
      parts.push(`<text x="${heatX + heatW + 4}" y="${heatY + i * cellH + cellH / 2}" fill="${COLOR.text.tertiary}" font-size="${fontSize}" font-family="${FONT_FAMILY}" dominant-baseline="middle">${label}</text>`);
    }
  }

  // Column labels
  if (showColLabels && probeIds) {
    const fontSize = Math.min(9, cellW * 0.8);
    for (let j = 0; j < nCols; j++) {
      const origIdx = result.colOrder[j];
      const label = probeIds[origIdx] || '';
      parts.push(`<text x="${heatX + j * cellW + cellW / 2}" y="${heatY + heatH + 4}" fill="${COLOR.text.tertiary}" font-size="${fontSize}" font-family="${FONT_FAMILY}" text-anchor="end" transform="rotate(90,${heatX + j * cellW + cellW / 2},${heatY + heatH + 4})">${label}</text>`);
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}
