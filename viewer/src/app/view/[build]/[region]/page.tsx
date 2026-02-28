'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useViewport } from '@/stores/viewport';
import { useViewportData } from '@/hooks/useViewportData';
import { TrackStack } from '@/components/TrackStack';
import { HeaderBar } from '@/components/HeaderBar';
import { IdeogramBar } from '@/components/IdeogramBar';
import { Sidebar } from '@/components/Sidebar';
import { CoordinateRuler } from '@/components/CoordinateRuler';
import { RegionContextPanel } from '@/components/RegionContextPanel';
import { useRegionContext } from '@/hooks/useRegionContext';
import { getChromosomeByName } from '@/config/chromosomes';
import { useAnimatedNav } from '@/hooks/useAnimatedNav';

function parseRegionParam(region: string): { chr: string; start: number; end: number } | null {
  const decoded = decodeURIComponent(region);
  const match = decoded.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/);
  if (!match) return null;
  return { chr: match[1], start: parseInt(match[2], 10), end: parseInt(match[3], 10) };
}

export default function ViewerPage() {
  const params = useParams<{ build: string; region: string }>();
  const { build, chr, start, end, width, activeLayers, setBuild, setRegion, toggleLayer } = useViewport();
  const { data, loading, error } = useViewportData();
  const { animRef, panLeft, panRight, zoomIn, zoomOut } = useAnimatedNav();

  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [showContext, setShowContext] = useState(true);
  const regionContext = useRegionContext(data, chr, start, end);

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Sync URL params to viewport
  useEffect(() => {
    if (params.build === 'hg38' || params.build === 'hg37') {
      setBuild(params.build);
    }
    const parsed = parseRegionParam(params.region);
    if (parsed) {
      setRegion(parsed.chr, parsed.start, parsed.end);
    }
  }, [params.build, params.region, setBuild, setRegion]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft':  panLeft();  break;
        case 'ArrowRight': panRight(); break;
        case '+': case '=': zoomIn();  break;
        case '-': case '_': zoomOut(); break;
        case 'i': setShowContext(prev => !prev); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panLeft, panRight, zoomIn, zoomOut]);

  // Click-and-drag panning
  const dragRef = useRef<{ startX: number; viewStart: number; viewEnd: number; chr: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT') return;
    const state = useViewport.getState();
    dragRef.current = { startX: e.clientX, viewStart: state.start, viewEnd: state.end, chr: state.chr };
    setDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function handleMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;
      const deltaX = e.clientX - drag.startX;
      const trackWidth = containerRef.current.clientWidth;
      const viewWidth = drag.viewEnd - drag.viewStart + 1;
      const bpPerPixel = viewWidth / trackWidth;
      const deltaBp = Math.round(-deltaX * bpPerPixel);
      const newStart = Math.max(1, drag.viewStart + deltaBp);
      const newEnd = newStart + viewWidth - 1;
      useViewport.getState().setRegion(drag.chr, newStart, newEnd);
    }
    function handleMouseUp() {
      dragRef.current = null;
      setDragging(false);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  function handleNavigate(c: string, s: number, e: number) {
    setRegion(c, s, e);
  }

  function handleSelectChromosome(chrName: string) {
    const info = getChromosomeByName(chrName);
    if (info) {
      const center = Math.round(info.length / 2);
      const halfView = Math.min(50_000, Math.round(info.length / 2));
      setRegion(chrName, Math.max(1, center - halfView), center + halfView);
    }
  }

  function handleZoomPreset(targetWidth: number) {
    const center = (start + end) / 2;
    setRegion(chr, Math.max(1, Math.round(center - targetWidth / 2)), Math.round(center + targetWidth / 2));
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      <HeaderBar
        build={build}
        chr={chr}
        start={start}
        end={end}
        onNavigate={handleNavigate}
        onBuildChange={setBuild}
      />

      <IdeogramBar
        currentChromosome={chr}
        onSelectChromosome={handleSelectChromosome}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          build={build}
          activeLayers={activeLayers}
          onToggleLayer={toggleLayer}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onPanLeft={panLeft}
          onPanRight={panRight}
          onZoomPreset={handleZoomPreset}
          viewportWidth={width}
          resolution={data?.resolution ?? null}
        />

        <main
          ref={containerRef}
          className="flex-1 overflow-hidden flex flex-col select-none"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        >
          <div ref={animRef} className="flex flex-col flex-1 overflow-hidden" style={{ transformOrigin: 'center center', willChange: 'transform' }}>
            <div style={{ backgroundColor: '#0A0A0A', borderBottom: '1px solid #1a1a1a' }}>
              <CoordinateRuler
                viewStart={start}
                viewEnd={end}
                canvasWidth={Math.max(100, canvasWidth)}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <TrackStack
                data={data}
                viewStart={start}
                viewEnd={end}
                canvasWidth={canvasWidth}
                loading={loading}
                error={error}
              />
            </div>
          </div>
        </main>

        {showContext && <RegionContextPanel context={regionContext} />}
      </div>
    </div>
  );
}
