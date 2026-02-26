'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useViewport } from '@/stores/viewport';

function parseRegionParam(region: string): { chr: string; start: number; end: number } | null {
  const decoded = decodeURIComponent(region);
  const match = decoded.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/);
  if (!match) return null;
  return { chr: match[1], start: parseInt(match[2], 10), end: parseInt(match[3], 10) };
}

export default function ViewerPage() {
  const params = useParams<{ build: string; region: string }>();
  const { build, chr, start, end, width, activeLayers, setBuild, setRegion } = useViewport();

  useEffect(() => {
    if (params.build === 'hg38' || params.build === 'hg37') {
      setBuild(params.build);
    }
    const parsed = parseRegionParam(params.region);
    if (parsed) {
      setRegion(parsed.chr, parsed.start, parsed.end);
    }
  }, [params.build, params.region, setBuild, setRegion]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <h1 className="text-lg font-semibold">Polymer Genomics</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="font-mono">{build}</span>
          <span className="font-mono">{chr}:{start.toLocaleString()}-{end.toLocaleString()}</span>
          <span className="text-xs">({width.toLocaleString()} bp)</span>
        </div>
      </header>

      {/* Track area (placeholder) */}
      <main className="flex-1 bg-gray-950 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">Track renderers will be added here</p>
          <p className="text-sm">Viewing {chr}:{start.toLocaleString()}-{end.toLocaleString()} ({width.toLocaleString()} bp)</p>
          <p className="text-sm mt-1">Active layers: {activeLayers.join(', ')}</p>
        </div>
      </main>

      {/* Footer status bar */}
      <footer className="px-4 py-1 bg-gray-900 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
        <span>Polymer Genomics API v0.1.0</span>
        <span>Base-pair resolution genome browser</span>
      </footer>
    </div>
  );
}
