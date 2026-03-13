# Third-Party Data Licenses

Polymer Genomics serves curated genomic reference data from the sources listed below.
Each dataset retains the license terms set by its original provider. Users of the
Polymer Genomics API must comply with the upstream license for any data they access.

## Data Sources

| Source | License | URL |
|--------|---------|-----|
| GENCODE v44 | CC0 1.0 Universal | https://www.gencodegenes.org/pages/data_access.html |
| EBI GWAS Catalog | CC0 1.0 Universal | https://www.ebi.ac.uk/gwas/docs/about |
| UCSC Genome Browser (CpG Islands, Conservation, RepeatMasker) | Free for non-commercial use | https://genome.ucsc.edu/license/ |
| ENCODE cCREs v4, ChIP-seq v3 | CC BY 4.0 | https://www.encodeproject.org/help/citing-encode/ |
| Reactome | CC BY 4.0 | https://reactome.org/license |
| PaxDb v5.0 | CC BY 4.0 | https://pax-db.org/about |
| UniProt ProtParam | CC BY 4.0 | https://www.uniprot.org/help/license |
| Human Protein Atlas v23 | CC BY-SA 3.0 | https://www.proteinatlas.org/about/licence |
| GTEx v10 | Open access (summary statistics) | https://gtexportal.org/home/about |
| gnomAD v4.1 | ODC-ODbL 1.0 | https://gnomad.broadinstitute.org/terms |
| Ensembl Compara v112 | Apache 2.0 | https://www.ensembl.org/info/about/legal/code_licence.html |
| FlowSorted.Blood.EPIC (Salas 2018, Reinius 2012) | Artistic License 2.0 | https://bioconductor.org/packages/FlowSorted.Blood.EPIC/ |
| Illumina Probe Manifests (via sesameData) | Proprietary — free to use | https://www.illumina.com/ |
| Roadmap Epigenomics / ChromHMM | Public Domain (NIH) | https://egg2.wustl.edu/roadmap/web_portal/ |
| Non-B DNA (UCSC) | Public Domain | https://nonb-abcc.ncifcrf.gov/ |
| COSMIC SBS Signatures v3.4 | Free for non-commercial use | https://cancer.sanger.ac.uk/signatures/ |
| Mathieson et al. 2018 (protein turnover) | Published literature | https://doi.org/10.1038/s41467-018-03106-1 |
| GRCh38 / GRCh37 reference genome | Public Domain | https://www.ncbi.nlm.nih.gov/grc |
| Epigenetic clock coefficients | Published literature; patent restrictions may apply | See individual publications |
| HumCFS / Mitelman (breakpoints) | Mixed — see individual sources | https://webs.iiitd.edu.in/raghava/humcfs/ |
| Polymer Evolution L0 (biophysics) | MIT | This project |
| Telescope HERV Annotation v2 (Bendall) | No explicit license (academic use) | https://github.com/mlbendall/telescope_annotation_db |
| Retroelement-Age Clock (TruDiagnostic) | CC BY 4.0 | https://zenodo.org/records/11099870 |
| Gene profiles, gene costs | Derived from multiple sources above | — |

## Compute Engine Dependencies

The methylation compute engine (`engine/`) uses GPL-licensed R/Bioconductor
packages. See `engine/LICENSE` for details.

## Source Code

The Polymer Genomics API source code is licensed under the MIT License. See `LICENSE`.
