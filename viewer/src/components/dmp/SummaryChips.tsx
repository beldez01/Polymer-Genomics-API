'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { SUMMARY } from '@/config/methylationMockData';

interface ChipProps {
  label: string;
  value: string;
  sub?: string;
  emphasize?: boolean;
  color?: string;
}

function Chip({ label, value, sub, emphasize, color }: ChipProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${emphasize ? COLOR.primary.base : COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${SPACE[3]}px ${SPACE[4]}px`,
      minWidth: 132,
    }}>
      <span style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span className="tabular" style={{
        color: color ?? (emphasize ? COLOR.primary.base : COLOR.text.primary),
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.lg.fontSize,
        fontWeight: WEIGHT.semibold,
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: 10,
          letterSpacing: '0.04em',
        }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function SummaryChips() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[3] }}>
      <Chip
        label="Probes tested"
        value={SUMMARY.total.toLocaleString()}
        sub="EPIC v2 platform"
      />
      <Chip
        label="Significant"
        value={SUMMARY.sig.toLocaleString()}
        sub={`${(SUMMARY.sig / SUMMARY.total * 100).toFixed(1)} % @ gw-sig`}
        emphasize
      />
      <Chip
        label="Hyper-methyl."
        value={SUMMARY.hyper.toLocaleString()}
        sub="Δβ > +0.05"
        color={COLOR.primary.base}
      />
      <Chip
        label="Hypo-methyl."
        value={SUMMARY.hypo.toLocaleString()}
        sub="Δβ < −0.05"
        color={COLOR.accent.rose}
      />
      <Chip
        label="⟨Δβ⟩"
        value={`${SUMMARY.meanDeltaBeta >= 0 ? '+' : ''}${SUMMARY.meanDeltaBeta.toFixed(3)}`}
        sub="mean across all"
      />
    </div>
  );
}
