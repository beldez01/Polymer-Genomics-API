'use client';

import { COLOR, TYPE, FONT_FAMILY, SPACE } from '@/config/theme';
import type { RiskLevel } from '@/lib/te-methylation/types';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e',
  moderate: '#f59e0b',
  elevated: '#f97316',
  high: '#ef4444',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  high: 'High',
};

interface Props {
  level: RiskLevel;
  risk: number;
  compact?: boolean;
}

export function StoplightBar({ level, risk, compact = false }: Props) {
  const color = RISK_COLORS[level];
  const maxWidth = compact ? 48 : 72;
  const barWidth = Math.max(4, risk * maxWidth / 0.6); // scale 0-0.6 → 0-maxWidth

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
      <div style={{
        width: maxWidth,
        height: compact ? 6 : 8,
        background: `${COLOR.border.subtle}40`,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          width: Math.min(barWidth, maxWidth),
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>
      {!compact && (
        <span style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.xs.fontSize,
          color,
          fontWeight: 500,
          minWidth: 56,
        }}>
          {RISK_LABELS[level]}
        </span>
      )}
    </div>
  );
}
