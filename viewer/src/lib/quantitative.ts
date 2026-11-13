/** Numeric zero is a value; missing/nonfinite values remain gaps. */
export function finiteExtent(values: unknown[]): { min: number; max: number; count: number } | null {
  let min = Infinity, max = -Infinity, count = 0;
  for (const value of values) if (typeof value === 'number' && Number.isFinite(value)) {
    min = Math.min(min, value); max = Math.max(max, value); count++;
  }
  return count ? { min, max, count } : null;
}
export function gcWindow(sequence: string, start: number, end: number): number | null {
  let gc = 0, callable = 0;
  for (let i = start; i < Math.min(sequence.length, end); i++) {
    const base = sequence[i].toUpperCase();
    if ('ACGT'.includes(base)) { callable++; if (base === 'G' || base === 'C') gc++; }
  }
  return callable ? gc / callable : null;
}

/** Summarize dense samples in genomic display bins, bounded by screen resolution.
 * Missing bins remain null; minima/maxima are retained for interpretation.
 */
export function displaySeries(values: unknown[], starts: number[], ends: number[], viewStart: number, viewEnd: number, pixels: number) {
  const span = viewEnd - viewStart + 1;
  const binCount = Math.max(1, Math.min(span, Math.floor(pixels / 3)));
  const bins: { sum: number; count: number; min: number; max: number; position: number }[] =
    Array.from({ length: binCount }, () => ({ sum: 0, count: 0, min: Infinity, max: -Infinity, position: 0 }));
  let count = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (ends[i] < viewStart || starts[i] > viewEnd || typeof value !== 'number' || !Number.isFinite(value)) continue;
    const position = Math.max(viewStart, Math.min(viewEnd, (starts[i] + ends[i]) / 2));
    const index = Math.min(binCount - 1, Math.floor((position - viewStart) / span * binCount));
    const bin = bins[index];
    bin.sum += value; bin.count++; bin.position += position; bin.min = Math.min(bin.min, value); bin.max = Math.max(bin.max, value);
    min = Math.min(min, value); max = Math.max(max, value); count++;
  }
  const points = bins.map(bin => bin.count ? { value: bin.sum / bin.count, position: bin.position / bin.count, min: bin.min, max: bin.max, count: bin.count } : null);
  const extent = finiteExtent(points.map(point => point?.value));
  return { points, extent, count, rawMin: count ? min : null, rawMax: count ? max : null, binBp: span / binCount, aggregated: bins.some(bin => bin.count > 1) };
}
