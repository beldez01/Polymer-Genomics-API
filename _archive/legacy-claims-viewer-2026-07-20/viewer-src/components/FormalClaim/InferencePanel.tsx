'use client';

import type { InferenceExpression, InferenceRule, Statistic } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { evalCmp, isStatRef } from '@/lib/formalClaimsHelpers';
import { Chip, Panel } from './Panel';

interface InferencePanelProps {
  rule: InferenceRule;
  statistics: Statistic[];
}

export function InferencePanel({ rule, statistics }: InferencePanelProps) {
  const statMap = buildStatMap(statistics);
  const rootVerdict = evalExpr(rule.expression, statMap);

  return (
    <Panel
      index={4}
      label="INFERENCE RULE (I)"
      accent={COLOR.accent.rose}
      trailing={<RootVerdictChip verdict={rootVerdict} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
        {/* Expression tree */}
        <div
          style={{
            border: `1px solid ${COLOR.border.default}`,
            borderRadius: 3,
            padding: SPACE[3],
            backgroundColor: COLOR.bg.surface,
          }}
        >
          <ExprNode expr={rule.expression} statMap={statMap} depth={0} />
        </div>

        {/* Justification */}
        <Block label="Justification" color={COLOR.accent.teal}>
          {rule.justification}
        </Block>

        {/* Failure mode */}
        {rule.failure_mode ? (
          <Block label="Failure mode" color={COLOR.accent.rose}>
            {rule.failure_mode}
          </Block>
        ) : null}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function buildStatMap(stats: Statistic[]): Record<string, Statistic> {
  const map: Record<string, Statistic> = {};
  for (const s of stats) map[s.id] = s;
  return map;
}

function statNumeric(s: Statistic | undefined | null): number | null {
  if (!s) return null;
  return typeof s.value === 'number' ? s.value : null;
}

function evalExpr(
  expr: InferenceExpression,
  statMap: Record<string, Statistic>,
): boolean | null {
  switch (expr.kind) {
    case 'and': {
      let anyNull = false;
      for (const t of expr.terms) {
        const v = evalExpr(t, statMap);
        if (v === false) return false;
        if (v === null) anyNull = true;
      }
      return anyNull ? null : true;
    }
    case 'or': {
      let anyNull = false;
      for (const t of expr.terms) {
        const v = evalExpr(t, statMap);
        if (v === true) return true;
        if (v === null) anyNull = true;
      }
      return anyNull ? null : false;
    }
    case 'not': {
      const v = evalExpr(expr.term, statMap);
      return v === null ? null : !v;
    }
    case 'cmp': {
      const lhs = statNumeric(statMap[expr.lhs.stat_id]);
      const rhs = isStatRef(expr.rhs) ? statNumeric(statMap[expr.rhs.stat_id]) : expr.rhs;
      return evalCmp(lhs, expr.op, rhs);
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function ExprNode({
  expr,
  statMap,
  depth,
}: {
  expr: InferenceExpression;
  statMap: Record<string, Statistic>;
  depth: number;
}) {
  const verdict = evalExpr(expr, statMap);
  const indent = depth * 16;

  if (expr.kind === 'and' || expr.kind === 'or') {
    return (
      <div style={{ marginLeft: indent }}>
        <NodeHeader label={expr.kind.toUpperCase()} verdict={verdict} />
        <div
          style={{
            marginTop: SPACE[1],
            paddingLeft: SPACE[3],
            borderLeft: `1px dashed ${COLOR.border.default}`,
          }}
        >
          {expr.terms.map((t, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 0 : SPACE[1] }}>
              <ExprNode expr={t} statMap={statMap} depth={0} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (expr.kind === 'not') {
    return (
      <div style={{ marginLeft: indent }}>
        <NodeHeader label="NOT" verdict={verdict} />
        <div
          style={{
            marginTop: SPACE[1],
            paddingLeft: SPACE[3],
            borderLeft: `1px dashed ${COLOR.border.default}`,
          }}
        >
          <ExprNode expr={expr.term} statMap={statMap} depth={0} />
        </div>
      </div>
    );
  }

  // Leaf: cmp
  const lhsVal = statNumeric(statMap[expr.lhs.stat_id]);
  const rhs = expr.rhs;

  return (
    <div
      style={{
        marginLeft: indent,
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: SPACE[2],
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
      }}
    >
      <LeafMark verdict={verdict} />
      <StatChip label={expr.lhs.stat_id} value={lhsVal} transform={expr.lhs.transform ?? null} />
      <span style={{ color: COLOR.text.muted }}>{expr.op}</span>
      {isStatRef(rhs) ? (
        <StatChip
          label={rhs.stat_id}
          value={statNumeric(statMap[rhs.stat_id])}
          transform={rhs.transform ?? null}
        />
      ) : (
        <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>
          {fmtNum(rhs)}
        </span>
      )}
    </div>
  );
}

function NodeHeader({ label, verdict }: { label: string; verdict: boolean | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[2] }}>
      <LeafMark verdict={verdict} />
      <span
        style={{
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.base.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function LeafMark({ verdict }: { verdict: boolean | null }) {
  const { glyph, color } = verdictChrome(verdict);
  return (
    <span
      aria-label={verdict === null ? 'pending' : verdict ? 'satisfied' : 'not satisfied'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 3,
        border: `1px solid ${color}`,
        color,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.bold,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  );
}

function StatChip({
  label,
  value,
  transform,
}: {
  label: string;
  value: number | null;
  transform: 'abs' | 'neg' | 'log' | null;
}) {
  const display = transform ? `${transform}(${label})` : label;
  return (
    <Chip title={value === null ? 'value not yet available' : `${display} = ${value}`}>
      {display}
      <span style={{ color: COLOR.text.muted, margin: '0 4px' }}>=</span>
      <span style={{ color: value === null ? COLOR.text.muted : COLOR.accent.amber }}>
        {value === null ? '—' : fmtNum(value)}
      </span>
    </Chip>
  );
}

function RootVerdictChip({ verdict }: { verdict: boolean | null }) {
  const { label, color } = rootChrome(verdict);
  return <Chip color={color}>{label}</Chip>;
}

function Block({
  label,
  color,
  children,
}: {
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          color,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom: SPACE[2],
        }}
      >
        {label}
      </div>
      <p
        style={{
          margin: 0,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.base.fontSize,
          lineHeight: 1.7,
        }}
      >
        {children}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function verdictChrome(v: boolean | null): { glyph: string; color: string } {
  if (v === true)  return { glyph: '✓', color: COLOR.accent.teal };
  if (v === false) return { glyph: '✗', color: COLOR.accent.rose };
  return { glyph: '·', color: COLOR.text.muted };
}

function rootChrome(v: boolean | null): { label: string; color: string } {
  if (v === true)  return { label: 'INFERENCE LICENSED',  color: COLOR.accent.teal };
  if (v === false) return { label: 'INFERENCE REJECTED',  color: COLOR.accent.rose };
  return             { label: 'INFERENCE PENDING',        color: COLOR.text.muted };
}

function fmtNum(v: number | null): string {
  if (v === null) return '—';
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 0.001 && Math.abs(v) < 1000) return v.toFixed(3);
  return v.toExponential(2);
}
