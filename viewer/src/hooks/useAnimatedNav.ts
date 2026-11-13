import { useRef, useCallback } from 'react';
import { useViewport } from '@/stores/viewport';

/** Commit navigation immediately. Data fetching coalesces rapid changes; feedback
 * never scales the vertical layout or postpones requests behind an animation. */
export function useAnimatedNav() {
  const animRef = useRef<HTMLDivElement>(null);
  const navigate = useCallback((action: () => void) => {
    action();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animRef.current?.animate([{ opacity: .88 }, { opacity: 1 }], { duration: 100 });
    }
  }, []);
  const panLeft = useCallback(() => navigate(() => useViewport.getState().panLeft()), [navigate]);
  const panRight = useCallback(() => navigate(() => useViewport.getState().panRight()), [navigate]);
  const zoomIn = useCallback(() => navigate(() => useViewport.getState().zoomIn()), [navigate]);
  const zoomOut = useCallback(() => navigate(() => useViewport.getState().zoomOut()), [navigate]);
  return { animRef, panLeft, panRight, zoomIn, zoomOut };
}
