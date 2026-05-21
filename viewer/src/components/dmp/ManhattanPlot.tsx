'use client';

import { COLOR } from '@/config/theme';
import { PROBES, CHR_AXIS, type Probe } from '@/config/methylationMockData';

interface ManhattanPlotProps {
  selectedProbeId?: string;
  onProbeSelect?: (id: string) => void;
}

const Y_MAX = 14;
const GW_SIG = 7.3;

export function ManhattanPlot({ selectedProbeId, onProbeSelect }: ManhattanPlotProps) {
  const VB_W = 1200;
  const VB_H = 320;
  const PAD_L = 70;
  const PAD_R = 24;
  const PAD_TOP = 16;
  const PAD_BOT = 44;
  const PLOT_W = VB_W - PAD_L - PAD_R;
  const PLOT_H = VB_H - PAD_TOP - PAD_BOT;

  // Each probe's x position: chromosome's normalized start + (position/length) * normalized width
  const xAt = (chr: string, pos: number): number | null => {
    const ax = CHR_AXIS.find((c) => c.name === chr);
    if (!ax) return null;
    const frac = ax.start + (pos / ax.length) * (ax.end - ax.start);
    return PAD_L + frac * PLOT_W;
  };
  const yAt = (lp: number) => PAD_TOP + (1 - lp / Y_MAX) * PLOT_H;

  const colorFor = (p: Probe, chrIdx: number): string => {
    if (p.id === selectedProbeId) return COLOR.primary.active;
    if (p.neglogp >= GW_SIG) {
      return p.delta_beta > 0 ? COLOR.primary.base : COLOR.accent.rose;
    }
    return chrIdx % 2 === 0 ? COLOR.text.muted : COLOR.text.faint;
  };

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: 8,
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }}>
        {/* Alternating chromosome bands */}
        {CHR_AXIS.map((c, i) => (
          <rect
            key={c.name}
            x={PAD_L + c.start * PLOT_W}
            y={PAD_TOP}
            width={(c.end - c.start) * PLOT_W}
            height={PLOT_H}
            fill={i % 2 === 0 ? 'transparent' : COLOR.bg.deep}
            fillOpacity={0.4}
          />
        ))}

        {/* gw-sig threshold */}
        <line
          x1={PAD_L} x2={PAD_L + PLOT_W}
          y1={yAt(GW_SIG)} y2={yAt(GW_SIG)}
          stroke={COLOR.accent.rose} strokeWidth={1} strokeDasharray="4 4"
        />
        <text
          x={PAD_L + 4}
          y={yAt(GW_SIG) - 4}
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={9}
          fill={COLOR.accent.rose}
          letterSpacing="0.04em"
        >
          gw-sig
        </text>

        {/* Dots */}
        {PROBES.map((p) => {
          const x = xAt(p.chr, p.position);
          if (x === null) return null;
          const y = yAt(Math.min(p.neglogp, Y_MAX));
          const chrIdx = CHR_AXIS.findIndex((c) => c.name === p.chr);
          const isSig = p.neglogp >= GW_SIG;
          const isSel = p.id === selectedProbeId;
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={isSel ? 4.5 : isSig ? 2.4 : 1.2}
              fill={colorFor(p, chrIdx)}
              fillOpacity={isSel ? 1 : isSig ? 0.85 : 0.45}
              stroke={isSel ? COLOR.bg.white : 'none'}
              strokeWidth={isSel ? 1.5 : 0}
              style={{ cursor: 'pointer' }}
              onClick={() => onProbeSelect?.(p.id)}
            />
          );
        })}

        {/* X axis */}
        <line
          x1={PAD_L} x2={PAD_L + PLOT_W}
          y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.border.strong} strokeWidth={1}
        />

        {/* Chromosome tick labels */}
        {CHR_AXIS.map((c) => {
          const mid = PAD_L + ((c.start + c.end) / 2) * PLOT_W;
          const label = c.name.replace('chr', '');
          // Skip every other label for narrow chromosomes
          return (
            <text
              key={`xc-${c.name}`}
              x={mid}
              y={PAD_TOP + PLOT_H + 16}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains-mono), monospace"
              fontSize={9}
              fill={COLOR.text.tertiary}
              letterSpacing="0.02em"
            >
              {label}
            </text>
          );
        })}
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
          Chromosome
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
