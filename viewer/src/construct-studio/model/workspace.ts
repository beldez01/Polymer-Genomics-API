import { applyOp, invertOp } from './ops'
import type {
  EditOp,
  SeqOp,
  SequenceUndoState,
  Workspace,
  WorkspaceHistoryEntry,
  WorkspaceHistoryStep,
} from './types'

function isSequenceOperation(operation: EditOp): operation is SeqOp {
  return operation.op === 'insert' || operation.op === 'delete' || operation.op === 'replace'
}

function captureSequenceUndo(workspace: Workspace, operation: SeqOp): SequenceUndoState | undefined {
  const strand = workspace.strands.find((candidate) => candidate.id === operation.strandId)
  if (!strand) return undefined
  return {
    strandId: strand.id,
    caseMask: strand.caseMask,
    segments: strand.segments,
    annotations: strand.annotations,
    duplexes: workspace.duplexes,
    layout: strand.layout,
  }
}

export function canUndo(workspace: Workspace): boolean {
  return workspace.historyIndex > 0
}

export function canRedo(workspace: Workspace): boolean {
  return workspace.historyIndex < workspace.history.length
}

function createHistoryStep(workspace: Workspace, operation: EditOp): WorkspaceHistoryStep {
  return {
    operation,
    inverse: invertOp(workspace, operation),
    sequenceUndo: isSequenceOperation(operation)
      ? captureSequenceUndo(workspace, operation)
      : undefined,
    spliceUndo: operation.op === 'splice'
      ? (() => {
          const b = workspace.strands.find((s) => s.id === operation.bStrandId)
          return b
            ? {
                strandId: b.id,
                name: b.name,
                kind: b.kind,
                role: b.role,
                renderMode: b.renderMode,
                locked: { ...b.locked },
                placement: b.placement,
                layout: b.layout,
              }
            : undefined
        })()
      : undefined,
  }
}

function restoreSequenceUndo(workspace: Workspace, saved: SequenceUndoState): Workspace {
  return {
    ...workspace,
    strands: workspace.strands.map((strand) =>
      strand.id === saved.strandId
        ? {
            ...strand,
            caseMask: saved.caseMask,
            segments: saved.segments,
            annotations: saved.annotations,
            layout: saved.layout ?? strand.layout,
          }
        : strand,
    ),
    duplexes: saved.duplexes,
  }
}

/** Apply a group of operations as one history transaction, discarding any redo tail. */
export function commitMany(workspace: Workspace, operations: readonly EditOp[]): Workspace {
  if (operations.length === 0) return workspace

  let next = workspace
  const steps: WorkspaceHistoryStep[] = []
  for (const operation of operations) {
    steps.push(createHistoryStep(next, operation))
    next = applyOp(next, operation)
  }

  const entry: WorkspaceHistoryEntry = { steps }
  const history = workspace.history.slice(0, workspace.historyIndex).concat(entry)
  return { ...next, history, historyIndex: history.length }
}

/** Apply an operation and record it, discarding any redo tail. */
export function commit(workspace: Workspace, operation: EditOp): Workspace {
  return commitMany(workspace, [operation])
}

export function undo(workspace: Workspace): Workspace {
  if (!canUndo(workspace)) return workspace
  const entry = workspace.history[workspace.historyIndex - 1]
  let next = workspace
  for (let index = entry.steps.length - 1; index >= 0; index -= 1) {
    const step = entry.steps[index]
    next = applyOp(next, step.inverse)
    if (step.sequenceUndo) next = restoreSequenceUndo(next, step.sequenceUndo)
    if (step.spliceUndo) {
      const saved = step.spliceUndo
      next = {
        ...next,
        strands: next.strands.map((s) =>
          s.id === saved.strandId
            ? {
                ...s,
                name: saved.name,
                kind: saved.kind,
                role: saved.role,
                renderMode: saved.renderMode,
                locked: { ...saved.locked },
                placement: saved.placement,
                layout: saved.layout,
              }
            : s,
        ),
      }
    }
  }
  return {
    ...next,
    history: workspace.history,
    historyIndex: workspace.historyIndex - 1,
  }
}

export function redo(workspace: Workspace): Workspace {
  if (!canRedo(workspace)) return workspace
  const entry = workspace.history[workspace.historyIndex]
  let next = workspace
  for (const step of entry.steps) next = applyOp(next, step.operation)
  return {
    ...next,
    history: workspace.history,
    historyIndex: workspace.historyIndex + 1,
  }
}
