'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { searchGenes } from '@/lib/api';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE, COMPONENT } from '@/config/theme';

interface GeneSearchProps {
  build: string;
  onSelectGene: (symbol: string) => void;
  selectedGene: string | null;
  onClear: () => void;
}

export function GeneSearch({ build, onSelectGene, selectedGene, onClear }: GeneSearchProps) {
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
    if (value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchGenes(value.trim(), build);
        setResults(res);
        setOpen(res.length > 0);
      } catch {
        setResults([]);
      }
    }, 300);
  }

  function handleSubmit() {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return;
    if (results.length > 0) {
      onSelectGene(results[0].gene_symbol);
    } else {
      onSelectGene(trimmed);
    }
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function selectResult(symbol: string) {
    onSelectGene(symbol);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') { setOpen(false); }
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

        {open && results.length > 0 && (
          <ul style={{
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
          }}>
            {results.map((r) => (
              <li
                key={r.gene_symbol}
                onClick={() => selectResult(r.gene_symbol)}
                style={{
                  padding: `${SPACE[2]}px ${SPACE[4]}px`,
                  fontSize: TYPE.sm.fontSize,
                  color: COLOR.text.secondary,
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                  borderBottom: `1px solid ${COLOR.border.subtle}`,
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = COLOR.bg.surface; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {r.gene_symbol}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
