import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPOSITION_EXAMPLE, classifyComposition, compositionWindows, mergeCompositionClasses, summarizeComposition } from '../src/lib/libraryComposition.ts';

test('callable-base GC distinguishes ambiguity, true zero, and missing data', () => {
  assert.deepEqual(summarizeComposition('acgt NN gc at'), { total: 10, callable: 8, gc: 4, gcPercent: 50, callablePercent: 80 });
  assert.deepEqual(summarizeComposition('AATT'), { total: 4, callable: 4, gc: 0, gcPercent: 0, callablePercent: 100 });
  assert.deepEqual(summarizeComposition('NNRY'), { total: 4, callable: 0, gc: 0, gcPercent: null, callablePercent: 0 });
  assert.deepEqual(summarizeComposition(''), { total: 0, callable: 0, gc: 0, gcPercent: null, callablePercent: null });
});

test('windows retain closed coordinates, partial tails, and no-call intervals', () => {
  const windows = compositionWindows('GGNNATCCN', 4);
  assert.deepEqual(windows.map(({ start, end, callable, gc, gcPercent }) => ({ start, end, callable, gc, gcPercent })), [
    { start: 1, end: 4, callable: 2, gc: 2, gcPercent: 100 },
    { start: 5, end: 8, callable: 4, gc: 2, gcPercent: 50 },
    { start: 9, end: 9, callable: 0, gc: 0, gcPercent: null },
  ]);
  assert.deepEqual(compositionWindows('', 100), []);
  for (const size of [0, -1, 1.5, Infinity, NaN]) assert.throws(() => compositionWindows('ACGT', size), RangeError);
});

test('pooled counts weight callable bases rather than averaging percentages', () => {
  const first = summarizeComposition('GGGGGGGGAA');
  const second = summarizeComposition('ATNNNNNNNN');
  const pooled = summarizeComposition('GGGGGGGGAAATNNNNNNNN');
  assert.equal((first.gcPercent + second.gcPercent) / 2, 40);
  assert.ok(Math.abs(pooled.gcPercent - 66.66666666666667) < 1e-10);
  assert.equal(pooled.gc, 8);
  assert.equal(pooled.callable, 12);
});

test('class boundaries are explicit and undefined values remain unclassified', () => {
  for (const [value, expected] of [[0, 'L1'], [36.999, 'L1'], [37, 'L2'], [40.999, 'L2'], [41, 'H1'], [45.999, 'H1'], [46, 'H2'], [52.999, 'H2'], [53, 'H3'], [100, 'H3']]) assert.equal(classifyComposition(value), expected);
  for (const value of [null, -1, 101, Infinity, NaN]) assert.equal(classifyComposition(value), null);
});

test('the teaching sequence has exact counts and coarse windows conceal its extremes', () => {
  assert.deepEqual(summarizeComposition(COMPOSITION_EXAMPLE), { total: 1200, callable: 1200, gc: 600, gcPercent: 50, callablePercent: 100 });
  assert.deepEqual(compositionWindows(COMPOSITION_EXAMPLE, 100).map(window => window.gc), [30, 34, 32, 68, 72, 66, 42, 46, 44, 54, 58, 54]);
  assert.deepEqual(compositionWindows(COMPOSITION_EXAMPLE, 300).map(window => window.gc), [96, 206, 132, 166]);
  assert.deepEqual(compositionWindows(COMPOSITION_EXAMPLE, 600).map(window => window.gc), [302, 298]);
  assert.equal(compositionWindows(COMPOSITION_EXAMPLE, 1200)[0].gcPercent, 50);
  for (const size of [100, 300, 600, 1200]) {
    const windows = compositionWindows(COMPOSITION_EXAMPLE, size);
    assert.equal(windows.reduce((sum, window) => sum + window.gc, 0), 600);
    assert.equal(windows.reduce((sum, window) => sum + window.callable, 0), 1200);
  }
});

test('merging is restricted to contiguous same-class windows', () => {
  assert.deepEqual(mergeCompositionClasses(compositionWindows('GGCCGGCC', 4)), [{ start: 1, end: 8, klass: 'H3' }]);
  assert.deepEqual(mergeCompositionClasses(compositionWindows('GGGGAAAA', 4)), [{ start: 1, end: 4, klass: 'H3' }, { start: 5, end: 8, klass: 'L1' }]);
  const separated = compositionWindows('GGCCGGCC', 4);
  separated[1].start = 6;
  separated[1].end = 9;
  assert.equal(mergeCompositionClasses(separated).length, 2);
  assert.deepEqual(mergeCompositionClasses([]), []);
  assert.equal(mergeCompositionClasses(compositionWindows(COMPOSITION_EXAMPLE, 100)).length, 6);
  assert.equal(mergeCompositionClasses(compositionWindows(COMPOSITION_EXAMPLE, 300)).length, 4);
  assert.equal(mergeCompositionClasses(compositionWindows(COMPOSITION_EXAMPLE, 600)).length, 1);
});
