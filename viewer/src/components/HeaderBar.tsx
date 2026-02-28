'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { searchGenes, fetchGene } from '@/lib/api';
import type { GenomeBuild } from '@/stores/viewport';

interface HeaderBarProps {
  build: GenomeBuild;
  chr: string;
  start: number;
  end: number;
  onNavigate: (chr: string, start: number, end: number) => void;
  onBuildChange: (build: GenomeBuild) => void;
}

export function HeaderBar({ build, chr, start, end, onNavigate, onBuildChange }: HeaderBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ gene_symbol: string }[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    const regionMatch = value.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/i);
    if (regionMatch) { setResults([]); setOpen(false); return; }
    if (value.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenes(value, build);
        setResults(res);
        setOpen(res.length > 0);
      } catch { setResults([]); }
    }, 300);
  }

  async function handleSubmit() {
    const regionMatch = query.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/i);
    if (regionMatch) {
      const c = regionMatch[1].toLowerCase().replace('chrx', 'chrX').replace('chry', 'chrY').replace('chrm', 'chrM');
      onNavigate(c, parseInt(regionMatch[2], 10), parseInt(regionMatch[3], 10));
      setOpen(false);
      return;
    }
    await selectGene(query.toUpperCase());
  }

  async function selectGene(symbol: string) {
    try {
      const res = await fetchGene(build, symbol);
      const allData = Object.values(res.data);
      if (allData.length === 0) return;
      let minStart = Infinity, maxEnd = -Infinity, c = '';
      for (const granges of allData)
        for (let i = 0; i < granges.n; i++) {
          if (granges.ranges.start[i] < minStart) minStart = granges.ranges.start[i];
          if (granges.ranges.end[i] > maxEnd) maxEnd = granges.ranges.end[i];
          c = granges.seqnames[i];
        }
      if (c && minStart < Infinity) {
        const padding = Math.max(100, Math.round((maxEnd - minStart) * 0.1));
        onNavigate(c, minStart - padding, maxEnd + padding);
      }
    } catch (e) { console.error('Gene lookup failed:', e); }
    setOpen(false);
    setQuery('');
  }

  const coords = `${chr}:${start.toLocaleString()}-${end.toLocaleString()}`;

  return (
    <div className="w-full flex items-center px-4 gap-6 flex-shrink-0"
         style={{ height: 48, backgroundColor: '#0A0A0A', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ color: '#4ECDC4', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
        POLYMER GENOMICS
      </span>

      <button
        onClick={() => onBuildChange(build === 'hg38' ? 'hg37' : 'hg38')}
        style={{ color: '#444', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", padding: '2px 6px', border: '1px solid #222', whiteSpace: 'nowrap', backgroundColor: 'transparent', cursor: 'pointer' }}>
        {build}
      </button>

      <span style={{ color: '#888', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {coords}
      </span>

      <div ref={containerRef} className="flex items-center gap-1" style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="chr17:7668421-7687490 or TP53"
          style={{ backgroundColor: '#111111', color: '#CCC', border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", width: 280, outline: 'none' }}
        />
        <button
          onClick={handleSubmit}
          style={{ backgroundColor: '#111111', color: '#666', border: '1px solid #1a1a1a', padding: '4px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer' }}>
          GO
        </button>

        {open && results.length > 0 && (
          <ul style={{
            position: 'absolute', top: '100%', right: 0, width: 280, marginTop: 2,
            backgroundColor: '#111111', border: '1px solid #1a1a1a', zIndex: 50,
            maxHeight: 192, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0,
          }}>
            {results.map((r) => (
              <li key={r.gene_symbol}
                  onClick={() => selectGene(r.gene_symbol)}
                  style={{ padding: '6px 8px', fontSize: 11, color: '#CCC', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", borderBottom: '1px solid #1a1a1a' }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = '#1a1a1a'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}>
                {r.gene_symbol}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
