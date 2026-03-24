# Database Reference

Fly.io Postgres (`polymer-db`). Extensions: `btree_gist`, `uuid-ossp`.

## Schemas

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| `ref` | Reference data | `chromosomes` (25 rows), `isochores`, `methylation_reference` (cell-type betas) |
| `registry` | Layer catalog | `layers` (versioned datasets), `layer_dependencies`, `active_layers` view |
| `gene` | Gene models | `features` — partitioned by build × chr (GiST on coord) |
| `cpg` | CpG annotations | `islands`, `sites` — both partitioned by build × chr |
| `probe` | Methylation arrays | `coordinates` (partitioned by build), `map_edges` (450k/EPICv1/v2 crossmap) |
| `methylation` | Bulk methylation | `atlas_layers` (S3/Parquet refs per cell type) |
| `expression` | GTEx v10 | 54-tissue TPM (mig 004) |
| `bioenergetics` | Biosynthetic costs | `gene_costs` (Akashi-Gojobori + EWGC), `protein_abundance` (PaxDb PPM), `protein_turnover` (half-life), `protein_properties` (CHNOPS) |
| `conservation` | Constraint/evolution | Conservation scores (1kb-binned PhyloP/PhastCons), `gene_constraint` (gnomAD pLI/LOEUF), `protein_evolution` (dN/dS) |
| `annotation` | Pathways/sets/repeats | `gene_pathways` (Reactome), `gene_sets` (MSigDB Hallmark), `repeat_elements` (RepeatMasker ~5.5M rows) |
| `regulatory` | Regulatory elements | `ccres` (ENCODE cCREs V4), `chromatin_states` (ChromHMM 15-state) |
| `proteomics` | Protein Atlas | `tissue_expression` (~1M rows), `subcellular_location` (~60K rows) |
| `reference` | Physical constants | NN thermodynamics, dinucleotide properties, amino acid properties, physical constants |
| `biophysics` | Sequence properties | 1kb-binned tracks (GC, stacking, Tm, curvature, groove, dipole, periodicity) |
| `storage` | Object refs | `objects` (S3 bucket/key for bulk files) |

## Partitioning Strategy

Genomic tables (`gene.features`, `cpg.sites`, `probe.coordinates`) are **partitioned by genome build** (hg37/hg38) then **sub-partitioned by chromosome** (1–25). Each sub-partition has a GiST index on `(chr_id, coord)` for range queries.

## Roles

| Role | Access |
|------|--------|
| `api_reader` | SELECT only, 30s statement timeout, 64MB work_mem |
| `ingest_writer` | SELECT + INSERT + UPDATE on data schemas |

## Migrations

Located in `docker/postgres/migrations/` (002–019). Run against **Fly.io Postgres only**:
```
fly proxy 15432:5432 -a polymer-db
psql "postgres://...@localhost:15432/..." < docker/postgres/migrations/NNN_name.sql
```

## Enums

`genome_build`, `layer_type`, `license_class`, `storage_location`, `probe_platform`, `mapping_method`, `feature_type`, `cpg_context`, `layer_dependency_type`
