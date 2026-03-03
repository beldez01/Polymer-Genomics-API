import { useMemo } from 'react';
import type { ViewportData } from '@/lib/genomeFetcher';
import type { GRanges } from '@/lib/api';
import {
  groupFeaturesByTranscript,
  classifyPosition,
  findNearestSpliceSite,
  findNearestTSS,
  findNearestStartCodon,
  findFlankingGenes,
  type PositionClassification,
  type SpliceSiteInfo,
  type LandmarkInfo,
} from '@/lib/geneContext';

export interface RegionContext {
  center: number;
  viewportWidth: number;

  isochore: { class: string | null; gcPercent: number | null };

  cpg: {
    context: string | null;
    density: number; // CpG sites per kb in viewport
    count: number;
  };

  gene: PositionClassification;
  flankingGenes: { left: LandmarkInfo | null; right: LandmarkInfo | null };

  nearestSplice: SpliceSiteInfo | null;
  nearestTSS: LandmarkInfo | null;
  nearestAUG: LandmarkInfo | null;

  gc: { percent: number | null; source: 'sequence' | 'cpg_sites' | 'isochore' };

  cost: {
    geneSymbol: string | null;
    proteinLength: number | null;
    ecpaB20: number | null;
    cProtein: number | null;
    nProtein: number | null;
    sProtein: number | null;
    cai: number | null;
    tai: number | null;
    meanTpm: number | null;
  } | null;
}

function computeGC(
  sequence: string | null,
  cpgData: GRanges | undefined,
  isochoreData: GRanges | undefined,
  center: number,
  viewStart: number,
): { percent: number | null; source: 'sequence' | 'cpg_sites' | 'isochore' } {
  // Priority 1: raw sequence
  if (sequence && sequence.length > 0) {
    let gc = 0;
    let total = 0;
    for (let i = 0; i < sequence.length; i++) {
      const ch = sequence[i].toUpperCase();
      if (ch === 'G' || ch === 'C') { gc++; total++; }
      else if (ch === 'A' || ch === 'T') { total++; }
      // Skip N and other ambiguity codes
    }
    if (total > 0) {
      return { percent: (gc / total) * 100, source: 'sequence' };
    }
  }

  // Priority 2: average gc_content from CpG sites in view
  if (cpgData && cpgData.n > 0 && cpgData.mcols.gc_content) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < cpgData.n; i++) {
      const gc = cpgData.mcols.gc_content[i];
      if (typeof gc === 'number') {
        sum += gc;
        count++;
      }
    }
    if (count > 0) {
      return { percent: (sum / count) * 100, source: 'cpg_sites' };
    }
  }

  // Priority 3: isochore gc_content at center
  if (isochoreData && isochoreData.n > 0 && isochoreData.mcols.gc_content) {
    for (let i = 0; i < isochoreData.n; i++) {
      if (center >= isochoreData.ranges.start[i] && center <= isochoreData.ranges.end[i]) {
        const gc = isochoreData.mcols.gc_content[i];
        if (typeof gc === 'number') {
          return { percent: gc * 100, source: 'isochore' };
        }
      }
    }
  }

  return { percent: null, source: 'isochore' };
}

export function useRegionContext(
  data: ViewportData | null,
  chr: string,
  start: number,
  end: number,
): RegionContext {
  return useMemo(() => {
    const center = Math.round((start + end) / 2);
    const viewportWidth = end - start + 1;

    const isochoreData = data?.layers?.isochores;
    const cpgData = data?.layers?.cpg_sites;
    const geneData = data?.layers?.gencode_v44;

    // --- Isochore ---
    let isochoreClass: string | null = null;
    let isochoreGC: number | null = null;
    if (isochoreData && isochoreData.n > 0) {
      for (let i = 0; i < isochoreData.n; i++) {
        if (center >= isochoreData.ranges.start[i] && center <= isochoreData.ranges.end[i]) {
          isochoreClass = (isochoreData.mcols.isochore_class?.[i] as string) ?? null;
          const gc = isochoreData.mcols.gc_content?.[i];
          if (typeof gc === 'number') {
            isochoreGC = gc * 100;
          }
          break;
        }
      }
    }

    // --- CpG ---
    let cpgContext: string | null = null;
    let cpgCount = 0;
    if (cpgData && cpgData.n > 0) {
      cpgCount = cpgData.n;

      // Find nearest CpG to center
      let nearestDist = Infinity;
      for (let i = 0; i < cpgData.n; i++) {
        const pos = cpgData.ranges.start[i];
        const dist = Math.abs(center - pos);
        if (dist < nearestDist) {
          nearestDist = dist;
          cpgContext = (cpgData.mcols.context?.[i] as string) ?? null;
        }
      }
    }
    const cpgDensity = viewportWidth > 0 ? (cpgCount / viewportWidth) * 1000 : 0;

    // --- Gene context ---
    let gene: PositionClassification = {
      location: 'intergenic',
      featureLabel: null,
      geneSymbol: null,
      strand: null,
      transcriptId: null,
    };
    let flankingGenes = { left: null as LandmarkInfo | null, right: null as LandmarkInfo | null };
    let nearestSplice: SpliceSiteInfo | null = null;
    let nearestTSS: LandmarkInfo | null = null;
    let nearestAUG: LandmarkInfo | null = null;

    if (geneData && geneData.n > 0) {
      const transcripts = groupFeaturesByTranscript(geneData);
      gene = classifyPosition(center, transcripts);
      nearestSplice = findNearestSpliceSite(center, transcripts);
      nearestTSS = findNearestTSS(center, transcripts);
      nearestAUG = findNearestStartCodon(center, geneData);

      if (gene.location === 'intergenic') {
        flankingGenes = findFlankingGenes(center, transcripts);
      }
    }

    // --- GC ---
    const gc = computeGC(data?.sequence ?? null, cpgData, isochoreData, center, start);

    // --- Cost ---
    let cost: RegionContext['cost'] = null;
    const costData = data?.layers?.gene_costs_v1;
    if (costData && costData.n > 0) {
      // Find gene whose range contains center
      for (let i = 0; i < costData.n; i++) {
        if (center >= costData.ranges.start[i] && center <= costData.ranges.end[i]) {
          cost = {
            geneSymbol: (costData.mcols.gene_symbol?.[i] as string) ?? null,
            proteinLength: (costData.mcols.protein_length?.[i] as number) ?? null,
            ecpaB20: (costData.mcols.ecpa_b20?.[i] as number) ?? null,
            cProtein: (costData.mcols.c_protein?.[i] as number) ?? null,
            nProtein: (costData.mcols.n_protein?.[i] as number) ?? null,
            sProtein: (costData.mcols.s_protein?.[i] as number) ?? null,
            cai: (costData.mcols.cai?.[i] as number) ?? null,
            tai: (costData.mcols.tai?.[i] as number) ?? null,
            meanTpm: (costData.mcols.mean_tpm?.[i] as number) ?? null,
          };
          break;
        }
      }
    }

    return {
      center,
      viewportWidth,
      isochore: { class: isochoreClass, gcPercent: isochoreGC },
      cpg: { context: cpgContext, density: cpgDensity, count: cpgCount },
      gene,
      flankingGenes,
      nearestSplice,
      nearestTSS,
      nearestAUG,
      gc,
      cost,
    };
  }, [data, chr, start, end]);
}
