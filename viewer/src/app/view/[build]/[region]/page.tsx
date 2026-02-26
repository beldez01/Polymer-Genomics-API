'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useViewport } from '@/stores/viewport';
import { useViewportData } from '@/hooks/useViewportData';
import { TrackStack } from '@/components/TrackStack';

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
          <span className="font-mono">
            {chr}:{start.toLocaleString()}-{end.toLocaleString()}
          </span>
          <span className="text-xs">({width.toLocaleString()} bp)</span>
        </div>
      </header>

      {/* Track area */}
      <main className="flex-1 overflow-hidden">
        <TrackStack
          data={data}
          viewStart={start}
          viewEnd={end}
          canvasWidth={1200}
          loading={loading}
          error={error}
        />
      </main>

      {/* Footer status bar */}
      <footer className="px-4 py-1 bg-gray-900 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
        <span>Polymer Genomics API v0.1.0</span>
        <span>
          {data?.resolution === 1
            ? 'Base-pair resolution'
            : `${data?.resolution?.toLocaleString() ?? '\u2014'} bp tiles`}
        </span>
      </footer>
    </div>
  );
}
