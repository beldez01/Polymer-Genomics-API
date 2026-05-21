'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { allelesForLocus, type HLAAllele } from '@/config/hlaMockData';

interface AlleleTableProps {
  locusId: string;
  selectedNames: [string | null, string | null];
  onSelect: (name: string) => void;
}

const HEADERS: Array<{ key: string; label: string; align: 'left' | 'right' }> = [
  { key: 'name',   label: 'Allele',         align: 'left'  },
  { key: 'full',   label: 'IMGT name',      align: 'left'  },
  { key: 'pop',    label: 'Population',     align: 'left'  },
  { key: 'expr',   label: 'Expression',     align: 'left'  },
  { key: 'pid',    label: 'Coding ID',      align: 'right' },
  { key: 'ncds',   label: 'NCDS',           align: 'right' },
  { key: 'disease',label: 'Notable',        align: 'left'  },
];

function exprPill(tier: HLAAllele['expression']): { bg: string; fg: string; label: string } {
  if (tier === 'high')   return { bg: `${COLOR.primary.base}1F`,  fg: COLOR.primary.base,  label: 'HIGH'   };
  if (tier === 'medium') return { bg: `${COLOR.accent.amber}1F`, fg: COLOR.accent.amber, label: 'MED'   };
  return                       { bg: `${COLOR.accent.rose}1F`,   fg: COLOR.accent.rose,  label: 'LOW'   };
}

export function AlleleTable({ locusId, selectedNames, onSelect }: AlleleTableProps) {
  const rows = allelesForLocus(locusId).slice().sort((a, b) => b.globalFreq - a.globalFreq);

  return (
    <div style={{
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize }}>
        <thead>
          <tr style={{ backgroundColor: COLOR.bg.elevated }}>
            {HEADERS.map((h) => (
              <th key={h.key} style={{
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
              }}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => {
            const pill = exprPill(a.expression);
            const isSel = selectedNames[0] === a.name || selectedNames[1] === a.name;
            const selIdx = selectedNames[0] === a.name ? 0 : selectedNames[1] === a.name ? 1 : -1;
            return (
              <tr
                key={a.fullName}
                onClick={() => onSelect(a.name)}
                style={{
                  borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
                  backgroundColor: isSel ? COLOR.bg.deep : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = COLOR.bg.deep; }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td style={td('left')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE[2] }}>
                    {selIdx >= 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: 2,
                        backgroundColor: selIdx === 0 ? COLOR.primary.base : COLOR.accent.violet,
                        color: COLOR.bg.white,
                        fontFamily: FONT_FAMILY_MONO,
                        fontSize: 10,
                        fontWeight: WEIGHT.semibold,
                      }}>
                        {selIdx === 0 ? 'A' : 'B'}
                      </span>
                    )}
                    <span style={{ color: COLOR.text.primary, fontFamily: FONT_FAMILY_MONO, fontWeight: WEIGHT.semibold }}>
                      {a.name}
                    </span>
                  </span>
                </td>
                <td style={tdMono('left')}>
                  <span style={{ color: COLOR.text.tertiary }}>{a.fullName}</span>
                </td>
                <td style={tdMono('left')}>
                  <span style={{ color: COLOR.text.secondary }}>{a.population}</span>
                </td>
                <td style={td('left')}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: pill.bg,
                    color: pill.fg,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: 10,
                    fontWeight: WEIGHT.semibold,
                    letterSpacing: '0.14em',
                    borderRadius: 2,
                  }}>
                    {pill.label}
                  </span>
                </td>
                <td className="tabular" style={tdMono('right')}>{a.coding_id.toFixed(1)} %</td>
                <td className="tabular" style={tdMono('right')}>
                  <span style={{
                    color: a.ncds === 0 ? COLOR.text.faint : a.ncds > 0.1 ? COLOR.accent.amber : COLOR.text.primary,
                    fontWeight: WEIGHT.semibold,
                  }}>
                    {a.ncds.toFixed(3)}
                  </span>
                </td>
                <td style={td('left')}>
                  <span style={{
                    color: a.disease ? COLOR.accent.rose : COLOR.text.faint,
                    fontFamily: a.disease ? FONT_FAMILY : FONT_FAMILY_MONO,
                    fontSize: TYPE.xs.fontSize,
                  }}>
                    {a.disease ?? '—'}
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

function td(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
    color: COLOR.text.primary,
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.sm.fontSize,
  };
}

function tdMono(align: 'left' | 'right'): React.CSSProperties {
  return { ...td(align), fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize };
}
