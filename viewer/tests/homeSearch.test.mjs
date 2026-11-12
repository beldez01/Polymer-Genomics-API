import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHomeQuery } from '../src/lib/homeSearch.ts';

test('gene symbols normalize case while retaining legitimate punctuation', () => {
  for (const [input, query] of [[' tp53 ', 'TP53'], ['HLA-A', 'HLA-A'], ['C12orf57', 'C12ORF57']]) {
    assert.deepEqual(parseHomeQuery(input), { kind: 'gene', query });
  }
});
test('closed intervals normalize chromosome case and thousands separators without shifting bases', () => {
  for (const [input, region] of [['chr17:7,668,421-7,687,490', 'chr17:7668421-7687490'], [' X : 1 - 1 ', 'chrX:1-1'], ['MT:10-20', 'chrM:10-20']]) {
    assert.deepEqual(parseHomeQuery(input), { kind: 'region', region });
  }
});
test('malformed intervals and unsupported identifiers do not become gene searches', () => {
  for (const input of ['', 'rs123', 'chr23:1-2', 'chr17:0-20', 'chr17:20-10', 'chr17:1.5-20', 'chr17:1,2-20', 'chr17:1-999999999999999999', 'chr17:1-300000001', '<script>', 'TP53/BRCA1']) {
    assert.throws(() => parseHomeQuery(input), Error, input);
  }
});
