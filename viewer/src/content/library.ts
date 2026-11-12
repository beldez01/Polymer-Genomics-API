import { VIEWER_HREF } from '@/config/platformNavigation';
import { CHROMATIN_ARTICLE } from './library/chromatin-maintenance';
import { GC_CONTENT_ARTICLE, ISOCHORES_ARTICLE } from './library/composition-articles';
import { THERMODYNAMICS_ARTICLE, DNA_MECHANICS_ARTICLE, PHYSICAL_EVIDENCE_ARTICLE } from './library/physical-foundations';

/** Editorial content lives here independently of presentation. No live API is required. */
export const LIBRARY_SUBJECTS = [
  { id: 'composition', name: 'Composition', description: 'Bases, GC content, CpGs, and variation across scales.' },
  { id: 'organization', name: 'Organization', description: 'Repeats, sequence patterns, and chromosomal landscapes.' },
  { id: 'physical-properties', name: 'Physical properties', description: 'The thermodynamic and structural behavior of DNA.' },
  { id: 'epigenetics', name: 'Epigenetics & chromatin', description: 'Chromatin organization, maintenance, and the machinery that changes it.' },
  { id: 'methods', name: 'Methods & evidence', description: 'Coordinates, measurements, and how to interpret them.' },
] as const;

export type SubjectId = typeof LIBRARY_SUBJECTS[number]['id'];
export type LibraryFigureKind = 'scales' | 'sequence' | 'coordinates' | 'chromatin' | 'gc-windows' | 'isochore-windows' | 'mechanics' | 'evidence';
export interface LibrarySection {
  id: string;
  title: string;
  paragraphs: string[];
  sourceIds?: string[];
  table?: { caption: string; headings: string[]; rows: string[][] };
  figure?: LibraryFigureKind;
}
export type LibraryCollection = 'foundations' | 'reference';
export interface LibraryArticle {
  slug: string;
  title: string;
  description: string;
  kind: 'Perspective' | 'Concept' | 'Topic' | 'Method';
  collection: LibraryCollection;
  order: number;
  subjects: SubjectId[];
  terms: string[];
  updated: string;
  status: 'Editorial draft';
  figure?: LibraryFigureKind;
  sections: LibrarySection[];
  references: { id: string; title: string; citation: string; href: string }[];
  related: string[];
  tools: { title: string; description: string; href: string }[];
}

const atlas = { title: 'Digital Karyotype', description: 'Explore chromosomes and their genomic context.', href: '/genomics/atlas' };
const methods = { title: 'Polymer methodology', description: 'Inspect the methods and assumptions behind the tools.', href: '/genomics/docs/methodology' };
const sources = { title: 'Data sources', description: 'Find annotation provenance and data licenses.', href: '/genomics/data-sources' };
const evaluator = { title: 'Sequence Evaluator', description: 'Examine the composition and modeled properties of a DNA sequence.', href: '/genomics/evaluate' };

export const LIBRARY_ARTICLES: LibraryArticle[] = [
  {
    slug: 'material-channel', title: 'The material channel of the genome', collection: 'foundations', order: 1,
    description: 'An organizing perspective on DNA composition, physical properties, and genomic context.',
    kind: 'Perspective', subjects: ['composition', 'organization', 'physical-properties'],
    terms: ['material channel', 'framework', 'DNA', 'genome'], updated: '2026-11-11', status: 'Editorial draft', figure: 'scales',
    sections: [
      { id: 'perspective', title: 'A perspective for Polymer', paragraphs: [
        'Polymer uses “material channel” as a working name for studying the genome through composition, arrangement, and physical behavior. This developing framework brings established measurements and models into a shared view, with individual claims evaluated on their evidence.',
        'The purpose is to keep several questions close together: What is this sequence made of? How are its bases arranged? Which properties can be measured or modeled? What biological and evolutionary context is needed to interpret them?',
      ] },
      { id: 'scales', title: 'Connect scales without collapsing them', paragraphs: [
        'A useful resource should let a reader move from a chromosome to a region, a gene, and a sequence-level property. Each scale asks a different question. A chromosome overview supplies context; a local model supplies a specific prediction with specific assumptions.',
        'The connections between those views should be explicit. A modeled property, an annotation overlap, and a measured cellular response are different kinds of evidence. Displaying them together creates opportunities for investigation; it does not establish causation.',
      ] },
      { id: 'evidence', title: 'An evidence-first library', paragraphs: [
        'This library will connect foundational explanations to the tools that display relevant data. Established findings will be cited, calculations will link to methods, and original interpretations will be identified as such. The framework itself will evolve through editorial and scientific review.',
      ] },
    ], references: [], related: ['gc-content', 'isochores', 'dna-thermodynamics', 'physical-annotation-and-evidence'], tools: [atlas, evaluator, methods],
  },
  GC_CONTENT_ARTICLE,
  {
    slug: 'cpg-distribution', title: 'CpG distribution and CpG islands', collection: 'foundations', order: 8,
    description: 'Distinguish a sequence pattern, an annotation, and a measured methylation state.',
    kind: 'Concept', subjects: ['composition', 'organization', 'epigenetics'], terms: ['CpG', 'CG', 'islands', 'methylation', 'dinucleotide'],
    updated: '2026-11-11', status: 'Editorial draft',
    sections: [
      { id: 'definition', title: 'A dinucleotide in sequence', paragraphs: [
        'CpG denotes a cytosine followed by a guanine along a strand in the 5′ to 3′ direction; the “p” denotes the intervening phosphate. It is a neighboring-base pattern, not the C–G pairing between opposite strands.',
        'The classical CpG-island work examined regions enriched in both G/C bases and CpG dinucleotides relative to the surrounding vertebrate genome. Counting CpGs and calculating GC content are related but distinct descriptions.',
      ], sourceIds: ['gardiner'] },
      { id: 'annotations', title: 'An island is an operational annotation', paragraphs: [
        'CpG-island identification depends on criteria such as interval length, GC content, and observed-to-expected CpG frequency. Different criteria can produce different sets of intervals. A chromosome 21/22 analysis explicitly compared definitions and their consequences.',
        'When using an island track, inspect the source and calling rules. Avoid treating the boundary as a universal biological discontinuity.',
      ], sourceIds: ['takai'] },
      { id: 'interpretation', title: 'Keep sequence and state separate', paragraphs: [
        'A sequence annotation alone does not provide a methylation measurement for a sample. When connecting CpG context to methylation data, identify the tissue or cell type, assay, sample, and genomic assembly. Missing measurements should remain missing rather than being inferred from the island label.',
      ] },
    ], references: [
      { id: 'gardiner', title: 'CpG islands in vertebrate genomes', citation: 'Gardiner-Garden & Frommer · Journal of Molecular Biology · 1987', href: 'https://pubmed.ncbi.nlm.nih.gov/3656447/' },
      { id: 'takai', title: 'Comprehensive analysis of CpG islands in human chromosomes 21 and 22', citation: 'Takai & Jones · PNAS · 2002', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC122594/' },
    ], related: ['chromatin-maintenance', 'gc-content', 'isochores', 'genomic-coordinates'], tools: [atlas, sources],
  },
  ISOCHORES_ARTICLE,
  {
    slug: 'repeating-and-nonrepeating-dna', title: 'Repeating and nonrepeating DNA', collection: 'foundations', order: 5,
    description: 'Repeat organization, annotation coverage, and why “unannotated” is not a functional verdict.',
    kind: 'Concept', subjects: ['organization'], terms: ['repeat', 'tandem', 'transposon', 'satellite', 'unique', 'noncoding'],
    updated: '2026-11-11', status: 'Editorial draft',
    sections: [
      { id: 'organization', title: 'Different ways to repeat', paragraphs: [
        'Tandem repeats place related units next to one another. Interspersed repeats occur at separated positions; many families are associated with transposable elements. The human genome sequencing analysis treated repeat classes as a major component of genome organization and evolutionary history.',
        'Nonrepeating and noncoding are different descriptions. One concerns sequence recurrence; the other concerns protein-coding annotation. Neither term by itself assigns a biological role.',
      ], sourceIds: ['genome'] },
      { id: 'reference', title: 'Reference coverage matters', paragraphs: [
        'Repetitive sequence can be challenging to assemble and place. The T2T-CHM13 study resolved substantial sequence absent or incomplete in earlier references, including centromeric satellite arrays and recent segmental duplications.',
        'A repeat landscape depends on the assembly and annotation method. Comparing tracks from different references without accounting for those differences can confuse biological variation with differences in representation.',
      ], sourceIds: ['t2t'] },
      { id: 'interpretation', title: 'What an annotation can establish', paragraphs: [
        'A repeat annotation reports a match under a particular classification and detection method. An interval without a repeat annotation should not automatically be described as unique, inactive, or functionless. Inspect annotation coverage and the question being asked before interpreting an absence.',
      ] },
    ], references: [
      { id: 'genome', title: 'Initial sequencing and analysis of the human genome', citation: 'International Human Genome Sequencing Consortium · Nature · 2001', href: 'https://www.nature.com/articles/35057062' },
      { id: 't2t', title: 'The complete sequence of a human genome', citation: 'Nurk et al. · Science · 2022', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9186530/' },
    ], related: ['chromatin-maintenance', 'sequence-complexity', 'genomic-coordinates', 'isochores'], tools: [{ title: 'Transposome', description: 'Explore transposable elements and their genomic context.', href: '/genomics/transposome' }, atlas, sources],
  },
  {
    slug: 'sequence-complexity', title: 'Sequence complexity and periodicity', collection: 'foundations', order: 4,
    description: 'Why base counts, repeated patterns, and complexity scores answer different questions.',
    kind: 'Concept', subjects: ['composition', 'organization'], terms: ['entropy', 'low complexity', 'periodicity', 'DUST', 'k-mer'],
    updated: '2026-11-11', status: 'Editorial draft', figure: 'sequence',
    sections: [
      { id: 'composition', title: 'Identical counts, different arrangements', paragraphs: [
        'Consider AAAACCCCGGGGTTTT and ACGTACGTACGTACGT. Both contain four of each base and have 50% GC content. Yet one groups identical bases together while the other repeats a four-base unit. A score using only single-base frequencies cannot distinguish them.',
        'This is a mathematical limitation of that summary, not evidence that either synthetic example is biologically random or functional.',
      ] },
      { id: 'measures', title: 'Specify the complexity measure', paragraphs: [
        'Complexity is not one universal quantity. A method can examine base frequencies, short-word counts, or recurring patterns over a chosen window. The symmetric DUST method is one established approach to identifying low-complexity DNA; its masking rules are part of the method.',
        'Report the algorithm and parameters alongside a score. A single-base entropy value and a DUST annotation should not be treated as interchangeable measurements.',
      ], sourceIds: ['dust'] },
      { id: 'periodicity', title: 'Periodicity asks about recurrence', paragraphs: [
        'Periodicity describes recurrence at a spacing. In the second synthetic example, the four-base unit repeats exactly. Real sequence analyses must define the signal, interval, and comparison model before assigning significance to a pattern. An apparent period alone does not establish a structural or cellular mechanism.',
      ] },
    ], references: [{ id: 'dust', title: 'A Fast and Symmetric DUST Implementation to Mask Low-Complexity DNA Sequences', citation: 'Morgulis et al. · Journal of Computational Biology · 2006', href: 'https://doi.org/10.1089/cmb.2006.13.1028' }],
    related: ['gc-content', 'repeating-and-nonrepeating-dna', 'dna-thermodynamics', 'dna-mechanics', 'material-channel'], tools: [evaluator, methods],
  },
  THERMODYNAMICS_ARTICLE,
  DNA_MECHANICS_ARTICLE,
  PHYSICAL_EVIDENCE_ARTICLE,
  {
    slug: 'genomic-coordinates', title: 'Genomic coordinates and reference assemblies', collection: 'reference', order: 1,
    description: 'What a genomic address means, and what must travel with it.',
    kind: 'Method', subjects: ['methods', 'organization'], terms: ['hg38', 'GRCh38', 'BED', 'assembly', '1-based', '0-based', 'interval'],
    updated: '2026-11-11', status: 'Editorial draft', figure: 'coordinates',
    sections: [
      { id: 'address', title: 'An address needs a reference', paragraphs: [
        'A genomic interval needs an assembly, a sequence name, and a coordinate convention. The same numerical address should not be assumed to identify the same sequence across assemblies. UCSC documents coordinate changes between assembly versions and provides tools for mapping intervals.',
      ], sourceIds: ['assemblies'] },
      { id: 'conventions', title: 'Two common coordinate conventions', paragraphs: [
        'In 1-based closed coordinates, the first base is 1 and both endpoints are included. The interval 101–200 spans 100 bases. In 0-based half-open coordinates, the first base is 0 and the end is excluded: [100, 200) describes the same 100 bases.',
        'UCSC browser position strings use 1-based closed coordinates, while BED uses a 0-based start and an excluded end. Converting these conventions changes the start by one, not both endpoints.',
      ], sourceIds: ['coordinates'] },
      { id: 'polymer', title: 'Using coordinates in Polymer', paragraphs: [
        'Polymer documents its API interval convention as 1-based closed. Keep the assembly and interval attached when sharing a browser view or interpreting an overlap. When importing another format, check its specification rather than inferring its convention from how the numbers look.',
      ] },
    ], references: [
      { id: 'assemblies', title: 'Genome Browser FAQ: assemblies and releases', citation: 'UCSC Genome Browser · Official documentation', href: 'https://genome.ucsc.edu/FAQ/FAQreleases.html' },
      { id: 'coordinates', title: 'Genome Browser FAQ: coordinate systems', citation: 'UCSC Genome Browser · Official documentation', href: 'https://genome.ucsc.edu/FAQ/FAQtracks.html#tracks1' },
    ], related: ['gc-content', 'repeating-and-nonrepeating-dna', 'isochores'], tools: [{ title: 'Genome Browser · example region', description: 'Open the existing hg38 TP53-region view with its assembly, coordinates, and selected layers.', href: VIEWER_HREF }, atlas, methods, sources],
  },
  CHROMATIN_ARTICLE,
];

/** Collection order is editorial metadata, independent of source-file placement. */
export function getOrderedLibraryArticles(): LibraryArticle[] {
  return [...LIBRARY_ARTICLES].sort((a, b) =>
    (a.collection === b.collection ? a.order - b.order : a.collection === 'foundations' ? -1 : 1),
  );
}

export function getLibraryArticle(slug: string): LibraryArticle | undefined {
  return LIBRARY_ARTICLES.find(article => article.slug === slug);
}

export function articleReadingMinutes(article: LibraryArticle): number {
  const words = [article.description, ...article.sections.flatMap(section => [section.title, ...section.paragraphs, section.table?.caption ?? '', ...(section.table?.headings ?? []), ...(section.table?.rows.flat() ?? [])])].join(' ').split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
