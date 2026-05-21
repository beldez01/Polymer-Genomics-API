/**
 * Curated gene list for the Atlas page's gene-search typeahead.
 *
 * Sandbox-only — Tier 1 port-back will swap this for the live
 * /v1/search/genes endpoint. Covers famous tumor-suppressors,
 * oncogenes, monogenic-disease genes, methylation enzymes, and
 * a few immune / methylation-relevant loci that fit the platform's
 * primary research themes (TET2, HLA, methylation atlas).
 */

export interface AtlasGene {
  symbol: string;
  chromosome: string;
  aliases?: string[];
  blurb?: string;
}

export const ATLAS_GENES: AtlasGene[] = [
  // Tumor suppressors
  { symbol: 'TP53',   chromosome: 'chr17', aliases: ['p53'],         blurb: 'tumor protein p53' },
  { symbol: 'BRCA1',  chromosome: 'chr17',                          blurb: 'breast cancer 1' },
  { symbol: 'BRCA2',  chromosome: 'chr13',                          blurb: 'breast cancer 2' },
  { symbol: 'APC',    chromosome: 'chr5',                           blurb: 'adenomatous polyposis coli' },
  { symbol: 'RB1',    chromosome: 'chr13',                          blurb: 'retinoblastoma 1' },
  { symbol: 'PTEN',   chromosome: 'chr10',                          blurb: 'phosphatase and tensin homolog' },
  { symbol: 'VHL',    chromosome: 'chr3',                           blurb: 'von Hippel-Lindau' },
  { symbol: 'CDKN2A', chromosome: 'chr9',  aliases: ['p16', 'INK4A'], blurb: 'cyclin-dep. kinase inhibitor 2A' },
  { symbol: 'NF1',    chromosome: 'chr17',                          blurb: 'neurofibromin 1' },
  { symbol: 'NF2',    chromosome: 'chr22',                          blurb: 'neurofibromin 2 (merlin)' },
  { symbol: 'WT1',    chromosome: 'chr11',                          blurb: 'Wilms tumor 1' },
  { symbol: 'ATM',    chromosome: 'chr11',                          blurb: 'ataxia telangiectasia mutated' },

  // Oncogenes
  { symbol: 'MYC',    chromosome: 'chr8',                           blurb: 'MYC proto-oncogene' },
  { symbol: 'KRAS',   chromosome: 'chr12',                          blurb: 'KRAS proto-oncogene' },
  { symbol: 'NRAS',   chromosome: 'chr1',                           blurb: 'NRAS proto-oncogene' },
  { symbol: 'HRAS',   chromosome: 'chr11',                          blurb: 'HRAS proto-oncogene' },
  { symbol: 'BRAF',   chromosome: 'chr7',                           blurb: 'B-Raf proto-oncogene' },
  { symbol: 'EGFR',   chromosome: 'chr7',                           blurb: 'EGF receptor' },
  { symbol: 'ERBB2',  chromosome: 'chr17', aliases: ['HER2', 'NEU'], blurb: 'ERB-B2 / HER2' },
  { symbol: 'PIK3CA', chromosome: 'chr3',                           blurb: 'PI3K catalytic α' },
  { symbol: 'AKT1',   chromosome: 'chr14',                          blurb: 'AKT serine/threonine kinase 1' },
  { symbol: 'MTOR',   chromosome: 'chr1',                           blurb: 'mechanistic target of rapamycin' },
  { symbol: 'BCL2',   chromosome: 'chr18',                          blurb: 'BCL2 apoptosis regulator' },

  // Methylation / TET enzymes — core to platform research themes
  { symbol: 'TET1',   chromosome: 'chr10',                          blurb: 'TET methylcytosine dioxygenase 1' },
  { symbol: 'TET2',   chromosome: 'chr4',                           blurb: 'TET methylcytosine dioxygenase 2 · CHIP' },
  { symbol: 'TET3',   chromosome: 'chr2',                           blurb: 'TET methylcytosine dioxygenase 3' },
  { symbol: 'DNMT1',  chromosome: 'chr19',                          blurb: 'DNA methyltransferase 1' },
  { symbol: 'DNMT3A', chromosome: 'chr2',                           blurb: 'DNA methyltransferase 3 alpha · CHIP' },
  { symbol: 'DNMT3B', chromosome: 'chr20',                          blurb: 'DNA methyltransferase 3 beta' },
  { symbol: 'EZH2',   chromosome: 'chr7',                           blurb: 'enhancer of zeste 2 (PRC2)' },
  { symbol: 'IDH1',   chromosome: 'chr2',                           blurb: 'isocitrate dehydrogenase 1' },
  { symbol: 'IDH2',   chromosome: 'chr15',                          blurb: 'isocitrate dehydrogenase 2' },

  // Mismatch repair / Lynch
  { symbol: 'MLH1',   chromosome: 'chr3',                           blurb: 'mismatch repair · Lynch' },
  { symbol: 'MSH2',   chromosome: 'chr2',                           blurb: 'mismatch repair · Lynch' },
  { symbol: 'MSH6',   chromosome: 'chr2',                           blurb: 'mismatch repair · Lynch' },
  { symbol: 'PMS2',   chromosome: 'chr7',                           blurb: 'mismatch repair · Lynch' },

  // Disease genes (monogenic, famous)
  { symbol: 'CFTR',   chromosome: 'chr7',                           blurb: 'cystic fibrosis' },
  { symbol: 'HBB',    chromosome: 'chr11',                          blurb: 'hemoglobin β · sickle cell' },
  { symbol: 'DMD',    chromosome: 'chrX',                           blurb: 'dystrophin · DMD' },
  { symbol: 'HTT',    chromosome: 'chr4',                           blurb: 'huntingtin · Huntington disease' },
  { symbol: 'APP',    chromosome: 'chr21',                          blurb: 'amyloid precursor · Alzheimer' },
  { symbol: 'SOD1',   chromosome: 'chr21',                          blurb: 'SOD1 · ALS' },
  { symbol: 'MAPT',   chromosome: 'chr17',                          blurb: 'microtubule-associated protein tau' },
  { symbol: 'F8',     chromosome: 'chrX',                           blurb: 'coagulation factor VIII · hemophilia A' },
  { symbol: 'F9',     chromosome: 'chrX',                           blurb: 'coagulation factor IX · hemophilia B' },
  { symbol: 'PKD1',   chromosome: 'chr16',                          blurb: 'polycystic kidney disease 1' },

  // Immunogenetics — HLA + CARs
  { symbol: 'HLA-A',  chromosome: 'chr6',                           blurb: 'MHC class I · A' },
  { symbol: 'HLA-B',  chromosome: 'chr6',                           blurb: 'MHC class I · B' },
  { symbol: 'HLA-C',  chromosome: 'chr6',                           blurb: 'MHC class I · C' },
  { symbol: 'HLA-DRB1', chromosome: 'chr6',                         blurb: 'MHC class II · DRB1' },
  { symbol: 'CD19',   chromosome: 'chr16',                          blurb: 'B-cell antigen · CAR-T target' },
  { symbol: 'CD8A',   chromosome: 'chr2',                           blurb: 'CD8 α chain' },
  { symbol: 'FOXP3',  chromosome: 'chrX',                           blurb: 'forkhead box P3 · Tregs' },

  // CHIP / hematology
  { symbol: 'JAK2',   chromosome: 'chr9',                           blurb: 'Janus kinase 2 · MPN / CHIP' },
  { symbol: 'ASXL1',  chromosome: 'chr20',                          blurb: 'additional sex combs-like 1 · CHIP' },
  { symbol: 'SF3B1',  chromosome: 'chr2',                           blurb: 'splicing factor 3b 1 · MDS' },

  // Endocrine / metabolic
  { symbol: 'INS',    chromosome: 'chr11',                          blurb: 'insulin' },
  { symbol: 'GCK',    chromosome: 'chr7',                           blurb: 'glucokinase · MODY2' },
];

/**
 * Local typeahead search — symbol-prefix priority, then alias-substring.
 */
export function searchAtlasGenes(query: string, limit = 8): AtlasGene[] {
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];

  const prefixHits: AtlasGene[] = [];
  const aliasHits: AtlasGene[] = [];
  const substringHits: AtlasGene[] = [];

  for (const gene of ATLAS_GENES) {
    const sym = gene.symbol.toUpperCase();
    if (sym.startsWith(q)) {
      prefixHits.push(gene);
      continue;
    }
    const aliasMatch = gene.aliases?.find((a) => a.toUpperCase().startsWith(q));
    if (aliasMatch) {
      aliasHits.push(gene);
      continue;
    }
    if (sym.includes(q)) {
      substringHits.push(gene);
    }
  }

  return [...prefixHits, ...aliasHits, ...substringHits].slice(0, limit);
}

export function getMatchedAlias(gene: AtlasGene, query: string): string | null {
  const q = query.trim().toUpperCase();
  if (!gene.aliases) return null;
  return gene.aliases.find((a) => a.toUpperCase().startsWith(q)) ?? null;
}
