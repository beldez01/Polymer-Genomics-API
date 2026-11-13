import { dataResolution } from '@/stores/viewport';
import {
  fetchSequence,
  fetchLayers,
  fetchRegion,
  fetchTile,
  type TileResponse,
  type GRanges,
  type LayerResolved,
} from './api';
import { contigLength, type GenomeBuild } from './reference';

export interface ViewportData {
  sequence: string | null; // Raw DNA sequence (only at bp resolution)
  sequenceStart?: number; // 1-based genomic coordinate for sequence[0]
  layers: Record<string, GRanges>; // Feature data per layer
  layersResolved: LayerResolved[]; // Epistemic metadata per layer
  resolution: number; // The resolution tier used
  unsupportedLayers?: string[];
  sequenceWarning?: string;
}

/** Fine-zoom data is fetched in overlapping windows so a drag can land on
 * nearby coordinates without waiting for another round trip. */
export function fineWindowBounds(build: string, chr: string, start: number, end: number) {
  const width = end - start + 1;
  const span = Math.max(2048, width * 8);
  const stride = span - width;
  const index = Math.floor((start - 1) / stride);
  const length = contigLength(build as GenomeBuild, chr);
  let windowStart = index * stride + 1;
  let windowEnd = Math.min(length ?? Number.MAX_SAFE_INTEGER, windowStart + span - 1);
  if (windowEnd < end) {
    windowEnd = end;
    windowStart = Math.max(1, windowEnd - span + 1);
  }
  if (length && windowEnd === length) windowStart = Math.max(1, Math.min(windowStart, length - span + 1));
  return { start: windowStart, end: windowEnd };
}

const FINE_CACHE_TTL = 30_000;
const FINE_CACHE_MAX = 12;
const fineCache = new Map<string, { data: ViewportData; expires: number }>();
const layerAvailabilityCache = new Map<string, { layers: Set<string>; expires: number }>();
const finePrefetching = new Set<string>();
const finePrefetched = new Set<string>();

function fineCacheKey(build: string, chr: string, start: number, end: number, layers: string[]) {
  return `${build}:${chr}:${start}-${end}:${layers.slice().sort().join(',')}`;
}

async function loadFineWindow(build: string, chr: string, start: number, end: number, layers: string[], signal?: AbortSignal): Promise<ViewportData> {
  let availability = layerAvailabilityCache.get(build);
  if (!availability || availability.expires <= Date.now()) {
    const resolved = new Set((await fetchLayers(build)).map(layer => layer.layer_key));
    availability = { layers: resolved, expires: Date.now() + 300_000 };
    layerAvailabilityCache.set(build, availability);
  }
  signal?.throwIfAborted();
  const unsupportedLayers = layers.filter(layer => !availability!.layers.has(layer));
  const supportedLayers = layers.filter(layer => availability!.layers.has(layer));
  const windowWidth = end - start + 1;
  const region = `${chr}:${start}-${end}`;
  const [seqResult, featureRes] = await Promise.all([
    fetchSequence(build, region, signal).catch(() => null),
    supportedLayers.length ? fetchRegion(build, region, supportedLayers, signal) : Promise.resolve({ data: {}, layers_resolved: [] }),
  ]);
  signal?.throwIfAborted();
  const sequence = seqResult?.sequence?.length === windowWidth ? seqResult.sequence : null;
  return {
    sequence,
    sequenceStart: sequence ? start : undefined,
    sequenceWarning: sequence ? undefined : 'Reference sequence unavailable or length does not match the requested interval.',
    unsupportedLayers,
    layers: featureRes.data,
    layersResolved: featureRes.layers_resolved ?? [],
    resolution: 1,
  };
}

async function fetchCachedFineWindow(build: string, chr: string, start: number, end: number, layers: string[], requestWidth: number, signal?: AbortSignal): Promise<ViewportData> {
  const key = fineCacheKey(build, chr, start, end, layers);
  const cached = fineCache.get(key);
  if (cached && cached.expires > Date.now()) {
    fineCache.delete(key);
    fineCache.set(key, cached);
    return cached.data;
  }
  const data = await loadFineWindow(build, chr, start, end, layers, signal);
  if (signal?.aborted) return data;
  if (fineCache.size >= FINE_CACHE_MAX) fineCache.delete(fineCache.keys().next().value!);
  fineCache.set(key, { data, expires: Date.now() + FINE_CACHE_TTL });
  scheduleFineNeighbors(build, chr, start, end, layers, requestWidth);
  return data;
}

function scheduleFineNeighbors(build: string, chr: string, start: number, end: number, layers: string[], width: number) {
  const stride = Math.max(2048, width * 8) - width;
  const length = contigLength(build as GenomeBuild, chr) ?? Number.MAX_SAFE_INTEGER;
  const sourceKey = fineCacheKey(build, chr, start, end, layers);
  if (finePrefetched.has(sourceKey)) return;
  finePrefetched.add(sourceKey);
  if (finePrefetched.size > 128) finePrefetched.delete(finePrefetched.values().next().value!);
  for (const offset of [-stride, stride]) {
    const targetStart = Math.max(1, Math.min(length, start + offset));
    const targetEnd = Math.min(length, targetStart + width - 1);
    if (targetEnd - targetStart + 1 !== width) continue;
    const bounds = fineWindowBounds(build, chr, targetStart, targetEnd);
    const key = fineCacheKey(build, chr, bounds.start, bounds.end, layers);
    const existing = fineCache.get(key);
    if ((existing && existing.expires > Date.now()) || finePrefetching.has(key)) continue;
    finePrefetching.add(key);
    void loadFineWindow(build, chr, bounds.start, bounds.end, layers).then(data => {
      if (fineCache.size >= FINE_CACHE_MAX) fineCache.delete(fineCache.keys().next().value!);
      fineCache.set(key, { data, expires: Date.now() + FINE_CACHE_TTL });
    }).catch(() => {}).finally(() => finePrefetching.delete(key));
  }
}

// ---------------------------------------------------------------------------
// Simple LRU tile cache
// ---------------------------------------------------------------------------

const CACHE_MAX = 500;
const tileCache = new Map<string, TileResponse>();
const tileExpiry = new Map<string, number>();

function tileCacheKey(
  build: string,
  chr: string,
  resolution: number,
  index: number,
  layers: string[],
): string {
  return `${build}:${chr}:${resolution}:${index}:${layers.slice().sort().join(',')}`;
}

function cacheTile(key: string, data: TileResponse): void {
  if (tileCache.size >= CACHE_MAX) {
    // Remove oldest entry (first key in Map iteration order)
    const firstKey = tileCache.keys().next().value;
    if (firstKey !== undefined) { tileCache.delete(firstKey); tileExpiry.delete(firstKey); }
  }
  tileCache.set(key, data);
  tileExpiry.set(key, Date.now() + 300_000);
}

function getCachedTile(key: string): TileResponse | undefined {
  if ((tileExpiry.get(key) ?? 0) < Date.now()) { tileCache.delete(key); tileExpiry.delete(key); }
  const val = tileCache.get(key);
  if (val) {
    // Move to end (most recently used)
    tileCache.delete(key);
    tileCache.set(key, val);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

/**
 * Fetch all data needed for the current viewport.
 *
 * At fine zoom (<=200 bp): fetches raw sequence + direct region features.
 * At coarser zoom: fetches tiles covering the viewport and merges them.
 */
export async function fetchViewportData(
  build: string,
  chr: string,
  start: number, // 1-based
  end: number, // 1-based
  layers: string[],
  signal?: AbortSignal,
): Promise<ViewportData> {
  const width = end - start + 1;
  const resolution = dataResolution(width);
  if (resolution === 1) {
    const window = fineWindowBounds(build, chr, start, end);
    return fetchCachedFineWindow(build, chr, window.start, window.end, layers, width, signal);
  }
  // The live registry is authoritative for assembly availability. Some endpoints
  // resolve hg38 layer versions even for an empty hg37 dataset; do not infer support.
  const available = new Set((await fetchLayers(build)).map(layer => layer.layer_key));
  signal?.throwIfAborted();
  const unsupportedLayers = layers.filter(layer => !available.has(layer));
  layers = layers.filter(layer => available.has(layer));

  if (!layers.length) return { sequence: null, layers: {}, layersResolved: [], resolution, unsupportedLayers };

  // Coarse zoom: fetch tiles covering [start, end]
  const firstTile = Math.floor((start - 1) / resolution);
  const lastTile = Math.floor((end - 1) / resolution);

  const tilePromises: Promise<TileResponse>[] = [];
  for (let i = firstTile; i <= lastTile; i++) {
    const key = tileCacheKey(build, chr, resolution, i, layers);
    const cached = getCachedTile(key);
    if (cached) {
      tilePromises.push(Promise.resolve(cached));
    } else {
      tilePromises.push(
        fetchTile(build, chr, resolution, i, layers, signal).then((tile) => {
          signal?.throwIfAborted();
          cacheTile(key, tile);
          return tile;
        }),
      );
    }
  }

  const tiles = await Promise.all(tilePromises);

  // Merge tile data across all tiles
  const mergedLayers: Record<string, GRanges> = {};

  for (const tile of tiles) {
    for (const [layerKey, granges] of Object.entries(tile.data)) {
      if (!mergedLayers[layerKey]) {
        mergedLayers[layerKey] = {
          class: 'GRanges',
          seqnames: [],
          ranges: { start: [], end: [], width: [] },
          strand: [],
          mcols: {},
          n: 0,
        };
        // Initialise mcol arrays from the first tile's keys
        for (const mcolKey of Object.keys(granges.mcols)) {
          mergedLayers[layerKey].mcols[mcolKey] = [];
        }
      }

      const merged = mergedLayers[layerKey];
      merged.seqnames.push(...granges.seqnames);
      merged.ranges.start.push(...granges.ranges.start);
      merged.ranges.end.push(...granges.ranges.end);
      merged.ranges.width.push(...granges.ranges.width);
      merged.strand.push(...granges.strand);

      for (const [mcolKey, values] of Object.entries(granges.mcols)) {
        if (!merged.mcols[mcolKey]) merged.mcols[mcolKey] = [];
        (merged.mcols[mcolKey] as (string | number | null)[]).push(
          ...(values as (string | number | null)[]),
        );
      }
      merged.n += granges.n;
    }
  }

  // Collect unique layers_resolved from all tiles
  const resolvedMap = new Map<string, LayerResolved>();
  for (const tile of tiles) {
    for (const lr of tile.layers_resolved ?? []) {
      if (!resolvedMap.has(lr.layer_key)) resolvedMap.set(lr.layer_key, lr);
    }
  }

  return {
    sequence: null,
    layers: mergedLayers,
    layersResolved: Array.from(resolvedMap.values()),
    resolution,
    unsupportedLayers,
  };
}

// ---------------------------------------------------------------------------
// Prefetch
// ---------------------------------------------------------------------------

/**
 * Prefetch adjacent tiles for smooth panning.
 * Fire-and-forget: failures are silently ignored.
 */
export function prefetchTiles(
  build: string,
  chr: string,
  start: number,
  end: number,
  layers: string[],
  direction: 'left' | 'right',
): void {
  const width = end - start + 1;
  const resolution = dataResolution(width);
  if (resolution === 1) return; // No tiles at bp resolution

  const prefetchCount = 2;
  const currentFirst = Math.floor((start - 1) / resolution);
  const currentLast = Math.floor((end - 1) / resolution);

  const indices: number[] = [];
  if (direction === 'left') {
    for (let i = 1; i <= prefetchCount; i++) {
      const idx = currentFirst - i;
      if (idx >= 0) indices.push(idx);
    }
  } else {
    for (let i = 1; i <= prefetchCount; i++) {
      indices.push(currentLast + i);
    }
  }

  for (const idx of indices) {
    const key = tileCacheKey(build, chr, resolution, idx, layers);
    if (!getCachedTile(key)) {
      fetchTile(build, chr, resolution, idx, layers)
        .then((tile) => {
          cacheTile(key, tile);
        })
        .catch(() => {
          // Silently ignore prefetch failures
        });
    }
  }
}
