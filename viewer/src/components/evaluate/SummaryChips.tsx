'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import type { EvalResult } from '@/config/evaluateMockData';

interface SummaryChipsProps {
  result: EvalResult;
}

interface ChipProps {
  label: string;
  value: string;
  sub?: string;
  emphasize?: boolean;
}

function Chip({ label, value, sub, emphasize }: ChipProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${emphasize ? COLOR.primary.base : COLOR.border.strong}`,
      borderRadius: 2,
      padding: `${SPACE[3]}px ${SPACE[4]}px`,
      minWidth: 116,
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
        color: emphasize ? COLOR.primary.base : COLOR.text.primary,
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

export function SummaryChips({ result }: SummaryChipsProps) {
  const { summary, flag_counts } = result;
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: SPACE[3],
    }}>
      <Chip
        label="GC content"
        value={`${(summary.gc_content * 100).toFixed(1)} %`}
        sub="balanced 40–60"
      />
      <Chip
        label="CpG count"
        value={summary.cpg_count.toString()}
        sub={`${summary.cpg_density.toFixed(1)} per kb`}
      />
      <Chip
        label="Tm est."
        value={`${summary.melting_temp_estimate_C.toFixed(1)} °C`}
        sub="50 mM Na⁺"
      />
      <Chip
        label="⟨ΔG₃₇⟩"
        value={summary.mean_stacking_dG37_kcal.toFixed(2)}
        sub="kcal/mol · per stack"
      />
      <Chip
        label="Flags"
        value={flag_counts.total.toString()}
        sub={`${flag_counts.warnings} warn · ${flag_counts.info} info`}
        emphasize
      />
    </div>
  );
}
