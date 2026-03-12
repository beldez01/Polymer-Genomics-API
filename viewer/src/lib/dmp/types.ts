/**
 * DMP Results Viewer — Type Definitions
 */

export interface DMPRow {
  probe_id: string;
  delta_beta: number;
  p_value: number;
  adj_p_value: number;
  neg_log10_p: number;
  gene_symbol?: string;
  chr?: string;
  pos?: number;
}

export interface DMPDataset {
  rows: DMPRow[];
  filename: string;
  parsedAt: number;
  columnMap: ColumnMap;
}

export interface ColumnMap {
  probe_id: string;
  delta_beta: string;
  p_value: string;
  adj_p_value: string;
  gene_symbol?: string;
  chr?: string;
  pos?: string;
}

export interface ThresholdState {
  pValueCutoff: number;      // -log10 scale, e.g. 1.3 for p=0.05
  adjPValueCutoff: number;   // raw adj p-value cutoff
  deltaBetaCutoff: number;   // absolute delta beta cutoff
}

export interface DMPSummary {
  total: number;
  significant: number;
  hyper: number;
  hypo: number;
  lambda: number;
  deltaBetaMin: number;
  deltaBetaMax: number;
  maxNegLog10P: number;
}

export type SortField = 'probe_id' | 'delta_beta' | 'p_value' | 'adj_p_value' | 'gene_symbol';
export type SortDir = 'asc' | 'desc';

export type FilterMode = 'all' | 'significant' | 'hyper' | 'hypo';
