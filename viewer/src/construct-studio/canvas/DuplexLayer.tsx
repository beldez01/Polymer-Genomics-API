import type { PlannedDuplex } from './renderPlan'

export function DuplexLayer({ duplexes }: { duplexes: readonly PlannedDuplex[] }) {
  return <g className="duplex-layer" aria-label="RNA relationships">
    {duplexes.map((duplex) => <path
      key={duplex.id}
      data-duplex-id={duplex.id}
      data-duplex-role={duplex.role}
      className={`duplex duplex-${duplex.role}`}
      d={duplex.path}
      fill="none"
      vectorEffect="non-scaling-stroke"
      aria-label={`${duplex.role} duplex between strands ${duplex.aStrandId} and ${duplex.bStrandId}`}
    />)}
  </g>
}
