'use client';

import type { Conclusion, ExternalAssumption } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { outcomeBadge, provenanceChrome, renderSetExpr } from '@/lib/formalClaimsHelpers';
import { Chip, KVRow, Panel } from './Panel';

interface ConclusionPanelProps {
  conclusion: Conclusion;
  externalAssumptions: ExternalAssumption[];
}

export function ConclusionPanel({ conclusion, externalAssumptions }: ConclusionPanelProps) {
  const badge = outcomeBadge(conclusion.outcome);

  return (
    <Panel
      index={5}
      label="CONCLUSION (C)"
      accent={badge.color}
      trailing={<Chip color={badge.color}>{badge.label}</Chip>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[5] }}>
        {/* Assertion */}
        <p
          style={{
            margin: 0,
            color: COLOR.text.primary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.7,
            fontWeight: WEIGHT.medium,
          }}
        >
          {conclusion.assertion}
        </p>

        {/* Scope */}
        <section>
          <SectionLabel>Scope</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2], marginBottom: SPACE[3] }}>
            {conclusion.scope.layers.map((l) => (
              <Chip
                key={`${l.layer}@${l.version}`}
                color={provenanceChrome(l.provenance_state).color}
                title={`provenance: ${l.provenance_state}`}
              >
                {l.layer}
                <span style={{ color: COLOR.text.muted, margin: '0 4px' }}>@</span>
                {l.version}
              </Chip>
            ))}
          </div>
          {conclusion.scope.restrictions ? (
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
              {renderSetExpr(conclusion.scope.restrictions).join('\n')}
            </pre>
          ) : null}
          {conclusion.scope.scale_note ? (
            <p
              style={{
                margin: `${SPACE[2]}px 0 0 0`,
                color: COLOR.text.tertiary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                lineHeight: 1.65,
              }}
            >
              {conclusion.scope.scale_note}
            </p>
          ) : null}
        </section>

        {/* Confidence + composite confidence */}
        <section>
          <SectionLabel>Confidence</SectionLabel>
          <KVRow label="Type">
            <Chip>{conclusion.confidence.type}</Chip>
          </KVRow>
          <KVRow label="Value">
            {conclusion.confidence.value === null || conclusion.confidence.value === undefined
              ? <span style={{ color: COLOR.text.muted }}>— (see composite)</span>
              : conclusion.confidence.value.toFixed(3)}
          </KVRow>
          {conclusion.confidence.note ? (
            <KVRow label="Note">
              <span style={{ color: COLOR.text.tertiary, fontSize: TYPE.sm.fontSize }}>
                {conclusion.confidence.note}
              </span>
            </KVRow>
          ) : null}

          {conclusion.composite_confidence ? (
            <div
              style={{
                marginTop: SPACE[3],
                padding: SPACE[3],
                border: `1px solid ${COLOR.border.default}`,
                borderRadius: 3,
                backgroundColor: COLOR.bg.surface,
              }}
            >
              <div
                style={{
                  color: COLOR.accent.violet,
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.sm.fontSize,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  marginBottom: SPACE[2],
                }}
              >
                Composite confidence
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[2], marginBottom: SPACE[2] }}>
                <Chip color={COLOR.accent.violet}>{conclusion.composite_confidence.procedure}</Chip>
                <Chip>{conclusion.composite_confidence.impl}</Chip>
                {conclusion.composite_confidence.n_resamples ? (
                  <Chip>n = {conclusion.composite_confidence.n_resamples.toLocaleString()}</Chip>
                ) : null}
                {conclusion.composite_confidence.seed !== undefined && conclusion.composite_confidence.seed !== null ? (
                  <Chip>seed = {conclusion.composite_confidence.seed}</Chip>
                ) : null}
              </div>
              <KVRow label="Interval">
                {conclusion.composite_confidence.interval
                  ? `[${conclusion.composite_confidence.interval[0].toFixed(3)}, ${conclusion.composite_confidence.interval[1].toFixed(3)}]`
                  : <span style={{ color: COLOR.text.muted }}>pending (M2 fills after evaluate.py runs)</span>}
              </KVRow>
              <KVRow label="P(inference holds)">
                {conclusion.composite_confidence.prob_inference_holds !== null &&
                 conclusion.composite_confidence.prob_inference_holds !== undefined
                  ? conclusion.composite_confidence.prob_inference_holds.toFixed(3)
                  : <span style={{ color: COLOR.text.muted }}>pending</span>}
              </KVRow>
              {conclusion.composite_confidence.note ? (
                <p style={{ margin: `${SPACE[2]}px 0 0 0`, color: COLOR.text.tertiary, fontSize: TYPE.sm.fontSize }}>
                  {conclusion.composite_confidence.note}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* External assumptions */}
        {externalAssumptions.length > 0 ? (
          <section>
            <SectionLabel>External assumptions ({externalAssumptions.length})</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
              {externalAssumptions.map((a, i) => (
                <ExternalAssumptionCard key={i} assumption={a} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}

function ExternalAssumptionCard({ assumption }: { assumption: ExternalAssumption }) {
  const conf = assumption.confidence;
  const confColor =
    conf >= 0.85 ? COLOR.accent.teal : conf >= 0.7 ? COLOR.accent.amber : COLOR.accent.rose;

  return (
    <article
      style={{
        padding: SPACE[3],
        border: `1px solid ${COLOR.border.default}`,
        borderRadius: 3,
        backgroundColor: COLOR.bg.surface,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[3],
          marginBottom: SPACE[2],
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2], flexWrap: 'wrap' }}>
          <Chip>{assumption.kind}</Chip>
          {assumption.citation ? (
            <span
              style={{
                color: COLOR.text.tertiary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
              }}
            >
              {assumption.citation}
            </span>
          ) : null}
        </div>
        <Chip color={confColor} title="author-declared confidence [0,1]">
          conf = {conf.toFixed(2)}
        </Chip>
      </header>
      <p
        style={{
          margin: 0,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.base.fontSize,
          lineHeight: 1.7,
        }}
      >
        {assumption.statement}
      </p>
      {assumption.audits && assumption.audits.length > 0 ? (
        <div style={{ marginTop: SPACE[2], display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
          {assumption.audits.map((a, i) => (
            <div
              key={i}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                color: COLOR.text.tertiary,
              }}
            >
              <span style={{ color: COLOR.accent.violet, marginRight: SPACE[2] }}>{a.verdict}</span>
              <span>{a.auditor}</span>
              <span style={{ color: COLOR.text.muted, marginLeft: SPACE[2] }}>{a.timestamp}</span>
              <div style={{ marginTop: 2 }}>{a.rationale}</div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: COLOR.text.muted,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.sm.fontSize,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        marginBottom: SPACE[2],
      }}
    >
      {children}
    </div>
  );
}
