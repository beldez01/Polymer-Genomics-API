import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { RnaGlyph } from '@/components/company/RnaGlyph';
import {
  Card,
  Cta,
  SectionHeader,
  contentShell,
  sectionRule,
} from '@/components/company/Primitives';
import {
  COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT,
} from '@/config/theme';

/* ────────────────────────────────────────────────────────────────────────
   Polymer Bio — company front door.

   The root is the company. Supporting infrastructure lives under /genomics
   and /claims.

   Copy is deliberately high level — the specifics of the approach are not
   public. Keep it that way when editing.
   ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Polymer Bio',
  description:
    'Polymer Bio is a discovery engine for programmable RNA therapeutics.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Polymer Bio',
    description: 'A discovery engine for programmable RNA therapeutics.',
    url: 'https://polymerbio.org/',
    siteName: 'Polymer Bio',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Polymer Bio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymer Bio',
    description: 'A discovery engine for programmable RNA therapeutics.',
    images: ['/opengraph-image'],
  },
};

const CONTACT_EMAIL = 'polymergenomics@gmail.com';
const PARTNER_EMAIL = `mailto:${CONTACT_EMAIL}?subject=Polymer%20Bio%20partnership`;

/* Large linked surface — one per thing Polymer Bio actually operates.
   Local to this page: the two below are the only callers. */
function Surface({
  href,
  eyebrow,
  status,
  title,
  body,
}: {
  href?: string;
  eyebrow: string;
  status: string;
  title: string;
  body: ReactNode;
}) {
  const live = Boolean(href);
  const inner = (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE[3],
        marginBottom: SPACE[6],
      }}>
        <span style={{
          color: live ? COLOR.primary.base : COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {eyebrow}
        </span>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {status}
        </span>
      </div>

      <h2 style={{
        margin: `0 0 ${SPACE[3]}px`,
        color: COLOR.text.primary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.lg.fontSize,
        lineHeight: TYPE.lg.lineHeight,
        letterSpacing: TYPE.lg.letterSpacing,
        fontWeight: WEIGHT.semibold,
      }}>
        {title}
      </h2>

      <p style={{
        margin: 0,
        color: COLOR.text.secondary,
        fontSize: TYPE.base.fontSize,
        lineHeight: TYPE.base.lineHeight,
      }}>
        {body}
      </p>

      {live && (
        <span className="bio-surface-arrow" aria-hidden style={{
          marginTop: 'auto',
          paddingTop: SPACE[6],
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
        }}>
          &#8594;
        </span>
      )}
    </>
  );

  if (!href) {
    return <div className="bio-surface bio-surface--static">{inner}</div>;
  }
  return <Link href={href} className="bio-surface">{inner}</Link>;
}

export default function Home() {
  return (
    <main className="bio-page" style={{
      minHeight: '100vh',
      backgroundColor: COLOR.bg.primary,
      color: COLOR.text.primary,
    }}>
      <BrandBar sticky />

      {/* ── HERO + SURFACES ───────────────────────────────────────────────
         One stack, because the glyph belongs to both halves: it is drawn in
         white inside the blue field and continues in electric blue once it
         crosses the seam between them. Each half clips its own copy — see
         components/company/RnaGlyph.
         ──────────────────────────────────────────────────────────────── */}
      <div className="bio-hero-stack">
        <section className="bio-hero-blue" style={{ backgroundColor: COLOR.primary.base }}>
          <div style={{ ...contentShell, position: 'relative', zIndex: 2 }}>
            <h1 className="bio-rise" style={{
              margin: 0,
              animationDelay: '0.05s',
              color: COLOR.bg.white,
              fontFamily: FONT_FAMILY,
              fontSize: 'clamp(46px, 7.2vw, 104px)',
              lineHeight: 1.0,
              letterSpacing: '-0.04em',
              fontWeight: WEIGHT.bold,
            }}>
              Polymer Bio
            </h1>

            <p className="bio-rise" style={{
              margin: `${SPACE[6]}px 0 0`,
              animationDelay: '0.18s',
              maxWidth: 560,
              color: `${COLOR.bg.white}E0`,
              fontFamily: FONT_FAMILY,
              fontSize: 'clamp(17px, 1.75vw, 23px)',
              lineHeight: 1.45,
              letterSpacing: '-0.01em',
            }}>
              RNA construct design for precision oncology.
            </p>
          </div>

          <div className="bio-glyph bio-glyph--above" aria-hidden>
            <RnaGlyph tone="onBlue" />
          </div>
        </section>

        <section className="bio-surface-band">
          <div className="bio-glyph bio-glyph--below" aria-hidden>
            <RnaGlyph tone="onLight" />
          </div>

          <div style={{ ...contentShell, position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: SPACE[4],
            }}>
              <Surface
                href="/genomics"
                eyebrow="Infrastructure"
                status="Live"
                title="Polymer Genomics"
                body="Multi-layer reference-genome data and analysis infrastructure — a genome viewer, a digital karyotype, a sequence evaluator, and an agent-ready API."
              />
              <Surface
                href="/genomics/construct-builder"
                eyebrow="Design"
                status="Live"
                title="RNA Construct Builder"
                body="Construct design and evaluation for programmable RNA — a direct-manipulation canvas, duplex thermodynamics, complementarity search, and sourced design lint."
              />
            </div>
          </div>
        </section>
      </div>

      {/* ── §01 APPROACH ──────────────────────────────────────────────── */}
      <section style={{ ...contentShell, ...sectionRule }}>
        <SectionHeader
          index="01"
          label="Approach"
          title="Discovery, run as a loop"
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACE[5],
        }}>
          <Card
            eyebrow="Design"
            title="Candidate libraries"
            body="Constructs are generated and reviewed before anything reaches the bench."
          />
          <Card
            eyebrow="Screen"
            title="Functional evidence"
            body="Candidates are tested in matched cellular contexts rather than ranked on prediction alone."
          />
          <Card
            eyebrow="Select"
            title="Validated output"
            body="Each cycle narrows the pool and informs the next, ending in a validated set and its evidence package."
          />
        </div>
      </section>

      {/* ── §02 FOUNDER ───────────────────────────────────────────────── */}
      <section id="founder" style={{ ...contentShell, ...sectionRule }}>
        <SectionHeader
          index="02"
          label="Founder"
          title="Zachary Belden, MD"
          body="Board-certified clinical pathologist and fellowship-trained molecular genetic pathologist, with laboratory and computational experience across assay development and genomics."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: SPACE[4],
        }}>
          {([
            ['Clinical', 'Clinical pathology · molecular genetic pathology'],
            ['Laboratory', 'Assay development and validation'],
            ['Computational', 'Genomics infrastructure and tooling'],
          ] as [string, string][]).map(([heading, detail]) => (
            <div key={heading} style={{
              padding: SPACE[5],
              borderTop: `2px solid ${COLOR.primary.base}`,
              backgroundColor: COLOR.bg.elevated,
            }}>
              <div style={{
                color: COLOR.text.faint,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: SPACE[3],
              }}>
                {heading}
              </div>
              <div style={{
                color: COLOR.text.secondary,
                fontSize: TYPE.base.fontSize,
                lineHeight: TYPE.base.lineHeight,
              }}>
                {detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTACT ───────────────────────────────────────────────────── */}
      <section style={{
        ...contentShell,
        borderTop: `1px solid ${COLOR.border.subtle}`,
        paddingTop: SPACE[16],
        paddingBottom: SPACE[24],
        textAlign: 'center',
      }}>
        <h2 style={{
          margin: 0,
          color: COLOR.text.primary,
          fontSize: TYPE.xl.fontSize,
          lineHeight: TYPE.xl.lineHeight,
          letterSpacing: TYPE.xl.letterSpacing,
          fontWeight: WEIGHT.bold,
        }}>
          Get in touch
        </h2>
        <p style={{
          margin: `${SPACE[5]}px auto 0`,
          maxWidth: 560,
          color: COLOR.text.secondary,
          fontSize: TYPE.md.fontSize,
          lineHeight: TYPE.md.lineHeight,
        }}>
          Program details are shared under discussion.
        </p>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: SPACE[3],
          justifyContent: 'center', marginTop: SPACE[8],
        }}>
          <Cta href={PARTNER_EMAIL} primary>Contact</Cta>
        </div>
      </section>

      <Footer />
    </main>
  );
}
