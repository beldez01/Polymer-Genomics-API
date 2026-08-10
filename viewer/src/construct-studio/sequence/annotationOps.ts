import { createAnnotation } from '../model/factories'
import type { Annotation, AnnotationType, EditOp } from '../model/types'

/** Region color palette: token names map to CSS classes in both views. */
export const ANNOTATION_COLORS: ReadonlyArray<{ token: string; hex: string }> = [
  { token: 'blue', hex: '#0f62fe' },
  { token: 'violet', hex: '#7c3aed' },
  { token: 'teal', hex: '#0e9488' },
  { token: 'amber', hex: '#b45309' },
  { token: 'rose', hex: '#be123c' },
  { token: 'green', hex: '#15803d' },
  { token: 'slate', hex: '#475569' },
  { token: 'neutral', hex: '#71717a' },
]

/** Every AnnotationType, for pickers. Mirrors the union in model/types. */
export const ANNOTATION_TYPES: readonly AnnotationType[] = [
  'cap', 'utr', 'sensor', 'edit-site', 'bridge', 'payload', 'linker',
  'polyA', 'orf', 'stop', '2a',
  'ires', 'lock-stem', 'toehold', 'ribozyme-half', 'recognition-arm',
  'mre', 'rbp-site', 'custom',
]

/** Annotate a half-open base range with a fresh annotation. */
export function createAnnotationOp(
  strandId: string,
  from: number,
  to: number,
  label: string,
  type: AnnotationType,
  colorToken = 'blue',
): EditOp {
  return {
    op: 'annotate',
    strandId,
    annotation: createAnnotation({ start: from, end: to, label, type, colorToken }),
  }
}

export interface AnnotationPatch {
  label?: string
  type?: AnnotationType
  colorToken?: string
  start?: number
  end?: number
}

/**
 * Rewrite an annotation in place as one undoable gesture: remove-then-add
 * through the existing ops so history inversion needs no new op kind.
 * Changing the type also moves the colorToken with it.
 */
export function updateAnnotationOps(
  strandId: string,
  annotation: Annotation,
  patch: AnnotationPatch,
): EditOp[] {
  const next: Annotation = {
    ...annotation,
    ...patch,
    colorToken: patch.colorToken ?? annotation.colorToken,
  }
  return [
    { op: 'unannotate', strandId, annotationId: annotation.id },
    { op: 'annotate', strandId, annotation: next },
  ]
}

export function deleteAnnotationOp(strandId: string, annotationId: string): EditOp {
  return { op: 'unannotate', strandId, annotationId }
}
