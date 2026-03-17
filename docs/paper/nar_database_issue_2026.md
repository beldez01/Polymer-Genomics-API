# Polymer Genomics: a production database of genome-wide DNA biophysical properties with cross-layer correlation

**Authors:** [Your Name]^1

**Affiliations:** ^1 Polymer Bio, [City, State]

**Corresponding author:** hello@polymerbio.org

**Database URL:** https://api.polymerbio.org

**Python SDK:** `pip install polymer-genomics`

**Documentation:** https://api.polymerbio.org/docs

---

## Abstract

Polymer Genomics (https://polymerbio.org) is the first production database providing genome-wide DNA biophysical properties — stacking free energy, melting temperature, groove geometry, form propensity, curvature, and periodicity — computed at 1 kb resolution across the entire human genome (GRCh38/hg38 and GRCh37/hg37). These material-channel properties are integrated with 28 curated annotation layers spanning gene models, CpG sites, methylation probes, conservation scores, regulatory elements, chromatin states, repeat elements, non-B DNA structures, GWAS associations, gene expression, protein abundance, and epigenetic clock coefficients — totaling over 45 million indexed features. All layers are queryable through a unified REST API returning GRanges-compatible JSON, enabling cross-layer correlation and intersection in a single request. The platform includes a physics linter for evaluating arbitrary DNA sequences (10–100,000 bp) against biophysical criteria relevant to synthetic biology, and a Python SDK for programmatic access. Polymer Genomics fills a gap in the current genomic database ecosystem: while existing resources catalogue sequence, annotation, variation, and function, none provide the physical-chemical properties of DNA as a material polymer or enable their correlation with biological annotations.

## Introduction

The genomic database ecosystem is rich in resources for sequence (UCSC Genome Browser (1), Ensembl (2)), functional annotation (ENCODE (3)), genetic variation (gnomAD (4)), gene expression (GTEx (5)), and epigenetic state (Roadmap Epigenomics (6)). These databases treat DNA primarily as an information-carrying molecule — a symbolic sequence encoding genes, regulatory elements, and variants.

However, DNA is also a physical polymer whose material properties — thermodynamic stability, mechanical stiffness, groove geometry, and propensity for alternative structural forms — directly influence biological function. Stacking free energy determines strand separation kinetics (7). Persistence length governs nucleosome wrapping affinity (8). Minor groove width modulates transcription factor binding (9). CpG methylation alters both thermodynamic stability and mechanical flexibility (10, 11).

These biophysical properties are computable from first principles using published nearest-neighbor thermodynamic parameters (7, 12, 13) and structural lookup tables (14, 15), yet no existing database provides them genome-wide in a queryable, programmatically accessible format. Researchers who need biophysical context for a genomic region must compute it ad hoc, and cannot correlate it with the biological annotations available in standard databases.

Polymer Genomics addresses this gap. It is a curated, multi-layer genomic reference database that:

1. Provides genome-wide DNA biophysical properties (stacking ΔG₃₇, melting temperature, curvature, groove geometry, form propensity, periodicity) pre-computed at 1 kb resolution across the human genome;
2. Integrates 28 annotation layers from authoritative sources (GENCODE, ENCODE, gnomAD, GTEx, UCSC, RepeatMasker, COSMIC, Human Protein Atlas, and others);
3. Enables cross-layer correlation and boolean intersection queries through a unified API;
4. Offers a physics linter for evaluating arbitrary DNA sequences against biophysical criteria; and
5. Exposes all data through a REST API with a published Python SDK.

## Database content and organization

### Data layers

Polymer Genomics organizes genomic data into typed layers, each with provenance metadata including source, license, evidence class, and validation status. Table 1 summarizes the 28 active layers on GRCh38.

**Table 1. Data layers in Polymer Genomics (GRCh38)**

| Layer | Source | Features | Evidence Class | License |
|-------|--------|----------|----------------|---------|
| GENCODE v44 gene models | GENCODE (16) | 3,039,917 | Curated (K) | CC0 1.0 |
| CpG sites | Computed from GRCh38 | 29,401,795 | Derived (D) | Public Domain |
| CpG islands | UCSC (1) | 27,949 | Derived (D) | Public Domain |
| Isochores | Computed from GRCh38 | 10,307 | Derived (D) | Public Domain |
| Methylation atlas | Loyfer et al. 2023 (17) | 865,859 | Measured (M) | Artistic 2.0 |
| Methylation probes (450K) | Illumina | 485,545 | Derived (D) | Free use |
| Methylation probes (EPIC v1) | Illumina | 865,876 | Derived (D) | Free use |
| Methylation probes (EPIC v2) | Illumina | 937,053 | Derived (D) | Free use |
| Conservation (PhyloP/PhastCons) | UCSC 100-way (18) | genome-wide | Statistical (S) | Non-commercial |
| ENCODE cCREs v4 | ENCODE (3) | genome-wide | Statistical (S) | CC BY 4.0 |
| ChromHMM 15-state | Roadmap (6) | genome-wide | Statistical (S) | Public Domain |
| Histone modification peaks | ENCODE v3 (3) | genome-wide | Measured (M) | CC BY 4.0 |
| GTEx v10 expression | GTEx (5) | genome-wide | Measured (M) | Open access |
| Gene constraint (gnomAD v4) | gnomAD (4) | genome-wide | Statistical (S) | ODC-ODbL 1.0 |
| Repeat elements | RepeatMasker (19) | 5,317,291 | Statistical (S) | Non-commercial |
| HERV proviral loci | Telescope (20) | 14,203 | — | Open access |
| Non-B DNA structures | Computed | 2,937,698 | Derived (D) | Public Domain |
| Fragility composite | Computed | 2,937,681 | Derived (D) | Derived |
| Chromosomal breakpoints | Mitelman/COSMIC | 49 | Curated (K) | Mixed |
| GWAS catalog | EBI (21) | genome-wide | Statistical (S) | CC0 1.0 |
| Gene biosynthetic costs | Akashi-Gojobori (22) / GTEx | genome-wide | Derived (D) | Mixed |
| Protein abundance | PaxDb v6.0 (23) | genome-wide | Measured (M) | CC BY 4.0 |
| Human Protein Atlas | HPA v23 (24) | genome-wide | Measured (M) | CC BY-SA 3.0 |
| Reactome pathways | Reactome (25) | genome-wide | Curated (K) | CC BY 4.0 |
| MSigDB Hallmark gene sets | MSigDB (26) | genome-wide | Curated (K) | Public Domain |
| Epigenetic clock probes | Published literature | genome-wide | Curated (K) | Mixed |
| SBS mutation spectrum | COSMIC v3.4 (27) | 96 channels | Curated (K) | Non-commercial |
| **Sequence biophysics L0** | **Computed (this work)** | **genome-wide, 43 columns** | **Derived (D)** | **MIT** |

### Sequence biophysics layer

The sequence biophysics layer (sequence_biophysics_l0) is the core novel contribution of Polymer Genomics. It provides 43 pre-computed biophysical properties at 1 kb resolution across the entire genome, organized into four groups:

**Core L0 properties (8 tracks):** GC content, stacking free energy (ΔG₃₇, kcal/mol, SantaLucia 1998 (7)), melting temperature (°C), intrinsic curvature (Bolshoy et al. (28)), dipole moment, minor groove width, dinucleotide periodicity, and deformability.

**DNAshape properties (8 tracks):** Minor groove width (MGW), propeller twist (ProT), roll, helix twist (HelT), and their positional derivatives (δMGW, δProT, δRoll, δHelT), from the DNAshapeR framework (29).

**L1 methylation perturbation properties (10 tracks):** CpG density, methylation-induced ΔG₃₇ and ΔTm perturbation, methylation sensitivity, methylation capacity, demethylation cost, and taut-relaxed transition scores. These are computed from the sequence-intrinsic CpG distribution using published thermodynamic parameters for 5-methylcytosine (10, 11) and represent the *potential* for methylation to alter biophysical properties, not the methylation state itself.

**L3.5 Green's function properties (4 tracks):** Correlation length, integrated response, perturbation reach, and response asymmetry, computed via transfer matrix methods on a 1D lattice gas model of nucleosome occupancy.

**Extended L0 properties (13 tracks):** G-quadruplex density and maximum score, k-mer complexity, dinucleotide entropy, dominant period, and additional structural metrics.

All properties are computed from the reference sequence using published parameters — no experimental data or machine learning models are involved. This makes the biophysics layer fully reproducible, deterministic, and free of cell-type or condition-specific assumptions.

### Epistemic metadata framework

Each layer carries structured metadata describing its epistemic status:

- **Evidence class:** Measured (M), Reference/curated (K), Derived/computed (D), Statistical (S), or Hypothetical (H)
- **Tier:** Intrinsic (sequence-determined), Constrained (cell-type modulated), or Active (condition-specific)
- **Validation status:** Externally benchmarked, externally validated, internally validated, or unvalidated
- **Equilibrium regime:** Equilibrium (static) or non-equilibrium (dynamic)

This framework enables users and AI agents to make informed decisions about data reliability and applicability. For example, the biophysics layer is classified as Derived/Intrinsic/Equilibrium — it is computed from sequence, invariant across cell types, and represents thermodynamic ground-state properties.

## API and programmatic access

### REST API

Polymer Genomics provides a REST API at https://api.polymerbio.org with OpenAPI documentation at /docs. All endpoints return JSON. Genomic data is returned in GRanges-compatible format:

```json
{
  "status": "complete",
  "api_version": "0.1.0",
  "data_version": "2026.03",
  "coordinate_system": "1-based_closed",
  "layers_resolved": [
    {"layer_key": "cpg_sites", "source": "UCSC CpG Islands",
     "source_license": "Free for non-commercial use", ...}
  ],
  "data": {
    "cpg_sites": {
      "seqnames": ["chr17", "chr17"],
      "ranges": {"start": [7668402, 7668450], "end": [7668403, 7668451]},
      "strand": ["*", "*"],
      "mcols": {"density": [0.082, 0.079]},
      "n": 2
    }
  }
}
```

Key API capabilities include:

- **Region queries** (`GET /v1/regions/{build}/{region}`) — retrieve features from any combination of layers for a genomic region, with field selection and cursor pagination
- **Summary statistics** (`GET /v1/stats/{build}/{region}`) — mean, median, standard deviation, percentiles for continuous layers without returning individual rows
- **Cross-layer correlation** (`GET /v1/correlate/{build}/{region}`) — Pearson, Spearman, overlap enrichment, Jaccard, and Fisher exact test between any two layers
- **Cross-layer intersection** (`POST /v1/query/intersect`) — find positions satisfying boolean conditions across multiple layers (e.g., "CpG islands with PhyloP > 3 AND stacking ΔG₃₇ < −1.7")
- **Region profile** (`GET /v1/profile/{build}/{region}`) — comprehensive summary across all layers with significance flags
- **Sequence evaluation** (`POST /v1/evaluate`) — biophysical assessment of arbitrary DNA sequences (see below)
- **Gene lookup with alias resolution** (`GET /v1/genes/{build}/{symbol}`) — supports common aliases (p53 → TP53, OCT4 → POU5F1)

All data responses include provenance metadata (source, license, evidence class) for each layer, enabling automated attribution.

### Python SDK

A Python client library is available on PyPI:

```bash
pip install polymer-genomics
```

```python
from polymer_genomics import PolymerClient

client = PolymerClient(api_key="...")

# Evaluate a synthetic construct
report = client.evaluate("ATGCGATCGATCG" * 100)
print(report["flags"])

# Query biophysical properties of the TP53 promoter
data = client.region("hg38", "chr17:7668402-7669000",
                     layers=["sequence_biophysics_l0"])

# Cross-layer correlation
corr = client.correlate("hg38", "chr17:7668402-7687550",
                        layer_x="sequence_biophysics_l0",
                        layer_y="conservation")
```

### MCP integration

Polymer Genomics is accessible as an MCP (Model Context Protocol) server, enabling AI agents (including Claude, GPT, and other LLM-based systems) to query genomic data directly during reasoning. The MCP server exposes 45 tools covering all API endpoints plus a local methylation analysis pipeline.

## The physics linter

A distinctive feature of Polymer Genomics is the *physics linter* — an endpoint that accepts an arbitrary DNA sequence (10–100,000 bp) and returns a structured biophysical assessment. This is designed for synthetic biology workflows where researchers need to evaluate constructs before synthesis.

The physics linter computes:

- **Thermodynamic properties:** Per-dinucleotide stacking ΔG₃₇ (SantaLucia 1998 (7)), salt-corrected ΔG, global melting temperature estimate, windowed profiles
- **Structural properties:** A-form and Z-form propensity (El Hassan & Calladine (14)), major and minor groove width and depth
- **Extinction coefficient:** UV absorbance at 260 nm (Tataurov et al. 2008 (13))
- **CpG island detection:** Gardiner-Garden & Frommer 1987 criteria (30)
- **Actionable flags:** 13 flag types including CpG islands, homopolymer runs, dinucleotide repeats, direct repeats (≥15 bp), inverted repeats (potential hairpins), extreme GC windows, Z-form prone regions, and silencing risk assessment

A batch endpoint (`POST /v1/evaluate/batch`) supports evaluation of up to 100 sequences in a single request, and a comparison endpoint (`POST /v1/compare`) provides side-by-side delta analysis of 2–10 sequence variants.

The physics linter is a pure computation — it requires no database access, no reference genome, and no external dependencies. All biophysical parameters are from published lookup tables, making results fully deterministic and reproducible.

## Cross-layer queries: the correlative engine

The unique analytical capability of Polymer Genomics is its ability to correlate and intersect heterogeneous data layers in a single query. No existing genomic database offers this combination of biophysical properties and biological annotations in a unified query interface.

Example queries enabled by the cross-layer engine:

1. **"Find CpG islands with unusual thermodynamic stability"** — intersect the CpG island layer with the biophysics layer, filtering for stacking ΔG₃₇ < −1.7 kcal/mol
2. **"Correlate conservation with GC content across a gene"** — Pearson correlation between PhyloP scores and GC content from the biophysics layer
3. **"Find non-B DNA structures in highly conserved regions"** — intersect non-B DNA predictions with conservation scores > 3.0
4. **"Profile the TP53 locus across all layers"** — region profile returning feature counts, densities, and significance flags for every layer

To lower the barrier to these queries, Polymer Genomics ships a recipe library — prebuilt cross-layer query specifications for common biological questions, accessible via `GET /v1/query/recipes`.

## Implementation

Polymer Genomics is implemented as a FastAPI application backed by PostgreSQL 16, deployed on Fly.io (API) and Vercel (web viewer). Genomic coordinates use PostgreSQL int4range types with GiST indexes for efficient range overlap queries. All coordinates are 1-based closed, consistent with standard genomic conventions.

The biophysics layer was computed using published nearest-neighbor parameters: SantaLucia 1998 (7) for stacking thermodynamics, Tataurov et al. 2008 (13) for extinction coefficients, El Hassan & Calladine 1996/1997 (14, 15) for structural properties, Bolshoy et al. 1991 (28) for curvature, and DNAshapeR (29) for shape parameters. Methylation perturbation properties use the 5-methylcytosine thermodynamic parameters from Zacharias 2019 (10) and the persistence length convergence data from Shon et al. 2019 (11). All computation code is available at [repository URL].

The database currently occupies 14 GB on disk, serving approximately 45 million indexed features across 28 layers. Response times for typical region queries (< 500 kb) are under 100 ms.

## Comparison with existing resources

**Table 2. Comparison of Polymer Genomics with major genomic databases**

| Capability | UCSC | Ensembl | ENCODE | gnomAD | GTEx | **Polymer Genomics** |
|------------|------|---------|--------|--------|------|---------------------|
| Gene models | ✓ | ✓ | | | | ✓ |
| CpG annotation | ✓ | | | | | ✓ |
| Conservation scores | ✓ | ✓ | | | | ✓ |
| Regulatory elements | | | ✓ | | | ✓ |
| Genetic variation | | ✓ | | ✓ | | |
| Gene expression | | ✓ | | | ✓ | ✓ |
| Chromatin state | | | ✓ | | | ✓ |
| Stacking ΔG₃₇ genome-wide | | | | | | **✓** |
| Melting temperature genome-wide | | | | | | **✓** |
| Groove geometry genome-wide | | | | | | **✓** |
| DNA curvature genome-wide | | | | | | **✓** |
| Form propensity genome-wide | | | | | | **✓** |
| Non-B DNA structures | | | | | | **✓** |
| Cross-layer correlation API | | | | | | **✓** |
| Cross-layer intersection API | | | | | | **✓** |
| Physics linter (sequence eval) | | | | | | **✓** |
| Epigenetic clock coefficients | | | | | | **✓** |
| Methylation probe crossmap | | | | | | **✓** |
| REST API + Python SDK | partial | ✓ | partial | | | **✓** |
| AI agent integration (MCP) | | | | | | **✓** |

Polymer Genomics does not aim to replace any existing database. Rather, it provides a complementary layer of physical-chemical information that is absent from the current ecosystem, and integrates it with curated annotations from authoritative sources to enable queries that were previously impossible without custom computation.

## Future directions

Planned enhancements include:

1. **Expanded species support** — extension to model organisms (mouse, zebrafish, Drosophila)
2. **Methylation signature channels** — systematic decomposition of methylation variation by CpG context, genic position, and isochore class
3. **Nucleosome positioning predictions** — genome-wide occupancy predictions from polymer elasticity models
4. **Integration with long-read data** — nanopore-derived methylation and structural variant overlays

## Data availability and maintenance

Polymer Genomics is freely accessible at https://api.polymerbio.org with no registration required. The Python SDK is available via `pip install polymer-genomics` (MIT license). API documentation is at https://api.polymerbio.org/docs. The web viewer is at https://polymerbio.org. Full data source attribution is maintained at https://polymerbio.org/data-sources and is programmatically accessible via the `/v1/layers/{layer_key}/license` endpoint.

We commit to maintaining Polymer Genomics for a minimum of five years from the date of publication, with regular updates as source databases release new versions.

## Acknowledgements

[To be added]

## Funding

[To be added — or "None" if self-funded, which is fine for NAR Database Issue]

## References

1. Nassar LR, et al. The UCSC Genome Browser database: 2023 update. *Nucleic Acids Res.* 2023;51:D1188–D1195.
2. Martin FJ, et al. Ensembl 2023. *Nucleic Acids Res.* 2023;51:D933–D941.
3. ENCODE Project Consortium. Expanded encyclopaedias of DNA elements in the human and mouse genomes. *Nature.* 2020;583:699–710.
4. Chen S, et al. A genomic mutational constraint map using variation in 76,156 human genomes. *Nature.* 2024;625:92–100.
5. GTEx Consortium. The GTEx Consortium atlas of genetic regulatory effects across human tissues. *Science.* 2020;369:1318–1330.
6. Roadmap Epigenomics Consortium. Integrative analysis of 111 reference human epigenomes. *Nature.* 2015;518:317–330.
7. SantaLucia J Jr. A unified view of polymer, dumbbell, and oligonucleotide DNA nearest-neighbor thermodynamics. *Proc Natl Acad Sci USA.* 1998;95:1460–1465.
8. Luger K, Mäder AW, Richmond RK, Sargent DF, Richmond TJ. Crystal structure of the nucleosome core particle at 2.8 Å resolution. *Nature.* 1997;389:251–260.
9. Rohs R, et al. The role of DNA shape in protein-DNA recognition. *Nature.* 2009;461:1248–1253.
10. Zacharias W. Methylation of cytosine influences the DNA structure. In: *Chemistry and Biology of DNA Modification.* 2019.
11. Shon MJ, Rah SH, Yoon TY. Submicrometer elasticity of double-stranded DNA revealed by precision force-extension measurements with optical tweezers. *Sci Adv.* 2019;5:eaav1697.
12. Xia T, et al. Thermodynamic parameters for an expanded nearest-neighbor model for formation of RNA duplexes with Watson-Crick base pairs. *Biochemistry.* 1998;37:14719–14735.
13. Tataurov AV, You Y, Owczarzy R. Predicting ultraviolet spectrum of single stranded and double stranded deoxyribonucleic acids. *Biophys Chem.* 2008;133:66–70.
14. El Hassan MA, Calladine CR. Propeller-twisting of base-pairs and the conformational mobility of dinucleotide steps in DNA. *J Mol Biol.* 1996;259:95–103.
15. El Hassan MA, Calladine CR. Conformational characteristics of DNA: empirical classifications and a hypothesis for the conformational behaviour of dinucleotide steps. *Philos Trans R Soc Lond A.* 1997;355:43–100.
16. Frankish A, et al. GENCODE 2021. *Nucleic Acids Res.* 2021;49:D916–D923.
17. Loyfer N, et al. A DNA methylation atlas of normal human cell types. *Nature.* 2023;613:355–364.
18. Pollard KS, Hubisz MJ, Rosenbloom KR, Siepel A. Detection of nonneutral substitution rates on mammalian phylogenies. *Genome Res.* 2010;20:110–121.
19. Smit AFA, Hubley R, Green P. RepeatMasker Open-4.0. http://www.repeatmasker.org.
20. Bendall ML, et al. Telescope: characterization of the retrotranscriptome by accurate estimation of transposable element expression. *PLoS Comput Biol.* 2019;15:e1006453.
21. Sollis E, et al. The NHGRI-EBI GWAS Catalog: knowledgebase and deposition resource. *Nucleic Acids Res.* 2023;51:D1038–D1045.
22. Akashi H, Gojobori T. Metabolic efficiency and amino acid composition in the proteomes of *Escherichia coli* and *Bacillus subtilis*. *Proc Natl Acad Sci USA.* 2002;99:3695–3700.
23. Wang M, et al. PaxDb, a database of protein abundance averages across all three domains of life. *Mol Cell Proteomics.* 2012;11:492–500.
24. Uhlén M, et al. Tissue-based map of the human proteome. *Science.* 2015;347:1260419.
25. Gillespie M, et al. The reactome pathway knowledgebase 2022. *Nucleic Acids Res.* 2022;50:D665–D677.
26. Liberzon A, et al. The Molecular Signatures Database hallmark gene set collection. *Cell Syst.* 2015;1:417–425.
27. Alexandrov LB, et al. The repertoire of mutational signatures in human cancer. *Nature.* 2020;578:94–101.
28. Bolshoy A, McNamara P, Harrington RE, Trifonov EN. Curved DNA without A-A: experimental estimation of all 16 DNA wedge angles. *Proc Natl Acad Sci USA.* 1991;88:2312–2316.
29. Chiu TP, et al. DNAshapeR: an R/Bioconductor package for DNA shape prediction and feature encoding. *Bioinformatics.* 2016;32:1211–1213.
30. Gardiner-Garden M, Frommer M. CpG islands in vertebrate genomes. *J Mol Biol.* 1987;196:261–282.

---

## Supplementary Notes

### Submission checklist (NAR Database Issue)

- [ ] Manuscript follows NAR Database Issue format (4-6 pages, ~3500 words)
- [ ] Database URL is live and stable: https://api.polymerbio.org
- [ ] 5-year maintenance commitment stated
- [ ] All source databases cited with proper attribution
- [ ] Comparison table with existing resources included
- [ ] Python SDK published on PyPI
- [ ] OpenAPI specification available at /docs
- [ ] License information programmatically accessible
- [ ] Novelty statement clear: "first production database of genome-wide DNA biophysical properties"

### Figures to prepare

1. **Architecture diagram** — FastAPI + PostgreSQL + Fly.io, showing data flow from source databases through ingestion to API consumers (web viewer, Python SDK, MCP/AI agents)
2. **Physics linter example** — evaluate_design output for a known synthetic construct (e.g., GFP expression cassette), showing flags, CpG islands, windowed ΔG profile
3. **Cross-layer query example** — intersect_layers result showing CpG islands with unusual biophysical properties in the TP53 locus
4. **Comparison table** — Table 2 formatted as a figure for visual impact

### Timeline

- NAR Database Issue deadline: typically July–August for January publication
- Writing: 2-3 weeks
- Figures: 1 week
- Internal review: 1 week
- Submit: target July 2026
