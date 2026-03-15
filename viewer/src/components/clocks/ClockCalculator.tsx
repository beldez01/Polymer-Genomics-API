'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT, COMPONENT } from '@/config/theme';
import type { ClockMetadata, ClockProbe } from '@/lib/api';

// ---------------------------------------------------------------------------
// Age transform functions
// ---------------------------------------------------------------------------

function transformAge(rawAge: number, transform: string, intercept: number | null): number {
  switch (transform) {
    case 'anti_log_linear':
      // Horvath: age = anti-transform of weighted sum
      // F(x) = 21 * exp(x) + 20 when x > 0; 21 * x + 20 when x <= 0
      if (rawAge > 0) return 21 * Math.exp(rawAge) + 20;
      return 21 * rawAge + 20;
    case 'none':
      // DunedinPACE: output is pace, not age
      return rawAge;
    case 'linear':
    default:
      return rawAge;
  }
}

// ---------------------------------------------------------------------------
// Radar chart (canvas)
// ---------------------------------------------------------------------------

function RadarChart({
  ages,
  chronAge,
  clockNames,
}: {
  ages: Record<string, number>;
  chronAge: number | null;
  clockNames: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 320;
  const center = size / 2;
  const radius = size / 2 - 50;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.canvas.width = size * dpr;
    ctx.canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const validClocks = clockNames.filter((n) => ages[n] != null && isFinite(ages[n]));
    if (!validClocks.length) return;

    const n = validClocks.length;
    const angleStep = (Math.PI * 2) / n;

    // Determine scale
    const allAges = validClocks.map((c) => ages[c]);
    const maxAge = Math.max(...allAges, chronAge ?? 0) * 1.2;
    const scale = radius / maxAge;

    // Grid rings
    const rings = [0.25, 0.5, 0.75, 1.0];
    for (const r of rings) {
      ctx.beginPath();
      ctx.arc(center, center, radius * r, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR.border.subtle;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Ring label
      ctx.fillStyle = COLOR.text.faint;
      ctx.font = `8px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(Math.round(maxAge * r).toString(), center + 3, center - radius * r + 10);
    }

    // Axes
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      const ax = center + Math.cos(angle) * radius;
      const ay = center + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = COLOR.border.default;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Label
      const labelR = radius + 20;
      const lx = center + Math.cos(angle) * labelR;
      const ly = center + Math.sin(angle) * labelR;
      ctx.fillStyle = COLOR.text.muted;
      ctx.font = `9px ${FONT_FAMILY}`;
      ctx.textAlign = Math.abs(angle) > Math.PI / 2 + 0.1 ? 'right' : angle < -Math.PI / 2 + 0.1 && angle > -Math.PI / 2 - 0.1 ? 'center' : 'left';
      ctx.textBaseline = angle > 0 ? 'top' : 'bottom';
      const shortName = validClocks[i].replace(/_\d{4}$/, '').replace(/_/g, ' ');
      ctx.fillText(shortName, lx, ly);
    }

    // Chronological age ring
    if (chronAge != null && chronAge > 0) {
      ctx.beginPath();
      ctx.arc(center, center, chronAge * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(240, 165, 0, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Data polygon
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      const r = Math.max(0, ages[validClocks[i]]) * scale;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(78, 205, 196, 0.1)';
    ctx.fill();
    ctx.strokeStyle = COLOR.accent.teal;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Data points
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * angleStep;
      const r = Math.max(0, ages[validClocks[i]]) * scale;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.accent.teal;
      ctx.fill();
    }
  }, [ages, chronAge, clockNames]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block', margin: '0 auto' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  clockMeta: ClockMetadata[];
  clockProbes: Record<string, ClockProbe[]>;
}

export function ClockCalculator({ clockMeta, clockProbes }: Props) {
  const [betaText, setBetaText] = useState('');
  const [chronAge, setChronAge] = useState<string>('');
  const [ages, setAges] = useState<Record<string, number> | null>(null);
  const [coverage, setCoverage] = useState<Record<string, { found: number; total: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(() => {
    setError(null);
    setAges(null);
    setCoverage(null);

    // Parse beta matrix: probe_id\tbeta or probe_id,beta (one sample)
    const lines = betaText.trim().split('\n').filter((l) => l.trim());
    if (lines.length < 10) {
      setError('Need at least 10 lines of probe_id<tab>beta data.');
      return;
    }

    const betas = new Map<string, number>();
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const startIdx = lines[0].match(/^(probe_id|cg|ch)/i) ? 1 : 0; // skip header
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(sep);
      if (parts.length < 2) continue;
      const pid = parts[0].trim();
      const val = parseFloat(parts[1].trim());
      if (pid && isFinite(val)) betas.set(pid, val);
    }

    if (betas.size < 10) {
      setError(`Only parsed ${betas.size} valid beta values. Check format.`);
      return;
    }

    // Compute age for each clock
    const newAges: Record<string, number> = {};
    const newCoverage: Record<string, { found: number; total: number }> = {};

    for (const meta of clockMeta) {
      const probes = clockProbes[meta.clock_name] ?? [];
      let sum = meta.intercept ?? 0;
      let found = 0;
      for (const p of probes) {
        const beta = betas.get(p.probe_id);
        if (beta != null) {
          sum += beta * p.coefficient;
          found++;
        }
      }
      newCoverage[meta.clock_name] = { found, total: probes.length };
      if (found / probes.length >= 0.5) {
        newAges[meta.clock_name] = transformAge(sum, meta.age_transform, meta.intercept);
      }
    }

    setAges(newAges);
    setCoverage(newCoverage);
  }, [betaText, clockMeta, clockProbes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
      {/* Disclaimer */}
      <div style={{
        backgroundColor: 'rgba(244, 63, 94, 0.04)',
        border: `1px solid rgba(244, 63, 94, 0.15)`,
        padding: `${SPACE[2]}px ${SPACE[4]}px`,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        color: COLOR.text.muted,
        lineHeight: 1.6,
      }}>
        <strong style={{ color: COLOR.accent.rose }}>RESEARCH USE ONLY.</strong>{' '}
        This calculator applies published clock coefficients as a simple dot product.
        It does not perform normalization, imputation, or quality control.
        Results are approximate and should not be used for clinical decisions.
        Professional epigenetic age analysis requires proper preprocessing pipelines.
      </div>

      {/* Input area */}
      <div style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[2],
      }}>
        <div style={{
          ...COMPONENT.sectionHeader,
          textTransform: 'uppercase' as const,
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[3],
        }}>
          APPLY CLOCKS
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.02em',
            textTransform: 'none' as const,
            fontWeight: 400,
          }}>
            Paste probe_id{'<tab>'}beta values (one sample)
          </span>
        </div>

        <textarea
          value={betaText}
          onChange={(e) => setBetaText(e.target.value)}
          placeholder={'probe_id\tbeta\ncg16867657\t0.432\ncg22736354\t0.187\n...'}
          rows={8}
          style={{
            ...COMPONENT.input.default as React.CSSProperties,
            resize: 'vertical' as const,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xs.fontSize,
            lineHeight: 1.6,
            width: '100%',
          }}
        />

        <div style={{ display: 'flex', gap: SPACE[3], alignItems: 'center' }}>
          <label style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            Chronological age (optional):
          </label>
          <input
            type="number"
            value={chronAge}
            onChange={(e) => setChronAge(e.target.value)}
            placeholder="45"
            style={{
              ...COMPONENT.input.default as React.CSSProperties,
              width: 80,
            }}
          />
          <button
            onClick={compute}
            disabled={!betaText.trim()}
            style={{
              ...COMPONENT.button.ghost as React.CSSProperties,
              opacity: !betaText.trim() ? 0.4 : 1,
              marginLeft: 'auto',
            }}
          >
            Compute ages
          </button>
        </div>

        {error && (
          <div style={{ color: COLOR.accent.rose, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {ages && coverage && (
        <div style={{
          backgroundColor: COLOR.bg.elevated,
          border: `1px solid ${COLOR.border.subtle}`,
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE[3],
        }}>
          <div style={{
            ...COMPONENT.sectionHeader,
            textTransform: 'uppercase' as const,
          }}>
            RESULTS
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: SPACE[6],
            alignItems: 'start',
          }}>
            {/* Age table */}
            <div>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
              }}>
                <thead>
                  <tr>
                    {['Clock', 'Age', 'Coverage', 'Delta'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left',
                        color: COLOR.text.muted,
                        fontWeight: WEIGHT.medium,
                        padding: `${SPACE[1]}px ${SPACE[2]}px`,
                        borderBottom: `1px solid ${COLOR.border.subtle}`,
                        letterSpacing: '0.04em',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clockMeta.map((meta) => {
                    const age = ages[meta.clock_name];
                    const cov = coverage[meta.clock_name];
                    const covPct = cov ? Math.round((cov.found / cov.total) * 100) : 0;
                    const chronAgeNum = chronAge ? parseFloat(chronAge) : null;
                    const delta = age != null && chronAgeNum != null && meta.outcome !== 'pace_of_aging'
                      ? age - chronAgeNum
                      : null;

                    return (
                      <tr key={meta.clock_name}>
                        <td style={{
                          padding: `4px ${SPACE[2]}px`,
                          color: COLOR.text.secondary,
                        }}>
                          {meta.display_name}
                        </td>
                        <td style={{
                          padding: `4px ${SPACE[2]}px`,
                          color: age != null ? COLOR.text.primary : COLOR.text.faint,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: age != null ? WEIGHT.medium : WEIGHT.normal,
                        }}>
                          {age != null
                            ? meta.outcome === 'pace_of_aging'
                              ? `${age.toFixed(3)} pace`
                              : `${age.toFixed(1)} yr`
                            : `< 50% coverage`}
                        </td>
                        <td style={{
                          padding: `4px ${SPACE[2]}px`,
                          color: covPct >= 80 ? COLOR.accent.teal : covPct >= 50 ? COLOR.accent.amber : COLOR.accent.rose,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {cov?.found}/{cov?.total} ({covPct}%)
                        </td>
                        <td style={{
                          padding: `4px ${SPACE[2]}px`,
                          fontVariantNumeric: 'tabular-nums',
                          color: delta != null
                            ? delta > 0 ? COLOR.accent.rose : COLOR.accent.teal
                            : COLOR.text.faint,
                        }}>
                          {delta != null
                            ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} yr`
                            : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {chronAge && (
                <div style={{
                  marginTop: SPACE[2],
                  color: COLOR.text.faint,
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                }}>
                  Dashed amber ring = chronological age ({chronAge} yr)
                </div>
              )}
            </div>

            {/* Radar chart */}
            <RadarChart
              ages={ages}
              chronAge={chronAge ? parseFloat(chronAge) : null}
              clockNames={clockMeta.map((m) => m.clock_name)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
