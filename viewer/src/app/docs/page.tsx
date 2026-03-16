'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { useIsMobile, useIsTablet } from '@/hooks/useBreakpoint';
import { copyToClipboard } from '@/lib/clipboard';
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
// MCP Tool Data
// ---------------------------------------------------------------------------

interface McpTool {
  id: string;
  name: string;
  category: 'compute' | 'reference';
  description: string;
  params: { name: string; type: string; required: boolean; default?: string; description: string }[];
}

const MCP_COMPUTE_TOOLS: McpTool[] = [
  {
    id: 'load_idats', name: 'load_idats', category: 'compute',
    description: 'Load Illumina IDAT files and create an analysis session. Auto-detects array type (450K, EPIC, EPICv2) and runs initial QC.',
    params: [
      { name: 'idat_directory', type: 'string', required: true, description: 'Path to directory containing .idat files' },
      { name: 'sample_sheet', type: 'string', required: false, description: 'Path to SampleSheet.csv (auto-detected if omitted)' },
    ],
  },
  {
    id: 'normalize', name: 'normalize', category: 'compute',
    description: 'Normalize methylation data. Supports openSesame (EPICv2), funnorm (450K/EPIC), quantile, noob, and raw.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'method', type: 'string', required: false, default: 'funnorm', description: 'Normalization method' },
    ],
  },
  {
    id: 'filter_probes', name: 'filter_probes', category: 'compute',
    description: 'Filter probes by QC criteria: detection p-value failures, SNP loci, sex chromosomes, and cross-reactive probes.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'remove_snp', type: 'boolean', required: false, default: 'true', description: 'Remove probes at known SNP positions' },
      { name: 'remove_sex', type: 'boolean', required: false, default: 'true', description: 'Remove sex chromosome probes' },
      { name: 'remove_crossreactive', type: 'boolean', required: false, default: 'true', description: 'Remove cross-reactive probes' },
    ],
  },
  {
    id: 'run_limma', name: 'run_limma', category: 'compute',
    description: 'Differential methylation analysis with limma eBayes on M-values. Returns top DMPs with delta-beta and adjusted p-values.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'group_column', type: 'string', required: true, description: 'Column name in sample sheet defining groups' },
      { name: 'contrast', type: 'string', required: false, description: 'Explicit contrast (e.g. "TET2_mut-WT"). Auto-detected for 2 groups' },
      { name: 'covariates', type: 'string[]', required: false, description: 'Covariate column names (e.g. ["Age", "Sex"])' },
      { name: 'fdr', type: 'number', required: false, default: '0.05', description: 'FDR threshold' },
    ],
  },
  {
    id: 'get_betas', name: 'get_betas', category: 'compute',
    description: 'Extract beta values (methylation levels 0\u20131). Returns inline for \u2264100 probes, writes CSV for larger requests.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'probes', type: 'string[]', required: false, description: 'Probe IDs to extract (all if omitted)' },
    ],
  },
  {
    id: 'get_m_values', name: 'get_m_values', category: 'compute',
    description: 'Extract M-values (log2 ratio, used for statistics). Returns inline for \u2264100 probes, writes CSV for larger requests.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'probes', type: 'string[]', required: false, description: 'Probe IDs to extract (all if omitted)' },
    ],
  },
  {
    id: 'volcano_plot', name: 'volcano_plot', category: 'compute',
    description: 'Generate a volcano plot from differential methylation results. Returns base64-encoded PNG for inline display.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'fdr', type: 'number', required: false, default: '0.05', description: 'FDR threshold for significance line' },
      { name: 'deltabeta', type: 'number', required: false, default: '0.1', description: 'Delta-beta threshold for effect size lines' },
    ],
  },
  {
    id: 'cluster_probes', name: 'cluster_probes', category: 'compute',
    description: 'Hierarchical clustering heatmap of the most variable probes. Returns base64-encoded PNG and cluster assignments.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
      { name: 'n_probes', type: 'integer', required: false, default: '1000', description: 'Number of top variable probes to include' },
      { name: 'distance', type: 'string', required: false, default: 'euclidean', description: 'Distance metric' },
    ],
  },
  {
    id: 'session_status', name: 'session_status', category: 'compute',
    description: 'Check which pipeline steps have been completed, list generated files, and report creation time.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID from load_idats' },
    ],
  },
  {
    id: 'cleanup_session_tool', name: 'cleanup_session_tool', category: 'compute',
    description: 'Remove an analysis session and all its data. Deletes checkpoints, results, and plots permanently.',
    params: [
      { name: 'session_id', type: 'string', required: true, description: 'Session ID to remove' },
    ],
  },
];

const MCP_NAV_ITEMS = MCP_COMPUTE_TOOLS.map(t => ({ id: `mcp-${t.id}`, title: t.name }));

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
  const [copyLabel, setCopyLabel] = useState('Copy');
  const tabs = ['curl', 'python', 'r'] as const;

  const handleCopy = async () => {
    const ok = await copyToClipboard(examples[tab]);
    if (ok) {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy'), 1500);
    }
  };

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
        <button
          onClick={handleCopy}
          style={{
            marginLeft: 'auto',
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.normal,
            color: copyLabel === 'Copied!' ? COLOR.accent.teal : COLOR.text.muted,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          {copyLabel}
        </button>
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
  const preview = lines.slice(0, 8).join('\n');
  const needsTruncation = lines.length > 8;

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
      <div style={{ position: 'relative' }}>
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
        {!expanded && needsTruncation && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 32,
            background: `linear-gradient(transparent, ${COLOR.bg.track})`,
            pointerEvents: 'none',
          }} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: COLOR.bg.primary }}>
      <BrandBar subtitle="API Reference" />

      <div style={{ display: isMobile ? 'block' : 'flex', flex: 1 }}>

      {/* ─── Sidebar Nav ─── */}
      {!isTablet && (<nav style={{
        width: 200,
        flexShrink: 0,
        borderRight: `1px solid ${COLOR.border.subtle}`,
        padding: `${SPACE[4]}px 0`,
        position: 'sticky',
        top: 44,
        height: 'calc(100vh - 44px)',
        overflowY: 'auto',
      }}>
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

        {/* MCP Server section */}
        <div style={{
          padding: `${SPACE[6]}px ${SPACE[4]}px 0`,
          marginTop: SPACE[4],
          marginBottom: SPACE[4],
          borderTop: `1px solid ${COLOR.border.subtle}`,
        }}>
          <div style={{
            color: COLOR.accent.violet,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.08em',
            paddingTop: SPACE[2],
          }}>
            MCP SERVER
          </div>
        </div>

        <a
          href="#mcp-overview"
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
            e.currentTarget.style.borderLeftColor = COLOR.accent.violet;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = COLOR.text.tertiary;
            e.currentTarget.style.borderLeftColor = 'transparent';
          }}
        >
          Overview
        </a>

        {MCP_NAV_ITEMS.map(item => (
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
              e.currentTarget.style.borderLeftColor = COLOR.accent.violet;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = COLOR.text.tertiary;
              e.currentTarget.style.borderLeftColor = 'transparent';
            }}
          >
            {item.title}
          </a>
        ))}
      </nav>)}

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>

        {/* Left column — prose */}
        <div style={{
          flex: '3 1 0',
          padding: isMobile ? `${SPACE[6]}px ${SPACE[4]}px` : `${SPACE[8]}px ${SPACE[8]}px`,
          ...(isMobile ? {} : { maxWidth: 680 }),
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

              {isMobile && (
                <div style={{ marginTop: SPACE[4] }}>
                  <CodeTabs examples={ep.examples} />
                  <div style={{ marginTop: SPACE[3] }}>
                    <ResponseBlock json={ep.response} />
                  </div>
                </div>
              )}
            </section>
          ))}

          {/* ─── MCP Server Section ─── */}
          <div style={{
            borderTop: `1px solid ${COLOR.border.default}`,
            marginTop: SPACE[8],
            paddingTop: SPACE[8],
          }}>
            <section id="mcp-overview" style={{ marginBottom: SPACE[16], scrollMarginTop: SPACE[8] }}>
              <h1 style={{
                fontSize: TYPE.xl.fontSize,
                fontWeight: WEIGHT.bold,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.primary,
                marginBottom: SPACE[4],
                letterSpacing: TYPE.xl.letterSpacing,
              }}>
                MCP Server
              </h1>

              <p style={{
                fontSize: TYPE.base.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.tertiary,
                lineHeight: 1.7,
                marginBottom: SPACE[4],
              }}>
                The Polymer Genomics MCP server exposes 41 tools for AI agent
                consumption via the{' '}
                <span style={{ color: COLOR.accent.teal }}>Model Context Protocol</span>.
                31 reference tools query polymerbio.org over HTTP.
                10 compute tools run local R/Bioconductor analysis via subprocess.
              </p>

              {/* Architecture diagram */}
              <div style={{
                padding: SPACE[4],
                backgroundColor: COLOR.bg.track,
                border: `1px solid ${COLOR.border.subtle}`,
                marginBottom: SPACE[6],
              }}>
                <pre style={{
                  margin: 0,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: COLOR.text.secondary,
                  lineHeight: 1.8,
                }}>{`Claude Code
    \u2502
polymer-genomics MCP server (local)
    \u251C\u2500 Reference tools (23)  \u2192 HTTP \u2192 api.polymerbio.org
    \u251C\u2500 Compute tools  (10)  \u2192 Rscript subprocess
    \u2514\u2500 Session state        \u2192 /tmp/polymer/sessions/`}</pre>
              </div>

              {/* Install */}
              <div style={{
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                letterSpacing: '0.08em',
                marginBottom: SPACE[2],
                fontWeight: WEIGHT.medium,
              }}>
                INSTALL
              </div>
              <div style={{
                padding: SPACE[3],
                backgroundColor: COLOR.bg.track,
                border: `1px solid ${COLOR.border.subtle}`,
                marginBottom: SPACE[6],
              }}>
                <code style={{ fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY, color: COLOR.accent.teal }}>
                  pip install polymer-genomics-mcp
                </code>
              </div>

              {/* Claude Code config */}
              <div style={{
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                letterSpacing: '0.08em',
                marginBottom: SPACE[2],
                fontWeight: WEIGHT.medium,
              }}>
                CLAUDE CODE CONFIG
              </div>
              <pre style={{
                padding: SPACE[3],
                backgroundColor: COLOR.bg.track,
                border: `1px solid ${COLOR.border.subtle}`,
                marginBottom: SPACE[6],
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.secondary,
                lineHeight: 1.6,
                overflowX: 'auto',
              }}>{`{
  "mcpServers": {
    "polymer-genomics": {
      "command": "polymer-genomics-mcp",
      "env": {
        "POLYMER_API_BASE": "https://api.polymerbio.org"
      }
    }
  }
}`}</pre>

              {/* Pipeline workflow */}
              <div style={{
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                letterSpacing: '0.08em',
                marginBottom: SPACE[2],
                fontWeight: WEIGHT.medium,
              }}>
                METHYLATION PIPELINE WORKFLOW
              </div>
              <div style={{
                padding: SPACE[4],
                backgroundColor: COLOR.bg.track,
                border: `1px solid ${COLOR.border.subtle}`,
                marginBottom: SPACE[6],
              }}>
                <pre style={{
                  margin: 0,
                  fontSize: TYPE.sm.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: COLOR.text.secondary,
                  lineHeight: 1.8,
                }}>{`load_idats \u2192 normalize \u2192 filter_probes \u2192 run_limma
                                            \u2502
                                     volcano_plot / cluster_probes
                                            \u2502
                              batch_probes \u2192 lookup_gene_expression
                              (annotate hits with reference tools)`}</pre>
              </div>

              {/* R requirements */}
              <p style={{
                fontSize: TYPE.base.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.tertiary,
                lineHeight: 1.7,
                marginBottom: SPACE[2],
              }}>
                Compute tools require local R with Bioconductor packages.
                Reference tools work without R.
              </p>
              <pre style={{
                padding: SPACE[3],
                backgroundColor: COLOR.bg.track,
                border: `1px solid ${COLOR.border.subtle}`,
                marginBottom: SPACE[6],
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.secondary,
                lineHeight: 1.6,
                overflowX: 'auto',
              }}>{`Rscript -e "install.packages('BiocManager')
BiocManager::install(c('minfi','sesame','limma','matrixStats',
  'maxprobes','ComplexHeatmap','circlize'))
install.packages(c('jsonlite','ggplot2','svglite','base64enc'))"`}</pre>

              <p style={{
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                lineHeight: 1.7,
              }}>
                Or use Docker:{' '}
                <code style={{ color: COLOR.accent.teal }}>
                  docker run polymerbio/methylation-toolkit
                </code>
              </p>
            </section>

            {/* Compute tools */}
            {MCP_COMPUTE_TOOLS.map(tool => (
              <section key={tool.id} id={`mcp-${tool.id}`} style={{ marginBottom: SPACE[12], scrollMarginTop: SPACE[8] }}>
                <div style={{ marginBottom: SPACE[3] }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    fontSize: TYPE.xs.fontSize,
                    fontFamily: FONT_FAMILY,
                    fontWeight: WEIGHT.bold,
                    color: COLOR.bg.primary,
                    backgroundColor: COLOR.accent.violet,
                    marginRight: SPACE[2],
                    letterSpacing: '0.04em',
                  }}>
                    MCP
                  </span>
                  <code style={{
                    fontSize: TYPE.base.fontSize,
                    fontFamily: FONT_FAMILY,
                    color: COLOR.accent.violet,
                  }}>
                    {tool.name}
                  </code>
                </div>

                <p style={{
                  fontSize: TYPE.base.fontSize,
                  fontFamily: FONT_FAMILY,
                  color: COLOR.text.tertiary,
                  lineHeight: 1.7,
                  marginBottom: SPACE[4],
                }}>
                  {tool.description}
                </p>

                {/* Parameters */}
                <div style={{ marginBottom: SPACE[4] }}>
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
                  {tool.params.map(p => (
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
        </div>

        {/* Right column — code examples (sticky) */}
        {!isMobile && (<div style={{
          flex: '2 1 0',
          backgroundColor: COLOR.bg.track,
          borderLeft: `1px solid ${COLOR.border.subtle}`,
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

          {/* ─── MCP Example Workflow ─── */}
          <div style={{
            borderTop: `1px solid ${COLOR.border.default}`,
            marginTop: SPACE[4],
            paddingTop: SPACE[8],
          }}>
            <div style={{
              padding: `0 ${SPACE[4]}px`,
              marginBottom: SPACE[2],
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              color: COLOR.accent.violet,
              letterSpacing: '0.08em',
              fontWeight: WEIGHT.medium,
            }}>
              MCP WORKFLOW EXAMPLE
            </div>
            <div style={{ padding: `0 ${SPACE[4]}px` }}>
              <pre style={{
                margin: 0,
                padding: SPACE[3],
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.8,
                color: COLOR.text.secondary,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                <span style={{ color: COLOR.text.muted }}>{'# In Claude Code, the agent calls tools conversationally:'}</span>{'\n\n'}
                <span style={{ borderLeft: `2px solid ${COLOR.accent.teal}`, paddingLeft: 8, color: COLOR.text.primary }}>{`> "Load my IDATs from ~/data/idats"`}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'load_idats(idat_directory="~/data/idats")'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 {session_id: "a1b2c3d4e5f6", n_samples: 18,\n   array_type: "EPICv2", n_probes: 1107072}'}</span>{'\n\n'}
                <span style={{ borderLeft: `2px solid ${COLOR.accent.teal}`, paddingLeft: 8, color: COLOR.text.primary }}>{`> "Normalize with openSesame and filter"`}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'normalize(session_id="a1b2c3d4e5f6", method="opensesame")'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 {n_probes: 935620, method: "opensesame"}'}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'filter_probes(session_id="a1b2c3d4e5f6")'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 {n_before: 935620, n_after: 795423,\n   removed_counts: {snp: 42891, sex: 18234, ...}}'}</span>{'\n\n'}
                <span style={{ borderLeft: `2px solid ${COLOR.accent.teal}`, paddingLeft: 8, color: COLOR.text.primary }}>{`> "Find DMPs between TET2_mut and WT"`}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'run_limma(session_id="a1b2c3d4e5f6",\n          group_column="Sample_Group")'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 {n_dmps: 0, contrast: "TET2_mut-WT",\n   n_tested: 795423, top_hits: [...]}'}</span>{'\n\n'}
                <span style={{ borderLeft: `2px solid ${COLOR.accent.teal}`, paddingLeft: 8, color: COLOR.text.primary }}>{`> "Make a volcano plot"`}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'volcano_plot(session_id="a1b2c3d4e5f6")'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 {image_base64: "iVBOR...", n_significant: 0}'}</span>{'\n\n'}
                <span style={{ color: COLOR.text.muted }}>{'# Then annotate hits with reference tools:'}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'batch_probes(build="hg38",\n  probe_ids=["cg08796240", "cg06545761"])'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 gene symbols, coordinates, CpG context'}</span>{'\n\n'}
                <span style={{ color: COLOR.accent.violet }}>{'lookup_gene_expression(build="hg38", symbol="VAC14")'}</span>{'\n'}
                <span style={{ color: COLOR.text.muted, paddingLeft: 8 }}>{'\u2192 GTEx 54-tissue expression profile'}</span>
              </pre>
            </div>

            {/* Spacer for remaining compute tool descriptions */}
            <div style={{ height: SPACE[8] }} />
            <div style={{ padding: `0 ${SPACE[4]}px` }}>
              <div style={{
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.accent.violet,
                letterSpacing: '0.08em',
                fontWeight: WEIGHT.medium,
                marginBottom: SPACE[2],
              }}>
                SESSION STATE MACHINE
              </div>
              <pre style={{
                margin: 0,
                padding: SPACE[3],
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                lineHeight: 1.8,
                color: COLOR.text.muted,
              }}>{`load_idats \u2192 [raw.rds]
    \u2502
normalize \u2192 [normalized.rds]
    \u2502
filter_probes \u2192 [filtered.rds]
    \u2502
run_limma \u2192 [dmps.rds, dmps.csv]
    \u2502
volcano_plot / cluster_probes
  \u2192 [volcano.svg, heatmap.svg]`}</pre>
            </div>

            <div style={{ height: SPACE[8] }} />
            <div style={{ padding: `0 ${SPACE[4]}px` }}>
              <div style={{
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.accent.violet,
                letterSpacing: '0.08em',
                fontWeight: WEIGHT.medium,
                marginBottom: SPACE[2],
              }}>
                REFERENCE TOOLS (23)
              </div>
              <p style={{
                fontSize: TYPE.sm.fontSize,
                fontFamily: FONT_FAMILY,
                color: COLOR.text.muted,
                lineHeight: 1.7,
              }}>
                All REST API endpoints above are also available as MCP tools
                with the same parameters. The MCP server wraps each endpoint
                so agents can call them without constructing HTTP requests.
              </p>
            </div>
          </div>
        </div>)}
      </div>
      </div>

      <Footer />
    </div>
  );
}
