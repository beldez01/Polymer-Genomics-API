import type { StrandRenderPlan } from './renderPlan'

export function AnnotationLayer({ strands }: { strands: readonly StrandRenderPlan[] }) {
  return <g className="annotation-layer" aria-label="Sequence annotations">
    {strands.flatMap((strand) => strand.annotations.map((annotation) =>
      <g
        key={`${strand.strandId}:${annotation.id}`}
        data-annotation-id={annotation.id}
        data-color-token={annotation.colorToken}
        className={`annotation annotation-${annotation.type} annotation-token-${annotation.colorToken}`}
        aria-label={`${annotation.label}, bases ${annotation.from + 1} through ${annotation.to}`}
      >
        <path
          d={annotation.path}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        <title>{annotation.label}</title>
      </g>,
    ))}
  </g>
}
