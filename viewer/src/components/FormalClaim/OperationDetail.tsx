'use client';

import type { Operation } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE } from '@/config/theme';
import { renderSetExpr } from '@/lib/formalClaimsHelpers';
import type { ReactNode } from 'react';
import { Chip } from './Panel';

/**
 * Renders the per-kind detail for a single Operation.
 * Used inside both the DAG side-sheet and anywhere else that needs to
 * show "what does this op actually do?".
 */
export function OperationDetail({ op }: { op: Operation }) {
  switch (op.kind) {
    case 'filter': {
      const lines = renderSetExpr(op.predicate);
      return <CodeBlock>{lines.join('\n')}</CodeBlock>;
    }

    case 'project':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[1] }}>
          {op.cols.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
      );

    case 'join':
      return (
        <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.base.fontSize, color: COLOR.text.secondary }}>
          on <code style={{ color: COLOR.accent.teal }}>{op.on}</code>
        </span>
      );

    case 'aggregate':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
          <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.base.fontSize, color: COLOR.text.secondary }}>
            by{' '}
            {op.by
              .map<ReactNode>((b) => (
                <code key={b} style={{ color: COLOR.accent.teal }}>
                  {b}
                </code>
              ))
              .reduce<ReactNode[]>(
                (acc, el, i) => (i === 0 ? [el] : [...acc, ', ', el]),
                [],
              )}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[1] }}>
            {op.agg.map((a, i) => (
              <Chip key={i}>
                {a.fn}({a.col})
              </Chip>
            ))}
          </div>
        </div>
      );

    case 'cv_split':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2] }}>
          <Chip color={COLOR.accent.violet}>{op.scheme.kind}</Chip>
          {'k' in op.scheme ? <Chip>k = {op.scheme.k}</Chip> : null}
          {'by' in op.scheme ? <Chip>by = {op.scheme.by}</Chip> : null}
          {'seed' in op.scheme ? <Chip>seed = {op.scheme.seed}</Chip> : null}
        </div>
      );

    case 'estimator': {
      const e = op.estimator;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2] }}>
            <Chip color={COLOR.accent.violet}>{e.name}</Chip>
            <Chip>
              {e.impl}
              <span style={{ color: COLOR.text.muted, margin: '0 4px' }}>@</span>
              {e.version}
            </Chip>
            {e.response ? <Chip>response = {e.response}</Chip> : null}
          </div>
          {e.features ? <FeatureSetBlock features={e.features} /> : null}
          {Object.keys(e.params).length > 0 ? (
            <CodeBlock>
              {Object.entries(e.params)
                .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
                .join('\n')}
            </CodeBlock>
          ) : null}
        </div>
      );
    }

    case 'null_model':
      return (
        <CodeBlock>
          {`kind = ${op.spec.kind}\n` +
            (op.spec.n_perms !== undefined && op.spec.n_perms !== null
              ? `n_perms = ${op.spec.n_perms}\n`
              : '') +
            (op.spec.seed !== undefined && op.spec.seed !== null
              ? `seed = ${op.spec.seed}`
              : '')}
        </CodeBlock>
      );

    case 'correct':
      return <Chip color={COLOR.accent.rose}>method = {op.method}</Chip>;
  }
}

export function FeatureSetBlock({
  features,
}: {
  features: NonNullable<Extract<Operation, { kind: 'estimator' }>['estimator']['features']>;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLOR.border.subtle}`,
        borderRadius: 3,
        padding: SPACE[2],
        backgroundColor: COLOR.bg.primary,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          flexWrap: 'wrap',
          marginBottom: SPACE[1],
        }}
      >
        <span
          style={{
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          features
        </span>
        <Chip color={COLOR.accent.amber}>{features.label}</Chip>
        {features.parent ? (
          <span
            style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
            }}
          >
            parent ← {features.parent}
          </span>
        ) : null}
      </div>
      {features.select && features.select.length > 0 ? (
        <Row label="select">
          {features.select.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </Row>
      ) : null}
      {features.exclude && features.exclude.length > 0 ? (
        <Row label="exclude">
          {features.exclude.map((c) => (
            <Chip key={c} color={COLOR.accent.rose}>
              {c}
            </Chip>
          ))}
        </Row>
      ) : null}
      {features.resolved && features.resolved.length > 0 ? (
        <Row label={`resolved (${features.resolved.length})`}>
          {features.resolved.map((c) => (
            <Chip key={c} color={COLOR.text.tertiary}>
              {c}
            </Chip>
          ))}
        </Row>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[2], marginTop: SPACE[1] }}>
      <span
        style={{
          color: COLOR.text.muted,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          minWidth: 72,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[1] }}>{children}</div>
    </div>
  );
}

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: SPACE[2],
        backgroundColor: COLOR.bg.primary,
        border: `1px solid ${COLOR.border.subtle}`,
        borderRadius: 3,
        color: COLOR.text.secondary,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
      }}
    >
      {children}
    </pre>
  );
}
