'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE } from '@/config/theme';
import { searchGenes, fetchGene, type SearchResult, type GRanges } from '@/lib/api';

const BUILD = 'hg38';
const LAYERS = 'gencode_v44,cpg_sites,probe_epic_v2,isochores';

export function GeneSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  const scrollToHighlighted = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    if (items[index]) items[index].scrollIntoView({ block: 'nearest' });
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setHighlightedIndex(-1);
    setError(null);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenes(value.trim(), BUILD);
        setResults(res);
        setOpen(true);
        setSearching(false);
      } catch {
        setResults([]);
        setOpen(true);
        setSearching(false);
        setError('Search unavailable');
      }
    }, 250);
  }

  async function selectGene(symbol: string) {
    try {
      const res = await fetchGene(BUILD, symbol);
      const d = res.data as unknown as Record<string, unknown> & { class?: string };
      const grangesList: GRanges[] = d.class === 'GRanges'
        ? [res.data as unknown as GRanges]
        : Object.values(res.data) as GRanges[];
      if (grangesList.length === 0) {
        setError(`No coordinates for "${symbol}"`);
        return;
      }
      let minStart = Infinity, maxEnd = -Infinity, c = '';
      for (const granges of grangesList) {
        for (let i = 0; i < granges.n; i++) {
          if (granges.ranges.start[i] < minStart) minStart = granges.ranges.start[i];
          if (granges.ranges.end[i] > maxEnd) maxEnd = granges.ranges.end[i];
          c = granges.seqnames[i];
        }
      }
      if (!c || minStart === Infinity) {
        setError(`No region for "${symbol}"`);
        return;
      }
      const padding = Math.max(100, Math.round((maxEnd - minStart) * 0.1));
      const start = Math.max(1, minStart - padding);
      const end = maxEnd + padding;
      setQuery('');
      setResults([]);
      setOpen(false);
      setHighlightedIndex(-1);
      router.push(`/view/${BUILD}/${c}:${start}-${end}?layers=${LAYERS}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gene lookup failed');
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        selectGene(results[highlightedIndex].gene_symbol);
      } else if (results.length > 0) {
        selectGene(results[0].gene_symbol);
      } else if (query.trim().length >= 2) {
        selectGene(query.trim().toUpperCase());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && results.length > 0) setOpen(true);
      setHighlightedIndex((prev) => {
        const next = prev < results.length - 1 ? prev + 1 : 0;
        scrollToHighlighted(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : results.length - 1;
        scrollToHighlighted(next);
        return next;
      });
    }
  }

  const trimmedQuery = query.trim().toUpperCase();
  const showDropdown = open && (results.length > 0 || (trimmedQuery.length >= 2 && !searching));
  const activeDescendant = highlightedIndex >= 0 ? `gene-option-${highlightedIndex}` : undefined;

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div ref={containerRef} style={{ position: 'relative', width: 480, maxWidth: '100%' }}>
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: COLOR.bg.white,
          border: `1px solid ${COLOR.border.strong}`,
          borderRadius: 2,
          paddingLeft: SPACE[3],
          paddingRight: SPACE[2],
          height: 40,
        }}>
          <span style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginRight: SPACE[3],
          }}>
            Gene
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="TP53, BRCA1, TET2, HLA-A…"
            role="combobox"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            spellCheck={false}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: COLOR.text.primary,
              border: 'none',
              outline: 'none',
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              letterSpacing: '0.01em',
              padding: 0,
            }}
          />
          {searching && (
            <span style={{
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginLeft: SPACE[2],
              whiteSpace: 'nowrap',
            }}>
              Searching…
            </span>
          )}
          {!searching && query.length === 0 && (
            <span style={{
              color: COLOR.text.faint,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginLeft: SPACE[2],
              whiteSpace: 'nowrap',
            }}>
              ↵ to open
            </span>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: COLOR.bg.white,
              border: `1px solid ${COLOR.border.strong}`,
              borderRadius: 2,
              zIndex: 50,
              maxHeight: 280,
              overflowY: 'auto',
              listStyle: 'none',
              padding: 0,
              margin: '4px 0 0 0',
              boxShadow: '0 4px 12px -6px rgba(15, 23, 42, 0.12)',
            }}
          >
            {error ? (
              <li style={{
                padding: `${SPACE[3]}px ${SPACE[4]}px`,
                color: COLOR.accent.rose,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                textAlign: 'center',
              }}>
                {error}
              </li>
            ) : results.length > 0 ? (
              results.map((r, i) => {
                const isHighlighted = i === highlightedIndex;
                const sym = r.gene_symbol.toUpperCase();
                const matchEnd = sym.startsWith(trimmedQuery) ? trimmedQuery.length : 0;
                return (
                  <li
                    key={r.gene_symbol}
                    id={`gene-option-${i}`}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={() => selectGene(r.gene_symbol)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      columnGap: SPACE[3],
                      alignItems: 'baseline',
                      padding: `${SPACE[2] + 2}px ${SPACE[3] + 4}px`,
                      backgroundColor: isHighlighted ? COLOR.bg.deep : 'transparent',
                      borderBottom: `1px solid ${COLOR.border.subtle}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      color: COLOR.text.primary,
                      fontFamily: FONT_FAMILY,
                      fontSize: TYPE.base.fontSize,
                      fontWeight: WEIGHT.medium,
                    }}>
                      {matchEnd > 0 ? (
                        <>
                          <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.bold }}>
                            {r.gene_symbol.slice(0, matchEnd)}
                          </span>
                          <span>{r.gene_symbol.slice(matchEnd)}</span>
                        </>
                      ) : (
                        r.gene_symbol
                      )}
                      {r.match_type === 'alias' && r.matched_alias && (
                        <span style={{
                          color: COLOR.text.muted,
                          fontFamily: FONT_FAMILY_MONO,
                          fontSize: TYPE.xs.fontSize,
                          marginLeft: SPACE[2],
                          letterSpacing: '0.04em',
                        }}>
                          ({r.matched_alias})
                        </span>
                      )}
                    </span>
                    {r.chromosome && (
                      <span style={{
                        color: COLOR.text.tertiary,
                        fontFamily: FONT_FAMILY_MONO,
                        fontSize: TYPE.xs.fontSize,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.chromosome}
                      </span>
                    )}
                  </li>
                );
              })
            ) : (
              <li style={{
                padding: `${SPACE[3]}px ${SPACE[4]}px`,
                color: COLOR.text.muted,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                textAlign: 'center',
              }}>
                No genes found
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
