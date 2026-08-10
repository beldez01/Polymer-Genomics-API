export const SCHEMA_VERSION = 3

export type StrandKind = 'target' | 'mRNA' | 'probe' | 'template' | 'unknown'
export type StrandRole = 'construct' | 'target' | 'counter-target'
export type RenderMode = 'linear' | 'serpentine'
export type SegmentOrigin = 'corpus-exact' | 'derived-window' | 'user-edited' | 'placeholder'
export type JunctionConfirmation = 'assumed' | 'literature' | 'empirical'
export type CoordSpace = 'transcript' | 'genomic' | 'cds'

export type AnnotationType =
  | 'cap' | 'utr' | 'sensor' | 'edit-site' | 'bridge' | 'payload' | 'linker'
  | 'polyA' | 'orf' | 'stop' | '2a'
  | 'ires' | 'lock-stem' | 'toehold' | 'ribozyme-half' | 'recognition-arm'
  | 'mre' | 'rbp-site' | 'custom'

export type Architecture =
  | 'adar-stop' | 'toehold' | 'sk-sl-ires' | 'split-ribozyme'
  | 'self-cleaving-ribozyme' | 'utr-riboregulator' | 'splice-replacement'
  | 'mirna-logic' | 'protein-assisted' | 'custom'

export type ControlType =
  | 'junction-mismatch' | 'non-targeting' | 'edit-disabled'
  | 'delivery-reporter' | 'positive-control'

/** `predicted` marks a duplex a folding engine proposed, not one a user drew. */
export type DuplexRole = 'sensor' | 'bridge' | 'mask' | 'lock' | 'sk-sl' | 'user' | 'predicted'

/**
 * Maps local strand indices to a source coordinate system.
 * `sourceStart` is the source coordinate of the segment's FIRST base, so a
 * segment that merely shifts in local space needs no change here, and a
 * segment truncated at its front updates exactly one number.
 */
export interface CoordMap {
  accession: string
  referenceBuild: string
  space: CoordSpace
  sourceStart: number
  strand: '+' | '-'
}

export interface SequenceSource {
  type: 'custom' | 'template' | 'transcript' | 'fusion' | 'genomic'
  accession?: string
  gene?: string
  partnerGene?: string
  isoform?: string
  junction?: string
  referenceBuild?: string
  provenance?: string
  retrievedAt?: string
  junctionConfirmation?: JunctionConfirmation
  confirmedIn?: string
}

/** Contiguous, non-overlapping, sorted; together they partition [0, sequence.length). */
export interface SourceSegment {
  start: number
  end: number
  origin: SegmentOrigin
  source: SequenceSource
  coordMap?: CoordMap
}

export interface Annotation {
  id: string
  start: number
  end: number
  label: string
  type: AnnotationType
  colorToken: string
  frame?: 0 | 1 | 2
}

export interface PathPoint {
  id: string
  x: number
  y: number
  inHandle?: { x: number; y: number }
  outHandle?: { x: number; y: number }
}

export interface CanvasPoint {
  x: number
  y: number
}

/**
 * D1: in `auto` mode NO geometry is stored, so the picture cannot drift from
 * the molecule.
 */
export type StrandLayout =
  | { mode: 'auto' }
  | { mode: 'rope'; points: CanvasPoint[] }

export interface RnaStrand {
  id: string
  name: string
  kind: StrandKind
  role: StrandRole
  sequence: string
  caseMask?: Uint8Array
  orientation: '5to3' | '3to5'
  placement: CanvasPoint
  layout: StrandLayout
  renderMode: RenderMode
  ntPerUnit: number
  segments: SourceSegment[]
  annotations: Annotation[]
  locked: { geometry: boolean; sequence: boolean }
}

export interface DuplexEnd {
  strandId: string
  start: number
  end: number
}

export interface Mismatch {
  aIndex: number
  bIndex: number
  kind: 'mismatch' | 'wobble' | 'ambiguous'
}

export interface DuplexEvaluation {
  length: number
  pairs: number
  wobbles: number
  mismatches: Mismatch[]
  gc: number
  deltaG?: { value: number; unit: 'kcal/mol'; method: string; version: string }
}

export interface Duplex {
  id: string
  a: DuplexEnd
  b: DuplexEnd
  role: DuplexRole
  state?: 'locked' | 'unlocked'
  registration: number
  evaluated?: DuplexEvaluation
}

export interface Design {
  id: string
  name: string
  architecture: Architecture
  strandIds: string[]
  targetStrandId: string | null
  counterTargetStrandIds: string[]
  controlType?: ControlType
  lotId?: string
  frozen: boolean
}

export interface Panel {
  id: string
  name: string
  designIds: string[]
  requiredControls: ControlType[]
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type SeqOp =
  | { op: 'insert'; strandId: string; at: number; seq: string }
  | { op: 'delete'; strandId: string; start: number; end: number }
  | { op: 'replace'; strandId: string; start: number; end: number; seq: string }

export type EditOp =
  | SeqOp
  | { op: 'move'; strandId: string; placement: CanvasPoint }
  | { op: 'render-mode'; strandId: string; renderMode: RenderMode }
  | { op: 'layout'; strandId: string; layout: StrandLayout }
  | { op: 'annotate'; strandId: string; annotation: Annotation }
  | { op: 'unannotate'; strandId: string; annotationId: string }
  | { op: 'pair'; duplex: Duplex }
  | { op: 'unpair'; duplexId: string }
  | { op: 'cut'; strandId: string; at: number; newStrandId: string; newStrandName?: string }
  | { op: 'splice'; aStrandId: string; bStrandId: string }

/** Exact non-sequence state that a sequence edit can otherwise destroy. */
export interface SequenceUndoState {
  strandId: string
  caseMask?: Uint8Array
  segments: SourceSegment[]
  annotations: Annotation[]
  duplexes: Duplex[]
  layout?: StrandLayout
}

/**
 * Identity and placement fields of B, lost when splice absorbs it into A.
 * `placement`/`layout` are captured immediately before the splice because
 * cut (splice's inverse) can only reconstruct B's geometry from A's frame —
 * it has no way to recover the placement/points split B actually had.
 */
export interface SpliceUndoState {
  strandId: string
  name: string
  kind: StrandKind
  role: StrandRole
  renderMode: RenderMode
  locked: { geometry: boolean; sequence: boolean }
  placement: CanvasPoint
  layout: StrandLayout
}

/** One operation within an undoable workspace transaction. */
export interface WorkspaceHistoryStep {
  operation: EditOp
  inverse: EditOp
  sequenceUndo?: SequenceUndoState
  spliceUndo?: SpliceUndoState
}

/** One user gesture, potentially spanning several molecular objects. */
export interface WorkspaceHistoryEntry {
  steps: WorkspaceHistoryStep[]
}

export interface Workspace {
  schemaVersion: number
  strands: RnaStrand[]
  duplexes: Duplex[]
  designs: Design[]
  panels: Panel[]
  referenceFrameId: string | null
  viewport: Viewport
  history: WorkspaceHistoryEntry[]
  historyIndex: number
}
