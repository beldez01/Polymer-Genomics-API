/** Pure calculations for labeled synthetic teaching examples, not API data. */
export type CompositionClass = 'L1' | 'L2' | 'H1' | 'H2' | 'H3';
export interface CompositionSummary {
  total: number;
  callable: number;
  gc: number;
  gcPercent: number | null;
  callablePercent: number | null;
}
export interface CompositionWindow extends CompositionSummary {
  start: number;
  end: number;
}

export function summarizeComposition(sequence: string): CompositionSummary {
  const bases = sequence.replace(/\s/g, '').toUpperCase();
  let callable = 0, gc = 0;
  for (const base of bases) {
    if (base === 'G' || base === 'C') { gc++; callable++; }
    else if (base === 'A' || base === 'T') callable++;
  }
  return {
    total: bases.length, callable, gc,
    gcPercent: callable > 0 ? 100 * gc / callable : null,
    callablePercent: bases.length > 0 ? 100 * callable / bases.length : null,
  };
}

export function compositionWindows(sequence: string, windowSize: number): CompositionWindow[] {
  if (!Number.isInteger(windowSize) || windowSize <= 0) throw new RangeError('Window size must be a positive integer.');
  const bases = sequence.replace(/\s/g, '').toUpperCase();
  const windows: CompositionWindow[] = [];
  for (let offset = 0; offset < bases.length; offset += windowSize) {
    const end = Math.min(bases.length, offset + windowSize);
    windows.push({ start: offset + 1, end, ...summarizeComposition(bases.slice(offset, end)) });
  }
  return windows;
}

/** Matches the thresholds in ingest/isochores.py; no domain segmentation implied. */
export function classifyComposition(gcPercent: number | null): CompositionClass | null {
  if (gcPercent === null || !Number.isFinite(gcPercent) || gcPercent < 0 || gcPercent > 100) return null;
  if (gcPercent < 37) return 'L1';
  if (gcPercent < 41) return 'L2';
  if (gcPercent < 46) return 'H1';
  if (gcPercent < 53) return 'H2';
  return 'H3';
}

export function mergeCompositionClasses(windows: CompositionWindow[]): { start: number; end: number; klass: CompositionClass | null }[] {
  const runs: { start: number; end: number; klass: CompositionClass | null }[] = [];
  for (const window of windows) {
    const klass = classifyComposition(window.gcPercent);
    const last = runs[runs.length - 1];
    if (last && last.end + 1 === window.start && last.klass === klass) last.end = window.end;
    else runs.push({ start: window.start, end: window.end, klass });
  }
  return runs;
}

// Twelve 100-base blocks with deliberately chosen G/C counts. Total: 600/1,200.
// Within-block ordering is arbitrary and carries no biological interpretation.
const EXAMPLE_BLOCK_GC = [30, 34, 32, 68, 72, 66, 42, 46, 44, 54, 58, 54];
export const COMPOSITION_EXAMPLE = EXAMPLE_BLOCK_GC.map(count =>
  'GC'.repeat(Math.ceil(count / 2)).slice(0, count) +
  'AT'.repeat(Math.ceil((100 - count) / 2)).slice(0, 100 - count),
).join('');
