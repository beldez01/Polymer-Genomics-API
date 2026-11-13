'use client';
import { useViewport } from '@/stores/viewport';
import { fetchViewportData, fineWindowBounds } from '@/lib/genomeFetcher';
import { dataResolution } from '@/stores/viewport';
import { useLocusRequest } from './useLocusRequest';

export function useViewportData(enabled = true) {
  const { build, chr, start, end, activeLayers } = useViewport();
  const requestBounds = dataResolution(end - start + 1) === 1
    ? fineWindowBounds(build, chr, start, end)
    : { start, end };
  const key = enabled ? JSON.stringify([build, chr, requestBounds.start, requestBounds.end, activeLayers]) : null;
  return useLocusRequest(key, signal => fetchViewportData(build, chr, start, end, activeLayers, signal));
}
