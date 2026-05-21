'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import type { EvalFlag } from '@/config/evaluateMockData';

interface FlagListProps {
  flags: EvalFlag[];
}

export function FlagList({ flags }: FlagListProps) {
  if (flags.length === 0) {
    return (
      <div style={{
        color: COLOR.text.muted,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
      }}>
        No flags raised.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {flags.map((f, i) => {
        const isWarning = f.type === 'warning';
        const accent = isWarning ? COLOR.accent.rose : COLOR.primary.base;
        return (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '4px 60px 100px 160px 1fr',
            columnGap: SPACE[3],
            alignItems: 'center',
            paddingTop: SPACE[2],
            paddingBottom: SPACE[2],
            paddingRight: SPACE[3],
            backgroundColor: COLOR.bg.elevated,
            borderRadius: 2,
            border: `1px solid ${COLOR.border.subtle}`,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Severity strip */}
            <div style={{
              alignSelf: 'stretch',
              backgroundColor: accent,
            }} />

            {/* Severity badge */}
            <span style={{
              color: accent,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.semibold,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}>
              {isWarning ? 'Warn' : 'Info'}
            </span>

            {/* Region */}
            <span className="tabular" style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}>
              {f.region}
            </span>

            {/* Code */}
            <span style={{
              color: COLOR.text.primary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.semibold,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {f.code}
            </span>

            {/* Message */}
            <span style={{
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              letterSpacing: '0.01em',
              lineHeight: 1.45,
            }}>
              {f.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
