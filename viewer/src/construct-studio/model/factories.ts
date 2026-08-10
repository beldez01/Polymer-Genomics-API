import {
  SCHEMA_VERSION,
  type Annotation,
  type Duplex,
  type DuplexEnd,
  type Design,
  type DuplexRole,
  type RnaStrand,
  type SourceSegment,
  type Workspace,
} from './types'

let counter = 0

/** Deterministic, readable ids. Tests call resetIds() for stability. */
export function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

export function resetIds(): void {
  counter = 0
}

export function createWorkspace(): Workspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    strands: [],
    duplexes: [],
    designs: [],
    panels: [],
    referenceFrameId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    history: [],
    historyIndex: 0,
  }
}

export function createStrand(init: Partial<RnaStrand> & { name: string; sequence: string }): RnaStrand {
  const segments: SourceSegment[] =
    init.segments ??
    (init.sequence.length === 0
      ? []
      : [
          {
            start: 0,
            end: init.sequence.length,
            origin: 'user-edited',
            source: { type: 'custom' },
          },
        ])
  return {
    id: init.id ?? nextId('strand'),
    name: init.name,
    kind: init.kind ?? 'unknown',
    role: init.role ?? 'construct',
    sequence: init.sequence,
    caseMask: init.caseMask,
    orientation: init.orientation ?? '5to3',
    placement: init.placement ?? { x: 0, y: 0 },
    layout: init.layout ?? { mode: 'auto' },
    renderMode: init.renderMode ?? 'linear',
    ntPerUnit: init.ntPerUnit ?? 1,
    segments,
    annotations: init.annotations ?? [],
    locked: init.locked ?? { geometry: false, sequence: false },
  }
}

export function createAnnotation(init: Omit<Annotation, 'id' | 'colorToken'> & Partial<Annotation>): Annotation {
  return {
    id: init.id ?? nextId('ann'),
    start: init.start,
    end: init.end,
    label: init.label,
    type: init.type,
    colorToken: init.colorToken ?? 'neutral',
    frame: init.frame,
  }
}

export function createDuplex(init: { a: DuplexEnd; b: DuplexEnd; role: DuplexRole } & Partial<Duplex>): Duplex {
  return {
    id: init.id ?? nextId('duplex'),
    a: init.a,
    b: init.b,
    role: init.role,
    state: init.state,
    registration: init.registration ?? 0,
    evaluated: init.evaluated,
  }
}

export function createDesign(init: Partial<Design> & { name: string }): Design {
  return {
    id: init.id ?? nextId('design'),
    name: init.name,
    architecture: init.architecture ?? 'custom',
    strandIds: init.strandIds ?? [],
    targetStrandId: init.targetStrandId ?? null,
    counterTargetStrandIds: init.counterTargetStrandIds ?? [],
    controlType: init.controlType,
    lotId: init.lotId,
    frozen: init.frozen ?? false,
  }
}
