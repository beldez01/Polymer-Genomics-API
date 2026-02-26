'use client';
import { useState, useRef, useEffect } from 'react';
import { useViewport } from '@/stores/viewport';
import { searchGenes, fetchGene } from '@/lib/api';

export function SearchBar() {
  const { build, setRegion } = useViewport();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ gene_symbol: string }[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    clearTimeout(debounceRef.current);

    // Try to parse as region -- don't search API for coordinates
    const regionMatch = value.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/i);
    if (regionMatch) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenes(value, build);
        setResults(res);
        setOpen(res.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
  }

  async function handleSubmit() {
    // Try region format first
    const regionMatch = query.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/i);
    if (regionMatch) {
      const chr = regionMatch[1]
        .toLowerCase()
        .replace('chrx', 'chrX')
        .replace('chry', 'chrY')
        .replace('chrm', 'chrM');
      setRegion(chr, parseInt(regionMatch[2], 10), parseInt(regionMatch[3], 10));
      setOpen(false);
      return;
    }
    // Try as gene symbol
    await selectGene(query.toUpperCase());
  }

  async function selectGene(symbol: string) {
    try {
      const res = await fetchGene(build, symbol);
      const allData = Object.values(res.data);
      if (allData.length === 0) return;
      let minStart = Infinity;
      let maxEnd = -Infinity;
      let chr = '';
      for (const granges of allData) {
        for (let i = 0; i < granges.n; i++) {
          if (granges.ranges.start[i] < minStart) minStart = granges.ranges.start[i];
          if (granges.ranges.end[i] > maxEnd) maxEnd = granges.ranges.end[i];
          chr = granges.seqnames[i];
        }
      }
      if (chr && minStart < Infinity) {
        // Add 10% padding
        const padding = Math.max(100, Math.round((maxEnd - minStart) * 0.1));
        setRegion(chr, minStart - padding, maxEnd + padding);
      }
    } catch (e) {
      console.error('Gene lookup failed:', e);
    }
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder="Search gene or region (e.g. VAC14, chr16:70699930-70700000)"
          className="bg-gray-800 text-gray-200 text-sm px-3 py-1.5 rounded-l border border-gray-700
                     focus:outline-none focus:border-blue-500 w-80 placeholder:text-gray-500"
        />
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-r
                     border border-blue-600 transition-colors"
        >
          Go
        </button>
      </div>
      {open && results.length > 0 && (
        <ul
          className="absolute top-full left-0 w-80 mt-1 bg-gray-800 border border-gray-700
                     rounded shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {results.map((r) => (
            <li
              key={r.gene_symbol}
              onClick={() => selectGene(r.gene_symbol)}
              className="px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer"
            >
              {r.gene_symbol}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
