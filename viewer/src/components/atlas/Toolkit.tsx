'use client';

import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';
import { TOOLKIT_CARDS } from '@/config/toolkit-cards';
import { ToolkitCard } from './ToolkitCard';

export function Toolkit() {
  return (
    <section style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: `${SPACE[8]}px ${SPACE[6]}px ${SPACE[12]}px`,
    }}>
      {/* Editorial section header with meta on the right */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: SPACE[2] + 2,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[3],
        }}>
          <span style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.md.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}>
            Toolkit
          </span>
        </div>
        <span style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          {TOOLKIT_CARDS.length.toString().padStart(2, '0')} Modules
        </span>
      </div>

      <div style={{
        height: 1,
        backgroundColor: COLOR.border.strong,
        marginBottom: SPACE[6],
      }} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: SPACE[5],
      }}>
        {TOOLKIT_CARDS.map((card) => (
          <ToolkitCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
