import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type SVGProps,
  type WheelEvent,
} from 'react'
import type { CanvasPoint, EditOp, Viewport, Workspace } from '../model/types'
import { applyOp } from '../model/ops'
import { nextId } from '../model/factories'
import { seedRopeLayout } from '../model/ropeLayout'
import { hitTestCanvas, strandsInMarquee } from './hitTest'
import {
  beginMarquee,
  beginMove,
  beginPan,
  beginRopeDrag,
  beginRotate,
  bladeIndexFor,
  canvasKeyboardCommand,
  IDLE_GESTURE,
  marqueeBounds,
  moveOperations,
  previewViewport,
  ropeOperation,
  rotateOperation,
  spliceCandidate as computeSpliceCandidate,
  updateGesture,
  zoomFromWheel,
  zoomAtCanvasCenter,
  type Gesture,
} from './interactions'
import type { CanvasRenderPlan } from './renderPlan'
import type { CanvasSelection, SelectionAction } from './selection'
import { screenToWorld, worldToScreen, type Size } from './viewport'
import { geometryPermission } from './pathEditing'

export type CanvasTool = 'select' | 'razor'
export interface BladeIndicator { strandId: string; at: number }
export interface SpliceCandidate { aStrandId: string; bStrandId: string }

/** Workspace with the in-flight gesture's deformation/translation applied, for live preview. */
function applyGesturePreview(gesture: Gesture, workspace: Workspace): Workspace {
  const operations = gesture.kind === 'move'
    ? moveOperations(gesture)
    : gesture.kind === 'rope'
      ? [ropeOperation(gesture)]
      : gesture.kind === 'rotate'
        ? [rotateOperation(gesture)]
        : []
  return operations.reduce((current, operation) => applyOp(current, operation), workspace)
}

/** The gesture's primary dragged strand id, for move/rope kinds only. */
function primaryDraggedId(gesture: Gesture): string | null {
  if (gesture.kind === 'move') return gesture.strandIds[0] ?? null
  if (gesture.kind === 'rope') return gesture.strandId
  return null
}

export type CanvasInteractionProps = Pick<SVGProps<SVGSVGElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onWheel' | 'onKeyDown'
>

export interface UseCanvasGesturesOptions {
  workspace: Workspace
  plan: CanvasRenderPlan
  size: Size
  selection: CanvasSelection
  dispatchSelection: (action: SelectionAction) => void
  setViewport: (viewport: Viewport) => void
  undo: () => void
  redo: () => void
  commitMany: (operations: readonly EditOp[]) => void
  fitView?: () => void
  tool?: CanvasTool
  onToolChange?: (tool: CanvasTool) => void
  onCutCommitted?: () => void
}

function relativeScreen(event: PointerEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function editableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export function useCanvasGestures({
  workspace,
  plan,
  size,
  selection,
  dispatchSelection,
  setViewport,
  undo,
  redo,
  commitMany,
  fitView,
  tool = 'select',
  onToolChange,
  onCutCommitted,
}: UseCanvasGesturesOptions): {
  gesture: Gesture
  marquee: ReturnType<typeof marqueeBounds>
  previewWorkspace: Workspace
  blockedReason: string | null
  blade: BladeIndicator | null
  spliceCandidate: SpliceCandidate | null
  interactionProps: CanvasInteractionProps
} {
  const [gesture, setGesture] = useState<Gesture>(IDLE_GESTURE)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [blade, setBlade] = useState<BladeIndicator | null>(null)
  const [spliceCandidateState, setSpliceCandidateState] = useState<SpliceCandidate | null>(null)
  const gestureRef = useRef<Gesture>(IDLE_GESTURE)
  const frameRef = useRef<number | null>(null)
  const pendingViewport = useRef<Viewport | null>(null)
  const gestureFrameRef = useRef<number | null>(null)
  const pendingGesture = useRef<Gesture | null>(null)
  const ropeStartPointsRef = useRef<CanvasPoint[] | null>(null)
  const rotateStartPointsRef = useRef<CanvasPoint[] | null>(null)
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace

  const publishGesture = useCallback((next: Gesture) => {
    gestureRef.current = next
    setGesture(next)
  }, [])

  const queueViewport = useCallback((viewport: Viewport) => {
    pendingViewport.current = viewport
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      if (pendingViewport.current) setViewport(pendingViewport.current)
      pendingViewport.current = null
    })
  }, [setViewport])

  const queueGesture = useCallback((next: Gesture) => {
    pendingGesture.current = next
    if (gestureFrameRef.current !== null) return
    gestureFrameRef.current = requestAnimationFrame(() => {
      gestureFrameRef.current = null
      const flushed = pendingGesture.current
      pendingGesture.current = null
      if (!flushed) return
      setGesture(flushed)
      // At most one preview + candidate scan per animation frame, regardless
      // of how many pointermove events the browser reported this frame.
      if (flushed.kind === 'move' || flushed.kind === 'rope') {
        const draggedId = primaryDraggedId(flushed)
        const previewNow = applyGesturePreview(flushed, workspaceRef.current)
        const dragged = draggedId ? previewNow.strands.find((strand) => strand.id === draggedId) : undefined
        setSpliceCandidateState(dragged ? computeSpliceCandidate(dragged, previewNow.strands) : null)
      } else {
        setSpliceCandidateState(null)
      }
    })
  }, [])

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (gestureFrameRef.current !== null) cancelAnimationFrame(gestureFrameRef.current)
  }, [])

  useEffect(() => {
    if (tool !== 'razor') setBlade(null)
  }, [tool])

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const screen = relativeScreen(event)
    const world = screenToWorld(screen, workspace.viewport)
    if (tool === 'razor') {
      const hit = hitTestCanvas(plan, screen, workspace.viewport)
      if (hit?.type === 'strand' || hit?.type === 'base') {
        const strand = workspace.strands.find((candidate) => candidate.id === hit.strandId)
        if (!strand || strand.locked.sequence) {
          setBlockedReason(strand ? `Sequence is locked for ${strand.name}` : null)
          return
        }
        if (strand.sequence.length < 2) {
          setBlockedReason(`${strand.name} is too short to cut`)
          return
        }
        setBlockedReason(null)
        const seeded: EditOp[] = strand.layout.mode === 'rope'
          ? []
          : [{ op: 'layout', strandId: strand.id, layout: seedRopeLayout(strand) }]
        const ropeStrand = strand.layout.mode === 'rope' ? strand : { ...strand, layout: seedRopeLayout(strand) }
        const at = bladeIndexFor(ropeStrand, world)
        commitMany([...seeded, { op: 'cut', strandId: strand.id, at, newStrandId: nextId('strand') }])
        onCutCommitted?.()
      }
      return
    }
    const handleId = (event.target as Element)?.getAttribute?.('data-rotate-handle')
    if (handleId) {
      const strand = workspace.strands.find((candidate) => candidate.id === handleId)
      if (strand && geometryPermission(strand).allowed) {
        const next = beginRotate(event.pointerId, strand, world)
        rotateStartPointsRef.current = next.kind === 'rotate' ? next.points : null
        if (next.kind !== 'idle') {
          publishGesture(next)
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture may be unavailable in tests */ }
        }
      }
      return
    }
    const hit = hitTestCanvas(plan, screen, workspace.viewport)
    if (hit?.type === 'base') {
      dispatchSelection({ type: 'base-click', strandId: hit.strandId, index: hit.index, shift: event.shiftKey })
      return
    }
    if (hit?.type === 'strand') {
      if (event.shiftKey || !selection.strandIds.includes(hit.strandId)) {
        dispatchSelection({ type: 'strand-click', strandId: hit.strandId, shift: event.shiftKey })
      }
      if (event.shiftKey) return
      if (event.altKey) {
        // Strands translate independently: only the grabbed strand moves,
        // regardless of how many are selected.
        const grabbed = workspace.strands.find((candidate) => candidate.id === hit.strandId)
        const strands = grabbed ? [grabbed] : []
        const blocked = strands.find((strand) => !geometryPermission(strand).allowed)
        setBlockedReason(blocked ? geometryPermission(blocked).reason ?? 'Geometry is unavailable' : null)
        const next = beginMove(event.pointerId, strands, world)
        if (next.kind !== 'idle') {
          publishGesture(next)
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture may be unavailable in tests */ }
        }
        return
      }
      const strand = workspace.strands.find((candidate) => candidate.id === hit.strandId)
      if (!strand) return
      const permission = geometryPermission(strand)
      if (!permission.allowed) { setBlockedReason(permission.reason ?? 'Geometry is locked'); return }
      setBlockedReason(null)
      const next = beginRopeDrag(event.pointerId, strand, world)
      ropeStartPointsRef.current = next.kind === 'rope' ? next.points : null
      if (next.kind !== 'idle') {
        publishGesture(next)
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture may be unavailable in tests */ }
      }
      return
    }

    const next = event.shiftKey
      ? beginMarquee(event.pointerId, world)
      : beginPan(event.pointerId, screen, workspace.viewport)
    publishGesture(next)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* capture may be unavailable in tests */ }
  }, [commitMany, dispatchSelection, onCutCommitted, plan, publishGesture, selection.strandIds, tool, workspace])

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const current = gestureRef.current
    if (tool === 'razor' && current.kind === 'idle') {
      const screen = relativeScreen(event)
      const world = screenToWorld(screen, workspace.viewport)
      const hit = hitTestCanvas(plan, screen, workspace.viewport)
      const strand = hit ? workspace.strands.find((candidate) => candidate.id === hit.strandId) : undefined
      if (strand) {
        const ropeStrand = strand.layout.mode === 'rope' ? strand : { ...strand, layout: seedRopeLayout(strand) }
        setBlade({ strandId: strand.id, at: bladeIndexFor(ropeStrand, world) })
      } else {
        setBlade(null)
      }
      return
    }
    if (current.kind === 'idle' || current.pointerId !== event.pointerId) return
    const screen = relativeScreen(event)
    const next = updateGesture(current, {
      pointerId: event.pointerId,
      screen,
      world: screenToWorld(screen, current.kind === 'pan' ? current.startViewport : workspace.viewport),
    })
    gestureRef.current = next
    if (next.kind === 'pan') {
      const viewport = previewViewport(next)
      if (viewport) queueViewport(viewport)
    } else if (next.kind === 'move' || next.kind === 'rope' || next.kind === 'rotate') {
      queueGesture(next)
    } else {
      setGesture(next)
    }
  }, [plan, queueGesture, queueViewport, tool, workspace])

  const finishPointer = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const current = gestureRef.current
    if (current.kind === 'idle' || current.pointerId !== event.pointerId) return
    if (current.kind === 'pan') {
      const viewport = previewViewport(current)
      if (viewport) setViewport(viewport)
    } else if (current.kind === 'marquee') {
      const start = worldToScreen(current.startWorld, workspace.viewport)
      const end = worldToScreen(current.currentWorld, workspace.viewport)
      const strandIds = strandsInMarquee(plan, {
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
      }, workspace.viewport)
      dispatchSelection({ type: 'marquee', strandIds, additive: event.shiftKey && selection.strandIds.length > 0 })
    } else if (current.kind === 'move' || current.kind === 'rope') {
      const dragOps = current.kind === 'move'
        ? moveOperations(current)
        : current.points !== ropeStartPointsRef.current
          ? [ropeOperation(current)]
          : []
      // Only look for a splice when the gesture actually moved something —
      // otherwise a bare click (e.g. selecting a piece right after a razor
      // cut, whose ends still sit within the snap radius) would re-splice it.
      if (dragOps.length > 0) {
        // Computed fresh here (not read from the rAF-batched ref) so release
        // always reflects the gesture's final position, even if the last
        // queued animation frame hasn't flushed yet.
        const previewAtRelease = applyGesturePreview(current, workspace)
        const draggedId = primaryDraggedId(current)
        const dragged = draggedId ? previewAtRelease.strands.find((s) => s.id === draggedId) : undefined
        const candidate = dragged ? computeSpliceCandidate(dragged, previewAtRelease.strands) : null
        if (candidate) {
          const seedOps: EditOp[] = [candidate.aStrandId, candidate.bStrandId].flatMap((id) => {
            const strand = previewAtRelease.strands.find((s) => s.id === id)
            return strand && strand.layout.mode !== 'rope'
              ? [{ op: 'layout' as const, strandId: id, layout: seedRopeLayout(strand) }]
              : []
          })
          commitMany([...dragOps, ...seedOps, { op: 'splice', aStrandId: candidate.aStrandId, bStrandId: candidate.bStrandId }])
        } else {
          commitMany(dragOps)
        }
      }
    } else if (current.kind === 'rotate') {
      if (current.points !== rotateStartPointsRef.current) commitMany([rotateOperation(current)])
    }
    ropeStartPointsRef.current = null
    rotateStartPointsRef.current = null
    setSpliceCandidateState(null)
    pendingViewport.current = null
    pendingGesture.current = null
    publishGesture(IDLE_GESTURE)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch { /* capture may be unavailable in tests */ }
  }, [commitMany, dispatchSelection, plan, publishGesture, selection.strandIds.length, setViewport, workspace])

  const onPointerCancel = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const current = gestureRef.current
    if (current.kind === 'pan') setViewport(current.startViewport)
    pendingViewport.current = null
    pendingGesture.current = null
    ropeStartPointsRef.current = null
    rotateStartPointsRef.current = null
    setSpliceCandidateState(null)
    publishGesture(IDLE_GESTURE)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch { /* capture may be unavailable in tests */ }
  }, [publishGesture, setViewport])

  const onWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    setViewport(zoomFromWheel(workspace.viewport, relativeScreen(event), event.deltaY))
  }, [setViewport, workspace.viewport])

  const onKeyDown = useCallback((event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape' && tool === 'razor') {
      onToolChange?.('select')
      setBlade(null)
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      const current = gestureRef.current
      if (current.kind !== 'idle') {
        if (current.kind === 'pan') setViewport(current.startViewport)
        pendingViewport.current = null
        pendingGesture.current = null
        ropeStartPointsRef.current = null
        rotateStartPointsRef.current = null
        setSpliceCandidateState(null)
        publishGesture(IDLE_GESTURE)
      } else {
        dispatchSelection({ type: 'escape' })
      }
      event.preventDefault()
      return
    }
    if (selection.baseRange && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const strand = workspace.strands.find((candidate) => candidate.id === selection.baseRange?.strandId)
      if (strand) {
        dispatchSelection({
          type: 'base-step',
          direction: event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1,
          extend: event.shiftKey,
          strandLength: strand.sequence.length,
        })
        event.preventDefault()
        return
      }
    }
    const command = canvasKeyboardCommand({
      key: event.key,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      targetEditable: editableTarget(event.target),
    }, event.currentTarget === document.activeElement || event.currentTarget.contains(document.activeElement))
    if (!command) return
    event.preventDefault()
    if (command === 'undo') undo()
    else if (command === 'redo') redo()
    else if (command === 'fit') fitView?.()
    else if (command === 'zoom-in') {
      setViewport(zoomAtCanvasCenter(workspace.viewport, size, 1.25))
    } else if (command === 'zoom-out') {
      setViewport(zoomAtCanvasCenter(workspace.viewport, size, 0.8))
    } else if (command === 'toggle-razor') {
      onToolChange?.(tool === 'razor' ? 'select' : 'razor')
    }
  }, [dispatchSelection, fitView, onToolChange, publishGesture, redo, selection.baseRange, setViewport, size, tool, undo, workspace])

  const previewWorkspace = useMemo(
    () => applyGesturePreview(gesture, workspace),
    [gesture, workspace],
  )

  return {
    gesture,
    marquee: marqueeBounds(gesture),
    previewWorkspace,
    blockedReason,
    blade,
    spliceCandidate: spliceCandidateState,
    interactionProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel,
      onWheel,
      onKeyDown,
    },
  }
}
