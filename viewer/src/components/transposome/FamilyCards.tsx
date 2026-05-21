'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { SUPERFAMILIES, SUPERFAMILY_COLOR, SUBFAMILIES, type Superfamily } from '@/config/transposomeMockData';

interface FamilyCardsProps {
  selected: Superfamily | 'all';
  onSelect: (s: Superfamily | 'all') => void;
}

export function FamilyCards({ selected, onSelect }: FamilyCardsProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: SPACE[3],
    }}>
      {SUPERFAMILIES.map((sf) => {
        const isSelected = selected === sf.id;
        const accent = SUPERFAMILY_COLOR[sf.id];
        const subCount = SUBFAMILIES.filter((s) => s.superfamily === sf.id).length;

        return (
          <button
            key={sf.id}
            type="button"
            onClick={() => onSelect(isSelected ? 'all' : sf.id)}
            style={{
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
              minHeight: 160,
              position: 'relative',
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
            {/* Accent stripe top */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              backgroundColor: accent,
            }} />

            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingTop: SPACE[1],
            }}>
              <span style={{
                color: isSelected ? accent : COLOR.text.primary,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.md.fontSize,
                fontWeight: WEIGHT.bold,
                letterSpacing: '0.04em',
              }}>
                {sf.name}
              </span>
              <span className="tabular" style={{
                color: COLOR.text.faint,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.04em',
              }}>
                {subCount} subfam.
              </span>
            </div>

            {/* Counts */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: SPACE[2],
            }}>
              <span className="tabular" style={{
                color: COLOR.text.primary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.lg.fontSize,
                fontWeight: WEIGHT.semibold,
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}>
                {(sf.count / 1000).toFixed(0)}K
              </span>
              <span style={{
                color: COLOR.text.tertiary,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                copies
              </span>
            </div>

            {/* Blurb */}
            <span style={{
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              lineHeight: 1.45,
              flex: 1,
            }}>
              {sf.blurb}
            </span>

            {/* Footer: genome %, age range */}
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
                {(sf.fractionOfGenome * 100).toFixed(1)} % genome
              </span>
              <span style={{ color: COLOR.border.strong }}>·</span>
              <span className="tabular">
                {sf.youngestMya.toFixed(1)}–{sf.oldestMya} MYA
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
