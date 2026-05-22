'use client';

import { useState } from 'react';
import { FONT_FAMILY, TYPE } from '@/config/theme';

const EVIDENCE_CLASSES: Record<string, { label: string; color: string; bg: string; dashed?: boolean }> = {
  M: { label: 'Measured — direct experimental observation', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  R: { label: 'Reference parameter — published constant', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  D: { label: 'Deterministic — reproducible computation from sequence', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)' },
  S: { label: 'Statistical model — measured data + model assumptions', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  K: { label: 'Curated knowledge — expert-assembled semantic object', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
  H: { label: 'Hypothesis-driven — theory-led, not yet validated', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', dashed: true },
  L: { label: 'Learned estimate — ML/statistical model output', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
};

interface EvidenceBadgeProps {
  evidenceClass: string | null | undefined;
  size?: 'sm' | 'md';
}

export function EvidenceBadge({ evidenceClass, size = 'sm' }: EvidenceBadgeProps) {
  const [hover, setHover] = useState(false);

  if (!evidenceClass) return null;

  const info = EVIDENCE_CLASSES[evidenceClass];
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
        border: `1px ${info.dashed ? 'dashed' : 'solid'} ${info.color}`,
        fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'default',
        flexShrink: 0,
      }}>
        {evidenceClass}
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
