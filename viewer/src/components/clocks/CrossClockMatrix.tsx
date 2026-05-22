'use client';

import { COLOR, FONT_FAMILY_MONO, TYPE, WEIGHT } from '@/config/theme';
import { CLOCKS, OVERLAP_MATRIX } from '@/config/clocksMockData';

const CELL = 56;
const HEADER_W = 80;
const VB_W = HEADER_W + CELL * CLOCKS.length;
const VB_H = HEADER_W + CELL * CLOCKS.length;

export function CrossClockMatrix() {
  // Color the cell by overlap intensity — electric blue scaled by value.
  const cellFill = (v: number, isDiag: boolean): string => {
    if (isDiag) return COLOR.primary.base;
    const t = Math.min(1, v / 35);  // saturate at ~35% overlap
    return `rgba(15, 98, 254, ${(0.04 + t * 0.55).toFixed(3)})`;
  };
  const cellText = (v: number, isDiag: boolean): string => {
    if (isDiag) return COLOR.bg.white;
    return v >= 25 ? COLOR.bg.white : v >= 10 ? COLOR.primary.active : COLOR.text.tertiary;
  };

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: 24,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ maxWidth: 560, display: 'block' }}>
        {/* Column headers (top) */}
        {CLOCKS.map((c, i) => (
          <text
            key={`col-${c.id}`}
            x={HEADER_W + CELL * i + CELL / 2}
            y={HEADER_W - 12}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontSize={11}
            fontWeight={500}
            fill={COLOR.text.secondary}
            letterSpacing="0.04em"
          >
            {c.name.length > 7 ? c.name.slice(0, 7) : c.name}
          </text>
        ))}

        {/* Row headers (left) */}
        {CLOCKS.map((c, i) => (
          <text
            key={`row-${c.id}`}
            x={HEADER_W - 12}
            y={HEADER_W + CELL * i + CELL / 2 + 4}
            textAnchor="end"
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontSize={11}
            fontWeight={500}
            fill={COLOR.text.secondary}
            letterSpacing="0.04em"
          >
            {c.name.length > 9 ? c.name.slice(0, 9) : c.name}
          </text>
        ))}

        {/* Matrix cells */}
        {OVERLAP_MATRIX.map((row, i) =>
          row.map((v, j) => {
            const isDiag = i === j;
            return (
              <g key={`cell-${i}-${j}`}>
                <rect
                  x={HEADER_W + CELL * j + 2}
                  y={HEADER_W + CELL * i + 2}
                  width={CELL - 4}
                  height={CELL - 4}
                  fill={cellFill(v, isDiag)}
                  stroke={COLOR.border.subtle}
                  strokeWidth={1}
                />
                <text
                  x={HEADER_W + CELL * j + CELL / 2}
                  y={HEADER_W + CELL * i + CELL / 2 + 4}
                  textAnchor="middle"
                  fontFamily="var(--font-jetbrains-mono), monospace"
                  fontSize={12}
                  fontWeight={isDiag ? 700 : 500}
                  fill={cellText(v, isDiag)}
                >
                  {v}
                </text>
              </g>
            );
          })
        )}

        {/* Legend caption */}
        <text
          x={VB_W / 2}
          y={VB_H - 6}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontSize={10}
          fill={COLOR.text.faint}
          letterSpacing="0.08em"
        >
          % of probes shared (smaller set / both)
        </text>
      </svg>
    </div>
  );
}
