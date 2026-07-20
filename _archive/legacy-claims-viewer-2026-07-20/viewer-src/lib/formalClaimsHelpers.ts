/**
 * Rendering helpers for the Formal Claim IR (v1.1).
 *
 * Pure functions only — no React. Used by all panels in
 * components/FormalClaim/*.
 */

import { COLOR } from '@/config/theme';
import type {
  CmpRhs,
  DataDerivedConstant,
  EvidenceClass,
  Outcome,
  ProvenanceState,
  SetExpression,
  StatRef,
  StatValue,
} from '@/config/formal_claims';

// ---------------------------------------------------------------------------
// Outcome → badge
// ---------------------------------------------------------------------------

export function outcomeBadge(outcome: Outcome): { label: string; color: string } {
  switch (outcome) {
    case 'strong_positive':    return { label: 'STRONG POSITIVE', color: COLOR.accent.teal };
    case 'positive':           return { label: 'POSITIVE',        color: COLOR.accent.teal };
    case 'qualified_positive': return { label: 'QUALIFIED',       color: COLOR.accent.amber };
    case 'negative':           return { label: 'NEGATIVE',        color: COLOR.accent.rose };
    case 'fail':               return { label: 'FAIL',            color: COLOR.accent.rose };
  }
}

// ---------------------------------------------------------------------------
// Evidence class → tooltip label
// ---------------------------------------------------------------------------

export const EVIDENCE_LABELS: Record<EvidenceClass, string> = {
  M: 'Measured',
  R: 'Replicated',
  D: 'Derived',
  S: 'Statistical',
  K: 'Curated',
  H: 'Hypothetical',
  L: 'Literature',
};

// ---------------------------------------------------------------------------
// Provenance state → short label + dot color
// ---------------------------------------------------------------------------

export function provenanceChrome(state: ProvenanceState): { label: string; color: string } {
  switch (state) {
    case 'fly_postgres':      return { label: 'Fly Postgres',     color: COLOR.accent.teal };
    case 'local_rds':         return { label: 'Local RDS',        color: COLOR.accent.amber };
    case 'remote_url':        return { label: 'Remote URL',       color: COLOR.accent.violet };
    case 'reference_genome':  return { label: 'Reference genome', color: COLOR.text.tertiary };
    case 'unknown':           return { label: 'Unknown',          color: COLOR.accent.rose };
  }
}

// ---------------------------------------------------------------------------
// Operation kind → short label + color
// ---------------------------------------------------------------------------

export function opChrome(kind: string): { label: string; color: string } {
  switch (kind) {
    case 'filter':     return { label: 'FILTER',     color: COLOR.accent.amber };
    case 'project':    return { label: 'PROJECT',    color: COLOR.accent.amber };
    case 'join':       return { label: 'JOIN',       color: COLOR.accent.teal };
    case 'aggregate':  return { label: 'AGGREGATE',  color: COLOR.accent.teal };
    case 'cv_split':   return { label: 'CV SPLIT',   color: COLOR.accent.violet };
    case 'estimator':  return { label: 'ESTIMATOR',  color: COLOR.accent.violet };
    case 'null_model': return { label: 'NULL MODEL', color: COLOR.accent.rose };
    case 'correct':    return { label: 'CORRECT',    color: COLOR.text.tertiary };
    default:           return { label: kind.toUpperCase(), color: COLOR.text.tertiary };
  }
}

// ---------------------------------------------------------------------------
// DataDerivedConstant detection + rendering
// ---------------------------------------------------------------------------

export function isDerivedConstant(x: unknown): x is DataDerivedConstant {
  return (
    typeof x === 'object' &&
    x !== null &&
    !Array.isArray(x) &&
    (x as { kind?: string }).kind === 'derived'
  );
}

export function isStatRef(x: unknown): x is StatRef {
  return (
    typeof x === 'object' &&
    x !== null &&
    !Array.isArray(x) &&
    typeof (x as { stat_id?: unknown }).stat_id === 'string'
  );
}

export function renderDerived(d: DataDerivedConstant): string {
  const paramStr = d.params
    ? Object.entries(d.params)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ')
    : '';
  return `${d.fn}(${d.col}${paramStr ? `, ${paramStr}` : ''}) ← ${d.source_operation}`;
}

// ---------------------------------------------------------------------------
// CmpRhs → human-readable string
// ---------------------------------------------------------------------------

export function renderCmpRhs(rhs: CmpRhs): string {
  if (isDerivedConstant(rhs)) return renderDerived(rhs);
  if (Array.isArray(rhs)) {
    if (rhs.length <= 4) return `[${rhs.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `[${rhs.slice(0, 3).map((v) => JSON.stringify(v)).join(', ')}, … +${rhs.length - 3}]`;
  }
  return JSON.stringify(rhs);
}

// ---------------------------------------------------------------------------
// SetExpression → multi-line indented string (read-only render)
// ---------------------------------------------------------------------------

export function renderSetExpr(expr: SetExpression, depth = 0): string[] {
  const pad = '  '.repeat(depth);
  switch (expr.kind) {
    case 'and':
    case 'or': {
      const op = expr.kind.toUpperCase();
      if (!expr.terms.length) return [`${pad}${op}()`];
      const lines: string[] = [`${pad}${op}(`];
      for (const t of expr.terms) lines.push(...renderSetExpr(t, depth + 1));
      lines.push(`${pad})`);
      return lines;
    }
    case 'not':
      return [`${pad}NOT(`, ...renderSetExpr(expr.term, depth + 1), `${pad})`];
    case 'cmp':
      return [`${pad}${expr.col} ${expr.op} ${renderCmpRhs(expr.rhs)}`];
    case 'join':
      return [`${pad}JOIN on ${expr.on} → ${expr.other.layer}@${expr.other.version}`];
  }
}

// ---------------------------------------------------------------------------
// Inference expression → multi-line render with truth values
// ---------------------------------------------------------------------------

export type StatisticValueMap = Record<string, number | string | readonly unknown[]>;

function applyTransform(v: number, t: StatRef['transform']): number {
  switch (t) {
    case 'abs': return Math.abs(v);
    case 'neg': return -v;
    case 'log': return Math.log(v);
    default:    return v;
  }
}

function resolveLhs(ref: StatRef, stats: StatisticValueMap): number | null {
  const v = stats[ref.stat_id];
  if (typeof v !== 'number') return null;
  return applyTransform(v, ref.transform);
}

function resolveRhs(
  rhs: number | StatRef,
  stats: StatisticValueMap,
): number | null {
  if (typeof rhs === 'number') return rhs;
  return resolveLhs(rhs, stats);
}

/** Evaluate a CmpOp at the leaf level. Returns null if either side isn't numeric. */
export function evalCmp(
  lhs: number | null,
  op: string,
  rhs: number | null,
): boolean | null {
  if (lhs === null || rhs === null) return null;
  switch (op) {
    case '<':  return lhs <  rhs;
    case '<=': return lhs <= rhs;
    case '=':  return lhs === rhs;
    case '!=': return lhs !== rhs;
    case '>':  return lhs >  rhs;
    case '>=': return lhs >= rhs;
    default:   return null;
  }
}

// ---------------------------------------------------------------------------
// Statistic.value → string for display
// ---------------------------------------------------------------------------

export function renderStatValue(v: StatValue): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    if (Math.abs(v) >= 0.001 && Math.abs(v) < 1000) return v.toFixed(3);
    return v.toExponential(2);
  }
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const first = v[0];
    if (typeof first === 'object' && first && 'label' in first && 'value' in first) {
      // LabeledValue[]
      const top = (v as { label: string; value: number }[]).slice(0, 3);
      return top.map((p) => `${p.label}=${p.value.toFixed(3)}`).join(', ') +
        (v.length > 3 ? `, … +${v.length - 3}` : '');
    }
    return `[${v.slice(0, 4).map((x) => JSON.stringify(x)).join(', ')}${v.length > 4 ? ', …' : ''}]`;
  }
  return JSON.stringify(v);
}
