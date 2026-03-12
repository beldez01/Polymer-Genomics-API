'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { parseCSV } from '@/lib/dmp/parse-csv';
import type { DMPDataset, ThresholdState } from '@/lib/dmp/types';
import type { StudyDataset, OverlapStats, VennData } from '@/lib/dmp/comparison';
import { computeOverlap, computeVennData } from '@/lib/dmp/comparison';
import { renderMultiVolcano } from '@/lib/dmp/multi-volcano-renderer';
import { VennDiagram } from './VennDiagram';
import type { QuadTree } from '@/lib/dmp/quadtree';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComparisonPanelProps {
  thresholds: ThresholdState;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STUDY_COLORS = [
  COLOR.accent.teal,
  COLOR.accent.amber,
  COLOR.accent.violet,
  COLOR.accent.rose,
];

const MAX_STUDIES = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparisonPanel({ thresholds }: ComparisonPanelProps) {
  const [studies, setStudies] = useState<StudyDataset[]>([]);
  const [overlapStats, setOverlapStats] = useState<OverlapStats[]>([]);
  const [vennData, setVennData] = useState<VennData | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quadtreeRef = useRef<QuadTree | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const [hoveredStudyIdx, setHoveredStudyIdx] = useState<number | null>(null);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [selectedStudyIdx, setSelectedStudyIdx] = useState<number | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const studyPointMapRef = useRef<Map<number, Array<{ px: number; py: number; studyIdx: number; rowIdx: number }>>>(new Map());

  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // ---------------------------------------------------------------------------
  // Recompute stats when studies or thresholds change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (studies.length < 2) {
      setOverlapStats([]);
      setVennData(null);
      return;
    }

    // Pairwise overlaps
    const stats: OverlapStats[] = [];
    for (let i = 0; i < studies.length; i++) {
      for (let j = i + 1; j < studies.length; j++) {
        stats.push(computeOverlap(studies[i], studies[j], thresholds));
      }
    }
    setOverlapStats(stats);

    // Venn (up to 3 sets)
    const vennStudies = studies.slice(0, 3);
    setVennData(computeVennData(vennStudies, thresholds));
  }, [studies, thresholds]);

  // ---------------------------------------------------------------------------
  // Canvas drawing
  // ---------------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || studies.length === 0) return;

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

    const result = renderMultiVolcano(
      ctx, w, h, studies, thresholds,
      selectedStudyIdx, selectedPointIdx,
      hoveredStudyIdx, hoveredPointIdx,
    );
    quadtreeRef.current = result.quadtree;
    studyPointMapRef.current = result.studyPointMap;
  }, [studies, thresholds, selectedStudyIdx, selectedPointIdx, hoveredStudyIdx, hoveredPointIdx, DPR]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // ---------------------------------------------------------------------------
  // Hit detection
  // ---------------------------------------------------------------------------

  const findPointAt = useCallback((clientX: number, clientY: number): { studyIdx: number; rowIdx: number } | null => {
    const canvas = canvasRef.current;
    const qt = quadtreeRef.current;
    if (!canvas || !qt) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const nearby = qt.queryRadius(x, y, 8);
    if (nearby.length === 0) return null;

    let minDist = Infinity;
    let closestGlobal = nearby[0].index;
    for (const p of nearby) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closestGlobal = p.index;
      }
    }

    // Map global index back to study/row
    let runningIdx = 0;
    for (let si = 0; si < studies.length; si++) {
      const count = studies[si].rows.length;
      if (closestGlobal < runningIdx + count) {
        return { studyIdx: si, rowIdx: closestGlobal - runningIdx };
      }
      runningIdx += count;
    }

    return null;
  }, [studies]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const hit = findPointAt(e.clientX, e.clientY);
    if (hit) {
      setHoveredStudyIdx(hit.studyIdx);
      setHoveredPointIdx(hit.rowIdx);
    } else {
      setHoveredStudyIdx(null);
      setHoveredPointIdx(null);
    }
  }, [findPointAt]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const hit = findPointAt(e.clientX, e.clientY);
    if (hit) {
      setSelectedStudyIdx(hit.studyIdx);
      setSelectedPointIdx(hit.rowIdx);
    } else {
      setSelectedStudyIdx(null);
      setSelectedPointIdx(null);
    }
  }, [findPointAt]);

  const handleMouseLeave = useCallback(() => {
    setHoveredStudyIdx(null);
    setHoveredPointIdx(null);
  }, []);

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const addFiles = useCallback(async (files: FileList) => {
    setParseError(null);
    const newStudies = [...studies];

    for (let i = 0; i < files.length; i++) {
      if (newStudies.length >= MAX_STUDIES) break;
      const file = files[i];
      try {
        const text = await file.text();
        const dataset = parseCSV(text, file.name);
        const name = file.name.replace(/\.(csv|tsv|txt)$/i, '');
        const color = STUDY_COLORS[newStudies.length % STUDY_COLORS.length];
        newStudies.push({ name, color, rows: dataset.rows });
      } catch (err) {
        setParseError(`Failed to parse ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    setStudies(newStudies);
  }, [studies]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const removeStudy = useCallback((idx: number) => {
    setStudies(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // Reassign colors
      return next.map((s, i) => ({ ...s, color: STUDY_COLORS[i % STUDY_COLORS.length] }));
    });
    setSelectedStudyIdx(null);
    setSelectedPointIdx(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Table styles
  // ---------------------------------------------------------------------------

  const thStyle: React.CSSProperties = {
    padding: `${SPACE[1]}px ${SPACE[2]}px`,
    textAlign: 'left',
    color: COLOR.text.tertiary,
    fontSize: TYPE.xs.fontSize,
    fontFamily: FONT_FAMILY,
    fontWeight: WEIGHT.medium,
    borderBottom: `1px solid ${COLOR.border.strong}`,
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: `${SPACE[1]}px ${SPACE[2]}px`,
    fontSize: TYPE.xs.fontSize,
    fontFamily: FONT_FAMILY,
    color: COLOR.text.secondary,
    borderBottom: `1px solid ${COLOR.border.subtle}`,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: SPACE[4] }}>
      <div style={{ ...COMPONENT.sectionHeader, marginBottom: SPACE[3] }}>
        MULTI-STUDY COMPARISON
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? COLOR.accent.teal : COLOR.border.strong}`,
          backgroundColor: dragOver ? 'rgba(78, 205, 196, 0.04)' : COLOR.bg.elevated,
          padding: `${SPACE[4]}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE[2],
          cursor: studies.length < MAX_STUDIES ? 'pointer' : 'default',
          transition: 'border-color 0.15s, background-color 0.15s',
          marginBottom: SPACE[4],
          minHeight: 80,
          opacity: studies.length >= MAX_STUDIES ? 0.5 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={studies.length >= MAX_STUDIES}
        />
        <div style={{
          color: dragOver ? COLOR.accent.teal : COLOR.text.secondary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
        }}>
          {studies.length >= MAX_STUDIES
            ? `Maximum ${MAX_STUDIES} studies loaded`
            : 'Drop DMP CSV files to compare (up to 4)'}
        </div>
        <div style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          {studies.length} / {MAX_STUDIES} loaded
        </div>
      </div>

      {/* Parse error */}
      {parseError && (
        <div style={{
          color: COLOR.accent.rose,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${COLOR.accent.rose}40`,
          marginBottom: SPACE[3],
        }}>
          {parseError}
        </div>
      )}

      {/* Study pills */}
      {studies.length > 0 && (
        <div style={{
          display: 'flex',
          gap: SPACE[2],
          flexWrap: 'wrap',
          marginBottom: SPACE[4],
        }}>
          {studies.map((s, i) => (
            <div
              key={`study-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE[1],
                backgroundColor: COLOR.bg.surface,
                border: `1px solid ${s.color}60`,
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
              }}
            >
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                backgroundColor: s.color,
                borderRadius: '50%',
              }} />
              <span style={{ color: COLOR.text.secondary }}>
                {s.name} ({s.rows.length.toLocaleString()})
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeStudy(i); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: COLOR.text.muted,
                  cursor: 'pointer',
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  padding: `0 ${SPACE[1]}px`,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Overlay volcano */}
      {studies.length > 0 && (
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            minHeight: 400,
            backgroundColor: COLOR.canvas.background,
            border: `1px solid ${COLOR.border.subtle}`,
            marginBottom: SPACE[4],
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            onMouseLeave={handleMouseLeave}
            style={{
              display: 'block',
              cursor: hoveredStudyIdx !== null ? 'pointer' : 'crosshair',
            }}
          />

          {/* Tooltip */}
          {hoveredStudyIdx !== null && hoveredPointIdx !== null && (
            (() => {
              const row = studies[hoveredStudyIdx]?.rows[hoveredPointIdx];
              if (!row) return null;
              const canvas = canvasRef.current;
              if (!canvas) return null;
              const pts = studyPointMapRef.current.get(hoveredStudyIdx);
              const pt = pts?.[hoveredPointIdx];
              if (!pt) return null;
              return (
                <div style={{
                  position: 'absolute',
                  left: pt.px + 12,
                  top: pt.py - 8,
                  backgroundColor: COLOR.bg.surface,
                  border: `1px solid ${COLOR.border.strong}`,
                  padding: `${SPACE[2]}px ${SPACE[3]}px`,
                  pointerEvents: 'none',
                  zIndex: 10,
                  maxWidth: 300,
                }}>
                  <div style={{
                    color: studies[hoveredStudyIdx].color,
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: WEIGHT.medium,
                    marginBottom: 2,
                  }}>
                    {studies[hoveredStudyIdx].name}
                  </div>
                  <div style={{
                    color: COLOR.text.primary,
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                    marginBottom: 2,
                  }}>
                    {row.probe_id}
                    {row.gene_symbol && ` (${row.gene_symbol})`}
                  </div>
                  <div style={{
                    color: COLOR.text.tertiary,
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                  }}>
                    {'\u0394\u03B2'} = {row.delta_beta.toFixed(4)}
                    {' | '}
                    adj.p = {row.adj_p_value.toExponential(2)}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Overlap stats + Venn */}
      {studies.length >= 2 && (
        <div style={{
          display: 'flex',
          gap: SPACE[6],
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}>
          {/* Stats table */}
          <div style={{ flex: 1, minWidth: 360 }}>
            <div style={{ ...COMPONENT.sectionHeader, marginBottom: SPACE[2] }}>
              OVERLAP STATISTICS
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Comparison</th>
                  <th style={thStyle}>Sig A</th>
                  <th style={thStyle}>Sig B</th>
                  <th style={thStyle}>Overlap</th>
                  <th style={thStyle}>Jaccard</th>
                  <th style={thStyle}>Concordance</th>
                  <th style={thStyle}>Spearman</th>
                </tr>
              </thead>
              <tbody>
                {overlapStats.map((stat, i) => (
                  <tr key={`stat-${i}`}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      {stat.studyA} vs {stat.studyB}
                    </td>
                    <td style={tdStyle}>{stat.sigA.toLocaleString()}</td>
                    <td style={tdStyle}>{stat.sigB.toLocaleString()}</td>
                    <td style={{
                      ...tdStyle,
                      color: stat.overlap > 0 ? COLOR.accent.teal : COLOR.text.secondary,
                    }}>
                      {stat.overlap.toLocaleString()}
                    </td>
                    <td style={tdStyle}>{stat.jaccardIndex.toFixed(3)}</td>
                    <td style={tdStyle}>
                      {(stat.concordanceRate * 100).toFixed(1)}% same direction
                    </td>
                    <td style={{
                      ...tdStyle,
                      color: Math.abs(stat.spearmanRho) > 0.5 ? COLOR.accent.amber : COLOR.text.secondary,
                    }}>
                      {'\u03C1'} = {stat.spearmanRho.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Venn diagram */}
          {vennData && (
            <div>
              <div style={{ ...COMPONENT.sectionHeader, marginBottom: SPACE[2] }}>
                VENN DIAGRAM
              </div>
              <VennDiagram data={vennData} />
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {studies.length === 0 && (
        <div style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          textAlign: 'center',
          padding: SPACE[8],
        }}>
          Load two or more DMP result files to compare
        </div>
      )}
    </div>
  );
}
