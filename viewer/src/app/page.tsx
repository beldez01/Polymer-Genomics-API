import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import {
  COLOR, FONT_FAMILY, FONT_FAMILY_MONO, TYPE, WEIGHT, SPACE,
} from '@/config/theme';

/* ────────────────────────────────────────────────────────────────────────
   Module data — static. Mirrors sandbox Polymer-3 IA.
   Counts are pinned (50 layers, 70 MCP tools, etc.)
   ──────────────────────────────────────────────────────────────────────── */

const VIEWER_HREF =
  '/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';

interface Module {
  name: string;
  desc: string;
  href: string;
  accent: string;
  count?: string;
}

const MODULES_BROWSE: Module[] = [
  {
    name: 'Genome viewer',
    desc: 'Browse any locus with biophysics layers — stacking energy, curvature, CpG density, isochores. hg38 + hg37.',
    href: VIEWER_HREF,
    accent: COLOR.accent.teal,
    count: '50 layers',
  },
  {
    name: 'Atlas',
    desc: 'GENCODE v44 gene profiles with expression, pathways, constraint, biosynthetic cost.',
    href: '/atlas',
    accent: COLOR.layer.gencode_v44,
    count: '63K txs',
  },
];

const MODULES_ANALYZE: Module[] = [
  {
    name: 'Evaluate',
    desc: 'Physics linter for any DNA sequence. Thermodynamic profile, CpG islands, structural flags, batch mode.',
    href: '/evaluate',
    accent: COLOR.layer.gene_costs_v1,
    count: '13 flags',
  },
  {
    name: 'Methylation',
    desc: 'DMP volcano and Manhattan plots, TE/ERV family scoring, reactivation risk, Retro-Age clock.',
    href: '/dmp',
    accent: COLOR.accent.rose,
    count: '937K probes',
  },
  {
    name: 'Epigenetic clocks',
    desc: 'Probe anatomy, cross-clock comparison, coefficient application.',
    href: '/clocks',
    accent: COLOR.accent.amber,
    count: '6 clocks',
  },
  {
    name: 'Transposome',
    desc: 'Transposable elements with TE age, awakening potential, EPIC v2 probe overlap.',
    href: '/transposome',
    accent: COLOR.accent.violet,
    count: '5.6M TEs',
  },
  {
    name: 'HLA',
    desc: 'Allele biophysics for transplant loci. Non-coding divergence, expression mismatch scoring.',
    href: '/hla',
    accent: COLOR.layer.gencode_v44,
    count: '6 loci',
  },
  {
    name: 'Claims',
    desc: 'Formal claim records with premise · operation · statistic · inference · conclusion. Latent space projection.',
    href: '/claims',
    accent: COLOR.primary.base,
    count: 'IR v1.2',
  },
];

const MODULES_BUILD: Module[] = [
  {
    name: 'API & MCP',
    desc: 'REST endpoints and Model Context Protocol for AI agents. Reference + compute tools, evidence-class metadata.',
    href: '/docs',
    accent: COLOR.primary.base,
    count: '70 tools',
  },
  {
    name: 'Developers',
    desc: 'Quickstart, code examples, try-it evaluator, data inventory. Python SDK on PyPI.',
    href: '/developers',
    accent: COLOR.primary.base,
    count: 'pip install',
  },
];

const STATS = [
  { value: '50',    label: 'layers' },
  { value: '29.4M', label: 'CpG sites' },
  { value: '937K',  label: 'probes' },
  { value: '63K',   label: 'transcripts' },
  { value: '70',    label: 'MCP tools' },
];

/* ────────────────────────────────────────────────────────────────────────
   Primitives
   ──────────────────────────────────────────────────────────────────────── */

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
        {/* Data swatch — inline with name so it baselines naturally.
            Theme blue across all modules per design. */}
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

      {/* HERO */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[24]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        {/* Eyebrow */}
        <div style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: SPACE[6],
        }}>
          Genome-wide DNA biophysics &nbsp;·&nbsp; hg38 + hg37
        </div>

        {/* Electric-blue display wordmark */}
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
          Polymer Genomics
        </h1>

        {/* Tagline */}
        <p style={{
          margin: 0,
          maxWidth: 640,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.55,
          letterSpacing: TYPE.md.letterSpacing,
          marginBottom: SPACE[10],
          fontWeight: WEIGHT.normal,
        }}>
          The material channel of the genome — stacking energy, curvature, flexibility,
          groove geometry — computed at base-pair resolution and cross-indexed with{' '}
          <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.semibold }}>
            50 genomic layers
          </span>. Queryable by humans and by agents.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[3],
          alignItems: 'center',
          marginBottom: SPACE[12],
        }}>
          <Link
            href={VIEWER_HREF}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
              backgroundColor: COLOR.primary.base,
              color: COLOR.bg.white,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
              borderRadius: 2,
              letterSpacing: '0.01em',
            }}
          >
            Open Viewer <span aria-hidden>→</span>
          </Link>
          <Link
            href="/atlas"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
              backgroundColor: COLOR.bg.elevated,
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[5]}px`,
              borderRadius: 2,
              border: `1px solid ${COLOR.border.strong}`,
              letterSpacing: '0.01em',
            }}
          >
            Chromosome Atlas
          </Link>
          <Link
            href="/docs"
            style={{
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              fontWeight: WEIGHT.medium,
              textDecoration: 'none',
              padding: `${SPACE[3]}px ${SPACE[2]}px`,
              letterSpacing: '0.01em',
            }}
          >
            API &amp; MCP for agents <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Quiet stats strip — mono, tabular, hairline-divided */}
        <div className="tabular" style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: SPACE[6],
          paddingTop: SPACE[4],
          borderTop: `1px solid ${COLOR.border.subtle}`,
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.02em',
        }}>
          {STATS.map((s, i) => (
            <span key={s.label} style={{ display: 'inline-flex', alignItems: 'baseline', gap: SPACE[2] }}>
              {i > 0 && <span aria-hidden style={{ color: COLOR.border.strong, marginRight: SPACE[4] }}>·</span>}
              <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.semibold }}>{s.value}</span>
              <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: TYPE.xs.fontSize }}>
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* MODULES */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[16]}px`,
      }}>
        <ModuleGroup index="01" label="Browse"  modules={MODULES_BROWSE} />
        <ModuleGroup index="02" label="Analyze" modules={MODULES_ANALYZE} />
        <ModuleGroup index="03" label="Build"   modules={MODULES_BUILD} />
      </section>

      <Footer />
    </main>
  );
}
