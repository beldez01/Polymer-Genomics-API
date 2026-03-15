'use client';

import { FONT_FAMILY } from '@/config/theme';
import type { SilencingBreakdown } from '@/lib/transposome-types';

interface SilencingBarProps {
  breakdown: SilencingBreakdown[];
}

export function SilencingBar({ breakdown }: SilencingBarProps) {
  return (
    <div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, marginBottom: 4 }}>
        {breakdown.map((seg, i) => (
          <div key={i} style={{ height: '100%', width: `${seg.proportion * 100}%`, backgroundColor: seg.color, transition: 'width 0.3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {breakdown.map((seg, i) => (
          <span key={i} style={{ fontSize: 8, color: seg.color, fontFamily: FONT_FAMILY }}>
            {seg.mechanism} {Math.round(seg.proportion * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
