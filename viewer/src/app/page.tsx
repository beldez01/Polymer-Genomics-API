'use client';

import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import { useIsMobile, useIsTablet } from '@/hooks/useBreakpoint';
import {
  MCP_COMPUTE_TOOL_COUNT,
  MCP_REFERENCE_TOOL_COUNT,
  MCP_TOOL_COUNT,
  usePlatformStats,
} from '@/lib/platform-stats';

/* ── Module directory ── */

const VIEWER_HREF = '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

interface Module {
  name: string;
  desc: string;
  href: string;
  accent: string;
}

const TIER_BROWSE: Module[] = [
  {
    name: 'Genome Viewer',
    desc: 'Browse any locus with biophysics layers — stacking energy, curvature, CpG density, isochores. hg38 + hg37.',
    href: VIEWER_HREF,
    accent: COLOR.accent.teal,
  },
  {
    name: 'Atlas',
    desc: '63,000 GENCODE v44 transcripts. Gene profiles with expression, pathways, constraint, biosynthetic cost.',
    href: '/atlas',
    accent: COLOR.layer.gencode_v44,
  },
];

const TIER_ANALYZE: Module[] = [
  {
    name: 'Evaluate',
    desc: 'Physics linter for any DNA sequence. Thermodynamic profile, CpG islands, structural flags, batch mode.',
    href: '/evaluate',
    accent: COLOR.layer.gene_costs_v1,
  },
  {
    name: 'Methylation',
    desc: 'DMP volcano and manhattan plots, TE/ERV family scoring, reactivation risk, Retro-Age clock.',
    href: '/dmp',
    accent: COLOR.accent.rose,
  },
  {
    name: 'Epigenetic Clocks',
    desc: '6 clock systems. Probe anatomy, cross-clock comparison, coefficient application.',
    href: '/clocks',
    accent: COLOR.accent.amber,
  },
  {
    name: 'Transposome',
    desc: '5.6M transposable elements. TE age, awakening potential, EPIC v2 probe overlap.',
    href: '/transposome',
    accent: COLOR.accent.violet,
  },
  {
    name: 'HLA',
    desc: 'Allele biophysics for 6 transplant loci. Non-coding divergence, expression mismatch scoring.',
    href: '/hla',
    accent: COLOR.layer.gencode_v44,
  },
];

const TIER_BUILD: Module[] = [
  {
    name: 'API / MCP',
    desc: `${MCP_TOOL_COUNT} tools (${MCP_REFERENCE_TOOL_COUNT} reference + ${MCP_COMPUTE_TOOL_COUNT} compute). REST endpoints and Model Context Protocol for AI agents.`,
    href: '/docs',
    accent: COLOR.accent.teal,
  },
  {
    name: 'Developers',
    desc: 'Quickstart, code examples, try-it evaluator, data inventory.',
    href: '/developers',
    accent: COLOR.accent.teal,
  },
];

/* ── Shared styles ── */

const PROSE: React.CSSProperties = {
  color: COLOR.text.tertiary,
  fontSize: TYPE.base.fontSize,
  fontFamily: FONT_FAMILY,
  lineHeight: 1.8,
  marginBottom: SPACE[6],
};

/* ── Components ── */

function Divider() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: `${SPACE[10]}px 0` }}>
      <div style={{ width: 120, height: 1, backgroundColor: COLOR.border.subtle }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      color: COLOR.text.faint,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      marginBottom: SPACE[4],
      marginTop: 0,
    }}>
      {children}
    </h2>
  );
}

function FeatureCard({ mod }: { mod: Module }) {
  return (
    <Link
      href={mod.href}
      style={{
        textDecoration: 'none',
        display: 'block',
        borderTop: `2px solid ${mod.accent}`,
        padding: `${SPACE[4]}px 0`,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      <div style={{
        color: COLOR.text.primary,
        fontSize: TYPE.base.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        marginBottom: SPACE[1],
      }}>
        {mod.name}
      </div>
      <div style={{
        color: COLOR.text.muted,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        lineHeight: 1.6,
      }}>
        {mod.desc}
      </div>
    </Link>
  );
}

function SidebarEntry({ mod }: { mod: Module }) {
  return (
    <Link
      href={mod.href}
      style={{
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[2],
        padding: `${SPACE[1]}px 0`,
        color: COLOR.text.secondary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = COLOR.text.primary; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = COLOR.text.secondary; }}
    >
      <div style={{
        width: 6,
        height: 6,
        backgroundColor: mod.accent,
        flexShrink: 0,
      }} />
      {mod.name}
    </Link>
  );
}

/* ── Page ── */

export default function Home() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const stats = usePlatformStats();
  const wideLayout = !isTablet;

  const STATS = [
    { value: '50', label: 'layers' },
    { value: stats.cpg, label: 'CpG sites' },
    { value: stats.probes, label: 'probes' },
    { value: stats.transcripts, label: 'transcripts' },
    { value: stats.mcpTools, label: 'MCP tools' },
  ];

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar />

      <div style={{
        display: wideLayout ? 'flex' : 'block',
        maxWidth: wideLayout ? 1120 : 640,
        margin: '0 auto',
        padding: `0 ${SPACE[6]}px`,
        gap: wideLayout ? SPACE[10] : 0,
      }}>

        {/* ─── Left Sidebar (desktop) ─── */}
        {wideLayout && (
          <aside style={{
            width: 160,
            flexShrink: 0,
            position: 'sticky',
            top: SPACE[6],
            alignSelf: 'flex-start',
            paddingTop: SPACE[24],
          }}>
            <div style={{ marginBottom: SPACE[8] }}>
              {STATS.map((s) => (
                <div key={s.label} style={{
                  marginBottom: SPACE[2],
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.sm.fontSize,
                }}>
                  <span style={{ color: COLOR.text.secondary, fontWeight: WEIGHT.medium }}>
                    {s.value}
                  </span>
                  <span style={{ color: COLOR.text.faint }}> {s.label}</span>
                </div>
              ))}
            </div>

            <div style={{
              width: 40,
              height: 1,
              backgroundColor: COLOR.border.subtle,
              marginBottom: SPACE[8],
            }} />

            <p style={{
              color: COLOR.text.faint,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: 1.7,
              marginBottom: SPACE[4],
            }}>
              Under active construction and internal analysis. New layers and tools
              added continuously. We aspire to concatenate&nbsp;&mdash; to bring as many
              lines of genomic evidence as possible under a unified physical framework.
            </p>
            <p style={{
              color: COLOR.text.faint,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: 1.7,
              marginBottom: SPACE[4],
            }}>
              We welcome input.
            </p>
            <p style={{
              color: COLOR.text.faint,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              fontStyle: 'italic',
              lineHeight: 1.7,
            }}>
              A full elaboration of the theoretical framework is in preparation.
            </p>
          </aside>
        )}

        {/* ─── Center Column ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Hero */}
          <section style={{ padding: `${SPACE[24]}px 0 ${SPACE[10]}px` }}>
            <h1 style={{
              fontSize: TYPE['2xl'].fontSize,
              fontWeight: WEIGHT.bold,
              letterSpacing: '0.12em',
              color: COLOR.accent.teal,
              fontFamily: FONT_FAMILY,
              marginBottom: SPACE[8],
            }}>
              POLYMER GENOMICS
            </h1>

            <p style={{
              color: COLOR.text.secondary,
              fontSize: TYPE.md.fontSize,
              fontFamily: FONT_FAMILY,
              lineHeight: 1.7,
            }}>
              The central dogma of molecular biology governs the transfer of sequence
              information between biopolymers. It is correct as far as it goes. But it
              assumes&nbsp;&mdash; without stating the assumption&nbsp;&mdash; that
              sequence information is the only kind that matters. The molecule carrying
              those sequences is also a physical object, and this site computes its
              material properties genome-wide for the first time.
            </p>
          </section>

          {/* Manifesto */}
          <section style={{ paddingBottom: SPACE[8] }}>
            <p style={PROSE}>
              DNA is not a tape. It is a heteropolymer&nbsp;&mdash; a chain of monomers
              with position-dependent physical-chemical properties. Every base pair has a
              stacking energy, a melting temperature, an intrinsic curvature, a flexibility.
              An AT-rich region and a GC-rich region are, in the language of polymer physics,
              different materials.
            </p>

            <p style={PROSE}>
              This makes two information channels on one molecule. The <em>symbolic
              channel</em> maps codons to amino acids&nbsp;&mdash; the information system
              whose transfer rules the central dogma defines, operating on ~1.5% of the
              genome. The <em>material channel</em> maps sequence to a continuous energy
              surface&nbsp;&mdash; self-executing, requiring no decoder, operating on 100%
              of the genome. The central dogma is silent about this channel.
            </p>

            <p style={PROSE}>
              The material channel is physically prior. Naked DNA in a test tube already
              has its energy surface&nbsp;&mdash; no ribosome, no polymerase, no cell
              required. It predates the genetic code by billions of years. And it
              determines, through the Boltzmann distribution, which regions of the genome
              the symbolic channel can access.
            </p>
          </section>

          {/* Two Channels */}
          <section style={{
            display: 'flex',
            gap: SPACE[6],
            flexDirection: isMobile ? 'column' : 'row',
            paddingBottom: SPACE[6],
          }}>
            {/* Symbolic — muted */}
            <div style={{
              flex: 1,
              borderTop: `2px solid ${COLOR.border.strong}`,
              paddingTop: SPACE[4],
            }}>
              <div style={{
                color: COLOR.text.muted,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.1em',
                marginBottom: SPACE[3],
              }}>
                &sigma; &mdash; THE SYMBOLIC CHANNEL
              </div>
              {['Codons \u2192 amino acids', '~1.5% of the genome', 'Decoder-dependent (ribosome)', 'Described by the central dogma'].map((line) => (
                <div key={line} style={{
                  color: COLOR.text.faint,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.9,
                }}>
                  {line}
                </div>
              ))}
            </div>

            {/* Material — prominent */}
            <div style={{
              flex: 1,
              borderTop: `2px solid ${COLOR.accent.teal}`,
              paddingTop: SPACE[4],
            }}>
              <div style={{
                color: COLOR.accent.teal,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.medium,
                letterSpacing: '0.1em',
                marginBottom: SPACE[3],
              }}>
                &Lambda; &mdash; THE MATERIAL CHANNEL
              </div>
              {['Sequence \u2192 energy surface', '100% of the genome', 'Self-executing (physics)', 'Computed here'].map((line) => (
                <div key={line} style={{
                  color: COLOR.text.secondary,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.9,
                }}>
                  {line}
                </div>
              ))}
            </div>
          </section>

          {/* ─── Tablet/Mobile: sidebar content flows below ─── */}
          {!wideLayout && (
            <>
              <Divider />

              <section style={{ paddingBottom: SPACE[4] }}>
                <p style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.base.fontSize,
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.8,
                  marginBottom: SPACE[6],
                }}>
                  The first genome-wide database of material-channel properties. Every tool
                  below is a way to interact with the energy surface.
                </p>

                <div style={{
                  display: 'flex',
                  gap: SPACE[6],
                  flexWrap: 'wrap',
                  marginBottom: SPACE[4],
                }}>
                  {STATS.map((s, i) => (
                    <span key={s.label} style={{
                      color: COLOR.text.muted,
                      fontSize: TYPE.sm.fontSize,
                      fontFamily: FONT_FAMILY,
                    }}>
                      {i > 0 && <span style={{ color: COLOR.border.strong, marginRight: SPACE[6] }}>&middot;</span>}
                      <span style={{ color: COLOR.text.secondary, fontWeight: WEIGHT.medium }}>{s.value}</span>
                      {' '}{s.label}
                    </span>
                  ))}
                </div>
              </section>

              <Divider />

              <SectionLabel>Browse</SectionLabel>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: SPACE[6],
                marginBottom: SPACE[2],
              }}>
                {TIER_BROWSE.map((mod) => <FeatureCard key={mod.name} mod={mod} />)}
              </div>

              <Divider />

              <SectionLabel>Analyze</SectionLabel>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: SPACE[6],
                marginBottom: SPACE[2],
              }}>
                {TIER_ANALYZE.map((mod) => <FeatureCard key={mod.name} mod={mod} />)}
              </div>

              <Divider />

              <SectionLabel>Build</SectionLabel>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: SPACE[6],
                marginBottom: SPACE[2],
              }}>
                {TIER_BUILD.map((mod) => <FeatureCard key={mod.name} mod={mod} />)}
              </div>

              <Divider />

              <section style={{ paddingBottom: SPACE[16] }}>
                <p style={{
                  color: COLOR.text.tertiary,
                  fontSize: TYPE.base.fontSize,
                  fontFamily: FONT_FAMILY,
                  lineHeight: 1.8,
                  marginBottom: SPACE[6],
                }}>
                  This platform is under active construction and internal analysis. New layers,
                  correlations, and tools are being added continuously. We aspire to
                  concatenate&nbsp;&mdash; to bring as many lines of genomic evidence as possible
                  under a unified physical framework. If you see a connection we have missed, or a
                  question we should be asking, we welcome it.
                </p>

                <p style={{
                  color: COLOR.text.faint,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  fontStyle: 'italic',
                }}>
                  A full elaboration of the theoretical framework is in preparation.
                </p>
              </section>
            </>
          )}
        </div>

        {/* ─── Right Sidebar (desktop) ─── */}
        {wideLayout && (
          <nav style={{
            width: 200,
            flexShrink: 0,
            position: 'sticky',
            top: SPACE[6],
            alignSelf: 'flex-start',
            paddingTop: SPACE[24],
          }}>
            <SectionLabel>Browse</SectionLabel>
            {TIER_BROWSE.map((mod) => <SidebarEntry key={mod.name} mod={mod} />)}

            <div style={{ height: SPACE[6] }} />

            <SectionLabel>Analyze</SectionLabel>
            {TIER_ANALYZE.map((mod) => <SidebarEntry key={mod.name} mod={mod} />)}

            <div style={{ height: SPACE[6] }} />

            <SectionLabel>Build</SectionLabel>
            {TIER_BUILD.map((mod) => <SidebarEntry key={mod.name} mod={mod} />)}
          </nav>
        )}
      </div>

      <Footer />
    </main>
  );
}
