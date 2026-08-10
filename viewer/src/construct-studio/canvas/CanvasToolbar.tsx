/** Inlined so the studio carries no icon dependency into the site build. */
function Scissors({ size = 14 }: { size?: number }) {
  return <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="6" cy="6" r="3" />
    <path d="M8.12 8.12 12 12" />
    <path d="M20 4 8.12 15.88" />
    <circle cx="6" cy="18" r="3" />
    <path d="M14.8 14.8 20 20" />
  </svg>
}
import type { RenderMode, Workspace } from '../model/types'
import { canRedo, canUndo } from '../model/workspace'
import type { CanvasSelection } from './selection'
import { geometryPermission } from './pathEditing'
import type { CanvasTool } from './useCanvasGestures'

export interface CanvasToolbarProps {
  workspace: Workspace
  selection: CanvasSelection
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onResetView: () => void
  onRenderMode: (strandId: string, mode: RenderMode) => void
  tool?: CanvasTool
  onToolChange?: (tool: CanvasTool) => void
}

export function CanvasToolbar({
  workspace,
  selection,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFit,
  onResetView,
  onRenderMode,
  tool = 'select',
  onToolChange,
}: CanvasToolbarProps) {
  const strand = workspace.strands.find((candidate) => candidate.id === selection.primaryStrandId)
  const permission = strand ? geometryPermission(strand) : { allowed: false, reason: 'Select a strand first' }

  return <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
    <div className="toolbar-group">
      <button
        type="button"
        onClick={() => onToolChange?.(tool === 'razor' ? 'select' : 'razor')}
        aria-label="Razor"
        aria-pressed={tool === 'razor'}
        title="Razor (X)"
      ><Scissors size={14} /></button>
    </div>
    <div className="toolbar-group">
      <button type="button" onClick={onUndo} disabled={!canUndo(workspace)} aria-label="Undo" title={!canUndo(workspace) ? 'Nothing to undo' : 'Undo'}>Undo</button>
      <button type="button" onClick={onRedo} disabled={!canRedo(workspace)} aria-label="Redo" title={!canRedo(workspace) ? 'Nothing to redo' : 'Redo'}>Redo</button>
    </div>
    <div className="toolbar-group">
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">−</button>
      <span aria-label={`Zoom ${Math.round(workspace.viewport.zoom * 100)} percent`}>
        {Math.round(workspace.viewport.zoom * 100)}%
      </span>
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">+</button>
      <button type="button" onClick={onFit} aria-label="Fit to content" title="Fit to content">Fit</button>
      <button type="button" onClick={onResetView} aria-label="Reset view" title="Reset view">Reset</button>
    </div>
    <div className="toolbar-group">
      <label>
        <span className="visually-hidden">Render mode</span>
        <select
          aria-label="Render mode"
          value={strand?.renderMode ?? 'linear'}
          disabled={!strand || !permission.allowed}
          title={!permission.allowed ? permission.reason : undefined}
          onChange={(event) => strand && onRenderMode(strand.id, event.target.value as RenderMode)}
        >
          <option value="linear">Linear</option>
          <option value="serpentine">Serpentine</option>
        </select>
      </label>
    </div>
  </div>
}
