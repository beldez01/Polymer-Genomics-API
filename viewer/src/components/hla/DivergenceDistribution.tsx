'use client';

import { COLOR, FONT_FAMILY_MONO, TYPE } from '@/config/theme';
import { divergenceHistogram, allelesForLocus, type HLAAllele, pairwiseDivergence } from '@/config/hlaMockData';

interface DivergenceDistributionProps {
  locusId: string;
}

export function DivergenceDistribution({ locusId }: DivergenceDistributionProps) {
  const bins = divergenceHistogram(locusId);
  const alleles = allelesForLocus(locusId);
  const nPairs = alleles.length * (alleles.length - 1) / 2;

  // Compute mean and max pairwise NCDS
  let sum = 0;
  let max = 0;
  for (let i = 0; i < alleles.length; i++) {
    for (let j = i + 1; j < alleles.length; j++) {
      const d = pairwiseDivergence(alleles[i], alleles[j]);
      sum += d;
      if (d > max) max = d;
    }
  }
  const mean = nPairs > 0 ? sum / nPairs : 0;

  const VB_W = 1200;
  const VB_H = 200;
  const PAD_L = 60;
  const PAD_R = 24;
  const PAD_TOP = 16;
  const PAD_BOT = 38;
  const PLOT_W = VB_W - PAD_L - PAD_R;
  const PLOT_H = VB_H - PAD_TOP - PAD_BOT;

  const MAX_AXIS = 0.3;

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: 12,
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="divFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR.primary.base} stopOpacity="0.55" />
            <stop offset="100%" stopColor={COLOR.primary.base} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Histogram */}
        {bins.map((v, i) => {
          const x = PAD_L + (i / bins.length) * PLOT_W;
          const w = PLOT_W / bins.length - 1;
          const h = v * PLOT_H;
          const y = PAD_TOP + PLOT_H - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(w, 0.5)}
              height={h}
              fill="url(#divFill)"
              stroke={COLOR.primary.base}
              strokeWidth={0.3}
              strokeOpacity={0.6}
            />
          );
        })}

        {/* Mean line */}
        <line
          x1={PAD_L + (mean / MAX_AXIS) * PLOT_W}
          x2={PAD_L + (mean / MAX_AXIS) * PLOT_W}
          y1={PAD_TOP}
          y2={PAD_TOP + PLOT_H}
          stroke={COLOR.accent.amber}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={PAD_L + (mean / MAX_AXIS) * PLOT_W + 4}
          y={PAD_TOP + 12}
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fontWeight={600}
          fill={COLOR.accent.amber}
          letterSpacing="0.04em"
        >
          mean {mean.toFixed(3)}
        </text>

        {/* Max line */}
        <line
          x1={PAD_L + (max / MAX_AXIS) * PLOT_W}
          x2={PAD_L + (max / MAX_AXIS) * PLOT_W}
          y1={PAD_TOP}
          y2={PAD_TOP + PLOT_H}
          stroke={COLOR.accent.rose}
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />
        <text
          x={PAD_L + (max / MAX_AXIS) * PLOT_W + 4}
          y={PAD_TOP + 26}
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fontWeight={600}
          fill={COLOR.accent.rose}
          letterSpacing="0.04em"
        >
          max {max.toFixed(3)}
        </text>

        {/* X axis */}
        <line x1={PAD_L} x2={PAD_L + PLOT_W} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H} stroke={COLOR.border.strong} strokeWidth={1} />
        {[0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((v, i) => {
          const x = PAD_L + (v / MAX_AXIS) * PLOT_W;
          const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === 6 ? 'end' : 'middle';
          return (
            <g key={`xt-${i}`}>
              <line x1={x} x2={x} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H + 4} stroke={COLOR.border.strong} strokeWidth={1} />
              <text
                x={x}
                y={PAD_TOP + PLOT_H + 16}
                textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono), monospace"
                fontSize={10}
                fill={COLOR.text.tertiary}
              >
                {v.toFixed(2)}
              </text>
            </g>
          );
        })}
        <text
          x={PAD_L + PLOT_W / 2}
          y={PAD_TOP + PLOT_H + 32}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.text.tertiary}
          letterSpacing="0.16em"
          style={{ textTransform: 'uppercase' }}
        >
          pairwise non-coding divergence · {nPairs} pairs
        </text>

        {/* Y axis label */}
        <text
          x={16}
          y={PAD_TOP + PLOT_H / 2}
          transform={`rotate(-90 16 ${PAD_TOP + PLOT_H / 2})`}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.text.tertiary}
          letterSpacing="0.16em"
        >
          DENSITY
        </text>
      </svg>
    </div>
  );
}
