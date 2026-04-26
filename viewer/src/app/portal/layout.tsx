'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

const PROJECTION_TABS: Array<{
  slug: string;
  label: string;
  status: 'live' | 'v0' | 'v1';
}> = [
  { slug: 'latent3d', label: 'Latent 3D', status: 'live' },
  { slug: 'graph', label: 'Graph', status: 'live' },
  { slug: 'umap', label: 'UMAP', status: 'v1' },
  { slug: 'cohort', label: 'Cohort', status: 'v1' },
  { slug: 'pathway', label: 'Pathway', status: 'v1' },
];

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_FAMILY,
      }}
    >
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          borderBottom: `1px solid ${COLOR.border.subtle}`,
          backgroundColor: `${COLOR.bg.primary}F2`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            padding: `${SPACE[2]}px ${SPACE[6]}px`,
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[4],
          }}
        >
          <Link
            href="/portal"
            style={{
              color: COLOR.accent.teal,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Polymer Claims
          </Link>
          <div style={{ flex: 1, display: 'flex', gap: SPACE[1] }}>
            {PROJECTION_TABS.map((tab) => {
              const href = `/portal/${tab.slug}`;
              const active = pathname?.startsWith(href) ?? false;
              return (
                <Link
                  key={tab.slug}
                  href={href}
                  style={{
                    padding: `${SPACE[1]}px ${SPACE[3]}px`,
                    fontSize: TYPE.xs.fontSize,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    color: active ? COLOR.text.primary : COLOR.text.muted,
                    borderBottom: active
                      ? `2px solid ${COLOR.accent.teal}`
                      : '2px solid transparent',
                    opacity: tab.status === 'live' ? 1 : 0.7,
                  }}
                >
                  {tab.label}
                  {tab.status !== 'live' && (
                    <span
                      style={{
                        marginLeft: SPACE[1],
                        fontSize: 9,
                        padding: '1px 4px',
                        border: `1px solid ${COLOR.border.subtle}`,
                        color: COLOR.text.tertiary,
                        letterSpacing: 0,
                      }}
                    >
                      {tab.status}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <Link
            href="/portal/submit"
            style={{
              padding: `${SPACE[1]}px ${SPACE[3]}px`,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              color: COLOR.bg.primary,
              backgroundColor: COLOR.accent.teal,
              fontWeight: WEIGHT.medium,
            }}
          >
            Submit a claim
          </Link>
        </div>
      </nav>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
