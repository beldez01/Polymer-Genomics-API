# Data Licensing

Polymer Genomics aggregates data from multiple public genomic databases.
**Each data layer retains its original upstream license.** The MIT license
covering the source code does NOT extend to data served through the API.

The compilation, arrangement, and computed enrichment of data within the
Polymer Genomics database is a proprietary work of Polymer Genomics.

Per-layer license information is available programmatically at
`GET /v1/layers/{layer_key}/license` and at
[polymerbio.org/data-sources](https://polymerbio.org/data-sources).

---

## Commercial Use Classification

### Tier 1 — Unrestricted (commercial use permitted)

| Source | License | Notes |
|--------|---------|-------|
| GRCh38 / GRCh37 | Public Domain | |
| RefSeq | Public Domain | |
| ClinVar | Public Domain | |
| ChromHMM 15-state | Public Domain (NIH) | |
| Roadmap Epigenomics | Public Domain (NIH) | |
| GENCODE v44 | CC0 1.0 | No restrictions |
| EBI GWAS Catalog | CC0 1.0 | No restrictions |
| ENCODE cCREs / Histone / TFBS / Accessibility | CC BY 4.0 | Attribution required |
| ENCODE TAD Domains / Hi-C / Insulation | CC BY 4.0 | Attribution required |
| Reactome | CC BY 4.0 | Attribution required |
| MSigDB Hallmark | CC BY 4.0 | Attribution required |
| UniProt | CC BY 4.0 | Attribution required |
| PaxDb | CC BY 4.0 | Attribution required |
| PCAWG Mutation Rates | CC BY 4.0 | Attribution required |
| IPD-IMGT/HLA Database | CC BY 4.0 | Attribution required |
| BLUEPRINT WGBS | CC BY 4.0 | Attribution required |
| TE Exaptation Catalog | CC BY 4.0 | Attribution required |
| ABC Enhancer-Gene Links | CC BY 4.0 | Attribution required |
| Ensembl Compara | Apache 2.0 | Attribution + notice required |
| Telescope HERV Loci | MIT | |
| FlowSorted.Blood.EPIC | Artistic License 2.0 | Modification terms apply |
| Polymer Computed Tracks (Layer 0, Non-B DNA, Fragility) | MIT | Polymer Genomics original work |

### Tier 2 — Copyleft (commercial use permitted with obligations)

| Source | License | Obligation |
|--------|---------|------------|
| gnomAD Constraint (v4.1) | ODC-ODbL 1.0 | Derivative **databases** must be released under ODbL. Attribution required. Individual queries are not restricted; bulk redistribution triggers the share-alike clause. |
| gnomAD Structural Variants (v4.1) | ODC-ODbL 1.0 | Same as above. |
| Human Protein Atlas (v23) | CC BY-SA 3.0 | Derivative **works** incorporating HPA data must be shared under CC BY-SA 3.0 or a compatible license. Attribution required. |

**Users who create derivative databases or works incorporating data from
Tier 2 layers must comply with the respective copyleft obligations.**

### Tier 3 — Non-Commercial Use Only

**As of April 2026, Polymer Genomics has no non-commercial layers.** All
previously UCSC-sourced and COSMIC-sourced layers have been replaced:

| Former Source | Replacement | New License |
|---------------|-------------|-------------|
| UCSC CpG Islands | Computed from reference FASTA (Gardiner-Garden & Frommer 1987) | **MIT** |
| UCSC RepeatMasker | Self-computed using RepeatMasker (open source) + Dfam (CC0) | **MIT** |
| UCSC PhyloP 100-way | Zoonomia/Cactus 447-way phyloP ("freely usable for any purpose") | **Open** |
| UCSC PhastCons 100-way | Cactus 470-way phastCons ("freely usable for any purpose") | **Open** |
| COSMIC SBS Signatures | SantaLucia 1998 thermodynamic computation (Polymer original) | **MIT** |
| COSMIC Breakpoints | Reattributed to HumCFS + Mitelman Database (published coordinates) | **Published literature** |

### Tier 4 — Published Literature (factual data, no explicit license)

| Source | Status |
|--------|--------|
| SantaLucia NN Parameters (1998/2004) | Thermodynamic constants from published literature. Scientific facts are not copyrightable under US law (Feist v. Rural, 1991). Parameters are widely reproduced in textbooks and software. |
| Sugimoto RNA/DNA Parameters (1995) | Same — published thermodynamic constants. |
| Xia RNA Parameters (1998) | Same. |
| Horvath Clock (2013) | Published regression coefficients. Supplementary data tables may carry journal-specific terms. |
| Hannum Clock (2013) | Same. |
| PhenoAge (2018) | Same. |
| GrimAge (2019) | **PATENT: US 10,706,957.** Coefficients are published facts; computation of GrimAge age estimates may require patent license from UCLA/Horvath. |
| DunedinPACE (2022) | May have separate IP protections. Coefficients published; computation may be encumbered. |
| LADs (Meuleman 2013) | Published genomic coordinates. |
| NADs (Nemeth 2010) | Published genomic coordinates. |
| dbSUPER Super-Enhancers | Published coordinates with CC BY implied by journal. |
| DNA Methylation Valleys | Published coordinates. |
| Ultraconserved Elements (Bejerano 2004) | Published coordinates. Widely reproduced. |
| Human Accelerated Regions | Published coordinates. |
| Archaic Introgression (Vernot 2016) | Published coordinates. |
| Selection Sweeps (Sabeti 2007) | Published coordinates. |
| Crossover Hotspots (Palsson 2025) | Published coordinates. |
| DMC1 Meiotic Hotspots (Pratto 2014) | Published coordinates. |
| GoDMC meQTLs | Published summary statistics. |
| Protein Half-Lives (Mathieson 2018) | Published measurements. |
| Archaic Methylation (Gokhman 2014) | Published reconstructed methylation maps. |
| Imprinting Regions | Published coordinates from multiple sources. |

**Rationale**: Under US copyright law (Feist v. Rural Telephone Service Co.,
499 U.S. 340, 1991), facts — including scientific measurements, genomic
coordinates, and thermodynamic constants — are not copyrightable. The creative
arrangement or selection of facts may be protected, but individual data points
derived from published literature are in the public domain. Polymer Genomics
redistributes factual data (coordinates, coefficients, measurements) from
these sources, not the creative expression (figures, prose, software) of the
original publications.

### Tier 5 — Factual Data Derived from Proprietary or Restricted Sources

| Source | What We Store | Status |
|--------|---------------|--------|
| Illumina EPIC v2 Manifest | Probe IDs + genomic coordinates only (via sesameData). No probe sequences, bead addresses, or normalization parameters. Gene symbols derived from GENCODE; CpG context computed independently. | **Clear.** Factual genomic coordinates are uncopyrightable under Feist v. Rural. No proprietary Illumina fields are stored or served. |
| Illumina EPIC v1 Manifest | Same as above. | **Clear.** |
| Illumina 450K Manifest | Same as above. | **Clear.** |
| GTEx v10 (summary statistics) | Median TPM per tissue per gene. No individual-level data. | Open-access summary statistics. No dbGaP authorization required. |
| GTEx eQTLs v8 | Summary statistics only. | Same. |

---

## Patent Encumbrances

The following data layers reference inventions protected by patents:

| Layer | Patent | Holder | Scope |
|-------|--------|--------|-------|
| GrimAge coefficients | US 10,706,957 | The Regents of the University of California | Computation of GrimAge epigenetic age. Viewing coefficients is not restricted; using them to compute age estimates may require a license. |
| DunedinPACE | Potential IP (unconfirmed) | Duke University / Belsky et al. | Terms unclear. Exercise caution. |

**Polymer Genomics serves clock probe annotations and coefficients for
informational and reference purposes only. Users who compute epigenetic age
using these coefficients are responsible for obtaining any required patent
licenses.**

---

## Attribution Requirements

When using data obtained from Polymer Genomics in publications, cite:
1. **Polymer Genomics** as the access platform
2. **The original data providers** for each layer used (citations are provided
   per-layer via the API and at polymerbio.org/data-sources)

For CC BY 4.0 sources, attribution must include the original author(s),
source name, license, and a link to the license
(https://creativecommons.org/licenses/by/4.0/).

For gnomAD (ODbL), attribution must follow the gnomAD terms of use:
https://gnomad.broadinstitute.org/terms

---

## Questions

For licensing questions, contact: hello@polymerbio.org
