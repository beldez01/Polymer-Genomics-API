/**
 * Client-side pathway enrichment analysis.
 *
 * Hypergeometric test + Benjamini-Hochberg FDR correction.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  pathway: string;
  category: 'Reactome' | 'Hallmark';
  geneCount: number;
  geneRatio: string;       // "k/n" format
  pValue: number;
  adjPValue: number;
  genes: string[];
}

export interface EnrichmentSummary {
  results: EnrichmentResult[];
  totalGenesWithProbes: number;
  significantGenes: number;
  testedPathways: number;
}

// ---------------------------------------------------------------------------
// Combinatorics helpers (log-space for numerical stability)
// ---------------------------------------------------------------------------

/** log(C(a, b)) = sum(log(i) for i in a-b+1..a) - sum(log(i) for i in 1..b) */
function logChoose(a: number, b: number): number {
  if (b < 0 || b > a) return -Infinity;
  if (b === 0 || b === a) return 0;
  // Use the smaller side for efficiency
  if (b > a - b) b = a - b;
  let s = 0;
  for (let i = 0; i < b; i++) {
    s += Math.log(a - i) - Math.log(i + 1);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Hypergeometric p-value
// ---------------------------------------------------------------------------

/**
 * P(X >= k) for hypergeometric distribution.
 *
 * k = significant genes in pathway
 * K = total genes in pathway (in background)
 * n = total significant genes
 * N = total genes in background
 */
export function hypergeometricPValue(
  k: number,
  K: number,
  n: number,
  N: number,
): number {
  if (k <= 0) return 1;
  if (K <= 0 || n <= 0 || N <= 0) return 1;

  // Upper-tail: P(X >= k) = sum_{i=k}^{min(K,n)} C(K,i)*C(N-K,n-i) / C(N,n)
  const logDenom = logChoose(N, n);
  let pVal = 0;
  const upper = Math.min(K, n);
  for (let i = k; i <= upper; i++) {
    const nMinusK = N - K;
    const nMinusI = n - i;
    if (nMinusI < 0 || nMinusI > nMinusK) continue;
    const logNum = logChoose(K, i) + logChoose(nMinusK, nMinusI);
    pVal += Math.exp(logNum - logDenom);
  }
  return Math.min(pVal, 1);
}

// ---------------------------------------------------------------------------
// Benjamini-Hochberg FDR correction
// ---------------------------------------------------------------------------

export function benjaminiHochberg(pValues: number[]): number[] {
  const n = pValues.length;
  if (n === 0) return [];

  // Create indexed array, sort by p-value ascending
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const adjusted = new Array<number>(n);
  let cumMin = 1;

  // Walk backwards enforcing monotonicity
  for (let rank = n; rank >= 1; rank--) {
    const entry = indexed[rank - 1];
    const corrected = (entry.p * n) / rank;
    cumMin = Math.min(cumMin, corrected);
    adjusted[entry.i] = Math.min(cumMin, 1);
  }

  return adjusted;
}

// ---------------------------------------------------------------------------
// Run enrichment
// ---------------------------------------------------------------------------

export function runEnrichment(
  significantGenes: string[],
  allGenes: string[],
  pathwayMap: Map<string, { category: string; genes: Set<string> }>,
): EnrichmentSummary {
  const sigSet = new Set(significantGenes.map(g => g.toUpperCase()));
  const allSet = new Set(allGenes.map(g => g.toUpperCase()));
  const N = allSet.size;
  const n = sigSet.size;

  const rawResults: Array<{
    pathway: string;
    category: string;
    k: number;
    K: number;
    pValue: number;
    genes: string[];
  }> = [];

  for (const [pathway, info] of pathwayMap) {
    // Count pathway genes that are in our background
    const pathwayGenesInBG: string[] = [];
    for (const g of info.genes) {
      if (allSet.has(g.toUpperCase())) pathwayGenesInBG.push(g);
    }
    const K = pathwayGenesInBG.length;
    if (K < 2) continue; // skip tiny pathways

    // Count significant genes in this pathway
    const overlapGenes: string[] = [];
    for (const g of pathwayGenesInBG) {
      if (sigSet.has(g.toUpperCase())) overlapGenes.push(g);
    }
    const k = overlapGenes.length;
    if (k === 0) continue;

    const pValue = hypergeometricPValue(k, K, n, N);

    rawResults.push({
      pathway,
      category: info.category,
      k,
      K,
      pValue,
      genes: overlapGenes,
    });
  }

  // BH correction
  const pValues = rawResults.map(r => r.pValue);
  const adjPValues = benjaminiHochberg(pValues);

  const results: EnrichmentResult[] = rawResults.map((r, i) => ({
    pathway: r.pathway,
    category: r.category as 'Reactome' | 'Hallmark',
    geneCount: r.k,
    geneRatio: `${r.k}/${n}`,
    pValue: r.pValue,
    adjPValue: adjPValues[i],
    genes: r.genes,
  }));

  // Sort by adj p-value ascending
  results.sort((a, b) => a.adjPValue - b.adjPValue);

  return {
    results,
    totalGenesWithProbes: N,
    significantGenes: n,
    testedPathways: results.length,
  };
}

// ---------------------------------------------------------------------------
// Gather pathway data from API
// ---------------------------------------------------------------------------

/**
 * Fetch pathway and gene-set membership for a list of genes,
 * building a unified pathway->genes map.
 *
 * Uses Promise.allSettled with concurrency limiting (max 10).
 */
export async function gatherPathwayMap(
  genes: string[],
  fetchFn: (build: string, gene: string) => Promise<any>,
  fetchSetsFn: (build: string, gene: string) => Promise<any>,
): Promise<Map<string, { category: string; genes: Set<string> }>> {
  const map = new Map<string, { category: string; genes: Set<string> }>();
  const build = 'hg38';

  // Concurrency-limited batch execution
  const batchSize = 10;
  for (let i = 0; i < genes.length; i += batchSize) {
    const batch = genes.slice(i, i + batchSize);

    const promises = batch.flatMap(gene => [
      fetchFn(build, gene)
        .then(resp => {
          if (resp?.data?.pathways) {
            for (const pw of resp.data.pathways) {
              const key = pw.pathway_name || pw.pathway_id;
              if (!key) continue;
              let entry = map.get(key);
              if (!entry) {
                entry = { category: 'Reactome', genes: new Set() };
                map.set(key, entry);
              }
              entry.genes.add(gene.toUpperCase());
            }
          }
        })
        .catch(() => {}),
      fetchSetsFn(build, gene)
        .then(resp => {
          if (resp?.data?.gene_sets) {
            for (const gs of resp.data.gene_sets) {
              const key = gs.gene_set_name;
              if (!key) continue;
              let entry = map.get(key);
              if (!entry) {
                entry = { category: 'Hallmark', genes: new Set() };
                map.set(key, entry);
              }
              entry.genes.add(gene.toUpperCase());
            }
          }
        })
        .catch(() => {}),
    ]);

    await Promise.allSettled(promises);
  }

  return map;
}
