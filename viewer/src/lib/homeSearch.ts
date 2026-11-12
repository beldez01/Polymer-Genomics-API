/** Homepage search accepts human gene symbols or 1-based, closed intervals. */
export type SearchBuild = 'hg38' | 'hg37';
export const SEARCH_ASSEMBLIES: { value: SearchBuild; label: string }[] = [
  { value: 'hg38', label: 'GRCh38 / hg38' },
  { value: 'hg37', label: 'GRCh37 / hg19' },
];

export function parseHomeQuery(input: string): { kind: 'region'; region: string } | { kind: 'gene'; query: string } {
  const text = input.trim();
  if (/^rs\d+$/i.test(text)) throw new Error('Search by gene symbol or genomic coordinates. Variant ID lookup is not available here.');
  if (/[:\s,]/.test(text) || /^chr\d/i.test(text)) {
    const match = text.match(/^(?:chr)?([1-9]|1\d|2[0-2]|X|Y|M|MT)\s*:\s*(\d{1,3}(?:,\d{3})+|\d+)\s*-\s*(\d{1,3}(?:,\d{3})+|\d+)$/i);
    if (!match) throw new Error('Enter an interval such as chr17:7,668,421-7,687,490.');
    const start = Number(match[2].replaceAll(',', ''));
    const end = Number(match[3].replaceAll(',', ''));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > 300_000_000) {
      throw new Error('Use positive whole-number coordinates with the end at or after the start (up to 300,000,000).');
    }
    const chr = match[1].toUpperCase().replace('MT', 'M');
    return { kind: 'region', region: `chr${chr}:${start}-${end}` };
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,99}$/i.test(text)) throw new Error('Enter a gene symbol such as TP53 or BRCA1.');
  return { kind: 'gene', query: text.toUpperCase() };
}
