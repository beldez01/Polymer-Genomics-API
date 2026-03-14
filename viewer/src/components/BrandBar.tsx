'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE, COMPONENT } from '@/config/theme';
import { useIsMobile } from '@/hooks/useBreakpoint';

interface BrandBarProps {
  /** Content shown after the brand name with a vertical divider */
  subtitle?: React.ReactNode;
  /** Extra content on the right side, before Atlas/API links */
  children?: React.ReactNode;
  /** Make the bar sticky at viewport top */
  sticky?: boolean;
  onToggleSidebar?: () => void;
}

export function BrandBar({ subtitle, children, sticky, onToggleSidebar }: BrandBarProps) {
  const isMobile = useIsMobile();
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

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: isMobile ? SPACE[1] : SPACE[2] }}>
        {children}
        {isMobile && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              ...COMPONENT.button.small as React.CSSProperties,
              padding: `${SPACE[1]}px ${SPACE[2]}px`,
              lineHeight: 1,
            }}
            aria-label="Toggle sidebar"
          >
            &#9776;
          </button>
        )}
        <Link href="/view/hg38/chr1:100000000-100100000" style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>Viewer</Link>
        <Link href="/atlas" style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>Atlas</Link>
        <Link href="/evaluate" style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>Evaluate</Link>
        <Link href="/dmp" style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>DMP</Link>
        <Link href="/docs"  style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>{isMobile ? 'API' : 'API / MCP'}</Link>
        {!isMobile && <Link href="/developers" style={{...COMPONENT.button.small as React.CSSProperties, whiteSpace: 'nowrap' as const}}>Dev</Link>}
      </div>
    </div>
  );
}
