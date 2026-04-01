'use client';

import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import type { TEMethylationAnalysis } from '@/lib/te-methylation/types';

interface Props {
  analysis: TEMethylationAnalysis;
}

export function SummaryStats({ analysis }: Props) {
  const highRisk = analysis.familyScores.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'elevated').length;

  const stats = [
    { label: 'Platform', value: analysis.platform.toUpperCase().replace('_', ' ') },
    { label: 'Input probes', value: analysis.totalInputProbes.toLocaleString() },
    { label: 'TE probes scored', value: analysis.teProbesScored.toLocaleString() },
    { label: 'TE fraction', value: `${(analysis.teFraction * 100).toFixed(1)}%` },
    { label: 'Families scored', value: String(analysis.familyScores.length) },
    {
      label: 'Elevated/high risk',
      value: String(highRisk),
      color: highRisk > 0 ? COLOR.accent.rose : COLOR.accent.teal,
    },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: SPACE[5],
      flexWrap: 'wrap',
      padding: `${SPACE[3]}px ${SPACE[4]}px`,
      border: `1px solid ${COLOR.border.subtle}`,
      borderRadius: 8,
      background: COLOR.bg.primary,
    }}>
      {stats.map((s) => (
        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xs.fontSize,
            color: COLOR.text.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {s.label}
          </span>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            fontWeight: WEIGHT.bold,
            color: (s as any).color ?? COLOR.text.primary,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
