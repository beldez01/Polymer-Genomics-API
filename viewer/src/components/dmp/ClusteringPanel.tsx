'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { BetaUploadZone } from './BetaUploadZone';
import type { BetaMatrix } from '@/lib/dmp/parse-beta-matrix';
import {
  clusterBetaMatrix,
  type ClusterResult,
  type DistanceMetric,
  type LinkageMethod,
} from '@/lib/dmp/clustering';
import { renderHeatmap, heatmapToSVG } from '@/lib/dmp/heatmap-renderer';

export function ClusteringPanel() {
  const [betaMatrix, setBetaMatrix] = useState<BetaMatrix | null>(null);
  const [clusterResult, setClusterResult] = useState<ClusterResult | null>(null);
  const [clustering, setClustering] = useState(false);
  const [topN, setTopN] = useState(500);
  const [distMetric, setDistMetric] = useState<DistanceMetric>('correlation');
  const [linkage, setLinkage] = useState<LinkageMethod>('ward');
  const [svgHover, setSvgHover] = useState(false);
  const [pngHover, setPngHover] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const groups = betaMatrix
    ? betaMatrix.samples.map(s => s.group)
    : [];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !clusterResult) return;

    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    sizeRef.current = { w, h };

    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderHeatmap(ctx, w, h, clusterResult, groups, {
      sampleIds: betaMatrix?.samples.map(s => s.sampleId),
      probeIds: betaMatrix?.probeIds,
    });
  }, [clusterResult, groups, betaMatrix, DPR]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  const handleRunClustering = useCallback(async () => {
    if (!betaMatrix) return;
    setClustering(true);
    // Defer to next tick so UI updates
    await new Promise(r => setTimeout(r, 0));
    try {
      const result = clusterBetaMatrix(betaMatrix, {
        topN,
        distMetric,
        linkage,
      });
      setClusterResult(result);
    } finally {
      setClustering(false);
    }
  }, [betaMatrix, topN, distMetric, linkage]);

  const handleExportSVG = useCallback(() => {
    if (!clusterResult) return;
    const { w, h } = sizeRef.current;
    const svg = heatmapToSVG(w || 800, h || 500, clusterResult, groups, {
      sampleIds: betaMatrix?.samples.map(s => s.sampleId),
      probeIds: betaMatrix?.probeIds,
    });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heatmap.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [clusterResult, groups, betaMatrix]);

  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'heatmap.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  const handleDataLoaded = useCallback((matrix: BetaMatrix) => {
    setBetaMatrix(matrix);
    setClusterResult(null);
  }, []);

  // No data: show upload zone
  if (!betaMatrix) {
    return <BetaUploadZone onDataLoaded={handleDataLoaded} />;
  }

  const selectStyle: React.CSSProperties = {
    ...COMPONENT.input.default,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23777777'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: 24,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Controls bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        flexWrap: 'wrap',
      }}>
        {/* Data info */}
        <span style={{
          ...COMPONENT.sectionHeader,
          marginRight: SPACE[2],
        }}>
          {betaMatrix.nSamples} samples / {betaMatrix.nProbes} probes
        </span>

        {/* Top N slider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[1],
        }}>
          <label style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            Top probes
          </label>
          <input
            type="range"
            min={50}
            max={Math.min(2000, betaMatrix.nProbes)}
            step={50}
            value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value, 10))}
            style={{
              width: 100,
              accentColor: COLOR.accent.teal,
              cursor: 'pointer',
            }}
          />
          <span style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            minWidth: 32,
          }}>
            {topN}
          </span>
        </div>

        {/* Distance metric */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[1],
        }}>
          <label style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            Distance
          </label>
          <select
            value={distMetric}
            onChange={(e) => setDistMetric(e.target.value as DistanceMetric)}
            style={selectStyle}
          >
            <option value="correlation">1 - Pearson r</option>
            <option value="euclidean">Euclidean</option>
          </select>
        </div>

        {/* Linkage */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[1],
        }}>
          <label style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            Linkage
          </label>
          <select
            value={linkage}
            onChange={(e) => setLinkage(e.target.value as LinkageMethod)}
            style={selectStyle}
          >
            <option value="ward">Ward</option>
            <option value="complete">Complete</option>
            <option value="average">Average</option>
          </select>
        </div>

        {/* Run button */}
        <button
          onClick={handleRunClustering}
          disabled={clustering}
          style={{
            ...COMPONENT.button.small,
            backgroundColor: clustering ? COLOR.bg.surface : COLOR.bg.track,
            color: clustering ? COLOR.text.muted : COLOR.accent.teal,
            borderColor: COLOR.accent.teal,
            opacity: clustering ? 0.6 : 1,
          }}
        >
          {clustering ? 'Clustering...' : 'Run Clustering'}
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Export buttons */}
        {clusterResult && (
          <>
            <button
              onClick={handleExportSVG}
              onMouseEnter={() => setSvgHover(true)}
              onMouseLeave={() => setSvgHover(false)}
              style={{
                ...COMPONENT.button.small,
                ...(svgHover ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : {}),
              }}
            >
              SVG
            </button>
            <button
              onClick={handleExportPNG}
              onMouseEnter={() => setPngHover(true)}
              onMouseLeave={() => setPngHover(false)}
              style={{
                ...COMPONENT.button.small,
                ...(pngHover ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : {}),
              }}
            >
              PNG
            </button>
          </>
        )}

        {/* Reset */}
        <button
          onClick={() => { setBetaMatrix(null); setClusterResult(null); }}
          style={{
            ...COMPONENT.button.small,
            color: COLOR.text.muted,
          }}
        >
          Reset
        </button>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          minHeight: 300,
          backgroundColor: COLOR.canvas.background,
          border: `1px solid ${COLOR.border.subtle}`,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block' }}
        />

        {/* Empty state — data loaded but not yet clustered */}
        {!clusterResult && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLOR.text.muted,
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            {clustering
              ? 'Computing clusters...'
              : 'Configure parameters and click Run Clustering'
            }
          </div>
        )}
      </div>
    </div>
  );
}
