import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ChromosomeSVG } from '@/components/atlas/ChromosomeSVG';
import { KARYOTYPE, KARYOTYPE_MAX_LEN, getIsochoreBins } from '@/config/karyotypeData';
import { MCP_TOTAL } from '@/config/apiDocsData';
import {
  COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE,
} from '@/config/theme';

/* ────────────────────────────────────────────────────────────────────────
   Polymer Genomics — the tooling front door.

   Two lead surfaces carry the section: the genome viewer and the digital
   karyotype. Each shows a miniature of its own output rather than a
   screenshot — the karyotype reuses the real ChromosomeSVG so the preview
   and the Atlas can never drift apart. Everything else drops below the
   rule as a compact card grid.
   ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Polymer Genomics — reference genome data and analysis infrastructure',
  description:
    'Multi-layer reference-genome data and analysis infrastructure: a genome viewer with material-channel biophysics, a digital karyotype, a sequence evaluator, methylation tooling, and an agent-ready API.',
  alternates: { canonical: '/genomics' },
};

const VIEWER_HREF =
  '/genomics/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

const SHELL = { maxWidth: 960, margin: '0 auto' } as const;

/* ── Thumbnail 1 — genome viewer ─────────────────────────────────────────
   A decorative reduction of the track stack. The real tracks are canvas +
   live viewport data, so this is drawn from the same layer palette instead
   of mounting them. Values are fixed literals: deterministic, SSR-safe.
   ──────────────────────────────────────────────────────────────────────── */

const EXONS: Array<[number, number]> = [
  [10, 18], [38, 12], [66, 26], [110, 9], [136, 20], [176, 14], [214, 30], [262, 11], [288, 22],
];
const CPG: number[] = [
  3, 5, 4, 8, 14, 19, 15, 9, 5, 4, 6, 5, 3, 4, 7, 12, 17, 21, 16, 10,
  6, 4, 3, 5, 4, 6, 9, 13, 11, 7, 5, 3, 4, 6, 5, 4, 8, 12, 9, 5,
];
const PROBES: number[] = [
  14, 29, 36, 52, 61, 78, 84, 97, 118, 131, 147, 158, 173, 189, 196, 214,
  228, 241, 256, 268, 279, 291, 303, 312,
];
const ISOCHORE_RUN: Array<[number, keyof typeof COLOR.isochore]> = [
  [34, 'L2'], [22, 'H1'], [46, 'H2'], [30, 'H3'], [26, 'H2'], [40, 'L2'], [52, 'L1'], [70, 'H1'],
];

function ViewerThumb() {
  let x = 0;
  return (
    <svg
      viewBox="0 0 320 96"
      preserveAspectRatio="none"
      role="img"
      aria-label="Stacked genome tracks: gene model, CpG density, array probes, and isochore classes."
      style={{ display: 'block', width: '100%', height: 96 }}
    >
      {/* coordinate ruler */}
      <line x1={0} y1={9} x2={320} y2={9} stroke={COLOR.border.strong} strokeWidth={1} />
      {[0, 64, 128, 192, 256, 319].map((tx) => (
        <line key={tx} x1={tx} y1={5} x2={tx} y2={9} stroke={COLOR.border.strong} strokeWidth={1} />
      ))}

      {/* gene model — intron spine with exon blocks */}
      <line x1={6} y1={28} x2={314} y2={28} stroke={COLOR.layer.gencode_v44} strokeWidth={1} />
      {EXONS.map(([ex, ew]) => (
        <rect key={ex} x={ex} y={22} width={ew} height={12} rx={1} fill={COLOR.layer.gencode_v44} />
      ))}

      {/* CpG density — column chart */}
      {CPG.map((v, i) => (
        <rect
          key={i}
          x={i * 8}
          y={62 - v}
          width={6}
          height={v}
          fill={COLOR.layer.cpg_sites}
          opacity={0.85}
        />
      ))}

      {/* EPIC probe ticks */}
      {PROBES.map((px) => (
        <rect key={px} x={px} y={68} width={1.5} height={8} fill={COLOR.layer.probe_epic_v2} />
      ))}

      {/* isochore classification band */}
      {ISOCHORE_RUN.map(([w, klass], i) => {
        const seg = <rect key={i} x={x} y={84} width={w} height={8} fill={COLOR.isochore[klass]} opacity={0.88} />;
        x += w;
        return seg;
      })}
    </svg>
  );
}

/* ── Thumbnail 2 — digital karyotype ─────────────────────────────────────
   The real Atlas component at miniature scale. Geometry and isochore
   coloring come from the same source the Atlas renders from, so the
   preview stays honest for free.
   ──────────────────────────────────────────────────────────────────────── */

const THUMB_CHRS = KARYOTYPE.slice(0, 16);
const THUMB_MAX_H = 92;

function KaryotypeThumb() {
  return (
    <div
      role="img"
      aria-label="Miniature digital karyotype: chromosomes colored by isochore class."
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 3,
        height: 96,
        paddingBottom: SPACE[1],
      }}
    >
      {THUMB_CHRS.map((chr) => (
        <ChromosomeSVG
          key={chr.name}
          chrName={chr.name}
          width={9}
          height={Math.max(30, Math.round((chr.length / KARYOTYPE_MAX_LEN) * THUMB_MAX_H))}
          centromereStart={chr.centromereStart}
          centromereEnd={chr.centromereEnd}
          isochoreBins={getIsochoreBins(chr.name)}
        />
      ))}
    </div>
  );
}

/* ── Lead surfaces ───────────────────────────────────────────────────────── */

interface Lead {
  name: string;
  desc: string;
  href: string;
  tag: string;
  thumb: React.ReactNode;
}

const LEADS: Lead[] = [
  {
    name: 'Genome Viewer',
    desc: 'Browse any locus with material-channel biophysics — stacking energy, curvature, CpG density, and isochore class.',
    href: VIEWER_HREF,
    tag: 'hg38 · hg37',
    thumb: <ViewerThumb />,
  },
  {
    name: 'Digital Karyotype',
    desc: 'The whole genome at a glance — every chromosome banded by isochore class, then drill into any arm or gene.',
    href: '/genomics/atlas',
    tag: '24 chromosomes',
    thumb: <KaryotypeThumb />,
  },
];

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <Link
      href={lead.href}
      className="pathway-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE[5],
        border: `1px solid ${COLOR.border.strong}`,
        backgroundColor: COLOR.bg.elevated,
        borderRadius: 2,
        textDecoration: 'none',
      }}
    >
      {/* preview well — recessed so the artwork reads as output, not decoration */}
      <div
        style={{
          backgroundColor: COLOR.bg.deep,
          border: `1px solid ${COLOR.border.default}`,
          borderRadius: 2,
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          marginBottom: SPACE[5],
          overflow: 'hidden',
        }}
      >
        {lead.thumb}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], marginBottom: SPACE[2] }}>
        <span aria-hidden style={{ width: 8, height: 8, backgroundColor: COLOR.primary.base, flexShrink: 0 }} />
        <span style={{
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.lg.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: TYPE.lg.letterSpacing,
        }}>
          {lead.name}
        </span>
      </div>

      <span style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        lineHeight: TYPE.base.lineHeight,
        marginBottom: SPACE[5],
      }}>
        {lead.desc}
      </span>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="tabular" style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {lead.tag}
        </span>
        <span aria-hidden className="pathway-card-arrow" style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
        }}>
          →
        </span>
      </div>
    </Link>
  );
}

/* ── Everything else ─────────────────────────────────────────────────────── */

interface Tool {
  name: string;
  desc: string;
  href: string;
  count: string;
}

const TOOLS: Tool[] = [
  { name: 'Evaluate',          desc: 'Physics linter for any DNA sequence — thermodynamic profile, CpG islands, structural flags, batch mode.', href: '/genomics/evaluate',        count: '13 flags' },
  { name: 'Methylation',       desc: 'DMP volcano and Manhattan plots, TE/ERV family scoring, reactivation risk, Retro-Age clock.',             href: '/genomics/dmp',             count: '937K probes' },
  { name: 'TE methylation',    desc: 'TE-resolved CpG context — family-level methylation across the repeat landscape.',                          href: '/genomics/te-methylation',  count: '800K CpGs' },
  { name: 'Epigenetic clocks', desc: 'Probe anatomy, cross-clock comparison, coefficient application.',                                          href: '/genomics/clocks',          count: '6 clocks' },
  { name: 'Transposome',       desc: 'Transposable elements with TE age, awakening potential, EPIC v2 probe overlap.',                           href: '/genomics/transposome',     count: '5.6M TEs' },
  { name: 'HLA',               desc: 'Allele biophysics for transplant loci — non-coding divergence, expression mismatch scoring.',              href: '/genomics/hla',             count: '6 loci' },
  { name: 'Claims Universe',   desc: 'A live topology of machine-verifiable claims — status-colored nodes, each licensed by evidence.',         href: '/claims',                   count: 'live corpus' },
  { name: 'API & MCP',         desc: 'REST endpoints and Model Context Protocol for agents — reference plus compute, evidence-class metadata.',  href: '/genomics/docs',            count: `${MCP_TOTAL} tools` },
  { name: 'Developers',        desc: 'Quickstart, code examples, try-it evaluator, data inventory. Python SDK on PyPI.',                         href: '/genomics/developers',      count: 'pip install' },
];

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={tool.href}
      className="pathway-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE[4],
        border: `1px solid ${COLOR.border.default}`,
        backgroundColor: COLOR.bg.elevated,
        borderRadius: 2,
        textDecoration: 'none',
      }}
    >
      <span style={{
        color: COLOR.text.primary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        fontWeight: WEIGHT.semibold,
        marginBottom: SPACE[2],
      }}>
        {tool.name}
      </span>
      <span style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        lineHeight: TYPE.sm.lineHeight,
        marginBottom: SPACE[4],
      }}>
        {tool.desc}
      </span>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="tabular" style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {tool.count}
        </span>
        <span aria-hidden className="pathway-card-arrow" style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.base.fontSize,
        }}>
          →
        </span>
      </div>
    </Link>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function GenomicsIndex() {
  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar sticky />

      {/* HERO */}
      <section className="bio-rise" style={{ ...SHELL, padding: `${SPACE[10]}px ${SPACE[6]}px ${SPACE[8]}px` }}>
        <h1 style={{
          margin: `0 0 ${SPACE[5]}px`,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE['2xl'].fontSize,
          lineHeight: TYPE['2xl'].lineHeight,
          letterSpacing: TYPE['2xl'].letterSpacing,
          fontWeight: WEIGHT.bold,
          color: COLOR.primary.base,
        }}>
          Polymer Genomics
        </h1>

        <p style={{
          margin: 0,
          maxWidth: 660,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.55,
          letterSpacing: TYPE.md.letterSpacing,
        }}>
          Multi-layer reference-genome data and analysis infrastructure — from base-pair
          biophysics to whole-genome structure. Built to support construct design, and
          open to use on its own.
        </p>
      </section>

      {/* LEAD SURFACES */}
      <section className="bio-rise" style={{ ...SHELL, animationDelay: '0.06s', padding: `0 ${SPACE[6]}px ${SPACE[16]}px` }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: SPACE[4],
        }}>
          {LEADS.map((l) => <LeadCard key={l.name} lead={l} />)}
        </div>
      </section>

      {/* MORE TOOLS */}
      <section style={{ ...SHELL, padding: `0 ${SPACE[6]}px ${SPACE[24]}px` }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[4],
          paddingBottom: SPACE[3],
          marginBottom: SPACE[5],
          borderBottom: `1px solid ${COLOR.border.strong}`,
        }}>
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            More genomic tools
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(224px, 1fr))',
          gap: SPACE[3],
        }}>
          {TOOLS.map((t) => <ToolCard key={t.name} tool={t} />)}
        </div>

        {/* Provenance — a reference table rather than a tool, so it sits
            outside the grid instead of orphaning a card row. */}
        <p style={{
          margin: `${SPACE[5]}px 0 0`,
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          lineHeight: TYPE.sm.lineHeight,
        }}>
          Every layer is published with its provenance, license, evidence class, and version pin —{' '}
          <Link href="/genomics/data-sources" style={{ color: COLOR.primary.base, textDecoration: 'none' }}>
            see data sources
          </Link>
          .
        </p>
      </section>

      <Footer />
    </main>
  );
}
