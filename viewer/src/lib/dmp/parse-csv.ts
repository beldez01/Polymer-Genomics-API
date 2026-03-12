/**
 * DMP CSV Parser — flexible column name matching
 */

import type { DMPRow, DMPDataset, ColumnMap } from './types';

const PROBE_ID_ALIASES = ['probe_id', 'probeid', 'cpg', 'name', 'id', 'illumina_id', 'cgid'];
const DELTA_BETA_ALIASES = ['delta_beta', 'deltabeta', 'logfc', 'db', 'delta_b', 'diff', 'mean.diff', 'meandiff'];
const P_VALUE_ALIASES = ['p_value', 'pvalue', 'p.value', 'p', 'pval', 'rawp'];
const ADJ_P_ALIASES = ['adj_p_value', 'adj.p.val', 'adjpvalue', 'fdr', 'q', 'qvalue', 'adj_pval', 'padj', 'bh'];
const GENE_ALIASES = ['gene_symbol', 'gene', 'symbol', 'ucsc_refgene_name', 'genesymbol', 'nearest_gene'];
const CHR_ALIASES = ['chr', 'chromosome', 'seqnames', 'chrom'];
const POS_ALIASES = ['pos', 'position', 'start', 'mapinfo', 'chromstart'];

function matchColumn(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function detectDelimiter(firstLine: string): string {
  const tab = (firstLine.match(/\t/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return tab > comma ? '\t' : ',';
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(text: string, filename: string): DMPDataset {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('File must contain a header row and at least one data row');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter);

  const probeCol = matchColumn(headers, PROBE_ID_ALIASES);
  const dbCol = matchColumn(headers, DELTA_BETA_ALIASES);
  const pCol = matchColumn(headers, P_VALUE_ALIASES);
  const adjCol = matchColumn(headers, ADJ_P_ALIASES);
  const geneCol = matchColumn(headers, GENE_ALIASES);
  const chrCol = matchColumn(headers, CHR_ALIASES);
  const posCol = matchColumn(headers, POS_ALIASES);

  if (!probeCol) throw new Error(`Could not find probe ID column. Expected one of: ${PROBE_ID_ALIASES.join(', ')}`);
  if (!dbCol) throw new Error(`Could not find delta beta column. Expected one of: ${DELTA_BETA_ALIASES.join(', ')}`);
  if (!pCol) throw new Error(`Could not find p-value column. Expected one of: ${P_VALUE_ALIASES.join(', ')}`);

  const colMap: ColumnMap = {
    probe_id: probeCol,
    delta_beta: dbCol,
    p_value: pCol,
    adj_p_value: adjCol || pCol, // fallback to raw p if no adj
    gene_symbol: geneCol,
    chr: chrCol,
    pos: posCol,
  };

  const probeIdx = headers.indexOf(probeCol);
  const dbIdx = headers.indexOf(dbCol);
  const pIdx = headers.indexOf(pCol);
  const adjIdx = adjCol ? headers.indexOf(adjCol) : pIdx;
  const geneIdx = geneCol ? headers.indexOf(geneCol) : -1;
  const chrIdx = chrCol ? headers.indexOf(chrCol) : -1;
  const posIdx = posCol ? headers.indexOf(posCol) : -1;

  const rows: DMPRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i], delimiter);
    const probeId = fields[probeIdx];
    const db = parseFloat(fields[dbIdx]);
    const pv = parseFloat(fields[pIdx]);
    const adjPv = parseFloat(fields[adjIdx]);

    if (!probeId || isNaN(db) || isNaN(pv)) continue;

    const row: DMPRow = {
      probe_id: probeId,
      delta_beta: db,
      p_value: pv,
      adj_p_value: isNaN(adjPv) ? pv : adjPv,
      neg_log10_p: pv > 0 ? -Math.log10(pv) : 300,
    };

    if (geneIdx >= 0 && fields[geneIdx]) row.gene_symbol = fields[geneIdx];
    if (chrIdx >= 0 && fields[chrIdx]) row.chr = fields[chrIdx];
    if (posIdx >= 0 && fields[posIdx]) {
      const p = parseInt(fields[posIdx], 10);
      if (!isNaN(p)) row.pos = p;
    }

    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error('No valid data rows found after parsing');
  }

  return {
    rows,
    filename,
    parsedAt: Date.now(),
    columnMap: colMap,
  };
}
