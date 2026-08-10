import { createLayoutSampler } from './layout'
import type { CanvasPoint, RnaStrand, StrandLayout } from './types'

export function ropeRest(strand: RnaStrand): number {
  return strand.ntPerUnit
}

/** Sample the strand's current layout one point per nucleotide, strand-local. */
export function seedRopeLayout(strand: RnaStrand): { mode: 'rope'; points: CanvasPoint[] } {
  const sampler = createLayoutSampler(strand)
  const points: CanvasPoint[] = []
  for (let index = 0; index < strand.sequence.length; index += 1) {
    const world = sampler.pointAt(index)
    points.push({ x: world.x - strand.placement.x, y: world.y - strand.placement.y })
  }
  return { mode: 'rope', points }
}

/** Development guard for invariant R1. */
export function assertRope(strand: RnaStrand): void {
  if (strand.layout.mode !== 'rope') return
  if (strand.layout.points.length !== strand.sequence.length) {
    throw new Error(
      `R1 violated for ${strand.id}: ${strand.layout.points.length} points, ` +
        `${strand.sequence.length} nt`,
    )
  }
}

export function isRope(layout: StrandLayout): layout is { mode: 'rope'; points: CanvasPoint[] } {
  return layout.mode === 'rope'
}
