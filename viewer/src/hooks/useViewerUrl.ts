'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useViewport } from '@/stores/viewport';
import { parseViewerUrl, serializeViewerState } from '@/lib/viewerState';

/** Hydrate atomically; browser history restores state rather than rewriting it. */
export function useViewerUrl() {
  const pathname = usePathname(); const params = useSearchParams();
  const route = `${pathname}?${params.toString()}`;
  const lastWritten = useRef('');
  const restoreRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let restoring = false;
    let valid = false;
    function restore() {
      const location = window.location.pathname + window.location.search;
      if (location === lastWritten.current) return;
      try {
        const state = parseViewerUrl(window.location.pathname, window.location.search);
        restoring = true;
        useViewport.setState({ ...state, width: state.end - state.start + 1 });
        restoring = false; valid = true;
        const url = serializeViewerState(state);
        lastWritten.current = url;
        window.history.replaceState(null, '', url);
        setError(null); setReady(true);
      } catch (err) {
        valid = false; setError(err instanceof Error ? err.message : 'Invalid viewer link.'); setReady(false);
      }
    }
    restoreRef.current = restore;
    restore();
    const unsubscribe = useViewport.subscribe(state => {
      if (restoring || !valid) return;
      const url = serializeViewerState(state);
      if (url !== lastWritten.current) {
        lastWritten.current = url;
        window.history.pushState(null, '', url);
      }
    });
    window.addEventListener('popstate', restore);
    return () => { unsubscribe(); window.removeEventListener('popstate', restore); lastWritten.current = ''; };
  }, []);
  useEffect(() => { restoreRef.current(); }, [route]);
  return { ready, error };
}
