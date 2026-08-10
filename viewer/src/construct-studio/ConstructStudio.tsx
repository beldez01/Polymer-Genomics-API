'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { CanvasEmptyState } from './canvas/CanvasEmptyState'
import { CanvasSurface } from './canvas/CanvasSurface'
import { CanvasToolbar } from './canvas/CanvasToolbar'
import { createCanvasDemoWorkspace } from './canvas/fixtures'
import { buildRenderPlan, type HighlightRange } from './canvas/renderPlan'
import { EMPTY_SELECTION, selectionReducer } from './canvas/selection'
import { useCanvasGestures, type CanvasTool } from './canvas/useCanvasGestures'
import { useWorkspaceController } from './canvas/useWorkspaceController'
import { fitBounds, unionBounds, type Size } from './canvas/viewport'
import { geometryPermission } from './canvas/pathEditing'
import { zoomAtCanvasCenter } from './canvas/interactions'
import { DuplexThermoPanel } from './canvas/DuplexThermoPanel'
import { SequenceView, type SequencePairedRange } from './sequence/SequenceView'
import { pairedRanges } from './model/duplexSync'
import { selectionThermodynamics, type ThermoConditions } from './model/thermo'
import { runSearch, type SearchRequest } from './model/search'
import { applyStructureOps, structureOf } from './model/fold'
import { findingRanges, runLint } from './model/lint'
import { LintPanel } from './canvas/LintPanel'
import { createLayoutSampler, pathBounds } from './model/layout'
import type { RenderMode, Workspace } from './model/types'
import './studio.css'

/**
 * Seeded deterministically rather than from a URL parameter: this component is
 * prerendered on the server, so reading location during render would mismatch
 * on hydration. A worked example is also a better landing than a blank canvas.
 */
function initialWorkspace(): Workspace {
  return createCanvasDemoWorkspace()
}

/**
 * Where the stability panel starts, not what it assumes: both numbers are shown
 * and editable in the inspector. 150 mM Na+ sits inside the range the Owczarzy
 * correction was validated over; 0.25 uM is the conventional oligo condition.
 */
const STARTING_CONDITIONS: ThermoConditions = { sodium: 0.15, strandConcentration: 0.25e-6 }

function workspaceBounds(workspace: Workspace) {
  return unionBounds(workspace.strands.map((strand) => {
    const sampler = createLayoutSampler(strand)
    const translated = sampler.path.map((point) => ({
      ...point,
      x: point.x + strand.placement.x,
      y: point.y + strand.placement.y,
      inHandle: point.inHandle
        ? { x: point.inHandle.x + strand.placement.x, y: point.inHandle.y + strand.placement.y }
        : undefined,
      outHandle: point.outHandle
        ? { x: point.outHandle.x + strand.placement.x, y: point.outHandle.y + strand.placement.y }
        : undefined,
    }))
    return pathBounds(translated)
  }))
}

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 1_200, height: 720 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const bounds = element.getBoundingClientRect()
      setSize({ width: bounds.width, height: bounds.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}

export function ConstructStudio() {
  const controller = useWorkspaceController(initialWorkspace)
  const [tool, setTool] = useState<CanvasTool>('select')
  const [selection, dispatchSelection] = useReducer(selectionReducer, EMPTY_SELECTION)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [conditions, setConditions] = useState<ThermoConditions>(STARTING_CONDITIONS)
  const [searchRequest, setSearchRequest] = useState<SearchRequest>({
    mode: 'iupac', pattern: '', maxMismatches: 0,
  })
  const [activeHitIndex, setActiveHitIndex] = useState(0)
  const [lintCollapsed, setLintCollapsed] = useState(false)
  // Continuous, per roadmap 3.2. Memoised on the committed workspace so a drag
  // does not re-lint every frame.
  // DEFAULT_PACK is the public pack in this copy — see model/lint/index.ts.
  const lintFindings = useMemo(() => runLint(controller.workspace), [controller.workspace])
  const { ref: stageRef, size } = useElementSize()
  const fitWorkspace = useCallback(() => {
    const bounds = workspaceBounds(controller.workspace)
    if (bounds) controller.setViewport(fitBounds(bounds, size, 64))
  }, [controller.setViewport, controller.workspace, size])
  const paired: SequencePairedRange[] = useMemo(() => {
    const range = selection.baseRange
    if (!range) return []
    const from = Math.min(range.anchor, range.focus)
    const to = Math.max(range.anchor, range.focus) + 1
    const nameById = new Map(controller.workspace.strands.map((strand) => [strand.id, strand.name]))
    return pairedRanges(controller.workspace.duplexes, range.strandId, from, to)
      .map((counterpart) => ({
        ...counterpart,
        strandName: nameById.get(counterpart.strandId) ?? counterpart.strandId,
      }))
  }, [controller.workspace.duplexes, controller.workspace.strands, selection.baseRange])
  const searchSelection = useMemo(() => {
    const range = selection.baseRange
    if (range) {
      return {
        strandId: range.strandId,
        from: Math.min(range.anchor, range.focus),
        to: Math.max(range.anchor, range.focus) + 1,
      }
    }
    // A motif search still needs a strand even when no bases are selected.
    return selection.primaryStrandId
      ? { strandId: selection.primaryStrandId, from: 0, to: 0 }
      : null
  }, [selection.baseRange, selection.primaryStrandId])
  const searchOutcome = useMemo(
    () => runSearch(controller.workspace, searchRequest, searchSelection),
    [controller.workspace, searchRequest, searchSelection],
  )
  const activeIndex = searchOutcome.hits.length === 0
    ? 0
    : Math.min(activeHitIndex, searchOutcome.hits.length - 1)
  const navigateHits = useCallback((delta: number) => {
    setActiveHitIndex((current) => {
      const count = searchOutcome.hits.length
      if (count === 0) return 0
      return ((Math.min(current, count - 1) + delta) % count + count) % count
    })
  }, [searchOutcome.hits.length])

  const highlightRanges = useMemo(() => {
    const ranges: HighlightRange[] = [...paired]
    for (const range of findingRanges(lintFindings)) {
      ranges.push({ ...range, kind: 'lint' })
    }
    for (const hit of searchOutcome.hits) {
      ranges.push({ strandId: hit.strandId, from: hit.from, to: hit.to, kind: 'match' })
    }
    if (selection.baseRange) {
      ranges.push({
        strandId: selection.baseRange.strandId,
        from: Math.min(selection.baseRange.anchor, selection.baseRange.focus),
        to: Math.max(selection.baseRange.anchor, selection.baseRange.focus) + 1,
        kind: 'selection',
      })
    }
    return ranges
  }, [lintFindings, paired, searchOutcome.hits, selection.baseRange])
  const thermoRows = useMemo(() => {
    const range = selection.baseRange
    if (!range) return []
    return selectionThermodynamics(
      controller.workspace,
      {
        strandId: range.strandId,
        from: Math.min(range.anchor, range.focus),
        to: Math.max(range.anchor, range.focus) + 1,
      },
      conditions,
    )
  }, [conditions, controller.workspace, selection.baseRange])
  const basePlan = useMemo(
    () => buildRenderPlan(controller.workspace, size, { selectedStrandIds: selection.strandIds, highlightRanges }),
    [controller.workspace, highlightRanges, selection.strandIds, size],
  )
  const gestures = useCanvasGestures({
    workspace: controller.workspace,
    plan: basePlan,
    size,
    selection,
    dispatchSelection,
    setViewport: controller.setViewport,
    commitMany: controller.commitMany,
    undo: controller.undo,
    redo: controller.redo,
    fitView: fitWorkspace,
    tool,
    onToolChange: setTool,
    onCutCommitted: () => setTool('select'),
  })
  const displayPlan = useMemo(
    () => buildRenderPlan(gestures.previewWorkspace, size, { selectedStrandIds: selection.strandIds, highlightRanges }),
    [gestures.previewWorkspace, highlightRanges, selection.strandIds, size],
  )
  const selectedStrand = gestures.previewWorkspace.strands.find(
    (strand) => strand.id === selection.primaryStrandId,
  )

  useEffect(() => {
    dispatchSelection({
      type: 'prune',
      validStrandIds: controller.workspace.strands.map((strand) => strand.id),
    })
  }, [controller.workspace.strands])

  const loadDemo = () => {
    controller.replaceWorkspace(createCanvasDemoWorkspace())
    dispatchSelection({ type: 'clear' })
  }

  const setRenderMode = (strandId: string, renderMode: RenderMode) => {
    controller.commit({ op: 'render-mode', strandId, renderMode })
  }

  const selectedPermission = selectedStrand ? geometryPermission(selectedStrand) : null
  // The site supplies its own header and navigation, so the studio renders as a
  // workspace only — no wordmark, no rail, no page heading of its own.
  return <div className="polymer-shell polymer-shell--embedded">
    <div className="suite-body suite-body--embedded">
      <section className="studio-workspace">
        <CanvasToolbar
          workspace={controller.workspace}
          selection={selection}
          onUndo={controller.undo}
          onRedo={controller.redo}
          onZoomIn={() => controller.setViewport(zoomAtCanvasCenter(controller.workspace.viewport, size, 1.25))}
          onZoomOut={() => controller.setViewport(zoomAtCanvasCenter(controller.workspace.viewport, size, 0.8))}
          onFit={fitWorkspace}
          onResetView={() => controller.setViewport({ x: 0, y: 0, zoom: 1 })}
          onRenderMode={setRenderMode}
          tool={tool}
          onToolChange={setTool}
        />
        <div className="canvas-stage" ref={stageRef}>
          <CanvasSurface
            workspace={gestures.previewWorkspace}
            plan={displayPlan}
            size={size}
            selection={selection}
            interactionProps={gestures.interactionProps}
            marquee={gestures.marquee}
            blade={gestures.blade}
            spliceCandidate={gestures.spliceCandidate}
          />
          {controller.workspace.strands.length === 0 && <CanvasEmptyState onLoadDemo={loadDemo} />}
          <LintPanel
            findings={lintFindings}
            collapsed={lintCollapsed}
            onToggle={() => setLintCollapsed((value) => !value)}
          />
          {selectedStrand && <aside className={`selection-inspector ${inspectorCollapsed ? 'collapsed' : ''}`} aria-label="Selected strand inspector">
            <div>
              <span className="section-index">SELECTED STRAND</span>
              <span className="inspector-controls">
                <button type="button" onClick={() => setInspectorCollapsed((value) => !value)} aria-label={inspectorCollapsed ? 'Expand inspector' : 'Minimize inspector'} aria-expanded={!inspectorCollapsed}>{inspectorCollapsed ? '+' : '–'}</button>
                <button type="button" onClick={() => dispatchSelection({ type: 'clear' })} aria-label="Close inspector">×</button>
              </span>
            </div>
            <h2>{selectedStrand.name}</h2>
            {!inspectorCollapsed && <>
              <dl>
                <div><dt>Length</dt><dd>{selectedStrand.sequence.length} nt</dd></div>
                <div><dt>Role</dt><dd>{selectedStrand.role}</dd></div>
                <div><dt>Shape</dt><dd>{selectedStrand.layout.mode} / {selectedStrand.renderMode}</dd></div>
                <div><dt>Position</dt><dd>{Math.round(selectedStrand.placement.x)}, {Math.round(selectedStrand.placement.y)}</dd></div>
              </dl>
              {!selectedPermission?.allowed && <p className="blocked-reason">{selectedPermission?.reason}</p>}
              <DuplexThermoPanel
                rows={thermoRows}
                conditions={conditions}
                onConditionsChange={setConditions}
              />
            </>}
          </aside>}
          <div className="canvas-status" aria-live="polite">
            <span>{gestures.blockedReason ?? `${displayPlan.sceneElementCount} scene elements`}</span>
            <span>{lintFindings.length === 0 ? 'lint clean' : `${lintFindings.length} lint findings`}</span>
            <span>{Math.round(controller.workspace.viewport.zoom * 100)}%</span>
          </div>
        </div>
        <SequenceView
          strand={selectedStrand ?? null}
          selection={selection}
          paired={paired}
          search={{
            request: searchRequest,
            onRequestChange: (next) => {
              setSearchRequest(next)
              setActiveHitIndex(0)
            },
            outcome: searchOutcome,
            activeIndex,
            onNavigate: navigateHits,
          }}
          onApplyStructure={(dotBracket) => {
            if (!selectedStrand) return 'Select a strand first.'
            const result = applyStructureOps(controller.workspace, selectedStrand.id, dotBracket)
            if (!result.ok) return result.error
            controller.commitMany(result.operations)
            return null
          }}
          onReadStructure={() => {
            if (!selectedStrand) return { ok: false, error: 'Select a strand first.' }
            const result = structureOf(controller.workspace, selectedStrand.id)
            if (!result.ok) return result
            return {
              ok: true,
              dotBracket: result.dotBracket,
              note: result.omittedPartners.length === 0
                ? null
                : `Pairing with ${result.omittedPartners.join(', ')} is not shown — `
                  + 'dot-bracket describes one molecule.',
            }
          }}
          onBaseClick={(index, shift) => {
            if (selectedStrand) dispatchSelection({ type: 'base-click', strandId: selectedStrand.id, index, shift })
          }}
          onCommit={controller.commit}
          onCommitMany={controller.commitMany}
        />
      </section>
    </div>
  </div>
}
