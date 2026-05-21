'use client';

import { useState } from 'react';
import { FONT_FAMILY, TYPE } from '@/config/theme';

const TIERS: Record<string, { label: string; abbrev: string; color: string; bg: string }> = {
  intrinsic:   { label: 'Intrinsic — sequence-determined, equilibrium physics', abbrev: 'I', color: '#71717a', bg: 'rgba(113, 113, 122, 0.12)' },
  constrained: { label: 'Constrained — chemically modified, capacity intrinsic', abbrev: 'C', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' },
  active:      { label: 'Active — non-equilibrium, requires free energy flux', abbrev: 'A', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
};

interface TierBadgeProps {
  tier: string | null | undefined;
  size?: 'sm' | 'md';
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const [hover, setHover] = useState(false);

  if (!tier) return null;

  const info = TIERS[tier];
  if (!info) return null;

  const px = size === 'sm' ? 14 : 18;
  const fontSize = size === 'sm' ? TYPE.xs.fontSize - 1 : TYPE.xs.fontSize;

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        borderRadius: px / 2,
        backgroundColor: info.bg,
        color: info.color,
        border: `1px solid ${info.color}`,
        fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'default',
        flexShrink: 0,
      }}>
        {info.abbrev}
      </span>
      {hover && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 4,
          padding: '4px 8px',
          backgroundColor: '#FAFAFA',
          color: '#E0E0E0',
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          whiteSpace: 'nowrap',
          borderRadius: 4,
          border: '1px solid #333',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          {info.label}
        </span>
      )}
    </span>
  );
}
