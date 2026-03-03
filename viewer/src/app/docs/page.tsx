'use client';

import { useState } from 'react';
import Link from 'next/link';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT, SPACE } from '@/config/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Param {
  name: string;
  location: 'path' | 'query' | 'body';
  type: string;
  required: boolean;
  default?: string;
  description: string;
}

interface Endpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  params: Param[];
  examples: { curl: string; python: string; r: string };
  response: string;
}

// ---------------------------------------------------------------------------
// Endpoint Data
// ---------------------------------------------------------------------------

const BASE = 'https://api.polymerbio.org';

const ENDPOINTS: Endpoint[] = [
  {
    id: 'regions',
    method: 'GET',
    path: '/v1/regions/{build}/{region}',
    title: 'Query Region',
    description: 'The primary endpoint. Returns all annotation layers for a genomic region. Layers are returned as GRanges objects with metadata columns.',
    params: [
      { name: 'build', location: 'path', type: 'string', required: true, description: 'Genome build: hg38 or hg37' },
      { name: 'region', location: 'path', type: 'string', required: true, description: 'Genomic region, e.g. chr17:7668421-7687490' },
      { name: 'layers', location: 'query', type: 'string', required: false, description: 'Comma-separated layer keys to include' },
      { name: 'coords', location: 'query', type: 'string', required: false, default: '1based', description: 'Coordinate system: 1based or 0based' },
      { name: 'limit', location: 'query', type: 'integer', required: false, description: 'Max features per layer' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/regions/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites"`,
      python: `import requests

resp = requests.get(
    "${BASE}/v1/regions/hg38/chr17:7668421-7687490",
    params={"layers": "gencode_v44,cpg_sites"}
)
data = resp.json()`,
      r: `library(httr2)

resp <- request("${BASE}/v1/regions/hg38/chr17:7668421-7687490") |>
  req_url_query(layers = "gencode_v44,cpg_sites") |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `{
  "status": "complete",
  "coordinate_system": "1-based_closed",
  "query": {
    "build": "hg38",
    "chr": "chr17",
    "start": 7668421,
    "end": 7687490
  },
  "data": {
    "gencode_v44": { "class": "GRanges", "n": 42, ... },
    "cpg_sites":   { "class": "GRanges", "n": 156, ... }
  },
  "timing": { "query_time_ms": 12.4 }
}`,
  },
  {
    id: 'genes',
    method: 'GET',
    path: '/v1/genes/{build}/{symbol}',
    title: 'Get Gene',
    description: 'Look up a gene by symbol. Returns transcript features as GRanges with exon, UTR, and CDS annotations.',
    params: [
      { name: 'build', location: 'path', type: 'string', required: true, description: 'Genome build' },
      { name: 'symbol', location: 'path', type: 'string', required: true, description: 'Gene symbol, e.g. TP53, BRCA1' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/genes/hg38/TP53"`,
      python: `resp = requests.get("${BASE}/v1/genes/hg38/TP53")
gene = resp.json()`,
      r: `resp <- request("${BASE}/v1/genes/hg38/TP53") |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `{
  "status": "complete",
  "data": {
    "class": "GRanges",
    "seqnames": ["chr17", "chr17", ...],
    "ranges": {
      "start": [7668421, 7669609, ...],
      "end":   [7687490, 7669690, ...],
      "width": [19070, 82, ...]
    },
    "strand": ["-", "-", ...],
    "mcols": {
      "feature_type": ["transcript", "exon", ...],
      "gene_symbol": ["TP53", "TP53", ...]
    }
  }
}`,
  },
  {
    id: 'sequence',
    method: 'GET',
    path: '/v1/sequence/{build}/{region}',
    title: 'Get Sequence',
    description: 'Retrieve the raw DNA sequence for a genomic region. Returns an uppercase nucleotide string.',
    params: [
      { name: 'build', location: 'path', type: 'string', required: true, description: 'Genome build' },
      { name: 'region', location: 'path', type: 'string', required: true, description: 'Genomic region' },
      { name: 'coords', location: 'query', type: 'string', required: false, default: '1based', description: 'Coordinate system' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/sequence/hg38/chr17:7676000-7676100"`,
      python: `resp = requests.get("${BASE}/v1/sequence/hg38/chr17:7676000-7676100")
seq = resp.json()["data"]["sequence"]`,
      r: `resp <- request("${BASE}/v1/sequence/hg38/chr17:7676000-7676100") |>
  req_perform() |>
  resp_body_json()
seq <- resp$data$sequence`,
    },
    response: `{
  "status": "complete",
  "data": {
    "sequence": "ATCGATCG...",
    "length": 101,
    "chr": "chr17",
    "start": 7676000,
    "end": 7676100
  }
}`,
  },
  {
    id: 'probes',
    method: 'GET',
    path: '/v1/probes/{build}/{probe_id}',
    title: 'Get Probe',
    description: 'Look up a single methylation array probe by ID. Returns coordinates, CpG context, and cross-mapping information.',
    params: [
      { name: 'build', location: 'path', type: 'string', required: true, description: 'Genome build' },
      { name: 'probe_id', location: 'path', type: 'string', required: true, description: 'Probe identifier, e.g. cg00000029' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/probes/hg38/cg00000029"`,
      python: `resp = requests.get("${BASE}/v1/probes/hg38/cg00000029")
probe = resp.json()["data"]`,
      r: `resp <- request("${BASE}/v1/probes/hg38/cg00000029") |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `{
  "status": "complete",
  "data": {
    "probe_id": "cg00000029",
    "chr": "chr16",
    "start": 53434200,
    "end": 53434201,
    "cpg_context": "open_sea",
    "arrays": ["epic_v2", "epic_v1", "450k"]
  }
}`,
  },
  {
    id: 'probes-batch',
    method: 'POST',
    path: '/v1/probes/{build}/batch',
    title: 'Batch Probes',
    description: 'Look up multiple probes in a single request. Accepts a JSON body with an array of probe IDs.',
    params: [
      { name: 'build', location: 'path', type: 'string', required: true, description: 'Genome build' },
      { name: 'probe_ids', location: 'body', type: 'string[]', required: true, description: 'Array of probe identifiers' },
    ],
    examples: {
      curl: `curl -X POST "${BASE}/v1/probes/hg38/batch" \\
  -H "Content-Type: application/json" \\
  -d '{"probe_ids": ["cg00000029", "cg00000108"]}'`,
      python: `resp = requests.post(
    "${BASE}/v1/probes/hg38/batch",
    json={"probe_ids": ["cg00000029", "cg00000108"]}
)`,
      r: `resp <- request("${BASE}/v1/probes/hg38/batch") |>
  req_method("POST") |>
  req_body_json(list(probe_ids = c("cg00000029", "cg00000108"))) |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `{
  "status": "complete",
  "data": {
    "cg00000029": { "chr": "chr16", ... },
    "cg00000108": { "chr": "chr4", ... }
  }
}`,
  },
  {
    id: 'search',
    method: 'GET',
    path: '/v1/search',
    title: 'Search Genes',
    description: 'Search for gene symbols by prefix. Returns matching gene names for autocomplete.',
    params: [
      { name: 'q', location: 'query', type: 'string', required: true, description: 'Search query (min 1 character)' },
      { name: 'build', location: 'query', type: 'string', required: true, description: 'Genome build' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/search?q=BRC&build=hg38"`,
      python: `resp = requests.get(
    "${BASE}/v1/search",
    params={"q": "BRC", "build": "hg38"}
)`,
      r: `resp <- request("${BASE}/v1/search") |>
  req_url_query(q = "BRC", build = "hg38") |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `{
  "results": [
    { "gene_symbol": "BRCA1" },
    { "gene_symbol": "BRCA2" },
    { "gene_symbol": "BRCC3" }
  ]
}`,
  },
  {
    id: 'layers',
    method: 'GET',
    path: '/v1/layers',
    title: 'List Layers',
    description: 'List all available annotation layers. Returns metadata including row counts and versioning.',
    params: [
      { name: 'type', location: 'query', type: 'string', required: false, description: 'Filter by layer type' },
      { name: 'build', location: 'query', type: 'string', required: false, description: 'Filter by genome build' },
      { name: 'active', location: 'query', type: 'boolean', required: false, default: 'true', description: 'Only show active layers' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/layers?build=hg38"`,
      python: `resp = requests.get("${BASE}/v1/layers", params={"build": "hg38"})
layers = resp.json()`,
      r: `resp <- request("${BASE}/v1/layers") |>
  req_url_query(build = "hg38") |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `[
  {
    "layer_key": "gencode_v44",
    "name": "GENCODE v44",
    "type": "gene_model",
    "build": "hg38",
    "row_count": 2800000,
    "active": true
  },
  ...
]`,
  },
  {
    id: 'aggregation',
    method: 'GET',
    path: '/v1/aggregation/{build}/{region}',
    title: 'Aggregate Region',
    description: 'Get binned density and summary statistics for a region. Useful for visualizing large regions where individual features are too dense.',
    params: [
      { name: 'build', location: 'path', type: 'string', required: true, description: 'Genome build' },
      { name: 'region', location: 'path', type: 'string', required: true, description: 'Genomic region' },
      { name: 'layers', location: 'query', type: 'string', required: false, description: 'Layer keys to aggregate' },
      { name: 'resolution', location: 'query', type: 'integer', required: false, default: '1000', description: 'Bin size in base pairs' },
    ],
    examples: {
      curl: `curl "${BASE}/v1/aggregation/hg38/chr17:7000000-8000000?layers=cpg_sites&resolution=10000"`,
      python: `resp = requests.get(
    "${BASE}/v1/aggregation/hg38/chr17:7000000-8000000",
    params={"layers": "cpg_sites", "resolution": 10000}
)`,
      r: `resp <- request("${BASE}/v1/aggregation/hg38/chr17:7000000-8000000") |>
  req_url_query(layers = "cpg_sites", resolution = 10000) |>
  req_perform() |>
  resp_body_json()`,
    },
    response: `{
  "data": {
    "cpg_sites": {
      "bins": [
        { "bin_start": 7000000, "bin_end": 7010000, "count": 42, "density": 0.0042 },
        ...
      ],
      "resolution": 10000,
      "n_bins": 100
    }
  }
}`,
  },
];

const NAV_ITEMS = ENDPOINTS.map(e => ({ id: e.id, title: e.title, method: e.method }));

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MethodBadge({ method }: { method: string }) {
  const color = method === 'GET' ? COLOR.accent.teal : COLOR.accent.amber;
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      fontSize: TYPE.xs.fontSize,
      fontFamily: FONT_FAMILY,
      fontWeight: WEIGHT.bold,
      color: COLOR.bg.primary,
      backgroundColor: color,
      marginRight: SPACE[2],
      letterSpacing: '0.04em',
    }}>
      {method}
    </span>
  );
}

function CodeTabs({ examples }: { examples: { curl: string; python: string; r: string } }) {
  const [tab, setTab] = useState<'curl' | 'python' | 'r'>('curl');
  const tabs = ['curl', 'python', 'r'] as const;

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: `${SPACE[1]}px ${SPACE[3]}px`,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: tab === t ? WEIGHT.medium : WEIGHT.normal,
              color: tab === t ? COLOR.accent.teal : COLOR.text.muted,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${COLOR.accent.teal}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <pre style={{
        margin: 0,
        padding: SPACE[3],
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        lineHeight: 1.6,
        color: COLOR.text.secondary,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {examples[tab]}
      </pre>
    </div>
  );
}

function ResponseBlock({ json }: { json: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = json.split('\n');
  const preview = lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n  ...' : '');

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: `${SPACE[1]}px ${SPACE[3]}px`,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          color: COLOR.text.muted,
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${COLOR.border.subtle}`,
          cursor: 'pointer',
        }}
      >
        Response {expanded ? '\u25B4' : '\u25BE'}
      </button>
      <pre style={{
        margin: 0,
        padding: SPACE[3],
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        lineHeight: 1.6,
        color: COLOR.text.tertiary,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
      }}>
        {expanded ? json : preview}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: COLOR.bg.primary }}>

      {/* ─── Sidebar Nav ─── */}
      <nav style={{
        width: 200,
        flexShrink: 0,
        borderRight: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[6]}px 0`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>
        <Link href="/" style={{
          display: 'block',
          padding: `0 ${SPACE[4]}px`,
          marginBottom: SPACE[6],
          color: COLOR.accent.teal,
          fontSize: 13,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.08em',
          textDecoration: 'none',
        }}>
          POLYMER
        </Link>

        <div style={{
          padding: `0 ${SPACE[4]}px`,
          marginBottom: SPACE[4],
          color: COLOR.accent.teal,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.08em',
        }}>
          API REFERENCE
        </div>

        {NAV_ITEMS.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            style={{
              display: 'block',
              padding: `${SPACE[1] + 1}px ${SPACE[4]}px`,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              color: COLOR.text.tertiary,
              textDecoration: 'none',
              borderLeft: '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = COLOR.text.primary;
              e.currentTarget.style.borderLeftColor = COLOR.accent.teal;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = COLOR.text.tertiary;
              e.currentTarget.style.borderLeftColor = 'transparent';
            }}
          >
            {item.title}
          </a>
        ))}
      </nav>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>

        {/* Left column — prose */}
        <div style={{
          flex: '3 1 0',
          padding: `${SPACE[8]}px ${SPACE[8]}px`,
          maxWidth: 680,
          overflowY: 'auto',
        }}>
          {/* Overview */}
          <h1 style={{
            fontSize: TYPE.xl.fontSize,
            fontWeight: WEIGHT.bold,
            fontFamily: FONT_FAMILY,
            color: COLOR.text.primary,
            marginBottom: SPACE[4],
            letterSpacing: TYPE.xl.letterSpacing,
          }}>
            API Reference
          </h1>

          <p style={{
            fontSize: TYPE.base.fontSize,
            fontFamily: FONT_FAMILY,
            color: COLOR.text.tertiary,
            lineHeight: 1.7,
            marginBottom: SPACE[6],
          }}>
            The Polymer Genomics API serves curated genomic annotations at
            base-pair resolution. All endpoints return JSON with 1-based closed
            coordinates by default.
          </p>

          <div style={{
            padding: SPACE[4],
            backgroundColor: COLOR.bg.track,
            border: `1px solid ${COLOR.border.subtle}`,
            marginBottom: SPACE[8],
          }}>
            <div style={{ fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY, color: COLOR.text.muted, marginBottom: SPACE[2] }}>
              BASE URL
            </div>
            <code style={{ fontSize: TYPE.base.fontSize, fontFamily: FONT_FAMILY, color: COLOR.accent.teal }}>
              https://api.polymerbio.org
            </code>
          </div>

          {/* Endpoints */}
          {ENDPOINTS.map(ep => (
            <section key={ep.id} id={ep.id} style={{ marginBottom: SPACE[16], scrollMarginTop: SPACE[8] }}>
              <div style={{ marginBottom: SPACE[4] }}>
                <MethodBadge method={ep.method} />
                <code style={{
                  fontSize: TYPE.base.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: COLOR.accent.teal,
                }}>
                  {ep.path}
                </code>
              </div>

              <h2 style={{
                fontSize: TYPE.lg.fontSize,
                fontWeight: WEIGHT.bold,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.primary,
                marginBottom: SPACE[2],
                letterSpacing: TYPE.lg.letterSpacing,
              }}>
                {ep.title}
              </h2>

              <p style={{
                fontSize: TYPE.base.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.tertiary,
                lineHeight: 1.7,
                marginBottom: SPACE[6],
              }}>
                {ep.description}
              </p>

              {/* Parameters */}
              <div style={{ marginBottom: SPACE[6] }}>
                <div style={{
                  fontSize: TYPE.xs.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: COLOR.text.muted,
                  letterSpacing: '0.08em',
                  marginBottom: SPACE[2],
                  fontWeight: WEIGHT.medium,
                }}>
                  PARAMETERS
                </div>
                {ep.params.map(p => (
                  <div key={p.name} style={{
                    display: 'flex',
                    gap: SPACE[3],
                    padding: `${SPACE[2]}px 0`,
                    borderBottom: `1px solid ${COLOR.border.subtle}`,
                    alignItems: 'baseline',
                  }}>
                    <code style={{
                      fontSize: TYPE.sm.fontSize,
                      fontFamily: FONT_FAMILY,
                      color: COLOR.text.primary,
                      flexShrink: 0,
                      minWidth: 90,
                    }}>
                      {p.name}
                    </code>
                    <span style={{
                      fontSize: TYPE.xs.fontSize,
                      fontFamily: FONT_FAMILY,
                      color: COLOR.text.muted,
                      flexShrink: 0,
                    }}>
                      {p.type}
                      {p.required && <span style={{ color: COLOR.accent.rose, marginLeft: 4 }}>*</span>}
                      {p.default && <span> = {p.default}</span>}
                    </span>
                    <span style={{
                      fontSize: TYPE.sm.fontSize,
                      fontFamily: FONT_FAMILY,
                      color: COLOR.text.tertiary,
                    }}>
                      {p.description}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Right column — code examples (sticky) */}
        <div style={{
          flex: '2 1 0',
          backgroundColor: COLOR.bg.track,
          borderLeft: `1px solid ${COLOR.border.subtle}`,
          overflowY: 'auto',
          padding: `${SPACE[8]}px 0`,
        }}>
          {/* Spacer for overview section */}
          <div style={{ height: 180 }} />

          {ENDPOINTS.map(ep => (
            <div key={ep.id} style={{
              marginBottom: SPACE[16],
              borderBottom: `1px solid ${COLOR.border.subtle}`,
              paddingBottom: SPACE[6],
            }}>
              <div style={{
                padding: `0 ${SPACE[4]}px`,
                marginBottom: SPACE[2],
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                letterSpacing: '0.08em',
                fontWeight: WEIGHT.medium,
              }}>
                EXAMPLE
              </div>
              <div style={{ padding: `0 ${SPACE[4]}px` }}>
                <CodeTabs examples={ep.examples} />
              </div>
              <div style={{ padding: `0 ${SPACE[4]}px`, marginTop: SPACE[3] }}>
                <ResponseBlock json={ep.response} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
