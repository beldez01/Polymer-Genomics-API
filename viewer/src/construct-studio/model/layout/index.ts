import type { RnaStrand } from '../types'
import { layoutLinear, type LayoutResult } from './linear'
import { layoutSerpentine } from './serpentine'
import { createLayoutSampler, type LayoutOptions } from './sampler'

export { layoutLinear, layoutSerpentine }
export type { LayoutResult }
export * from './curve'
export * from './path'
export * from './sampler'
export * from './catmullRom'

/** Return positions for a range of bases, derived from the model or its manual override. */
export function layoutRange(
  strand: RnaStrand,
  from: number,
  to: number,
  options: LayoutOptions = {},
): LayoutResult {
  return createLayoutSampler(strand, options).range(from, to)
}
