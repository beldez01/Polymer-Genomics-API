'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE, COMPONENT } from '@/config/theme';

interface BrandBarProps {
  /** Content shown after the brand name with a vertical divider */
  subtitle?: React.ReactNode;
  /** Extra content on the right side, before Atlas/API links */
  children?: React.ReactNode;
  /** Make the bar sticky at viewport top */
  sticky?: boolean;
}

export function BrandBar({ subtitle, children, sticky }: BrandBarProps) {
  return (
    <div style={{
      height: 44,
      backgroundColor: COLOR.bg.primary,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: SPACE[4],
      paddingRight: SPACE[4],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
      flexShrink: 0,
      ...(sticky ? { position: 'sticky' as const, top: 0, zIndex: 100 } : {}),
    }}>
      <Link href="/" style={{
        color: COLOR.accent.teal,
        fontSize: 17,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.bold,
        letterSpacing: '0.08em',
        textDecoration: 'none',
        flexShrink: 0,
      }}>
        POLYMER GENOMICS
      </Link>

      {subtitle && (
        <>
          <div style={{
            width: 1,
            height: 20,
            backgroundColor: COLOR.border.strong,
            flexShrink: 0,
            marginLeft: SPACE[3],
            marginRight: SPACE[3],
          }} />
          {typeof subtitle === 'string' ? (
            <span style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.02em',
            }}>
              {subtitle}
            </span>
          ) : subtitle}
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
        {children}
        <Link href="/view/hg38/chr1:100000000-100100000" style={COMPONENT.button.small as React.CSSProperties}>Viewer</Link>
        <Link href="/atlas" style={COMPONENT.button.small as React.CSSProperties}>Atlas</Link>
        <Link href="/docs"  style={COMPONENT.button.small as React.CSSProperties}>API</Link>
      </div>
    </div>
  );
}
