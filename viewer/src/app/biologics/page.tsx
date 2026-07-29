import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Polymer Bio — The functional design foundry for programmable RNA',
  description:
    'Polymer Bio is building a partnered programmable-RNA discovery platform. SensorKit generates reviewable constructs; the proposed CytoWell engine tests them across context, dose, time, and phenotype.',
  alternates: {
    canonical: '/biologics',
  },
  openGraph: {
    title: 'Polymer Bio — The functional design foundry for programmable RNA',
    description:
      'A partnered programmable-RNA discovery platform built to deliver validated lead-selection decisions.',
    url: 'https://polymerbio.org/biologics',
    siteName: 'Polymer Bio',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymer Bio — The functional design foundry for programmable RNA',
    description:
      'A partnered programmable-RNA discovery platform built to deliver validated lead-selection decisions.',
  },
};

const CONTACT_EMAIL = 'polymergenomics@gmail.com';
const PARTNER_EMAIL = `mailto:${CONTACT_EMAIL}?subject=Polymer%20Bio%20design%20program`;
const DECK_EMAIL = `mailto:${CONTACT_EMAIL}?subject=Polymer%20Bio%20pre-seed%20deck`;

type Tone = 'blue' | 'amber' | 'violet' | 'rose' | 'neutral';

const TONES: Record<Tone, { color: string; wash: string }> = {
  blue: { color: COLOR.primary.base, wash: `${COLOR.primary.base}12` },
  amber: { color: COLOR.accent.amber, wash: `${COLOR.accent.amber}12` },
  violet: { color: COLOR.accent.violet, wash: `${COLOR.accent.violet}12` },
  rose: { color: COLOR.accent.rose, wash: `${COLOR.accent.rose}10` },
  neutral: { color: COLOR.text.tertiary, wash: COLOR.bg.deep },
};

const contentShell: CSSProperties = {
  width: '100%',
  maxWidth: LAYOUT.maxContentWidth,
  margin: '0 auto',
  paddingLeft: SPACE[6],
  paddingRight: SPACE[6],
  boxSizing: 'border-box',
};

const sectionRule: CSSProperties = {
  borderTop: `1px solid ${COLOR.border.subtle}`,
  paddingTop: SPACE[16],
  paddingBottom: SPACE[16],
};

function Status({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
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

function SectionHeader({
  index,
  label,
  title,
  body,
}: {
  index: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(280px, 0.95fr)',
      gap: SPACE[12],
      alignItems: 'start',
      marginBottom: SPACE[10],
    }} className="bio-section-heading">
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
    </div>
  );
}

function Card({
  eyebrow,
  title,
  body,
  tone = 'neutral',
  status,
}: {
  eyebrow: string;
  title: string;
  body: ReactNode;
  tone?: Tone;
  status?: string;
}) {
  const t = TONES[tone];
  return (
    <article style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 210,
      padding: SPACE[6],
      border: `1px solid ${t.color}`,
      backgroundColor: t.wash,
      borderRadius: 2,
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE[3],
        marginBottom: SPACE[5],
      }}>
        <span style={{
          color: t.color,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {eyebrow}
        </span>
        {status && <Status tone={tone}>{status}</Status>}
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

function Cta({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  const style = primary ? COMPONENT.button.primary : COMPONENT.button.secondary;
  const external = href.startsWith('mailto:');
  const shared: CSSProperties = {
    ...style,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    textDecoration: 'none',
    boxSizing: 'border-box',
  };
  if (external) {
    return <a href={href} className="bio-cta" style={shared}>{children}</a>;
  }
  return <Link href={href} className="bio-cta" style={shared}>{children}</Link>;
}

function InlineList({ items }: { items: string[] }) {
  return (
    <ul style={{
      margin: 0,
      paddingLeft: SPACE[5],
      color: COLOR.text.secondary,
      fontSize: TYPE.base.fontSize,
      lineHeight: 1.8,
    }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function FlowStep({
  index,
  name,
  detail,
  tone,
}: {
  index: string;
  name: string;
  detail: string;
  tone: Tone;
}) {
  const t = TONES[tone];
  return (
    <div style={{
      minWidth: 0,
      padding: SPACE[5],
      border: `1px solid ${t.color}`,
      backgroundColor: t.wash,
      borderRadius: 2,
    }}>
      <div style={{
        color: t.color,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        fontWeight: WEIGHT.bold,
        letterSpacing: '0.08em',
        marginBottom: SPACE[4],
      }}>
        {index}
      </div>
      <div style={{
        color: COLOR.text.primary,
        fontSize: TYPE.base.fontSize,
        fontWeight: WEIGHT.semibold,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: SPACE[2],
      }}>
        {name}
      </div>
      <div style={{
        color: COLOR.text.secondary,
        fontSize: TYPE.sm.fontSize,
        lineHeight: TYPE.sm.lineHeight,
      }}>
        {detail}
      </div>
    </div>
  );
}

function PlatformNode({
  name,
  verb,
  detail,
  status,
  tone,
}: {
  name: string;
  verb: string;
  detail: string;
  status: 'built' | 'proposed' | 'human-gated';
  tone: Tone;
}) {
  return (
    <div style={{
      minWidth: 0,
      padding: SPACE[5],
      border: `1px solid ${TONES[tone].color}`,
      backgroundColor: TONES[tone].wash,
      borderRadius: 2,
    }}>
      <Status tone={status === 'built' ? 'blue' : status === 'human-gated' ? 'neutral' : tone}>
        {status}
      </Status>
      <h3 style={{
        margin: `${SPACE[4]}px 0 ${SPACE[1]}px`,
        color: COLOR.text.primary,
        fontSize: TYPE.md.fontSize,
        fontWeight: WEIGHT.semibold,
      }}>
        {name}
      </h3>
      <div style={{
        color: TONES[tone].color,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.sm.fontSize,
        fontWeight: WEIGHT.semibold,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: SPACE[3],
      }}>
        {verb}
      </div>
      <p style={{
        margin: 0,
        color: COLOR.text.secondary,
        fontSize: TYPE.sm.fontSize,
        lineHeight: TYPE.sm.lineHeight,
      }}>
        {detail}
      </p>
    </div>
  );
}

export default function BiologicsPage() {
  return (
    <main className="bio-page" style={{
      minHeight: '100vh',
      backgroundColor: COLOR.bg.primary,
      color: COLOR.text.primary,
    }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: LAYOUT.headerHeight,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: SPACE[6],
        paddingRight: SPACE[6],
        backgroundColor: COLOR.bg.primary,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
      }}>
        <Link href="/" style={{
          flexShrink: 0,
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: 15,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.12em',
          textDecoration: 'none',
        }}>
          POLYMER BIO
        </Link>
        <nav className="bio-header-nav" style={{
          marginLeft: 'auto',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[5],
          overflowX: 'auto',
        }}>
          <a href="#cytowell" className="bio-navlink">CytoWell</a>
          <a href="#benchmark" className="bio-navlink">Benchmark</a>
          <a href="#platform" className="bio-navlink">Platform</a>
          <a href="#partner" className="bio-navlink">Partner</a>
          <Link href="/claims" className="bio-navlink">Claims</Link>
          <Link href="/" className="bio-navlink">Genomics</Link>
        </nav>
      </header>

      <section style={{
        ...contentShell,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(340px, 0.85fr)',
        gap: SPACE[16],
        alignItems: 'center',
        minHeight: 'calc(100vh - 56px)',
        paddingTop: SPACE[16],
        paddingBottom: SPACE[16],
      }} className="bio-hero-grid">
        <div className="bio-rise" style={{ animationDelay: '0.04s' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: SPACE[3],
            marginBottom: SPACE[6],
          }}>
            <Status tone="blue">Polymer Bio</Status>
            <Status tone="neutral">Pre-seed</Status>
          </div>
          <h1 style={{
            margin: 0,
            maxWidth: 850,
            color: COLOR.text.primary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE['3xl'].fontSize,
            lineHeight: TYPE['3xl'].lineHeight,
            letterSpacing: TYPE['3xl'].letterSpacing,
            fontWeight: WEIGHT.bold,
          }}>
            The functional design foundry for programmable RNA
          </h1>
          <p style={{
            margin: `${SPACE[6]}px 0 0`,
            maxWidth: 760,
            color: COLOR.text.secondary,
            fontSize: TYPE.lg.fontSize,
            lineHeight: TYPE.lg.lineHeight,
            letterSpacing: TYPE.lg.letterSpacing,
          }}>
            Polymer Bio is building a partnered discovery platform that turns large RNA
            design spaces into documented, validated lead-selection decisions.
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: SPACE[3],
            marginTop: SPACE[8],
          }}>
            <Cta href={PARTNER_EMAIL} primary>Discuss a design program</Cta>
            <Cta href={DECK_EMAIL}>Request the pre-seed deck</Cta>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: SPACE[4],
            marginTop: SPACE[10],
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            <span>Partnered discovery</span>
            <span aria-hidden>·</span>
            <span>Programmable RNA</span>
            <span aria-hidden>·</span>
            <span>Founder-led</span>
          </div>
        </div>

        <aside className="bio-rise" style={{
          animationDelay: '0.16s',
          padding: SPACE[8],
          border: `1px solid ${COLOR.primary.base}`,
          backgroundColor: `${COLOR.primary.base}0A`,
          borderRadius: 2,
        }}>
          <div style={{
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.semibold,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: SPACE[6],
          }}>
            One recursive platform
          </div>
          {[
            ['01', 'Polymer Claims', 'governed memory', 'built'],
            ['02', 'Schema-guided agents', 'propose', 'proposed'],
            ['03', 'SensorKit', 'generates', 'built'],
            ['04', 'CytoWell', 'tests', 'proposed'],
            ['05', 'Robotics', 'scales', 'proposed'],
          ].map(([index, name, verb, status], i) => (
            <div key={name} style={{
              display: 'grid',
              gridTemplateColumns: '34px minmax(0, 1fr) auto',
              gap: SPACE[3],
              alignItems: 'center',
              paddingTop: i === 0 ? 0 : SPACE[4],
              paddingBottom: SPACE[4],
              borderBottom: i === 4 ? 'none' : `1px solid ${COLOR.border.subtle}`,
            }}>
              <span style={{
                color: COLOR.text.faint,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
              }}>
                {index}
              </span>
              <div>
                <div style={{
                  color: COLOR.text.primary,
                  fontSize: TYPE.base.fontSize,
                  fontWeight: WEIGHT.semibold,
                }}>
                  {name}
                </div>
                <div style={{
                  color: COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.xs.fontSize,
                  marginTop: SPACE[1],
                }}>
                  {verb}
                </div>
              </div>
              <Status tone={status === 'built' ? 'blue' : 'amber'}>{status}</Status>
            </div>
          ))}
          <p style={{
            margin: `${SPACE[5]}px 0 0`,
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            lineHeight: TYPE.sm.lineHeight,
          }}>
            Every result is designed to improve the next library while preserving
            evidence, contradiction, quality, and decision provenance.
          </p>
        </aside>
      </section>

      <section style={{
        ...contentShell,
        ...sectionRule,
      }}>
        <SectionHeader
          index="01"
          label="The bottleneck"
          title="RNA design is outrunning experimental truth"
          body="The limiting resource is not the ability to propose more candidates. It is decision-grade functional evidence that preserves the identity, context, trajectory, and consequence of a complete construct."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACE[5],
        }}>
          <Card
            eyebrow="Design supply"
            title="Candidate generation has accelerated"
            tone="violet"
            body="Sequence, architecture, chemistry, delivery, and cellular state create a design space that cannot be navigated by intuition alone."
          />
          <Card
            eyebrow="Evidence bottleneck"
            title="Rich experiments remain slow and serial"
            tone="blue"
            body="High-throughput approaches often simplify context, collapse time into an endpoint, or make construct identity expensive to recover."
          />
          <Card
            eyebrow="Decision failure"
            title="The endpoint winner can be the wrong lead"
            tone="amber"
            body="Leak, delay, heterogeneity, viability, or payload consequence can reverse a ranking after the apparent winner has already advanced."
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: SPACE[4],
          marginTop: SPACE[8],
        }}>
          {[
            ['01', 'Design explosion', 'AI can propose more biological designs than industry can test.'],
            ['02', 'Evidence scarcity', 'Models remain limited by sparse and context-poor functional labels.'],
            ['03', 'Fabrication access', 'Precision fabrication is increasingly accessible without owning a fab.'],
            ['04', 'RNA maturity', 'Programmable RNA is consequential, while sequence–function uncertainty remains large.'],
          ].map(([index, title, body]) => (
            <div key={index} style={{
              padding: SPACE[5],
              borderTop: `2px solid ${COLOR.primary.base}`,
              backgroundColor: COLOR.bg.elevated,
            }}>
              <div style={{
                color: COLOR.text.faint,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                marginBottom: SPACE[3],
              }}>
                {index}
              </div>
              <div style={{
                color: COLOR.text.primary,
                fontSize: TYPE.base.fontSize,
                fontWeight: WEIGHT.semibold,
                marginBottom: SPACE[2],
              }}>
                {title}
              </div>
              <div style={{
                color: COLOR.text.secondary,
                fontSize: TYPE.sm.fontSize,
                lineHeight: TYPE.sm.lineHeight,
              }}>
                {body}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: SPACE[8],
          padding: `${SPACE[5]}px ${SPACE[6]}px`,
          border: `1px solid ${COLOR.primary.base}`,
          backgroundColor: `${COLOR.primary.base}0A`,
          color: COLOR.primary.active,
          fontSize: TYPE.lg.fontSize,
          lineHeight: TYPE.lg.lineHeight,
          fontWeight: WEIGHT.semibold,
          textAlign: 'center',
        }}>
          Biology&apos;s next scaling step is fabricated experimentation.
        </div>
      </section>

      <section id="cytowell" style={{
        ...contentShell,
        ...sectionRule,
        scrollMarginTop: LAYOUT.headerHeight + SPACE[4],
      }}>
        <SectionHeader
          index="02"
          label="CytoWell"
          title="Encode distinct experiments into one physical architecture"
          body="CytoWell is the proposed experimental engine inside Polymer Bio. It is designed to keep construct identity, cellular context, controlled delivery, longitudinal phenotype, quality, and decision provenance linked."
        />
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: SPACE[3],
          marginBottom: SPACE[6],
        }}>
          <Status tone="amber">Proposed</Status>
          <Status tone="rose">Performance unvalidated</Status>
          <span style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
          }}>
            Architecture intent—not experimental performance data.
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: SPACE[3],
        }}>
          <FlowStep index="01" name="Print" detail="Known RNA designs at known spatial addresses" tone="blue" />
          <FlowStep index="02" name="Load" detail="Matched target-positive and target-negative contexts" tone="neutral" />
          <FlowStep index="03" name="Deliver" detail="Localized release and electroporation" tone="amber" />
          <FlowStep index="04" name="Measure" detail="Longitudinal functional outputs" tone="violet" />
          <FlowStep index="05" name="Record" detail="Construct, context, quality, and provenance" tone="neutral" />
          <FlowStep index="06" name="Learn" detail="Rank, reconstruct, validate, and iterate" tone="blue" />
        </div>
        <div style={{
          marginTop: SPACE[8],
          padding: `${SPACE[8]}px ${SPACE[6]}px`,
          border: `1px solid ${COLOR.border.strong}`,
          backgroundColor: COLOR.bg.deep,
          textAlign: 'center',
        }}>
          <div style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.semibold,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: SPACE[4],
          }}>
            The intended experimental object
          </div>
          <div className="bio-equation" style={{
            color: COLOR.text.primary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.lg.fontSize,
            lineHeight: TYPE.lg.lineHeight,
            fontWeight: WEIGHT.bold,
          }}>
            RNA design × cell context × controlled dose × time × functional phenotype
          </div>
          <div style={{
            marginTop: SPACE[4],
            color: COLOR.primary.base,
            fontSize: TYPE.md.fontSize,
            fontWeight: WEIGHT.semibold,
          }}>
            Not more cells—more information per construct–context pair.
          </div>
        </div>
      </section>

      <section id="benchmark" style={{
        ...contentShell,
        ...sectionRule,
        scrollMarginTop: LAYOUT.headerHeight + SPACE[4],
      }}>
        <SectionHeader
          index="03"
          label="First proving ground"
          title="Mutation-gated conditional-payload sensor optimization"
          body="The first benchmark asks whether a complete RNA sensor can activate in an intended mutation-defined context while controlling leak, kinetics, heterogeneity, viability, and payload consequence in a matched negative context."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
          gap: SPACE[5],
        }}>
          <Card
            eyebrow="Target-positive context"
            title="Mutation-defined RNA state → payload on"
            tone="blue"
            body={
              <InlineList items={[
                'Sequence-matched sensing',
                'High intended activation',
                'Controlled kinetics',
                'Cell-therapy-relevant output',
              ]} />
            }
          />
          <Card
            eyebrow="Matched target-negative context"
            title="Normal RNA state → payload off"
            tone="amber"
            body={
              <InlineList items={[
                'Prespecified leak tolerance',
                'Matched cellular context',
                'Viability retained',
                'No hidden late failure',
              ]} />
            }
          />
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.86fr) minmax(0, 1.14fr)',
          gap: SPACE[6],
          alignItems: 'stretch',
          marginTop: SPACE[8],
        }} className="bio-benchmark-grid">
          <div style={{
            padding: SPACE[6],
            border: `1px solid ${COLOR.border.strong}`,
            backgroundColor: COLOR.bg.elevated,
          }}>
            <Status tone="amber">Proposed test</Status>
            <h3 style={{
              margin: `${SPACE[5]}px 0 ${SPACE[3]}px`,
              color: COLOR.text.primary,
              fontSize: TYPE.lg.fontSize,
              lineHeight: TYPE.lg.lineHeight,
              fontWeight: WEIGHT.semibold,
            }}>
              The same library, tested three ways
            </h3>
            <InlineList items={[
              'Flow: endpoint distributions and orthogonal validation',
              'Plate imaging: longitudinal but lower-density arraying',
              'CytoWell: native construct address and matched trajectories',
            ]} />
          </div>
          <div style={{
            padding: SPACE[6],
            border: `1px solid ${COLOR.primary.base}`,
            backgroundColor: `${COLOR.primary.base}08`,
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: SPACE[3],
              alignItems: 'center',
            }}>
              <div style={{
                color: COLOR.primary.base,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
                fontWeight: WEIGHT.semibold,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Illustrative decision logic
              </div>
              <Status tone="rose">Not experimental data</Status>
            </div>
            <div className="bio-rank-flow" style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr auto 1fr',
              gap: SPACE[4],
              alignItems: 'center',
              marginTop: SPACE[8],
            }}>
              <div style={{
                padding: SPACE[5],
                border: `1px solid ${COLOR.border.strong}`,
                backgroundColor: COLOR.bg.deep,
                textAlign: 'center',
              }}>
                <div style={{ color: COLOR.text.tertiary, fontSize: TYPE.xs.fontSize, textTransform: 'uppercase' }}>
                  Endpoint rank
                </div>
                <div style={{ marginTop: SPACE[3], fontSize: TYPE.lg.fontSize, fontWeight: WEIGHT.bold }}>
                  A &gt; B &gt; C
                </div>
              </div>
              <div aria-hidden style={{ color: COLOR.accent.amber, fontSize: TYPE.xl.fontSize }}>→</div>
              <div style={{
                padding: SPACE[5],
                border: `1px solid ${COLOR.primary.base}`,
                backgroundColor: `${COLOR.primary.base}0A`,
                textAlign: 'center',
              }}>
                <div style={{ color: COLOR.primary.base, fontSize: TYPE.xs.fontSize, textTransform: 'uppercase' }}>
                  Trajectory rank
                </div>
                <div style={{ marginTop: SPACE[3], color: COLOR.primary.base, fontSize: TYPE.lg.fontSize, fontWeight: WEIGHT.bold }}>
                  B &gt; A &gt; C
                </div>
              </div>
              <div aria-hidden style={{ color: COLOR.primary.base, fontSize: TYPE.xl.fontSize }}>→</div>
              <div style={{
                padding: SPACE[5],
                border: `1px solid ${COLOR.primary.base}`,
                backgroundColor: COLOR.bg.elevated,
                textAlign: 'center',
              }}>
                <div style={{ color: COLOR.text.tertiary, fontSize: TYPE.xs.fontSize, textTransform: 'uppercase' }}>
                  Rebuild
                </div>
                <div style={{ marginTop: SPACE[3], color: COLOR.primary.base, fontSize: TYPE.lg.fontSize, fontWeight: WEIGHT.bold }}>
                  B wins
                </div>
              </div>
            </div>
            <p style={{
              margin: `${SPACE[6]}px 0 0`,
              color: COLOR.text.secondary,
              fontSize: TYPE.base.fontSize,
              lineHeight: TYPE.base.lineHeight,
              textAlign: 'center',
            }}>
              Success is a ranking inversion that survives independent reconstruction—not
              a claim of abstract throughput.
            </p>
          </div>
        </div>
      </section>

      <section id="partner" style={{
        ...contentShell,
        ...sectionRule,
        scrollMarginTop: LAYOUT.headerHeight + SPACE[4],
      }}>
        <SectionHeader
          index="04"
          label="Product and customer"
          title="We sell the lead-selection decision—not the chip"
          body="The initial customer is a therapeutic program owner with many RNA constructs, scarce experimental material, and a program deadline. Polymer delivers a documented decision package, not instrument time or a data dump."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACE[5],
        }}>
          <Card
            eyebrow="Who"
            title="Therapeutic program owners"
            tone="blue"
            body={
              <InlineList items={[
                'RNA therapeutics and synthetic biology',
                'Cell-therapy discovery',
                'Pharma translational science',
                'Programmable genetic medicines',
              ]} />
            }
          />
          <Card
            eyebrow="Trigger"
            title="A lead must be nominated"
            tone="amber"
            body={
              <InlineList items={[
                'Many complete constructs',
                'Scarce primary material',
                'Leak or kinetics can invalidate a winner',
                'An active program timeline',
              ]} />
            }
          />
          <Card
            eyebrow="Deliverable"
            title="A transfer-ready decision"
            tone="violet"
            body={
              <InlineList items={[
                'Ranked candidates',
                'Independently reconstructed winner',
                'Orthogonal validation',
                'Protocol and evidence chain',
              ]} />
            }
          />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: SPACE[3],
          marginTop: SPACE[8],
        }}>
          {[
            ['01', 'Paid evaluation', 'Fixed-scope feasibility'],
            ['02', 'Funded campaign', 'Library, assay, and technical gates'],
            ['03', 'Lead package', 'Rank, rebuild, validate, transfer'],
            ['04', 'Program rights', 'Field-defined option or license'],
            ['05', 'Downstream', 'Participation where origination justifies it'],
          ].map(([index, title, detail]) => (
            <div key={index} style={{
              padding: SPACE[5],
              border: `1px solid ${COLOR.border.default}`,
              backgroundColor: COLOR.bg.elevated,
            }}>
              <div style={{
                color: COLOR.text.faint,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.xs.fontSize,
              }}>
                {index}
              </div>
              <div style={{
                marginTop: SPACE[4],
                color: COLOR.text.primary,
                fontSize: TYPE.base.fontSize,
                fontWeight: WEIGHT.semibold,
              }}>
                {title}
              </div>
              <div style={{
                marginTop: SPACE[2],
                color: COLOR.text.secondary,
                fontSize: TYPE.sm.fontSize,
                lineHeight: TYPE.sm.lineHeight,
              }}>
                {detail}
              </div>
            </div>
          ))}
        </div>
        <p style={{
          margin: `${SPACE[5]}px 0 0`,
          color: COLOR.text.tertiary,
          fontSize: TYPE.sm.fontSize,
          textAlign: 'center',
        }}>
          Commercial structure is proposed and remains subject to customer discovery and program-specific agreements.
        </p>
      </section>

      <section id="platform" style={{
        ...contentShell,
        ...sectionRule,
        scrollMarginTop: LAYOUT.headerHeight + SPACE[4],
      }}>
        <SectionHeader
          index="05"
          label="Compounding platform"
          title="Every campaign improves the next design cycle"
          body="The physical engine is only one layer. Polymer Claims governs the evidence; schema-guided reasoning identifies an informative next experiment; SensorKit turns that reasoning into a reviewable construct library."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: SPACE[4],
        }}>
          <PlatformNode
            name="Polymer Claims"
            verb="provides memory"
            detail="Grammar, protocol, accumulating store, measurement registry, and Claims Universe viewer."
            status="built"
            tone="blue"
          />
          <PlatformNode
            name="Schema-guided agents"
            verb="propose"
            detail="Bounded recommendations with evidence, counterevidence, assumptions, and an audit trace."
            status="proposed"
            tone="violet"
          />
          <PlatformNode
            name="SensorKit"
            verb="generates"
            detail="RNA-sensor scoring, construct assembly, design checks, and a Construct Studio interface."
            status="built"
            tone="amber"
          />
          <PlatformNode
            name="Human review"
            verb="approves"
            detail="Scientists retain authority over candidate selection, synthesis release, and experimental execution."
            status="human-gated"
            tone="neutral"
          />
          <PlatformNode
            name="CytoWell"
            verb="tests"
            detail="Proposed construct-linked functional experimentation across cellular context, dose, and time."
            status="proposed"
            tone="blue"
          />
          <PlatformNode
            name="Robotics"
            verb="scales"
            detail="Proposed repeatable execution across devices, runs, and campaigns after the assay is qualified."
            status="proposed"
            tone="neutral"
          />
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[5],
          marginTop: SPACE[8],
          padding: SPACE[6],
          border: `1px solid ${COLOR.border.strong}`,
          backgroundColor: COLOR.bg.deep,
        }}>
          <div>
            <div style={{
              color: COLOR.text.primary,
              fontSize: TYPE.md.fontSize,
              fontWeight: WEIGHT.semibold,
              marginBottom: SPACE[2],
            }}>
              Inspect the working governed-evidence layer
            </div>
            <div style={{
              color: COLOR.text.secondary,
              fontSize: TYPE.base.fontSize,
            }}>
              Polymer Claims is a built predecessor asset. CytoWell integration remains proposed.
            </div>
          </div>
          <Cta href="/claims">Explore Polymer Claims</Cta>
        </div>
      </section>

      <section style={{
        ...contentShell,
        ...sectionRule,
      }}>
        <SectionHeader
          index="06"
          label="Founder-led execution"
          title="The integration is visible before the hardware proof"
          body="The founding advantage is not expertise in only one layer. It is the ability to connect mutation biology, RNA design, experimental systems, evidence standards, and working software into one testable platform thesis."
        />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
          gap: SPACE[6],
        }} className="bio-execution-grid">
          <div style={{
            padding: SPACE[6],
            border: `1px solid ${COLOR.primary.base}`,
            backgroundColor: `${COLOR.primary.base}08`,
          }}>
            <Status tone="blue">Built foundation</Status>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: SPACE[5],
              marginTop: SPACE[6],
            }}>
              {[
                ['Polymer Claims', 'Governed evidence, persistent standing, and an inspectable universe.'],
                ['SensorKit', 'RNA-sensor scoring, construct assembly, design checks, and Studio interface.'],
                ['Polymer Genomics', 'Working genome-scale data, analysis tools, API, and agent interfaces.'],
                ['CytoWell groundwork', 'Technical specifications and preliminary fabrication-partner work.'],
              ].map(([title, detail]) => (
                <div key={title}>
                  <div style={{
                    color: COLOR.text.primary,
                    fontSize: TYPE.base.fontSize,
                    fontWeight: WEIGHT.semibold,
                    marginBottom: SPACE[2],
                  }}>
                    {title}
                  </div>
                  <div style={{
                    color: COLOR.text.secondary,
                    fontSize: TYPE.sm.fontSize,
                    lineHeight: TYPE.sm.lineHeight,
                  }}>
                    {detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            padding: SPACE[6],
            border: `1px solid ${COLOR.accent.amber}`,
            backgroundColor: `${COLOR.accent.amber}0A`,
          }}>
            <Status tone="amber">Financing adds</Status>
            <div style={{ marginTop: SPACE[6] }}>
              <InlineList items={[
                'Device, electrical, and microfluidic ownership',
                'Later research-associate assay capacity',
                'Fractional RNA-engineering support',
                'Passive and electrified CytoWell proof',
                'One decision-changing benchmark',
                'A partner-ready lead package',
              ]} />
            </div>
          </div>
        </div>
      </section>

      <section style={{
        ...contentShell,
        ...sectionRule,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: SPACE[8],
          alignItems: 'center',
          padding: SPACE[10],
          border: `1px solid ${COLOR.primary.base}`,
          backgroundColor: COLOR.primary.active,
        }} className="bio-contact-grid">
          <div>
            <div style={{
              color: COLOR.bg.white,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.semibold,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: SPACE[4],
            }}>
              Start a conversation
            </div>
            <h2 style={{
              margin: 0,
              color: COLOR.bg.white,
              fontSize: TYPE.xl.fontSize,
              lineHeight: TYPE.xl.lineHeight,
              letterSpacing: TYPE.xl.letterSpacing,
              fontWeight: WEIGHT.bold,
            }}>
              Does your RNA program have a lead-selection problem?
            </h2>
            <p style={{
              margin: `${SPACE[4]}px 0 0`,
              maxWidth: 720,
              color: COLOR.bg.white,
              fontSize: TYPE.md.fontSize,
              lineHeight: TYPE.md.lineHeight,
              opacity: 0.86,
            }}>
              We are speaking with RNA, synthetic-biology, cell-therapy, and translational
              program owners about the evidence that would change an advancement decision.
            </p>
          </div>
          <a href={PARTNER_EMAIL} className="bio-cta bio-cta-on-dark" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            padding: `${SPACE[3]}px ${SPACE[5]}px`,
            border: `1px solid ${COLOR.bg.white}`,
            backgroundColor: COLOR.bg.white,
            color: COLOR.primary.active,
            borderRadius: 2,
            fontSize: TYPE.base.fontSize,
            fontWeight: WEIGHT.semibold,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Discuss a design program
          </a>
        </div>
      </section>

      <section style={{
        ...contentShell,
        paddingTop: SPACE[8],
        paddingBottom: SPACE[8],
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: SPACE[3],
          padding: SPACE[5],
          border: `1px solid ${COLOR.border.strong}`,
          backgroundColor: COLOR.bg.deep,
        }}>
          <Status tone="amber">Development-stage platform</Status>
          <span style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            lineHeight: TYPE.sm.lineHeight,
          }}>
            Polymer Claims, SensorKit, and Polymer Genomics are built predecessor assets.
            CytoWell performance, canonical closed-loop integration, and robotic execution
            remain proposed or unvalidated until demonstrated. Illustrative rankings are not
            experimental data. Research use only; not for clinical or diagnostic use.
          </span>
        </div>
      </section>

      <footer style={{
        borderTop: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[5]}px ${SPACE[6]}px`,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE[4],
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[4],
          alignItems: 'center',
          fontSize: TYPE.sm.fontSize,
        }}>
          <Link href="/" className="bio-navlink">Polymer Bio</Link>
          <Link href="/claims" className="bio-navlink">Claims</Link>
          <Link href="/docs" className="bio-navlink">Genomics docs</Link>
          <Link href="/terms" className="bio-navlink">Terms</Link>
          <Link href="/privacy" className="bio-navlink">Privacy</Link>
        </div>
        <div style={{
          color: COLOR.text.muted,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.04em',
        }}>
          © 2026 Polymer Bio
        </div>
      </footer>
    </main>
  );
}
