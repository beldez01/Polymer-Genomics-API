// src/lib/hla/api.ts
// API client for HLA allele biophysics endpoints.

import type {
  LocusSummary,
  AlleleListItem,
  AlleleDetail,
  CompareResult,
  DivergenceResult,
  ExpressionCorrelationResult,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.polymerbio.org';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HLA API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** List all 6 HLA loci with allele counts and mean biophysics. */
export async function fetchLoci(): Promise<LocusSummary[]> {
  const data = await fetchJSON<{ loci: LocusSummary[] }>(`${API_BASE}/v1/hla/loci`);
  return data.loci;
}

/** List alleles for a locus with optional filters. */
export async function fetchAlleles(
  locus: string,
  opts: {
    allele_group?: string;
    protein?: string;
    genomic_only?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ alleles: AlleleListItem[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.allele_group) params.set('allele_group', opts.allele_group);
  if (opts.protein) params.set('protein', opts.protein);
  if (opts.genomic_only) params.set('genomic_only', 'true');
  params.set('limit', String(opts.limit ?? 100));
  params.set('offset', String(opts.offset ?? 0));

  const shortLocus = locus.replace('HLA-', '');
  const data = await fetchJSON<{ alleles: AlleleListItem[]; total: number }>(
    `${API_BASE}/v1/hla/alleles/${shortLocus}?${params}`,
  );
  return data;
}

/** Get full biophysical detail for a single allele. */
export async function fetchAlleleDetail(alleleName: string): Promise<AlleleDetail> {
  return fetchJSON<AlleleDetail>(`${API_BASE}/v1/hla/allele/${alleleName}`);
}

/** Compare 2-10 alleles biophysically. */
export async function compareAlleles(
  alleles: string[],
  focus: 'noncoding' | 'full' | 'coding' = 'noncoding',
): Promise<CompareResult> {
  return fetchJSON<CompareResult>(`${API_BASE}/v1/hla/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alleles, focus }),
  });
}

/** Analyze non-coding divergence among protein-identical alleles. */
export async function fetchDivergence(
  locus: string,
  alleleGroup: string,
  protein: string,
): Promise<DivergenceResult> {
  return fetchJSON<DivergenceResult>(`${API_BASE}/v1/hla/noncoding-divergence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locus, allele_group: alleleGroup, protein }),
  });
}

/** Fetch expression-biophysics correlation analysis. */
export async function fetchExpressionCorrelation(
  opts: { locus?: string; focus?: 'noncoding' | 'full' | 'both' } = {},
): Promise<ExpressionCorrelationResult> {
  const params = new URLSearchParams();
  if (opts.locus) params.set('locus', opts.locus.replace('HLA-', ''));
  if (opts.focus) params.set('focus', opts.focus);
  const qs = params.toString();
  return fetchJSON<ExpressionCorrelationResult>(
    `${API_BASE}/v1/hla/expression-correlation${qs ? `?${qs}` : ''}`,
  );
}
