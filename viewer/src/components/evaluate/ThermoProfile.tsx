'use client';

import { COLOR, FONT_FAMILY_MONO } from '@/config/theme';
import type { EvalResult } from '@/config/evaluateMockData';

interface ThermoProfileProps {
  result: EvalResult;
}

export function ThermoProfile({ result }: ThermoProfileProps) {
  const profile = result.thermodynamics.profile;
  const range = result.thermodynamics.range_kcal;
  const lengthBp = result.length_bp;

  const VB_W = 1200;
  const VB_H = 200;
  const PADDING_L = 64;
  const PADDING_R = 16;
  const PADDING_TOP = 20;
  const PADDING_BOT = 32;
  const PLOT_W = VB_W - PADDING_L - PADDING_R;
  const PLOT_H = VB_H - PADDING_TOP - PADDING_BOT;

  const xAt = (i: number) => PADDING_L + (i / (profile.length - 1)) * PLOT_W;
  // y is inverted: y=0 (top) corresponds to highest energy, y=PLOT_H corresponds to lowest
  // Profile values are normalized [0,1]; treat 0 as min energy (deepest), 1 as max (least negative)
  const yAt = (v: number) => PADDING_TOP + (1 - v) * PLOT_H;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const tracePoints = profile.map((v, i) => `${r2(xAt(i))} ${r2(yAt(v))}`);
  const tracePath = 'M ' + tracePoints.join(' L ');
  const fillPath =
    `M ${PADDING_L} ${PADDING_TOP + PLOT_H} ` +
    'L ' + tracePoints.join(' L ') +
    ` L ${PADDING_L + PLOT_W} ${PADDING_TOP + PLOT_H} Z`;

  // X-axis ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    x: PADDING_L + t * PLOT_W,
    bp: Math.round(t * lengthBp),
  }));

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: 12,
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="thermoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={COLOR.primary.base} stopOpacity="0.16" />
            <stop offset="100%" stopColor={COLOR.primary.base} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Reference horizontal lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADDING_L}
            x2={PADDING_L + PLOT_W}
            y1={PADDING_TOP + PLOT_H * f}
            y2={PADDING_TOP + PLOT_H * f}
            stroke={COLOR.border.subtle}
            strokeWidth={1}
            strokeDasharray={f === 0.5 ? undefined : '2 3'}
          />
        ))}

        {/* Y-axis labels */}
        <text x={PADDING_L - 8} y={PADDING_TOP + 6} textAnchor="end"
          fontFamily="var(--font-jetbrains-mono), monospace" fontSize={10} fill={COLOR.text.tertiary}>
          {range.max.toFixed(1)}
        </text>
        <text x={PADDING_L - 8} y={PADDING_TOP + PLOT_H + 4} textAnchor="end"
          fontFamily="var(--font-jetbrains-mono), monospace" fontSize={10} fill={COLOR.text.tertiary}>
          {range.min.toFixed(1)}
        </text>
        <text x={6} y={PADDING_TOP + PLOT_H / 2}
          fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill={COLOR.text.faint}
          letterSpacing="0.08em" textAnchor="start">
          ΔG₃₇
        </text>
        <text x={6} y={PADDING_TOP + PLOT_H / 2 + 12}
          fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill={COLOR.text.faint}
          letterSpacing="0.08em" textAnchor="start">
          kcal/mol
        </text>

        {/* Trace */}
        <path d={fillPath} fill="url(#thermoFill)" />
        <path d={tracePath} fill="none" stroke={COLOR.primary.base} strokeWidth={1.4} strokeLinejoin="round" />

        {/* Axis baseline */}
        <line
          x1={PADDING_L}
          x2={PADDING_L + PLOT_W}
          y1={PADDING_TOP + PLOT_H}
          y2={PADDING_TOP + PLOT_H}
          stroke={COLOR.border.strong}
          strokeWidth={1}
        />

        {/* X-axis ticks */}
        {xTicks.map((tk, i) => {
          const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle';
          return (
            <g key={`xt-${i}`}>
              <line x1={tk.x} x2={tk.x}
                y1={PADDING_TOP + PLOT_H}
                y2={PADDING_TOP + PLOT_H + 5}
                stroke={COLOR.border.strong} strokeWidth={1} />
              <text x={tk.x} y={PADDING_TOP + PLOT_H + 18}
                textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono), monospace" fontSize={10} fill={COLOR.text.tertiary}>
                {tk.bp} bp
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
