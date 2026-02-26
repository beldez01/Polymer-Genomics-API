'use client';

import { useEffect, useState, useRef } from 'react';
import { useViewport } from '@/stores/viewport';
import { fetchViewportData, type ViewportData } from '@/lib/genomeFetcher';

export function useViewportData() {
  const { build, chr, start, end, activeLayers } = useViewport();
  const [data, setData] = useState<ViewportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetchViewportData(build, chr, start, end, activeLayers)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch data',
          );
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [build, chr, start, end, activeLayers]);

  return { data, loading, error };
}
