import reference from '../config/referenceContigs.json';

export type GenomeBuild = 'hg37' | 'hg38';
export function contigLength(build: GenomeBuild, chr: string): number | undefined {
  return (reference.lengths[build] as Record<string, number>)[chr];
}
export function normalizeContig(input: string): string {
  const name = input.replace(/^chr/i, '').toUpperCase();
  return `chr${name === 'MT' ? 'M' : name}`;
}
/** Preserve requested width while moving a navigation window inside the contig. */
export function boundedRegion(build: GenomeBuild, chr: string, start: number, end: number) {
  const length = contigLength(build, chr);
  if (!length || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const width = Math.min(length, Math.max(1, Math.round(end) - Math.round(start) + 1));
  const s = Math.max(1, Math.min(length - width + 1, Math.round(start)));
  return { chr, start: s, end: s + width - 1, width };
}
export function validRegion(build: GenomeBuild, chr: string, start: number, end: number): boolean {
  const length = contigLength(build, chr);
  return !!length && Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 1 && end >= start && end <= length;
}
