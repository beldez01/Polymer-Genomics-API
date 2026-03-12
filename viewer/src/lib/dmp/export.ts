/**
 * DMP export utilities — SVG, PNG, CSV
 */

import type { DMPRow } from './types';
import type { ThresholdState } from './types';
import { volcanoToSVG } from './volcano-renderer';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportVolcanoSVG(
  width: number,
  height: number,
  rows: DMPRow[],
  thresholds: ThresholdState,
  filename: string,
) {
  const svg = volcanoToSVG(width, height, rows, thresholds);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}

export function exportVolcanoPNG(
  canvas: HTMLCanvasElement,
  filename: string,
) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/png');
}

export function exportFilteredCSV(rows: DMPRow[], filename: string) {
  const header = ['probe_id', 'delta_beta', 'p_value', 'adj_p_value', 'neg_log10_p', 'gene_symbol', 'chr', 'pos'];
  const lines = [header.join(',')];

  for (const r of rows) {
    lines.push([
      r.probe_id,
      r.delta_beta.toString(),
      r.p_value.toExponential(4),
      r.adj_p_value.toExponential(4),
      r.neg_log10_p.toFixed(4),
      r.gene_symbol ?? '',
      r.chr ?? '',
      r.pos?.toString() ?? '',
    ].join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, filename);
}
