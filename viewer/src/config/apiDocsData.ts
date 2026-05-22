/**
 * Polymer-3 API docs mock data — endpoints, examples, error codes.
 * Mirrors the live polymerbio.org docs surface but with curated subset
 * for the redesign demo.
 */

export interface APIParam {
  name: string;
  in: 'path' | 'query' | 'body';
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

export interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  group: string;
  description: string;
  params: APIParam[];
  exampleCurl: string;
  examplePython: string;
}

export const API_BASE = 'https://api.polymerbio.org';

export const ENDPOINTS: APIEndpoint[] = [
  {
    id: 'regions',
    method: 'GET',
    path: '/v1/regions/{build}/{region}',
    title: 'Region biophysics',
    group: 'Reference',
    description: 'Fetch genome-wide biophysics columns for a region. Returns stacking ΔG, melting Tm, curvature, groove geometry, A-form / Z-form propensities at 1 kb resolution.',
    params: [
      { name: 'build',  in: 'path', type: 'string', required: true, description: 'Genome build (hg38 or hg37).' },
      { name: 'region', in: 'path', type: 'string', required: true, description: '1-based closed UCSC region, e.g. chr17:7668421-7687490.' },
      { name: 'layers', in: 'query', type: 'string', required: false, description: 'Comma-separated layer ids to include.' },
    ],
    exampleCurl: `curl ${API_BASE}/v1/regions/hg38/chr17:7668421-7687490 \\\n  -H 'X-API-Key: $POLYMER_API_KEY'`,
    examplePython: `from polymer_genomics import PolymerClient\n\nclient = PolymerClient(api_key=POLYMER_API_KEY)\nregion = client.regions.fetch("hg38", "chr17:7668421-7687490")\nprint(region.stacking_dg37.mean)`,
  },
  {
    id: 'genes',
    method: 'GET',
    path: '/v1/genes/{build}/{symbol}',
    title: 'Gene profile',
    group: 'Reference',
    description: 'Gene-level profile: coordinates, transcripts, constraint metrics, biosynthetic cost, expression context across GTEx tissues.',
    params: [
      { name: 'build',  in: 'path', type: 'string', required: true, description: 'Genome build.' },
      { name: 'symbol', in: 'path', type: 'string', required: true, description: 'HGNC gene symbol or Ensembl ID.' },
    ],
    exampleCurl: `curl ${API_BASE}/v1/genes/hg38/TP53`,
    examplePython: `gene = client.genes.fetch("hg38", "TP53")\nprint(gene.constraint.pli, gene.constraint.loeuf)`,
  },
  {
    id: 'evaluate',
    method: 'POST',
    path: '/v1/evaluate',
    title: 'Sequence evaluation',
    group: 'Compute',
    description: 'Physics linter for any DNA sequence. Returns thermodynamic profile, CpG islands, structural form propensities, and 13 anti-hallucination flag codes.',
    params: [
      { name: 'sequence', in: 'body', type: 'string', required: true, description: 'DNA sequence (ACGTN, ≤ 100 kb).' },
      { name: 'name',     in: 'body', type: 'string', required: false, description: 'Identifier for this run.' },
      { name: 'analysis', in: 'body', type: 'string', required: false, default: 'full', description: 'full | thermodynamics | structural | flags' },
    ],
    exampleCurl: `curl -X POST ${API_BASE}/v1/evaluate \\\n  -H 'Content-Type: application/json' \\\n  -d '{"sequence":"ATGCGATCGATCG...","analysis":"full"}'`,
    examplePython: `result = client.evaluate("ATGCGATCGATCG...", analysis="full")\nprint(result.summary.gc_content, result.flag_counts.warnings)`,
  },
  {
    id: 'aggregation',
    method: 'GET',
    path: '/v1/aggregation/{build}/{region}',
    title: 'Region aggregation',
    group: 'Reference',
    description: 'Pre-binned aggregate counts of layer features in a region. Useful for genome-wide overviews. Default bin size: 1 Mb.',
    params: [
      { name: 'build',      in: 'path',  type: 'string', required: true, description: 'Genome build.' },
      { name: 'region',     in: 'path',  type: 'string', required: true, description: 'UCSC region string.' },
      { name: 'layers',     in: 'query', type: 'string', required: false, description: 'Layer ids to aggregate.' },
      { name: 'resolution', in: 'query', type: 'integer', required: false, default: '1000000', description: 'Bin width in bp.' },
    ],
    exampleCurl: `curl '${API_BASE}/v1/aggregation/hg38/chr17:1-83257441?layers=cpg_sites'`,
    examplePython: `agg = client.aggregation.fetch("hg38", "chr17:1-83257441", layers=["cpg_sites"], resolution=1_000_000)`,
  },
  {
    id: 'probes',
    method: 'GET',
    path: '/v1/probes/{build}/{probe_id}',
    title: 'Methylation probe',
    group: 'Reference',
    description: 'Probe-level metadata for EPIC v2 / v1 / 450K. Returns position, context (island/shore/shelf/open sea), gene overlap, design type.',
    params: [
      { name: 'build',    in: 'path', type: 'string', required: true, description: 'Genome build.' },
      { name: 'probe_id', in: 'path', type: 'string', required: true, description: 'Illumina probe ID, e.g. cg13580121.' },
    ],
    exampleCurl: `curl ${API_BASE}/v1/probes/hg38/cg13580121`,
    examplePython: `probe = client.probes.fetch("hg38", "cg13580121")\nprint(probe.position, probe.context)`,
  },
  {
    id: 'layers',
    method: 'GET',
    path: '/v1/layers',
    title: 'List layers',
    group: 'Reference',
    description: 'List all available data layers with version, license, evidence class, and content hash.',
    params: [
      { name: 'build', in: 'query', type: 'string', required: false, description: 'Filter to a single build.' },
    ],
    exampleCurl: `curl ${API_BASE}/v1/layers`,
    examplePython: `layers = client.layers.list()\nfor l in layers:\n    print(l.id, l.version, l.evidence_class)`,
  },
  {
    id: 'search',
    method: 'GET',
    path: '/v1/search/genes',
    title: 'Gene search',
    group: 'Reference',
    description: 'Typeahead gene search by symbol, alias, or Ensembl ID. Returns top 20 matches with chromosome and biotype.',
    params: [
      { name: 'q',     in: 'query', type: 'string', required: true,  description: 'Query string, minimum 2 characters.' },
      { name: 'build', in: 'query', type: 'string', required: false, description: 'Genome build.' },
    ],
    exampleCurl: `curl '${API_BASE}/v1/search/genes?q=TP53'`,
    examplePython: `hits = client.search.genes("TP53")\nfor h in hits:\n    print(h.symbol, h.chromosome)`,
  },
];

export const ENDPOINT_GROUPS = (() => {
  const groups: Record<string, APIEndpoint[]> = {};
  for (const e of ENDPOINTS) {
    if (!groups[e.group]) groups[e.group] = [];
    groups[e.group].push(e);
  }
  return Object.entries(groups);
})();

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export interface ErrorCode {
  status: number;
  code: string;
  description: string;
}

export const ERROR_CODES: ErrorCode[] = [
  { status: 400, code: 'INVALID_REGION',     description: 'Region string does not parse as a UCSC interval.' },
  { status: 400, code: 'INVALID_BUILD',      description: 'Build must be hg38 or hg37.' },
  { status: 400, code: 'INVALID_SEQUENCE',   description: 'Sequence contains non-ACGTN characters or is too short.' },
  { status: 401, code: 'MISSING_API_KEY',    description: 'Provide X-API-Key header.' },
  { status: 403, code: 'RATE_LIMITED',       description: 'Rate limit exceeded; retry after Retry-After seconds.' },
  { status: 404, code: 'GENE_NOT_FOUND',     description: 'No gene matches the provided symbol or Ensembl ID.' },
  { status: 404, code: 'PROBE_NOT_FOUND',    description: 'No probe matches the provided ID for this platform.' },
  { status: 413, code: 'REGION_TOO_LARGE',   description: 'Region exceeds 10 Mb. Use /v1/aggregation for genome-wide views.' },
  { status: 422, code: 'UNSUPPORTED_LAYER',  description: 'Layer is not available for the requested build.' },
  { status: 429, code: 'TOO_MANY_REQUESTS',  description: 'Request quota for this minute exhausted.' },
  { status: 500, code: 'INTERNAL_ERROR',     description: 'Unexpected server error; transient. Retry with backoff.' },
  { status: 504, code: 'COMPUTE_TIMEOUT',    description: 'Query exceeded the 30-second compute window.' },
];

// ---------------------------------------------------------------------------
// MCP tools (subset for the docs page)
// ---------------------------------------------------------------------------

export interface MCPTool {
  name: string;
  group: 'reference' | 'compute';
  signature: string;
  description: string;
}

export const MCP_TOOLS: MCPTool[] = [
  { name: 'polymer.regions.fetch',    group: 'reference', signature: 'build, region, layers?', description: 'Genome-wide biophysics for a region.' },
  { name: 'polymer.genes.fetch',      group: 'reference', signature: 'build, symbol',         description: 'Gene-level profile with constraint metrics.' },
  { name: 'polymer.probes.fetch',     group: 'reference', signature: 'build, probe_id',       description: 'EPIC v2 / v1 / 450K probe metadata.' },
  { name: 'polymer.evaluate',         group: 'compute',   signature: 'sequence, analysis?',   description: 'Physics linter on a DNA sequence.' },
  { name: 'polymer.aggregation',      group: 'compute',   signature: 'build, region, layers, resolution', description: 'Pre-binned layer counts.' },
  { name: 'polymer.search.genes',     group: 'reference', signature: 'q, build?',             description: 'Gene typeahead search.' },
  { name: 'polymer.clocks.predict',   group: 'compute',   signature: 'betas, clock',          description: 'Apply DNAm clock coefficients to a beta matrix.' },
  { name: 'polymer.transposome.score',group: 'compute',   signature: 'region, family?',       description: 'TE/ERV scoring + awakening propensity.' },
];

export const MCP_REFERENCE_COUNT = 38;
export const MCP_COMPUTE_COUNT = 32;
export const MCP_TOTAL = MCP_REFERENCE_COUNT + MCP_COMPUTE_COUNT;
