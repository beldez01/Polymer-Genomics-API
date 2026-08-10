import { useRef, useCallback } from 'react';
import { useViewport } from '@/stores/viewport';

const DURATION = 150; // ms

/**
 * Hook that wraps viewport navigation actions with CSS transform animations.
 * Returns wrapped pan/zoom functions + a ref to attach to the animated container.
 *
 * How it works:
 * 1. Applies a CSS transform for instant visual feedback (GPU-accelerated)
 * 2. After the transition, removes transform and updates viewport state (triggers real data fetch)
 */
export function useAnimatedNav() {
  const animRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);

  const animate = useCallback((
    transform: string,
    action: () => void,
  ) => {
    const el = animRef.current;
    if (!el || animating.current) {
      // Fallback: just do it immediately
      action();
      return;
    }

    animating.current = true;
    el.style.transition = `transform ${DURATION}ms ease-out`;
    el.style.transform = transform;

    const finish = () => {
      el.style.transition = 'none';
      el.style.transform = 'none';
      animating.current = false;
      action();
      el.removeEventListener('transitionend', finish);
    };

    el.addEventListener('transitionend', finish, { once: true });

    // Safety timeout in case transitionend doesn't fire
    setTimeout(() => {
      if (animating.current) finish();
    }, DURATION + 50);
  }, []);

  const panLeft = useCallback(() => {
    const fraction = 0.25;
    const pct = fraction * 100;
    animate(`translateX(${pct}%)`, () => {
      useViewport.getState().panLeft(fraction);
    });
  }, [animate]);

  const panRight = useCallback(() => {
    const fraction = 0.25;
    const pct = fraction * 100;
    animate(`translateX(-${pct}%)`, () => {
      useViewport.getState().panRight(fraction);
    });
  }, [animate]);

  const zoomIn = useCallback(() => {
    const factor = 2;
    animate(`scale(${factor})`, () => {
      useViewport.getState().zoomIn(factor);
    });
  }, [animate]);

  const zoomOut = useCallback(() => {
    const factor = 2;
    animate(`scale(${1 / factor})`, () => {
      useViewport.getState().zoomOut(factor);
    });
  }, [animate]);

  return { animRef, panLeft, panRight, zoomIn, zoomOut };
}
