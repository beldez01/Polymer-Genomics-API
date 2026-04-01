// src/lib/methylation-detect.ts
// Auto-detect whether a dropped CSV/TSV file contains DMP results or beta values.

export type InputFileType = 'dmp' | 'betas';

const DMP_DELTA_COLS = [
  'delta_beta', 'deltabeta', 'logfc', 'log_fc', 'db', 'diff', 'meandiff',
];
const DMP_PVAL_COLS = [
  'p_value', 'pvalue', 'p.value', 'pval', 'rawp', 'adj.p.val', 'fdr', 'adj_p_value',
];

/**
 * Peek at the first line of a CSV/TSV to determine if it's DMP results or beta values.
 *
 * DMP results have delta_beta/logFC AND p_value columns (limma, minfi, DMRcate output).
 * Beta values have just probe_id + numeric beta — no significance columns.
 */
export function detectFileType(text: string): InputFileType {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const headers = firstLine
    .split(delimiter)
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const hasDelta = headers.some((h) => DMP_DELTA_COLS.includes(h));
  const hasPval = headers.some((h) => DMP_PVAL_COLS.includes(h));

  return hasDelta && hasPval ? 'dmp' : 'betas';
}
