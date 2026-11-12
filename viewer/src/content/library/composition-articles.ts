import type { LibraryArticle } from '../library';

const chromosome19 = {
  title: 'Chromosome 19 · overview',
  description: 'Open the hg38 chromosome page and gene context. Its isochore colors are schematic, not a measured GC profile.',
  href: '/genomics/atlas/chr19',
};
const browser = {
  title: 'GC windows · genome browser',
  description: 'Open hg38 chr19:1,000,001–1,900,000 with gene and isochore layers selected. Inspect the available window annotations.',
  href: '/genomics/view/hg38/chr19:1000001-1900000?layers=gencode_v44,isochores',
};
const methods = { title: 'Polymer methodology', description: 'Read about sequence-derived properties, interpretation, and evidence.', href: '/genomics/docs/methodology' };
const sources = { title: 'Data sources', description: 'Check annotation sources, versions, and available coverage.', href: '/genomics/data-sources' };

export const GC_CONTENT_ARTICLE: LibraryArticle = {
  slug: 'gc-content', title: 'Base composition and GC content', collection: 'foundations', order: 2,
  description: 'From counting bases to reading a genomic landscape: denominators, window size, sequence order, and biological context.',
  kind: 'Concept', subjects: ['composition'],
  terms: ['guanine', 'cytosine', 'adenine', 'thymine', 'GC%', 'window', 'callable', 'ambiguous bases', 'weighted average', 'chromosome 19'],
  updated: '2026-11-11', status: 'Editorial draft', figure: 'sequence',
  sections: [
    {
      id: 'definition', title: 'What GC content measures',
      paragraphs: [
        'Base composition describes how much of a sequence is made up of each nucleotide. GC content combines guanine (G) and cytosine (C) into one summary. For a sequence containing only A, C, G, and T, GC% = 100 × (G + C) / (A + C + G + T). The numerator is a count of bases, not a count of neighboring CG pairs.',
        'For example, GCGCAATT contains four G/C bases among eight bases, giving 50% GC. Reporting a fraction of 0.50 or a percentage of 50% describes the same quantity; a plot should make its units explicit. GC content is an interval-level summary, so its interpretation always includes which sequence was counted.',
      ],
    },
    {
      id: 'callable-bases', title: 'The denominator matters',
      paragraphs: [
        'Reference sequences can include N and other symbols that do not specify one unambiguous base. In this article, callable bases means only A, C, G, and T, not sequencing confidence or a variant-calling mask. Callable-base GC excludes ambiguous symbols from both numerator and denominator. The proportion of the interval that remains callable should be reported alongside it.',
        'ACGTNNGCAT has four G/C bases, eight callable bases, and ten positions overall. Its callable-base GC is 50%, with 80% callable coverage. Dividing four by ten gives 40%, a different ratio that does not resolve the two unknown bases. A window containing only Ns has no defined callable-base GC; it should not be interpreted as an all-AT window.',
      ],
      table: {
        caption: 'Worked examples: GC content and callable coverage',
        headings: ['Sequence', 'G + C / callable bases', 'GC content', 'Callable coverage'],
        rows: [
          ['ACGTNNGCAT', '4 / 8', '50%', '80% (8 of 10)'],
          ['AATT', '0 / 4', '0%', '100% (4 of 4)'],
          ['NNNNNNNNNN', '0 / 0', 'Unavailable', '0% (0 of 10)'],
        ],
      },
    },
    {
      id: 'scale', title: 'The window is part of the measurement',
      paragraphs: [
        'A GC profile divides a sequence into intervals and calculates a value for each. Window width sets the scale being summarized. Step size determines how far the interval moves between calculations. A 300-base window advanced by 300 bases gives nonoverlapping summaries; advancing it by 100 bases produces overlapping summaries that share sequence.',
        'Small windows preserve local variation. Larger windows pool neighboring positions and can hide a short GC-rich or AT-rich stretch within a moderate average. In the example below, the sequence never changes. Only the window changes. The chromosome-scale question is different from the local sequence question, even when both are expressed as GC%.',
        'The human genome sequencing analysis described broad variation in composition alongside variation in genes and repeat distributions. That landscape motivates examining more than one scale rather than assigning a single average to every part of a chromosome.',
      ], figure: 'gc-windows', sourceIds: ['human-genome'],
    },
    {
      id: 'pooling', title: 'Pool counts before comparing averages',
      paragraphs: [
        'The GC fraction of a combined interval is obtained by summing G/C counts and dividing by the summed callable-base count. Taking the simple mean of window percentages gives the same answer only when the windows have equal callable counts.',
        'Consider one window with eight G/C bases among ten callable bases (80%), and another with zero G/C bases among two callable bases (0%). The combined value is eight divided by twelve, or approximately 66.7%. Averaging the percentages would give 40%. Differences in window length, missing bases, or masking can therefore change whether an unweighted average is appropriate.',
      ],
    },
    {
      id: 'interpretation', title: 'Composition does not specify sequence order',
      paragraphs: [
        'AAAACCCCGGGGTTTT and ACGTACGTACGTACGT contain the same number of each base. Both are 50% GC, but their neighboring-base patterns differ. A single-base composition summary cannot identify whether a sequence contains a particular motif, a long homopolymer, or a regular spacing of bases.',
        'This distinction matters for physical interpretation. Nearest-neighbor thermodynamic models use adjacent-base-pair contributions and additional terms, rather than GC content alone. A broad relationship between composition and duplex stability does not make melting temperature, bending mechanics, and chromatin accessibility interchangeable quantities.',
      ], sourceIds: ['santalucia'],
    },
    {
      id: 'genomic-context', title: 'Composition in a genomic landscape',
      paragraphs: [
        'Chromosome 19 offers a useful connection to real genomic organization. Its sequencing study described unusually high GC content alongside dense gene organization and substantial repetitive sequence. That combination makes it a relevant chromosome to examine, without implying that every interval on it has the same composition or function.',
        'A local profile should retain its assembly, coordinates, window width, step, and denominator convention. When comparing a gene with its surroundings, define whether the calculation covers coding sequence, all exons, the entire gene span, or specified flanking DNA. Those intervals contain different sequence and can legitimately give different values.',
        'The links below provide chromosome context and a browser interval with gene and isochore layers selected. The chromosome overview uses schematic isochore coloring; the browser supplies the available database annotations. The synthetic diagrams in this article are teaching examples, independent of both views.',
      ], sourceIds: ['chr19'],
    },
  ],
  references: [
    { id: 'human-genome', title: 'Initial sequencing and analysis of the human genome', citation: 'International Human Genome Sequencing Consortium · Nature · 2001', href: 'https://www.nature.com/articles/35057062' },
    { id: 'santalucia', title: 'A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics', citation: 'SantaLucia · PNAS · 1998', href: 'https://pubmed.ncbi.nlm.nih.gov/9465037/' },
    { id: 'chr19', title: 'The DNA sequence and biology of human chromosome 19', citation: 'Grimwood et al. · Nature · 2004', href: 'https://www.nature.com/articles/nature02399' },
  ],
  related: ['isochores', 'sequence-complexity', 'dna-thermodynamics', 'genomic-coordinates', 'cpg-distribution'],
  tools: [chromosome19, browser, { title: 'Sequence Evaluator', description: 'Examine composition and modeled properties of a sequence you supply.', href: '/genomics/evaluate' }, methods],
};

export const ISOCHORES_ARTICLE: LibraryArticle = {
  slug: 'isochores', title: 'Isochores and compositional domains', collection: 'foundations', order: 6,
  description: 'How broad GC landscapes are described, classified, and interpreted—from fixed windows to proposed domain boundaries.',
  kind: 'Concept', subjects: ['composition', 'organization'],
  terms: ['isochore', 'GC domains', 'segmentation', 'chromosome', 'Bernardi', 'homogeneity', 'L1', 'L2', 'H1', 'H2', 'H3', 'gene density', 'replication timing', 'GC-biased gene conversion'],
  updated: '2026-11-11', status: 'Editorial draft',
  sections: [
    {
      id: 'definition', title: 'Composition across long intervals',
      paragraphs: [
        'Genomic GC content varies across intervals and scales. The isochore concept describes long regions with relatively similar internal composition and compositional differences between neighboring regions. The central question is how to summarize a heterogeneous chromosome without losing its broad organization.',
        'Costantini and colleagues constructed a human chromosome map by assessing GC variation within and between adjacent regions. Their resulting domains were grouped into five families, L1, L2, H1, H2, and H3, in order of increasing GC content. This is a particular map and analytical framework, not a statement that every point within a domain has identical composition.',
      ], sourceIds: ['map'],
    },
    {
      id: 'representations', title: 'A profile, a class, and a domain are different',
      paragraphs: [
        'A windowed profile reports a numerical GC value for each chosen interval. Classification assigns that value to a category using thresholds. Segmentation proposes boundaries between regions under a stated rule, often using variation within and between candidate regions. These operations produce different kinds of output.',
        'Even joining neighboring windows with the same label does not establish a homogeneous domain. Two windows can occupy the same broad class while differing internally; a small change near a cutoff can also give similar windows different labels. The example below deliberately separates the numerical landscape from its class labels.',
        'Its 1,200-base length is chosen for a compact demonstration of averaging and classification. It is far smaller than the long regions considered in isochore mapping and should not be read as a miniature biological isochore map.',
      ], figure: 'isochore-windows',
    },
    {
      id: 'families', title: 'Family labels require explicit thresholds',
      paragraphs: [
        'The L1–H3 names order composition from lower to higher GC content. The table gives the exact threshold convention used by Polymer’s isochore ingestion code. The endpoints matter: a window at exactly 41% enters H1, while one at exactly 53% enters H3.',
        'Classifying a fixed window with these cutoffs does not reproduce a published segmentation algorithm. Window size, the treatment of ambiguous bases, minimum domain length, and the boundary-selection rule remain separate parts of a method. A class label should travel with those definitions rather than replacing them.',
        'An interval with no callable bases has no defined GC percentage. A numeric zero in a stored track should not be taken as evidence for an AT-rich interval without checking coverage and the layer’s no-call handling.',
      ],
      table: {
        caption: 'Polymer ingestion convention for callable-base GC percentage',
        headings: ['Class', 'GC interval', 'Boundary convention'],
        rows: [
          ['L1', '0% ≤ GC < 37%', '37% enters L2'],
          ['L2', '37% ≤ GC < 41%', '41% enters H1'],
          ['H1', '41% ≤ GC < 46%', '46% enters H2'],
          ['H2', '46% ≤ GC < 53%', '53% enters H3'],
          ['H3', '53% ≤ GC ≤ 100%', 'No upper category'],
        ],
      },
    },
    {
      id: 'models', title: 'Why definitions of homogeneity matter',
      paragraphs: [
        'The isochore literature contains substantive disagreement about definitions and tests. Cohen and colleagues evaluated properties including compositional differences, homogeneity, and length using a sequence-based segmentation analysis. Clay and Bernardi disputed aspects of their criteria and interpretation in a published response.',
        'Those papers are useful to read together. “Relatively homogeneous” needs an explicit comparison and a specified scale. Testing whether variation is small relative to another region is a different question from testing whether it is compatible with a particular random-sequence model.',
        'For a library or browser, the practical consequence is to name the representation accurately. A computed window class is a computed window class. A proposed compositional domain needs a boundary rule and an account of what was tested. The existence of regional GC variation does not by itself settle every version of the isochore framework.',
      ], sourceIds: ['cohen', 'reply'],
    },
    {
      id: 'biological-context', title: 'Connections to genes, repeats, and replication',
      paragraphs: [
        'Broad composition can provide context for other features. The chromosome 19 sequencing study documented high GC content together with high gene density and distinctive repeat organization. This motivates comparing compositional landscapes with gene and repeat annotations, rather than treating them as unrelated tracks.',
        'Replication timing adds a cellular dimension. Hiratani and colleagues examined selected genes as mouse embryonic stem cells differentiated into neural precursors. They reported differentiation-associated timing changes in AT-rich, LINE-rich compositional settings. The study connects genomic context with a changing cell state; it does not make GC content a universal clock for replication.',
        'Gene density, repeat composition, accessibility, and replication timing are distinct observations. Their relationships can depend on the intervals sampled and the cell type. A GC class alone should not be used to assign an expression state or infer which chromatin-maintenance mechanism is active at a locus.',
      ], sourceIds: ['chr19', 'replication'],
    },
    {
      id: 'evolution', title: 'A landscape also has an evolutionary history',
      paragraphs: [
        'A present-day composition profile describes a sequence; explaining how it arose requires additional evidence. Katzman and colleagues found human allele-frequency patterns consistent with a fixation bias favoring G/C alleles, enriched near recombination hotspots. They interpreted the observations as supporting a recombination-associated process such as GC-biased gene conversion.',
        'That study supplies a candidate evolutionary process, not a license to assign one origin to every GC-rich region. Comparisons of related sequences, mutation and recombination data, and an explicit evolutionary model are needed to distinguish explanations. Similar composition by itself does not establish shared ancestry.',
      ], sourceIds: ['evolution'],
    },
    {
      id: 'reading', title: 'Read a compositional view with its provenance',
      paragraphs: [
        'Keep four questions attached to a view: Which reference sequence is being summarized? What is the window or domain definition? How were ambiguous positions handled? Is the output a numerical fraction, a class label, or a proposed boundary?',
        'Polymer’s current ingestion implementation classifies fixed GC windows. The chromosome overview uses schematic isochore colors and provides context rather than a quantitative composition measurement. The browser links below select the available isochore annotations alongside genes. Check the active layer’s provenance and resolution rather than assuming that all these views use the same data or method.',
        'A useful connection to chromatin biology begins with a well-defined composition measurement and a separately defined chromatin observation. The relationship between them is a question to investigate, with the relevant experimental and computational evidence attached.',
      ],
    },
  ],
  references: [
    { id: 'map', title: 'An isochore map of human chromosomes', citation: 'Costantini et al. · Genome Research · 2006', href: 'https://pubmed.ncbi.nlm.nih.gov/16597586/' },
    { id: 'cohen', title: 'GC Composition of the Human Genome: In Search of Isochores', citation: 'Cohen et al. · Molecular Biology and Evolution · 2005', href: 'https://academic.oup.com/mbe/article/22/5/1260/1066937' },
    { id: 'reply', title: 'How Not to Search for Isochores: A Reply to Cohen et al.', citation: 'Clay & Bernardi · Molecular Biology and Evolution · 2005', href: 'https://pubmed.ncbi.nlm.nih.gov/16093569/' },
    { id: 'chr19', title: 'The DNA sequence and biology of human chromosome 19', citation: 'Grimwood et al. · Nature · 2004', href: 'https://www.nature.com/articles/nature02399' },
    { id: 'replication', title: 'Differentiation-induced replication-timing changes are restricted to AT-rich/long interspersed nuclear element (LINE)-rich isochores', citation: 'Hiratani et al. · PNAS · 2004', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC534734/' },
    { id: 'evolution', title: 'Ongoing GC-biased evolution is widespread in the human genome and enriched near recombination hot spots', citation: 'Katzman et al. · Genome Biology and Evolution · 2011', href: 'https://pubmed.ncbi.nlm.nih.gov/21697099/' },
  ],
  related: ['gc-content', 'chromatin-maintenance', 'repeating-and-nonrepeating-dna', 'genomic-coordinates', 'material-channel'],
  tools: [browser, chromosome19, sources, methods],
};
