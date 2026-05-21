'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { AWAKENING_RISK } from '@/config/transposomeMockData';

const HEADERS = [
  { key: 'family',  label: 'Family',     align: 'left'  as const },
  { key: 'pos',     label: 'Position',   align: 'left'  as const },
  { key: 'len',     label: 'Length',     align: 'right' as const },
  { key: 'age',     label: 'Age',        align: 'right' as const },
  { key: 'beta',    label: 'β',          align: 'right' as const },
  { key: 'context', label: 'Context',    align: 'left'  as const },
  { key: 'risk',    label: 'Awakening',  align: 'right' as const },
];

export function AwakeningPanel() {
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
          {AWAKENING_RISK.map((r, i) => {
            const riskColor = r.awakening > 0.85 ? COLOR.accent.rose : r.awakening > 0.7 ? COLOR.accent.amber : COLOR.text.tertiary;
            return (
              <tr key={`${r.chr}-${r.position}`} style={{
                borderBottom: i === AWAKENING_RISK.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
              }}>
                <td style={td('left')}>
                  <span style={{
                    color: COLOR.text.primary,
                    fontFamily: FONT_FAMILY_MONO,
                    fontWeight: WEIGHT.semibold,
                  }}>
                    {r.family}
                  </span>
                </td>
                <td style={tdMono('left')}>
                  <span style={{ color: COLOR.primary.base }}>{r.chr}:{r.position.toLocaleString()}</span>
                </td>
                <td className="tabular" style={tdMono('right')}>{r.length.toLocaleString()} bp</td>
                <td className="tabular" style={tdMono('right')}>{r.ageMya.toFixed(1)} MYA</td>
                <td className="tabular" style={tdMono('right')}>{r.meanBeta.toFixed(2)}</td>
                <td style={td('left')}>
                  <span style={{ color: COLOR.text.secondary }}>{r.context}</span>
                </td>
                <td style={td('right')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE[2], justifyContent: 'flex-end' }}>
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
                        width: `${r.awakening * 100}%`,
                        height: '100%',
                        backgroundColor: riskColor,
                      }} />
                    </div>
                    <span className="tabular" style={{
                      color: riskColor,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: TYPE.xs.fontSize,
                      fontWeight: WEIGHT.semibold,
                      minWidth: 36,
                      textAlign: 'right',
                    }}>
                      {r.awakening.toFixed(2)}
                    </span>
                  </div>
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
