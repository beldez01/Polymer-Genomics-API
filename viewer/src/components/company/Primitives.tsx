import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import {
  COLOR,
  COMPONENT,
  FONT_FAMILY,
  FONT_FAMILY_MONO,
  LAYOUT,
  SPACE,
  TYPE,
  WEIGHT,
} from '@/config/theme';

/* Shared editorial primitives for the company-facing pages. Extracted from
   the former /biologics page so the pages that use them cannot drift apart
   typographically. Current consumers: / and /genomics/docs. */

export type Tone = 'blue' | 'amber' | 'violet' | 'rose' | 'neutral';

export const TONES: Record<Tone, { color: string; wash: string }> = {
  blue: { color: COLOR.primary.base, wash: `${COLOR.primary.base}12` },
  amber: { color: COLOR.accent.amber, wash: `${COLOR.accent.amber}12` },
  violet: { color: COLOR.accent.violet, wash: `${COLOR.accent.violet}12` },
  rose: { color: COLOR.accent.rose, wash: `${COLOR.accent.rose}10` },
  neutral: { color: COLOR.text.tertiary, wash: COLOR.bg.deep },
};

export const contentShell: CSSProperties = {
  width: '100%',
  maxWidth: LAYOUT.maxContentWidth,
  margin: '0 auto',
  paddingLeft: SPACE[6],
  paddingRight: SPACE[6],
  boxSizing: 'border-box',
};

export const sectionRule: CSSProperties = {
  borderTop: `1px solid ${COLOR.border.subtle}`,
  paddingTop: SPACE[16],
  paddingBottom: SPACE[16],
};

export function Status({ children, tone = 'blue' }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 24,
      padding: `${SPACE[1]}px ${SPACE[2]}px`,
      border: `1px solid ${t.color}`,
      backgroundColor: t.wash,
      color: t.color,
      borderRadius: 2,
      fontFamily: FONT_FAMILY_MONO,
      fontSize: TYPE.xs.fontSize,
      fontWeight: WEIGHT.semibold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      lineHeight: 1.2,
    }}>
      {children}
    </span>
  );
}

export function SectionHeader({
  index,
  label,
  title,
  body,
}: {
  index: string;
  label: string;
  title: string;
  /* Optional — without it the heading collapses to a single column. */
  body?: string;
}) {
  return (
    <div
      className="bio-section-heading"
      style={{
        display: 'grid',
        gridTemplateColumns: body
          ? 'minmax(0, 1.05fr) minmax(280px, 0.95fr)'
          : 'minmax(0, 1fr)',
        gap: SPACE[12],
        alignItems: 'start',
        marginBottom: SPACE[10],
      }}
    >
      <div>
        <div style={{
          display: 'flex',
          gap: SPACE[3],
          alignItems: 'baseline',
          marginBottom: SPACE[4],
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          <span style={{ color: COLOR.text.faint }}>§{index}</span>
          <span>{label}</span>
        </div>
        <h2 style={{
          margin: 0,
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.xl.fontSize,
          lineHeight: TYPE.xl.lineHeight,
          letterSpacing: TYPE.xl.letterSpacing,
          fontWeight: WEIGHT.bold,
          maxWidth: 680,
        }}>
          {title}
        </h2>
      </div>
      {body && (
        <p style={{
          margin: 0,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          lineHeight: TYPE.md.lineHeight,
          maxWidth: 620,
        }}>
          {body}
        </p>
      )}
    </div>
  );
}

/* One card, one accent. The tinted per-card washes are gone: everything
   here carries the signature electric blue, and separation comes from the
   hairline and the top rule rather than from hue. The small square before
   the eyebrow is the same marker the /genomics lead cards use. */
export function Card({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
}) {
  return (
    <article style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 210,
      padding: SPACE[6],
      border: `1px solid ${COLOR.border.subtle}`,
      borderTop: `2px solid ${COLOR.primary.base}`,
      backgroundColor: COLOR.bg.elevated,
      borderRadius: 2,
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        marginBottom: SPACE[5],
      }}>
        <span aria-hidden style={{
          width: 8,
          height: 8,
          backgroundColor: COLOR.primary.base,
          flexShrink: 0,
        }} />
        <span style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {eyebrow}
        </span>
      </div>
      <h3 style={{
        margin: `0 0 ${SPACE[3]}px`,
        color: COLOR.text.primary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.lg.fontSize,
        lineHeight: TYPE.lg.lineHeight,
        letterSpacing: TYPE.lg.letterSpacing,
        fontWeight: WEIGHT.semibold,
      }}>
        {title}
      </h3>
      <div style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        lineHeight: TYPE.base.lineHeight,
      }}>
        {body}
      </div>
    </article>
  );
}

export function Cta({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  const style = primary ? COMPONENT.button.primary : COMPONENT.button.secondary;
  const shared: CSSProperties = {
    ...style,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    textDecoration: 'none',
    boxSizing: 'border-box',
  };
  if (href.startsWith('mailto:') || href.startsWith('http')) {
    return <a href={href} className="bio-cta" style={shared}>{children}</a>;
  }
  return <Link href={href} className="bio-cta" style={shared}>{children}</Link>;
}
