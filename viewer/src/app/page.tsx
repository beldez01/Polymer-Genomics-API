import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import {
  COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE,
} from '@/config/theme';

/* ────────────────────────────────────────────────────────────────────────
   Polymer Bio landing — umbrella front door.

   IA is organized by SUBSECTION, not by tool verb. Two visible pathways —
   Polymer Genomics and Polymer Claims — lead as cards, then expand into
   route listings below. Polymer Biologics is intentionally NOT surfaced
   here (route stays live + directly reachable, but unlinked).
   ──────────────────────────────────────────────────────────────────────── */

const VIEWER_HREF =
  '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

/* ── Lead pathways — the visible Polymer Bio subsections ─────────────────── */

interface Pathway {
  name: string;
  desc: string;
  href: string;
  tag: string;
}

const PATHWAYS: Pathway[] = [
  {
    name: 'Polymer Genomics',
    desc: 'Genome-wide DNA biophysics — the genome viewer, the Chromosome Atlas, and the full analysis suite.',
    href: VIEWER_HREF,
    tag: '50 layers',
  },
  {
    name: 'Polymer Claims',
    desc: 'A live universe of machine-verifiable scientific claims — each licensed by evidence, not asserted.',
    href: '/claims',
    tag: 'live corpus',
  },
];

/* ── Route listings, grouped under each subsection ──────────────────────── */

interface Module {
  name: string;
  desc: string;
  href: string;
  count?: string;
}

const MODULES_GENOMICS: Module[] = [
  {
    name: 'Genome viewer',
    desc: 'Browse any locus with biophysics layers — stacking energy, curvature, CpG density, isochores. hg38 + hg37.',
    href: VIEWER_HREF,
    count: '50 layers',
  },
  {
    name: 'Atlas',
    desc: 'GENCODE v44 gene profiles with expression, pathways, constraint, biosynthetic cost.',
    href: '/atlas',
    count: '63K txs',
  },
  {
    name: 'Evaluate',
    desc: 'Physics linter for any DNA sequence. Thermodynamic profile, CpG islands, structural flags, batch mode.',
    href: '/evaluate',
    count: '13 flags',
  },
  {
    name: 'Methylation',
    desc: 'DMP volcano and Manhattan plots, TE/ERV family scoring, reactivation risk, Retro-Age clock.',
    href: '/dmp',
    count: '937K probes',
  },
  {
    name: 'Epigenetic clocks',
    desc: 'Probe anatomy, cross-clock comparison, coefficient application.',
    href: '/clocks',
    count: '6 clocks',
  },
  {
    name: 'Transposome',
    desc: 'Transposable elements with TE age, awakening potential, EPIC v2 probe overlap.',
    href: '/transposome',
    count: '5.6M TEs',
  },
  {
    name: 'HLA',
    desc: 'Allele biophysics for transplant loci. Non-coding divergence, expression mismatch scoring.',
    href: '/hla',
    count: '6 loci',
  },
  {
    name: 'API & MCP',
    desc: 'REST endpoints and Model Context Protocol for AI agents. Reference + compute tools, evidence-class metadata.',
    href: '/docs',
    count: '70 tools',
  },
  {
    name: 'Developers',
    desc: 'Quickstart, code examples, try-it evaluator, data inventory. Python SDK on PyPI.',
    href: '/developers',
    count: 'pip install',
  },
];

const MODULES_CLAIMS: Module[] = [
  {
    name: 'Claims',
    desc: 'The Polymer Claims universe — a live topology of machine-verifiable scientific claims: status-colored nodes, defeat / equivalence / entails edges, each licensed by evidence, not asserted.',
    href: '/claims',
    count: 'live corpus',
  },
];

/* ────────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────────── */

function PathwayCard({ p }: { p: Pathway }) {
  return (
    <Link
      href={p.href}
      className="pathway-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: SPACE[6],
        minHeight: 168,
        border: `1px solid ${COLOR.border.strong}`,
        backgroundColor: COLOR.bg.elevated,
        borderRadius: 2,
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], marginBottom: SPACE[3] }}>
        <span
          aria-hidden
          style={{ width: 8, height: 8, backgroundColor: COLOR.primary.base, flexShrink: 0 }}
        />
        <span style={{
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.lg.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: TYPE.lg.letterSpacing,
        }}>
          {p.name}
        </span>
      </div>

      <span style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        lineHeight: TYPE.base.lineHeight,
        marginBottom: SPACE[5],
      }}>
        {p.desc}
      </span>

      <div style={{
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span className="tabular" style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {p.tag}
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

function ModuleRow({ mod }: { mod: Module }) {
  return (
    <Link
      href={mod.href}
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr auto 20px',
        columnGap: SPACE[5],
        alignItems: 'baseline',
        padding: `${SPACE[4]}px ${SPACE[2]}px`,
        borderBottom: `1px solid ${COLOR.border.default}`,
        textDecoration: 'none',
      }}
    >
      <span style={{
        color: COLOR.text.primary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.md.fontSize,
        fontWeight: WEIGHT.semibold,
        letterSpacing: TYPE.md.letterSpacing,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: SPACE[3],
      }}>
        {/* Data swatch — inline with name so it baselines naturally. */}
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            backgroundColor: COLOR.primary.base,
            transform: 'translateY(-1px)',
            flexShrink: 0,
          }}
        />
        {mod.name}
      </span>
      <span style={{
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        lineHeight: TYPE.base.lineHeight,
      }}>
        {mod.desc}
      </span>
      <span className="tabular" style={{
        color: COLOR.text.tertiary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        justifySelf: 'end',
      }}>
        {mod.count ?? ''}
      </span>
      <span aria-hidden style={{
        color: COLOR.text.faint,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        justifySelf: 'end',
        alignSelf: 'center',
      }}>
        →
      </span>
    </Link>
  );
}

function ModuleGroup({ index, label, modules }: { index: string; label: string; modules: Module[] }) {
  return (
    <div style={{ marginBottom: SPACE[12] }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[4],
        paddingBottom: SPACE[3],
        marginBottom: SPACE[2],
        borderBottom: `1px solid ${COLOR.border.strong}`,
      }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.1em',
        }}>
          §{index}
        </span>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      </div>
      <div>
        {modules.map((m) => <ModuleRow key={m.name} mod={m} />)}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar sticky />

      {/* HERO — umbrella. Material-channel framing intentionally retired. */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[24]}px ${SPACE[6]}px ${SPACE[10]}px`,
      }}>
        <div style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: SPACE[6],
        }}>
          Genomics &nbsp;·&nbsp; Claims
        </div>

        <h1 style={{
          margin: 0,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE['2xl'].fontSize,
          lineHeight: TYPE['2xl'].lineHeight,
          letterSpacing: TYPE['2xl'].letterSpacing,
          fontWeight: WEIGHT.bold,
          color: COLOR.primary.base,
          marginBottom: SPACE[5],
        }}>
          Polymer Bio
        </h1>

        {/* Placeholder umbrella tagline — refine positioning copy later. */}
        <p style={{
          margin: 0,
          maxWidth: 660,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.55,
          letterSpacing: TYPE.md.letterSpacing,
          fontWeight: WEIGHT.normal,
        }}>
          Computational infrastructure for the genome — from base-pair biophysics to
          a live universe of evidence-licensed claims.
        </p>
      </section>

      {/* LEAD PATHWAYS — the two visible subsections */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `0 ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACE[4],
        }}>
          {PATHWAYS.map((p) => <PathwayCard key={p.name} p={p} />)}
        </div>
      </section>

      {/* ROUTE LISTINGS — grouped by subsection */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[4]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        <ModuleGroup index="01" label="Polymer Genomics" modules={MODULES_GENOMICS} />
        <ModuleGroup index="02" label="Polymer Claims"   modules={MODULES_CLAIMS} />
      </section>

      <Footer />
    </main>
  );
}
