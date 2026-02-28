import type { GRanges } from './api';

export type GeneLocation = 'exonic' | 'intronic' | 'utr5' | 'utr3' | 'intergenic';

export interface ExonInfo {
  start: number;
  end: number;
  type: string; // 'exon' | 'CDS' | 'UTR' | 'five_prime_UTR' | 'three_prime_UTR' etc.
}

export interface TranscriptInfo {
  transcriptId: string;
  geneSymbol: string | null;
  strand: string;
  txStart: number;
  txEnd: number;
  exons: ExonInfo[];
}

export interface PositionClassification {
  location: GeneLocation;
  featureLabel: string | null; // "Exon 3", "Intron 5", "5' UTR", etc.
  geneSymbol: string | null;
  strand: string | null;
  transcriptId: string | null;
}

export interface SpliceSiteInfo {
  type: 'donor' | 'acceptor';
  distance: number;
  position: number;
}

export interface LandmarkInfo {
  symbol: string;
  distance: number;
  position: number;
}

/**
 * Group GENCODE features into transcripts with sorted exon lists.
 */
export function groupFeaturesByTranscript(data: GRanges): TranscriptInfo[] {
  const map = new Map<string, TranscriptInfo>();

  for (let i = 0; i < data.n; i++) {
    const txId = (data.mcols.transcript_id?.[i] as string) ?? null;
    const featureType = (data.mcols.feature_type?.[i] as string) ?? '';
    const symbol = (data.mcols.gene_symbol?.[i] as string) ?? null;
    const strand = data.strand[i] ?? '*';
    const start = data.ranges.start[i];
    const end = data.ranges.end[i];

    if (!txId) continue;

    let tx = map.get(txId);
    if (!tx) {
      tx = {
        transcriptId: txId,
        geneSymbol: symbol,
        strand,
        txStart: start,
        txEnd: end,
        exons: [],
      };
      map.set(txId, tx);
    }

    // Expand transcript bounds
    if (start < tx.txStart) tx.txStart = start;
    if (end > tx.txEnd) tx.txEnd = end;

    // Collect exon-like features (exon, CDS, UTR variants)
    const ft = featureType.toLowerCase();
    if (ft === 'exon' || ft === 'cds' || ft.includes('utr')) {
      tx.exons.push({ start, end, type: featureType });
    }
  }

  // Sort exons by start position within each transcript
  for (const tx of map.values()) {
    tx.exons.sort((a, b) => a.start - b.start);
  }

  return Array.from(map.values());
}

/**
 * Classify a genomic position relative to transcript features.
 * Returns the classification for the most specific (narrowest) overlapping transcript.
 */
export function classifyPosition(center: number, transcripts: TranscriptInfo[]): PositionClassification {
  let best: PositionClassification | null = null;
  let bestWidth = Infinity;

  for (const tx of transcripts) {
    if (center < tx.txStart || center > tx.txEnd) continue;

    const txWidth = tx.txEnd - tx.txStart;

    // Deduplicate exons by position to get unique exon intervals
    const uniqueExons: ExonInfo[] = [];
    const seen = new Set<string>();
    for (const e of tx.exons) {
      const key = `${e.start}-${e.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueExons.push(e);
      }
    }

    // Check if center falls in an exon
    let inExon = false;
    let exonIdx = -1;
    let exonType = '';
    for (let i = 0; i < uniqueExons.length; i++) {
      if (center >= uniqueExons[i].start && center <= uniqueExons[i].end) {
        inExon = true;
        exonIdx = i;
        exonType = uniqueExons[i].type.toLowerCase();
        break;
      }
    }

    let location: GeneLocation;
    let featureLabel: string | null;

    if (inExon) {
      if (exonType.includes('utr') || exonType === 'five_prime_utr' || exonType === 'utr5') {
        location = 'utr5';
        featureLabel = "5' UTR";
      } else if (exonType === 'three_prime_utr' || exonType === 'utr3') {
        location = 'utr3';
        featureLabel = "3' UTR";
      } else {
        location = 'exonic';
        featureLabel = `Exon ${exonIdx + 1}`;
      }
    } else {
      // In transcript but not in exon → intronic
      // Find which intron
      location = 'intronic';
      let intronNum = 0;
      for (let i = 0; i < uniqueExons.length - 1; i++) {
        if (center > uniqueExons[i].end && center < uniqueExons[i + 1].start) {
          intronNum = i + 1;
          break;
        }
      }
      featureLabel = intronNum > 0 ? `Intron ${intronNum}` : 'Intronic';
    }

    if (txWidth < bestWidth) {
      bestWidth = txWidth;
      best = {
        location,
        featureLabel,
        geneSymbol: tx.geneSymbol,
        strand: tx.strand,
        transcriptId: tx.transcriptId,
      };
    }
  }

  if (!best) {
    return {
      location: 'intergenic',
      featureLabel: null,
      geneSymbol: null,
      strand: null,
      transcriptId: null,
    };
  }

  return best;
}

/**
 * Find the nearest splice site to a position.
 * Exon start = acceptor (AG), Exon end = donor (GT), strand-adjusted.
 * Skips first exon start and last exon end per transcript (not true splice junctions).
 */
export function findNearestSpliceSite(center: number, transcripts: TranscriptInfo[]): SpliceSiteInfo | null {
  let best: SpliceSiteInfo | null = null;

  for (const tx of transcripts) {
    const exons = tx.exons.filter(e => {
      const ft = e.type.toLowerCase();
      return ft === 'exon' || ft === 'cds';
    });
    // Deduplicate
    const unique: ExonInfo[] = [];
    const seen = new Set<string>();
    for (const e of exons) {
      const key = `${e.start}-${e.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(e);
      }
    }
    unique.sort((a, b) => a.start - b.start);

    for (let i = 0; i < unique.length; i++) {
      // Acceptor site at exon start (skip first exon)
      if (i > 0) {
        const pos = unique[i].start;
        const dist = Math.abs(center - pos);
        const type: 'donor' | 'acceptor' = tx.strand === '-' ? 'donor' : 'acceptor';
        if (!best || dist < best.distance) {
          best = { type, distance: dist, position: pos };
        }
      }

      // Donor site at exon end (skip last exon)
      if (i < unique.length - 1) {
        const pos = unique[i].end;
        const dist = Math.abs(center - pos);
        const type: 'donor' | 'acceptor' = tx.strand === '-' ? 'acceptor' : 'donor';
        if (!best || dist < best.distance) {
          best = { type, distance: dist, position: pos };
        }
      }
    }
  }

  return best;
}

/**
 * Find the nearest TSS (transcription start site) to a position.
 * TSS = strand-adjusted start of transcript features.
 */
export function findNearestTSS(center: number, transcripts: TranscriptInfo[]): LandmarkInfo | null {
  let best: LandmarkInfo | null = null;

  for (const tx of transcripts) {
    const tss = tx.strand === '-' ? tx.txEnd : tx.txStart;
    const dist = Math.abs(center - tss);
    if (!best || dist < best.distance) {
      best = { symbol: tx.geneSymbol ?? 'unknown', distance: dist, position: tss };
    }
  }

  return best;
}

/**
 * Find the nearest start codon (AUG) to a position.
 */
export function findNearestStartCodon(center: number, data: GRanges): LandmarkInfo | null {
  let best: LandmarkInfo | null = null;

  for (let i = 0; i < data.n; i++) {
    const featureType = (data.mcols.feature_type?.[i] as string) ?? '';
    if (featureType.toLowerCase() !== 'start_codon') continue;

    const pos = data.ranges.start[i];
    const dist = Math.abs(center - pos);
    const symbol = (data.mcols.gene_symbol?.[i] as string) ?? 'unknown';

    if (!best || dist < best.distance) {
      best = { symbol, distance: dist, position: pos };
    }
  }

  return best;
}

/**
 * Find flanking genes for an intergenic position.
 * Returns [leftGene, rightGene] with distances.
 */
export function findFlankingGenes(
  center: number,
  transcripts: TranscriptInfo[],
): { left: LandmarkInfo | null; right: LandmarkInfo | null } {
  let left: LandmarkInfo | null = null;
  let right: LandmarkInfo | null = null;

  for (const tx of transcripts) {
    if (tx.txEnd < center) {
      const dist = center - tx.txEnd;
      if (!left || dist < left.distance) {
        left = { symbol: tx.geneSymbol ?? 'unknown', distance: dist, position: tx.txEnd };
      }
    }
    if (tx.txStart > center) {
      const dist = tx.txStart - center;
      if (!right || dist < right.distance) {
        right = { symbol: tx.geneSymbol ?? 'unknown', distance: dist, position: tx.txStart };
      }
    }
  }

  return { left, right };
}
