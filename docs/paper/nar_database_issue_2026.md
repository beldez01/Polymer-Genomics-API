# Polymer Genomics: a database of genome-wide DNA biophysical properties with cross-layer annotation queries

**Authors:** [Your Name]^1

**Affiliations:** ^1 Polymer Bio, [City, State, Country]

**Corresponding author:** hello@polymerbio.org

**Database URL:** https://polymerbio.org

**API:** https://api.polymerbio.org (OpenAPI docs at /docs)

**Python SDK:** `pip install polymer-genomics` (PyPI, MIT license)

---

## ABSTRACT

Polymer Genomics (https://polymerbio.org) is a freely accessible database providing genome-wide DNA biophysical properties — including stacking free energy (ΔG₃₇), melting temperature, intrinsic curvature, groove geometry, dinucleotide periodicity, and structural form propensity — pre-computed at 1 kb resolution across the human genome (GRCh38 and GRCh37). These sequence-intrinsic material properties are integrated with 41 curated annotation layers from authoritative sources (GENCODE, ENCODE, gnomAD, GTEx, UCSC, RepeatMasker, and others), totaling over 53 million indexed features. A unified REST API enables cross-layer correlation and boolean intersection queries — for example, identifying CpG islands with unusual thermodynamic stability or correlating conservation with stacking energy across a gene locus. The platform also provides a physics linter that evaluates arbitrary DNA sequences (10–100,000 bp) for biophysical properties relevant to synthetic construct design. A Python SDK is available on PyPI. Polymer Genomics fills a gap in the genomic database ecosystem: while existing resources catalogue sequence, annotation, variation, and function, none provide the physical-chemical properties of DNA as a material polymer in a queryable, cross-referenced format.

## INTRODUCTION

The major genomic databases treat DNA as an information-carrying molecule. The UCSC Genome Browser (1) and Ensembl (2) provide sequence and gene annotation. ENCODE (3) catalogues functional elements. gnomAD (4) indexes genetic variation. GTEx (5) maps gene expression across tissues. These are indispensable resources, but they address a single channel of genetic information: the symbolic sequence of bases encoding genes, regulatory elements, and variants.

DNA is simultaneously a physical polymer. Its material properties — thermodynamic stability, mechanical stiffness, groove dimensions, and propensity for alternative structural forms — influence biological function through mechanisms independent of the encoded sequence. Stacking free energy (ΔG₃₇) determines the kinetics of strand separation during replication and transcription (6). Minor groove width modulates transcription factor binding specificity (7). Intrinsic curvature affects nucleosome positioning (8). CpG methylation simultaneously increases thermodynamic stability and decreases persistence length, with opposing effects on different mechanical modes (9, 10).

These properties are computable from published nearest-neighbor thermodynamic parameters (6, 11) and structural lookup tables (12, 13). Yet no existing database provides them genome-wide in a programmatically accessible format that can be queried alongside biological annotations. A researcher investigating whether conserved CpG islands have unusual thermodynamic properties must compute stacking energies ad hoc, download conservation scores separately, and write custom intersection code. Polymer Genomics eliminates this friction.

We present Polymer Genomics, a curated multi-layer database that provides genome-wide DNA biophysical properties alongside 40 biological annotation layers, queryable through a unified REST API with cross-layer correlation and intersection capabilities. The database is freely accessible, requires no registration, and includes a published Python SDK.

## DATABASE CONTENT

### Overview

Polymer Genomics organizes data into typed layers, each carrying structured provenance metadata: source database, license, evidence class, biological tier, and validation status. The database currently contains 41 active layers on GRCh38 (Table 1), with 14 GB of indexed data serving over 53 million features. Both GRCh38 and GRCh37 builds are supported.

### Sequence biophysics layer

The core novel contribution is the sequence biophysics layer (`sequence_biophysics_l0`), which provides 64 pre-computed properties at 1 kb resolution across the entire genome, organized into five groups:

*Core properties (8 tracks):* GC content, stacking free energy (ΔG₃₇; SantaLucia 1998 (6)), melting temperature, intrinsic curvature (Bolshoy wedge model (14)), dipole moment, minor groove width, dinucleotide periodicity, and deformability.

*DNAshape properties (8 tracks):* Minor groove width (MGW), propeller twist (ProT), roll, and helix twist (HelT), plus their positional derivatives, computed using the DNAshapeR framework (15).

*Methylation perturbation properties (10 tracks):* CpG density, predicted methylation-induced changes in ΔG₃₇ and Tm, methylation sensitivity (δΔG per CpG), methylation capacity, and demethylation cost. These represent the *potential* for methylation to perturb biophysical properties, computed from the sequence-intrinsic CpG distribution using published 5-methylcytosine thermodynamic parameters (9, 10). They are not measurements of methylation state.

*Green's function properties (4 tracks):* Correlation length, integrated response, perturbation reach, and response asymmetry, derived from a transfer matrix model of nearest-neighbor coupling.

*Extended properties (13 tracks):* G-quadruplex density and maximum score, k-mer complexity, dinucleotide entropy, dominant period, and additional structural metrics.

All properties are computed deterministically from the reference sequence using published parameters — no experimental data, machine learning models, or cell-type-specific assumptions are involved.

### Biological annotation layers

Forty additional layers integrate curated data from authoritative sources (Table 1). These span gene models (GENCODE v44 (16)), CpG annotation (29.4 million sites, 28,000 islands), methylation array probes (450K, EPIC v1, EPIC v2 with cross-platform mapping), evolutionary conservation (PhyloP/PhastCons 100-way (17)), regulatory elements (ENCODE cCREs v4 (3)), chromatin states (ChromHMM (18)), gene expression (GTEx v10 (5)), genetic constraint (gnomAD v4 (4)), repeat elements (RepeatMasker (19)), non-B DNA structure predictions (G-quadruplex, Z-DNA, cruciform; 2.9 million features), protein abundance (PaxDb (20)), protein localization (Human Protein Atlas (21)), pathway memberships (Reactome (22), MSigDB Hallmark (23)), and specialized layers including epigenetic clock probe coefficients, SBS mutation thermodynamics, and gene biosynthetic costs.

**Table 1.** Data layers in Polymer Genomics (GRCh38). Evidence classes: M = measured, K = curated, D = derived/computed, S = statistical.

| Category | Layer | Source | Features | Class |
|----------|-------|--------|----------|-------|
| **Biophysics** | Sequence biophysics L0 | This work | genome-wide (64 cols) | D |
| | Non-B DNA structures | Computed | 2,937,698 | D |
| | Fragility composite | Computed | 2,937,681 | D |
| **Gene annotation** | GENCODE v44 | GENCODE (16) | 3,039,917 | K |
| | Gene constraint | gnomAD v4 (4) | genome-wide | S |
| | Gene expression | GTEx v10 (5) | genome-wide | M |
| | Biosynthetic cost | Akashi-Gojobori (24) | genome-wide | D |
| **CpG / Methylation** | CpG sites | Computed | 29,401,795 | D |
| | CpG islands | UCSC (1) | 27,949 | D |
| | Methylation atlas | Loyfer 2023 (25) | 865,859 | M |
| | Probes (450K/EPIC v1/v2) | Illumina | 2,288,474 | D |
| | Epigenetic clock probes | Literature | multi-clock | K |
| **Regulatory** | ENCODE cCREs v4 | ENCODE (3) | genome-wide | S |
| | ChromHMM 15-state | Roadmap (18) | genome-wide | S |
| | Histone marks | ENCODE v3 | genome-wide | M |
| **Conservation** | PhyloP/PhastCons | UCSC 100-way (17) | genome-wide | S |
| **Repeats / Structure** | RepeatMasker | RepeatMasker (19) | 5,317,291 | S |
| | HERV loci | Telescope (26) | 14,203 | — |
| | Breakpoints | Mitelman/COSMIC | 49 | K |
| **Protein** | Protein abundance | PaxDb v6.0 (20) | genome-wide | M |
| | Protein atlas | HPA v23 (21) | genome-wide | M |
| **Pathways / Sets** | Reactome pathways | Reactome (22) | genome-wide | K |
| | MSigDB Hallmark | MSigDB (23) | genome-wide | K |
| **Disease / Variation** | GWAS catalog | EBI (27) | genome-wide | S |
| | SBS spectrum | COSMIC v3.4 (28) | 96 channels | K |
| **Genome structure** | Isochores | Computed | 10,307 | D |
| **HLA** | HLA allele biophysics | IPD-IMGT/HLA (30) | 22,259 alleles | D |

### Epistemic metadata

Each layer carries a structured epistemic classification: evidence class (M/K/D/S/H), biological tier (intrinsic, constrained, or active), equilibrium regime, and validation status. This metadata is included in every API response, enabling downstream consumers — including AI agents — to distinguish measured observations from computational predictions. The biophysics layer, for example, is classified as Derived/Intrinsic/Equilibrium: computed from sequence, invariant across cell types, and representing thermodynamic ground-state properties.

## API AND ACCESS

### REST API

The API at https://api.polymerbio.org serves all data through JSON endpoints documented via OpenAPI at `/docs`. Genomic data is returned in a GRanges-compatible format (seqnames, ranges, strand, mcols) with a response envelope containing provenance metadata, API version, data version, and per-layer source attribution.

Key endpoints include:

- **Region queries** (`GET /v1/regions/{build}/{region}`) — features from any combination of layers with field selection and cursor pagination
- **Cross-layer correlation** (`GET /v1/correlate/{build}/{region}`) — Pearson, Spearman, overlap enrichment, Jaccard, and Fisher exact test between any two layers
- **Cross-layer intersection** (`POST /v1/query/intersect`) — boolean AND across multiple layers with field-level filtering (e.g., "CpG islands where PhyloP > 3 AND stacking ΔG₃₇ < −1.7")
- **Region profile** (`GET /v1/profile/{build}/{region}`) — all layers queried simultaneously, returning feature counts, densities, and significance flags
- **Summary statistics** (`GET /v1/stats/{build}/{region}`) — mean, median, SD, percentiles for continuous layers
- **Sequence evaluation** (`POST /v1/evaluate`) — biophysical assessment of arbitrary DNA sequences (10–100,000 bp)
- **Batch evaluation** (`POST /v1/evaluate/batch`) — up to 100 sequences per request

Typical response latency for region queries under 500 kb is below 100 ms.

### Python SDK

A client library is published on PyPI (`pip install polymer-genomics`) providing typed methods for all endpoints:

```python
from polymer_genomics import PolymerClient
client = PolymerClient()

# Biophysical properties across the TP53 locus
data = client.region("hg38", "chr17:7668402-7676594",
                     layers=["sequence_biophysics_l0"],
                     fields=["gc_content", "stacking_dg37", "meth_sensitivity"])

# Cross-layer correlation
corr = client.correlate("hg38", "chr17:7668402-7687550",
                        layer_x="sequence_biophysics_l0",
                        layer_y="phylop_phastcons_100way")
```

### MCP server

An MCP (Model Context Protocol) server exposes 44 tools, enabling AI agents to query the database during reasoning with structured, hallucination-resistant responses.

## THE PHYSICS LINTER

The physics linter (`POST /v1/evaluate`) accepts an arbitrary DNA sequence and returns a structured biophysical assessment. It computes per-dinucleotide stacking ΔG₃₇ (6), salt-corrected thermodynamics, melting temperature, A/Z-form propensity (12), groove geometry (13), UV extinction at 260 nm (11), and CpG island detection (29). Results include 13 actionable flag types: CpG islands, homopolymer runs (≥8 and ≥12 bp), dinucleotide repeats, direct repeats (≥15 bp), inverted repeats (potential hairpins), extreme GC windows (>80% or <15%), Z-form propensity, and silencing risk (≥3 CpG islands).

The linter is a pure computation requiring no database or reference genome. A batch endpoint evaluates up to 100 sequences per request, and a comparison endpoint provides delta analysis of 2–10 variants. This is designed for synthetic biology workflows — evaluate constructs before synthesis, screen candidate libraries, and compare codon-optimized variants.

## APPLICATION EXAMPLE

To illustrate the cross-layer query capability, we queried the TP53 locus (chr17:7668402–7676594) for biophysical properties and overlaid them with conservation scores. The 9 kb region shows stacking ΔG₃₇ values ranging from −1.362 to −1.460 kcal/mol/step across 1 kb windows, with the most thermodynamically stable window (ΔG₃₇ = −1.460, GC = 0.546, Tm = 89.2°C) at positions 7674001–7675000 — coinciding with a region of elevated CpG density (0.024) and high methylation sensitivity (δΔG/CpG = 0.0083). The least stable window (ΔG₃₇ = −1.362, GC = 0.470, Tm = 85.5°C) at 7673001–7674000 has the lowest CpG density (0.016) and highest curvature (0.347).

This query — retrieving biophysical properties, CpG context, and conservation scores for the same region in a single API call — is not possible with any existing genomic database. Each property must otherwise be computed independently, downloaded from separate sources, and aligned manually.

### HLA allele biophysics and expression prediction

To demonstrate the database's capacity for allele-level biophysical analysis, we computed material-channel properties for all 22,259 HLA alleles in IPD-IMGT/HLA (30) across six transplant-relevant loci (HLA-A, -B, -C, -DRB1, -DQB1, -DPB1). For each allele with a full genomic sequence, we computed 22 biophysical properties for the whole allele and 9 properties restricted to non-coding regions (introns and UTRs). This directly addresses the finding of Bettens et al. (31) that non-coding cis-eQTLs explain 13–50% of HLA class I expression variance.

We performed a within-protein expression test: for each protein group containing both normally-expressed alleles and alleles bearing IMGT expression suffixes (L = low, Q = questionable, S = secreted, C = cytoplasmic, A = aberrant), we computed Cohen's d effect sizes on non-coding biophysical metrics while controlling for protein identity. Null (N) alleles were excluded as coding-level knockouts. Across HLA-A, 12 of 3,312 protein groups qualified (≥3 alleles with both normal and suffix-bearing members).

The results show large biophysical separation between expression classes. For HLA-A, the top five protein groups — A\*01:01 (|d| = 2.49), A\*03:01 (|d| = 2.32), A\*02:03 (|d| = 2.17), A\*26:01 (|d| = 1.71), and A\*31:01 (|d| = 1.46) — all exceed the conventional threshold for very large effects (|d| > 1.0). The signal replicates across all six loci: 56 of 11,879 protein groups qualify across the database, with every locus contributing qualifying groups and large effects (HLA-B: B\*56:01 |d| = 3.88; HLA-C: C\*17:01 |d| = 4.19; HLA-DQB1: DQB1\*03:03 |d| = 3.18). Aggregated across all 56 qualifying groups, the strongest discriminators were total Z-form penalty (mean |d| = 1.30), CpG count (mean |d| = 1.27), melting temperature (mean |d| = 1.07), and Z-form propensity (mean |d| = 1.00).

Feature-level decomposition reveals that the discriminating biophysical signal localizes to different non-coding regions depending on the protein group: UTRs for A\*01:01 and A\*03:01 (5'UTR CpG density |d| = 1.16 and |d| = 0.98, respectively), intron 1 for A\*26:01 (GC |d| = 2.79), and introns 4 and 7 for A\*31:01 (GC |d| = 3.97 and |d| = 1.87). This heterogeneity is biologically expected — HLA expression regulation involves multiple cis-regulatory elements — but the common thread is that CpG density and thermodynamic stability of regulatory DNA discriminate expression class.

These effect sizes are notable because the comparison is protein-controlled: all alleles within each group encode the identical amino acid sequence. Any biophysical difference is therefore confined to non-coding DNA — precisely the "hidden layer" of transplant mismatch that Bettens et al. identified through expression quantitative trait loci. The material-channel database converts this statistical association into a mechanistic prediction: expression-variant alleles differ from their normally-expressed siblings in specific, quantifiable physical properties of their regulatory DNA.

To validate these categorical findings with continuous expression measurements, we correlated the database biophysics with per-allele TPM from Bettens et al. (31), who quantified allele-specific expression by RNA-seq in 63 individuals. Matching 50 alleles (n ≥ 2 observations each) at the 2-field resolution to their representative 4-field genomic sequences in our database, we computed Spearman and Pearson correlations between mean expression and non-coding biophysical properties. HLA-A showed strong correlations: stacking ΔG₃₇ (Spearman ρ = −0.71, Pearson r = −0.76), CpG density (ρ = +0.53, r = +0.63), and melting temperature (ρ = +0.50, r = +0.67). HLA-C showed moderate correlations (Z-penalty r = −0.60, GC r = +0.54). HLA-B showed near-null correlations, consistent with the original eQTL finding that HLA-B expression had the weakest cis-regulatory signal (13% vs 29% and 31% for A and C, respectively). The direction is mechanistically coherent: more thermodynamically stable non-coding DNA predicts higher expression. The per-locus gradient in correlation strength itself has a biophysical explanation: querying the sequence_biophysics_l0 layer in ±50 kb flanking regions reveals that HLA-A sits in the most thermodynamically stable genomic neighborhood (mean stacking ΔG₃₇ = −1.350, GC = 0.459), followed by HLA-B (−1.335, 0.444) and HLA-C (−1.321, 0.430). The locus in the most stable context shows the strongest allele-expression coupling, consistent with a model where allele-level biophysical perturbations have proportionally larger regulatory effects in thermodynamically "taut" genomic neighborhoods.

This analysis combines allele-specific biophysics (from the HLA layer), quantitative expression data (from Bettens et al.), and surrounding genomic context (from the sequence biophysics layer) — three database layers queried together to generate a mechanistic hypothesis that would otherwise require assembling data from multiple sources and custom computation.

## COMPARISON WITH EXISTING RESOURCES

Table 2 compares Polymer Genomics with major genomic databases. The unique contributions (bold) are the genome-wide biophysical properties, cross-layer correlation and intersection queries, and the physics linter.

**Table 2.** Feature comparison with major genomic databases.

| Capability | UCSC | Ensembl | ENCODE | gnomAD | GTEx | **PG** |
|------------|:----:|:-------:|:------:|:------:|:----:|:------:|
| Gene models | ✓ | ✓ | | | | ✓ |
| Conservation scores | ✓ | ✓ | | | | ✓ |
| Regulatory elements | | | ✓ | | | ✓ |
| Genetic variation | | ✓ | | ✓ | | |
| Gene expression | | ✓ | | | ✓ | ✓ |
| Chromatin state | | | ✓ | | | ✓ |
| **Stacking ΔG₃₇ genome-wide** | | | | | | **✓** |
| **Melting temperature genome-wide** | | | | | | **✓** |
| **Groove geometry genome-wide** | | | | | | **✓** |
| **Curvature genome-wide** | | | | | | **✓** |
| **Form propensity genome-wide** | | | | | | **✓** |
| **Non-B DNA structures** | | | | | | **✓** |
| **Cross-layer correlation** | | | | | | **✓** |
| **Cross-layer intersection** | | | | | | **✓** |
| **Physics linter** | | | | | | **✓** |
| REST API + Python SDK | partial | ✓ | partial | | | **✓** |

Polymer Genomics does not replace existing databases. It provides a complementary layer of physical-chemical information absent from the current ecosystem, integrated with curated annotations to enable queries that previously required custom computation.

## IMPLEMENTATION

The platform is implemented in Python (FastAPI) with a PostgreSQL 16 database using int4range GiST indexes for efficient genomic range overlap queries. The API is deployed on Fly.io; the interactive viewer (Next.js, canvas-based multi-track rendering) is served from Vercel. All coordinates are 1-based closed externally, with a single internal conversion layer.

The biophysics layer was computed using: SantaLucia 1998 (6) for stacking thermodynamics, Tataurov et al. 2008 (11) for extinction coefficients, El Hassan & Calladine 1996/1997 (12, 13) for structural properties, Bolshoy et al. 1991 (14) for curvature, and DNAshapeR (15) for shape parameters. Methylation perturbation tracks use published 5-methylcytosine parameters from Zacharias 2019 (9) and persistence length data from Shon et al. 2019 (10).

## FUTURE DIRECTIONS

Planned extensions include expanded species support (mouse, zebrafish, *Drosophila*), additional biophysical layers (melting domain profiles, per-position mutation ΔG), and integration with long-read methylation data. The platform architecture supports these additions without schema changes.

## DATA AVAILABILITY

Polymer Genomics is freely accessible at https://polymerbio.org with no registration required. The API is at https://api.polymerbio.org with OpenAPI documentation at `/docs`. The Python SDK is on PyPI (`pip install polymer-genomics`, MIT license). Per-layer license and citation information is accessible programmatically at `/v1/layers/{layer_key}/license` and at https://polymerbio.org/data-sources.

We commit to maintaining Polymer Genomics for a minimum of five years from the date of publication.

## ACKNOWLEDGEMENTS

[To be added]

## FUNDING

[To be added]

## REFERENCES

1. Nassar LR, et al. The UCSC Genome Browser database: 2023 update. *Nucleic Acids Res.* 2023;51:D1188–D1195.
2. Martin FJ, et al. Ensembl 2023. *Nucleic Acids Res.* 2023;51:D933–D941.
3. ENCODE Project Consortium. Expanded encyclopaedias of DNA elements in the human and mouse genomes. *Nature.* 2020;583:699–710.
4. Chen S, et al. A genomic mutational constraint map using variation in 76,156 human genomes. *Nature.* 2024;625:92–100.
5. GTEx Consortium. The GTEx Consortium atlas of genetic regulatory effects across human tissues. *Science.* 2020;369:1318–1330.
6. SantaLucia J Jr. A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics. *Proc Natl Acad Sci USA.* 1998;95:1460–1465.
7. Rohs R, et al. The role of DNA shape in protein-DNA recognition. *Nature.* 2009;461:1248–1253.
8. Segal E, et al. A genomic code for nucleosome positioning. *Nature.* 2006;442:772–778.
9. Zacharias W. Methylation of cytosine influences the DNA structure. In: Weisshaar B, editor. *Modifications of Nucleic Acids.* Wiley; 2019.
10. Shon MJ, Rah SH, Yoon TY. Submicrometer elasticity of double-stranded DNA revealed by precision force-extension measurements with optical tweezers. *Sci Adv.* 2019;5:eaav1697.
11. Tataurov AV, You Y, Owczarzy R. Predicting ultraviolet spectrum of single stranded and double stranded deoxyribonucleic acids. *Biophys Chem.* 2008;133:66–70.
12. El Hassan MA, Calladine CR. Propeller-twisting of base-pairs and the conformational mobility of dinucleotide steps in DNA. *J Mol Biol.* 1996;259:95–103.
13. El Hassan MA, Calladine CR. Conformational characteristics of DNA: empirical classifications and a hypothesis for the conformational behaviour of dinucleotide steps. *Philos Trans R Soc Lond A.* 1997;355:43–100.
14. Bolshoy A, McNamara P, Harrington RE, Trifonov EN. Curved DNA without A-A: experimental estimation of all 16 DNA wedge angles. *Proc Natl Acad Sci USA.* 1991;88:2312–2316.
15. Chiu TP, et al. DNAshapeR: an R/Bioconductor package for DNA shape prediction and feature encoding. *Bioinformatics.* 2016;32:1211–1213.
16. Frankish A, et al. GENCODE 2021. *Nucleic Acids Res.* 2021;49:D916–D923.
17. Pollard KS, Hubisz MJ, Rosenbloom KR, Siepel A. Detection of nonneutral substitution rates on mammalian phylogenies. *Genome Res.* 2010;20:110–121.
18. Roadmap Epigenomics Consortium. Integrative analysis of 111 reference human epigenomes. *Nature.* 2015;518:317–330.
19. Smit AFA, Hubley R, Green P. RepeatMasker Open-4.0. http://www.repeatmasker.org.
20. Wang M, et al. PaxDb, a database of protein abundance averages across all three domains of life. *Mol Cell Proteomics.* 2012;11:492–500.
21. Uhlén M, et al. Tissue-based map of the human proteome. *Science.* 2015;347:1260419.
22. Gillespie M, et al. The reactome pathway knowledgebase 2022. *Nucleic Acids Res.* 2022;50:D665–D677.
23. Liberzon A, et al. The Molecular Signatures Database hallmark gene set collection. *Cell Syst.* 2015;1:417–425.
24. Akashi H, Gojobori T. Metabolic efficiency and amino acid composition in the proteomes of *Escherichia coli* and *Bacillus subtilis*. *Proc Natl Acad Sci USA.* 2002;99:3695–3700.
25. Loyfer N, et al. A DNA methylation atlas of normal human cell types. *Nature.* 2023;613:355–364.
26. Bendall ML, et al. Telescope: characterization of the retrotranscriptome by accurate estimation of transposable element expression. *PLoS Comput Biol.* 2019;15:e1006453.
27. Sollis E, et al. The NHGRI-EBI GWAS Catalog: knowledgebase and deposition resource. *Nucleic Acids Res.* 2023;51:D1038–D1045.
28. Alexandrov LB, et al. The repertoire of mutational signatures in human cancer. *Nature.* 2020;578:94–101.
29. Gardiner-Garden M, Frommer M. CpG islands in vertebrate genomes. *J Mol Biol.* 1987;196:261–282.
30. Barker DJ, et al. The IPD-IMGT/HLA Database. *Nucleic Acids Res.* 2023;51:D1053–D1060.
31. Bettens F, et al. Non-coding cis-regulatory variants and expression of HLA class I alleles. *PLoS Genet.* 2022;18:e1010139.

---

## SUPPLEMENTARY — NOT FOR SUBMISSION

### Word count
~3,200 words (target: 3,000–4,000 for NAR Database Issue)

### Figures to prepare
1. **Architecture diagram** — data sources → PostgreSQL → API → consumers (viewer, SDK, MCP agents)
2. **TP53 biophysics profile** — stacking ΔG₃₇, GC content, CpG density, and curvature across the 9 kb locus (data in Application Example section)
3. **Physics linter output** — evaluate a GFP expression cassette, show flags and windowed ΔG profile
4. **Comparison table** — Table 2 as a formatted figure
5. **HLA within-protein expression** — bar/dot plot of Cohen's d for top 5 protein groups (A*01:01 d=2.49, A*03:01 d=2.32, A*02:03 d=2.17, A*26:01 d=1.71, A*31:01 d=1.46), plus aggregate metric ranking (CpG density d=1.05, Tm d=1.01). Live at polymerbio.org/hla → Expression tab.

### Submission checklist
- [ ] Manuscript ≤ 4,000 words
- [ ] Database URL live and stable
- [ ] 5-year maintenance commitment stated
- [ ] All source databases cited
- [ ] Comparison table included
- [ ] Python SDK on PyPI
- [ ] OpenAPI spec at /docs
- [ ] Provenance programmatically accessible
- [ ] Fill in author name, affiliation, acknowledgements, funding
- [ ] Convert to NAR LaTeX template

### Timeline
- Submit: target July 2026 for January 2027 Database Issue
