import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Annotation, AnnotationType, EditOp, RnaStrand, SeqOp } from '../model/types'
import { describeLocation, locateBase } from '../model/coords'
import type { CanvasSelection } from '../canvas/selection'
import {
  ANNOTATION_COLORS,
  ANNOTATION_TYPES,
  createAnnotationOp,
  deleteAnnotationOp,
  updateAnnotationOps,
  type AnnotationPatch,
} from './annotationOps'
import { SequenceSearch, type SequenceSearchProps } from './SequenceSearch'
import { StructureBar, type StructureBarProps } from './StructureBar'
import './sequence.css'

const CELL = 18
const OVERSCAN = 24

/** A duplex counterpart of the current base selection, labelled for display. */
export interface SequencePairedRange {
  duplexId: string
  strandId: string
  strandName: string
  from: number
  to: number
}

interface SequenceViewProps {
  strand: RnaStrand | null
  selection: CanvasSelection
  paired: readonly SequencePairedRange[]
  search: SequenceSearchProps
  /** Applies a dot-bracket structure to this strand; returns an error or null. */
  onApplyStructure: (dotBracket: string) => string | null
  onReadStructure: StructureBarProps['onRead']
  onBaseClick: (index: number, shift: boolean) => void
  onCommit: (operation: SeqOp) => void
  onCommitMany: (operations: readonly EditOp[]) => void
}

function range(selection: CanvasSelection, strand: RnaStrand) {
  if (selection.baseRange?.strandId !== strand.id) return null
  const from = Math.min(selection.baseRange.anchor, selection.baseRange.focus)
  const to = Math.max(selection.baseRange.anchor, selection.baseRange.focus)
  return { from, to }
}

interface AnnotationEditorProps {
  annotation: Annotation
  onUpdate: (patch: AnnotationPatch) => void
  onDelete: () => void
  onClose: () => void
}

function ColorSwatches({ value, onPick, idPrefix }: {
  value: string
  onPick: (token: string) => void
  idPrefix: string
}) {
  return <span className="color-swatches" role="group" aria-label={`${idPrefix} color`}>
    {ANNOTATION_COLORS.map(({ token, hex }) => <button
      key={token}
      type="button"
      className={`color-swatch ${value === token ? 'picked' : ''}`}
      style={{ background: hex }}
      aria-label={`${idPrefix} color ${token}`}
      aria-pressed={value === token}
      onClick={() => onPick(token)}
    />)}
  </span>
}

export function AnnotationEditor({ annotation, onUpdate, onDelete, onClose }: AnnotationEditorProps) {
  const [label, setLabel] = useState(annotation.label)
  const [type, setType] = useState<AnnotationType>(annotation.type)
  const [color, setColor] = useState(annotation.colorToken)
  const dirty = label !== annotation.label || type !== annotation.type || color !== annotation.colorToken
  return <div className="annotation-editor" aria-label={`Edit annotation ${annotation.label}`}>
    <span className="annotation-editor-range">{annotation.start + 1}–{annotation.end}</span>
    <input aria-label="Annotation label" value={label} onChange={(event) => setLabel(event.target.value)} />
    <select aria-label="Annotation type" value={type} onChange={(event) => setType(event.target.value as AnnotationType)}>
      {ANNOTATION_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    <ColorSwatches value={color} onPick={setColor} idPrefix="Annotation" />
    <button type="button" onClick={() => onUpdate({ label, type, colorToken: color })} disabled={!dirty || !label}>Update</button>
    <button type="button" onClick={onDelete}>Delete annotation</button>
    <button type="button" onClick={onClose} aria-label="Close annotation editor">×</button>
  </div>
}

export function SequenceView({ strand, selection, paired, search, onApplyStructure, onReadStructure, onBaseClick, onCommit, onCommitMany }: SequenceViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [editText, setEditText] = useState('')
  const selected = strand ? range(selection, strand) : null
  const windowed = useMemo(() => {
    if (!strand) return { from: 0, to: 0 }
    const width = scroller.current?.clientWidth ?? 900
    const from = Math.max(0, Math.floor(scrollLeft / CELL) - OVERSCAN)
    const to = Math.min(strand.sequence.length, Math.ceil((scrollLeft + width) / CELL) + OVERSCAN)
    return { from, to }
  }, [scrollLeft, strand])

  useEffect(() => {
    setEditText(selected && strand ? strand.sequence.slice(selected.from, selected.to + 1) : '')
  }, [selected?.from, selected?.to, strand])

  const activeHit = search.outcome.hits[search.activeIndex] ?? null
  useEffect(() => {
    const element = scroller.current
    if (!element || !activeHit || !strand || activeHit.strandId !== strand.id) return
    // Put the active hit a third of the way in rather than hard against the edge.
    element.scrollLeft = Math.max(0, activeHit.from * CELL - element.clientWidth / 3)
  }, [activeHit?.strandId, activeHit?.from, activeHit?.to, strand?.id])

  const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<AnnotationType>('custom')
  const [newColor, setNewColor] = useState('blue')
  useEffect(() => {
    setOpenAnnotationId(null)
  }, [strand?.id])

  if (!strand) return <section className="sequence-view sequence-view-empty" aria-label="Sequence view"><span className="section-index">SEQUENCE VIEW</span><p>Select a strand to inspect its sequence.</p></section>

  const width = strand.sequence.length * CELL
  const focusIndex = selection.baseRange?.strandId === strand.id ? selection.baseRange.focus : null
  const focusLocation = focusIndex === null ? null : locateBase(strand, focusIndex)
  const ownPaired = paired.filter((range) => range.strandId === strand.id)
  const isPaired = (index: number) => ownPaired.some((range) => index >= range.from && index < range.to)
  const ownHits = search.outcome.hits.filter((hit) => hit.strandId === strand.id)
  const isMatch = (index: number) => ownHits.some((hit) => index >= hit.from && index < hit.to)
  const isActiveMatch = (index: number) =>
    Boolean(activeHit && activeHit.strandId === strand.id
      && index >= activeHit.from && index < activeHit.to)
  const openAnnotation = strand.annotations.find((annotation) => annotation.id === openAnnotationId) ?? null
  const annotateSelection = () => {
    if (!selected || !newLabel) return
    onCommitMany([createAnnotationOp(strand.id, selected.from, selected.to + 1, newLabel, newType, newColor)])
    setNewLabel('')
  }
  const commitReplace = () => {
    if (!selected || strand.locked.sequence || !editText) return
    onCommit({ op: 'replace', strandId: strand.id, start: selected.from, end: selected.to + 1, seq: editText.toUpperCase() })
  }
  const commitInsert = () => {
    if (strand.locked.sequence || !editText) return
    const at = selected ? selected.to + 1 : strand.sequence.length
    onCommit({ op: 'insert', strandId: strand.id, at, seq: editText.toUpperCase() })
  }
  const commitDelete = () => {
    if (!selected || strand.locked.sequence) return
    onCommit({ op: 'delete', strandId: strand.id, start: selected.from, end: selected.to + 1 })
  }

  return <section className="sequence-view" aria-label={`Sequence view for ${strand.name}`}>
    <div className="sequence-heading">
      <div><span className="section-index">SEQUENCE VIEW</span><h2>{strand.name}</h2></div>
      <span className="sequence-meta">{strand.sequence.length.toLocaleString()} nt · {strand.orientation}</span>
    </div>
    <div className="sequence-controls">
      <input aria-label="Sequence edit" value={editText} onChange={(event) => setEditText(event.target.value.replace(/[^ACGUNacgun]/g, ''))} placeholder={selected ? 'Replace selection' : 'Insert RNA'} disabled={strand.locked.sequence} />
      <button type="button" onClick={commitReplace} disabled={!selected || strand.locked.sequence || !editText}>Replace</button>
      <button type="button" onClick={commitInsert} disabled={strand.locked.sequence || !editText}>Insert</button>
      <button type="button" onClick={commitDelete} disabled={!selected || strand.locked.sequence}>Delete</button>
      {strand.locked.sequence && <span className="sequence-lock">Sequence locked</span>}
    </div>
    {/* One row: the panel is an overlay anchored to the bottom of the canvas,
        so every control row it grows by is a row of molecule it covers. */}
    <div className="sequence-tools">
      <SequenceSearch {...search} />
      <StructureBar onApply={onApplyStructure} onRead={onReadStructure} />
    </div>
    {selected && <div className="annotation-create">
      <input aria-label="New annotation label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Annotation label" />
      <select aria-label="New annotation type" value={newType} onChange={(event) => setNewType(event.target.value as AnnotationType)}>
        {ANNOTATION_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ColorSwatches value={newColor} onPick={setNewColor} idPrefix="New annotation" />
      <button type="button" onClick={annotateSelection} disabled={!newLabel}>Annotate selection</button>
    </div>}
    {openAnnotation && <AnnotationEditor
      key={openAnnotation.id}
      annotation={openAnnotation}
      onUpdate={(patch) => onCommitMany(updateAnnotationOps(strand.id, openAnnotation, patch))}
      onDelete={() => {
        onCommitMany([deleteAnnotationOp(strand.id, openAnnotation.id)])
        setOpenAnnotationId(null)
      }}
      onClose={() => setOpenAnnotationId(null)}
    />}
    <div className="sequence-scroll" ref={scroller} onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}>
      <div className="sequence-track" style={{ width }}>
        <div className="annotation-track" aria-label="Annotation track">
          {strand.annotations.map((annotation) => <button
            type="button"
            key={annotation.id}
            data-annotation-id={annotation.id}
            className={`sequence-annotation annotation-token-${annotation.colorToken} ${annotation.id === openAnnotationId ? 'open' : ''}`}
            style={{ left: annotation.start * CELL, width: Math.max(CELL, (annotation.end - annotation.start) * CELL) }}
            aria-label={`Annotation ${annotation.label}, ${annotation.type}, ${annotation.start + 1}–${annotation.end}`}
            title={`${annotation.label} · ${annotation.start + 1}–${annotation.end}`}
            onClick={() => setOpenAnnotationId(annotation.id)}
          />)}
        </div>
        <div className="sequence-cells" style={{ marginLeft: windowed.from * CELL }}>
          {strand.sequence.slice(windowed.from, windowed.to).split('').map((base, offset) => {
            const index = windowed.from + offset
            const active = selected && index >= selected.from && index <= selected.to
            const style: CSSProperties = { width: CELL }
            const classes = ['sequence-base']
            if (active) classes.push('active')
            if (isPaired(index)) classes.push('paired')
            if (isMatch(index)) classes.push(isActiveMatch(index) ? 'match active-match' : 'match')
            return <button type="button" key={index} className={classes.join(' ')} style={style} data-sequence-index={index} aria-label={`Base ${index + 1}, ${base}`} aria-pressed={Boolean(active)} onClick={(event) => onBaseClick(index, event.shiftKey)}>{base}</button>
          })}
        </div>
        <div className="sequence-ruler" aria-hidden="true"><span>1</span><span style={{ left: Math.max(0, strand.sequence.length * CELL - 34) }}>{strand.sequence.length}</span></div>
      </div>
    </div>
    {focusIndex !== null && <div className="sequence-coordinate" aria-label="Source coordinate">
      {focusLocation
        ? describeLocation(focusLocation)
        : `No source coordinate for base ${focusIndex + 1} (user-edited or untraceable)`}
    </div>}
    <div className="sequence-status" aria-live="polite">
      <span>{selected ? `Selected ${selected.from + 1}–${selected.to + 1} (${selected.to - selected.from + 1} nt)` : 'Click a base to select; Shift-click to extend'}</span>
      {paired.map((range) => <span key={`${range.duplexId}:${range.strandId}:${range.from}`} className="sequence-paired">
        Paired with {range.strandName} {range.from + 1}–{range.to}
      </span>)}
    </div>
  </section>
}
