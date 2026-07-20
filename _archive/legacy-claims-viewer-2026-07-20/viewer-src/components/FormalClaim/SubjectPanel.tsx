'use client';

import type { FormalClaim, SubjectRef } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { Chip, KVRow, Panel } from './Panel';

interface SubjectPanelProps {
  claim: FormalClaim;
}

/**
 * v1.2 panel: shows the polymorphic subject + per-domain context envelope.
 * Renders only when `claim.subject` is set (i.e. v1.2 claims). v1.1 claims
 * silently skip this panel.
 */
export function SubjectPanel({ claim }: SubjectPanelProps) {
  if (!claim.subject) return null;
  const subj = claim.subject;
  return (
    <Panel
      index={0}
      label="SUBJECT (v1.2)"
      accent={COLOR.accent.teal}
      trailing={
        <span style={{ display: 'flex', gap: SPACE[2], alignItems: 'center' }}>
          <Chip>{subj.kind}</Chip>
          {claim.domain ? <Chip>{claim.domain}</Chip> : null}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
        <SubjectCard subject={subj} />
        {claim.context ? <ContextCard context={claim.context} /> : null}
      </div>
    </Panel>
  );
}

function SubjectCard({ subject }: { subject: SubjectRef }) {
  return (
    <article
      style={{
        border: `1px solid ${COLOR.border.default}`,
        borderRadius: 3,
        padding: SPACE[4],
        backgroundColor: COLOR.bg.surface,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE[3],
          marginBottom: SPACE[3],
        }}
      >
        <span
          style={{
            color: COLOR.text.primary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.02em',
          }}
        >
          {subject.display}
        </span>
      </header>

      <div
        style={{
          color: COLOR.text.muted,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          wordBreak: 'break-all',
          marginBottom: SPACE[3],
        }}
      >
        {subject.id}
      </div>

      <KindSpecificFields subject={subject} />

      {subject.note ? (
        <div
          style={{
            marginTop: SPACE[3],
            paddingTop: SPACE[3],
            borderTop: `1px dashed ${COLOR.border.subtle}`,
            color: COLOR.text.tertiary,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.6,
          }}
        >
          {subject.note}
        </div>
      ) : null}
    </article>
  );
}

function KindSpecificFields({ subject }: { subject: SubjectRef }) {
  const rows: Array<[string, string]> = [];

  switch (subject.kind) {
    case 'genomic_region':
      rows.push(['assembly', subject.assembly]);
      rows.push([
        'region',
        `${subject.chrom}:${subject.start.toLocaleString()}-${subject.end.toLocaleString()}${subject.strand !== '.' ? ` (${subject.strand})` : ''}`,
      ]);
      break;
    case 'variant_vrs':
      rows.push(['vrs version', subject.vrs_version]);
      if (subject.assembly) rows.push(['assembly', subject.assembly]);
      if (subject.hgvs) rows.push(['hgvs', subject.hgvs]);
      break;
    case 's4_object':
      rows.push(['bioc class', subject.bioc_class]);
      rows.push(['bioc version', subject.bioc_version]);
      rows.push(['blob hash', subject.blob_hash]);
      if (subject.projection) rows.push(['projection', subject.projection]);
      if (subject.dims) rows.push(['dims', subject.dims.join(' × ')]);
      break;
    case 'phenopacket':
      rows.push(['phenopacket version', subject.phenopacket_version]);
      rows.push(['retrieval', subject.retrieval.mode]);
      if (subject.retrieval.uri) rows.push(['uri', subject.retrieval.uri]);
      break;
    case 'ontology_term':
      rows.push(['ontology', subject.ontology]);
      rows.push(['release', subject.ontology_release]);
      rows.push(['propagation', subject.propagation]);
      rows.push(['uri', subject.uri]);
      break;
    case 'gene_or_protein':
      rows.push(['entity', subject.entity_type]);
      const ids = subject.identifiers;
      if (ids.hgnc) rows.push(['hgnc', ids.hgnc]);
      if (ids.ensembl_gene) rows.push(['ensembl gene', ids.ensembl_gene]);
      if (ids.uniprot) rows.push(['uniprot', ids.uniprot]);
      if (ids.symbol) rows.push(['symbol', ids.symbol]);
      if (subject.assembly_context) rows.push(['assembly', subject.assembly_context]);
      break;
    case 'pathway':
      rows.push(['source', subject.source]);
      rows.push(['source version', subject.source_version]);
      if (subject.members?.uri) rows.push(['members', subject.members.uri]);
      break;
    case 'cohort':
      if (subject.definition.source_dataset?.name) {
        rows.push(['dataset', subject.definition.source_dataset.name]);
      }
      if (subject.definition.source_dataset?.version) {
        rows.push(['version', subject.definition.source_dataset.version]);
      }
      if (subject.definition.cardinality !== null && subject.definition.cardinality !== undefined) {
        rows.push(['cardinality', subject.definition.cardinality.toLocaleString()]);
      }
      rows.push(['inclusion preds', String(subject.definition.inclusion.length)]);
      rows.push(['members hash', subject.members_hash]);
      break;
    case 'literal':
      rows.push(['prose', subject.prose]);
      break;
    case 'composite':
      rows.push(['relation', subject.relation]);
      rows.push(['parts', String(subject.parts.length)]);
      subject.parts.forEach((p, i) => {
        rows.push([`part ${i + 1}`, `${p.kind} — ${p.display}`]);
      });
      break;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
      {rows.map(([k, v]) => (
        <KVRow key={k} label={k}>
          <span style={{ color: COLOR.text.primary, fontSize: TYPE.sm.fontSize, wordBreak: 'break-all', textAlign: 'right' }}>{v}</span>
        </KVRow>
      ))}
    </div>
  );
}

function ContextCard({ context }: { context: Record<string, unknown> }) {
  const entries = Object.entries(context);
  if (entries.length === 0) return null;
  return (
    <article
      style={{
        border: `1px dashed ${COLOR.border.subtle}`,
        borderRadius: 3,
        padding: SPACE[3],
        backgroundColor: COLOR.bg.surface,
      }}
    >
      <header
        style={{
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: COLOR.text.muted,
          marginBottom: SPACE[2],
        }}
      >
        Per-domain context
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
        {entries.map(([k, v]) => (
          <KVRow key={k} label={k}>
            <span style={{ color: COLOR.text.primary, fontSize: TYPE.sm.fontSize, wordBreak: 'break-all', textAlign: 'right' }}>{renderContextValue(v)}</span>
          </KVRow>
        ))}
      </div>
    </article>
  );
}

function renderContextValue(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map(renderContextValue).join(', ')}]`;
  return JSON.stringify(v);
}
