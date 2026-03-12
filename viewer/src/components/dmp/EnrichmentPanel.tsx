'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import type { DMPRow, ThresholdState } from '@/lib/dmp/types';
import {
  runEnrichment,
  gatherPathwayMap,
  type EnrichmentSummary,
  type EnrichmentResult,
} from '@/lib/dmp/enrichment';
import { fetchGenePathways, fetchGeneSets } from '@/lib/api';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EnrichmentPanelProps {
  rows: DMPRow[];
  thresholds: ThresholdState;
}

// ---------------------------------------------------------------------------
// Bar chart renderer
// ---------------------------------------------------------------------------

const BAR_HEIGHT = 18;
const BAR_GAP = 4;
const CHART_LEFT_MARGIN = 180;
const CHART_RIGHT_MARGIN = 60;
const CHART_TOP = 24;

function renderBarChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  results: EnrichmentResult[],
) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  ctx.fillStyle = COLOR.canvas.background;
  ctx.fillRect(0, 0, width * dpr, height * dpr);

  ctx.save();
  ctx.scale(dpr, dpr);

  const top20 = results.slice(0, 20);
  if (top20.length === 0) {
    ctx.fillStyle = COLOR.text.muted;
    ctx.font = `400 ${TYPE.sm.fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText('No significant pathways', width / 2, height / 2);
    ctx.restore();
    return;
  }

  const values = top20.map(r => -Math.log10(Math.max(r.adjPValue, 1e-300)));
  const maxVal = Math.max(...values, 1.3);

  const barAreaWidth = width - CHART_LEFT_MARGIN - CHART_RIGHT_MARGIN;

  for (let i = 0; i < top20.length; i++) {
    const r = top20[i];
    const y = CHART_TOP + i * (BAR_HEIGHT + BAR_GAP);
    const val = values[i];
    const barW = (val / maxVal) * barAreaWidth;

    // Bar
    ctx.fillStyle = r.category === 'Reactome' ? COLOR.accent.teal : COLOR.accent.violet;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(CHART_LEFT_MARGIN, y, barW, BAR_HEIGHT);
    ctx.globalAlpha = 1;

    // Pathway name (truncated)
    const label = r.pathway.length > 40 ? r.pathway.slice(0, 37) + '...' : r.pathway;
    ctx.fillStyle = COLOR.text.secondary;
    ctx.font = `400 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillText(label, CHART_LEFT_MARGIN - 6, y + BAR_HEIGHT - 4);

    // Value label
    ctx.fillStyle = COLOR.text.tertiary;
    ctx.textAlign = 'left';
    ctx.fillText(val.toFixed(1), CHART_LEFT_MARGIN + barW + 4, y + BAR_HEIGHT - 4);
  }

  // X-axis label
  ctx.fillStyle = COLOR.canvas.featureLabel;
  ctx.font = `500 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(
    '-log\u2081\u2080(adj. p-value)',
    CHART_LEFT_MARGIN + barAreaWidth / 2,
    CHART_TOP + top20.length * (BAR_HEIGHT + BAR_GAP) + 16,
  );

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type SortKey = 'pathway' | 'category' | 'geneCount' | 'pValue' | 'adjPValue';

export function EnrichmentPanel({ rows, thresholds }: EnrichmentPanelProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<EnrichmentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('adjPValue');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [runHover, setRunHover] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw bar chart when results change
  useEffect(() => {
    if (!results || results.results.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const count = Math.min(results.results.length, 20);
    const chartH = CHART_TOP + count * (BAR_HEIGHT + BAR_GAP) + 32;
    const chartW = 700;

    canvas.width = chartW * dpr;
    canvas.height = chartH * dpr;
    canvas.style.width = `${chartW}px`;
    canvas.style.height = `${chartH}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) renderBarChart(ctx, chartW, chartH, results.results);
  }, [results]);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Extract significant genes
      const sigRows = rows.filter(
        r =>
          r.adj_p_value < thresholds.adjPValueCutoff &&
          Math.abs(r.delta_beta) >= thresholds.deltaBetaCutoff &&
          r.gene_symbol,
      );

      const sigGenes = [...new Set(sigRows.map(r => r.gene_symbol!))];
      const allGenes = [...new Set(rows.filter(r => r.gene_symbol).map(r => r.gene_symbol!))];

      if (sigGenes.length === 0) {
        setError('No significant probes with gene annotations. Adjust thresholds to include more probes.');
        setLoading(false);
        return;
      }

      setProgress(`Fetching pathway data for ${sigGenes.length} genes...`);

      const pathwayMap = await gatherPathwayMap(
        allGenes,
        fetchGenePathways,
        fetchGeneSets,
      );

      setProgress(`Running enrichment on ${pathwayMap.size} pathways...`);

      const summary = runEnrichment(sigGenes, allGenes, pathwayMap);
      setResults(summary);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrichment failed');
    } finally {
      setLoading(false);
    }
  }, [rows, thresholds]);

  // Sort results for table
  const sortedResults = results
    ? [...results.results].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'pathway':
            cmp = a.pathway.localeCompare(b.pathway);
            break;
          case 'category':
            cmp = a.category.localeCompare(b.category);
            break;
          case 'geneCount':
            cmp = a.geneCount - b.geneCount;
            break;
          case 'pValue':
            cmp = a.pValue - b.pValue;
            break;
          case 'adjPValue':
            cmp = a.adjPValue - b.adjPValue;
            break;
        }
        return sortAsc ? cmp : -cmp;
      })
    : [];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const headerStyle = (key: SortKey): React.CSSProperties => ({
    padding: `${SPACE[1]}px ${SPACE[2]}px`,
    textAlign: 'left' as const,
    color: sortKey === key ? COLOR.accent.teal : COLOR.text.tertiary,
    fontSize: TYPE.xs.fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: WEIGHT.medium,
    cursor: 'pointer',
    borderBottom: `1px solid ${COLOR.border.strong}`,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  });

  const cellStyle: React.CSSProperties = {
    padding: `${SPACE[1]}px ${SPACE[2]}px`,
    fontSize: TYPE.xs.fontSize,
    fontFamily: FONT_FAMILY,
    color: COLOR.text.secondary,
    borderBottom: `1px solid ${COLOR.border.subtle}`,
    verticalAlign: 'top',
  };

  return (
    <div style={{ padding: SPACE[4] }}>
      <div style={{ ...COMPONENT.sectionHeader, marginBottom: SPACE[3] }}>
        PATHWAY ENRICHMENT
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading}
        onMouseEnter={() => setRunHover(true)}
        onMouseLeave={() => setRunHover(false)}
        style={{
          ...COMPONENT.button.small,
          ...(runHover && !loading
            ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal }
            : {}),
          opacity: loading ? 0.5 : 1,
          marginBottom: SPACE[4],
        }}
      >
        {loading ? 'Running...' : 'Run Enrichment'}
      </button>

      {/* Progress */}
      {progress && (
        <div style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[3],
        }}>
          {progress}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          color: COLOR.accent.rose,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${COLOR.accent.rose}40`,
          marginBottom: SPACE[3],
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Summary */}
          <div style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            marginBottom: SPACE[4],
          }}>
            {results.testedPathways} pathways tested,{' '}
            <span style={{ color: COLOR.text.primary }}>
              {results.results.filter(r => r.adjPValue < 0.05).length}
            </span>{' '}
            significant (FDR &lt; 0.05)
            {' | '}
            {results.significantGenes} significant genes / {results.totalGenesWithProbes} total
          </div>

          {/* Bar chart */}
          <div style={{
            marginBottom: SPACE[4],
            border: `1px solid ${COLOR.border.subtle}`,
            backgroundColor: COLOR.canvas.background,
            overflowX: 'auto',
          }}>
            <canvas ref={canvasRef} />
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex',
            gap: SPACE[4],
            marginBottom: SPACE[3],
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                backgroundColor: COLOR.accent.teal,
                borderRadius: 2,
              }} />
              <span style={{ color: COLOR.text.tertiary }}>Reactome</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: SPACE[1] }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                backgroundColor: COLOR.accent.violet,
                borderRadius: 2,
              }} />
              <span style={{ color: COLOR.text.tertiary }}>Hallmark</span>
            </span>
          </div>

          {/* Results table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: FONT_FAMILY,
            }}>
              <thead>
                <tr>
                  <th style={headerStyle('pathway')} onClick={() => handleSort('pathway')}>
                    Pathway {sortKey === 'pathway' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                  </th>
                  <th style={headerStyle('category')} onClick={() => handleSort('category')}>
                    Category {sortKey === 'category' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                  </th>
                  <th style={headerStyle('geneCount')} onClick={() => handleSort('geneCount')}>
                    Genes {sortKey === 'geneCount' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                  </th>
                  <th style={headerStyle('pValue')} onClick={() => handleSort('pValue')}>
                    P-value {sortKey === 'pValue' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                  </th>
                  <th style={headerStyle('adjPValue')} onClick={() => handleSort('adjPValue')}>
                    Adj. P {sortKey === 'adjPValue' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
                  </th>
                  <th style={{
                    ...headerStyle('adjPValue'),
                    color: COLOR.text.tertiary,
                    cursor: 'default',
                  }}>
                    Gene Ratio
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((r, i) => (
                  <>
                    <tr
                      key={`row-${i}`}
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{
                        ...cellStyle,
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {r.pathway}
                      </td>
                      <td style={{
                        ...cellStyle,
                        color: r.category === 'Reactome' ? COLOR.accent.teal : COLOR.accent.violet,
                      }}>
                        {r.category}
                      </td>
                      <td style={cellStyle}>{r.geneCount}</td>
                      <td style={cellStyle}>{r.pValue.toExponential(2)}</td>
                      <td style={{
                        ...cellStyle,
                        color: r.adjPValue < 0.05 ? COLOR.accent.amber : COLOR.text.secondary,
                      }}>
                        {r.adjPValue.toExponential(2)}
                      </td>
                      <td style={cellStyle}>{r.geneRatio}</td>
                    </tr>
                    {expandedRow === i && (
                      <tr key={`expanded-${i}`}>
                        <td
                          colSpan={6}
                          style={{
                            padding: `${SPACE[2]}px ${SPACE[4]}px`,
                            fontSize: TYPE.xs.fontSize,
                            fontFamily: FONT_FAMILY,
                            color: COLOR.text.tertiary,
                            backgroundColor: COLOR.bg.surface,
                            borderBottom: `1px solid ${COLOR.border.subtle}`,
                          }}
                        >
                          <span style={{ color: COLOR.text.muted }}>Genes: </span>
                          {r.genes.join(', ')}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
