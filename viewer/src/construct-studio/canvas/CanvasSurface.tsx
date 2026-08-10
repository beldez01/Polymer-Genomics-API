import type { MouseEvent, SVGProps } from 'react'
import type { CanvasPoint, Workspace } from '../model/types'
import { seedRopeLayout } from '../model/ropeLayout'
import { AnnotationLayer } from './AnnotationLayer'
import { DuplexLayer } from './DuplexLayer'
import { endWorld } from './interactions'
import { geometryPermission } from './pathEditing'
import type { CanvasRenderPlan } from './renderPlan'
import type { CanvasSelection } from './selection'
import type { Size } from './viewport'
import type { Bounds } from './viewport'
import type { BladeIndicator, SpliceCandidate } from './useCanvasGestures'
import { StrandLayer } from './StrandLayer'
import './canvas.css'

export interface CanvasSurfaceProps {
  workspace: Workspace
  plan: CanvasRenderPlan
  size: Size
  selection: CanvasSelection
  onStrandSelect?: (strandId: string, event: MouseEvent<SVGElement>) => void
  onBaseSelect?: (strandId: string, index: number, event: MouseEvent<SVGElement>) => void
  interactionProps?: Pick<SVGProps<SVGSVGElement>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onWheel' | 'onKeyDown'
  >
  marquee?: Bounds | null
  blade?: BladeIndicator | null
  spliceCandidate?: SpliceCandidate | null
}

function bladeLine(
  workspace: Workspace,
  blade: BladeIndicator | null | undefined,
  zoom: number,
): { x1: number; y1: number; x2: number; y2: number } | null {
  if (!blade) return null
  const strand = workspace.strands.find((candidate) => candidate.id === blade.strandId)
  if (!strand) return null
  const layout = strand.layout.mode === 'rope' ? strand.layout : seedRopeLayout(strand)
  const a = layout.points[blade.at - 1]
  const b = layout.points[blade.at]
  if (!a || !b) return null
  const mid: CanvasPoint = {
    x: (a.x + b.x) / 2 + strand.placement.x,
    y: (a.y + b.y) / 2 + strand.placement.y,
  }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const normal = { x: -dy / length, y: dx / length }
  const half = 6 / zoom
  return {
    x1: mid.x - normal.x * half,
    y1: mid.y - normal.y * half,
    x2: mid.x + normal.x * half,
    y2: mid.y + normal.y * half,
  }
}

function spliceGlowPoints(
  workspace: Workspace,
  candidate: SpliceCandidate | null | undefined,
): { strandId: string; point: CanvasPoint }[] {
  if (!candidate) return []
  const a = workspace.strands.find((strand) => strand.id === candidate.aStrandId)
  const b = workspace.strands.find((strand) => strand.id === candidate.bStrandId)
  if (!a || !b) return []
  const points: { strandId: string; point: CanvasPoint }[] = []
  const aEnd = endWorld(a, 'end')
  const bStart = endWorld(b, 'start')
  if (aEnd) points.push({ strandId: a.id, point: aEnd })
  if (bStart) points.push({ strandId: b.id, point: bStart })
  return points
}

export function CanvasSurface({
  workspace,
  plan,
  size,
  selection,
  onStrandSelect,
  onBaseSelect,
  interactionProps,
  marquee,
  blade,
  spliceCandidate,
}: CanvasSurfaceProps) {
  const zoom = workspace.viewport.zoom
  const width = Math.max(0, size.width) / zoom
  const height = Math.max(0, size.height) / zoom
  const selectedPlan = selection.primaryStrandId
    ? plan.strands.find((candidate) => candidate.strandId === selection.primaryStrandId)
    : undefined
  const selectedStrand = selection.primaryStrandId
    ? workspace.strands.find((candidate) => candidate.id === selection.primaryStrandId)
    : undefined
  const showRotateHandle = selectedPlan && selectedStrand && geometryPermission(selectedStrand).allowed
  const bladeIndicator = bladeLine(workspace, blade, zoom)
  const spliceGlow = spliceGlowPoints(workspace, spliceCandidate)
  return <svg
    className="rna-canvas"
    width={size.width}
    height={size.height}
    viewBox={`${workspace.viewport.x} ${workspace.viewport.y} ${width} ${height}`}
    role="application"
    aria-label="RNA construct canvas"
    aria-describedby="rna-canvas-instructions"
    tabIndex={0}
    {...interactionProps}
  >
    <desc id="rna-canvas-instructions">Use arrow keys to move through a selected base range. Shift plus arrow extends it. Drag the background to pan.</desc>
    <rect
      className="canvas-background"
      x={workspace.viewport.x}
      y={workspace.viewport.y}
      width={width}
      height={height}
    />
    <DuplexLayer duplexes={plan.duplexes} />
    <StrandLayer
      strands={plan.strands}
      selectedStrandIds={selection.strandIds}
      zoom={zoom}
      onStrandSelect={onStrandSelect}
      onBaseSelect={onBaseSelect}
      baseRange={selection.baseRange}
    />
    <AnnotationLayer strands={plan.strands} />
    {showRotateHandle && selectedPlan && (
      <circle
        data-rotate-handle={selectedPlan.strandId}
        className="rotate-handle"
        cx={(selectedPlan.bounds.minX + selectedPlan.bounds.maxX) / 2}
        cy={selectedPlan.bounds.minY - 24 / zoom}
        r={8 / zoom}
        vectorEffect="non-scaling-stroke"
      />
    )}
    {spliceGlow.map(({ strandId, point }) => (
      <circle
        key={`splice-${strandId}`}
        data-splice-end={strandId}
        className="splice-glow"
        cx={point.x}
        cy={point.y}
        r={10 / zoom}
        vectorEffect="non-scaling-stroke"
      />
    ))}
    {marquee && <rect
      className="canvas-marquee"
      x={marquee.minX}
      y={marquee.minY}
      width={marquee.maxX - marquee.minX}
      height={marquee.maxY - marquee.minY}
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
    />}
    {bladeIndicator && <line
      data-blade
      className="blade-indicator"
      x1={bladeIndicator.x1}
      y1={bladeIndicator.y1}
      x2={bladeIndicator.x2}
      y2={bladeIndicator.y2}
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
    />}
  </svg>
}
