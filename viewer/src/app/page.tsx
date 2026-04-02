'use client';

import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
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

const TIER_1: Module[] = [
  {
    name: 'Genome Viewer',
    desc: 'Browse any locus with CpG, probe, isochore, and biophysics layers. hg38 + hg37.',
    href: VIEWER_HREF,
    accent: COLOR.accent.teal,
  },
  {
    name: 'Atlas',
    desc: 'Karyotype navigator with 63,000 GENCODE v44 transcripts. Gene profiles, expression, pathways.',
    href: '/atlas',
    accent: COLOR.layer.gencode_v44,
  },
];

const TIER_2: Module[] = [
  {
    name: 'Methylation',
    desc: 'DMP volcano/manhattan, TE/ERV family scoring, reactivation risk, Retro-Age clock. Auto-detects DMP results or beta values.',
    href: '/dmp',
    accent: COLOR.accent.rose,
  },
  {
    name: 'Evaluate',
    desc: 'Biophysics linter for DNA sequences. CpG islands, thermodynamics, structural flags.',
    href: '/evaluate',
    accent: '#10b981',
  },
  {
    name: 'Epigenetic Clocks',
    desc: '6 clock systems. Probe anatomy, cross-clock comparison, apply coefficients.',
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
    desc: 'Allele biophysics for 6 transplant loci. Non-coding divergence, expression mismatch, match scoring.',
    href: '/hla',
    accent: '#3b82f6',
  },
];

const TIER_3: Module[] = [
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

/* ── Components ── */

function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: `${SPACE[2]}px ${SPACE[6]}px`,
        backgroundColor: 'transparent',
        color: COLOR.text.secondary,
        border: `1px solid ${COLOR.border.strong}`,
        fontWeight: WEIGHT.medium,
        fontSize: TYPE.base.fontSize,
        fontFamily: FONT_FAMILY,
        textDecoration: 'none',
        transition: 'border-color 0.15s, color 0.15s',
        display: 'inline-block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLOR.accent.teal;
        e.currentTarget.style.color = COLOR.accent.teal;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLOR.border.strong;
        e.currentTarget.style.color = COLOR.text.secondary;
      }}
    >
      {children}
    </Link>
  );
}

function Divider() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: `${SPACE[8]}px 0` }}>
      <div style={{ width: 120, height: 1, backgroundColor: COLOR.border.subtle }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: COLOR.text.faint,
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.medium,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      marginBottom: SPACE[4],
    }}>
      {children}
    </div>
  );
}

function ModuleEntry({ mod, large }: { mod: Module; large?: boolean }) {
  return (
    <Link
      href={mod.href}
      style={{
        textDecoration: 'none',
        cursor: 'pointer',
        borderLeft: '3px solid transparent',
        paddingLeft: SPACE[3],
        paddingTop: SPACE[2],
        paddingBottom: SPACE[2],
        transition: 'border-color 0.15s',
        display: 'block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderLeftColor = mod.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderLeftColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], marginBottom: 4 }}>
        <div style={{
          width: large ? 10 : 8,
          height: large ? 10 : 8,
          backgroundColor: mod.accent,
          flexShrink: 0,
        }} />
        <span style={{
          color: COLOR.text.primary,
          fontSize: large ? TYPE.md.fontSize : TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
        }}>
          {mod.name}
        </span>
      </div>
      <div style={{
        color: COLOR.text.tertiary,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        lineHeight: 1.6,
        paddingLeft: large ? 22 : 20,
      }}>
        {mod.desc}
      </div>
    </Link>
  );
}

/* ── Page ── */

export default function Home() {
  const stats = usePlatformStats();
  const STATS = [
    { value: stats.cpg, label: 'CpG' },
    { value: stats.probes, label: 'probes' },
    { value: stats.transcripts, label: 'transcripts' },
    { value: stats.mcpTools, label: 'MCP tools' },
  ];

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar />

      {/* ─── Hero (compact) ─── */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${SPACE[24]}px ${SPACE[6]}px ${SPACE[10]}px`,
        }}
      >
        <h1 style={{
          fontSize: TYPE['2xl'].fontSize,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.12em',
          color: COLOR.accent.teal,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[6],
          textAlign: 'center',
        }}>
          POLYMER GENOMICS
        </h1>

        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: TYPE.base.lineHeight,
          textAlign: 'center',
          marginBottom: SPACE[2],
        }}>
          DNA as a physical material
        </p>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: TYPE.base.lineHeight,
          textAlign: 'center',
          marginBottom: SPACE[6],
        }}>
          Computed, served, composable &mdash; base-pair resolution
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: SPACE[6],
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: SPACE[10],
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

        <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap', justifyContent: 'center' }}>
          <GhostButton href={VIEWER_HREF}>
            Open Viewer
          </GhostButton>
          <GhostButton href="/atlas">
            Atlas
          </GhostButton>
          <GhostButton href="/docs">
            API Docs
          </GhostButton>
        </div>
      </section>

      {/* ─── Module Directory ─── */}
      <div style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: `0 ${SPACE[6]}px`,
      }}>
        <Divider />

        {/* Tier 1: Explore */}
        <SectionLabel>Explore</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          {TIER_1.map((mod) => (
            <ModuleEntry key={mod.name} mod={mod} large />
          ))}
        </div>

        <Divider />

        {/* Tier 2: Analyze */}
        <SectionLabel>Analyze</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          {TIER_2.map((mod) => (
            <ModuleEntry key={mod.name} mod={mod} />
          ))}
        </div>

        <Divider />

        {/* Tier 3: Build */}
        <SectionLabel>Build</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          {TIER_3.map((mod) => (
            <ModuleEntry key={mod.name} mod={mod} />
          ))}
        </div>

        <Divider />
      </div>

      <Footer />
    </main>
  );
}
