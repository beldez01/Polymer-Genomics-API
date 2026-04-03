# Landing Page Manifesto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the landing page from a tool directory into a short manifesto introducing the material channel concept, followed by feature cards explaining the site's modules.

**Architecture:** Single-file rewrite of `viewer/src/app/page.tsx`. The page structure becomes: BrandBar → Hero (title + thesis) → Manifesto (3 paragraphs) → Channel Comparison (two side-by-side blocks) → Bridge + Stats → Feature Cards (3 tiers) → Living Platform section → Footer. All styling uses existing theme tokens. No new components, routes, or dependencies.

**Tech Stack:** Next.js 16 (App Router), React 19, existing design token system (`@/config/theme`), `useIsMobile` hook for responsive layout.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Rewrite | `viewer/src/app/page.tsx` | Full landing page — manifesto + feature cards |

No new files. BrandBar, Footer, theme, and platform-stats are unchanged.

---

### Task 1: Rewrite the Landing Page

**Files:**
- Modify: `viewer/src/app/page.tsx` (full rewrite, lines 1-328)

- [ ] **Step 1: Replace page.tsx with the manifesto structure**

```tsx
'use client';

import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import { useIsMobile } from '@/hooks/useBreakpoint';
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
    accent: '#10b981',
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
    accent: '#3b82f6',
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

/* ── Page ── */

export default function Home() {
  const isMobile = useIsMobile();
  const stats = usePlatformStats();

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh' }}>
      <BrandBar />

      <div style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: `0 ${SPACE[6]}px`,
      }}>

        {/* ─── Hero ─── */}
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
            The central dogma describes how DNA encodes proteins. It is silent about the
            rest&nbsp;&mdash; the 98.5% of the genome whose physical properties determine which
            genes are read, when, and in what cell. This site computes that other channel.
          </p>
        </section>

        {/* ─── Manifesto ─── */}
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
            channel</em> maps codons to amino acids&nbsp;&mdash; the genetic code, described
            completely by the central dogma, operating on ~1.5% of the genome. The <em>material
            channel</em> maps sequence to a continuous energy surface&nbsp;&mdash; self-executing,
            requiring no decoder, operating on 100% of the genome. The central dogma is
            silent about this channel.
          </p>

          <p style={PROSE}>
            The material channel is physically prior. Naked DNA in a test tube already has
            its energy surface&nbsp;&mdash; no ribosome, no polymerase, no cell required. It
            predates the genetic code by billions of years. And it determines, through the
            Boltzmann distribution, which regions of the genome the symbolic channel can
            access. This site computes and serves that energy surface, genome-wide, for the
            first time.
          </p>
        </section>

        {/* ─── Two Channels ─── */}
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
            {['Codons → amino acids', '~1.5% of the genome', 'Decoder-dependent (ribosome)', 'Described by the central dogma'].map((line) => (
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
            {['Sequence → energy surface', '100% of the genome', 'Self-executing (physics)', 'Computed here'].map((line) => (
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

        <Divider />

        {/* ─── Bridge + Stats ─── */}
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
            {[
              { value: '41', label: 'layers' },
              { value: stats.cpg, label: 'CpG sites' },
              { value: stats.probes, label: 'probes' },
              { value: stats.transcripts, label: 'transcripts' },
              { value: stats.mcpTools, label: 'MCP tools' },
            ].map((s, i) => (
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

        {/* ─── Feature Cards: Browse ─── */}
        <SectionLabel>Browse</SectionLabel>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: SPACE[6],
          marginBottom: SPACE[2],
        }}>
          {TIER_BROWSE.map((mod) => (
            <FeatureCard key={mod.name} mod={mod} />
          ))}
        </div>

        <Divider />

        {/* ─── Feature Cards: Analyze ─── */}
        <SectionLabel>Analyze</SectionLabel>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: SPACE[6],
          marginBottom: SPACE[2],
        }}>
          {TIER_ANALYZE.map((mod) => (
            <FeatureCard key={mod.name} mod={mod} />
          ))}
        </div>

        <Divider />

        {/* ─── Feature Cards: Build ─── */}
        <SectionLabel>Build</SectionLabel>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: SPACE[6],
          marginBottom: SPACE[2],
        }}>
          {TIER_BUILD.map((mod) => (
            <FeatureCard key={mod.name} mod={mod} />
          ))}
        </div>

        <Divider />

        {/* ─── Living Platform ─── */}
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
      </div>

      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Build the project**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npm run build`
Expected: Build succeeds with no errors. Warnings about unused variables are acceptable if inherited from other files, but `page.tsx` itself should produce none.

- [ ] **Step 3: Start dev server and visually verify**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/viewer && npm run dev`

Open `http://localhost:3000` and verify:
1. Hero title "POLYMER GENOMICS" in teal, left-aligned
2. Thesis sentence below in secondary text
3. Three manifesto paragraphs with comfortable line height
4. Two-column channel comparison (σ muted, Λ teal-accented)
5. Stats row with dot separators
6. Feature cards in 2-column grid, grouped by Browse/Analyze/Build
7. Living platform closing section
8. BrandBar and Footer unchanged

Resize to mobile width (<640px) and verify:
1. Channel comparison stacks vertically
2. Feature cards go to single column
3. All text remains readable

- [ ] **Step 4: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add viewer/src/app/page.tsx
git commit -m "feat: rewrite landing page as material channel manifesto

Replace tool-directory landing page with a short theoretical
introduction to the two-channel framework (symbolic vs material),
followed by feature cards explaining each module. Adds living-
platform closing section."
```

---

## Design Decisions

1. **No stark table** — The σ vs Λ comparison uses two side-by-side blocks with asymmetric visual weight (muted border/text for σ, teal accent for Λ) instead of a data table. This feels like a design element rather than a textbook figure.

2. **Hero is left-aligned** — The current page centers everything. The manifesto reads better left-aligned — it's prose, not a tagline. The title stays left-aligned for consistency.

3. **Stats move below the manifesto** — They appear after the reader understands *why* the numbers matter, not before.

4. **Feature cards replace the module list** — Cards with colored top borders in a 2-column grid replace the left-border list entries. Each card links to its module.

5. **"Theory" link is text, not a link** — "A full elaboration of the theoretical framework is in preparation." No dead links. Wire this up when a /theory route or published paper exists.

6. **No new components or files** — Everything stays in page.tsx. The components (Divider, SectionLabel, FeatureCard) are page-local, same pattern as the current code.

## Follow-Up (Not In Scope)

- `/theory` route hosting the full DOGMA.md content as a web page
- Contact/contribution mechanism (email, GitHub issues link)
- Animated transitions or scroll effects
