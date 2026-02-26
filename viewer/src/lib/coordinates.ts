/**
 * Coordinate conversion utilities for genomic <-> pixel mapping.
 *
 * All genomic coordinates are 1-based, closed intervals (matching the API).
 */

/**
 * Convert a 1-based genomic position to a pixel x-coordinate on a canvas.
 *
 * The viewport spans [viewStart, viewEnd] (inclusive) mapped onto [0, canvasWidth].
 * Each base occupies (canvasWidth / span) pixels. The returned value is the LEFT
 * edge of the pixel column for that base.
 */
export function genomicToPixel(
  pos: number,
  viewStart: number,
  viewEnd: number,
  canvasWidth: number,
): number {
  const span = viewEnd - viewStart + 1;
  return ((pos - viewStart) / span) * canvasWidth;
}

/**
 * Convert a pixel x-coordinate back to the nearest 1-based genomic position.
 */
export function pixelToGenomic(
  px: number,
  viewStart: number,
  viewEnd: number,
  canvasWidth: number,
): number {
  const span = viewEnd - viewStart + 1;
  return Math.round(viewStart + (px / canvasWidth) * span);
}

/**
 * Width in pixels that one base pair occupies.
 */
export function basePairWidth(
  viewStart: number,
  viewEnd: number,
  canvasWidth: number,
): number {
  const span = viewEnd - viewStart + 1;
  return canvasWidth / span;
}
