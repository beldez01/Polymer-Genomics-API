'use client';
import { useViewport } from '@/stores/viewport';
import { fetchViewportData } from '@/lib/genomeFetcher';
import { useLocusRequest } from './useLocusRequest';

export function useViewportData(enabled = true) {
  const { build, chr, start, end, activeLayers } = useViewport();
  const key = enabled ? JSON.stringify([build, chr, start, end, activeLayers]) : null;
  return useLocusRequest(key, signal => fetchViewportData(build, chr, start, end, activeLayers, signal));
}
