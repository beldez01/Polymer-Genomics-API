import { COLOR } from './theme';

export interface ToolkitCardData {
  id: string;
  number: string;
  title: string;
  tagline: string;
  href: string;
  color: string;
  sparkline: number[];
  activity: string;
  latestClaim: string;
}

export const TOOLKIT_CARDS: ToolkitCardData[] = [
  {
    id: 'evaluate',
    number: '01',
    title: 'EVALUATE',
    tagline: 'Physics linter for synthetic constructs',
    href: '/genomics/evaluate',
    color: COLOR.accent.teal,
    sparkline: [0.12, 0.18, 0.22, 0.35, 0.44, 0.58, 0.64, 0.71, 0.78, 0.82, 0.85, 0.83, 0.87, 0.86, 0.89],
    activity: '13 flag types · batch mode · 4 bots',
    latestClaim: 'AUROC 0.827 for crossover hotspot discrimination',
  },
  {
    id: 'transposome',
    number: '02',
    title: 'TRANSPOSOME',
    tagline: 'LINEs · SINEs · LTRs · ERVs',
    href: '/genomics/transposome',
    color: COLOR.repeat.SINE,
    sparkline: [0.15, 0.22, 0.38, 0.62, 0.78, 0.84, 0.72, 0.51, 0.42, 0.55, 0.71, 0.83, 0.76, 0.58, 0.34],
    activity: '4.6M elements · 23 claims · 3 bots',
    latestClaim: 'SINEs +0.18 vs gene expression, GC-independent',
  },
  {
    id: 'hla',
    number: '03',
    title: 'HLA',
    tagline: 'Allele biophysics & expression',
    href: '/genomics/hla',
    color: COLOR.accent.violet,
    sparkline: [0.92, 0.88, 0.84, 0.76, 0.71, 0.64, 0.58, 0.49, 0.42, 0.36, 0.28, 0.22, 0.18, 0.14, 0.11],
    activity: '3 classical loci · 12 claims · 2 bots',
    latestClaim: 'HLA-A dG37 vs TPM r = −0.76',
  },
  {
    id: 'clocks',
    number: '04',
    title: 'CLOCKS',
    tagline: 'Epigenetic aging & biomarkers',
    href: '/genomics/clocks',
    color: COLOR.accent.rose,
    sparkline: [0.08, 0.14, 0.21, 0.28, 0.34, 0.42, 0.48, 0.54, 0.61, 0.68, 0.73, 0.79, 0.84, 0.88, 0.93],
    activity: '~15 clock models · 8 claims',
    latestClaim: 'CDI ≈ ThermAge on 450K arrays, r = 0.9991',
  },
  {
    id: 'dmp',
    number: '05',
    title: 'DMP',
    tagline: 'Differential methylation probes',
    href: '/genomics/dmp',
    color: COLOR.layer.gencode_v44,
    sparkline: [0.12, 0.18, 0.28, 0.44, 0.62, 0.78, 0.88, 0.92, 0.86, 0.72, 0.54, 0.38, 0.26, 0.16, 0.09],
    activity: '860K probes · 5 claims',
    latestClaim: 'DMP lists annotated with biophysics in one call',
  },
  {
    id: 'te-methylation',
    number: '06',
    title: 'TE METHYLATION',
    tagline: 'TE-resolved CpG context',
    href: '/genomics/te-methylation',
    color: COLOR.cpgContext.island,
    sparkline: [0.88, 0.74, 0.62, 0.54, 0.42, 0.38, 0.32, 0.28, 0.24, 0.22, 0.19, 0.17, 0.16, 0.15, 0.15],
    activity: '~800K TE-resolved CpGs · 9 claims',
    latestClaim: 'Universal erosion floor 0.15 obs/exp across TE families',
  },
];
