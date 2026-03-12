'use client';

import { useState, useMemo, useCallback } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import type { DMPRow, ThresholdState, SortField, SortDir, FilterMode } from '@/lib/dmp/types';
import { exportFilteredCSV } from '@/lib/dmp/export';

interface ResultsTableProps {
  rows: DMPRow[];
  thresholds: ThresholdState;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}

const PAGE_SIZE = 50;

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'significant', label: 'Significant' },
  { key: 'hyper', label: 'Hyper' },
  { key: 'hypo', label: 'Hypo' },
];

const COLUMNS: { key: SortField; label: string; width: number }[] = [
  { key: 'probe_id', label: 'Probe ID', width: 160 },
  { key: 'gene_symbol', label: 'Gene', width: 100 },
  { key: 'delta_beta', label: '\u0394\u03B2', width: 90 },
  { key: 'p_value', label: 'p-value', width: 100 },
  { key: 'adj_p_value', label: 'adj. p', width: 100 },
];

export function ResultsTable({ rows, thresholds, selectedIndex, onSelectIndex }: ResultsTableProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortField, setSortField] = useState<SortField>('p_value');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [csvHover, setCsvHover] = useState(false);

  const isSig = useCallback((r: DMPRow) => {
    return r.adj_p_value < thresholds.adjPValueCutoff && Math.abs(r.delta_beta) >= thresholds.deltaBetaCutoff;
  }, [thresholds]);

  const filtered = useMemo(() => {
    let result = rows.map((row, index) => ({ row, index }));

    // Text search
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(({ row }) =>
        row.probe_id.toLowerCase().includes(q) ||
        (row.gene_symbol && row.gene_symbol.toLowerCase().includes(q))
      );
    }

    // Filter mode
    if (filter === 'significant') {
      result = result.filter(({ row }) => isSig(row));
    } else if (filter === 'hyper') {
      result = result.filter(({ row }) => isSig(row) && row.delta_beta > 0);
    } else if (filter === 'hypo') {
      result = result.filter(({ row }) => isSig(row) && row.delta_beta < 0);
    }

    // Sort
    result.sort((a, b) => {
      const ra = a.row;
      const rb = b.row;
      let cmp = 0;
      switch (sortField) {
        case 'probe_id':
          cmp = ra.probe_id.localeCompare(rb.probe_id);
          break;
        case 'gene_symbol':
          cmp = (ra.gene_symbol || '').localeCompare(rb.gene_symbol || '');
          break;
        case 'delta_beta':
          cmp = ra.delta_beta - rb.delta_beta;
          break;
        case 'p_value':
          cmp = ra.p_value - rb.p_value;
          break;
        case 'adj_p_value':
          cmp = ra.adj_p_value - rb.adj_p_value;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rows, filter, sortField, sortDir, searchText, isSig]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortField]);

  const handleExportCSV = useCallback(() => {
    exportFilteredCSV(filtered.map(f => f.row), 'dmp_filtered.csv');
  }, [filtered]);

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Controls */}
      <div style={{
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        flexWrap: 'wrap',
        borderBottom: `1px solid ${COLOR.border.subtle}`,
      }}>
        <span style={{ ...COMPONENT.sectionHeader }}>RESULTS</span>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: SPACE[1] }}>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setFilter(opt.key); setPage(0); }}
              style={filter === opt.key ? { ...COMPONENT.button.smallActive } : { ...COMPONENT.button.small }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search probe or gene..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
          style={{
            ...COMPONENT.input.default,
            width: 180,
          }}
        />

        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginLeft: 'auto',
        }}>
          {filtered.length.toLocaleString()} rows
        </span>

        <button
          onClick={handleExportCSV}
          onMouseEnter={() => setCsvHover(true)}
          onMouseLeave={() => setCsvHover(false)}
          style={{
            ...COMPONENT.button.small,
            ...(csvHover ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : {}),
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.xs.fontSize,
        }}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: `${SPACE[2]}px ${SPACE[3]}px`,
                    textAlign: 'left',
                    color: sortField === col.key ? COLOR.accent.teal : COLOR.text.tertiary,
                    fontWeight: WEIGHT.medium,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${COLOR.border.default}`,
                    width: col.width,
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {col.label}
                  {sortField === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 8 }}>
                      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ row, index }) => {
              const isSelected = selectedIndex === index;
              const sig = isSig(row);
              return (
                <tr
                  key={row.probe_id + '-' + index}
                  onClick={() => onSelectIndex(isSelected ? null : index)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'rgba(78, 205, 196, 0.08)'
                      : 'transparent',
                    borderBottom: `1px solid ${COLOR.border.subtle}`,
                    transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = COLOR.bg.surface;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td style={{
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    color: COLOR.text.secondary,
                  }}>
                    {row.probe_id}
                  </td>
                  <td style={{
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    color: row.gene_symbol ? COLOR.text.primary : COLOR.text.muted,
                  }}>
                    {row.gene_symbol || '-'}
                  </td>
                  <td style={{
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    color: sig
                      ? (row.delta_beta > 0 ? COLOR.accent.rose : COLOR.accent.teal)
                      : COLOR.text.secondary,
                    fontWeight: sig ? WEIGHT.medium : WEIGHT.normal,
                  }}>
                    {row.delta_beta > 0 ? '+' : ''}{row.delta_beta.toFixed(4)}
                  </td>
                  <td style={{
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    color: COLOR.text.secondary,
                  }}>
                    {row.p_value.toExponential(2)}
                  </td>
                  <td style={{
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    color: row.adj_p_value < thresholds.adjPValueCutoff
                      ? COLOR.accent.amber
                      : COLOR.text.secondary,
                  }}>
                    {row.adj_p_value.toExponential(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE[3],
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          borderTop: `1px solid ${COLOR.border.subtle}`,
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              ...COMPONENT.button.small,
              opacity: page === 0 ? 0.3 : 1,
            }}
          >
            Prev
          </button>
          <span style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              ...COMPONENT.button.small,
              opacity: page >= totalPages - 1 ? 0.3 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
