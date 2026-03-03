/**
 * Curated notable genes, facts, and disease associations per chromosome.
 * Editorial content for the Atlas detail view.
 */

export interface GeneFact {
  symbol: string;
  band: string;
  description: string;
}

export interface ChromosomeFacts {
  notableGenes: GeneFact[];
  facts: string[];
  diseases: string[];
  largestGene?: string;
}

export const CHROMOSOME_FACTS: Record<string, ChromosomeFacts> = {
  chr1: {
    notableGenes: [
      { symbol: 'TP73', band: '1p36.32', description: 'Tumor protein p73, p53 family member' },
      { symbol: 'MTHFR', band: '1p36.22', description: 'Methylenetetrahydrofolate reductase' },
      { symbol: 'NOTCH2', band: '1p12', description: 'Notch receptor 2, developmental signaling' },
      { symbol: 'MPZ', band: '1q23.3', description: 'Myelin protein zero' },
      { symbol: 'ABL2', band: '1q25.2', description: 'ABL proto-oncogene 2' },
      { symbol: 'FH', band: '1q43', description: 'Fumarate hydratase, TCA cycle enzyme' },
    ],
    facts: [
      'Largest human chromosome at 249 Mb',
      'Contains ~2,000 protein-coding genes',
      '1p36 deletion is the most common terminal deletion syndrome',
    ],
    diseases: ['Charcot-Marie-Tooth 1B', 'Gaucher disease', 'Hereditary leiomyomatosis'],
    largestGene: 'RYR2 (790 kb)',
  },
  chr2: {
    notableGenes: [
      { symbol: 'ALK', band: '2p23.2', description: 'Anaplastic lymphoma kinase' },
      { symbol: 'MSH2', band: '2p21', description: 'DNA mismatch repair, Lynch syndrome' },
      { symbol: 'MSH6', band: '2p16.3', description: 'DNA mismatch repair' },
      { symbol: 'PAX3', band: '2q36.1', description: 'Paired box 3, Waardenburg syndrome' },
      { symbol: 'STAT1', band: '2q32.2', description: 'Signal transducer JAK-STAT pathway' },
    ],
    facts: [
      'Formed by fusion of two ancestral primate chromosomes',
      'Contains the HOXD cluster controlling limb development',
      'Second largest chromosome at 242 Mb',
    ],
    diseases: ['Lynch syndrome', 'Waardenburg syndrome', 'Alström syndrome'],
    largestGene: 'CNTNAP5 (1.3 Mb)',
  },
  chr3: {
    notableGenes: [
      { symbol: 'VHL', band: '3p25.3', description: 'Von Hippel-Lindau tumor suppressor' },
      { symbol: 'FHIT', band: '3p14.2', description: 'Fragile histidine triad, tumor suppressor' },
      { symbol: 'MLH1', band: '3p21.3', description: 'DNA mismatch repair' },
      { symbol: 'PIK3CA', band: '3q26.32', description: 'PI3K catalytic subunit alpha' },
      { symbol: 'SOX2', band: '3q26.33', description: 'Pluripotency transcription factor' },
    ],
    facts: [
      '3p loss is frequent in renal cell carcinoma',
      'Contains the most common fragile site FRA3B',
      'Home to the FHIT gene spanning 1.5 Mb',
    ],
    diseases: ['Von Hippel-Lindau disease', 'Renal cell carcinoma', 'Lynch syndrome'],
    largestGene: 'FHIT (1.5 Mb)',
  },
  chr4: {
    notableGenes: [
      { symbol: 'WHSC1', band: '4p16.3', description: 'Wolf-Hirschhorn syndrome candidate 1' },
      { symbol: 'FGFR3', band: '4p16.3', description: 'Fibroblast growth factor receptor 3' },
      { symbol: 'KIT', band: '4q12', description: 'Mast/stem cell growth factor receptor' },
      { symbol: 'PDGFRA', band: '4q12', description: 'Platelet-derived growth factor receptor' },
      { symbol: 'TET2', band: '4q24', description: 'Tet methylcytosine dioxygenase 2' },
    ],
    facts: [
      'Contains the Huntington disease gene HTT at 4p16.3',
      'Home to TET2, a key epigenetic regulator',
      'KIT/PDGFRA cluster drives GIST tumors',
    ],
    diseases: ['Huntington disease', 'Wolf-Hirschhorn syndrome', 'Achondroplasia'],
    largestGene: 'GRID2 (1.5 Mb)',
  },
  chr5: {
    notableGenes: [
      { symbol: 'TERT', band: '5p15.33', description: 'Telomerase reverse transcriptase' },
      { symbol: 'APC', band: '5q22.2', description: 'Adenomatous polyposis coli' },
      { symbol: 'EGR1', band: '5q31.2', description: 'Early growth response 1' },
      { symbol: 'CSF1R', band: '5q32', description: 'Colony stimulating factor 1 receptor' },
      { symbol: 'NSD1', band: '5q35.3', description: 'Nuclear receptor SET domain 1' },
    ],
    facts: [
      'Contains TERT, the catalytic subunit of telomerase',
      'del(5q) is a defining feature of the 5q- myelodysplastic syndrome',
      'Home to the APC tumor suppressor',
    ],
    diseases: ['Familial adenomatous polyposis', '5q- syndrome', 'Sotos syndrome'],
    largestGene: 'CTNNA1 (385 kb)',
  },
  chr6: {
    notableGenes: [
      { symbol: 'HLA-A', band: '6p22.1', description: 'Major histocompatibility complex class I' },
      { symbol: 'HLA-DRB1', band: '6p21.32', description: 'MHC class II, DR beta 1' },
      { symbol: 'TNF', band: '6p21.33', description: 'Tumor necrosis factor' },
      { symbol: 'VEGFA', band: '6p21.1', description: 'Vascular endothelial growth factor A' },
      { symbol: 'ESR1', band: '6q25.1', description: 'Estrogen receptor alpha' },
    ],
    facts: [
      'Contains the MHC/HLA locus — most polymorphic region in the genome',
      'The HLA complex spans 3.6 Mb with >200 genes',
      'HLA associations underlie >100 autoimmune diseases',
    ],
    diseases: ['Type 1 diabetes', 'Ankylosing spondylitis', 'Celiac disease'],
    largestGene: 'PARK2 (1.4 Mb)',
  },
  chr7: {
    notableGenes: [
      { symbol: 'EGFR', band: '7p11.2', description: 'Epidermal growth factor receptor' },
      { symbol: 'BRAF', band: '7q34', description: 'B-Raf proto-oncogene, serine/threonine kinase' },
      { symbol: 'MET', band: '7q31.2', description: 'Hepatocyte growth factor receptor' },
      { symbol: 'CFTR', band: '7q31.2', description: 'Cystic fibrosis transmembrane regulator' },
      { symbol: 'SHH', band: '7q36.3', description: 'Sonic hedgehog signaling molecule' },
      { symbol: 'ELN', band: '7q11.23', description: 'Elastin, Williams syndrome region' },
    ],
    facts: [
      'CFTR was one of the first genes cloned by positional cloning (1989)',
      '7q11.23 deletion causes Williams syndrome',
      'Contains HOXA cluster controlling anterior body patterning',
    ],
    diseases: ['Cystic fibrosis', 'Williams syndrome', 'Lung adenocarcinoma (EGFR)'],
    largestGene: 'CNTNAP2 (2.3 Mb)',
  },
  chr8: {
    notableGenes: [
      { symbol: 'MYC', band: '8q24.21', description: 'MYC proto-oncogene, master transcription factor' },
      { symbol: 'FGFR1', band: '8p11.23', description: 'Fibroblast growth factor receptor 1' },
      { symbol: 'TNFRSF10B', band: '8p21.3', description: 'TRAIL receptor 2, apoptosis' },
      { symbol: 'NRG1', band: '8p12', description: 'Neuregulin 1' },
    ],
    facts: [
      'MYC at 8q24 is one of the most amplified oncogenes in cancer',
      't(8;14) MYC-IGH translocation defines Burkitt lymphoma',
      '8q24 desert region contains multiple GWAS cancer risk loci',
    ],
    diseases: ['Burkitt lymphoma', 'Bladder cancer', 'Pfeiffer syndrome'],
    largestGene: 'CSMD1 (2.1 Mb)',
  },
  chr9: {
    notableGenes: [
      { symbol: 'CDKN2A', band: '9p21.3', description: 'Cyclin-dependent kinase inhibitor 2A (p16)' },
      { symbol: 'ABL1', band: '9q34.12', description: 'ABL proto-oncogene 1, Philadelphia chromosome' },
      { symbol: 'TSC1', band: '9q34.13', description: 'Tuberous sclerosis 1' },
      { symbol: 'NOTCH1', band: '9q34.3', description: 'Notch receptor 1' },
      { symbol: 'JAK2', band: '9p24.1', description: 'Janus kinase 2' },
    ],
    facts: [
      'ABL1 forms the BCR-ABL1 fusion in chronic myeloid leukemia',
      'Contains the ABO blood group gene at 9q34.2',
      '9p21.3 (CDKN2A) is the most frequently deleted locus in cancer',
    ],
    diseases: ['Chronic myeloid leukemia', 'Melanoma', 'Tuberous sclerosis'],
    largestGene: 'PTPRD (2.3 Mb)',
  },
  chr10: {
    notableGenes: [
      { symbol: 'PTEN', band: '10q23.31', description: 'Phosphatase and tensin homolog, tumor suppressor' },
      { symbol: 'RET', band: '10q11.21', description: 'RET proto-oncogene, receptor tyrosine kinase' },
      { symbol: 'FGFR2', band: '10q26.13', description: 'Fibroblast growth factor receptor 2' },
      { symbol: 'KAT6B', band: '10q22.2', description: 'Lysine acetyltransferase 6B' },
    ],
    facts: [
      'PTEN is one of the most commonly mutated tumor suppressors',
      'RET activating mutations cause multiple endocrine neoplasia type 2',
      'Contains the DMBT1 gene spanning 81 kb',
    ],
    diseases: ['Cowden syndrome', 'MEN type 2', 'Endometrial cancer'],
    largestGene: 'NRG3 (1.1 Mb)',
  },
  chr11: {
    notableGenes: [
      { symbol: 'HBB', band: '11p15.4', description: 'Hemoglobin subunit beta' },
      { symbol: 'INS', band: '11p15.5', description: 'Insulin' },
      { symbol: 'WT1', band: '11p13', description: 'Wilms tumor 1' },
      { symbol: 'ATM', band: '11q22.3', description: 'Ataxia telangiectasia mutated' },
      { symbol: 'MLL', band: '11q23.3', description: 'Mixed lineage leukemia / KMT2A' },
    ],
    facts: [
      'Contains the beta-globin cluster (HBE1, HBG1/2, HBD, HBB)',
      '11p15.5 is an imprinted region — Beckwith-Wiedemann syndrome',
      'KMT2A (MLL) rearrangements define infant leukemia',
    ],
    diseases: ['Sickle cell disease', 'Beta-thalassemia', 'Beckwith-Wiedemann syndrome'],
    largestGene: 'DLG2 (2.2 Mb)',
  },
  chr12: {
    notableGenes: [
      { symbol: 'KRAS', band: '12p12.1', description: 'KRAS proto-oncogene, GTPase' },
      { symbol: 'CDK4', band: '12q14.1', description: 'Cyclin-dependent kinase 4' },
      { symbol: 'MDM2', band: '12q15', description: 'MDM2 proto-oncogene, p53 regulator' },
      { symbol: 'ETV6', band: '12p13.2', description: 'ETS variant 6, leukemia fusions' },
      { symbol: 'PAH', band: '12q23.2', description: 'Phenylalanine hydroxylase' },
    ],
    facts: [
      'KRAS mutations drive ~25% of all human cancers',
      'MDM2 amplification is a hallmark of liposarcoma',
      'Contains the HOX C cluster at 12q13',
    ],
    diseases: ['Phenylketonuria', 'Pancreatic cancer (KRAS)', 'Liposarcoma (MDM2)'],
    largestGene: 'NELL2 (740 kb)',
  },
  chr13: {
    notableGenes: [
      { symbol: 'RB1', band: '13q14.2', description: 'Retinoblastoma 1, first tumor suppressor cloned' },
      { symbol: 'BRCA2', band: '13q13.1', description: 'BRCA2, DNA repair' },
      { symbol: 'FLT3', band: '13q12.2', description: 'FMS-like tyrosine kinase 3' },
      { symbol: 'ATP7B', band: '13q14.3', description: 'ATPase copper transporting beta' },
    ],
    facts: [
      'RB1 was the first tumor suppressor gene identified (1986)',
      'Acrocentric — involved in Robertsonian translocations',
      'Contains BRCA2, key to homologous recombination repair',
    ],
    diseases: ['Retinoblastoma', 'Breast/ovarian cancer (BRCA2)', 'Wilson disease'],
    largestGene: 'PCDH9 (940 kb)',
  },
  chr14: {
    notableGenes: [
      { symbol: 'IGH', band: '14q32.33', description: 'Immunoglobulin heavy chain locus' },
      { symbol: 'AKT1', band: '14q32.33', description: 'AKT serine/threonine kinase 1' },
      { symbol: 'DICER1', band: '14q32.13', description: 'RNase III enzyme for miRNA processing' },
      { symbol: 'FOXG1', band: '14q12', description: 'Forkhead box G1, brain development' },
    ],
    facts: [
      'Houses the immunoglobulin heavy chain locus (1.25 Mb)',
      'Acrocentric — contributes to Robertsonian translocations',
      't(8;14) IGH-MYC drives Burkitt lymphoma',
    ],
    diseases: ['Burkitt lymphoma', 'Multiple myeloma', 'FOXG1 syndrome'],
    largestGene: 'NRXN3 (1.7 Mb)',
  },
  chr15: {
    notableGenes: [
      { symbol: 'UBE3A', band: '15q11.2', description: 'Ubiquitin protein ligase E3A, imprinted' },
      { symbol: 'FBN1', band: '15q21.1', description: 'Fibrillin 1, Marfan syndrome' },
      { symbol: 'PML', band: '15q24.1', description: 'Promyelocytic leukemia, APL fusion partner' },
      { symbol: 'IDH2', band: '15q26.1', description: 'Isocitrate dehydrogenase 2' },
    ],
    facts: [
      '15q11-13 imprinting: paternal deletion → Prader-Willi, maternal → Angelman',
      'PML-RARA fusion t(15;17) defines acute promyelocytic leukemia',
      'Acrocentric chromosome',
    ],
    diseases: ['Prader-Willi syndrome', 'Angelman syndrome', 'Marfan syndrome'],
    largestGene: 'RORA (730 kb)',
  },
  chr16: {
    notableGenes: [
      { symbol: 'HBA1', band: '16p13.3', description: 'Hemoglobin subunit alpha 1' },
      { symbol: 'TSC2', band: '16p13.3', description: 'Tuberous sclerosis 2' },
      { symbol: 'CBFB', band: '16q22.1', description: 'Core binding factor beta, AML fusions' },
      { symbol: 'CDH1', band: '16q22.1', description: 'E-cadherin, diffuse gastric cancer' },
      { symbol: 'VAC14', band: '16q22.1', description: 'VAC14 component of PIKfyve complex' },
    ],
    facts: [
      'Contains the alpha-globin cluster at 16p13.3',
      'Highest gene density of any chromosome (~25 genes/Mb)',
      'inv(16) CBFB-MYH11 defines core binding factor AML',
    ],
    diseases: ['Alpha-thalassemia', 'Tuberous sclerosis', 'Hereditary diffuse gastric cancer'],
    largestGene: 'CDH8 (1.1 Mb)',
  },
  chr17: {
    notableGenes: [
      { symbol: 'TP53', band: '17p13.1', description: 'Tumor protein p53, guardian of the genome' },
      { symbol: 'BRCA1', band: '17q21.31', description: 'BRCA1, DNA repair' },
      { symbol: 'ERBB2', band: '17q12', description: 'HER2, breast cancer target' },
      { symbol: 'NF1', band: '17q11.2', description: 'Neurofibromin 1' },
      { symbol: 'RARα', band: '17q21.2', description: 'Retinoic acid receptor alpha' },
      { symbol: 'PMP22', band: '17p12', description: 'Peripheral myelin protein 22' },
    ],
    facts: [
      'TP53 is mutated in >50% of all human cancers',
      'Most gene-dense chromosome per Mb along with chr19',
      'HER2 amplification defines ~20% of breast cancers',
    ],
    diseases: ['Li-Fraumeni syndrome', 'Breast cancer (BRCA1/HER2)', 'Neurofibromatosis type 1'],
    largestGene: 'NF1 (350 kb)',
  },
  chr18: {
    notableGenes: [
      { symbol: 'SMAD4', band: '18q21.2', description: 'SMAD family member 4, TGF-β signaling' },
      { symbol: 'DCC', band: '18q21.2', description: 'Deleted in colorectal cancer' },
      { symbol: 'BCL2', band: '18q21.33', description: 'BCL2 apoptosis regulator' },
      { symbol: 'SETBP1', band: '18q12.3', description: 'SET binding protein 1' },
    ],
    facts: [
      'Trisomy 18 (Edwards syndrome) is the second most common autosomal trisomy',
      'BCL2 translocation t(14;18) defines follicular lymphoma',
      '18q loss is frequent in colorectal cancer',
    ],
    diseases: ['Edwards syndrome', 'Follicular lymphoma', 'Juvenile polyposis (SMAD4)'],
    largestGene: 'DCC (1.2 Mb)',
  },
  chr19: {
    notableGenes: [
      { symbol: 'LDLR', band: '19p13.2', description: 'LDL receptor, familial hypercholesterolemia' },
      { symbol: 'STK11', band: '19p13.3', description: 'Serine/threonine kinase 11, Peutz-Jeghers' },
      { symbol: 'APOE', band: '19q13.32', description: 'Apolipoprotein E, Alzheimer risk' },
      { symbol: 'DNMT1', band: '19p13.2', description: 'DNA methyltransferase 1' },
      { symbol: 'CEBPA', band: '19q13.11', description: 'CCAAT enhancer binding protein alpha' },
    ],
    facts: [
      'Highest gene density in the genome (~26 genes/Mb)',
      'Extremely GC-rich (48.4%) — isochore H3',
      'Contains ~1,500 protein-coding genes despite small size',
    ],
    diseases: ['Familial hypercholesterolemia', 'Alzheimer disease (APOE4)', 'Peutz-Jeghers syndrome'],
    largestGene: 'RYR1 (154 kb)',
  },
  chr20: {
    notableGenes: [
      { symbol: 'ASXL1', band: '20q11.21', description: 'ASXL transcriptional regulator 1' },
      { symbol: 'JAG1', band: '20p12.2', description: 'Jagged 1, Notch ligand' },
      { symbol: 'GNAS', band: '20q13.32', description: 'G protein alpha stimulatory, imprinted' },
      { symbol: 'DNMT3B', band: '20q11.21', description: 'DNA methyltransferase 3B' },
    ],
    facts: [
      'Was the second chromosome fully sequenced (2001)',
      'ASXL1 is recurrently mutated in myeloid malignancies',
      'Contains multiple imprinted loci including GNAS',
    ],
    diseases: ['Alagille syndrome', 'Albright hereditary osteodystrophy', 'MDS (ASXL1)'],
    largestGene: 'MACROD2 (2.1 Mb)',
  },
  chr21: {
    notableGenes: [
      { symbol: 'DYRK1A', band: '21q22.13', description: 'Dual-specificity kinase, Down syndrome' },
      { symbol: 'RUNX1', band: '21q22.12', description: 'Runt-related transcription factor 1' },
      { symbol: 'APP', band: '21q21.3', description: 'Amyloid beta precursor protein' },
      { symbol: 'SOD1', band: '21q22.11', description: 'Superoxide dismutase 1, ALS' },
    ],
    facts: [
      'Trisomy 21 (Down syndrome) — most common viable autosomal trisomy',
      'Smallest autosomal gene content (~230 coding genes)',
      'RUNX1 translocations are frequent in leukemia',
    ],
    diseases: ['Down syndrome', 'AML (RUNX1)', 'Amyotrophic lateral sclerosis (SOD1)'],
    largestGene: 'DSCAM (840 kb)',
  },
  chr22: {
    notableGenes: [
      { symbol: 'BCR', band: '22q11.23', description: 'BCR activator of RhoGEF, CML fusion' },
      { symbol: 'NF2', band: '22q12.2', description: 'Merlin, neurofibromatosis type 2' },
      { symbol: 'SMARCB1', band: '22q11.23', description: 'SWI/SNF chromatin remodeling' },
      { symbol: 'CHEK2', band: '22q12.1', description: 'Checkpoint kinase 2, DNA damage response' },
    ],
    facts: [
      'First autosome fully sequenced (1999)',
      '22q11.2 deletion (DiGeorge syndrome) — most common microdeletion',
      'The Philadelphia chromosome t(9;22) creates BCR-ABL1',
    ],
    diseases: ['DiGeorge syndrome', 'Neurofibromatosis type 2', 'Chronic myeloid leukemia'],
    largestGene: 'LARGE1 (664 kb)',
  },
  chrX: {
    notableGenes: [
      { symbol: 'DMD', band: 'Xp21.2', description: 'Dystrophin, Duchenne muscular dystrophy' },
      { symbol: 'FMR1', band: 'Xq27.3', description: 'Fragile X messenger ribonucleoprotein 1' },
      { symbol: 'AR', band: 'Xq12', description: 'Androgen receptor' },
      { symbol: 'XIST', band: 'Xq13.2', description: 'X-inactive specific transcript, lncRNA' },
      { symbol: 'G6PD', band: 'Xq28', description: 'Glucose-6-phosphate dehydrogenase' },
      { symbol: 'F8', band: 'Xq28', description: 'Coagulation factor VIII' },
    ],
    facts: [
      'Subject to X-inactivation in females (Barr body)',
      'DMD (dystrophin) is the largest known gene at 2.2 Mb',
      'Contains ~800 protein-coding genes',
    ],
    diseases: ['Duchenne muscular dystrophy', 'Fragile X syndrome', 'Hemophilia A'],
    largestGene: 'DMD (2.2 Mb)',
  },
  chrY: {
    notableGenes: [
      { symbol: 'SRY', band: 'Yp11.2', description: 'Sex-determining region Y' },
      { symbol: 'RBMY1A1', band: 'Yq11.223', description: 'RNA binding motif, spermatogenesis' },
      { symbol: 'DAZ1', band: 'Yq11.223', description: 'Deleted in azoospermia 1' },
      { symbol: 'AMELY', band: 'Yp11.2', description: 'Amelogenin Y, forensic sex determination' },
    ],
    facts: [
      'Contains only ~70 protein-coding genes',
      'SRY triggers male sex determination',
      'Largely heterochromatic with extensive palindromic repeats',
    ],
    diseases: ['46,XY gonadal dysgenesis (Swyer syndrome)', 'Y chromosome infertility', 'Turner syndrome mosaicism'],
    largestGene: 'RBMY1A1 (40 kb)',
  },
  chrM: {
    notableGenes: [
      { symbol: 'MT-ND1', band: '', description: 'NADH dehydrogenase subunit 1' },
      { symbol: 'MT-CO1', band: '', description: 'Cytochrome c oxidase subunit I' },
      { symbol: 'MT-ATP6', band: '', description: 'ATP synthase F0 subunit 6' },
      { symbol: 'MT-CYB', band: '', description: 'Cytochrome b' },
    ],
    facts: [
      'Circular genome, 16,569 bp — maternally inherited',
      'Encodes 37 genes: 13 proteins, 22 tRNAs, 2 rRNAs',
      'Mutation rate ~10x higher than nuclear DNA',
    ],
    diseases: ['MELAS', 'MERRF', 'Leber hereditary optic neuropathy'],
  },
};
