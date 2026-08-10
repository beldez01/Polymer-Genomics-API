import type { CanvasPoint, Viewport } from '../model/types'
import { MAX_ZOOM, MIN_ZOOM, OVERSCAN_RATIO } from './constants'

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return zoom > 0 ? MAX_ZOOM : MIN_ZOOM
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function worldToScreen(point: CanvasPoint, viewport: Viewport): CanvasPoint {
  return {
    x: (point.x - viewport.x) * viewport.zoom,
    y: (point.y - viewport.y) * viewport.zoom,
  }
}

export function screenToWorld(point: CanvasPoint, viewport: Viewport): CanvasPoint {
  const zoom = clampZoom(viewport.zoom)
  return {
    x: viewport.x + point.x / zoom,
    y: viewport.y + point.y / zoom,
  }
}

/** Move the document with the pointer, like grabbing a sheet of paper. */
export function panByScreen(viewport: Viewport, dx: number, dy: number): Viewport {
  const zoom = clampZoom(viewport.zoom)
  return {
    x: viewport.x - dx / zoom,
    y: viewport.y - dy / zoom,
    zoom,
  }
}

export function zoomAt(
  viewport: Viewport,
  cursor: CanvasPoint,
  factor: number,
): Viewport {
  const before = screenToWorld(cursor, viewport)
  const nextZoom = clampZoom(viewport.zoom * factor)
  return {
    x: before.x - cursor.x / nextZoom,
    y: before.y - cursor.y / nextZoom,
    zoom: nextZoom,
  }
}

export function visibleWorldBounds(
  viewport: Viewport,
  size: Size,
  overscan = OVERSCAN_RATIO,
): Bounds {
  const zoom = clampZoom(viewport.zoom)
  const width = Math.max(0, Number.isFinite(size.width) ? size.width : 0) / zoom
  const height = Math.max(0, Number.isFinite(size.height) ? size.height : 0) / zoom
  const ratio = Math.max(0, Number.isFinite(overscan) ? overscan : 0)
  return {
    minX: viewport.x - width * ratio,
    minY: viewport.y - height * ratio,
    maxX: viewport.x + width * (1 + ratio),
    maxY: viewport.y + height * (1 + ratio),
  }
}

export function fitBounds(bounds: Bounds, size: Size, padding = 32): Viewport {
  const minX = Math.min(bounds.minX, bounds.maxX)
  const maxX = Math.max(bounds.minX, bounds.maxX)
  const minY = Math.min(bounds.minY, bounds.maxY)
  const maxY = Math.max(bounds.minY, bounds.maxY)
  const width = Math.max(0, Number.isFinite(size.width) ? size.width : 0)
  const height = Math.max(0, Number.isFinite(size.height) ? size.height : 0)
  const safePadding = Math.max(0, Number.isFinite(padding) ? padding : 0)
  const availableWidth = Math.max(0, width - safePadding * 2)
  const availableHeight = Math.max(0, height - safePadding * 2)
  const boundsWidth = maxX - minX
  const boundsHeight = maxY - minY

  const scales = [
    boundsWidth > 0 && availableWidth > 0 ? availableWidth / boundsWidth : Infinity,
    boundsHeight > 0 && availableHeight > 0 ? availableHeight / boundsHeight : Infinity,
  ]
  const finiteScales = scales.filter(Number.isFinite)
  const zoom = clampZoom(finiteScales.length > 0 ? Math.min(...finiteScales) : 1)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    x: centerX - width / (2 * zoom),
    y: centerY - height / (2 * zoom),
    zoom,
  }
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY
}

export function unionBounds(bounds: readonly Bounds[]): Bounds | null {
  if (bounds.length === 0) return null
  return {
    minX: Math.min(...bounds.map((value) => value.minX)),
    minY: Math.min(...bounds.map((value) => value.minY)),
    maxX: Math.max(...bounds.map((value) => value.maxX)),
    maxY: Math.max(...bounds.map((value) => value.maxY)),
  }
}
