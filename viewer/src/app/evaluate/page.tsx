'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';

/* ── Types ── */

interface EvalResult {
  name: string;
  length_bp: number;
  summary: {
    gc_content: number;
    cpg_count: number;
    cpg_density: number;
    cpg_island_count: number;
    melting_temp_estimate_C: number;
    mean_stacking_dG37_kcal?: number;
    mean_stacking_dG_salt_kcal?: number;
    mean_a_form_propensity?: number;
    mean_z_form_propensity?: number;
  };
  cpg_islands: Array<{
    start: number;
    end: number;
    length_bp: number;
    gc: number;
    obs_exp_cpg: number;
    cpg_count: number;
  }>;
  thermodynamics?: {
    stacking_dG37: { mean: number; sd: number; min: number; max: number; total: number };
    melting_temp_estimate_C: number;
    salt_mm: number;
    profile_windows: {
      window_size_bp: number;
      gc: number[];
      stacking_dG37: number[];
    };
  };
  extinction?: {
    total_e260_M_cm: number;
    per_base_mean: number;
  };
  structural?: {
    a_form_propensity_mean?: number;
    z_form_propensity_mean?: number;
    z_form_total_penalty_kcal?: number;
    groove_geometry?: {
      major_width_mean_A: number;
      major_depth_mean_A: number;
      minor_width_mean_A: number;
      minor_depth_mean_A: number;
    };
  };
  flags: Array<{
    type: 'warning' | 'info';
    code: string;
    region: string;
    message: string;
  }>;
  flag_counts: {
    total: number;
    warnings: number;
    info: number;
  };
}

/* ── Canvas Profile Chart ── */

function ProfileChart({
  data,
  label,
  color,
  height = 120,
  yLabel,
  refLine,
  refLabel,
}: {
  data: number[];
  label: string;
  color: string;
  height?: number;
  yLabel?: string;
  refLine?: number;
  refLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setCanvasWidth(e.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const MARGIN = { left: 52, right: 16, top: 16, bottom: 24 };
    const plotW = canvasWidth - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;

    // Clear
    ctx.fillStyle = COLOR.bg.track;
    ctx.fillRect(0, 0, canvasWidth, height);

    // Data range
    let yMin = Math.min(...data);
    let yMax = Math.max(...data);
    const yPad = (yMax - yMin) * 0.1 || 0.1;
    yMin -= yPad;
    yMax += yPad;

    const toX = (i: number) => MARGIN.left + (i / (data.length - 1 || 1)) * plotW;
    const toY = (v: number) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // Grid lines (horizontal)
    ctx.strokeStyle = COLOR.canvas.gridLine;
    ctx.lineWidth = 1;
    const yStep = niceStep(yMax - yMin, 4);
    const firstTick = Math.ceil(yMin / yStep) * yStep;
    for (let y = firstTick; y <= yMax; y += yStep) {
      const py = Math.round(toY(y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, py);
      ctx.lineTo(MARGIN.left + plotW, py);
      ctx.stroke();
    }

    // Reference line
    if (refLine !== undefined) {
      const ry = toY(refLine);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = COLOR.text.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, ry);
      ctx.lineTo(MARGIN.left + plotW, ry);
      ctx.stroke();
      ctx.setLineDash([]);
      if (refLabel) {
        ctx.fillStyle = COLOR.text.muted;
        ctx.font = `400 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(refLabel, MARGIN.left + 4, ry - 3);
      }
    }

    // Area fill
    ctx.beginPath();
    ctx.moveTo(toX(0), MARGIN.top + plotH);
    for (let i = 0; i < data.length; i++) {
      ctx.lineTo(toX(i), toY(data[i]));
    }
    ctx.lineTo(toX(data.length - 1), MARGIN.top + plotH);
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = toX(i);
      const y = toY(data[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Y-axis ticks
    ctx.fillStyle = COLOR.canvas.axisLabel;
    ctx.font = `400 ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = firstTick; y <= yMax; y += yStep) {
      const py = toY(y);
      ctx.fillText(y.toFixed(2), MARGIN.left - 6, py);
    }

    // X-axis ticks (window indices)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += xStep) {
      const px = toX(i);
      ctx.fillText(String(i + 1), px, MARGIN.top + plotH + 6);
    }

    // Labels
    ctx.fillStyle = COLOR.text.tertiary;
    ctx.font = `${WEIGHT.medium} ${TYPE.xs.fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, MARGIN.left, 2);

    // Y-axis label
    if (yLabel) {
      ctx.save();
      ctx.translate(10, MARGIN.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    // Border
    ctx.strokeStyle = COLOR.border.default;
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN.left, MARGIN.top, plotW, plotH);
  }, [data, canvasWidth, height, color, label, yLabel, refLine, refLabel]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

function niceStep(range: number, targetTicks: number): number {
  if (range <= 0) return 0.1;
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  let nice: number;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3) nice = 2;
  else if (residual <= 7) nice = 5;
  else nice = 10;
  return nice * mag;
}

/* ── Summary Card ── */

function MetricCard({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.track,
      border: `1px solid ${COLOR.border.default}`,
      padding: `${SPACE[3]}px ${SPACE[4]}px`,
      textAlign: 'center',
      minWidth: 100,
    }}>
      <div style={{
        color: accent || COLOR.accent.teal,
        fontSize: TYPE.lg.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.bold,
        marginBottom: SPACE[1],
      }}>
        {value}
      </div>
      <div style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        {label}
      </div>
    </div>
  );
}

/* ── Flag List ── */

function FlagList({ flags }: { flags: EvalResult['flags'] }) {
  if (flags.length === 0) {
    return (
      <div style={{ color: COLOR.text.muted, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
        No flags raised.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
      {flags.map((flag, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: SPACE[3],
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          backgroundColor: COLOR.bg.track,
          borderLeft: `3px solid ${flag.type === 'warning' ? COLOR.accent.amber : COLOR.accent.teal}`,
        }}>
          <span style={{
            color: flag.type === 'warning' ? COLOR.accent.amber : COLOR.accent.teal,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.bold,
            minWidth: 48,
            flexShrink: 0,
          }}>
            {flag.type === 'warning' ? 'WARN' : 'INFO'}
          </span>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            minWidth: 80,
            flexShrink: 0,
          }}>
            {flag.region}
          </span>
          <span style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.5,
          }}>
            <strong style={{ color: COLOR.text.primary }}>{flag.code}</strong> — {flag.message}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── CpG Islands Table ── */

function CpgIslandTable({ islands }: { islands: EvalResult['cpg_islands'] }) {
  if (islands.length === 0) return null;
  return (
    <div>
      <h3 style={{ ...sectionHeaderStyle, marginBottom: SPACE[3] }}>CpG ISLANDS DETECTED</h3>
      <div style={{
        overflowX: 'auto',
        border: `1px solid ${COLOR.border.default}`,
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
        }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLOR.border.default}` }}>
              {['Region', 'Length', 'GC', 'O/E CpG', 'CpG count'].map((h) => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: `${SPACE[2]}px ${SPACE[3]}px`,
                  color: COLOR.text.tertiary,
                  fontWeight: WEIGHT.medium,
                  fontSize: TYPE.xs.fontSize,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {islands.map((island, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${COLOR.border.subtle}` }}>
                <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.primary }}>
                  {island.start}-{island.end}
                </td>
                <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.secondary }}>
                  {island.length_bp} bp
                </td>
                <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.secondary }}>
                  {(island.gc * 100).toFixed(1)}%
                </td>
                <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.secondary }}>
                  {island.obs_exp_cpg.toFixed(2)}
                </td>
                <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.secondary }}>
                  {island.cpg_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Styles ── */

const sectionHeaderStyle: React.CSSProperties = {
  color: COLOR.accent.teal,
  fontSize: TYPE.xs.fontSize,
  fontFamily: FONT_FAMILY,
  fontWeight: WEIGHT.medium,
  letterSpacing: '0.12em',
};

const SECTION: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: `0 ${SPACE[6]}px`,
};

/* ── Example sequence ── */

const EXAMPLE_SEQ =
  'ATGCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG' +
  'ATGCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG' +
  'CCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCG' +
  'CCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCG' +
  'CCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCGCCCG' +
  'ATATATATATATATATATATATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAT' +
  'AAAAAAAAAAAAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGC';

/* ── Page ── */

export default function EvaluatePage() {
  const [seq, setSeq] = useState('');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const evaluate = useCallback(async (sequence: string) => {
    const cleaned = sequence.replace(/[^ACGTNacgtn]/g, '').toUpperCase();
    if (cleaned.length < 10) {
      setError('Sequence must be at least 10 bp (ACGT characters only).');
      return;
    }
    if (cleaned.length > 100000) {
      setError('Maximum sequence length is 100,000 bp.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: cleaned, name: 'evaluate', analysis: 'full' }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message =
          body?.error?.message ||
          body?.detail?.error?.message ||
          body?.detail?.[0]?.msg ||
          `HTTP ${resp.status}`;
        throw new Error(message);
      }
      const data = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = (ev.target?.result as string) || '';
      // Strip FASTA header lines
      text = text.split('\n').filter((l) => !l.startsWith('>')).join('');
      setSeq(text.replace(/\s/g, ''));
    };
    reader.readAsText(file);
  }, []);

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandBar />

      {/* Header */}
      <div style={{
        ...SECTION,
        paddingTop: SPACE[10],
        paddingBottom: SPACE[6],
      }}>
        <h1 style={{
          fontSize: TYPE.lg.fontSize,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.06em',
          color: COLOR.accent.teal,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[2],
        }}>
          DESIGN EVALUATOR
        </h1>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: TYPE.base.lineHeight,
        }}>
          Physics linter for DNA sequences. Paste or upload a sequence to assess biophysical
          properties, detect CpG islands, and flag potential issues.
        </p>
      </div>

      {/* Input */}
      <div style={{ ...SECTION, marginBottom: SPACE[6] }}>
        <textarea
          value={seq}
          onChange={(e) => setSeq(e.target.value)}
          placeholder="Paste a DNA sequence (ACGT, 10-100,000 bp) or upload FASTA..."
          rows={5}
          style={{
            ...COMPONENT.input.default as React.CSSProperties,
            width: '100%',
            resize: 'vertical',
            boxSizing: 'border-box',
            marginBottom: SPACE[3],
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], flexWrap: 'wrap' }}>
          <button
            onClick={() => evaluate(seq)}
            disabled={loading}
            style={{
              ...COMPONENT.button.ghost as React.CSSProperties,
              borderColor: COLOR.accent.teal,
              color: COLOR.accent.teal,
              opacity: loading ? 0.5 : 1,
              pointerEvents: loading ? ('none' as const) : ('auto' as const),
            }}
          >
            {loading ? 'Evaluating...' : 'Evaluate'}
          </button>
          <label style={{
            ...COMPONENT.button.ghost as React.CSSProperties,
            cursor: 'pointer',
            display: 'inline-block',
          }}>
            Upload FASTA
            <input
              type="file"
              accept=".fa,.fasta,.txt"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </label>
          <button
            onClick={() => { setSeq(EXAMPLE_SEQ); evaluate(EXAMPLE_SEQ); }}
            style={{
              ...COMPONENT.button.ghost as React.CSSProperties,
              color: COLOR.text.muted,
              borderColor: COLOR.border.strong,
            }}
          >
            Try Example
          </button>
          {error && (
            <span style={{ color: COLOR.accent.rose, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <ErrorBoundary fallbackLabel="Evaluation Results">
        <div style={{ ...SECTION, display: 'flex', flexDirection: 'column', gap: SPACE[8], paddingBottom: SPACE[16] }}>

          {/* Summary Cards */}
          <div>
            <h3 style={{ ...sectionHeaderStyle, marginBottom: SPACE[3] }}>SUMMARY</h3>
            <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
              <MetricCard value={result.length_bp.toLocaleString()} label="bp" />
              <MetricCard value={(result.summary.gc_content * 100).toFixed(1) + '%'} label="GC content" />
              <MetricCard
                value={result.summary.mean_stacking_dG37_kcal?.toFixed(2) || '---'}
                label="mean dG37"
                accent={COLOR.accent.violet}
              />
              <MetricCard
                value={result.summary.melting_temp_estimate_C.toFixed(1) + ' C'}
                label="Tm estimate"
                accent={COLOR.accent.amber}
              />
              <MetricCard
                value={String(result.summary.cpg_island_count)}
                label={result.summary.cpg_island_count === 1 ? 'CpG island' : 'CpG islands'}
                accent={result.summary.cpg_island_count > 0 ? COLOR.accent.amber : COLOR.accent.teal}
              />
              <MetricCard
                value={`${result.flag_counts.warnings}W / ${result.flag_counts.info}I`}
                label="flags"
                accent={result.flag_counts.warnings > 0 ? COLOR.accent.rose : COLOR.accent.teal}
              />
            </div>
          </div>

          {/* Profile Charts */}
          {result.thermodynamics?.profile_windows && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
              <h3 style={sectionHeaderStyle}>WINDOWED PROFILES ({result.thermodynamics.profile_windows.window_size_bp} bp windows)</h3>
              {result.thermodynamics.profile_windows.stacking_dG37.length > 0 && (
                <ProfileChart
                  data={result.thermodynamics.profile_windows.stacking_dG37}
                  label="Stacking Energy (dG37 kcal/mol)"
                  color={COLOR.accent.violet}
                  yLabel="dG37"
                  refLine={result.thermodynamics.stacking_dG37.mean}
                  refLabel={`mean ${result.thermodynamics.stacking_dG37.mean.toFixed(2)}`}
                />
              )}
              {result.thermodynamics.profile_windows.gc.length > 0 && (
                <ProfileChart
                  data={result.thermodynamics.profile_windows.gc}
                  label="GC Content"
                  color={COLOR.accent.teal}
                  yLabel="GC"
                  refLine={result.summary.gc_content}
                  refLabel={`mean ${(result.summary.gc_content * 100).toFixed(1)}%`}
                />
              )}
            </div>
          )}

          {/* CpG Islands */}
          <CpgIslandTable islands={result.cpg_islands} />

          {/* Structural Summary */}
          {result.structural && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginBottom: SPACE[3] }}>STRUCTURAL PROPERTIES</h3>
              <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
                {result.structural.a_form_propensity_mean !== undefined && (
                  <MetricCard value={result.structural.a_form_propensity_mean.toFixed(3)} label="A-form propensity" />
                )}
                {result.structural.z_form_propensity_mean !== undefined && (
                  <MetricCard value={result.structural.z_form_propensity_mean.toFixed(3)} label="Z-form propensity" />
                )}
                {result.structural.groove_geometry && (
                  <>
                    <MetricCard value={result.structural.groove_geometry.major_width_mean_A.toFixed(1) + ' A'} label="major groove" />
                    <MetricCard value={result.structural.groove_geometry.minor_width_mean_A.toFixed(1) + ' A'} label="minor groove" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Extinction */}
          {result.extinction && (
            <div>
              <h3 style={{ ...sectionHeaderStyle, marginBottom: SPACE[3] }}>EXTINCTION (UV ABSORBANCE)</h3>
              <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap' }}>
                <MetricCard value={result.extinction.total_e260_M_cm.toLocaleString()} label="total e260 (M-1 cm-1)" />
                <MetricCard value={result.extinction.per_base_mean.toFixed(1)} label="per base mean" />
              </div>
            </div>
          )}

          {/* Flags */}
          <div>
            <h3 style={{ ...sectionHeaderStyle, marginBottom: SPACE[3] }}>
              FLAGS ({result.flag_counts.total})
            </h3>
            <FlagList flags={result.flags} />
          </div>

          {/* Export */}
          <div style={{ display: 'flex', gap: SPACE[3] }}>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `evaluate_${result.name}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={COMPONENT.button.ghost as React.CSSProperties}
            >
              Export JSON
            </button>
          </div>
        </div>
        </ErrorBoundary>
      )}

      <div style={{ flex: 1 }} />
      <Footer />
    </main>
  );
}
