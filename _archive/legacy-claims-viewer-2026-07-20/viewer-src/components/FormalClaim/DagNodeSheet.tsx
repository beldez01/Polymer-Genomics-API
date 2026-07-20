'use client';

import type {
  FormalClaim,
  Operation,
  Premise,
  Statistic,
} from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import {
  EVIDENCE_LABELS,
  opChrome,
  provenanceChrome,
  renderSetExpr,
  renderStatValue,
} from '@/lib/formalClaimsHelpers';
import { extractSingleRegion } from '@/lib/formalClaimsRegion';
import { Chip, KVRow } from './Panel';
import { CodeBlock, OperationDetail } from './OperationDetail';
import type { DagSelection } from './OperationDag';

interface DagNodeSheetProps {
  claim: FormalClaim;
  selection: DagSelection;
  onClose: () => void;
}

export function DagNodeSheet({ claim, selection, onClose }: DagNodeSheetProps) {
  if (!selection) return null;

  let title = '';
  let accent: string = COLOR.border.strong;
  let body: React.ReactNode = null;

  if (selection.kind === 'premise') {
    const p = claim.premises.find((x) => x.id === selection.id);
    if (!p) return null;
    title = `PREMISE · ${p.id}`;
    accent = COLOR.accent.teal;
    body = <PremiseBody premise={p} />;
  } else if (selection.kind === 'operation') {
    const op = claim.operations.find((x) => x.id === selection.id);
    if (!op) return null;
    title = `${opChrome(op.kind).label} · ${op.id}`;
    accent = opChrome(op.kind).color;
    body = <OperationBody op={op} />;
  } else if (selection.kind === 'statistic') {
    const s = claim.statistics.find((x) => x.id === selection.id);
    if (!s) return null;
    title = `STATISTIC · ${s.id}`;
    accent = COLOR.accent.amber;
    body = <StatisticBody stat={s} claim={claim} />;
  }

  return (
    <aside
      role="complementary"
      aria-label="Node detail"
      style={{
        marginTop: SPACE[3],
        border: `1px solid ${COLOR.border.default}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 3,
        backgroundColor: COLOR.bg.elevated,
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[3],
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          borderBottom: `1px solid ${COLOR.border.default}`,
          backgroundColor: COLOR.bg.track,
        }}
      >
        <span
          style={{
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: WEIGHT.medium,
          }}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node detail"
          style={{
            background: 'none',
            border: `1px solid ${COLOR.border.default}`,
            borderRadius: 3,
            color: COLOR.text.tertiary,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            padding: `${SPACE[1]}px ${SPACE[2]}px`,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Close
        </button>
      </header>
      <div style={{ padding: SPACE[4] }}>{body}</div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Per-kind bodies
// ---------------------------------------------------------------------------

function PremiseBody({ premise }: { premise: Premise }) {
  const prov = provenanceChrome(premise.source.provenance_state);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2] }}>
        <Chip title="layer@version">
          {premise.source.layer}
          <span style={{ color: COLOR.text.muted, margin: '0 4px' }}>@</span>
          {premise.source.version}
        </Chip>
        <Chip color={prov.color}>{prov.label}</Chip>
      </div>
      <CodeBlock>{renderSetExpr(premise.predicate).join('\n')}</CodeBlock>
      <PremiseActions premise={premise} />
      <KVRow label="Cardinality">
        {premise.cardinality !== null && premise.cardinality !== undefined
          ? premise.cardinality.toLocaleString()
          : <span style={{ color: COLOR.text.muted }}>pending</span>}
      </KVRow>
      <KVRow label="Content hash">
        <code style={{ color: COLOR.text.tertiary, fontSize: TYPE.sm.fontSize }}>
          {premise.content_hash}
        </code>
      </KVRow>
      {premise.source.note ? (
        <KVRow label="Note">
          <span style={{ color: COLOR.text.tertiary, fontSize: TYPE.sm.fontSize }}>
            {premise.source.note}
          </span>
        </KVRow>
      ) : null}
    </div>
  );
}

function PremiseActions({ premise }: { premise: Premise }) {
  const prov = premise.source.provenance_state;
  const isInFly = prov === 'fly_postgres';
  const region = extractSingleRegion(premise.predicate);

  let disabledReason: string | null = null;
  if (!isInFly) disabledReason = `Layer is ${prov}, not in Fly Postgres — no live query.`;
  else if (!region) disabledReason = 'Predicate does not pin a single genomic region.';

  const href = region
    ? `/view/${region.build}/${encodeURIComponent(`${region.chr}:${region.start}-${region.end}`)}?layer=${encodeURIComponent(`${premise.source.layer}@${premise.source.version}`)}`
    : '#';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2] }}>
      {disabledReason ? (
        <span
          title={disabledReason}
          aria-disabled="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            border: `1px dashed ${COLOR.border.default}`,
            borderRadius: 3,
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'not-allowed',
          }}
        >
          View in region browser — {disabledReason}
        </span>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `${SPACE[1]}px ${SPACE[3]}px`,
            border: `1px solid ${COLOR.accent.teal}`,
            borderRadius: 3,
            color: COLOR.accent.teal,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          View {region?.chr}:{region?.start.toLocaleString()}–{region?.end.toLocaleString()} in region browser ↗
        </a>
      )}
    </div>
  );
}

function OperationBody({ op }: { op: Operation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2] }}>
        <Chip color={opChrome(op.kind).color}>{opChrome(op.kind).label}</Chip>
        {op.inputs.length > 0 ? (
          <span
            style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
            }}
          >
            ← {op.inputs.join(', ')}
          </span>
        ) : null}
      </div>
      <OperationDetail op={op} />
      {'note' in op && op.note ? (
        <p
          style={{
            margin: 0,
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.65,
          }}
        >
          {op.note}
        </p>
      ) : null}
    </div>
  );
}

function StatisticBody({ stat, claim }: { stat: Statistic; claim: FormalClaim }) {
  const producer = claim.operations.find((op) => op.id === stat.produced_by);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2], alignItems: 'baseline' }}>
        <Chip>{stat.name}</Chip>
        <Chip title={EVIDENCE_LABELS[stat.evidence_class]}>{stat.evidence_class}</Chip>
      </div>
      <KVRow label="Value">
        <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>
          {renderStatValue(stat.value)}
        </span>
      </KVRow>
      <KVRow label="CI">
        {stat.ci ? `[${stat.ci[0].toFixed(3)}, ${stat.ci[1].toFixed(3)}]` : '—'}
      </KVRow>
      <KVRow label="n">
        {stat.n !== null && stat.n !== undefined ? stat.n.toLocaleString() : '—'}
      </KVRow>
      <KVRow label="Produced by">
        {producer ? (
          <Chip color={opChrome(producer.kind).color}>
            {opChrome(producer.kind).label} · {producer.id}
          </Chip>
        ) : (
          <span style={{ color: COLOR.accent.rose }}>unknown op: {stat.produced_by}</span>
        )}
      </KVRow>
      {stat.note ? (
        <p
          style={{
            margin: 0,
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            lineHeight: 1.65,
          }}
        >
          {stat.note}
        </p>
      ) : null}
    </div>
  );
}
