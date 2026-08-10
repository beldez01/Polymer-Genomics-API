import { applySplice, remapInterval, toSplice, type Splice } from './anchors'
import { sourceCoordAt, spliceSegments } from './segments'
import { spliceRopePoints } from './ropeSplice'
import { assertRope } from './ropeLayout'
import { splitAnnotationsAt, splitDuplexesAt, splitSegmentsAt } from './cutSplice'
import { settleRope } from './rope'
import type { Duplex, DuplexEnd, EditOp, RnaStrand, SeqOp, SourceSegment, Workspace } from './types'

function isSeqOp(op: EditOp): op is SeqOp {
  return op.op === 'insert' || op.op === 'delete' || op.op === 'replace'
}

function insertedText(op: SeqOp): string {
  return op.op === 'delete' ? '' : op.seq
}

/**
 * Rejoin adjacent segments that trace to the same source and are contiguous
 * in source coordinates too — the inverse of `splitSegmentsAt`. Segments that
 * merely abut in local index but come from unrelated provenance stay apart.
 */
function mergeAdjacentSegments(segments: SourceSegment[]): SourceSegment[] {
  const out: SourceSegment[] = []
  for (const seg of segments) {
    const prev = out[out.length - 1]
    const continuous =
      prev !== undefined &&
      prev.end === seg.start &&
      prev.origin === seg.origin &&
      JSON.stringify(prev.source) === JSON.stringify(seg.source) &&
      (prev.coordMap === undefined) === (seg.coordMap === undefined) &&
      (prev.coordMap === undefined ||
        (prev.coordMap.accession === seg.coordMap!.accession &&
          prev.coordMap.referenceBuild === seg.coordMap!.referenceBuild &&
          prev.coordMap.space === seg.coordMap!.space &&
          prev.coordMap.strand === seg.coordMap!.strand &&
          sourceCoordAt(prev, prev.end) === seg.coordMap!.sourceStart))
    if (continuous) {
      out[out.length - 1] = { ...prev, end: seg.end }
    } else {
      out.push(seg)
    }
  }
  return out
}

export function spliceCaseMask(mask: Uint8Array | undefined, splice: Splice): Uint8Array | undefined {
  if (!mask) return undefined
  const next = new Uint8Array(mask.length - splice.deleted + splice.inserted)
  next.set(mask.subarray(0, splice.start), 0)
  next.set(mask.subarray(splice.start + splice.deleted), splice.start + splice.inserted)
  return next
}

function spliceStrand(strand: RnaStrand, op: SeqOp): RnaStrand {
  const splice = toSplice(op)
  const text = insertedText(op)

  const annotations = strand.annotations
    .map((a) => {
      const moved = remapInterval(a.start, a.end, splice)
      return moved ? { ...a, ...moved } : null
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)

  let layout = strand.layout
  if (layout.mode === 'rope') {
    layout = { mode: 'rope', points: spliceRopePoints(layout.points, splice, strand.ntPerUnit) }
  }

  const result = {
    ...strand,
    sequence: applySplice(strand.sequence, splice, text),
    caseMask: spliceCaseMask(strand.caseMask, splice),
    annotations,
    segments: spliceSegments(strand.segments, splice),
    layout,
  }
  assertRope(result)
  return result
}

function spliceDuplexes(duplexes: Duplex[], strandId: string, splice: Splice): Duplex[] {
  const out: Duplex[] = []
  for (const d of duplexes) {
    let next = d
    let touched = false

    if (d.a.strandId === strandId) {
      const moved = remapInterval(d.a.start, d.a.end, splice)
      if (!moved) continue
      next = { ...next, a: { ...next.a, ...moved } }
      touched = true
    }
    if (d.b.strandId === strandId) {
      const moved = remapInterval(d.b.start, d.b.end, splice)
      if (!moved) continue
      next = { ...next, b: { ...next.b, ...moved } }
      touched = true
    }
    // A cached evaluation describes sequence that may no longer be there.
    out.push(touched ? { ...next, evaluated: undefined } : next)
  }
  return out
}

/** The ONLY function permitted to change a strand's sequence. Pure. */
export function applyOp(ws: Workspace, op: EditOp): Workspace {
  if (isSeqOp(op)) {
    const splice = toSplice(op)
    return {
      ...ws,
      strands: ws.strands.map((s) => (s.id === op.strandId ? spliceStrand(s, op) : s)),
      duplexes: spliceDuplexes(ws.duplexes, op.strandId, splice),
    }
  }

  switch (op.op) {
    case 'annotate':
      return {
        ...ws,
        strands: ws.strands.map((s) =>
          s.id === op.strandId ? { ...s, annotations: [...s.annotations, op.annotation] } : s,
        ),
      }
    case 'unannotate':
      return {
        ...ws,
        strands: ws.strands.map((s) =>
          s.id === op.strandId
            ? { ...s, annotations: s.annotations.filter((a) => a.id !== op.annotationId) }
            : s,
        ),
      }
    case 'layout':
      return {
        ...ws,
        strands: ws.strands.map((s) => (s.id === op.strandId ? { ...s, layout: op.layout } : s)),
      }
    case 'move':
      return {
        ...ws,
        strands: ws.strands.map((s) =>
          s.id === op.strandId ? { ...s, placement: op.placement } : s,
        ),
      }
    case 'render-mode':
      return {
        ...ws,
        strands: ws.strands.map((s) =>
          s.id === op.strandId ? { ...s, renderMode: op.renderMode } : s,
        ),
      }
    case 'pair':
      return { ...ws, duplexes: [...ws.duplexes, op.duplex] }
    case 'unpair':
      return { ...ws, duplexes: ws.duplexes.filter((d) => d.id !== op.duplexId) }
    case 'cut': {
      const strand = ws.strands.find((s) => s.id === op.strandId)
      if (!strand || strand.layout.mode !== 'rope') throw new Error('cut requires a rope strand')
      const at = op.at
      const { left: segLeft, right: segRight } = splitSegmentsAt(strand.segments, at)
      const { left: annLeft, right: annRight } = splitAnnotationsAt(strand.annotations, at)
      const points = strand.layout.points
      const pivot = points[at] ?? points.at(-1) ?? { x: 0, y: 0 }
      const a: RnaStrand = {
        ...strand,
        sequence: strand.sequence.slice(0, at),
        caseMask: strand.caseMask?.slice(0, at),
        segments: segLeft,
        annotations: annLeft,
        layout: { mode: 'rope', points: points.slice(0, at) },
      }
      const b: RnaStrand = {
        ...strand,
        id: op.newStrandId,
        name: op.newStrandName ?? `${strand.name} · 3′ piece`,
        sequence: strand.sequence.slice(at),
        caseMask: strand.caseMask?.slice(at),
        segments: segRight,
        annotations: annRight,
        placement: { x: strand.placement.x + pivot.x, y: strand.placement.y + pivot.y },
        renderMode: 'linear',
        layout: {
          mode: 'rope',
          points: points.slice(at).map((p) => ({ x: p.x - pivot.x, y: p.y - pivot.y })),
        },
      }
      const index = ws.strands.findIndex((s) => s.id === op.strandId)
      const strands = [...ws.strands]
      strands.splice(index, 1, a, b)
      return { ...ws, strands, duplexes: splitDuplexesAt(ws.duplexes, op.strandId, at, op.newStrandId) }
    }
    case 'splice': {
      const a = ws.strands.find((s) => s.id === op.aStrandId)
      const b = ws.strands.find((s) => s.id === op.bStrandId)
      if (!a || !b || a.layout.mode !== 'rope' || b.layout.mode !== 'rope') throw new Error('splice requires rope strands')
      const lenA = a.sequence.length
      const rest = a.ntPerUnit
      const bWorldLocal = b.layout.points.map((p) => ({
        x: p.x + b.placement.x - a.placement.x,
        y: p.y + b.placement.y - a.placement.y,
      }))
      const caseMask = a.caseMask || b.caseMask
        ? (() => {
            const mask = new Uint8Array(lenA + b.sequence.length)
            if (a.caseMask) mask.set(a.caseMask, 0)
            if (b.caseMask) mask.set(b.caseMask, lenA)
            return mask
          })()
        : undefined
      const merged: RnaStrand = {
        ...a,
        sequence: a.sequence + b.sequence,
        caseMask,
        segments: mergeAdjacentSegments([
          ...a.segments,
          ...b.segments.map((s) => ({ ...s, start: s.start + lenA, end: s.end + lenA })),
        ]),
        annotations: [...a.annotations, ...b.annotations.map((x) => ({ ...x, start: x.start + lenA, end: x.end + lenA }))],
        layout: { mode: 'rope', points: settleRope([...a.layout.points, ...bWorldLocal], rest) },
      }
      const shiftEnd = (end: DuplexEnd): DuplexEnd =>
        end.strandId === op.bStrandId
          ? { strandId: op.aStrandId, start: end.start + lenA, end: end.end + lenA }
          : end
      return {
        ...ws,
        strands: ws.strands.filter((s) => s.id !== op.bStrandId).map((s) => (s.id === op.aStrandId ? merged : s)),
        duplexes: ws.duplexes.map((d) => ({ ...d, a: shiftEnd(d.a), b: shiftEnd(d.b), evaluated: undefined })),
        referenceFrameId: ws.referenceFrameId === op.bStrandId ? op.aStrandId : ws.referenceFrameId,
      }
    }
  }
}

/** Builds the inverse of `op` from the workspace state immediately BEFORE it is applied. */
export function invertOp(ws: Workspace, op: EditOp): EditOp {
  const strand = ws.strands.find((s) => s.id === ('strandId' in op ? op.strandId : ''))

  switch (op.op) {
    case 'insert':
      return { op: 'delete', strandId: op.strandId, start: op.at, end: op.at + op.seq.length }
    case 'delete':
      return { op: 'insert', strandId: op.strandId, at: op.start, seq: strand!.sequence.slice(op.start, op.end) }
    case 'replace':
      return {
        op: 'replace',
        strandId: op.strandId,
        start: op.start,
        end: op.start + op.seq.length,
        seq: strand!.sequence.slice(op.start, op.end),
      }
    case 'annotate':
      return { op: 'unannotate', strandId: op.strandId, annotationId: op.annotation.id }
    case 'unannotate': {
      const existing = strand!.annotations.find((a) => a.id === op.annotationId)!
      return { op: 'annotate', strandId: op.strandId, annotation: existing }
    }
    case 'layout':
      return { op: 'layout', strandId: op.strandId, layout: strand!.layout }
    case 'move':
      return { op: 'move', strandId: op.strandId, placement: strand!.placement }
    case 'render-mode':
      return { op: 'render-mode', strandId: op.strandId, renderMode: strand!.renderMode }
    case 'pair':
      return { op: 'unpair', duplexId: op.duplex.id }
    case 'unpair': {
      const existing = ws.duplexes.find((d) => d.id === op.duplexId)!
      return { op: 'pair', duplex: existing }
    }
    case 'cut':
      return { op: 'splice', aStrandId: op.strandId, bStrandId: op.newStrandId }
    case 'splice': {
      const a = ws.strands.find((s) => s.id === op.aStrandId)!
      return { op: 'cut', strandId: op.aStrandId, at: a.sequence.length, newStrandId: op.bStrandId }
    }
  }
}
