'use client';

import { useEffect, type RefObject } from 'react';
import { useViewport } from '@/stores/viewport';

export function usePinchZoom(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafPending = false;

    // --- Wheel zoom (ctrl/meta + scroll, which trackpad pinch sends natively) ---
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      if (rafPending) return;
      rafPending = true;

      requestAnimationFrame(() => {
        rafPending = false;
        const state = useViewport.getState();
        const rect = el!.getBoundingClientRect();
        const cursorFraction = (e.clientX - rect.left) / rect.width;
        const viewWidth = state.end - state.start + 1;

        const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newWidth = Math.max(10, Math.round(viewWidth / zoomFactor));
        const anchor = state.start + cursorFraction * viewWidth;
        const newStart = Math.max(1, Math.round(anchor - cursorFraction * newWidth));
        const newEnd = newStart + newWidth - 1;
        state.setRegion(state.chr, newStart, newEnd);
      });
    }

    // --- Touch pinch-to-zoom ---
    let lastTouchDist = 0;
    let lastTouchMidX = 0;
    let touchActive = false;
    let singleTouchStart: { x: number; viewStart: number; viewEnd: number } | null = null;

    function touchDistance(t1: Touch, t2: Touch): number {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        touchActive = true;
        singleTouchStart = null;
        lastTouchDist = touchDistance(e.touches[0], e.touches[1]);
        lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      } else if (e.touches.length === 1) {
        const state = useViewport.getState();
        singleTouchStart = { x: e.touches[0].clientX, viewStart: state.start, viewEnd: state.end };
        touchActive = false;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && touchActive) {
        e.preventDefault();
        const dist = touchDistance(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const ratio = dist / lastTouchDist;
        if (ratio === 0 || !Number.isFinite(ratio)) return;

        const state = useViewport.getState();
        const rect = el!.getBoundingClientRect();
        const midFraction = (midX - rect.left) / rect.width;
        const viewWidth = state.end - state.start + 1;
        const newWidth = Math.max(10, Math.round(viewWidth / ratio));
        const anchor = state.start + midFraction * viewWidth;
        const newStart = Math.max(1, Math.round(anchor - midFraction * newWidth));
        const newEnd = newStart + newWidth - 1;
        state.setRegion(state.chr, newStart, newEnd);

        lastTouchDist = dist;
        lastTouchMidX = midX;
      } else if (e.touches.length === 1 && singleTouchStart) {
        const deltaX = e.touches[0].clientX - singleTouchStart.x;
        const rect = el!.getBoundingClientRect();
        const viewWidth = singleTouchStart.viewEnd - singleTouchStart.viewStart + 1;
        const bpPerPixel = viewWidth / rect.width;
        const deltaBp = Math.round(-deltaX * bpPerPixel);
        const newStart = Math.max(1, singleTouchStart.viewStart + deltaBp);
        const newEnd = newStart + viewWidth - 1;
        const state = useViewport.getState();
        state.setRegion(state.chr, newStart, newEnd);
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        touchActive = false;
      }
      if (e.touches.length === 0) {
        singleTouchStart = null;
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef]);
}
