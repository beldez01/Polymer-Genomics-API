'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import type { CpgIsland } from '@/config/evaluateMockData';

interface CpgIslandTableProps {
  islands: CpgIsland[];
}

const HEADERS: Array<{ key: string; label: string; align: 'left' | 'right' }> = [
  { key: 'region', label: 'Region',  align: 'left'  },
  { key: 'length', label: 'Length',  align: 'right' },
  { key: 'gc',     label: 'GC',      align: 'right' },
  { key: 'oe',     label: 'O/E CpG', align: 'right' },
  { key: 'count',  label: 'CpG #',   align: 'right' },
];

export function CpgIslandTable({ islands }: CpgIslandTableProps) {
  if (islands.length === 0) {
    return (
      <div style={{
        color: COLOR.text.muted,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        padding: `${SPACE[3]}px 0`,
      }}>
        No CpG islands detected.
      </div>
    );
  }

  return (
    <div style={{
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
      }}>
        <thead>
          <tr style={{ backgroundColor: COLOR.bg.elevated }}>
            {HEADERS.map((h) => (
              <th key={h.key}
                style={{
                  textAlign: h.align,
                  padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
                  color: COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.xs.fontSize,
                  fontWeight: WEIGHT.medium,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  borderBottom: `1px solid ${COLOR.border.subtle}`,
                  whiteSpace: 'nowrap',
                }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {islands.map((isl, i) => (
            <tr key={i} style={{
              borderBottom: i === islands.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
            }}>
              <td style={cellStyle('left')}>
                <span style={{ color: COLOR.primary.base, fontFamily: FONT_FAMILY_MONO, fontWeight: WEIGHT.medium }}>
                  {isl.start}–{isl.end}
                </span>
              </td>
              <td className="tabular" style={cellStyle('right', FONT_FAMILY_MONO)}>{isl.length_bp} bp</td>
              <td className="tabular" style={cellStyle('right', FONT_FAMILY_MONO)}>{(isl.gc * 100).toFixed(1)} %</td>
              <td className="tabular" style={cellStyle('right', FONT_FAMILY_MONO)}>{isl.obs_exp_cpg.toFixed(2)}</td>
              <td className="tabular" style={cellStyle('right', FONT_FAMILY_MONO)}>{isl.cpg_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellStyle(align: 'left' | 'right', family = FONT_FAMILY): React.CSSProperties {
  return {
    textAlign: align,
    padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
    color: COLOR.text.primary,
    fontFamily: family,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.01em',
  };
}
