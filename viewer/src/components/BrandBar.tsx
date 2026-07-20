'use client';

import Link from 'next/link';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE, LAYOUT, COMPONENT } from '@/config/theme';
import { useIsMobile } from '@/hooks/useBreakpoint';

interface BrandBarProps {
  /** Content shown after the brand name with a vertical divider */
  subtitle?: React.ReactNode;
  /** Extra content inserted at the start of the nav cluster — used by /dmp and /transposome */
  children?: React.ReactNode;
  /** Make the bar sticky at viewport top */
  sticky?: boolean;
  /** Mobile sidebar toggle — only rendered on mobile when provided. Used by /view. */
  onToggleSidebar?: () => void;
}

const VIEWER_HREF =
  '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

export function BrandBar({ subtitle, children, sticky, onToggleSidebar }: BrandBarProps) {
  const isMobile = useIsMobile();
  return (
    <div style={{
      height: LAYOUT.headerHeight,
      backgroundColor: COLOR.bg.primary,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: SPACE[6],
      paddingRight: SPACE[6],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
      flexShrink: 0,
      ...(sticky ? { position: 'sticky' as const, top: 0, zIndex: 100 } : {}),
    }}>
      {/* Wordmark — electric blue, mono caps, the dream-vision title */}
      <Link href="/" style={{
        color: COLOR.primary.base,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: 15,
        fontWeight: WEIGHT.bold,
        letterSpacing: '0.12em',
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
            marginLeft: SPACE[4],
            marginRight: SPACE[4],
          }} />
          {typeof subtitle === 'string' ? (
            <span style={{
              color: COLOR.text.tertiary,
              fontSize: TYPE.base.fontSize,
              fontFamily: FONT_FAMILY,
              letterSpacing: '0.01em',
            }}>
              {subtitle}
            </span>
          ) : subtitle}
        </>
      )}

      {/* Nav cluster — right side */}
      <nav
        className={isMobile ? 'brand-nav-scroll' : undefined}
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? SPACE[1] : SPACE[5],
          ...(isMobile ? {
            minWidth: 0,
            overflowX: 'auto' as const,
            WebkitOverflowScrolling: 'touch' as const,
          } : {}),
        }}
      >
        {/* Legacy passthrough — page-specific extras (e.g. region indicators) */}
        {children}

        {/* Mobile sidebar toggle — only when caller opts in */}
        {isMobile && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              ...COMPONENT.button.small as React.CSSProperties,
              padding: `${SPACE[1]}px ${SPACE[2]}px`,
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Toggle sidebar"
          >
            &#9776;
          </button>
        )}

        {/* Standard nav links */}
        <NavLink href="/atlas">Atlas</NavLink>
        <NavLink href="/claims">Claims</NavLink>
        <NavLink href={isMobile ? '/docs' : '/docs'}>{isMobile ? 'Dev' : 'Docs'}</NavLink>

        {/* Primary CTA */}
        <Link
          href={VIEWER_HREF}
          style={{
            backgroundColor: COLOR.primary.base,
            color: COLOR.bg.white,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.01em',
            textDecoration: 'none',
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            borderRadius: 2,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Open viewer →
        </Link>
      </nav>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.01em',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.primary.base; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.secondary; }}
    >
      {children}
    </Link>
  );
}
