'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import type { Clock } from '@/config/clocksMockData';

interface ClockAnatomyProps {
  clock: Clock;
}

interface KVProps { label: string; value: React.ReactNode; mono?: boolean }
function KV({ label, value, mono }: KVProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: 10,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span
        className={mono ? 'tabular' : undefined}
        style={{
          color: COLOR.text.primary,
          fontFamily: mono ? FONT_FAMILY_MONO : FONT_FAMILY,
          fontSize: TYPE.base.fontSize,
          fontWeight: WEIGHT.medium,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function ClockAnatomy({ clock }: ClockAnatomyProps) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: SPACE[5],
    }}>
      {/* Title */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[3],
        paddingBottom: SPACE[3],
        borderBottom: `1px solid ${COLOR.border.strong}`,
        marginBottom: SPACE[5],
      }}>
        <span style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.lg.fontSize,
          fontWeight: WEIGHT.bold,
          letterSpacing: '-0.01em',
        }}>
          {clock.name}
        </span>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.04em',
        }}>
          {clock.citation}
        </span>
        <span style={{ flex: 1 }} />
        <span className="tabular" style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.04em',
        }}>
          RMSE ± {clock.rmseYears.toFixed(1)} {clock.unit === 'pace' ? 'yr/yr' : 'yr'}
        </span>
      </div>

      {/* Header KVs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: SPACE[5],
        marginBottom: SPACE[5],
      }}>
        <KV label="Probes" value={clock.probes.toLocaleString()} mono />
        <KV label="Tissue" value={clock.tissue} />
        <KV label="Type"   value={clock.type} />
        <KV label="Hyper / hypo" value={`${clock.hyperPct} / ${100 - clock.hyperPct}`} mono />
      </div>

      {/* Hyper/hypo bar */}
      <div style={{
        height: 6,
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        marginBottom: SPACE[5],
      }}>
        <div style={{
          width: `${clock.hyperPct}%`,
          backgroundColor: COLOR.primary.base,
        }} />
        <div style={{
          width: `${100 - clock.hyperPct}%`,
          backgroundColor: COLOR.accent.rose,
        }} />
      </div>

      {/* Top probes table */}
      <div style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        marginBottom: SPACE[2],
      }}>
        Top weighted probes
      </div>

      <div style={{
        border: `1px solid ${COLOR.border.subtle}`,
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
            <tr style={{ backgroundColor: COLOR.bg.primary }}>
              {['Probe', 'Position', 'Gene', 'Coefficient', 'Mean β'].map((h, i) => (
                <th key={h}
                  style={{
                    textAlign: i < 3 ? 'left' : 'right',
                    padding: `${SPACE[2]}px ${SPACE[3] + 2}px`,
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: 10,
                    fontWeight: WEIGHT.medium,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    borderBottom: `1px solid ${COLOR.border.subtle}`,
                    whiteSpace: 'nowrap',
                  }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clock.topProbes.map((p, i) => (
              <tr key={p.cgId} style={{
                borderBottom: i === clock.topProbes.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
              }}>
                <td style={tdMono('left')}>
                  <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.medium }}>
                    {p.cgId}
                  </span>
                </td>
                <td style={tdMono('left')}>{p.chr}:{p.position.toLocaleString()}</td>
                <td style={td('left')}>
                  <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>
                    {p.gene ?? '—'}
                  </span>
                </td>
                <td className="tabular" style={tdMono('right')}>
                  <span style={{
                    color: p.coefficient > 0 ? COLOR.primary.base : COLOR.accent.rose,
                    fontWeight: WEIGHT.semibold,
                  }}>
                    {p.coefficient > 0 ? '+' : ''}{p.coefficient.toFixed(3)}
                  </span>
                </td>
                <td className="tabular" style={tdMono('right')}>{p.meanBeta.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function td(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    padding: `${SPACE[2]}px ${SPACE[3] + 2}px`,
    color: COLOR.text.primary,
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.sm.fontSize,
  };
}

function tdMono(align: 'left' | 'right'): React.CSSProperties {
  return { ...td(align), fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize };
}
