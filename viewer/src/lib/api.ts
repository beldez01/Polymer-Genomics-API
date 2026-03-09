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
  chromosome?: string;
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
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/cost`);
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
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/constraint`);
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
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/protein-abundance`);
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
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/protein-atlas`);
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
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/pathways`);
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
  return fetchJSON(`${API_BASE}/v1/genes/${build}/${encodeURIComponent(symbol)}/gene-sets`);
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
