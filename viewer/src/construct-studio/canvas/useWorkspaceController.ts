import { useCallback, useState } from 'react'
import type { EditOp, Viewport, Workspace } from '../model/types'
import {
  commit as commitWorkspace,
  commitMany as commitManyWorkspace,
  redo as redoWorkspace,
  undo as undoWorkspace,
} from '../model/workspace'

export function useWorkspaceController(initialWorkspace: Workspace | (() => Workspace)) {
  const [workspace, setWorkspace] = useState(initialWorkspace)

  const commit = useCallback((operation: EditOp) => {
    setWorkspace((current) => commitWorkspace(current, operation))
  }, [])

  const commitMany = useCallback((operations: readonly EditOp[]) => {
    setWorkspace((current) => commitManyWorkspace(current, operations))
  }, [])

  const undo = useCallback(() => {
    setWorkspace((current) => undoWorkspace(current))
  }, [])

  const redo = useCallback(() => {
    setWorkspace((current) => redoWorkspace(current))
  }, [])

  const setViewport = useCallback((viewport: Viewport) => {
    setWorkspace((current) => ({ ...current, viewport }))
  }, [])

  const replaceWorkspace = useCallback((next: Workspace) => {
    setWorkspace(next)
  }, [])

  return {
    workspace,
    commit,
    commitMany,
    undo,
    redo,
    setViewport,
    replaceWorkspace,
  }
}
