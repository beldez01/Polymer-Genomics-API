import type { Metadata } from 'next';
import Link from 'next/link';
import {
  COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE, LAYOUT,
} from '@/config/theme';

/* ────────────────────────────────────────────────────────────────────────
   /biologics — PolymerBio standalone front door.

   Deliberately does NOT import BrandBar / Footer, so nothing about this
   pathway leaks into the global Polymer Genomics chrome. Its own minimal
   header (POLYMERBIO wordmark) and footer keep it a self-contained pitch
   surface. Visual language is the shared D2 token system so it still reads
   as the same website. First pass: hero only — sections come later.
   ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Polymer Bio — Genotype-Directed Cell Therapy',
  description: 'Polymer Bio — genotype-directed cell therapy.',
};

// Sibling pathways. Real, working routes today; expanded as we wire up more.
const NAV = [
  { label: 'Genomics', href: '/' },
  { label: 'Claims', href: '/claims' },
];

export default function Biologics() {
  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Header — own minimal bar, not the Polymer Genomics BrandBar ── */}
      <header style={{
        height: LAYOUT.headerHeight,
        backgroundColor: COLOR.bg.primary,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: SPACE[6],
        paddingRight: SPACE[6],
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        flexShrink: 0,
      }}>
        <Link href="/" style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: 15,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.12em',
          textDecoration: 'none',
          flexShrink: 0,
        }}>
          POLYMER BIO
        </Link>

        <nav style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[5],
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.base.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.01em',
        }}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="bio-navlink">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ── Hero — mirrors the Genomics hero: mono eyebrow, blue display
             wordmark, one quiet subhead. Staggered entrance. ── */}
      <section style={{
        flex: 1,
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[24]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        <div className="bio-rise" style={{
          animationDelay: '0.05s',
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: SPACE[6],
        }}>
          Genotype-Directed Cell Therapy
        </div>

        <h1 className="bio-rise" style={{
          animationDelay: '0.15s',
          margin: 0,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE['2xl'].fontSize,
          lineHeight: TYPE['2xl'].lineHeight,
          letterSpacing: TYPE['2xl'].letterSpacing,
          fontWeight: WEIGHT.bold,
          color: COLOR.primary.base,
          marginBottom: SPACE[5],
        }}>
          Polymer Biologics
        </h1>

        {/* Placeholder subhead — refine with real positioning copy later. */}
        <p className="bio-rise" style={{
          animationDelay: '0.25s',
          margin: 0,
          maxWidth: 640,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.55,
          letterSpacing: TYPE.md.letterSpacing,
          fontWeight: WEIGHT.normal,
        }}>
          Cell therapies designed around the patient&rsquo;s genome &mdash; matching the
          therapeutic to the genotype.
        </p>
      </section>

      {/* ── Footer — same hairline pattern as the site, own PolymerBio mark ── */}
      <footer style={{
        flexShrink: 0,
        backgroundColor: COLOR.bg.primary,
        borderTop: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[4]}px ${SPACE[6]}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACE[3],
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], flexWrap: 'wrap' }}>
          {NAV.map((n, i) => (
            <span key={n.href} style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE[3] }}>
              {i > 0 && (
                <span aria-hidden style={{ color: COLOR.border.strong, fontSize: 12, lineHeight: 1 }}>·</span>
              )}
              <Link href={n.href} className="bio-navlink" style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                color: COLOR.text.tertiary,
                letterSpacing: '0.01em',
              }}>
                {n.label}
              </Link>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
          <span style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Research use only
          </span>
          <span aria-hidden style={{ color: COLOR.border.strong, fontSize: 12, lineHeight: 1 }}>·</span>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY_MONO,
            letterSpacing: '0.04em',
          }}>
            &copy; 2026 Polymer Bio
          </span>
        </div>
      </footer>
    </main>
  );
}
