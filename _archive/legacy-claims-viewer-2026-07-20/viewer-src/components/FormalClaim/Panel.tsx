'use client';

import type { ReactNode } from 'react';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

interface PanelProps {
  index: number;                 // 1..5 — prefix in the chrome (e.g. "1 · PREMISES")
  label: string;                 // e.g. "PREMISES (P)"
  accent?: string;               // optional accent color for the left rule
  trailing?: ReactNode;          // right-aligned header content (count chip, etc.)
  children: ReactNode;
}

export function Panel({ index, label, accent, trailing, children }: PanelProps) {
  const ruleColor = accent ?? COLOR.border.strong;

  return (
    <section
      style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.default}`,
        borderLeft: `2px solid ${ruleColor}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: SPACE[3],
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          borderBottom: `1px solid ${COLOR.border.default}`,
          backgroundColor: COLOR.bg.track,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: SPACE[3],
            fontFamily: FONT_FAMILY,
          }}
        >
          <span
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.sm.fontSize,
              letterSpacing: '0.2em',
              fontWeight: WEIGHT.medium,
            }}
          >
            {String(index).padStart(2, '0')}
          </span>
          <span
            style={{
              color: COLOR.text.secondary,
              fontSize: TYPE.base.fontSize,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: WEIGHT.medium,
            }}
          >
            {label}
          </span>
        </div>
        {trailing ? (
          <div style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize, color: COLOR.text.tertiary }}>
            {trailing}
          </div>
        ) : null}
      </header>

      {/* Body */}
      <div style={{ padding: SPACE[4] }}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chip — small inline tag (e.g. 'local_rds', 'palsson_2025', 'S')
// ---------------------------------------------------------------------------

interface ChipProps {
  color?: string;
  children: ReactNode;
  title?: string;
  mono?: boolean;
}

export function Chip({ color, children, title, mono = true }: ChipProps) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE[1],
        padding: `2px ${SPACE[2]}px`,
        border: `1px solid ${color ?? COLOR.border.strong}`,
        borderRadius: 3,
        color: color ?? COLOR.text.secondary,
        fontFamily: mono ? FONT_FAMILY : undefined,
        fontSize: TYPE.sm.fontSize,
        letterSpacing: '0.06em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KVRow — left label, right value, monospace, underlined separator
// ---------------------------------------------------------------------------

interface KVRowProps {
  label: string;
  children: ReactNode;
  align?: 'baseline' | 'center' | 'flex-start';
}

export function KVRow({ label, children, align = 'baseline' }: KVRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: align,
        justifyContent: 'space-between',
        gap: SPACE[4],
        paddingTop: SPACE[2],
        paddingBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.subtle}`,
      }}
    >
      <span
        style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {children}
      </span>
    </div>
  );
}
