import { dataResolution } from '@/stores/viewport';
import {
  fetchSequence,
  fetchRegion,
  fetchTile,
  type TileResponse,
  type GRanges,
  type LayerResolved,
} from './api';

export interface ViewportData {
  sequence: string | null; // Raw DNA sequence (only at bp resolution)
  layers: Record<string, GRanges>; // Feature data per layer
  layersResolved: LayerResolved[]; // Epistemic metadata per layer
  resolution: number; // The resolution tier used
}

// ---------------------------------------------------------------------------
// Simple LRU tile cache
// ---------------------------------------------------------------------------

const CACHE_MAX = 500;
const tileCache = new Map<string, TileResponse>();

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
    if (firstKey !== undefined) tileCache.delete(firstKey);
  }
  tileCache.set(key, data);
}

function getCachedTile(key: string): TileResponse | undefined {
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
): Promise<ViewportData> {
  const width = end - start + 1;
  const resolution = dataResolution(width);

  if (resolution === 1) {
    // Fine zoom: fetch sequence + features directly
    // Sequence is best-effort (FASTA may not be available)
    const region = `${chr}:${start}-${end}`;
    const [seqResult, featureRes] = await Promise.all([
      fetchSequence(build, region).catch(() => null),
      fetchRegion(build, region, layers),
    ]);
    return {
      sequence: seqResult?.sequence ?? null,
      layers: featureRes.data,
      layersResolved: featureRes.layers_resolved ?? [],
      resolution: 1,
    };
  }

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
        fetchTile(build, chr, resolution, i, layers).then((tile) => {
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
