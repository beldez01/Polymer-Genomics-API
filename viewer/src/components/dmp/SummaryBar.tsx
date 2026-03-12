'use client';

import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import type { DMPSummary } from '@/lib/dmp/types';

interface SummaryBarProps {
  summary: DMPSummary;
  filename: string;
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[1],
    }}>
      <span style={{
        ...COMPONENT.sectionHeader,
        fontSize: TYPE.xs.fontSize,
      }}>
        {label}
      </span>
      <span style={{
        color: color || COLOR.text.primary,
        fontSize: TYPE.md.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.bold,
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

export function SummaryBar({ summary, filename }: SummaryBarProps) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: `${SPACE[3]}px ${SPACE[4]}px`,
      display: 'flex',
      alignItems: 'center',
      gap: SPACE[8],
      flexWrap: 'wrap',
    }}>
      <div style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        marginRight: SPACE[4],
        maxWidth: 200,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {filename}
      </div>

      <StatBox label="TOTAL" value={summary.total} />
      <StatBox label="SIGNIFICANT" value={summary.significant} color={COLOR.accent.teal} />
      <StatBox label="HYPER" value={summary.hyper} color={COLOR.accent.rose} />
      <StatBox label="HYPO" value={summary.hypo} color={COLOR.accent.teal} />
      <StatBox label="LAMBDA" value={summary.lambda.toFixed(3)} />
      <StatBox
        label="DELTA BETA RANGE"
        value={`${summary.deltaBetaMin.toFixed(3)} to ${summary.deltaBetaMax.toFixed(3)}`}
      />
    </div>
  );
}
