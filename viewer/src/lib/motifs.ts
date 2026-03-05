export interface Motif {
  name: string;
  start: number; // genomic coordinate
  end: number;   // genomic coordinate (inclusive)
  strand: '+' | '-';
  color: string;
}

interface MotifDef {
  name: string;
  pattern: RegExp;
  color: string;
  rcPattern?: RegExp; // reverse complement pattern
}

const MOTIF_DEFS: MotifDef[] = [
  {
    name: 'TATA Box',
    pattern: /TATA[AT]A[AT]/gi,
    color: '#F59E0B',
  },
  {
    name: 'Start Codon',
    pattern: /ATG/gi,
    color: '#22C55E',
  },
  {
    name: 'Stop Codons',
    pattern: /TAA|TAG|TGA/gi,
    color: '#EF4444',
  },
  {
    name: 'CTCF Core',
    pattern: /CCGCG[ACGT]GG[ACGT]GGCAG/gi,
    color: '#06B6D4',
  },
  {
    name: 'ERV LTR',
    pattern: /TGTGGA|AATAAAA/gi,
    color: '#F97316',
  },
];

export const MOTIF_NAMES = MOTIF_DEFS.map((d) => d.name);

function reverseComplement(seq: string): string {
  const comp: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
  return seq.split('').reverse().map((c) => comp[c.toUpperCase()] ?? 'N').join('');
}

export function scanMotifs(
  sequence: string,
  viewStart: number,
  enabledMotifs: Set<string>,
): Motif[] {
  if (!sequence || enabledMotifs.size === 0) return [];

  const results: Motif[] = [];
  const upper = sequence.toUpperCase();

  for (const def of MOTIF_DEFS) {
    if (!enabledMotifs.has(def.name)) continue;

    // Forward strand
    const fwd = new RegExp(def.pattern.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = fwd.exec(upper)) !== null) {
      results.push({
        name: def.name,
        start: viewStart + match.index,
        end: viewStart + match.index + match[0].length - 1,
        strand: '+',
        color: def.color,
      });
      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) fwd.lastIndex++;
    }

    // Reverse strand: search reverse complement
    const rc = reverseComplement(upper);
    const rev = new RegExp(def.pattern.source, 'gi');
    while ((match = rev.exec(rc)) !== null) {
      const rcStart = sequence.length - match.index - match[0].length;
      results.push({
        name: def.name,
        start: viewStart + rcStart,
        end: viewStart + rcStart + match[0].length - 1,
        strand: '-',
        color: def.color,
      });
      if (match[0].length === 0) rev.lastIndex++;
    }
  }

  return results;
}
