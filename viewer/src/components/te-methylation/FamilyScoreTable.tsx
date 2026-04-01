'use client';

import { useState, useMemo } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import { StoplightBar } from './StoplightBar';
import type { TEFamilyScore } from '@/lib/te-methylation/types';

type SortKey = 'displayName' | 'teClass' | 'meanBeta' | 'delta' | 'reactivationRisk' | 'nProbes';

interface Props {
  scores: TEFamilyScore[];
  onSelectFamily: (familyId: string) => void;
  selectedFamily: string | null;
}

const COLUMNS: { key: SortKey; label: string; width: string; align?: 'right' | 'center' }[] = [
  { key: 'displayName', label: 'Family', width: '22%' },
  { key: 'teClass', label: 'Class', width: '10%' },
  { key: 'meanBeta', label: 'Mean Beta', width: '12%', align: 'right' },
  { key: 'delta', label: 'Delta', width: '12%', align: 'right' },
  { key: 'nProbes', label: 'Probes', width: '10%', align: 'right' },
  { key: 'reactivationRisk', label: 'Risk', width: '20%' },
];

const CLASS_COLORS: Record<string, string> = {
  LINE: '#3b82f6',
  SINE: COLOR.accent.teal,
  LTR: COLOR.accent.rose,
  DNA: COLOR.accent.amber,
  SVA: COLOR.accent.violet,
  Other: COLOR.text.muted,
};

export function FamilyScoreTable({ scores, onSelectFamily, selectedFamily }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('reactivationRisk');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [classFilter, setClassFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let data = scores;
    if (classFilter) data = data.filter((s) => s.teClass === classFilter);
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [scores, sortKey, sortDir, classFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const classes = [...new Set(scores.map((s) => s.teClass))].sort();

  const headerStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.xs.fontSize,
    fontWeight: WEIGHT.medium,
    color: COLOR.text.tertiary,
    padding: `${SPACE[2]}px ${SPACE[3]}px`,
    cursor: 'pointer',
    userSelect: 'none',
    borderBottom: `1px solid ${COLOR.border.subtle}`,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const cellStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.sm.fontSize,
    color: COLOR.text.primary,
    padding: `${SPACE[2]}px ${SPACE[3]}px`,
    borderBottom: `1px solid ${COLOR.border.subtle}20`,
  };

  return (
    <div>
      {/* Class filter chips */}
      <div style={{ display: 'flex', gap: SPACE[2], marginBottom: SPACE[3], flexWrap: 'wrap' }}>
        <button
          onClick={() => setClassFilter(null)}
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xs.fontSize,
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            borderRadius: 8,
            border: `1px solid ${classFilter === null ? COLOR.accent.teal : COLOR.border.subtle}`,
            background: classFilter === null ? `${COLOR.accent.teal}18` : 'transparent',
            color: classFilter === null ? COLOR.accent.teal : COLOR.text.tertiary,
            cursor: 'pointer',
          }}
        >
          All ({scores.length})
        </button>
        {classes.map((cls) => {
          const n = scores.filter((s) => s.teClass === cls).length;
          const active = classFilter === cls;
          return (
            <button
              key={cls}
              onClick={() => setClassFilter(active ? null : cls)}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                padding: `${SPACE[1]}px ${SPACE[3]}px`,
                borderRadius: 8,
                border: `1px solid ${active ? CLASS_COLORS[cls] : COLOR.border.subtle}`,
                background: active ? `${CLASS_COLORS[cls]}18` : 'transparent',
                color: active ? CLASS_COLORS[cls] : COLOR.text.tertiary,
                cursor: 'pointer',
              }}
            >
              {cls} ({n})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    ...headerStyle,
                    width: col.width,
                    textAlign: col.align ?? 'left',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 9 }}>
                      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isSelected = s.familyId === selectedFamily;
              return (
                <tr
                  key={s.familyId}
                  onClick={() => onSelectFamily(s.familyId)}
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? `${COLOR.accent.teal}0C` : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = `${COLOR.bg.elevated}`;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td style={cellStyle}>
                    <span style={{ fontWeight: WEIGHT.medium }}>{s.displayName}</span>
                    {s.clinicallyImplicated && (
                      <span style={{
                        marginLeft: SPACE[2],
                        fontSize: TYPE.xs.fontSize,
                        color: COLOR.accent.rose,
                        fontWeight: WEIGHT.medium,
                      }}>
                        CLIN
                      </span>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <span style={{ color: CLASS_COLORS[s.teClass] ?? COLOR.text.muted }}>
                      {s.teClass}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {s.meanBeta.toFixed(3)}
                  </td>
                  <td style={{
                    ...cellStyle,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: s.delta < -0.05 ? COLOR.accent.rose : s.delta > 0.05 ? COLOR.accent.teal : COLOR.text.secondary,
                  }}>
                    {s.delta > 0 ? '+' : ''}{s.delta.toFixed(3)}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {s.nProbes.toLocaleString()}
                    <span style={{ color: COLOR.text.muted, fontSize: TYPE.xs.fontSize }}>
                      /{s.nTotal.toLocaleString()}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <StoplightBar level={s.riskLevel} risk={s.reactivationRisk} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
