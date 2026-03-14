'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { searchGenes, fetchGene, fetchProbe } from '@/lib/api';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE, LAYOUT, COMPONENT } from '@/config/theme';
import { useIsMobile } from '@/hooks/useBreakpoint';
import type { GenomeBuild } from '@/stores/viewport';

const ZOOM_PRESETS = [
  { label: '1 bp',   width: 50 },
  { label: '1 kb',   width: 1_000 },
  { label: '10 kb',  width: 10_000 },
  { label: '100 kb', width: 100_000 },
  { label: '1 Mb',   width: 1_000_000 },
  { label: '10 Mb',  width: 10_000_000 },
];

interface HeaderBarProps {
  build: GenomeBuild;
  chr: string;
  start: number;
  end: number;
  onNavigate: (chr: string, start: number, end: number) => void;
  onBuildChange: (build: GenomeBuild) => void;
  /** Optional copy-link button label + handler, shown next to coordinates */
  copyLinkLabel?: string;
  onCopyLink?: () => void;
  /** Navigation controls */
  onPanLeft?: () => void;
  onPanRight?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomPreset?: (width: number) => void;
  viewportWidth?: number;
}

export function HeaderBar({ build, chr, start, end, onNavigate, onBuildChange, copyLinkLabel, onCopyLink, onPanLeft, onPanRight, onZoomIn, onZoomOut, onZoomPreset, viewportWidth }: HeaderBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ gene_symbol: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [isProbe, setIsProbe] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

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
    const trimmed = value.trim();
    if (/^cg\d{7,8}$/i.test(trimmed) || /^ch\.\d+\.\d+/i.test(trimmed)) {
      setIsProbe(true);
      setResults([]);
      setOpen(false);
      return;
    }
    setIsProbe(false);
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
    const trimmed = query.trim();
    if (/^cg\d{7,8}$/i.test(trimmed) || /^ch\.\d+\.\d+/i.test(trimmed)) {
      try {
        const res = await fetchProbe(build, trimmed);
        const p = res.data.probe;
        const padding = Math.max(500, Math.round((p.end - p.start) * 5));
        onNavigate(p.seqname, Math.max(1, p.start - padding), p.end + padding);
      } catch (e) {
        console.error('Probe lookup failed:', e);
      }
      setOpen(false);
      setQuery('');
      return;
    }
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
      const d = res.data as Record<string, unknown>;
      const grangesList = d.class === 'GRanges'
        ? [res.data as unknown as import('@/lib/api').GRanges]
        : Object.values(res.data) as import('@/lib/api').GRanges[];
      if (grangesList.length === 0) return;
      let minStart = Infinity, maxEnd = -Infinity, c = '';
      for (const granges of grangesList)
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
    <div className="w-full flex items-center px-4 gap-4 flex-shrink-0"
         style={{
           height: LAYOUT.headerHeight,
           backgroundColor: COLOR.bg.primary,
           borderBottom: `1px solid ${COLOR.border.subtle}`,
           position: 'relative',
         }}>

      {/* Build toggle */}
      <button
        onClick={() => onBuildChange(build === 'hg38' ? 'hg37' : 'hg38')}
        style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          padding: `${SPACE[1]}px ${SPACE[2]}px`,
          border: `1px solid ${COLOR.border.strong}`,
          whiteSpace: 'nowrap',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          transition: 'border-color 0.15s, color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = COLOR.accent.teal;
          e.currentTarget.style.color = COLOR.accent.teal;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = COLOR.border.strong;
          e.currentTarget.style.color = COLOR.text.secondary;
        }}
      >
        {build}
      </button>

      {/* Navigation controls */}
      {!isMobile && onPanLeft && onPanRight && onZoomIn && onZoomOut && (
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          <button onClick={onPanLeft} style={COMPONENT.button.small} title="Pan left 25%">&larr;</button>
          <button onClick={onPanRight} style={COMPONENT.button.small} title="Pan right 25%">&rarr;</button>
          <div style={{ width: SPACE[1] }} />
          <button onClick={onZoomIn} style={COMPONENT.button.small} title="Zoom in 2x">+</button>
          <button onClick={onZoomOut} style={COMPONENT.button.small} title="Zoom out 2x">&minus;</button>
          {onZoomPreset && (
            <>
              <div style={{ width: SPACE[1] }} />
              {ZOOM_PRESETS.map((p) => {
                const isActive = viewportWidth != null && Math.abs(viewportWidth - p.width) < p.width * 0.2;
                return (
                  <button
                    key={p.label}
                    onClick={() => onZoomPreset(p.width)}
                    style={isActive ? COMPONENT.button.smallActive : COMPONENT.button.small}
                  >
                    {p.label}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Coordinates — absolutely centered in the bar */}
      {!isMobile && (
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          <span style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
            pointerEvents: 'none',
          }}>
            {coords}
          </span>
          {onCopyLink && (
            <button
              onClick={onCopyLink}
              style={{
                backgroundColor: 'transparent',
                color: copyLinkLabel === 'Copied!' ? COLOR.accent.teal : COLOR.text.muted,
                border: copyLinkLabel === 'Copied!' ? `1px solid ${COLOR.accent.teal}` : `1px solid ${COLOR.border.strong}`,
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLOR.accent.teal;
                e.currentTarget.style.color = COLOR.accent.teal;
              }}
              onMouseLeave={(e) => {
                if (copyLinkLabel !== 'Copied!') {
                  e.currentTarget.style.borderColor = COLOR.border.strong;
                  e.currentTarget.style.color = COLOR.text.muted;
                }
              }}
              title="Copy shareable link with active layers"
            >
              {copyLinkLabel || 'Link'}
            </button>
          )}
        </div>
      )}

      {/* Search — right */}
      <div ref={containerRef} className="flex items-center gap-1" style={{ position: 'relative', flexShrink: 0, marginLeft: 'auto' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder={isMobile ? "Gene or region..." : "chr17:7668421-7687490 or TP53"}
          style={{
            ...COMPONENT.input.default,
            width: isMobile ? 160 : 280,
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            backgroundColor: COLOR.bg.track,
            color: COLOR.text.secondary,
            border: `1px solid ${COLOR.border.strong}`,
            padding: `${SPACE[1] + 1}px ${SPACE[3]}px`,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = COLOR.accent.teal;
            e.currentTarget.style.color = COLOR.accent.teal;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COLOR.border.strong;
            e.currentTarget.style.color = COLOR.text.secondary;
          }}
        >
          GO
        </button>

        {open && results.length > 0 && (
          <ul style={{
            position: 'absolute', top: '100%', right: 0, width: 280, marginTop: 2,
            backgroundColor: COLOR.bg.track, border: `1px solid ${COLOR.border.subtle}`, zIndex: 50,
            maxHeight: 192, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0,
          }}>
            {results.map((r) => (
              <li key={r.gene_symbol}
                  onClick={() => selectGene(r.gene_symbol)}
                  style={{
                    padding: `${SPACE[2]}px ${SPACE[2]}px`,
                    fontSize: TYPE.sm.fontSize,
                    color: COLOR.text.secondary,
                    cursor: 'pointer',
                    fontFamily: FONT_FAMILY,
                    borderBottom: `1px solid ${COLOR.border.subtle}`,
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = COLOR.bg.surface; }}
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
