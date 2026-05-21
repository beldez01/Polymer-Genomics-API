'use client';

import { COLOR, FONT_FAMILY_MONO } from '@/config/theme';
import { AGE_HISTOGRAM } from '@/config/transposomeMockData';

export function AgeHistogram() {
  const VB_W = 1200;
  const VB_H = 220;
  const PAD_L = 50;
  const PAD_R = 24;
  const PAD_TOP = 16;
  const PAD_BOT = 38;
  const PLOT_W = VB_W - PAD_L - PAD_R;
  const PLOT_H = VB_H - PAD_TOP - PAD_BOT;

  const bins = AGE_HISTOGRAM;
  const maxAge = bins[bins.length - 1].ageEnd;

  const xAt = (mya: number) => PAD_L + (mya / maxAge) * PLOT_W;
  const yAt = (d: number) => PAD_TOP + (1 - d) * PLOT_H;

  // X-axis ticks at key evolutionary points
  const xTicks = [
    { mya: 0,   label: '0',   sub: 'today' },
    { mya: 6,   label: '6',   sub: 'human-chimp' },
    { mya: 25,  label: '25',  sub: 'apes' },
    { mya: 65,  label: '65',  sub: 'K-Pg' },
    { mya: 100, label: '100' },
    { mya: 150, label: '150' },
    { mya: 200, label: '200', sub: 'pre-mammal' },
  ];

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: 12,
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={COLOR.primary.base} stopOpacity="0.55" />
            <stop offset="100%" stopColor={COLOR.primary.base} stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Histogram bars */}
        {bins.map((b, i) => {
          const x = xAt(b.ageStart);
          const w = xAt(b.ageEnd) - x - 1;
          const y = yAt(b.density);
          const h = PAD_TOP + PLOT_H - y;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={Math.max(w, 0.5)}
              height={h}
              fill="url(#ageFill)"
              stroke={COLOR.primary.base}
              strokeWidth={0.3}
              strokeOpacity={0.7}
            />
          );
        })}

        {/* Annotations: peaks */}
        <line
          x1={xAt(10)} x2={xAt(10)}
          y1={yAt(1) - 6} y2={yAt(1) - 22}
          stroke={COLOR.primary.base}
          strokeWidth={1}
        />
        <text
          x={xAt(10)} y={yAt(1) - 26}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fontWeight={600}
          fill={COLOR.primary.base}
          letterSpacing="0.04em"
        >
          recent · L1HS · AluY · HERV-K
        </text>

        <line
          x1={xAt(110)} x2={xAt(110)}
          y1={yAt(0.45) - 6} y2={yAt(0.45) - 22}
          stroke={COLOR.text.tertiary}
          strokeWidth={1}
        />
        <text
          x={xAt(110)} y={yAt(0.45) - 26}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fontWeight={500}
          fill={COLOR.text.tertiary}
          letterSpacing="0.04em"
        >
          ancient · L2 · MIR
        </text>

        {/* X axis */}
        <line
          x1={PAD_L} x2={PAD_L + PLOT_W}
          y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H}
          stroke={COLOR.border.strong} strokeWidth={1}
        />
        {xTicks.map((tk, i) => {
          const x = xAt(tk.mya);
          const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle';
          return (
            <g key={`xt-${i}`}>
              <line x1={x} x2={x} y1={PAD_TOP + PLOT_H} y2={PAD_TOP + PLOT_H + 4} stroke={COLOR.border.strong} strokeWidth={1} />
              <text
                x={x} y={PAD_TOP + PLOT_H + 16} textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono), monospace" fontSize={10} fill={COLOR.text.tertiary}
              >
                {tk.label}
              </text>
              {tk.sub && (
                <text
                  x={x} y={PAD_TOP + PLOT_H + 28} textAnchor={anchor}
                  fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill={COLOR.text.faint}
                  letterSpacing="0.04em"
                >
                  {tk.sub}
                </text>
              )}
            </g>
          );
        })}
        <text
          x={PAD_L + PLOT_W} y={PAD_TOP - 2} textAnchor="end"
          fontFamily="var(--font-jetbrains-mono), monospace" fontSize={9} fill={COLOR.text.faint}
          letterSpacing="0.08em"
        >
          MYA
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
