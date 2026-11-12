import type { LibraryArticle } from '../library';

export const CHROMATIN_ARTICLE: LibraryArticle = {
  slug: 'chromatin-maintenance',
  title: 'Chromatin maintenance and epigenetic machinery',
  description: 'How cells organize DNA, rebuild chromatin after replication, and maintain the capacity to change state.',
  kind: 'Topic', collection: 'foundations', order: 7,
  subjects: ['organization', 'epigenetics'],
  terms: ['nucleosome', 'histone', 'DNMT1', 'UHRF1', 'DNMT3A', 'DNMT3B', 'TET', 'PRC2', 'EZH2', 'EED', 'HP1', 'SWI/SNF', 'BAF', 'CAF-1', 'MCM2', 'CBP', 'CREBBP', 'HDAC1', 'UTX', 'KDM6A', 'acetylation', 'epigenetic inheritance', 'replication', 'reader', 'writer', 'eraser', 'chaperone'],
  updated: '2026-11-11', status: 'Editorial draft', figure: 'chromatin',
  sections: [
    {
      id: 'organization', title: 'What is being maintained?',
      paragraphs: [
        'A genome in a cell is organized as chromatin: DNA associated with histones and other proteins. Its organization includes nucleosome placement, the chemical modification of DNA and histones, and the accessibility of particular regions. These are distinguishable features, measured by different experiments.',
        'Maintenance is an active problem. During replication, cells must copy DNA and rebuild its packaging. Experiments following newly replicated chromatin show that parental histone modifications can retain their genomic localization while the restoration of modification levels follows different kinetics at different marks and loci. An epigenetic state is therefore more than a static label on a sequence.',
      ], sourceIds: ['luger', 'reveron'],
    },
    {
      id: 'nucleosome', title: 'The nucleosome as a physical substrate',
      paragraphs: [
        'In a nucleosome core particle, DNA wraps around an octamer containing two copies each of histones H2A, H2B, H3, and H4. The foundational crystal structure resolved how DNA follows a superhelical path around that protein core. Packaging gives the same DNA molecule a different physical context from an isolated duplex.',
        'A useful distinction is between the substrate and the machinery acting on it. DNA geometry and histone contacts describe the substrate. An ATP-dependent remodeling complex performs work on it. Human BAF structures show an ATPase motor positioned to move DNA along the nucleosome. A sequence-derived thermodynamic profile and a cellular chromatin measurement answer different questions.',
      ], sourceIds: ['luger', 'baf'],
    },
    {
      id: 'machinery', title: 'Different activities, different substrates',
      paragraphs: [
        'Writers, readers, and erasers are shorthand for molecular activities. They become more informative when the substrate is named: methylation of DNA cytosine is chemically different from methylation of a histone lysine. Remodelers and chaperones add another distinction, changing organization or assisting assembly rather than simply adding a mark.',
      ],
      table: {
        caption: 'Selected chromatin activities and examples',
        headings: ['Activity', 'Example', 'What it does'],
        rows: [
          ['Write a DNA modification', 'DNMT3A / DNMT3B', 'Establish DNA methylation patterns; distinguish this from copying an existing pattern.'],
          ['Write a histone modification', 'PRC2, including EZH2', 'Methylate lysine 27 of histone H3. The substrate is a histone residue, not DNA cytosine.'],
          ['Remove a histone methyl modification', 'UTX / KDM6A', 'Demethylate H3K27; an example of an eraser activity acting on a defined substrate.'],
          ['Add or remove histone acetyl groups', 'CBP / CREBBP; HDAC1', 'Histone acetyltransferase and deacetylase activities, respectively; distinct chemistry from methylation.'],
          ['Recognize a modified substrate', 'UHRF1; EED; HP1', 'Recognize particular DNA or histone features within maintenance or regulatory systems.'],
          ['Chemically modify an existing mark', 'TET enzymes', 'Oxidize 5-methylcytosine; oxidation is a step in modification turnover, not immediate restoration of unmodified cytosine.'],
          ['Remodel a nucleosome', 'SWI/SNF-family BAF', 'Couple ATP-dependent activity to DNA movement on a nucleosome.'],
          ['Assist chromatin assembly', 'CAF-1', 'Support replication-associated chromatin assembly; this activity differs from writing a chemical modification.'],
        ],
      }, sourceIds: ['okano', 'bostick', 'margueron', 'bannister', 'tahiliani', 'baf', 'caf1', 'utx', 'cbp', 'hdac'],
    },
    {
      id: 'replication', title: 'Replication creates a restoration problem',
      paragraphs: [
        'DNA replication produces two daughter duplexes from one parental duplex. Histones associated with the parental DNA must also be handled. Some are recycled onto daughter DNA, while chromatin assembly incorporates additional histones. Early human cell-free experiments identified CAF-1 as a factor supporting chromatin assembly during replication.',
        'Petryk and colleagues studied parental histone inheritance in mouse embryonic stem cells. Disrupting histone binding by MCM2 shifted the distribution of parental histones toward the leading strand, supporting a role for replication machinery in their balanced transfer. This is evidence about histone handling during replication, not a demonstration that each modification is copied by the same route.',
        'Reverón-Gómez and colleagues followed modified histones on newly replicated DNA in human cells. Their work separated preservation of parental modification patterns from subsequent restoration, which varied by modification and locus. Re-establishing a landscape is a process over time rather than an instantaneous duplication of every feature.',
      ], sourceIds: ['caf1', 'petryk', 'reveron'],
    },
    {
      id: 'methylation', title: 'Establishing, maintaining, and changing DNA methylation',
      paragraphs: [
        'At a symmetrically methylated CpG site, replication initially leaves each daughter duplex with a methylated parental strand and an unmethylated new strand. This hemimethylated state supplies information about the previous pattern. UHRF1 preferentially recognizes hemimethylated CpG DNA and interacts with DNMT1, helping couple recognition to maintenance methylation.',
        'Establishment is a different task. Mouse gene-targeting experiments showed that Dnmt3a and Dnmt3b are required for de novo methylation in embryonic stem cells and early embryos. Maintenance and de novo methylation describe useful functional distinctions; they should not be read as an exhaustive account of every enzyme activity in every cell type.',
        'Changing a DNA modification also requires chemical specificity. TET1 was shown to convert 5-methylcytosine to 5-hydroxymethylcytosine. Subsequent work demonstrated further TET-catalyzed oxidation to 5-formylcytosine and 5-carboxylcytosine. Oxidation changes the modification state; it is not equivalent to removing a methyl group in one direct step.',
      ], sourceIds: ['bostick', 'okano', 'tahiliani', 'ito'],
    },
    {
      id: 'reinforcement', title: 'Recognition can reinforce a chromatin state',
      paragraphs: [
        'Polycomb repressive complex 2 provides a concrete example of a reader–writer relationship. EZH2 is its catalytic methyltransferase subunit, while EED can recognize repressive methyl-lysine marks. Experiments showed that recognition can stimulate PRC2 activity, providing a mechanism for reinforcing H3K27 trimethylation. H3K27me3 means three methyl groups on lysine 27 of histone H3.',
        'A distinct system involves HP1 recognition of methylated lysine 9 on histone H3. Biochemical and genetic work connected that recognition to heterochromatin targeting and repression. H3K9-associated and Polycomb-associated systems should remain distinguishable even though both are discussed in relation to repressive chromatin.',
        'These examples illustrate how recognition and enzymatic action can cooperate. Which machinery is recruited, and what its action means for transcription, still depends on the locus and cellular setting. A mark name alone does not explain the full mechanism at a region.',
      ], sourceIds: ['margueron', 'bannister'],
    },
    {
      id: 'material-context', title: 'Connecting material properties to cellular regulation',
      paragraphs: [
        'The material-channel perspective brings the physical substrate into the explanation: sequence composition and order, duplex properties, nucleosome geometry, and the work done by molecular machinery. The useful question is which of those quantities an experiment or model actually addresses.',
        'A correlation between GC content and a chromatin annotation does not establish how a region acquired its state. Likewise, a calculation on an isolated DNA sequence does not by itself measure cellular accessibility or maintenance. Keep sequence-derived properties, molecular structures, biochemical activities, and cellular observations connected through explicit evidence.',
      ],
    },
    {
      id: 'measurement', title: 'Different assays reveal different features',
      paragraphs: [
        'An accessibility assay, a protein-association assay, and a DNA-modification assay are complementary views. ATAC-seq uses transposase insertion to profile accessible chromatin. ChIP-seq enriches DNA associated with a selected protein or epitope. Bisulfite-based methods use chemical conversion to read cytosine modification patterns. Their outputs are not interchangeable chromatin-state measurements.',
        'When interpreting a Polymer track, identify the assay, sample or cell type, assembly, and annotation source. A reference annotation can supply context for a region; it should not be presented as a direct measurement of the current state of an unmeasured sample.',
      ], sourceIds: ['atac', 'chip', 'frommer'],
    },
  ],
  references: [
    { id: 'luger', title: 'Crystal structure of the nucleosome core particle at 2.8 Å resolution', citation: 'Luger et al. · Nature · 1997', href: 'https://www.nature.com/articles/38444' },
    { id: 'baf', title: 'Structure of nucleosome-bound human BAF complex', citation: 'He et al. · Science · 2020', href: 'https://pubmed.ncbi.nlm.nih.gov/32001526/' },
    { id: 'caf1', title: 'Purification and characterization of CAF-I, a human cell factor required for chromatin assembly during DNA replication in vitro', citation: 'Smith & Stillman · Cell · 1989', href: 'https://pubmed.ncbi.nlm.nih.gov/2546672/' },
    { id: 'petryk', title: 'MCM2 promotes symmetric inheritance of modified histones during DNA replication', citation: 'Petryk et al. · Science · 2018', href: 'https://pubmed.ncbi.nlm.nih.gov/30115746/' },
    { id: 'reveron', title: 'Accurate Recycling of Parental Histones Reproduces the Histone Modification Landscape during DNA Replication', citation: 'Reverón-Gómez et al. · Molecular Cell · 2018', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6202308/' },
    { id: 'bostick', title: 'UHRF1 plays a role in maintaining DNA methylation in mammalian cells', citation: 'Bostick et al. · Science · 2007', href: 'https://pubmed.ncbi.nlm.nih.gov/17673620/' },
    { id: 'okano', title: 'DNA methyltransferases Dnmt3a and Dnmt3b are essential for de novo methylation and mammalian development', citation: 'Okano et al. · Cell · 1999', href: 'https://pubmed.ncbi.nlm.nih.gov/10555141/' },
    { id: 'tahiliani', title: 'Conversion of 5-methylcytosine to 5-hydroxymethylcytosine in mammalian DNA by MLL partner TET1', citation: 'Tahiliani et al. · Science · 2009', href: 'https://pubmed.ncbi.nlm.nih.gov/19372391/' },
    { id: 'ito', title: 'Tet proteins can convert 5-methylcytosine to 5-formylcytosine and 5-carboxylcytosine', citation: 'Ito et al. · Science · 2011', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3495246/' },
    { id: 'margueron', title: 'Role of the polycomb protein Eed in the propagation of repressive histone marks', citation: 'Margueron et al. · Nature · 2009', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3772642/' },
    { id: 'bannister', title: 'Selective recognition of methylated lysine 9 on histone H3 by the HP1 chromo domain', citation: 'Bannister et al. · Nature · 2001', href: 'https://pubmed.ncbi.nlm.nih.gov/11242054/' },
    { id: 'atac', title: 'Transposition of native chromatin for fast and sensitive epigenomic profiling of open chromatin, DNA-binding proteins and nucleosome position', citation: 'Buenrostro et al. · Nature Methods · 2013', href: 'https://pubmed.ncbi.nlm.nih.gov/24097267/' },
    { id: 'chip', title: 'Genome-wide mapping of in vivo protein-DNA interactions', citation: 'Johnson et al. · Science · 2007', href: 'https://pubmed.ncbi.nlm.nih.gov/17540862/' },
    { id: 'frommer', title: 'A genomic sequencing protocol that yields a positive display of 5-methylcytosine residues in individual DNA strands', citation: 'Frommer et al. · PNAS · 1992', href: 'https://pubmed.ncbi.nlm.nih.gov/1542678/' },
    { id: 'utx', title: 'Demethylation of H3K27 regulates polycomb recruitment and H2A ubiquitination', citation: 'Lee et al. · Science · 2007', href: 'https://pubmed.ncbi.nlm.nih.gov/17761849/' },
    { id: 'cbp', title: 'The CBP co-activator is a histone acetyltransferase', citation: 'Bannister & Kouzarides · Nature · 1996', href: 'https://pubmed.ncbi.nlm.nih.gov/8967953/' },
    { id: 'hdac', title: 'A mammalian histone deacetylase related to the yeast transcriptional regulator Rpd3p', citation: 'Taunton et al. · Science · 1996', href: 'https://pubmed.ncbi.nlm.nih.gov/8602529/' },
  ],
  related: ['cpg-distribution', 'repeating-and-nonrepeating-dna', 'isochores', 'dna-thermodynamics', 'dna-mechanics', 'physical-annotation-and-evidence'],
  tools: [
    { title: 'Digital Karyotype', description: 'Explore chromosome organization and available regional annotations.', href: '/genomics/atlas' },
    { title: 'Data sources', description: 'Inspect the provenance and context of Polymer’s annotation layers.', href: '/genomics/data-sources' },
    { title: 'Polymer methodology', description: 'Check the assumptions behind the quantities displayed by the tools.', href: '/genomics/docs/methodology' },
  ],
};
