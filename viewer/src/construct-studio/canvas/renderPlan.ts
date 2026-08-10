import {
  catmullRomPath,
  createLayoutSampler,
  pathBounds,
  pathToSvg,
  type LayoutOptions,
} from '../model/layout'
import type {
  AnnotationType,
  CanvasPoint,
  PathPoint,
  RnaStrand,
  StrandRole,
  Workspace,
} from '../model/types'
import {
  BASE_MIN_PX_PER_NT,
  MAX_BASE_GLYPHS,
  OVERVIEW_MAX_PX_PER_NT,
} from './constants'
import { buildSpatialIndex } from './spatialIndex'
import {
  boundsIntersect,
  unionBounds,
  visibleWorldBounds,
  type Bounds,
  type Size,
} from './viewport'

export type Lod = 'overview' | 'ticks' | 'bases'

export interface PlannedBase extends CanvasPoint {
  index: number
  base: string
}

export interface PlannedTick extends CanvasPoint {
  index: number
  tangent: CanvasPoint
}

export interface PlannedAnnotation {
  id: string
  label: string
  type: AnnotationType
  colorToken: string
  from: number
  to: number
  start: CanvasPoint
  end: CanvasPoint
  path: string
  bounds: Bounds
}

export type HighlightKind = 'paired' | 'selection' | 'match' | 'lint'

export interface HighlightRange {
  strandId: string
  from: number
  to: number
  kind?: HighlightKind
}

export interface PlannedHighlight {
  from: number
  to: number
  kind: HighlightKind
  path: string
}

export interface StrandRenderPlan {
  strandId: string
  name: string
  sequenceLength: number
  role: StrandRole
  renderMode: RnaStrand['renderMode']
  orientation: RnaStrand['orientation']
  lod: Lod
  projectedSpacing: number
  path: string
  pathPoints: PathPoint[]
  visibleRanges: Array<{ from: number; to: number }>
  tickIndices: number[]
  ticks: PlannedTick[]
  bases: PlannedBase[]
  annotations: PlannedAnnotation[]
  highlights: PlannedHighlight[]
  bounds: Bounds
  start: CanvasPoint
  end: CanvasPoint
}

export interface PlannedDuplex {
  id: string
  role: Workspace['duplexes'][number]['role']
  state?: Workspace['duplexes'][number]['state']
  aStrandId: string
  bStrandId: string
  path: string
  start: CanvasPoint
  end: CanvasPoint
  bounds: Bounds
}

export interface CanvasRenderPlan {
  visibleBounds: Bounds
  strands: StrandRenderPlan[]
  duplexes: PlannedDuplex[]
  baseGlyphCount: number
  sceneElementCount: number
}

export interface RenderPlanOptions extends LayoutOptions {
  selectedStrandIds?: readonly string[]
  highlightRanges?: readonly HighlightRange[]
}

interface Candidate {
  strand: RnaStrand
  sampler: ReturnType<typeof createLayoutSampler>
  plan: StrandRenderPlan
  visibleIndices: number[]
  selected: boolean
}

function worldPath(strand: RnaStrand, path: ReturnType<typeof createLayoutSampler>['path']) {
  return path.map((point) => ({
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
}

function lodFor(projectedSpacing: number): Lod {
  if (projectedSpacing < OVERVIEW_MAX_PX_PER_NT) return 'overview'
  if (projectedSpacing < BASE_MIN_PX_PER_NT) return 'ticks'
  return 'bases'
}

function indicesToRanges(indices: readonly number[]): Array<{ from: number; to: number }> {
  if (indices.length === 0) return []
  const ranges: Array<{ from: number; to: number }> = []
  let from = indices[0]
  let previous = indices[0]
  for (let offset = 1; offset < indices.length; offset += 1) {
    const index = indices[offset]
    if (index !== previous + 1) {
      ranges.push({ from, to: previous + 1 })
      from = index
    }
    previous = index
  }
  ranges.push({ from, to: previous + 1 })
  return ranges
}

function plannedTicks(candidate: Candidate): PlannedTick[] {
  const stride = Math.max(1, Math.ceil(6 / Math.max(candidate.plan.projectedSpacing, 1e-9)))
  return candidate.visibleIndices
    .filter((index) => index % stride === 0)
    .map((index) => ({
      index,
      ...candidate.sampler.pointAt(index),
      tangent: candidate.sampler.tangentAt(index),
    }))
}

function plannedBases(candidate: Candidate): PlannedBase[] {
  return candidate.visibleIndices.map((index) => ({
    index,
    base: candidate.strand.sequence[index],
    ...candidate.sampler.pointAt(index),
  }))
}

function annotationPlan(
  strand: RnaStrand,
  sampler: ReturnType<typeof createLayoutSampler>,
  visibleIndices: readonly number[],
): PlannedAnnotation[] {
  if (visibleIndices.length === 0) return []
  const first = visibleIndices[0]
  const last = visibleIndices[visibleIndices.length - 1]
  return strand.annotations
    .filter((annotation) => annotation.end > first && annotation.start <= last)
    .map((annotation) => {
      const from = Math.max(0, Math.min(annotation.start, strand.sequence.length - 1))
      const to = Math.max(from, Math.min(annotation.end - 1, strand.sequence.length - 1))
      const start = sampler.pointAt(from)
      const end = sampler.pointAt(to)
      return {
        id: annotation.id,
        label: annotation.label,
        type: annotation.type,
        colorToken: annotation.colorToken,
        from: annotation.start,
        to: annotation.end,
        start,
        end,
        path: overlayPath(sampler, from, to + 1),
        bounds: {
          minX: Math.min(start.x, end.x),
          minY: Math.min(start.y, end.y),
          maxX: Math.max(start.x, end.x),
          maxY: Math.max(start.y, end.y),
        },
      }
    })
}

/**
 * A world-space polyline through the sampled base positions of [from, to)
 * so range overlays follow the strand's actual shape instead of cutting
 * straight between endpoints. Decimated to at most ~64 samples.
 */
function overlayPath(
  sampler: ReturnType<typeof createLayoutSampler>,
  from: number,
  toExclusive: number,
): string {
  const count = Math.max(1, toExclusive - from)
  const stride = Math.max(1, Math.ceil(count / 64))
  const parts: string[] = []
  for (let index = from; index < toExclusive; index += stride) {
    const point = sampler.pointAt(index)
    parts.push(`${parts.length === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
  }
  const last = sampler.pointAt(toExclusive - 1)
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}

function highlightPlan(
  strand: RnaStrand,
  sampler: ReturnType<typeof createLayoutSampler>,
  ranges: readonly HighlightRange[],
): PlannedHighlight[] {
  if (strand.sequence.length === 0) return []
  const out: PlannedHighlight[] = []
  for (const range of ranges) {
    if (range.strandId !== strand.id) continue
    const from = Math.max(0, range.from)
    const to = Math.min(strand.sequence.length, range.to)
    if (from >= to) continue
    out.push({ from, to, kind: range.kind ?? 'paired', path: overlayPath(sampler, from, to) })
  }
  return out
}

function prominence(candidate: Candidate): number {
  if (candidate.selected) return 1_000
  if (candidate.strand.role === 'target') return 20
  if (candidate.strand.role === 'construct') return 10
  return 0
}

export function buildRenderPlan(
  workspace: Workspace,
  size: Size,
  options: RenderPlanOptions = {},
): CanvasRenderPlan {
  const visibleBounds = visibleWorldBounds(workspace.viewport, size)
  const selected = new Set(options.selectedStrandIds ?? [])
  const layoutOptions: LayoutOptions = {
    perRow: options.perRow,
    rowGap: options.rowGap,
    tolerance: options.tolerance,
  }
  const candidates: Candidate[] = []

  for (const strand of workspace.strands) {
    const sampler = createLayoutSampler(strand, layoutOptions)
    const chunks = buildSpatialIndex(strand, layoutOptions)
    const fullPath = worldPath(strand, sampler.path)
    const exactPathBounds = pathBounds(fullPath)
    const bounds = unionBounds([...chunks.map((chunk) => chunk.bounds), exactPathBounds])!
    if (!boundsIntersect(bounds, visibleBounds)) continue

    const visibleIndices: number[] = []
    for (const chunk of chunks) {
      if (!boundsIntersect(chunk.bounds, visibleBounds)) continue
      for (let index = chunk.from; index < chunk.to; index += 1) {
        const point = sampler.pointAt(index)
        if (
          point.x >= visibleBounds.minX && point.x <= visibleBounds.maxX
          && point.y >= visibleBounds.minY && point.y <= visibleBounds.maxY
        ) visibleIndices.push(index)
      }
    }

    const projectedSpacing = sampler.spacing * workspace.viewport.zoom
    const lod = lodFor(projectedSpacing)
    // Overview LOD only needs to look like the rope, not trace every point —
    // decimate so consecutive kept points project to at least 2px apart.
    let renderedPath = fullPath
    if (strand.layout.mode === 'rope' && lod === 'overview') {
      const stride = Math.max(1, Math.floor(2 / Math.max(projectedSpacing, 1e-9)))
      if (stride > 1) renderedPath = worldPath(strand, catmullRomPath(strand.layout.points, strand.id, stride))
    }
    const start = sampler.pointAt(0)
    const end = sampler.pointAt(Math.max(0, strand.sequence.length - 1))
    const plan: StrandRenderPlan = {
      strandId: strand.id,
      name: strand.name,
      sequenceLength: strand.sequence.length,
      role: strand.role,
      renderMode: strand.renderMode,
      orientation: strand.orientation,
      lod,
      projectedSpacing,
      path: pathToSvg(renderedPath),
      pathPoints: renderedPath,
      visibleRanges: indicesToRanges(visibleIndices),
      tickIndices: [],
      ticks: [],
      bases: [],
      annotations: annotationPlan(strand, sampler, visibleIndices),
      highlights: highlightPlan(strand, sampler, options.highlightRanges ?? []),
      bounds,
      start,
      end,
    }
    const candidate: Candidate = {
      strand,
      sampler,
      plan,
      visibleIndices,
      selected: selected.has(strand.id),
    }
    if (lod === 'bases') plan.bases = plannedBases(candidate)
    else if (lod === 'ticks') {
      plan.ticks = plannedTicks(candidate)
      plan.tickIndices = plan.ticks.map((tick) => tick.index)
    }
    candidates.push(candidate)
  }

  let baseGlyphCount = candidates.reduce((sum, candidate) => sum + candidate.plan.bases.length, 0)
  const downgradeOrder = [...candidates]
    .filter((candidate) => candidate.plan.lod === 'bases')
    .sort((a, b) => prominence(a) - prominence(b) || a.strand.id.localeCompare(b.strand.id))
  for (const candidate of downgradeOrder) {
    if (baseGlyphCount <= MAX_BASE_GLYPHS) break
    if (candidate.selected && baseGlyphCount - candidate.plan.bases.length <= MAX_BASE_GLYPHS) continue
    baseGlyphCount -= candidate.plan.bases.length
    candidate.plan.bases = []
    candidate.plan.lod = 'ticks'
    candidate.plan.ticks = plannedTicks(candidate)
    candidate.plan.tickIndices = candidate.plan.ticks.map((tick) => tick.index)
  }

  if (baseGlyphCount > MAX_BASE_GLYPHS) {
    for (const candidate of candidates.filter((value) => value.plan.lod === 'bases')) {
      const allowance = Math.max(0, MAX_BASE_GLYPHS - (baseGlyphCount - candidate.plan.bases.length))
      if (candidate.plan.bases.length > allowance) {
        baseGlyphCount -= candidate.plan.bases.length - allowance
        candidate.plan.bases = candidate.plan.bases.slice(0, allowance)
      }
      if (baseGlyphCount <= MAX_BASE_GLYPHS) break
    }
  }

  const strands = candidates.map((candidate) => candidate.plan)
  const candidateById = new Map(candidates.map((candidate) => [candidate.strand.id, candidate]))
  const duplexes: PlannedDuplex[] = workspace.duplexes.flatMap((duplex) => {
    const a = candidateById.get(duplex.a.strandId)
    const b = candidateById.get(duplex.b.strandId)
    if (!a || !b) return []
    const aIndex = (duplex.a.start + Math.max(duplex.a.start, duplex.a.end - 1)) / 2
    const bIndex = (duplex.b.start + Math.max(duplex.b.start, duplex.b.end - 1)) / 2
    const start = a.sampler.pointAt(aIndex)
    const end = b.sampler.pointAt(bIndex)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.hypot(dx, dy)
    const bend = Math.min(40, distance * 0.2)
    const normal = distance === 0 ? { x: 0, y: -1 } : { x: -dy / distance, y: dx / distance }
    const control1 = {
      x: start.x + dx / 3 + normal.x * bend,
      y: start.y + dy / 3 + normal.y * bend,
    }
    const control2 = {
      x: start.x + dx * 2 / 3 + normal.x * bend,
      y: start.y + dy * 2 / 3 + normal.y * bend,
    }
    return [{
      id: duplex.id,
      role: duplex.role,
      state: duplex.state,
      aStrandId: duplex.a.strandId,
      bStrandId: duplex.b.strandId,
      path: `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`,
      start,
      end,
      bounds: {
        minX: Math.min(start.x, end.x, control1.x, control2.x),
        minY: Math.min(start.y, end.y, control1.y, control2.y),
        maxX: Math.max(start.x, end.x, control1.x, control2.x),
        maxY: Math.max(start.y, end.y, control1.y, control2.y),
      },
    }]
  })
  const sceneElementCount = strands.reduce(
    (sum, strand) => sum + 1 + strand.bases.length + strand.annotations.length + (strand.ticks.length > 0 ? 1 : 0),
    0,
  ) + duplexes.length
  return { visibleBounds, strands, duplexes, baseGlyphCount, sceneElementCount }
}
