'use client';

import type { Premise } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE } from '@/config/theme';
import { provenanceChrome, renderSetExpr } from '@/lib/formalClaimsHelpers';
import { Chip, KVRow, Panel } from './Panel';

interface PremisesPanelProps {
  premises: Premise[];
}

export function PremisesPanel({ premises }: PremisesPanelProps) {
  return (
    <Panel
      index={1}
      label="PREMISES (P)"
      accent={COLOR.accent.teal}
      trailing={<span>{premises.length} set{premises.length === 1 ? '' : 's'}</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
        {premises.map((p) => (
          <PremiseCard key={p.id} premise={p} />
        ))}
      </div>
    </Panel>
  );
}

function PremiseCard({ premise }: { premise: Premise }) {
  const prov = provenanceChrome(premise.source.provenance_state);
  const predicateLines = renderSetExpr(premise.predicate);

  return (
    <article
      style={{
        border: `1px solid ${COLOR.border.default}`,
        borderRadius: 3,
        padding: SPACE[4],
        backgroundColor: COLOR.bg.surface,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[3],
          marginBottom: SPACE[3],
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2], flexWrap: 'wrap' }}>
          <span
            style={{
              color: COLOR.text.primary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.base.fontSize,
              letterSpacing: '0.02em',
            }}
          >
            {premise.id}
          </span>
          <Chip title="layer@version">
            {premise.source.layer}
            <span style={{ color: COLOR.text.muted, margin: '0 4px' }}>@</span>
            {premise.source.version}
          </Chip>
          <Chip color={prov.color} title={`provenance_state: ${premise.source.provenance_state}`}>
            {prov.label}
          </Chip>
        </div>
        {premise.cardinality !== null && premise.cardinality !== undefined ? (
          <span
            style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
            }}
          >
            n = {premise.cardinality.toLocaleString()}
          </span>
        ) : (
          <span
            style={{
              color: COLOR.text.muted,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              letterSpacing: '0.08em',
            }}
          >
            n pending
          </span>
        )}
      </header>

      {/* Predicate as a code block */}
      <pre
        style={{
          margin: 0,
          padding: SPACE[3],
          backgroundColor: COLOR.bg.primary,
          border: `1px solid ${COLOR.border.subtle}`,
          borderRadius: 3,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          lineHeight: 1.65,
          whiteSpace: 'pre',
          overflowX: 'auto',
        }}
      >
        {predicateLines.join('\n')}
      </pre>

      {/* Meta rows */}
      <div style={{ marginTop: SPACE[3] }}>
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
    </article>
  );
}
