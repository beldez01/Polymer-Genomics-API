'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { searchGenes } from '@/lib/api';
import type { SearchResult } from '@/lib/api';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE, COMPONENT } from '@/config/theme';

interface GeneSearchProps {
  build: string;
  onSelectGene: (symbol: string) => void;
  selectedGene: string | null;
  onClear: () => void;
}

export function GeneSearch({ build, onSelectGene, selectedGene, onClear }: GeneSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
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

  // Scroll highlighted item into view
  const scrollToHighlighted = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[role="option"]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setHighlightedIndex(-1);
    setSearchError(null);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      setSearchDone(false);
      return;
    }
    setSearching(true);
    setSearchDone(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenes(value.trim(), build);
        setResults(res);
        setOpen(true);
        setSearchDone(true);
      } catch {
        setResults([]);
        setSearchDone(true);
        setSearchError('Search unavailable');
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handleSubmit() {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;
    if (highlightedIndex >= 0 && highlightedIndex < results.length) {
      onSelectGene(results[highlightedIndex].gene_symbol);
    } else if (results.length > 0) {
      onSelectGene(results[0].gene_symbol);
    } else {
      onSelectGene(trimmed);
    }
    setQuery('');
    setResults([]);
    setOpen(false);
    setSearchDone(false);
    setHighlightedIndex(-1);
  }

  function selectResult(symbol: string) {
    onSelectGene(symbol);
    setQuery('');
    setResults([]);
    setOpen(false);
    setSearchDone(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && results.length > 0) setOpen(true);
      setHighlightedIndex(prev => {
        const next = prev < results.length - 1 ? prev + 1 : 0;
        scrollToHighlighted(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev > 0 ? prev - 1 : results.length - 1;
        scrollToHighlighted(next);
        return next;
      });
    }
  }

  // When a gene is selected, show chip instead of input
  if (selectedGene) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: `${SPACE[4]}px ${SPACE[4]}px ${SPACE[2]}px`,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACE[2],
          backgroundColor: 'rgba(78, 205, 196, 0.08)',
          border: `1px solid ${COLOR.accent.teal}`,
          padding: `${SPACE[1] + 2}px ${SPACE[4]}px`,
        }}>
          <span style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.bold,
            letterSpacing: '0.04em',
          }}>
            {selectedGene}
          </span>
          <button
            onClick={onClear}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: COLOR.text.muted,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              cursor: 'pointer',
              padding: `0 ${SPACE[1]}px`,
              lineHeight: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.text.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.muted; }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  const trimmedQuery = query.trim().toUpperCase();
  const showDropdown = open && (results.length > 0 || (searchDone && results.length === 0 && query.trim().length >= 2));
  const activeDescendant = highlightedIndex >= 0 ? `gene-option-${highlightedIndex}` : undefined;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: `${SPACE[4]}px ${SPACE[4]}px ${SPACE[2]}px`,
    }}>
      <div ref={containerRef} style={{ position: 'relative', width: 400, maxWidth: '100%' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search gene... TP53, BRCA1, VAC14"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          style={{
            ...COMPONENT.input.default,
            width: '100%',
            padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
            fontSize: TYPE.base.fontSize,
            boxSizing: 'border-box' as const,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = COLOR.accent.teal; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = COLOR.border.strong; }}
        />

        {/* Error indicator */}
        {searchError && !searching && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 2,
            backgroundColor: COLOR.bg.track,
            border: `1px solid ${COLOR.border.subtle}`,
            zIndex: 50,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
          }}>
            <span style={{
              color: COLOR.accent.rose,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              {searchError}
            </span>
          </div>
        )}

        {/* Searching indicator */}
        {searching && query.trim().length >= 2 && !showDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 2,
            backgroundColor: COLOR.bg.track,
            border: `1px solid ${COLOR.border.subtle}`,
            zIndex: 50,
            padding: `${SPACE[3]}px ${SPACE[4]}px`,
          }}>
            <span style={{
              color: COLOR.text.muted,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
            }}>
              Searching&hellip;
            </span>
          </div>
        )}

        {showDropdown && (
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 2,
              backgroundColor: COLOR.bg.track,
              border: `1px solid ${COLOR.border.subtle}`,
              zIndex: 50,
              maxHeight: 240,
              overflowY: 'auto',
              listStyle: 'none',
              padding: 0,
              margin: 0,
            }}
          >
            {results.length > 0 ? (
              results.map((r, i) => {
                const isHighlighted = i === highlightedIndex;
                const matchLen = trimmedQuery.length;
                const symbolUpper = r.gene_symbol.toUpperCase();
                const matchEnd = symbolUpper.startsWith(trimmedQuery) ? matchLen : 0;

                return (
                  <li
                    key={r.gene_symbol}
                    id={`gene-option-${i}`}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={() => selectResult(r.gene_symbol)}
                    style={{
                      padding: `${SPACE[2]}px ${SPACE[4]}px`,
                      fontSize: TYPE.sm.fontSize,
                      color: COLOR.text.secondary,
                      cursor: 'pointer',
                      fontFamily: FONT_FAMILY,
                      borderBottom: `1px solid ${COLOR.border.subtle}`,
                      backgroundColor: isHighlighted ? COLOR.bg.surface : 'transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      setHighlightedIndex(i);
                      if (!isHighlighted) (e.currentTarget as HTMLElement).style.backgroundColor = COLOR.bg.surface;
                    }}
                    onMouseLeave={(e) => {
                      if (!isHighlighted) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>
                      {matchEnd > 0 ? (
                        <>
                          <span style={{ color: COLOR.accent.teal, fontWeight: WEIGHT.bold }}>
                            {r.gene_symbol.slice(0, matchEnd)}
                          </span>
                          <span>{r.gene_symbol.slice(matchEnd)}</span>
                        </>
                      ) : (
                        r.gene_symbol
                      )}
                    </span>
                    {r.chromosome && (
                      <span style={{
                        color: COLOR.text.faint,
                        fontSize: TYPE.xs.fontSize,
                        fontFamily: FONT_FAMILY,
                        flexShrink: 0,
                        marginLeft: SPACE[3],
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
                fontSize: TYPE.sm.fontSize,
                color: COLOR.text.muted,
                fontFamily: FONT_FAMILY,
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
