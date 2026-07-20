/**
 * Export helpers for Formal Claim IR objects.
 *
 *   exportClaimJSON(claim)     → downloads a canonicalized JSON file.
 *   exportClaimNotebook(claim) → downloads a scaffolded .ipynb file whose
 *                                cells are derived from premises / operations /
 *                                inference / conclusion. The notebook is a
 *                                *scaffold* — it does not execute the DAG
 *                                (that's what src/polymer_genomics/formal_claims/
 *                                evaluate.py will do in M2). Useful as a
 *                                starting point for a human or agent to fill in.
 *
 * Both functions trigger a browser download via a transient anchor; they do
 * no server round-trips.
 */

import type {
  FormalClaim,
  Operation,
  Premise,
} from '@/config/formal_claims';

// ---------------------------------------------------------------------------
// Canonical JSON
// ---------------------------------------------------------------------------

/**
 * Recursively stringify with sorted keys (RFC 8785-style ordering, two-space
 * indentation for readability). Matches what the Python canonicalize.py
 * module will eventually produce for content-hash stability.
 */
function canonicalStringify(value: unknown, indent = 2): string {
  const stringify = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(stringify);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v as Record<string, unknown>).sort()) {
      out[key] = stringify((v as Record<string, unknown>)[key]);
    }
    return out;
  };
  return JSON.stringify(stringify(value), null, indent);
}

export function exportClaimJSON(claim: FormalClaim): void {
  const text = canonicalStringify(claim);
  const filename = `${slugify(claim.title) || 'claim'}.canonical.json`;
  download(filename, text, 'application/json');
}

// ---------------------------------------------------------------------------
// Scaffold notebook
// ---------------------------------------------------------------------------

interface NotebookCell {
  cell_type: 'markdown' | 'code';
  metadata: Record<string, unknown>;
  source: string[];
  outputs?: unknown[];
  execution_count?: number | null;
}

interface Notebook {
  cells: NotebookCell[];
  metadata: {
    kernelspec: { name: string; display_name: string; language: string };
    language_info: { name: string };
    formal_claim: { id: string; schema_version: string; exported_at: string };
  };
  nbformat: 4;
  nbformat_minor: 5;
}

function md(lines: string[]): NotebookCell {
  return {
    cell_type: 'markdown',
    metadata: {},
    source: joinWithNewlines(lines),
  };
}

function code(lines: string[]): NotebookCell {
  return {
    cell_type: 'code',
    metadata: {},
    source: joinWithNewlines(lines),
    outputs: [],
    execution_count: null,
  };
}

/**
 * Jupyter `source` is an array of lines; each line except the last should
 * end with a newline character for the notebook to render cleanly.
 */
function joinWithNewlines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(i === lines.length - 1 ? lines[i] : lines[i] + '\n');
  }
  return out;
}

function buildScaffoldNotebook(claim: FormalClaim): Notebook {
  const cells: NotebookCell[] = [];

  cells.push(
    md([
      `# ${claim.title}`,
      '',
      `**Outcome:** \`${claim.conclusion.outcome}\`  `,
      `**Experiment:** ${claim.exp_number ?? '—'}  `,
      `**Claim ID:** \`${claim.id}\`  `,
      `**Schema:** ${claim.schema_version}  `,
      `**API/Data:** \`${claim.api_version}\` / \`${claim.data_version}\``,
      '',
      `> ${claim.conclusion.assertion}`,
      '',
      'This notebook is a **scaffold** generated from the Formal Claim IR. ' +
        "Each premise, operation, and the inference rule are emitted as " +
        'stub cells so you (or an agent) can fill in real code that reproduces ' +
        'the statistics. When `evaluate.py` lands in M2 of the Epistemic OS ' +
        'build plan, it will execute this structure directly; until then the ' +
        'cells below exist as a human-writable starting point.',
    ]),
  );

  cells.push(
    code([
      '# Setup — pin the Polymer Genomics SDK version used by this claim.',
      '# !pip install polymer-genomics==0.3.0',
      '',
      'from polymer_genomics import PolymerClient  # placeholder',
      '',
      `API_VERSION = ${JSON.stringify(claim.api_version)}`,
      `DATA_VERSION = ${JSON.stringify(claim.data_version)}`,
      '',
      '# client = PolymerClient()',
    ]),
  );

  // Premises
  cells.push(md(['## 1. Premises (P)']));
  for (const p of claim.premises) {
    cells.push(
      md([
        `### \`${p.id}\``,
        '',
        `**Layer:** \`${p.source.layer}@${p.source.version}\`  `,
        `**Provenance:** \`${p.source.provenance_state}\``,
        ...(p.source.note ? ['', `*${p.source.note}*`] : []),
      ]),
    );
    cells.push(
      code([
        `# ${p.id}`,
        `# Predicate (serialize your own DSL → SQL / API call):`,
        `# ${predicateSummary(p)}`,
        '',
        `# ${p.id} = client.query(`,
        `#     layer=${JSON.stringify(p.source.layer)},`,
        `#     version=${JSON.stringify(p.source.version)},`,
        `#     where=...  # TODO: translate the predicate tree`,
        `# )`,
      ]),
    );
  }

  // Operations
  cells.push(md(['## 2. Operations (O) — DAG']));
  cells.push(
    md([
      'Operations listed in document order, which is a valid topological ' +
        'sort for this claim. Each cell stubs one operation; fill in the ' +
        'computation using the inputs declared by the operation.',
    ]),
  );
  for (const op of claim.operations) {
    cells.push(
      code([
        `# ${op.id}  (${op.kind})`,
        `# inputs: ${op.inputs.join(', ') || '—'}`,
        ...operationNotebookHints(op),
      ]),
    );
  }

  // Statistics
  cells.push(md(['## 3. Statistics (S) — expected values']));
  cells.push(md(['When the cells above are run, the following statistics should materialize:']));
  const statRows = claim.statistics.map(
    (s) => `- \`${s.id}\` (${s.evidence_class}) — \`${s.name}\`: \`${formatJSONValue(s.value)}\``,
  );
  cells.push(md(statRows));

  // Inference
  cells.push(
    md([
      '## 4. Inference rule (I)',
      '',
      `\`${inferenceSummary(claim)}\``,
      '',
      `**Justification:** ${claim.inference.justification}`,
      ...(claim.inference.failure_mode
        ? ['', `**Failure mode:** ${claim.inference.failure_mode}`]
        : []),
    ]),
  );
  cells.push(
    code([
      '# Evaluate the inference rule against the materialized statistics above.',
      '# stats = { ... }  # fill in from the preceding cells',
      '# assert stats["' +
        (claim.statistics[0]?.id ?? 'stat_id') +
        '"] > 0.0  # example conjunct',
    ]),
  );

  // Conclusion
  cells.push(
    md([
      '## 5. Conclusion (C)',
      '',
      `> ${claim.conclusion.assertion}`,
      '',
      `**Outcome:** \`${claim.conclusion.outcome}\``,
    ]),
  );

  if (claim.external_assumptions.length > 0) {
    cells.push(md(['## External assumptions']));
    for (const a of claim.external_assumptions) {
      cells.push(
        md([
          `- **${a.kind}** (conf = ${a.confidence.toFixed(2)}): ${a.statement}` +
            (a.citation ? `  \n  _${a.citation}_` : ''),
        ]),
      );
    }
  }

  return {
    cells,
    metadata: {
      kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' },
      language_info: { name: 'python' },
      formal_claim: {
        id: claim.id,
        schema_version: claim.schema_version,
        exported_at: new Date().toISOString(),
      },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

export function exportClaimNotebook(claim: FormalClaim): void {
  const nb = buildScaffoldNotebook(claim);
  const text = JSON.stringify(nb, null, 2);
  const filename = `${slugify(claim.title) || 'claim'}.scaffold.ipynb`;
  download(filename, text, 'application/x-ipynb+json');
}

// ---------------------------------------------------------------------------
// Per-operation scaffolding hints
// ---------------------------------------------------------------------------

function operationNotebookHints(op: Operation): string[] {
  switch (op.kind) {
    case 'filter':
      return [`# Apply predicate to ${op.inputs[0]} → ${op.id}`];
    case 'project':
      return [
        `# Project columns from ${op.inputs[0]} → ${op.id}:`,
        `# cols = ${JSON.stringify(op.cols)}`,
      ];
    case 'join':
      return [
        `# Join ${op.inputs[0]} ⨝ ${op.inputs[1]} on "${op.on}" → ${op.id}`,
      ];
    case 'aggregate':
      return [
        `# Aggregate ${op.inputs[0]} by ${op.by.join(', ')} → ${op.id}`,
        `# agg = ${JSON.stringify(op.agg)}`,
      ];
    case 'cv_split':
      return [`# CV split ${op.inputs[0]} — scheme: ${JSON.stringify(op.scheme)}`];
    case 'estimator': {
      const e = op.estimator;
      const feats = e.features
        ? `features=${JSON.stringify(e.features)}`
        : 'features=None';
      return [
        `# Fit estimator ${e.name} (impl: ${e.impl}@${e.version})`,
        `# ${feats}`,
        `# params: ${JSON.stringify(e.params)}`,
      ];
    }
    case 'null_model':
      return [`# Null model: ${JSON.stringify(op.spec)}`];
    case 'correct':
      return [`# Multiple-testing correction: ${op.method}`];
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function predicateSummary(p: Premise): string {
  return JSON.stringify(p.predicate)
    .replace(/"/g, "'")
    .slice(0, 220);
}

function inferenceSummary(claim: FormalClaim): string {
  return JSON.stringify(claim.inference.expression).replace(/"/g, "'");
}

function formatJSONValue(v: unknown): string {
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function download(filename: string, text: string, mime: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
