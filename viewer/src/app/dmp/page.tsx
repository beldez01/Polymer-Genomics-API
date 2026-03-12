'use client';

import { useState, useCallback, useMemo } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { UploadZone } from '@/components/dmp/UploadZone';
import { VolcanoPlot } from '@/components/dmp/VolcanoPlot';
import { ProbeDetail } from '@/components/dmp/ProbeDetail';
import { ResultsTable } from '@/components/dmp/ResultsTable';
import { SummaryBar } from '@/components/dmp/SummaryBar';
import { ThresholdControls } from '@/components/dmp/ThresholdControls';
import type { DMPDataset, DMPRow, ThresholdState } from '@/lib/dmp/types';
import { computeSummary } from '@/lib/dmp/stats';
import Link from 'next/link';

const DEFAULT_THRESHOLDS: ThresholdState = {
  pValueCutoff: 1.301, // -log10(0.05)
  adjPValueCutoff: 0.05,
  deltaBetaCutoff: 0.05,
};

export default function DMPPage() {
  const [dataset, setDataset] = useState<DMPDataset | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdState>(DEFAULT_THRESHOLDS);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [homeHover, setHomeHover] = useState(false);

  const rows: DMPRow[] = dataset?.rows ?? [];

  const summary = useMemo(() => computeSummary(rows, thresholds), [rows, thresholds]);

  const selectedRow = selectedIndex !== null ? rows[selectedIndex] ?? null : null;

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
  }, []);

  return (
    <div style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT_FAMILY,
    }}>
      {/* Header bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[4],
        padding: `${SPACE[2]}px ${SPACE[4]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        backgroundColor: COLOR.bg.elevated,
        height: 44,
        flexShrink: 0,
      }}>
        <Link
          href="/"
          onMouseEnter={() => setHomeHover(true)}
          onMouseLeave={() => setHomeHover(false)}
          style={{
            color: homeHover ? COLOR.accent.teal : COLOR.text.muted,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
        >
          Polymer Genomics
        </Link>
        <span style={{ color: COLOR.text.faint, fontSize: TYPE.sm.fontSize }}>/</span>
        <span style={{
          color: COLOR.text.primary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
        }}>
          DMP Results Viewer
        </span>

        {dataset && (
          <button
            onClick={handleReset}
            style={{
              ...COMPONENT.button.small,
              marginLeft: 'auto',
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
      </header>

      {/* Content */}
      {!dataset ? (
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
        /* Results state */
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Summary bar */}
          <SummaryBar summary={summary} filename={dataset.filename} />

          {/* Main content: volcano + controls + detail */}
          <div style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            minHeight: 0,
          }}>
            {/* Left column: volcano + thresholds */}
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
              <div style={{ flex: 1, minHeight: 300 }}>
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

            {/* Right sidebar: probe detail */}
            <div style={{
              width: 320,
              flexShrink: 0,
              borderLeft: `1px solid ${COLOR.border.subtle}`,
              overflowY: 'auto',
            }}>
              <ProbeDetail row={selectedRow} />
            </div>
          </div>

          {/* Bottom: results table */}
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
      )}
    </div>
  );
}
