'use client';
import { useEffect, useRef, useState } from 'react';

/** Current-key-only rendering, cancellation, brief request coalescing and a small
 * short-lived revisit cache. Cached data is never reused for a different locus. */
export function useLocusRequest<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>, delay = 25, canCache?: (data: T) => boolean) {
  const cache = useRef(new Map<string, { data: T; expires: number }>());
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null }>({ key: '', data: null, error: null });
  const cached = key ? cache.current.get(key) : undefined;
  const hit = cached && cached.expires > Date.now() ? cached : undefined;
  useEffect(() => {
    if (!key || (cache.current.get(key)?.expires ?? 0) > Date.now()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetcher(controller.signal).then(data => {
        if (controller.signal.aborted) return;
        if (!canCache || canCache(data)) {
          cache.current.delete(key);
          if (cache.current.size >= 4) cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(key, { data, expires: Date.now() + 30_000 });
        }
        setResult({ key, data, error: null });
      }).catch(error => {
        if (!controller.signal.aborted) setResult({ key, data: null, error: error instanceof Error ? error.message : 'Data unavailable.' });
      });
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
    // key includes all fetcher inputs; callback identity is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);
  const current = key !== null && result.key === key;
  return { data: hit ? hit.data : current ? result.data : null, error: hit ? null : current ? result.error : null, loading: key !== null && !hit && !current };
}
