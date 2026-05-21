'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE } from '@/config/theme';
import { searchAtlasGenes, getMatchedAlias, type AtlasGene } from '@/config/atlasGenes';

// All gene selections route to the working mock viewer (TP53) for now.
const VIEWER_HREF = '/view/hg38/chr17:7668421-7687490';

export function GeneSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AtlasGene[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const next = searchAtlasGenes(trimmed);
    setResults(next);
    setOpen(true);
  }

  function selectGene(_gene: AtlasGene) {
    // In Tier 1, all gene selections route to the TP53 viewer mock.
    // Tier 2 port-back wires this to a per-gene viewer URL.
    setQuery('');
    setResults([]);
    setOpen(false);
    setHighlightedIndex(-1);
    router.push(VIEWER_HREF);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        selectGene(results[highlightedIndex]);
      } else if (results.length > 0) {
        selectGene(results[0]);
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
  const showDropdown = open && (results.length > 0 || trimmedQuery.length >= 2);
  const activeDescendant = highlightedIndex >= 0 ? `gene-option-${highlightedIndex}` : undefined;

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div ref={containerRef} style={{ position: 'relative', width: 480, maxWidth: '100%' }}>
        {/* Search label */}
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
          {query.length === 0 && (
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
            {results.length > 0 ? (
              results.map((g, i) => {
                const isHighlighted = i === highlightedIndex;
                const symUpper = g.symbol.toUpperCase();
                const matchEnd = symUpper.startsWith(trimmedQuery) ? trimmedQuery.length : 0;
                const aliasHit = matchEnd === 0 ? getMatchedAlias(g, query) : null;
                return (
                  <li
                    key={g.symbol}
                    id={`gene-option-${i}`}
                    role="option"
                    aria-selected={isHighlighted}
                    onClick={() => selectGene(g)}
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
                            {g.symbol.slice(0, matchEnd)}
                          </span>
                          <span>{g.symbol.slice(matchEnd)}</span>
                        </>
                      ) : (
                        g.symbol
                      )}
                      {aliasHit && (
                        <span style={{
                          color: COLOR.text.muted,
                          fontFamily: FONT_FAMILY_MONO,
                          fontSize: TYPE.xs.fontSize,
                          marginLeft: SPACE[2],
                          letterSpacing: '0.04em',
                        }}>
                          ({aliasHit})
                        </span>
                      )}
                      {g.blurb && (
                        <span style={{
                          display: 'block',
                          color: COLOR.text.tertiary,
                          fontSize: TYPE.xs.fontSize,
                          fontFamily: FONT_FAMILY,
                          letterSpacing: '0.01em',
                          marginTop: 2,
                          fontWeight: WEIGHT.normal,
                        }}>
                          {g.blurb}
                        </span>
                      )}
                    </span>
                    <span style={{
                      color: COLOR.text.tertiary,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: TYPE.xs.fontSize,
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                    }}>
                      {g.chromosome}
                    </span>
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
                No matches in this list.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
