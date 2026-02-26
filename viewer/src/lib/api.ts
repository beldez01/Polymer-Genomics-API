const API_BASE = '/api';

// --- Response types ---

export interface SequenceResponse {
  build: string;
  chr: string;
  start: number;
  end: number;
  coordinate_system: string;
  length: number;
  sequence: string;
}

export interface GRanges {
  class: 'GRanges';
  seqnames: string[];
  ranges: { start: number[]; end: number[]; width: number[] };
  strand: string[];
  mcols: Record<string, (string | number | null)[]>;
  n: number;
}

export interface LayerResolved {
  layer_key: string;
  version: string;
  layer_id: string;
  content_hash: string | null;
  status: string;
}

export interface RegionResponse {
  status: string;
  coordinate_system: string;
  query: Record<string, unknown>;
  layers_resolved: LayerResolved[];
  data: Record<string, GRanges>;
  timing: { query_time_ms: number; db_time_ms: number };
}

export interface TileResponse extends RegionResponse {
  tile: { chr: string; index: number; resolution: number; start: number; end: number };
}

export interface AggBin {
  bin_start: number;
  bin_end: number;
  count: number;
  density: number;
  avg_gc?: number;
}

export interface AggregationLayerData {
  bins: AggBin[];
  resolution: number;
  n_bins: number;
}

export interface AggregationResponse {
  status: string;
  data: Record<string, AggregationLayerData>;
}

export interface LayerInfo {
  layer_key: string;
  version: string;
  name: string;
  type: string;
  build: string;
  license_class: string;
  row_count: number | null;
  is_default: boolean;
}

export interface SearchResult {
  gene_symbol: string;
  type: string;
}

// --- API functions ---

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, Record<string, string>>)?.error?.message ||
        `API error: ${res.status}`,
    );
  }
  return res.json();
}

export async function fetchSequence(
  build: string,
  region: string,
): Promise<SequenceResponse> {
  return fetchJSON(`${API_BASE}/v1/sequence/${build}/${region}`);
}

export async function fetchRegion(
  build: string,
  region: string,
  layers?: string[],
): Promise<RegionResponse> {
  const layerParam = layers?.length ? `?layers=${layers.join(',')}` : '';
  return fetchJSON(`${API_BASE}/v1/regions/${build}/${region}${layerParam}`);
}

export async function fetchTile(
  build: string,
  chr: string,
  resolution: number,
  tileIndex: number,
  layers?: string[],
): Promise<TileResponse> {
  const layerParam = layers?.length ? `?layers=${layers.join(',')}` : '';
  return fetchJSON(
    `${API_BASE}/v1/tiles/${build}/${chr}/tile/${resolution}/${tileIndex}${layerParam}`,
  );
}

export async function fetchAggregation(
  build: string,
  region: string,
  resolution: number,
  layers?: string[],
): Promise<AggregationResponse> {
  const params = new URLSearchParams({ resolution: String(resolution) });
  if (layers?.length) params.set('layers', layers.join(','));
  return fetchJSON(
    `${API_BASE}/v1/aggregation/${build}/${region}?${params}`,
  );
}

export async function fetchLayers(build?: string): Promise<LayerInfo[]> {
  const params = build ? `?build=${build}` : '';
  const res = await fetchJSON<{ layers: LayerInfo[] }>(
    `${API_BASE}/v1/layers${params}`,
  );
  return res.layers;
}

export async function searchGenes(
  query: string,
  build: string,
): Promise<SearchResult[]> {
  const res = await fetchJSON<{ results: SearchResult[] }>(
    `${API_BASE}/v1/search?q=${encodeURIComponent(query)}&build=${build}`,
  );
  return res.results;
}

export async function fetchGene(
  build: string,
  symbol: string,
): Promise<RegionResponse> {
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${symbol}`);
}
