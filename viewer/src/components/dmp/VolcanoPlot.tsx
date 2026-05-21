'use client';

import { useMemo } from 'react';
import { COLOR, FONT_FAMILY_MONO } from '@/config/theme';
import { PROBES, TOP_HITS, type Probe } from '@/config/methylationMockData';

interface VolcanoPlotProps {
  selectedProbeId?: string;
  onProbeSelect?: (id: string) => void;
}

const X_MIN = -0.4;
const X_MAX = 0.4;
const Y_MIN = 0;
const Y_MAX = 14;
const GW_SIG = 7.3;
const DB_THRESHOLD = 0.05;

export function VolcanoPlot({ selectedProbeId, onProbeSelect }: VolcanoPlotProps) {
  const VB_W = 1200;
  const VB_H = 460;
  const PAD_L = 70;
  const PAD_R = 24;
  const PAD_TOP = 16;
  const PAD_BOT = 44;
  const PLOT_W = VB_W - PAD_L - PAD_R;
  const PLOT_H = VB_H - PAD_TOP - PAD_BOT;

  const xAt = (db: number) => PAD_L + ((db - X_MIN) / (X_MAX - X_MIN)) * PLOT_W;
  const yAt = (lp: number) => PAD_TOP + (1 - (lp - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;

  // Clip to [X_MIN, X_MAX] / [Y_MIN, Y_MAX]
  const visible = useMemo(() => PROBES.filter((p) =>
    p.delta_beta >= X_MIN && p.delta_beta <= X_MAX && p.neglogp <= Y_MAX
  ), []);

  const colorFor = (p: Probe): string => {
    if (p.id === selectedProbeId) return COLOR.primary.active;
    if (p.klass === 'hyper') return COLOR.primary.base;
    if (p.klass === 'hypo')  return COLOR.accent.rose;
    return COLOR.text.faint;
  };

  const radiusFor = (p: Probe): number => {
    if (p.id === selectedProbeId) return 5;
    if (p.klass !== 'ns') return 2.8;
    return 1.4;
  };

  const opacityFor = (p: Probe): number => {
    if (p.id === selectedProbeId) return 1;
    if (p.klass !== 'ns') return 0.85;
    return 0.45;
  };

  // Top-5 labels (highest neglogp)
  const labels = TOP_HITS.slice(0, 6);

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: 8,
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }}>
        {/* Threshold lines */}
        <line
          x1={PAD_L} x2={PAD_L + PLOT_W}
          y1={yAt(GW_SIG)} y2={yAt(GW_SIG)}
          stroke={COLOR.accent.rose} strokeWidth={1} strokeDasharray="4 4"
        />
        <text
          x={PAD_L + PLOT_W - 4}
          y={yAt(GW_SIG) - 4}
          textAnchor="end"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={9}
          fill={COLOR.accent.rose}
          letterSpacing="0.04em"
        >
          gw-sig · −log₁₀p = 7.3
        </text>
        <line
          x1={xAt(-DB_THRESHOLD)} x2={xAt(-DB_THRESHOLD)}
          y1={PAD_TOP} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.text.muted} strokeWidth={1} strokeDasharray="2 4"
        />
        <line
          x1={xAt(DB_THRESHOLD)} x2={xAt(DB_THRESHOLD)}
          y1={PAD_TOP} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.text.muted} strokeWidth={1} strokeDasharray="2 4"
        />

        {/* Vertical zero line */}
        <line
          x1={xAt(0)} x2={xAt(0)}
          y1={PAD_TOP} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.border.strong} strokeWidth={1}
        />

        {/* Quadrant labels */}
        <text
          x={xAt(-0.25)} y={PAD_TOP + 14}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.accent.rose}
          letterSpacing="0.18em"
        >
          HYPO
        </text>
        <text
          x={xAt(0.25)} y={PAD_TOP + 14}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.primary.base}
          letterSpacing="0.18em"
        >
          HYPER
        </text>

        {/* Dots */}
        {visible.map((p) => (
          <circle
            key={p.id}
            cx={xAt(p.delta_beta)}
            cy={yAt(p.neglogp)}
            r={radiusFor(p)}
            fill={colorFor(p)}
            fillOpacity={opacityFor(p)}
            stroke={p.id === selectedProbeId ? COLOR.bg.white : 'none'}
            strokeWidth={p.id === selectedProbeId ? 1.5 : 0}
            style={{ cursor: 'pointer' }}
            onClick={() => onProbeSelect?.(p.id)}
          />
        ))}

        {/* Labels for top hits */}
        {labels.map((p) => (
          <g key={`lbl-${p.id}`} pointerEvents="none">
            <line
              x1={xAt(p.delta_beta) + (p.delta_beta < 0 ? -2 : 2)}
              x2={xAt(p.delta_beta) + (p.delta_beta < 0 ? -22 : 22)}
              y1={yAt(p.neglogp)}
              y2={yAt(p.neglogp) - 12}
              stroke={COLOR.text.tertiary}
              strokeWidth={0.5}
            />
            <text
              x={xAt(p.delta_beta) + (p.delta_beta < 0 ? -24 : 24)}
              y={yAt(p.neglogp) - 14}
              textAnchor={p.delta_beta < 0 ? 'end' : 'start'}
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={9}
              fontWeight={500}
              fill={COLOR.text.primary}
            >
              {p.gene} · {p.id}
            </text>
          </g>
        ))}

        {/* X axis */}
        <line
          x1={PAD_L} x2={PAD_L + PLOT_W}
          y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.border.strong} strokeWidth={1}
        />
        {[-0.4, -0.2, 0, 0.2, 0.4].map((db) => (
          <g key={`xt-${db}`}>
            <line
              x1={xAt(db)} x2={xAt(db)}
              y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H + 4}
              stroke={COLOR.border.strong} strokeWidth={1}
            />
            <text
              x={xAt(db)}
              y={PAD_TOP + PLOT_H + 18}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={10}
              fill={COLOR.text.tertiary}
            >
              {db > 0 ? `+${db.toFixed(1)}` : db.toFixed(1)}
            </text>
          </g>
        ))}
        <text
          x={PAD_L + PLOT_W / 2}
          y={PAD_TOP + PLOT_H + 36}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.text.tertiary}
          letterSpacing="0.16em"
          style={{ textTransform: 'uppercase' }}
        >
          Δβ (group A − group B)
        </text>

        {/* Y axis */}
        <line
          x1={PAD_L} x2={PAD_L}
          y1={PAD_TOP} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.border.strong} strokeWidth={1}
        />
        {[0, 3, 6, 9, 12].map((lp) => (
          <g key={`yt-${lp}`}>
            <line
              x1={PAD_L} x2={PAD_L - 4}
              y1={yAt(lp)} y2={yAt(lp)}
              stroke={COLOR.border.strong} strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={yAt(lp) + 3}
              textAnchor="end"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={10}
              fill={COLOR.text.tertiary}
            >
              {lp}
            </text>
          </g>
        ))}
        <text
          x={20}
          y={PAD_TOP + PLOT_H / 2}
          transform={`rotate(-90 20 ${PAD_TOP + PLOT_H / 2})`}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.text.tertiary}
          letterSpacing="0.16em"
        >
          −log₁₀(p)
        </text>
      </svg>
    </div>
  );
}
