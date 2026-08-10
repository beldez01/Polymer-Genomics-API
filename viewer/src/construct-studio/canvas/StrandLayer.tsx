import type { MouseEvent } from 'react'
import type { HighlightKind, StrandRenderPlan } from './renderPlan'
import type { BaseRange } from './selection'

const HIGHLIGHT_ATTRIBUTE: Record<HighlightKind, string> = {
  paired: 'data-paired-range',
  selection: 'data-selection-range',
  match: 'data-match-range',
  lint: 'data-lint-range',
}

export interface StrandLayerProps {
  strands: readonly StrandRenderPlan[]
  selectedStrandIds: readonly string[]
  zoom: number
  onStrandSelect?: (strandId: string, event: MouseEvent<SVGElement>) => void
  onBaseSelect?: (strandId: string, index: number, event: MouseEvent<SVGElement>) => void
  baseRange?: BaseRange | null
}

function tickPath(strand: StrandRenderPlan, zoom: number): string {
  const halfLength = 3 / zoom
  return strand.ticks.map((tick) => {
    const normal = { x: -tick.tangent.y, y: tick.tangent.x }
    return `M ${tick.x - normal.x * halfLength} ${tick.y - normal.y * halfLength} L ${tick.x + normal.x * halfLength} ${tick.y + normal.y * halfLength}`
  }).join(' ')
}

function strandLabel(strand: StrandRenderPlan, selected: boolean): string {
  return [
    strand.name,
    `${strand.sequenceLength} nucleotides`,
    strand.role,
    strand.renderMode,
    selected ? 'selected' : 'not selected',
  ].join(', ')
}

export function StrandLayer({
  strands,
  selectedStrandIds,
  zoom,
  onStrandSelect,
  onBaseSelect,
  baseRange,
}: StrandLayerProps) {
  const selected = new Set(selectedStrandIds)
  return <g className="strand-layer" aria-label="RNA strands">
    {strands.map((strand) => {
      const isSelected = selected.has(strand.strandId)
      const startLabel = strand.orientation === '5to3' ? '5′' : '3′'
      const endLabel = strand.orientation === '5to3' ? '3′' : '5′'
      const label = strandLabel(strand, isSelected)
      return <g
        key={strand.strandId}
        className={`strand ${isSelected ? 'selected' : ''}`}
        data-strand-id={strand.strandId}
      >
        <path
          data-strand-hit={strand.strandId}
          className="strand-hit"
          d={strand.path}
          fill="none"
          stroke="transparent"
          strokeWidth={18 / zoom}
          pointerEvents="stroke"
          aria-hidden="true"
          onClick={(event) => onStrandSelect?.(strand.strandId, event)}
        />
        <path
          data-strand-path={strand.strandId}
          className="strand-path"
          d={strand.path}
          fill="none"
          vectorEffect="non-scaling-stroke"
          role="button"
          tabIndex={0}
          aria-label={label}
          aria-selected={isSelected}
          onClick={(event) => onStrandSelect?.(strand.strandId, event)}
        />
        {strand.ticks.length > 0 && <path
          className="strand-ticks"
          d={tickPath(strand, zoom)}
          fill="none"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />}
        {strand.highlights.map((highlight) => <path
          key={`${highlight.kind}-${highlight.from}-${highlight.to}`}
          {...{
            [HIGHLIGHT_ATTRIBUTE[highlight.kind]]: `${strand.strandId}:${highlight.from}-${highlight.to}`,
          }}
          className={`${highlight.kind}-highlight`}
          d={highlight.path}
          fill="none"
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
        />)}
        {strand.bases.map((base) => {
          const ambiguous = !'ACGU'.includes(base.base.toUpperCase())
          const inRange = baseRange?.strandId === strand.strandId
            && base.index >= Math.min(baseRange.anchor, baseRange.focus)
            && base.index <= Math.max(baseRange.anchor, baseRange.focus)
          return <g
            key={base.index}
            data-base-index={base.index}
            data-strand-id={strand.strandId}
            className={`rna-base ${ambiguous ? 'ambiguous' : `base-${base.base.toUpperCase()}`} ${inRange ? 'selected-range' : ''}`}
            transform={`translate(${base.x} ${base.y}) scale(${1 / zoom})`}
            role="button"
            tabIndex={-1}
            aria-label={`${strand.name}, base ${base.index + 1}, ${base.base}`}
            onClick={(event) => {
              event.stopPropagation()
              onBaseSelect?.(strand.strandId, base.index, event)
            }}
          >
            {/* Glyph coordinates are screen pixels: the scale(1/zoom) wrapper
                keeps text rendering at a real font size, so labels stay
                centered instead of drifting at extreme zoom ratios. */}
            <circle r={6} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={9}>{base.base}</text>
          </g>
        })}
        <text
          data-end="start"
          x={strand.start.x}
          y={strand.start.y - 10 / zoom}
          className="strand-end"
          fontSize={9 / zoom}
          textAnchor="middle"
        >{startLabel}</text>
        <text
          data-end="end"
          x={strand.end.x}
          y={strand.end.y - 10 / zoom}
          className="strand-end"
          fontSize={9 / zoom}
          textAnchor="middle"
        >{endLabel}</text>
      </g>
    })}
  </g>
}
