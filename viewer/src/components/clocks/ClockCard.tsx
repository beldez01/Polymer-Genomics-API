'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import type { Clock } from '@/config/clocksMockData';

interface ClockCardProps {
  clock: Clock;
  selected: boolean;
  onSelect: () => void;
}

export function ClockCard({ clock, selected, onSelect }: ClockCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE[2],
        textAlign: 'left',
        backgroundColor: selected ? COLOR.bg.elevated : COLOR.bg.primary,
        border: `1px solid ${selected ? COLOR.primary.base : COLOR.border.strong}`,
        borderRadius: 2,
        padding: SPACE[5],
        cursor: 'pointer',
        transition: 'border-color 0.12s, background-color 0.12s',
        minHeight: 168,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = COLOR.text.tertiary;
          e.currentTarget.style.backgroundColor = COLOR.bg.elevated;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = COLOR.border.strong;
          e.currentTarget.style.backgroundColor = COLOR.bg.primary;
        }
      }}
    >
      {/* Header: name + year */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{
          color: selected ? COLOR.primary.base : COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: '-0.005em',
        }}>
          {clock.name}
        </span>
        <span className="tabular" style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.04em',
        }}>
          {clock.year}
        </span>
      </div>

      {/* Citation */}
      <span style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.xs.fontSize,
        letterSpacing: '0.02em',
        fontStyle: 'italic',
      }}>
        {clock.citation}
      </span>

      {/* Blurb */}
      <span style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        lineHeight: 1.5,
        marginTop: 2,
      }}>
        {clock.blurb}
      </span>

      {/* Spacer */}
      <span style={{ flex: 1 }} />

      {/* Footer stats */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: SPACE[3],
        paddingTop: SPACE[2],
        borderTop: `1px solid ${COLOR.border.subtle}`,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        color: COLOR.text.tertiary,
        letterSpacing: '0.04em',
      }}>
        <span className="tabular">
          <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.semibold }}>{clock.probes}</span>
          {' '}probes
        </span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span style={{ textTransform: 'lowercase' }}>{clock.tissue}</span>
        <span style={{ color: COLOR.border.strong }}>·</span>
        <span style={{
          color: clock.type === 'pace'
            ? COLOR.accent.violet
            : clock.type === 'biological'
              ? COLOR.accent.amber
              : COLOR.text.tertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontSize: 10,
          fontWeight: WEIGHT.semibold,
        }}>
          {clock.type}
        </span>
      </div>
    </button>
  );
}
