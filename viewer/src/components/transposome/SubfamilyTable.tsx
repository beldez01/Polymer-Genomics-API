'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { SUBFAMILIES, SUPERFAMILY_COLOR, type Superfamily } from '@/config/transposomeMockData';

interface SubfamilyTableProps {
  filterSuperfamily: Superfamily | 'all';
}

const HEADERS: Array<{ key: string; label: string; align: 'left' | 'right' }> = [
  { key: 'family', label: 'Family',      align: 'left'  },
  { key: 'blurb',  label: 'Blurb',       align: 'left'  },
  { key: 'count',  label: 'Copies',      align: 'right' },
  { key: 'age',    label: 'Mean age',    align: 'right' },
  { key: 'beta',   label: '⟨β⟩',         align: 'right' },
  { key: 'probes', label: 'EPIC probes', align: 'right' },
  { key: 'awak',   label: 'Awakening',   align: 'right' },
];

export function SubfamilyTable({ filterSuperfamily }: SubfamilyTableProps) {
  const rows = filterSuperfamily === 'all'
    ? SUBFAMILIES
    : SUBFAMILIES.filter((s) => s.superfamily === filterSuperfamily);

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
              }}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const sfColor = SUPERFAMILY_COLOR[s.superfamily];
            return (
              <tr key={s.name} style={{
                borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
              }}>
                <td style={td('left')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
                    <span style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      backgroundColor: sfColor,
                      flexShrink: 0,
                    }} />
                    <span style={{ color: COLOR.text.primary, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.sm.fontSize, fontWeight: WEIGHT.semibold }}>
                      {s.name}
                    </span>
                    <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      {s.superfamily}
                    </span>
                  </div>
                </td>
                <td style={td('left')}>
                  <span style={{ color: COLOR.text.secondary }}>{s.blurb}</span>
                </td>
                <td className="tabular" style={tdMono('right')}>
                  {s.count.toLocaleString()}
                </td>
                <td className="tabular" style={tdMono('right')}>
                  {s.meanAgeMya.toFixed(0)} MYA
                </td>
                <td className="tabular" style={tdMono('right')}>
                  {s.meanBeta.toFixed(2)}
                </td>
                <td className="tabular" style={tdMono('right')}>
                  {s.epicProbes.toLocaleString()}
                </td>
                <td style={td('right')}>
                  <AwakeningBar value={s.awakening} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AwakeningBar({ value }: { value: number }) {
  const color = value > 0.7 ? COLOR.accent.rose : value > 0.4 ? COLOR.accent.amber : COLOR.text.tertiary;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: SPACE[2],
      justifyContent: 'flex-end',
    }}>
      <div style={{
        width: 60,
        height: 6,
        backgroundColor: COLOR.bg.deep,
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${value * 100}%`,
          height: '100%',
          backgroundColor: color,
        }} />
      </div>
      <span className="tabular" style={{
        color,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        fontWeight: WEIGHT.semibold,
        minWidth: 36,
        textAlign: 'right',
      }}>
        {value.toFixed(2)}
      </span>
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
