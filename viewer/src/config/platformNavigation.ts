/** Public destinations shared by the platform overview and tool directory. */
export const VIEWER_HREF = '/genomics/view/hg38/chr17:7668421-7687490?layers=gencode_v44,cpg_sites,probe_epic_v2,isochores';
export interface PlatformTool { name: string; description: string; href: string; category: string; }
export const ANALYSIS_TOOLS: PlatformTool[] = [
  { name: 'Sequence Evaluator', description: 'Examine sequence biophysics, thermodynamics, CpG islands, and structural flags.', href: '/genomics/evaluate', category: 'Sequence' },
  { name: 'Methylation Analysis', description: 'Explore differential methylation, probe context, and transposable-element methylation.', href: '/genomics/dmp', category: 'Epigenetics' },
  { name: 'Epigenetic Clocks', description: 'Inspect clock probes, compare clocks, and explore their coefficients.', href: '/genomics/clocks', category: 'Epigenetics' },
  { name: 'Transposome', description: 'Explore transposable elements, their genomic context, and array-probe overlap.', href: '/genomics/transposome', category: 'Repeats' },
  { name: 'HLA Explorer', description: 'Explore HLA allele biophysics, non-coding variation, and expression comparisons.', href: '/genomics/hla', category: 'Variation' },
  { name: 'RNA Construct Builder', description: 'Build and evaluate RNA constructs with an interactive canvas and duplex thermodynamics.', href: '/genomics/construct-builder', category: 'Design' },
];
export const RESOURCE_TOOLS: PlatformTool[] = [
  { name: 'Knowledge Library', description: 'Read connected explanations of DNA composition, genome organization, and physical properties.', href: '/library', category: 'Knowledge' },
  { name: 'API & MCP Reference', description: 'Find endpoints and agent tools for accessing genomic data and analysis.', href: '/genomics/docs', category: 'Documentation' },
  { name: 'Developer Quickstart', description: 'Get started with API requests, the Python SDK, and worked examples.', href: '/genomics/developers', category: 'Developers' },
  { name: 'Data Sources', description: 'Review the source, provenance, and license information for genomic data layers.', href: '/genomics/data-sources', category: 'Reference' },
  { name: 'Methodology', description: 'Understand the methods and assumptions behind the platform.', href: '/genomics/docs/methodology', category: 'Reference' },
  { name: 'Claims Universe', description: 'Explore scientific claims and their supporting evidence.', href: '/claims', category: 'Evidence' },
];
