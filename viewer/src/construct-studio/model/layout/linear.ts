import type { RnaStrand } from '../types'

export interface LayoutResult {
  from: number
  to: number
  xs: Float32Array
  ys: Float32Array
}

export function clampRange(strand: RnaStrand, from: number, to: number): { from: number; to: number } {
  const clampedFrom = Math.max(0, Math.min(from, strand.sequence.length))
  const clampedTo = Math.max(clampedFrom, Math.min(to, strand.sequence.length))
  return { from: clampedFrom, to: clampedTo }
}

export function layoutLinear(strand: RnaStrand, from: number, to: number): LayoutResult {
  const range = clampRange(strand, from, to)
  const length = range.to - range.from
  const xs = new Float32Array(length)
  const ys = new Float32Array(length)

  for (let offset = 0; offset < length; offset += 1) {
    xs[offset] = strand.placement.x + (range.from + offset) * strand.ntPerUnit
    ys[offset] = strand.placement.y
  }

  return { ...range, xs, ys }
}
