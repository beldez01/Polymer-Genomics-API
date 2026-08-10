'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { searchGenes, fetchGene, fetchProbe } from '@/lib/api';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE, LAYOUT } from '@/config/theme';
import { useIsMobile } from '@/hooks/useBreakpoint';
import type { GenomeBuild } from '@/stores/viewport';

const ZOOM_PRESETS = [
  { label: '1k',   width: 1_000 },
  { label: '10k',  width: 10_000 },
  { label: '100k', width: 100_000 },
  { label: '1M',   width: 1_000_000 },
];

interface HeaderBarProps {
  build: GenomeBuild;
  chr: string;
  start: number;
  end: number;
  onNavigate: (chr: string, start: number, end: number) => void;
  onBuildChange: (build: GenomeBuild) => void;
  copyLinkLabel?: string;
  onCopyLink?: () => void;
  onPanLeft?: () => void;
  onPanRight?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomPreset?: (width: number) => void;
  viewportWidth?: number;
}

function IconBtn({ label, symbol, onClick }: { label: string; symbol: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => onClick?.()}
      style={{
        width: 32,
        height: 32,
        backgroundColor: 'transparent',
        color: COLOR.text.secondary,
        border: `1px solid ${COLOR.border.strong}`,
        borderRadius: 2,
        fontSize: 14,
        fontFamily: FONT_FAMILY_MONO,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLOR.primary.base;
        e.currentTarget.style.color = COLOR.primary.base;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLOR.border.strong;
        e.currentTarget.style.color = COLOR.text.secondary;
      }}
    >
      {symbol}
    </button>
  );
}

export function HeaderBar({
  build, chr, start, end, onNavigate, onBuildChange, copyLinkLabel, onCopyLink,
  onPanLeft, onPanRight, onZoomIn, onZoomOut, onZoomPreset, viewportWidth,
}: HeaderBarProps) {
  const coords = `${chr}:${start.toLocaleString()}-${end.toLocaleString()}`;
  const [query, setQuery] = useState(coords);
  const [results, setResults] = useState<{ gene_symbol: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Keep the input synced with viewport changes (pan / zoom)
  useEffect(() => {
    setQuery(coords);
  }, [coords]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setActionError(null);
    clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (/^cg\d{7,8}$/i.test(trimmed) || /^ch\.\d+\.\d+/i.test(trimmed)) {
      setResults([]);
      setOpen(false);
      return;
    }
    const regionMatch = value.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/i);
    if (regionMatch) { setResults([]); setOpen(false); return; }
    if (value.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenes(value, build);
        setResults(res);
        setOpen(res.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
        setActionError('Gene search is unavailable right now.');
      }
    }, 300);
  }

  async function handleSubmit() {
    const trimmed = query.trim();
    setActionError(null);
    if (/^cg\d{7,8}$/i.test(trimmed) || /^ch\.\d+\.\d+/i.test(trimmed)) {
      try {
        const res = await fetchProbe(build, trimmed);
        const p = res.data.probe;
        const padding = Math.max(500, Math.round((p.end - p.start) * 5));
        onNavigate(p.seqname, Math.max(1, p.start - padding), p.end + padding);
        setOpen(false);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'Probe lookup failed.');
      }
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
      const d = res.data as unknown as Record<string, unknown> & { class?: string };
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
      if (!c || minStart === Infinity) {
        setActionError(`No gene found for "${symbol}".`);
        return;
      }
      const padding = Math.max(100, Math.round((maxEnd - minStart) * 0.1));
      onNavigate(c, minStart - padding, maxEnd + padding);
      setOpen(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gene lookup failed.');
    }
  }

  const regionWidth = end - start + 1;
  const widthLabel = regionWidth >= 1_000_000
    ? `${(regionWidth / 1_000_000).toFixed(2)} Mb`
    : regionWidth >= 1_000
      ? `${(regionWidth / 1_000).toFixed(1)} kb`
      : `${regionWidth} bp`;

  return (
    <div style={{
      height: 48,
      backgroundColor: COLOR.bg.primary,
      borderBottom: `1px solid ${COLOR.border.subtle}`,
      display: 'flex',
      alignItems: 'center',
      gap: SPACE[3],
      paddingLeft: SPACE[5],
      paddingRight: SPACE[5],
      position: 'relative',
    }}>
      {/* Build switch — far left */}
      <div style={{
        display: 'inline-flex',
        border: `1px solid ${COLOR.border.strong}`,
        borderRadius: 2,
        height: 32,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {(['hg38', 'hg37'] as const).map((b) => {
          const active = b === build;
          return (
            <button
              key={b}
              type="button"
              onClick={() => onBuildChange(b)}
              style={{
                backgroundColor: active ? COLOR.primary.base : 'transparent',
                color: active ? COLOR.bg.white : COLOR.text.secondary,
                border: 'none',
                paddingLeft: SPACE[3],
                paddingRight: SPACE[3],
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* Left spacer — pushes the region search to the center */}
      <div style={{ flex: 1 }} />

      {/* Region search input — centered */}
      <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: COLOR.bg.white,
          border: `1px solid ${COLOR.border.strong}`,
          borderRadius: 2,
          paddingLeft: SPACE[3],
          paddingRight: SPACE[2],
          height: 32,
          minWidth: isMobile ? 220 : 380,
        }}>
          <span style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginRight: SPACE[2],
          }}>
            REGION
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={isMobile ? "TP53 / chr17:..." : "TP53, cg13580121, or chr17:7668421-7687490"}
            spellCheck={false}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: COLOR.text.primary,
              border: 'none',
              outline: 'none',
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.sm.fontSize,
              letterSpacing: '0.01em',
              padding: 0,
              minWidth: 0,
            }}
          />
          <span className="tabular" style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.04em',
            marginLeft: SPACE[2],
            whiteSpace: 'nowrap',
          }}>
            {widthLabel}
          </span>
        </div>

        {open && results.length > 0 && (
          <ul style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            backgroundColor: COLOR.bg.white, border: `1px solid ${COLOR.border.strong}`,
            borderRadius: 2, zIndex: 50,
            maxHeight: 240, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0,
            boxShadow: '0 4px 12px -6px rgba(15, 23, 42, 0.12)',
          }}>
            {results.map((r) => (
              <li key={r.gene_symbol}
                  onClick={() => selectGene(r.gene_symbol)}
                  style={{
                    padding: `${SPACE[2] + 2}px ${SPACE[3] + 4}px`,
                    fontSize: TYPE.sm.fontSize,
                    color: COLOR.text.primary,
                    cursor: 'pointer',
                    fontFamily: FONT_FAMILY,
                    fontWeight: WEIGHT.medium,
                    borderBottom: `1px solid ${COLOR.border.subtle}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = COLOR.bg.deep; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                {r.gene_symbol}
              </li>
            ))}
          </ul>
        )}

        {actionError && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            backgroundColor: `${COLOR.accent.rose}10`,
            border: `1px solid ${COLOR.accent.rose}55`,
            color: COLOR.accent.rose,
            borderRadius: 2, zIndex: 50,
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.5,
          }}>
            {actionError}
          </div>
        )}
      </div>

      {/* Right spacer */}
      <div style={{ flex: 1 }} />

      {/* Nav cluster — right */}
      {!isMobile && onPanLeft && onPanRight && onZoomIn && onZoomOut && (
        <div style={{ display: 'flex', gap: SPACE[1], flexShrink: 0 }}>
          <IconBtn label="Pan left"  symbol="←" onClick={onPanLeft} />
          <IconBtn label="Pan right" symbol="→" onClick={onPanRight} />
          <IconBtn label="Zoom out"  symbol="−" onClick={onZoomOut} />
          <IconBtn label="Zoom in"   symbol="+" onClick={onZoomIn} />
        </div>
      )}

      {/* Zoom presets */}
      {!isMobile && onZoomPreset && (
        <div style={{ display: 'flex', gap: SPACE[1], flexShrink: 0 }}>
          {ZOOM_PRESETS.map((p) => {
            const isActive = viewportWidth != null && Math.abs(viewportWidth - p.width) < p.width * 0.2;
            return (
              <button
                key={p.label}
                onClick={() => onZoomPreset(p.width)}
                style={{
                  backgroundColor: isActive ? `${COLOR.primary.base}14` : 'transparent',
                  color: isActive ? COLOR.primary.base : COLOR.text.tertiary,
                  border: `1px solid ${isActive ? COLOR.primary.base : COLOR.border.strong}`,
                  borderRadius: 2,
                  height: 32,
                  paddingLeft: SPACE[2] + 2,
                  paddingRight: SPACE[2] + 2,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.xs.fontSize,
                  fontWeight: WEIGHT.medium,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Share / copy link */}
      {!isMobile && onCopyLink && (
        <button
          onClick={onCopyLink}
          style={{
            backgroundColor: 'transparent',
            color: copyLinkLabel === 'Copied!' ? COLOR.primary.base : COLOR.text.secondary,
            border: `1px solid ${copyLinkLabel === 'Copied!' ? COLOR.primary.base : COLOR.border.strong}`,
            borderRadius: 2,
            height: 32,
            paddingLeft: SPACE[3],
            paddingRight: SPACE[3],
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.01em',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          title="Copy shareable link with active layers"
        >
          {copyLinkLabel === 'Copied!' ? 'Copied ✓' : 'Share'}
        </button>
      )}
    </div>
  );
}
