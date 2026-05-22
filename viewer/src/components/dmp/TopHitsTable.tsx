'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { TOP_HITS, type Probe } from '@/config/methylationMockData';

interface TopHitsTableProps {
  selectedProbeId?: string;
  onProbeSelect?: (id: string) => void;
}

function formatPValue(neglogp: number): string {
  // Convert -log10(p) back to p with one sig fig + scientific
  const p = Math.pow(10, -neglogp);
  return p.toExponential(1).replace('e', 'e');
}

const HEADERS: Array<{ key: keyof Probe | 'pos' | 'pval' | 'sig'; label: string; align: 'left' | 'right' }> = [
  { key: 'id',         label: 'Probe',    align: 'left'  },
  { key: 'pos',        label: 'Position', align: 'left'  },
  { key: 'gene',       label: 'Gene',     align: 'left'  },
  { key: 'context',    label: 'Context',  align: 'left'  },
  { key: 'delta_beta', label: 'Δβ',       align: 'right' },
  { key: 'pval',       label: 'p',        align: 'right' },
  { key: 'sig',        label: '',         align: 'right' },
];

export function TopHitsTable({ selectedProbeId, onProbeSelect }: TopHitsTableProps) {
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
              <th key={h.key as string}
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
          {TOP_HITS.map((p, i) => {
            const isSel = p.id === selectedProbeId;
            return (
              <tr
                key={p.id}
                onClick={() => onProbeSelect?.(p.id)}
                style={{
                  borderBottom: i === TOP_HITS.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
                  backgroundColor: isSel ? COLOR.bg.deep : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = COLOR.bg.deep; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td style={cellMono('left')}>
                  <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.medium }}>
                    {p.id}
                  </span>
                </td>
                <td style={cellMono('left')}>
                  <span style={{ color: COLOR.text.secondary }}>
                    {p.chr}:{p.position.toLocaleString()}
                  </span>
                </td>
                <td style={cell('left')}>
                  <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>
                    {p.gene ?? '—'}
                  </span>
                </td>
                <td style={cellMono('left')}>
                  <span style={{ color: COLOR.text.tertiary, letterSpacing: '0.04em' }}>
                    {p.context ?? '—'}
                  </span>
                </td>
                <td className="tabular" style={cellMono('right')}>
                  <span style={{
                    color: p.delta_beta > 0 ? COLOR.primary.base : COLOR.accent.rose,
                    fontWeight: WEIGHT.semibold,
                  }}>
                    {p.delta_beta > 0 ? '+' : ''}{p.delta_beta.toFixed(3)}
                  </span>
                </td>
                <td className="tabular" style={cellMono('right')}>
                  {formatPValue(p.neglogp)}
                </td>
                <td style={cell('right')}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 6px',
                    backgroundColor: p.delta_beta > 0 ? `${COLOR.primary.base}1F` : `${COLOR.accent.rose}1F`,
                    color: p.delta_beta > 0 ? COLOR.primary.base : COLOR.accent.rose,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: 10,
                    fontWeight: WEIGHT.semibold,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    borderRadius: 2,
                  }}>
                    {p.delta_beta > 0 ? 'Hyper' : 'Hypo'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function cell(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
    color: COLOR.text.primary,
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.01em',
  };
}

function cellMono(align: 'left' | 'right'): React.CSSProperties {
  return {
    ...cell(align),
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.xs.fontSize,
  };
}
