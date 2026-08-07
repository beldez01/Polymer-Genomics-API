'use client';

import { useState } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { DocsSidebar, type NavItem } from '@/components/docs/DocsSidebar';
import { CodeBlock, InlineCode } from '@/components/docs/CodeBlock';
import { EndpointCard } from '@/components/docs/EndpointCard';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { ENDPOINTS, ENDPOINT_GROUPS, ERROR_CODES, MCP_TOOLS, MCP_REFERENCE_COUNT, MCP_COMPUTE_COUNT, MCP_TOTAL, API_BASE } from '@/config/apiDocsData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Docs</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>API · MCP · SDK</span>
  </span>
);

const NAV: NavItem[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'quickstart',  label: 'Quickstart' },
  { id: 'auth',        label: 'Authentication' },
  {
    id: 'endpoints', label: 'Endpoints',
    children: ENDPOINTS.map((e) => ({ id: e.id, label: e.title })),
  },
  { id: 'mcp',         label: 'MCP for agents' },
  { id: 'errors',      label: 'Errors' },
];

function Heading({ id, level = 2, children, eyebrow }: { id: string; level?: 2 | 3; children: React.ReactNode; eyebrow?: string }) {
  return (
    <div id={id} style={{ marginBottom: SPACE[5], marginTop: level === 2 ? SPACE[12] : SPACE[8], scrollMarginTop: 80 }}>
      {eyebrow && (
        <div style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: SPACE[2],
        }}>
          {eyebrow}
        </div>
      )}
      {level === 2 ? (
        <h2 style={{
          margin: 0,
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.xl.fontSize,
          lineHeight: TYPE.xl.lineHeight,
          letterSpacing: TYPE.xl.letterSpacing,
          fontWeight: WEIGHT.bold,
          paddingBottom: SPACE[3],
          borderBottom: `1px solid ${COLOR.border.strong}`,
        }}>
          {children}
        </h2>
      ) : (
        <h3 style={{
          margin: 0,
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.lg.fontSize,
          lineHeight: TYPE.lg.lineHeight,
          letterSpacing: TYPE.lg.letterSpacing,
          fontWeight: WEIGHT.semibold,
        }}>
          {children}
        </h3>
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

export default function DocsPage() {
  const [activeId, setActiveId] = useState('overview');

  const handleSelect = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <div style={{
        display: 'flex',
        maxWidth: 1440,
        width: '100%',
        margin: '0 auto',
        paddingLeft: SPACE[6],
        paddingRight: SPACE[6],
        flex: 1,
      }}>
        <DocsSidebar items={NAV} activeId={activeId} onSelect={handleSelect} />

        <section style={{
          flex: 1,
          maxWidth: 880,
          padding: `${SPACE[10]}px ${SPACE[8]}px ${SPACE[16]}px`,
        }}>
          {/* Page header */}
          <div style={{ marginBottom: SPACE[8] }}>
            <div style={{
              color: COLOR.text.faint,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: SPACE[3],
            }}>
              § DOCS · API v1 · MCP · Python SDK
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
              Documentation
            </h1>
            <p style={{
              margin: 0,
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.md.fontSize,
              lineHeight: 1.55,
            }}>
              REST API, Model Context Protocol server, and Python SDK for
              genome-wide DNA biophysics. Every response carries provenance,
              evidence class, and content hash.
            </p>
          </div>

          {/* Overview */}
          <Heading id="overview" eyebrow="§ 01">Overview</Heading>
          <Prose>
            The Polymer API serves the material channel of the genome — stacking energy, curvature,
            flexibility, groove geometry — computed at base-pair resolution across <InlineCode>50</InlineCode> layers.
            Every response includes <InlineCode>api_version</InlineCode>, <InlineCode>data_version</InlineCode>,
            an evidence class (M / K / D / S / H), source URI, license, and a content hash so
            agents and downstream pipelines can audit and cache.
          </Prose>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: SPACE[3],
            marginBottom: SPACE[6],
          }}>
            {[
              { label: 'Base URL',    value: API_BASE },
              { label: 'API Version', value: 'v1 · stable' },
              { label: 'SDK',         value: 'pip install polymer-genomics' },
            ].map((s) => (
              <div key={s.label} style={{
                padding: SPACE[3],
                backgroundColor: COLOR.bg.elevated,
                border: `1px solid ${COLOR.border.default}`,
                borderRadius: 2,
              }}>
                <div style={{
                  color: COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: 10,
                  fontWeight: WEIGHT.medium,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  {s.label}
                </div>
                <div className="tabular" style={{
                  color: COLOR.text.primary,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.sm.fontSize,
                  fontWeight: WEIGHT.semibold,
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Quickstart */}
          <Heading id="quickstart" eyebrow="§ 02">Quickstart</Heading>
          <Prose>
            Install the SDK and fetch your first region. The example uses the TP53 locus on hg38.
          </Prose>
          <div style={{ marginBottom: SPACE[4] }}>
            <CodeBlock language="bash" code="pip install polymer-genomics" />
          </div>
          <div style={{ marginBottom: SPACE[4] }}>
            <CodeBlock language="python" code={`from polymer_genomics import PolymerClient\n\nclient = PolymerClient(api_key="POLY_...")\n\nregion = client.regions.fetch("hg38", "chr17:7668421-7687490")\nprint(region.stacking_dg37.mean)            # -8.42 kcal/mol\nprint(region.cpg_sites.count)                # 47\nprint(region.evidence_classes)               # {'thermodynamics': 'D', 'cpg_sites': 'K'}`} />
          </div>
          <Prose>
            Without an SDK, hit the REST API directly. Use the curl below — any HTTP client works.
          </Prose>
          <CodeBlock language="bash" code={`curl '${API_BASE}/v1/genes/hg38/TP53' \\\n  -H 'X-API-Key: $POLYMER_API_KEY'`} />

          {/* Auth */}
          <Heading id="auth" eyebrow="§ 03">Authentication</Heading>
          <Prose>
            All requests must include the <InlineCode>X-API-Key</InlineCode> header. Request a key
            at <span style={{ color: COLOR.primary.base }}>polymerbio.org/developers</span>.
            Free tier: 1,000 requests/day. Rate limits are returned in <InlineCode>X-RateLimit-Remaining</InlineCode>.
          </Prose>

          {/* Endpoints */}
          <Heading id="endpoints" eyebrow="§ 04">Endpoints</Heading>
          <Prose>
            Reference endpoints return curated data with provenance. Compute endpoints run the physics linter or
            aggregate over a region. All responses include <InlineCode>data_version</InlineCode> and content-hash headers.
          </Prose>

          {ENDPOINT_GROUPS.map(([groupName, endpoints]) => (
            <div key={groupName} style={{ marginBottom: SPACE[6] }}>
              <Heading id={`group-${groupName.toLowerCase()}`} level={3}>{groupName}</Heading>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
                {endpoints.map((ep) => <EndpointCard key={ep.id} endpoint={ep} />)}
              </div>
            </div>
          ))}

          {/* MCP */}
          <Heading id="mcp" eyebrow="§ 05">MCP for agents</Heading>
          <Prose>
            The Model Context Protocol server exposes <InlineCode>{MCP_TOTAL}</InlineCode> tools to LLM agents —{' '}
            <InlineCode>{MCP_REFERENCE_COUNT}</InlineCode> reference and <InlineCode>{MCP_COMPUTE_COUNT}</InlineCode> compute.
            Connect via stdio for local agents or HTTP/SSE for hosted deployments.
          </Prose>
          <div style={{ marginBottom: SPACE[4] }}>
            <CodeBlock language="bash" code={`# Local stdio (Claude Desktop, etc.)\nuv run polymer-mcp serve\n\n# Hosted HTTP/SSE\npolymer-mcp serve --transport sse --port 8050`} />
          </div>
          <div style={{
            border: `1px solid ${COLOR.border.default}`,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize }}>
              <thead>
                <tr style={{ backgroundColor: COLOR.bg.elevated }}>
                  {['Tool', 'Signature', 'Description'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: `${SPACE[2]}px ${SPACE[3]}px`,
                      color: COLOR.text.tertiary,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: 10,
                      fontWeight: WEIGHT.medium,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${COLOR.border.subtle}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MCP_TOOLS.map((t, i) => (
                  <tr key={t.name} style={{
                    borderBottom: i === MCP_TOOLS.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
                  }}>
                    <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize }}>
                      <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.semibold }}>{t.name}</span>
                    </td>
                    <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, color: COLOR.text.tertiary }}>
                      ({t.signature})
                    </td>
                    <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.secondary, fontSize: TYPE.sm.fontSize }}>
                      {t.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.04em',
            marginTop: SPACE[2],
          }}>
            Showing {MCP_TOOLS.length} of {MCP_TOTAL}. See full list at <span style={{ color: COLOR.primary.base }}>/developers</span>.
          </div>

          {/* Errors */}
          <Heading id="errors" eyebrow="§ 06">Errors</Heading>
          <Prose>
            All errors return a JSON body with <InlineCode>code</InlineCode>, <InlineCode>message</InlineCode>,
            and optional <InlineCode>details</InlineCode>. Status codes follow standard HTTP conventions.
          </Prose>
          <div style={{
            border: `1px solid ${COLOR.border.default}`,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize }}>
              <thead>
                <tr style={{ backgroundColor: COLOR.bg.elevated }}>
                  {['Status', 'Code', 'Description'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: `${SPACE[2]}px ${SPACE[3]}px`,
                      color: COLOR.text.tertiary,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: 10,
                      fontWeight: WEIGHT.medium,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${COLOR.border.subtle}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ERROR_CODES.map((e, i) => (
                  <tr key={e.code} style={{
                    borderBottom: i === ERROR_CODES.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
                  }}>
                    <td className="tabular" style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.sm.fontSize }}>
                      <span style={{
                        color: e.status >= 500 ? COLOR.accent.rose : e.status >= 400 ? COLOR.accent.amber : COLOR.text.primary,
                        fontWeight: WEIGHT.semibold,
                      }}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize }}>
                      <span style={{ color: COLOR.primary.base, fontWeight: WEIGHT.semibold }}>{e.code}</span>
                    </td>
                    <td style={{ padding: `${SPACE[2]}px ${SPACE[3]}px`, color: COLOR.text.secondary }}>
                      {e.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Footer />
    </main>
  );
}
