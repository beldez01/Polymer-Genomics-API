import type { SeqOp } from './types'

/** Canonical description of any sequence edit. */
export interface Splice {
  start: number
  deleted: number
  inserted: number
}

export type Bias = 'left' | 'right'

export function toSplice(op: SeqOp): Splice {
  switch (op.op) {
    case 'insert':
      return { start: op.at, deleted: 0, inserted: op.seq.length }
    case 'delete':
      return { start: op.start, deleted: op.end - op.start, inserted: 0 }
    case 'replace':
      return { start: op.start, deleted: op.end - op.start, inserted: op.seq.length }
  }
}

/**
 * Move one anchor position across a splice.
 * `bias` resolves the genuinely ambiguous case where the anchor sits exactly
 * at the edit point: 'left' keeps it before the new text, 'right' after.
 */
export function remapPosition(pos: number, splice: Splice, bias: Bias): number {
  const delEnd = splice.start + splice.deleted

  if (pos < splice.start) return pos
  if (pos === splice.start && splice.deleted === 0) {
    // Pure insertion at exactly this position: genuinely ambiguous, resolved by bias.
    return bias === 'left' ? splice.start : splice.start + splice.inserted
  }
  if (pos >= delEnd) return pos - splice.deleted + splice.inserted
  // Strictly inside a real deleted range (including its start): collapses to the edit's start.
  return splice.start
}

/**
 * Move a half-open interval across a splice.
 * Start biases right and end biases left, which gives the behaviour you want:
 * text inserted at an interval's boundary lands OUTSIDE it, text inserted
 * strictly within EXPANDS it.
 * Returns null when nothing of the interval survives.
 */
export function remapInterval(start: number, end: number, splice: Splice): { start: number; end: number } | null {
  const newStart = remapPosition(start, splice, 'right')
  const newEnd = remapPosition(end, splice, 'left')
  if (newEnd <= newStart) return null
  return { start: newStart, end: newEnd }
}

/** Applies a splice to a string. `insertText` must have length `splice.inserted`. */
export function applySplice(text: string, splice: Splice, insertText: string): string {
  return text.slice(0, splice.start) + insertText + text.slice(splice.start + splice.deleted)
}
