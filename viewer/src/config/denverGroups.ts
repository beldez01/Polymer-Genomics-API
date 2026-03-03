/**
 * Denver classification of human chromosomes (Groups A–G)
 * Based on size and centromere position.
 */

export interface DenverGroup {
  label: string;
  description: string;
  chromosomes: string[];
}

export const DENVER_GROUPS: DenverGroup[] = [
  { label: 'A', description: 'Large metacentric',       chromosomes: ['chr1', 'chr2', 'chr3'] },
  { label: 'B', description: 'Large submetacentric',    chromosomes: ['chr4', 'chr5'] },
  { label: 'C', description: 'Medium submetacentric',   chromosomes: ['chr6', 'chr7', 'chr8', 'chr9', 'chr10', 'chr11', 'chr12', 'chrX'] },
  { label: 'D', description: 'Medium acrocentric',      chromosomes: ['chr13', 'chr14', 'chr15'] },
  { label: 'E', description: 'Small submetacentric',    chromosomes: ['chr16', 'chr17', 'chr18'] },
  { label: 'F', description: 'Small metacentric',       chromosomes: ['chr19', 'chr20'] },
  { label: 'G', description: 'Small acrocentric',       chromosomes: ['chr21', 'chr22', 'chrY'] },
];

export type CentromereType = 'metacentric' | 'submetacentric' | 'acrocentric';

/**
 * Determine centromere type from p-arm / total length ratio.
 * metacentric: centromere near middle (ratio 0.35–0.50)
 * submetacentric: centromere offset (ratio 0.15–0.35)
 * acrocentric: centromere near end (ratio < 0.15)
 */
export function getCentromereType(centromereStart: number, centromereEnd: number, chrLength: number): CentromereType {
  if (chrLength === 0) return 'metacentric';
  const centromereMid = (centromereStart + centromereEnd) / 2;
  const ratio = centromereMid / chrLength;
  if (ratio >= 0.35) return 'metacentric';
  if (ratio >= 0.15) return 'submetacentric';
  return 'acrocentric';
}

export function getDenverGroupForChromosome(chrName: string): DenverGroup | undefined {
  return DENVER_GROUPS.find(g => g.chromosomes.includes(chrName));
}
