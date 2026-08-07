'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { CodeBlock, InlineCode } from '@/components/docs/CodeBlock';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { API_BASE, MCP_TOTAL } from '@/config/apiDocsData';
import { LAYERS } from '@/config/dataSourcesData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Developers</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>Quickstart · SDK · MCP</span>
  </span>
);

function SectionHead({ index, label, count }: { index: string; label: string; count?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: SPACE[3],
      paddingBottom: SPACE[3],
      marginBottom: SPACE[5],
      borderBottom: `1px solid ${COLOR.border.strong}`,
    }}>
      <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, letterSpacing: '0.1em' }}>
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
      {count && (
        <>
          <span style={{ flex: 1 }} />
          <span className="tabular" style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.04em',
          }}>
            {count}
          </span>
        </>
      )}
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0,
      color: COLOR.text.secondary,
      fontFamily: FONT_FAMILY,
      fontSize: TYPE.base.fontSize,
      lineHeight: 1.65,
      marginBottom: SPACE[4],
    }}>
      {children}
    </p>
  );
}

type Language = 'python' | 'curl' | 'r' | 'js';

const SDK_EXAMPLES: Record<Language, string> = {
  python:
`from polymer_genomics import PolymerClient

client = PolymerClient(api_key="POLY_...")

# 1. Fetch genome-wide biophysics for TP53
region = client.regions.fetch("hg38", "chr17:7668421-7687490")
print(region.stacking_dg37.mean)            # -8.42 kcal/mol
print(region.cpg_sites.count)                # 47

# 2. Run the physics linter on your own sequence
result = client.evaluate("ATGCGATCG...", analysis="full")
print(result.summary.gc_content, result.flag_counts.warnings)

# 3. Search for genes
hits = client.search.genes("TP53")
for h in hits:
    print(h.symbol, h.chromosome)`,
  curl:
`# Region biophysics
curl '${API_BASE}/v1/regions/hg38/chr17:7668421-7687490' \\
  -H 'X-API-Key: POLY_...'

# Sequence evaluation
curl -X POST '${API_BASE}/v1/evaluate' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: POLY_...' \\
  -d '{"sequence":"ATGCGATCG...","analysis":"full"}'

# Gene search
curl '${API_BASE}/v1/search/genes?q=TP53' \\
  -H 'X-API-Key: POLY_...'`,
  r:
`library(polymerGenomics)

client <- polymer_client(api_key = Sys.getenv("POLY_API_KEY"))

# 1. Fetch genome-wide biophysics for TP53
region <- regions_fetch(client, "hg38", "chr17:7668421-7687490")
print(mean(region$stacking_dg37))

# 2. Convert to GRanges for Bioconductor
gr <- as_granges(region)
mcols(gr)$stacking_dg37  # GRanges-compatible numeric metadata column

# 3. Methylation-specific helpers
betas <- read_idat("sample.idat")
ages  <- predict_clock(client, betas, clock = "horvath")`,
  js:
`import { PolymerClient } from "@polymer-bio/sdk";

const client = new PolymerClient({ apiKey: process.env.POLY_API_KEY });

// 1. Fetch genome-wide biophysics for TP53
const region = await client.regions.fetch("hg38", "chr17:7668421-7687490");
console.log(region.stacking_dg37.mean);            // -8.42 kcal/mol

// 2. Run the physics linter
const result = await client.evaluate({
  sequence: "ATGCGATCG...",
  analysis: "full",
});
console.log(result.summary.gc_content, result.flag_counts.warnings);

// 3. Search
const hits = await client.search.genes("TP53");
hits.forEach(h => console.log(h.symbol, h.chromosome));`,
};

const LANGS: Array<{ id: Language; label: string }> = [
  { id: 'python', label: 'Python' },
  { id: 'curl',   label: 'curl' },
  { id: 'r',      label: 'R' },
  { id: 'js',     label: 'TypeScript' },
];

const RECIPES = [
  {
    title: 'Cross-layer region query',
    blurb: 'Fetch biophysics + CpG sites + EPIC v2 probes in one call. Single round-trip; agent-optimized response.',
    code: `region = client.regions.fetch(\n  "hg38", "chr17:7668421-7687490",\n  layers=["biophysics", "cpg_sites", "probe_epic_v2"],\n)\nprint(region.cpg_sites.count, region.probe_epic_v2.count)`,
  },
  {
    title: 'Batch evaluate (constructs / CDS panels)',
    blurb: 'Send up to 1,000 sequences in one POST. Returns per-sequence flags and a summary roll-up.',
    code: `batch = client.evaluate_batch([\n  {"name": "TP53_ex2", "sequence": "ATGCG..."},\n  {"name": "TP53_ex3", "sequence": "CGCGC..."},\n  # ...\n])\nfor r in batch.results:\n    print(r.name, r.flag_counts.warnings)`,
  },
  {
    title: 'Apply a methylation clock',
    blurb: 'Predict age from a beta matrix using any of the 6 supported clocks.',
    code: `ages = client.clocks.predict(\n  betas=betas,             # pandas.DataFrame or path to CSV\n  clock="horvath",         # horvath | hannum | phenoage | grimage | retro_age | dunedinpace\n)\nprint(ages.head())`,
  },
  {
    title: 'Aggregate genome-wide',
    blurb: 'For atlas-scale overviews, request pre-binned counts instead of bp-resolution data.',
    code: `agg = client.aggregation.fetch(\n  "hg38", "chr17:1-83257441",\n  layers=["cpg_sites", "probe_epic_v2"],\n  resolution=1_000_000,\n)\nfor bin in agg.cpg_sites.bins:\n    print(bin.start, bin.count)`,
  },
];

export default function DevelopersPage() {
  const [lang, setLang] = useState<Language>('python');

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <section style={{
        maxWidth: 920,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[16]}px`,
        flex: 1,
      }}>
        {/* Header */}
        <div style={{ marginBottom: SPACE[10] }}>
          <div style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: SPACE[3],
          }}>
            § DEVELOPERS · 60-second quickstart · SDK + MCP + REST
          </div>
          <h1 style={{
            margin: 0,
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xl.fontSize,
            lineHeight: TYPE.xl.lineHeight,
            letterSpacing: TYPE.xl.letterSpacing,
            fontWeight: WEIGHT.bold,
            marginBottom: SPACE[3],
          }}>
            Build with Polymer
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 640,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.md.fontSize,
            lineHeight: 1.55,
          }}>
            Genome-wide DNA biophysics in your stack. Python SDK, R bindings,
            TypeScript SDK, and an{' '}
            <Link href="/genomics/docs" style={{ color: COLOR.primary.base, textDecoration: 'none', borderBottom: `1px solid ${COLOR.primary.base}40` }}>
              MCP server
            </Link>{' '}
            with {MCP_TOTAL} tools for AI agents. Every response carries provenance.
          </p>
        </div>

        {/* Quickstart */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="01" label="60-second quickstart" count="install · auth · first call" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
            <Step n="1" title="Install the SDK">
              <CodeBlock language="bash" code="pip install polymer-genomics" />
            </Step>
            <Step n="2" title="Get an API key">
              <Prose>
                Sign in at <span style={{ color: COLOR.primary.base }}>polymerbio.org/account</span> and
                copy your <InlineCode>POLY_…</InlineCode> key. Free tier: 1,000 requests/day.
              </Prose>
            </Step>
            <Step n="3" title="Fetch your first region">
              <CodeBlock language="python" code={`from polymer_genomics import PolymerClient\n\nclient = PolymerClient(api_key="POLY_...")\n\nregion = client.regions.fetch("hg38", "chr17:7668421-7687490")\nprint(region.stacking_dg37.mean)   # -8.42 kcal/mol`} />
            </Step>
          </div>
        </div>

        {/* Language tabs */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="02" label="Pick your stack" count="Python · curl · R · TypeScript" />

          <div style={{ display: 'flex', gap: SPACE[1], marginBottom: SPACE[4] }}>
            {LANGS.map((l) => {
              const active = lang === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLang(l.id)}
                  style={{
                    backgroundColor: 'transparent',
                    color: active ? COLOR.primary.base : COLOR.text.secondary,
                    border: 'none',
                    borderBottom: `2px solid ${active ? COLOR.primary.base : 'transparent'}`,
                    padding: `${SPACE[2]}px ${SPACE[3]}px`,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.sm.fontSize,
                    fontWeight: active ? WEIGHT.semibold : WEIGHT.medium,
                    letterSpacing: '0.01em',
                    cursor: 'pointer',
                    transition: 'color 0.12s, border-color 0.12s',
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>

          <CodeBlock language={lang} code={SDK_EXAMPLES[lang]} />
        </div>

        {/* Recipes */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="03" label="Recipes" count={`${RECIPES.length} common patterns`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[5] }}>
            {RECIPES.map((r, i) => (
              <div key={r.title}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: SPACE[2],
                  marginBottom: SPACE[2],
                }}>
                  <span style={{
                    color: COLOR.text.faint,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: TYPE.xs.fontSize,
                    letterSpacing: '0.08em',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 style={{
                    margin: 0,
                    color: COLOR.text.primary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.md.fontSize,
                    fontWeight: WEIGHT.semibold,
                    letterSpacing: '-0.005em',
                  }}>
                    {r.title}
                  </h3>
                </div>
                <Prose>{r.blurb}</Prose>
                <CodeBlock language="python" code={r.code} />
              </div>
            ))}
          </div>
        </div>

        {/* Agents */}
        <div style={{ marginBottom: SPACE[12] }}>
          <SectionHead index="04" label="For AI agents · MCP" count={`${MCP_TOTAL} tools`} />
          <Prose>
            Polymer exposes its full API to LLM agents through a Model Context Protocol server.
            Add it to Claude Desktop, Cursor, or your in-house agent in one line.
          </Prose>
          <CodeBlock language="json" code={`{\n  "mcpServers": {\n    "polymer": {\n      "command": "uvx",\n      "args": ["polymer-mcp", "serve"],\n      "env": { "POLYMER_API_KEY": "POLY_..." }\n    }\n  }\n}`} />
          <div style={{ marginTop: SPACE[3] }}>
            <Link href="/genomics/docs#mcp" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
              color: COLOR.primary.base,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              fontWeight: WEIGHT.semibold,
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}>
              Full MCP tool reference <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {/* Inventory CTA */}
        <div style={{
          padding: SPACE[5],
          backgroundColor: COLOR.bg.elevated,
          border: `1px solid ${COLOR.border.default}`,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[4],
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              {LAYERS.length} layers · versions · licenses
            </div>
            <div style={{
              color: COLOR.text.primary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.md.fontSize,
              fontWeight: WEIGHT.semibold,
            }}>
              Data inventory
            </div>
            <div style={{
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              marginTop: 2,
            }}>
              Browse every layer with citation, version, content hash, and license.
            </div>
          </div>
          <Link href="/genomics/data-sources" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACE[2],
            backgroundColor: COLOR.primary.base,
            color: COLOR.bg.white,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            textDecoration: 'none',
            padding: `${SPACE[2] + 2}px ${SPACE[4]}px`,
            borderRadius: 2,
            letterSpacing: '0.01em',
          }}>
            View data sources <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: SPACE[4],
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[3],
        marginBottom: SPACE[3],
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          backgroundColor: COLOR.primary.base,
          color: COLOR.bg.white,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: 12,
          fontWeight: WEIGHT.bold,
          borderRadius: 2,
        }}>
          {n}
        </span>
        <span style={{
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.md.fontSize,
          fontWeight: WEIGHT.semibold,
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
