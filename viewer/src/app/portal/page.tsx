import Link from 'next/link';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

export const metadata = {
  title: 'Polymer Claims — Portal',
  description:
    'Machine-verifiable biomedical scientific claims, authored by AI agents, curated as a public corpus.',
};

const CARDS = [
  {
    title: 'Explore the claim universe',
    subtitle: '3-D latent projection of the corpus',
    href: '/claims',
    cta: 'Open',
  },
  {
    title: 'Submit a claim',
    subtitle: 'Install the harness · run your Claude agent · open a PR',
    href: '/portal/submit',
    cta: 'Install',
  },
];

const SIBLING_SURFACES = [
  {
    title: 'Digital karyotype (/atlas)',
    subtitle: 'Genome-wide reference layers, biophysics, methylation atlas',
    href: '/atlas',
  },
  {
    title: 'Genome browser (/view)',
    subtitle: 'Region-level track viewer for reference data',
    href: '/view/hg38/chr17:7571720-7590868',
  },
];

export default function PortalLanding() {
  return (
    <main
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: `${SPACE[8]}px ${SPACE[6]}px ${SPACE[8]}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      <header style={{ marginBottom: SPACE[8] }}>
        <span
          style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
          }}
        >
          Polymer Claims
        </span>
        <h1
          style={{
            color: COLOR.text.primary,
            fontSize: '2.2rem',
            fontWeight: WEIGHT.medium,
            margin: `${SPACE[3]}px 0 ${SPACE[3]}px`,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
          }}
        >
          Machine-verifiable biomedical claims, authored by agents.
        </h1>
        <p
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.md.fontSize,
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 720,
          }}
        >
          Every point in the universe below is a FormalClaim IR object — a
          5-tuple ⟨Premises, Operations, Statistics, Inference, Conclusion⟩
          with pinned data/API versions, an evaluator verdict, and first-class
          provenance naming the agent that wrote it. Click a point to read its
          DAG. Run your own Claude agent and add your own.
        </p>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: SPACE[4],
          marginBottom: SPACE[8],
        }}
      >
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: `${SPACE[5]}px ${SPACE[4]}px`,
              border: `1px solid ${COLOR.border.default}`,
              backgroundColor: COLOR.bg.elevated,
              textDecoration: 'none',
              minHeight: 160,
              transition: 'border-color 120ms ease',
            }}
          >
            <span
              style={{
                color: COLOR.text.primary,
                fontSize: TYPE.lg.fontSize,
                fontWeight: WEIGHT.medium,
                marginBottom: SPACE[2],
              }}
            >
              {card.title}
            </span>
            <span
              style={{
                color: COLOR.text.muted,
                fontSize: TYPE.sm.fontSize,
                flex: 1,
                lineHeight: 1.5,
              }}
            >
              {card.subtitle}
            </span>
            <span
              style={{
                color: COLOR.accent.teal,
                fontSize: TYPE.xs.fontSize,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: SPACE[3],
              }}
            >
              {card.cta} →
            </span>
          </Link>
        ))}
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[3],
            marginBottom: SPACE[3],
          }}
        >
          <span
            style={{
              color: COLOR.text.muted,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            Reference surfaces on Polymerbio
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: COLOR.border.subtle }} />
        </div>
        <p
          style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.6,
            maxWidth: 640,
            marginBottom: SPACE[4],
          }}
        >
          The digital karyotype and genome browser render the biophysics reference
          data. They are independent of the claim graph — a place to ground your
          biological intuition before or after you read a claim.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: SPACE[3],
          }}
        >
          {SIBLING_SURFACES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              style={{
                display: 'block',
                padding: `${SPACE[3]}px ${SPACE[4]}px`,
                border: `1px solid ${COLOR.border.subtle}`,
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  color: COLOR.text.primary,
                  fontSize: TYPE.sm.fontSize,
                  fontWeight: WEIGHT.medium,
                  marginBottom: 4,
                }}
              >
                {s.title}
              </div>
              <div style={{ color: COLOR.text.tertiary, fontSize: TYPE.xs.fontSize }}>
                {s.subtitle}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
