import { normalizeContig, validRegion, type GenomeBuild } from './reference';

export interface SharedViewerState {
  build: GenomeBuild; chr: string; start: number; end: number;
  activeLayers: string[];
  showCodons: boolean; showGC: boolean; showStability: boolean; showStructure: boolean; showMotifs: boolean;
  visibleCellTypes: string[]; enabledMotifs: string[]; showContext: boolean; codonTranscript: string | null;
}
export const VIEWER_DEFAULTS = {
  activeLayers: ['gencode_v44', 'cpg_sites'],
  showCodons: false, showGC: true, showStability: false, showStructure: false, showMotifs: false,
  visibleCellTypes: ['Gran', 'Mono', 'NK', 'Bcell', 'CD4T', 'CD8T'], enabledMotifs: [] as string[], showContext: true, codonTranscript: null as string | null,
};
const flags = ['showCodons', 'showGC', 'showStability', 'showStructure', 'showMotifs', 'showContext'] as const;
function list(params: URLSearchParams, key: string, fallback: string[]) {
  if (!params.has(key)) return [...fallback];
  const items = (params.get(key) || '').split(',').filter(Boolean);
  if (items.length > 50 || items.some(item => !/^[a-zA-Z0-9_. -]{1,80}$/.test(item))) throw new Error(`Invalid ${key} selection.`);
  return [...new Set(items)];
}
export function parseViewerUrl(pathname: string, search: string): SharedViewerState {
  if (pathname.length + search.length > 8000) throw new Error('Viewer link is too long.');
  const match = decodeURIComponent(pathname).match(/^\/genomics\/view\/(hg38|hg37)\/([^/:]+):(\d+)-(\d+)\/?$/);
  if (!match) throw new Error('Invalid viewer link. Use a supported assembly and chr:start-end interval.');
  const build = match[1] as GenomeBuild, chr = normalizeContig(match[2]), start = Number(match[3]), end = Number(match[4]);
  if (!validRegion(build, chr, start, end)) throw new Error('The interval is outside the selected reference chromosome or has invalid coordinates.');
  const params = new URLSearchParams(search);
  if (params.has('v') && params.get('v') !== '1') throw new Error('This viewer link uses an unsupported state version.');
  const state: SharedViewerState = { ...VIEWER_DEFAULTS, build, chr, start, end,
    activeLayers: list(params, 'layers', VIEWER_DEFAULTS.activeLayers),
    visibleCellTypes: list(params, 'cells', VIEWER_DEFAULTS.visibleCellTypes), enabledMotifs: list(params, 'motifs', []),
  };
  const transcript = params.get('transcript');
  if (transcript && !/^[a-zA-Z0-9_.-]{1,100}$/.test(transcript)) throw new Error('Invalid transcript identifier.');
  state.codonTranscript = transcript || null;
  for (const key of flags) {
    if (params.has(key) && !['0', '1'].includes(params.get(key)!)) throw new Error(`Invalid ${key} setting.`);
    if (params.has(key)) state[key] = params.get(key) === '1';
  }
  return state;
}
export function serializeViewerState(state: SharedViewerState): string {
  const params = new URLSearchParams({ v: '1', layers: state.activeLayers.join(',') });
  for (const key of flags) params.set(key, state[key] ? '1' : '0');
  if (state.codonTranscript) params.set('transcript', state.codonTranscript);
  params.set('cells', state.visibleCellTypes.join(',')); params.set('motifs', state.enabledMotifs.join(','));
  return `/genomics/view/${state.build}/${state.chr}:${state.start}-${state.end}?${params}`;
}
