'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import {
  MCP_TOOL_COUNT,
  usePlatformStats,
} from '@/lib/platform-stats';

/* ── Data ── */

const USE_CASES = [
  {
    title: 'Synthetic Biology',
    accent: COLOR.accent.teal,
    desc: 'Evaluate constructs before synthesis. Flag CpG islands that cause silencing, low-stability regions that misfold, and repeats that recombine.',
    example: 'client.evaluate(my_construct)',
  },
  {
    title: 'AI Scientists',
    accent: COLOR.accent.violet,
    desc: `${MCP_TOOL_COUNT} agent-composable MCP tools for biology research agents. Gene lookup, region queries, biophysical computation, cross-layer correlation — all in one server.`,
    example: 'evaluate_design(sequence=...)',
  },
  {
    title: 'Epigenetic Clocks',
    accent: COLOR.accent.amber,
    desc: 'Mechanistic context for probe selection. 5 clock coefficient sets, 937K probe annotations, CpG context, and cross-array mapping.',
    example: 'client.clock_probes("horvath")',
  },
] as const;

function useInventory() {
  const stats = usePlatformStats();
  return [
    { value: stats.cpg,      label: 'CpG sites' },
    { value: stats.probes,   label: 'methylation probes' },
    { value: stats.transcripts, label: 'transcripts' },
    { value: '54',           label: 'GTEx tissues' },
    { value: stats.mcpTools, label: 'MCP tools' },
    { value: '30+',          label: 'physical constants' },
  ];
}

/* ── Styles ── */

const CODE_BLOCK: React.CSSProperties = {
  backgroundColor: COLOR.bg.track,
  border: `1px solid ${COLOR.border.default}`,
  padding: `${SPACE[4]}px ${SPACE[5]}px`,
  fontFamily: FONT_FAMILY,
  fontSize: TYPE.sm.fontSize,
  lineHeight: 1.8,
  color: COLOR.text.secondary,
  overflowX: 'auto',
  whiteSpace: 'pre',
};

const SECTION_STYLE: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: `${SPACE[16]}px ${SPACE[6]}px`,
};

const DIVIDER: React.CSSProperties = {
  width: 120,
  height: 1,
  backgroundColor: COLOR.border.subtle,
  margin: '0 auto',
};

/* ── Try-It Component ── */

function TryIt() {
  const [seq, setSeq] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEvaluate() {
    const cleaned = seq.replace(/[^ACGTNacgtn]/g, '').toUpperCase();
    if (cleaned.length < 10) {
      setError('Sequence must be at least 10 bp');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: cleaned, name: 'try-it', analysis: 'full' }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message =
          body?.error?.message ||
          body?.detail?.error?.message ||
          body?.detail?.[0]?.msg ||
          `HTTP ${resp.status}`;
        throw new Error(message);
      }
      setResult(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <textarea
        value={seq}
        onChange={(e) => setSeq(e.target.value)}
        placeholder="Paste a DNA sequence (ACGT, 10-100,000 bp)..."
        rows={4}
        style={{
          ...COMPONENT.input.default as React.CSSProperties,
          width: '100%',
          resize: 'vertical',
          boxSizing: 'border-box',
          marginBottom: SPACE[3],
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3] }}>
        <button
          onClick={handleEvaluate}
          disabled={loading}
          style={{
            ...COMPONENT.button.ghost as React.CSSProperties,
            borderColor: COLOR.accent.teal,
            color: COLOR.accent.teal,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Evaluating...' : 'Evaluate'}
        </button>
        {error && (
          <span style={{ color: COLOR.accent.rose, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
            {error}
          </span>
        )}
      </div>
      {result && (
        <pre style={{ ...CODE_BLOCK, marginTop: SPACE[4], maxHeight: 400, overflowY: 'auto' }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ── Page ── */

export default function DevelopersPage() {
  const INVENTORY = useInventory();

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandBar />

      {/* ─── Hero ─── */}
      <section style={{
        ...SECTION_STYLE,
        textAlign: 'center',
        paddingTop: SPACE[24],
        paddingBottom: SPACE[16],
      }}>
        <h1 style={{
          fontSize: TYPE.xl.fontSize,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.06em',
          color: COLOR.accent.teal,
          fontFamily: FONT_FAMILY,
          marginBottom: SPACE[4],
        }}>
          THE BIOPHYSICAL DATA LAYER FOR DNA
        </h1>
        <p style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.md.fontSize,
          fontFamily: FONT_FAMILY,
          lineHeight: TYPE.md.lineHeight,
          maxWidth: 560,
          margin: '0 auto',
          marginBottom: SPACE[10],
        }}>
          Every AI model treats DNA as text. We compute what DNA actually does as a physical material.
        </p>

        {/* 30-second quickstart */}
        <div style={{ textAlign: 'left' }}>
          <p style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.08em',
            marginBottom: SPACE[2],
          }}>
            30-SECOND QUICKSTART
          </p>
          <pre style={CODE_BLOCK}>
{`pip install polymer-genomics

from polymer_genomics import PolymerClient

client = PolymerClient()
report = client.evaluate("ATGCGATCGATCGATCG" * 20)

print(report["flag_counts"])   # {"warnings": 0, "info": 2}
print(report["summary"]["gc_content"])  # 0.529`}
          </pre>
        </div>

        {/* Access */}
        <div style={{
          backgroundColor: COLOR.bg.surface,
          border: `1px solid ${COLOR.border.subtle}`,
          borderRadius: 6,
          padding: `${SPACE[4]}px ${SPACE[6]}px`,
          marginTop: SPACE[6],
        }}>
          <div style={{
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            color: COLOR.accent.teal,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.06em',
            marginBottom: SPACE[2],
          }}>
            OPEN ACCESS
          </div>
          <p style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.7,
            margin: 0,
          }}>
            No API key required. All endpoints are open during the research preview.
            Base URL: <code style={{ color: COLOR.accent.teal }}>https://api.polymerbio.org</code>
          </p>
        </div>

        {/* Limits & Versions */}
        <div style={{
          backgroundColor: COLOR.bg.surface,
          border: `1px solid ${COLOR.border.subtle}`,
          borderRadius: 6,
          padding: `${SPACE[4]}px ${SPACE[6]}px`,
          marginTop: SPACE[4],
        }}>
          <div style={{
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            letterSpacing: '0.06em',
            marginBottom: SPACE[2],
          }}>
            LIMITS &amp; VERSIONS
          </div>
          <div style={{
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.8,
          }}>
            <div>API version: <code style={{ color: COLOR.accent.teal }}>0.2.0</code></div>
            <div>SDK version: <code style={{ color: COLOR.accent.teal }}>polymer-genomics 0.3.0</code></div>
            <div>Max sequence length (evaluate): 100,000 bp</div>
            <div>Max region size (region query): 10 Mb</div>
            <div>Max batch probes: 10,000</div>
            <div>Max batch evaluate: 100 sequences</div>
            <div>Max sequence retrieval: 100 kb</div>
          </div>
        </div>
      </section>

      <div style={DIVIDER} />

      {/* ─── Use Cases ─── */}
      <section style={SECTION_STYLE}>
        <h2 style={{
          ...COMPONENT.sectionHeader as React.CSSProperties,
          fontSize: TYPE.xs.fontSize,
          marginBottom: SPACE[8],
          letterSpacing: '0.12em',
        }}>
          USE CASES
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[8] }}>
          {USE_CASES.map((uc) => (
            <div key={uc.title} style={{ borderLeft: `3px solid ${uc.accent}`, paddingLeft: SPACE[4] }}>
              <h3 style={{
                color: COLOR.text.primary,
                fontSize: TYPE.md.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.medium,
                marginBottom: SPACE[2],
              }}>
                {uc.title}
              </h3>
              <p style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.base.fontSize,
                fontFamily: FONT_FAMILY,
                lineHeight: TYPE.base.lineHeight,
                marginBottom: SPACE[2],
              }}>
                {uc.desc}
              </p>
              <code style={{
                color: uc.accent,
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
              }}>
                {uc.example}
              </code>
            </div>
          ))}
        </div>
      </section>

      <div style={DIVIDER} />

      {/* ─── Data Inventory ─── */}
      <section style={SECTION_STYLE}>
        <h2 style={{
          ...COMPONENT.sectionHeader as React.CSSProperties,
          fontSize: TYPE.xs.fontSize,
          marginBottom: SPACE[8],
          letterSpacing: '0.12em',
        }}>
          DATA INVENTORY
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: SPACE[6],
        }}>
          {INVENTORY.map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{
                color: COLOR.accent.teal,
                fontSize: TYPE.lg.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.bold,
                marginBottom: SPACE[1],
              }}>
                {item.value}
              </div>
              <div style={{
                color: COLOR.text.tertiary,
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
              }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={DIVIDER} />

      {/* ─── Code Examples ─── */}
      <section style={SECTION_STYLE}>
        <h2 style={{
          ...COMPONENT.sectionHeader as React.CSSProperties,
          fontSize: TYPE.xs.fontSize,
          marginBottom: SPACE[8],
          letterSpacing: '0.12em',
        }}>
          CODE EXAMPLES
        </h2>

        {/* Python SDK */}
        <h3 style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          marginBottom: SPACE[2],
        }}>
          Python SDK
        </h3>
        <pre style={{ ...CODE_BLOCK, marginBottom: SPACE[8] }}>
{`from polymer_genomics import PolymerClient

client = PolymerClient()

# Evaluate a construct for biophysical issues
report = client.evaluate(my_sequence)
for flag in report["flags"]:
    print(f'{flag["code"]}: {flag["message"]}')

# Compare wild-type vs optimized design
delta = client.compare({
    "wildtype":  wt_sequence,
    "optimized": opt_sequence,
})
print(delta["deltas_vs_reference"])

# Look up gene biophysics
tp53 = client.gene("hg38", "TP53")
expr = client.gene_expression("hg38", "TP53")
cost = client.gene_cost("hg38", "TP53")`}
        </pre>

        {/* MCP */}
        <h3 style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          marginBottom: SPACE[2],
        }}>
          MCP Tools (Claude Code / AI Agents)
        </h3>
        <pre style={{ ...CODE_BLOCK, marginBottom: SPACE[8] }}>
{`// claude_desktop_config.json
{
  "mcpServers": {
    "polymer-genomics": {
      "command": "uvx",
      "args": ["polymer-genomics-mcp"],
      "env": {
        "POLYMER_API_BASE": "https://api.polymerbio.org"
      }
    }
  }
}

// Then in Claude Code:
// "Evaluate this construct for silencing risk"
// "What genes are near chr17:7668402-7687550?"
// "Compare these two promoter designs"`}
        </pre>

        {/* curl */}
        <h3 style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.base.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          marginBottom: SPACE[2],
        }}>
          REST API
        </h3>
        <pre style={CODE_BLOCK}>
{`curl -X POST https://api.polymerbio.org/v1/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{"sequence": "ATGCGATCGATCG...", "name": "my_construct"}'

curl https://api.polymerbio.org/v1/genes/hg38/TP53

curl https://api.polymerbio.org/v1/biophysics/hg38/chr17:7668402-7669000`}
        </pre>
      </section>

      <div style={DIVIDER} />

      {/* ─── Try It ─── */}
      <section style={SECTION_STYLE}>
        <h2 style={{
          ...COMPONENT.sectionHeader as React.CSSProperties,
          fontSize: TYPE.xs.fontSize,
          marginBottom: SPACE[8],
          letterSpacing: '0.12em',
        }}>
          TRY IT
        </h2>
        <TryIt />
      </section>

      <div style={DIVIDER} />

      {/* ─── Links ─── */}
      <section style={{
        ...SECTION_STYLE,
        display: 'flex',
        gap: SPACE[6],
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        <Link href="/docs" style={{
          ...COMPONENT.button.ghost as React.CSSProperties,
          textDecoration: 'none',
          display: 'inline-block',
        }}>
          API Reference
        </Link>
        <Link href="https://pypi.org/project/polymer-genomics/" style={{
          ...COMPONENT.button.ghost as React.CSSProperties,
          textDecoration: 'none',
          display: 'inline-block',
        }}>
          PyPI Package
        </Link>
        <Link href="/view/hg38/chr17:7668402-7687490" style={{
          ...COMPONENT.button.ghost as React.CSSProperties,
          textDecoration: 'none',
          display: 'inline-block',
        }}>
          Genome Browser
        </Link>
        <Link href="/data-sources" style={{
          ...COMPONENT.button.ghost as React.CSSProperties,
          textDecoration: 'none',
          display: 'inline-block',
        }}>
          Data Sources
        </Link>
      </section>

      <div style={{ flex: 1 }} />
      <Footer />
    </main>
  );
}
