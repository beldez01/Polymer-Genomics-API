'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { LOCI, allelesForLocus } from '@/config/hlaMockData';

interface LocusCardsProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function LocusCards({ selected, onSelect }: LocusCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: SPACE[3],
    }}>
      {LOCI.map((l) => {
        const isSelected = l.id === selected;
        const accent = l.class === 'I' ? COLOR.primary.base : COLOR.accent.violet;
        const repCount = allelesForLocus(l.id).length;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onSelect(l.id)}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE[2],
              textAlign: 'left',
              backgroundColor: isSelected ? COLOR.bg.elevated : COLOR.bg.primary,
              border: `1px solid ${isSelected ? accent : COLOR.border.strong}`,
              borderRadius: 2,
              padding: SPACE[4],
              cursor: 'pointer',
              transition: 'border-color 0.12s, background-color 0.12s',
              minHeight: 168,
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = COLOR.text.tertiary;
                e.currentTarget.style.backgroundColor = COLOR.bg.elevated;
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = COLOR.border.strong;
                e.currentTarget.style.backgroundColor = COLOR.bg.primary;
              }
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, height: 3,
              backgroundColor: accent,
            }} />

            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingTop: SPACE[1],
            }}>
              <span style={{
                color: isSelected ? accent : COLOR.text.primary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.lg.fontSize,
                fontWeight: WEIGHT.bold,
                letterSpacing: '-0.01em',
              }}>
                {l.name}
              </span>
              <span style={{
                color: accent,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: 10,
                fontWeight: WEIGHT.semibold,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}>
                Class {l.class}
              </span>
            </div>

            <span style={{
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              lineHeight: 1.45,
              flex: 1,
            }}>
              {l.blurb}
            </span>

            <div style={{
              display: 'flex',
              gap: SPACE[3],
              paddingTop: SPACE[2],
              borderTop: `1px solid ${COLOR.border.subtle}`,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: 10,
              color: COLOR.text.tertiary,
              letterSpacing: '0.04em',
            }}>
              <span className="tabular">
                <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.semibold }}>
                  {l.totalAlleles.toLocaleString()}
                </span>{' '}alleles
              </span>
              <span style={{ color: COLOR.border.strong }}>·</span>
              <span className="tabular">
                {repCount} shown
              </span>
              <span style={{ color: COLOR.border.strong }}>·</span>
              <span className="tabular">
                {(l.geneLength / 1000).toFixed(1)} kb
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
