/**
 * Extract a single (chr, start, end) region from a Premise predicate, if one
 * is unambiguously determined. Returns null for genome-wide or multi-region
 * predicates (the deep-link to /view/<build>/<region> is only meaningful for
 * a concrete region, and we'd rather disable the button than guess).
 */

import type { SetExpression } from '@/config/formal_claims';

export interface ExtractedRegion {
  build: 'hg38' | 'hg37';
  chr: string;
  start: number;
  end: number;
}

/**
 * Walks a SetExpression and tries to find a concrete (chr, start, end).
 * Rules:
 *   - chr = "chrN"      ← required (exactly one value)
 *   - start >= x AND start <= y, OR position between x and y, etc.
 *   - All of the above must be inside an AND chain.
 * Returns null if any condition isn't met.
 */
export function extractSingleRegion(
  predicate: SetExpression,
  build: 'hg38' | 'hg37' = 'hg38',
): ExtractedRegion | null {
  const bounds = collectBounds(predicate);
  if (!bounds) return null;
  if (!bounds.chr) return null;
  if (bounds.start === null || bounds.end === null) return null;
  if (bounds.end <= bounds.start) return null;
  return { build, chr: bounds.chr, start: bounds.start, end: bounds.end };
}

interface Bounds {
  chr: string | null;
  start: number | null;
  end: number | null;
}

function collectBounds(expr: SetExpression): Bounds | null {
  const acc: Bounds = { chr: null, start: null, end: null };
  if (!walk(expr, acc)) return null;
  return acc;
}

function walk(expr: SetExpression, acc: Bounds): boolean {
  switch (expr.kind) {
    case 'and':
      for (const t of expr.terms) if (!walk(t, acc)) return false;
      return true;
    case 'or':
    case 'not':
    case 'join':
      // OR/NOT/JOIN introduce ambiguity we don't try to resolve.
      return false;
    case 'cmp': {
      const { col, op, rhs } = expr;
      if (col === 'chr' && op === '=' && typeof rhs === 'string') {
        if (acc.chr !== null && acc.chr !== rhs) return false;
        acc.chr = rhs;
        return true;
      }
      // We ignore chr IN […] (multi-chromosome — not a single region).
      if (col === 'chr') return true;

      if (isPositionCol(col) && typeof rhs === 'number') {
        if (op === '>' || op === '>=') {
          acc.start = acc.start === null ? rhs : Math.max(acc.start, rhs);
          return true;
        }
        if (op === '<' || op === '<=') {
          acc.end = acc.end === null ? rhs : Math.min(acc.end, rhs);
          return true;
        }
        if (op === '=') {
          acc.start = rhs;
          acc.end = rhs;
          return true;
        }
      }
      // Non-position comparisons are allowed (don't invalidate), just ignored.
      return true;
    }
  }
}

function isPositionCol(col: string): boolean {
  return (
    col === 'start' ||
    col === 'end' ||
    col === 'pos' ||
    col === 'position' ||
    col === 'start_pos' ||
    col === 'end_pos'
  );
}
