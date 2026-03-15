'use client';

import { COLOR, FONT_FAMILY } from '@/config/theme';
import type { ChrDensity } from '@/lib/transposome-types';

interface MiniIdeogramProps {
  chrDensity: ChrDensity[];
  color?: string;
}

export function MiniIdeogram({ chrDensity, color = COLOR.accent.teal }: MiniIdeogramProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 6 }}>
        {chrDensity.map((d) => (
          <div
            key={d.chr}
            style={{
              width: 10,
              height: 28,
              background: COLOR.bg.surface,
              borderRadius: 5,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${d.density * 100}%`,
                borderRadius: '0 0 5px 5px',
                background: color,
                opacity: 0.2 + d.density * 0.6,
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY, marginTop: 4 }}>
        chr1-22 enrichment
      </div>
    </div>
  );
}
