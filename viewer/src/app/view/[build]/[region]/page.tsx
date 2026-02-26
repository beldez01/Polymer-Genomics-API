'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useViewport } from '@/stores/viewport';
import { useViewportData } from '@/hooks/useViewportData';
import { TrackStack } from '@/components/TrackStack';
import { SearchBar } from '@/components/SearchBar';
import { NavigationBar } from '@/components/NavigationBar';
import { LayerToggle } from '@/components/LayerToggle';
import { CoordinateRuler } from '@/components/CoordinateRuler';

function parseRegionParam(region: string): { chr: string; start: number; end: number } | null {
  const decoded = decodeURIComponent(region);
  const match = decoded.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/);
  if (!match) return null;
  return { chr: match[1], start: parseInt(match[2], 10), end: parseInt(match[3], 10) };
}

export default function ViewerPage() {
  const params = useParams<{ build: string; region: string }>();
  const { build, chr, start, end, width, setBuild, setRegion } = useViewport();
  const { data, loading, error } = useViewportData();

  // Responsive canvas width
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);

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
      // Don't capture keys when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const state = useViewport.getState();
      switch (e.key) {
        case 'ArrowLeft':
          state.panLeft();
          break;
        case 'ArrowRight':
          state.panRight();
          break;
        case '+':
        case '=':
          state.zoomIn();
          break;
        case '-':
        case '_':
          state.zoomOut();
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar: logo + search + build/coords */}
      <header className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800">
        <h1 className="text-lg font-semibold shrink-0">Polymer Genomics</h1>
        <SearchBar />
        <div className="ml-auto flex items-center gap-3 text-sm text-gray-400">
          <select
            value={build}
            onChange={(e) => setBuild(e.target.value as 'hg37' | 'hg38')}
            className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded border border-gray-700"
          >
            <option value="hg38">hg38</option>
            <option value="hg37">hg37</option>
          </select>
          <span className="font-mono text-xs">
            {chr}:{start.toLocaleString()}-{end.toLocaleString()}
          </span>
        </div>
      </header>

      {/* Navigation bar */}
      <NavigationBar />

      {/* Layer toggles */}
      <LayerToggle />

      {/* Coordinate ruler + tracks */}
      <main ref={containerRef} className="flex-1 overflow-hidden flex flex-col">
        {/* Ruler (offset by 96px label column to align with tracks) */}
        <div className="flex bg-gray-950 border-b border-gray-800">
          <div className="w-24 shrink-0" />
          <CoordinateRuler
            viewStart={start}
            viewEnd={end}
            canvasWidth={Math.max(100, canvasWidth - 96)}
          />
        </div>

        {/* Track stack */}
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
      </main>

      {/* Footer */}
      <footer className="px-4 py-1 bg-gray-900 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
        <span>Polymer Genomics API v0.1.0</span>
        <span>
          {data?.resolution === 1 ? 'Base-pair resolution' : `${data?.resolution?.toLocaleString() ?? '\u2014'} bp tiles`}
          {' \u00b7 '}
          {width.toLocaleString()} bp viewport
        </span>
        <span>Arrow keys: pan &middot; +/&minus;: zoom</span>
      </footer>
    </div>
  );
}
