'use client';

import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { BrandBar } from '@/components/BrandBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { UploadZone } from '@/components/dmp/UploadZone';
import { VolcanoPlot } from '@/components/dmp/VolcanoPlot';
import { ManhattanPlot } from '@/components/dmp/ManhattanPlot';
import { ProbeDetail } from '@/components/dmp/ProbeDetail';
import { ResultsTable } from '@/components/dmp/ResultsTable';
import { SummaryBar } from '@/components/dmp/SummaryBar';
import { ThresholdControls } from '@/components/dmp/ThresholdControls';
import { EnrichmentPanel } from '@/components/dmp/EnrichmentPanel';
import { ClusteringPanel } from '@/components/dmp/ClusteringPanel';
import { ComparisonPanel } from '@/components/dmp/ComparisonPanel';
import { IdatUploadZone } from '@/components/dmp/IdatUploadZone';
import type { DMPDataset, DMPRow, ThresholdState, PlotTab } from '@/lib/dmp/types';
import { computeSummary } from '@/lib/dmp/stats';

const DEFAULT_THRESHOLDS: ThresholdState = {
  pValueCutoff: 1.301, // -log10(0.05)
  adjPValueCutoff: 0.05,
  deltaBetaCutoff: 0.05,
};

const TABS: { key: PlotTab; label: string }[] = [
  { key: 'volcano', label: 'Volcano' },
  { key: 'manhattan', label: 'Manhattan' },
  { key: 'clustering', label: 'Clustering' },
  { key: 'enrichment', label: 'Enrichment' },
  { key: 'compare', label: 'Compare' },
];

export default function DMPPage() {
  const [dataset, setDataset] = useState<DMPDataset | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdState>(DEFAULT_THRESHOLDS);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PlotTab>('volcano');
  const [tabHover, setTabHover] = useState<PlotTab | null>(null);

  const rows: DMPRow[] = dataset?.rows ?? [];

  const summary = useMemo(() => computeSummary(rows, thresholds), [rows, thresholds]);

  const selectedRow = selectedIndex !== null ? rows[selectedIndex] ?? null : null;

  const hasGenomic = useMemo(
    () => rows.some(r => r.chr && r.pos),
    [rows],
  );

  const handleDataLoaded = useCallback((ds: DMPDataset) => {
    setDataset(ds);
    setSelectedIndex(null);
    setHoveredIndex(null);
  }, []);

  const handleReset = useCallback(() => {
    setDataset(null);
    setSelectedIndex(null);
    setHoveredIndex(null);
    setThresholds(DEFAULT_THRESHOLDS);
    setActiveTab('volcano');
  }, []);

  // Tabs that don't need a dataset loaded
  const isIndependentTab = activeTab === 'clustering' || activeTab === 'compare';

  return (
    <div style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_FAMILY,
    }}>
      <BrandBar subtitle="DMP Results Viewer">
        {(dataset || isIndependentTab) && (
          <button
            onClick={handleReset}
            style={{
              ...COMPONENT.button.small,
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
            New File
          </button>
        )}
      </BrandBar>

      {/* Content */}
      {!dataset && !isIndependentTab ? (
        /* Upload state */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACE[8],
          gap: SPACE[6],
        }}>
          <div style={{
            maxWidth: 600,
            textAlign: 'center',
          }}>
            <h1 style={{
              color: COLOR.text.primary,
              fontSize: TYPE.xl.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.bold,
              letterSpacing: TYPE.xl.letterSpacing,
              marginBottom: SPACE[2],
            }}>
              DMP Results Viewer
            </h1>
            <p style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: TYPE.base.lineHeight,
              marginBottom: SPACE[8],
            }}>
              Upload differential methylation results (CSV/TSV) to visualize a volcano plot,
              browse significant probes, and query biophysical profiles via the Polymer Genomics API.
            </p>
          </div>

          <div style={{ width: '100%', maxWidth: 600 }}>
            <UploadZone onDataLoaded={handleDataLoaded} />
          </div>

          {/* Quick-access tabs for independent features */}
          <div style={{
            display: 'flex',
            gap: SPACE[3],
            marginTop: SPACE[4],
          }}>
            <button
              onClick={() => setActiveTab('clustering')}
              style={COMPONENT.button.small}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLOR.accent.teal;
                e.currentTarget.style.color = COLOR.accent.teal;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLOR.border.strong;
                e.currentTarget.style.color = COLOR.text.secondary;
              }}
            >
              Upload Beta Matrix
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              style={COMPONENT.button.small}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLOR.accent.teal;
                e.currentTarget.style.color = COLOR.accent.teal;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLOR.border.strong;
                e.currentTarget.style.color = COLOR.text.secondary;
              }}
            >
              Compare Studies
            </button>
            <IdatUploadZone onResultsReady={handleDataLoaded} />
          </div>

          <div style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            maxWidth: 500,
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            Accepts output from limma, minfi, DMRcate, or any tool with columns:
            probe_id (or CpG), delta_beta (or logFC), p_value (or P.Value), adj.P.Val (or FDR).
            All processing is local — no data leaves your browser.
          </div>
        </div>
      ) : (
        /* Results state with tabs */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tab navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[1],
            padding: `0 ${SPACE[4]}px`,
            backgroundColor: COLOR.bg.elevated,
            borderBottom: `1px solid ${COLOR.border.subtle}`,
            flexShrink: 0,
          }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const isHovered = tabHover === tab.key;
              // Disable Manhattan if no genomic coords and we have a dataset
              const disabled = tab.key === 'manhattan' && dataset && !hasGenomic;
              // Disable enrichment if no data
              const needsData = tab.key === 'volcano' || tab.key === 'manhattan' || tab.key === 'enrichment';
              const noData = needsData && !dataset;

              return (
                <button
                  key={tab.key}
                  onClick={() => !disabled && !noData && setActiveTab(tab.key)}
                  onMouseEnter={() => setTabHover(tab.key)}
                  onMouseLeave={() => setTabHover(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive
                      ? `2px solid ${COLOR.accent.teal}`
                      : '2px solid transparent',
                    color: disabled || noData
                      ? COLOR.text.faint
                      : isActive
                        ? COLOR.accent.teal
                        : isHovered
                          ? COLOR.text.primary
                          : COLOR.text.muted,
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: isActive ? WEIGHT.medium : WEIGHT.normal,
                    padding: `${SPACE[2]}px ${SPACE[3]}px`,
                    cursor: disabled || noData ? 'default' : 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                    letterSpacing: '0.04em',
                    opacity: disabled || noData ? 0.4 : 1,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Summary stats in tab bar */}
            {dataset && (
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: SPACE[4],
                alignItems: 'center',
              }}>
                <span style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                }}>
                  {dataset.filename}
                </span>
                <span style={{
                  color: COLOR.text.muted,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                }}>
                  {summary.total.toLocaleString()} probes
                </span>
              </div>
            )}
          </div>

          {/* Summary bar (only for data-dependent tabs) */}
          {dataset && (activeTab === 'volcano' || activeTab === 'manhattan') && (
            <SummaryBar summary={summary} filename={dataset.filename} />
          )}

          {/* Tab content */}
          {activeTab === 'volcano' && dataset && (
            <ErrorBoundary fallbackLabel="Volcano Plot">
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                minHeight: 0,
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                }}>
                  <ThresholdControls
                    thresholds={thresholds}
                    onChange={setThresholds}
                  />
                  <div style={{ flex: 1, minHeight: 300, overflow: 'hidden' }}>
                    <VolcanoPlot
                      rows={rows}
                      thresholds={thresholds}
                      selectedIndex={selectedIndex}
                      onSelectIndex={setSelectedIndex}
                      onHoverIndex={setHoveredIndex}
                      hoveredIndex={hoveredIndex}
                    />
                  </div>
                </div>
                <div style={{
                  width: 320,
                  flexShrink: 0,
                  borderLeft: `1px solid ${COLOR.border.subtle}`,
                  overflowY: 'auto',
                }}>
                  <ProbeDetail row={selectedRow} />
                </div>
              </div>
              <div style={{
                maxHeight: 400,
                overflowY: 'auto',
                borderTop: `1px solid ${COLOR.border.subtle}`,
              }}>
                <ResultsTable
                  rows={rows}
                  thresholds={thresholds}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                />
              </div>
            </div>
            </ErrorBoundary>
          )}

          {activeTab === 'manhattan' && dataset && (
            <ErrorBoundary fallbackLabel="Manhattan Plot">
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                minHeight: 0,
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                }}>
                  <ThresholdControls
                    thresholds={thresholds}
                    onChange={setThresholds}
                  />
                  <div style={{ flex: 1, minHeight: 300, overflow: 'hidden' }}>
                    <ManhattanPlot
                      rows={rows}
                      thresholds={thresholds}
                      selectedIndex={selectedIndex}
                      onSelectIndex={setSelectedIndex}
                      onHoverIndex={setHoveredIndex}
                      hoveredIndex={hoveredIndex}
                    />
                  </div>
                </div>
                <div style={{
                  width: 320,
                  flexShrink: 0,
                  borderLeft: `1px solid ${COLOR.border.subtle}`,
                  overflowY: 'auto',
                }}>
                  <ProbeDetail row={selectedRow} />
                </div>
              </div>
              <div style={{
                maxHeight: 400,
                overflowY: 'auto',
                borderTop: `1px solid ${COLOR.border.subtle}`,
              }}>
                <ResultsTable
                  rows={rows}
                  thresholds={thresholds}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                />
              </div>
            </div>
            </ErrorBoundary>
          )}

          {activeTab === 'clustering' && (
            <ErrorBoundary fallbackLabel="Clustering">
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ClusteringPanel />
            </div>
            </ErrorBoundary>
          )}

          {activeTab === 'enrichment' && dataset && (
            <ErrorBoundary fallbackLabel="Enrichment">
            <div style={{ flex: 1, overflow: 'auto' }}>
              <EnrichmentPanel rows={rows} thresholds={thresholds} />
            </div>
            </ErrorBoundary>
          )}

          {activeTab === 'compare' && (
            <ErrorBoundary fallbackLabel="Comparison">
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ComparisonPanel thresholds={thresholds} />
            </div>
            </ErrorBoundary>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}
