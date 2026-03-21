import { getCached, setCache } from './cache';

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
  evidence_class?: string | null;
  tier?: string | null;
  validation_status?: string | null;
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
  chromosome?: string;
  type: string;
  match_type?: 'direct' | 'alias';
  matched_alias?: string;
}

// --- API functions ---

async function fetchJSON<T>(url: string, opts?: { timeout?: number; signal?: AbortSignal }): Promise<T> {
  const timeout = opts?.timeout ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  const signal = opts?.signal
    ? AbortSignal.any([opts.signal, controller.signal])
    : controller.signal;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as Record<string, Record<string, string>>)?.error?.message ||
          `API error: ${res.status}`,
      );
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out — the server may be processing complex data. Try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
  const layerStr = layers?.slice().sort().join(',') ?? '';
  const key = `agg:${build}:${region}:${resolution}:${layerStr}`;
  const cached = getCached<AggregationResponse>(key);
  if (cached) return cached;
  const params = new URLSearchParams({ resolution: String(resolution) });
  if (layers?.length) params.set('layers', layers.join(','));
  const result = await fetchJSON<AggregationResponse>(
    `${API_BASE}/v1/aggregation/${build}/${region}?${params}`,
  );
  setCache(key, result, 600_000); // 10 min TTL — chromosome-level data is stable
  return result;
}

export async function fetchLayers(build?: string): Promise<LayerInfo[]> {
  const key = `layers:${build ?? 'all'}`;
  const cached = getCached<LayerInfo[]>(key);
  if (cached) return cached;
  const params = build ? `?build=${build}` : '';
  const res = await fetchJSON<{ layers: LayerInfo[] }>(
    `${API_BASE}/v1/layers${params}`,
  );
  setCache(key, res.layers);
  return res.layers;
}

export interface LayerSummary {
  build: string;
  layer_counts: Record<string, number | null>;
  gene_features: Record<string, number>;
  protein_coding_genes: number | null;
  total_genes: number | null;
}

export async function fetchLayerSummary(build: string): Promise<LayerSummary> {
  const key = `layerSummary:${build}`;
  const cached = getCached<LayerSummary>(key);
  if (cached) return cached;
  const result = await fetchJSON<LayerSummary>(
    `${API_BASE}/v1/layers/summary/${build}`,
  );
  setCache(key, result);
  return result;
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
  const key = `gene:${build}:${symbol}`;
  const cached = getCached<RegionResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<RegionResponse>(`${API_BASE}/v1/genes/${build}/${symbol}`);
  setCache(key, result, 600_000);
  return result;
}

export interface ProbeResponse {
  status: string;
  data: {
    probe: {
      probe_id: string;
      seqname: string;
      start: number;
      end: number;
      gene_symbol: string | null;
      cpg_context: string;
    };
    crossmap: Array<{ dst_platform: string; dst_probe_id: string; confidence: number }>;
  };
}

export async function fetchProbe(build: string, probeId: string): Promise<ProbeResponse> {
  return fetchJSON(`${API_BASE}/v1/probes/${build}/${encodeURIComponent(probeId)}`);
}

// --- Gene Cost types ---

export interface GeneCostCoordinates {
  seqname: string;
  start: number;
  end: number;
  width: number;
  strand: string;
}

export interface GeneCostIdentity {
  gene_symbol: string;
  uniprot_id: string | null;
  protein_name: string | null;
  protein_length: number | null;
}

export interface GeneCostBiosynthetic {
  ecpa_b20: number | null;
  ecpa_h11: number | null;
  c_protein: number | null;
  c_aa_synthesis: number | null;
  c_translation: number | null;
}

export interface GeneCostElemental {
  n_protein: number | null;
  s_protein: number | null;
  c_atoms: number | null;
  mw_kda: number | null;
  cost_per_kda: number | null;
  n_per_kda: number | null;
  s_per_kda: number | null;
}

export interface GeneCostComposition {
  frac_cheap: number | null;
  frac_moderate: number | null;
  frac_expensive: number | null;
  frac_very_expensive: number | null;
  n_cys: number | null;
  n_met: number | null;
  n_trp: number | null;
  n_arg: number | null;
  n_lys: number | null;
}

export interface GeneCostCodonOptimization {
  cds_length_nt: number | null;
  n_codons: number | null;
  gc3: number | null;
  gc_cds: number | null;
  cai: number | null;
  tai: number | null;
  enc: number | null;
  fop: number | null;
}

export interface GeneCostTissue {
  tissue: string;
  tpm: number | null;
  ewgc: number | null;
}

export interface GeneCostExpression {
  mean_tpm: number | null;
  max_tpm: number | null;
  tissues: GeneCostTissue[];
}

export interface GeneCostData {
  coordinates: GeneCostCoordinates | null;
  identity: GeneCostIdentity;
  biosynthetic_cost: GeneCostBiosynthetic;
  elemental: GeneCostElemental;
  composition: GeneCostComposition;
  codon_optimization: GeneCostCodonOptimization;
  expression: GeneCostExpression;
}

export interface GeneCostResponse {
  status: string;
  layers_resolved: LayerResolved[];
  data: GeneCostData;
  timing: { query_time_ms: number; db_time_ms: number };
}

export async function fetchGeneCost(
  build: string,
  symbol: string,
): Promise<GeneCostResponse> {
  const key = `geneCost:${build}:${symbol}`;
  const cached = getCached<GeneCostResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<GeneCostResponse>(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/cost`);
  setCache(key, result, 600_000);
  return result;
}

// --- Gene Constraint (gnomAD) ---

export interface GeneConstraintData {
  coordinates: { seqname: string; start: number; end: number; width: number; strand: string } | null;
  identity: { gene_symbol: string; transcript: string | null };
  constraint: {
    pli: number | null;
    loeuf: number | null;
    mis_z: number | null;
    syn_z: number | null;
    obs_lof: number | null;
    exp_lof: number | null;
    obs_mis: number | null;
    exp_mis: number | null;
    obs_syn: number | null;
    exp_syn: number | null;
  };
  gnomad_version: string | null;
}

export interface GeneConstraintResponse {
  status: string;
  data: GeneConstraintData;
}

export async function fetchGeneConstraint(
  build: string,
  symbol: string,
): Promise<GeneConstraintResponse> {
  const key = `geneConstraint:${build}:${symbol}`;
  const cached = getCached<GeneConstraintResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<GeneConstraintResponse>(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/constraint`);
  setCache(key, result, 600_000);
  return result;
}

// --- Protein Abundance (PaxDb) ---

export interface ProteinAbundanceTissue {
  tissue: string;
  organ_group: string | null;
  abundance_ppm: number | null;
  coverage: number | null;
  spectral_count: number | null;
}

export interface ProteinAbundanceData {
  coordinates: { seqname: string; start: number; end: number } | null;
  identity: { gene_symbol: string; uniprot_id: string | null };
  tissues: ProteinAbundanceTissue[];
}

export interface ProteinAbundanceResponse {
  status: string;
  data: ProteinAbundanceData;
}

export async function fetchProteinAbundance(
  build: string,
  symbol: string,
): Promise<ProteinAbundanceResponse> {
  const key = `proteinAbundance:${build}:${symbol}`;
  const cached = getCached<ProteinAbundanceResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<ProteinAbundanceResponse>(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/protein-abundance`);
  setCache(key, result, 600_000);
  return result;
}

// --- Protein Atlas (HPA) ---

export interface ProteinAtlasTissue {
  tissue: string;
  cell_type: string | null;
  expression_level: string; // 'High' | 'Medium' | 'Low' | 'Not detected'
  reliability: string | null;
}

export interface ProteinAtlasLocation {
  location: string;
  reliability: string | null;
  go_id: string | null;
}

export interface ProteinAtlasData {
  coordinates: { seqname: string; start: number; end: number } | null;
  gene_symbol: string;
  tissue_expression: {
    n_tissues: number;
    tissues: ProteinAtlasTissue[];
  };
  subcellular_location: {
    n_locations: number;
    locations: ProteinAtlasLocation[];
  };
}

export interface ProteinAtlasResponse {
  status: string;
  data: ProteinAtlasData;
}

export async function fetchProteinAtlas(
  build: string,
  symbol: string,
): Promise<ProteinAtlasResponse> {
  const key = `proteinAtlas:${build}:${symbol}`;
  const cached = getCached<ProteinAtlasResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<ProteinAtlasResponse>(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/protein-atlas`);
  setCache(key, result, 600_000);
  return result;
}

// --- Gene Pathways (Reactome) ---

export interface GenePathway {
  pathway_id: string;
  pathway_name: string;
  pathway_hierarchy: string | null;
  evidence_code: string | null;
  source: string | null;
}

export interface GenePathwaysData {
  gene_symbol: string;
  n_pathways: number;
  pathways: GenePathway[];
}

export interface GenePathwaysResponse {
  status: string;
  data: GenePathwaysData;
}

export async function fetchGenePathways(
  build: string,
  symbol: string,
): Promise<GenePathwaysResponse> {
  const key = `genePathways:${build}:${symbol}`;
  const cached = getCached<GenePathwaysResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<GenePathwaysResponse>(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/pathways`);
  setCache(key, result, 600_000);
  return result;
}

// --- Gene Sets (MSigDB Hallmark) ---

export interface GeneSetMembership {
  collection: string;
  gene_set_name: string;
  description: string | null;
  source: string | null;
}

export interface GeneSetsData {
  gene_symbol: string;
  n_gene_sets: number;
  gene_sets: GeneSetMembership[];
}

export interface GeneSetsResponse {
  status: string;
  data: GeneSetsData;
}

export async function fetchGeneSets(
  build: string,
  symbol: string,
): Promise<GeneSetsResponse> {
  const key = `geneSets:${build}:${symbol}`;
  const cached = getCached<GeneSetsResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<GeneSetsResponse>(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/gene-sets`);
  setCache(key, result, 600_000);
  return result;
}

// --- CpG Profile ---

export interface CpgProfileSection {
  evidence_class: string;
  scale: string;
  status: string;
  provenance?: { layer_key: string; version: string; content_hash: string | null };
  rationale?: string;
  [key: string]: unknown;
}

export interface CpgProfileResponse {
  status: string;
  coordinate_system: string;
  query: { build: string; input: string; resolved_as: string };
  layers_resolved: LayerResolved[];
  data: {
    site_identity: CpgProfileSection;
    gene_context: CpgProfileSection;
    nearby_gene_priors: CpgProfileSection;
    regulatory_context: CpgProfileSection;
    regional_conservation: CpgProfileSection;
    regional_sequence_biophysics: CpgProfileSection;
    methylation_biophysics_model: CpgProfileSection;
  };
  timing: { query_time_ms: number; db_time_ms: number };
}

export async function fetchCpgProfile(
  build: string,
  query: string,
): Promise<CpgProfileResponse> {
  return fetchJSON(`${API_BASE}/v1/cpg-profile/${build}/${encodeURIComponent(query)}`);
}

// --- Epigenetic Clocks ---

export interface ClockMetadata {
  clock_name: string;
  display_name: string;
  n_probes: number;
  tissue: string;
  outcome: string;
  intercept: number | null;
  age_transform: string;
  platform: string;
  pmid: string | null;
  source_citation: string;
}

export interface ClockProbe {
  probe_id: string;
  coefficient: number;
  source_citation: string;
}

export interface ClockListResponse {
  status: string;
  query: Record<string, unknown>;
  data: { clocks: ClockMetadata[]; n: number };
}

export interface ClockDetailResponse {
  status: string;
  query: { clock: string };
  data: { clock: ClockMetadata; probes: ClockProbe[]; n_loaded: number };
}

export interface ClockProbeResponse {
  status: string;
  query: { probe_id: string };
  data: { clocks: Array<ClockMetadata & { coefficient: number }>; n: number };
}

export async function fetchClockList(
  opts?: { signal?: AbortSignal },
): Promise<ClockListResponse> {
  const key = 'clockList';
  const cached = getCached<ClockListResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<ClockListResponse>(
    `${API_BASE}/v1/reference/clock-probes`,
    opts,
  );
  setCache(key, result);
  return result;
}

export async function fetchClockDetail(
  clock: string,
  opts?: { signal?: AbortSignal },
): Promise<ClockDetailResponse> {
  const key = `clockDetail:${clock}`;
  const cached = getCached<ClockDetailResponse>(key);
  if (cached) return cached;
  const result = await fetchJSON<ClockDetailResponse>(
    `${API_BASE}/v1/reference/clock-probes?clock=${encodeURIComponent(clock)}`,
    opts,
  );
  setCache(key, result);
  return result;
}

export async function fetchClockProbeSearch(probeId: string): Promise<ClockProbeResponse> {
  return fetchJSON(`${API_BASE}/v1/reference/clock-probes?probe_id=${encodeURIComponent(probeId)}`);
}

// ─── Transposome ────────────────────────────────────────────────────
import type { TEFamily, TEFamilyDetail } from './transposome-types';

export interface TEFamiliesResponse {
  status: string;
  data: { families: TEFamily[] };
}

export interface TEFamilyDetailResponse {
  status: string;
  data: TEFamilyDetail;
}

export async function fetchTEFamilies(): Promise<TEFamiliesResponse> {
  return fetchJSON<TEFamiliesResponse>(`${API_BASE}/v1/transposome/families`);
}

export async function fetchTEFamilyDetail(familyId: string): Promise<TEFamilyDetailResponse> {
  return fetchJSON<TEFamilyDetailResponse>(
    `${API_BASE}/v1/transposome/family/${encodeURIComponent(familyId)}`,
  );
}
