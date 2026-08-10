import type { RnaStrand } from '../model/types'

export interface GeometryPermission {
  allowed: boolean
  reason?: string
}

export function geometryPermission(strand: RnaStrand): GeometryPermission {
  if (strand.locked.geometry) {
    return { allowed: false, reason: `Geometry is locked for ${strand.name}` }
  }
  return { allowed: true }
}
