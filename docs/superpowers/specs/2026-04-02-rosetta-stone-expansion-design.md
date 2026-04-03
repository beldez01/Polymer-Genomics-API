# The Rosetta Stone Expansion

**Date:** 2026-04-02
**Status:** Design approved, pending implementation
**Scope:** Transform PolymerGenomicsAPI from 28 to 44+ layers (41 achieved as of 2026-04-03) with deep-time integration, causal links, sub-1kb on-demand computation, and 12 cross-domain query recipes.

## Vision

The database becomes the only place where DNA biophysics, epigenetics, deep evolutionary time, population genetics, disease associations, and causal regulatory links are cross-indexed in a single query at a single coordinate. Every position in the genome gets a temporal coordinate alongside its spatial one: how conserved, how selected, how old its TEs are, whether archaic hominins methylated it differently, and what diseases and traits map there.

One query. One coordinate. The full history of the genome at that position.

## Constraints

- **Budget:** Lean. Current Fly.io shared-cpu-2x, 1GB RAM. Volume expansion from 20GB to 40GB (~$3/mo additional) is acceptable. No $200+/mo compute upgrades.
- **Storage budget:** ~2.3 GB additional (from current 14 GB to ~16.5 GB within 40 GB volume).
- **Resolution:** Sub-1kb biophysics solved via on-demand computation, not storage.
- **Patient data:** Out of scope. Reference-level and aggregated public data only.
- **Architecture:** Hybrid backbone (window-level columns) + feature tables (own coordinates). Extends existing layer system.

## Architecture

### Approach: Hybrid Backbone + Feature Tables + On-Demand Compute

Three categories of new data:

1. **Window-level columns** — Per-1kb-window aggregates added to `biophysics.sequence_properties` via Pattern B (UPDATE via staging table). These appear in every biophysics query automatically.

2. **Feature-level tables** — Data with its own coordinates (variants, introgression segments, HARs, eQTLs) in new schemas/tables. Queryable through the existing layer/registry system via `query_region`.

3. **On-demand computation** — Sub-1kb biophysics computed from reference sequence at query time. New API endpoint returning same GRanges JSON format.

### New Schemas

```
evolution    — deep time: archaic DNA, selection, accelerated regions
variation    — human genetic variation: ClinVar, GWAS catalog
qtl          — causal links: eQTLs, meQTLs
nuclear      — spatial genome: LADs, NADs, DMVs, super-enhancers
```

Extended existing schemas:
```
biophysics   — 5 new window-level columns (evolutionary physics)
annotation   — TE age column addition on repeats table
regulatory   — enhancer-gene links (ABC model)
ref          — imprinted genes/ICRs
```

### New Layer Types for TRACK_REGISTRY

```python
# Add to src/polymer_genomics/queries/_registry.py
"archaic_introgression"  -> evolution.archaic_segments
"archaic_methylation"    -> evolution.archaic_methylation
"accelerated_region"     -> evolution.accelerated_regions
"ultraconserved"         -> evolution.ultraconserved_elements
"te_exaptation"          -> evolution.te_exaptation
"selection_sweep"        -> evolution.selection_sweeps
"clinvar"                -> variation.clinvar_variants
"gwas"                   -> variation.gwas_associations
"eqtl"                   -> qtl.eqtls
"meqtl"                  -> qtl.meqtls
"lad"                    -> nuclear.lads
"nad"                    -> nuclear.nads
"dmv"                    -> nuclear.dmvs
"super_enhancer"         -> nuclear.super_enhancers
"enhancer_gene"          -> regulatory.enhancer_gene_links
"imprinted_region"       -> ref.imprinted_icrs
```

---

## Data Inventory

### A. New Columns on `biophysics.sequence_properties`

5 new REAL columns. Migration: ALTER TABLE ADD COLUMN IF NOT EXISTS. Ingestion: Pattern B (UPDATE via staging from BigWig/BED source).

| Column | Source | Description | hg38 Native |
|--------|--------|-------------|:-----------:|
| `phylop_241way_mean` | Zoonomia 241-mammal BigWig (UCSC) | Mean mammalian-specific conservation per window | Yes |
| `phastcons_241way_mean` | Zoonomia 241-mammal BigWig (UCSC) | Mean probability of conserved element per window | Yes |
| `b_score_mean` | McVicker et al. B-scores (liftOver or CADD) | Background selection intensity (0=strong purifying, 1000=neutral) | No (hg19) |
| `recomb_rate_cmmb` | deCODE recombination map via UCSC recombRate | Recombination rate in centiMorgans per megabase | Yes |
| `mutation_rate_mean` | Roulette (Seplyarskiy et al. 2023) | Context-dependent per-base mutation rate | Yes |

**Storage:** 5 cols x 3M rows x 4 bytes = ~60 MB.

**Downloads:**
- Zoonomia phyloP: `https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP241way/hg38.phyloP241way.bw` (~8 GB)
- Zoonomia phastCons: `https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phastCons241way/hg38.phastCons241way.bw` (~4 GB)
- deCODE recombination: `https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/recombRate.txt.gz`
- B-scores: McVicker lab or extract from CADD v1.6+ (hg38)
- Roulette: `https://github.com/vseplyarskiy/Roulette` or Zenodo `https://doi.org/10.5281/zenodo.7568824`

**Migration (single file):**
```sql
-- XXX_evolutionary_physics.sql
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS phylop_241way_mean    real,
    ADD COLUMN IF NOT EXISTS phastcons_241way_mean real,
    ADD COLUMN IF NOT EXISTS b_score_mean          real,
    ADD COLUMN IF NOT EXISTS recomb_rate_cmmb      real,
    ADD COLUMN IF NOT EXISTS mutation_rate_mean    real;
```

### B. Column Addition to `annotation.repeats`

2 new columns on existing 5.3M-row repeats table.

| Column | Type | Derivation |
|--------|------|------------|
| `estimated_age_mya` | REAL | `(divergence_pct / 100) / (2 * 2.2e-9) / 1e6` from existing `divergence_pct` |
| `age_class` | TEXT | 'ancient' (>100 Mya), 'old' (25-100), 'recent' (5-25), 'young' (<5) |

**Storage:** ~42 MB (5.3M x 8 bytes).

**No download needed** — derived from existing RepeatMasker divergence_pct column. Pure SQL UPDATE:
```sql
UPDATE annotation.repeats SET
    estimated_age_mya = (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6,
    age_class = CASE
        WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 100 THEN 'ancient'
        WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 25  THEN 'old'
        WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 5   THEN 'recent'
        ELSE 'young'
    END;
```

### C. `evolution` Schema — 6 Tables

#### C1. `evolution.archaic_segments`

Neanderthal and Denisovan DNA introgression segments in modern human populations.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK registry.layers |
| build | genome_build | |
| chr_id | SMALLINT | FK ref.chromosomes |
| start_pos | INT | 0-based half-open |
| end_pos | INT | |
| coord | INT4RANGE | GENERATED STORED |
| source_species | TEXT | 'neanderthal' or 'denisovan' |
| population | TEXT | 'EUR', 'EAS', 'SAS', 'AMR', 'AFR' |
| posterior_prob | REAL | Confidence of introgression call |
| segment_length_kb | REAL | |
| snp_count | INT | Supporting variant count |

**Rows:** ~50K. **Source:** Browning et al. 2018 (Cell). **Build:** hg19 -> liftOver. **Partitioning:** LIST by build only (small table). **Indexes:** GiST on (chr_id, coord), B-tree on source_species.

#### C2. `evolution.archaic_methylation`

Reconstructed methylation maps from ancient DNA degradation patterns.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| species | TEXT | 'neanderthal', 'denisovan', 'modern_human' |
| methylation_level | REAL | Reconstructed beta (0-1) |
| confidence | TEXT | 'high', 'medium', 'low' |
| dmr_id | TEXT | DMR identifier if applicable |
| direction_vs_modern | TEXT | 'hyper', 'hypo', NULL |

**Rows:** ~500K. **Source:** Gokhman et al. 2014 (Science 344:523), Gokhman et al. 2020 (Science 369:eaay3788). **Build:** hg19 -> liftOver. **Partitioning:** LIST by build, then LIST by chr_id. **Indexes:** GiST on (chr_id, coord), B-tree on species.

#### C3. `evolution.accelerated_regions`

Human Accelerated Regions — conserved across mammals, rapidly evolved in humans.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| har_name | TEXT | Identifier (e.g., HAR1, HACNS1) |
| acceleration_score | REAL | Human-specific substitution rate |
| conservation_score | REAL | Non-human mammalian conservation |
| nearest_gene | TEXT | |
| distance_to_gene | INT | bp |
| category | TEXT | 'coding', 'noncoding', 'enhancer' |

**Rows:** ~3K. **Source:** Doan et al. 2016 (Cell) consolidated set. **Build:** hg19 -> liftOver. **Partitioning:** None (tiny table). **Indexes:** GiST on (chr_id, coord).

#### C4. `evolution.ultraconserved_elements`

Regions with 100% identity across human, mouse, and rat (>200bp). 300+ million years frozen.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| uce_name | TEXT | |
| length_bp | INT | |
| category | TEXT | 'exonic', 'intronic', 'intergenic' |
| nearest_gene | TEXT | |

**Rows:** 481. **Source:** UCSC Table Browser (hg38 native). **Partitioning:** None. **Indexes:** GiST on (chr_id, coord).

#### C5. `evolution.te_exaptation`

Transposable elements co-opted as regulatory elements — parasites turned tools.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| te_name | TEXT | RepeatMasker name |
| te_family | TEXT | LINE, SINE, LTR, DNA |
| te_age_mya | REAL | Estimated insertion age |
| regulatory_function | TEXT | 'enhancer', 'promoter', 'insulator', 'splice_site' |
| target_gene | TEXT | Regulated gene if known |
| evidence | TEXT | 'experimental', 'computational', 'both' |
| source_study | TEXT | Citation |

**Rows:** ~20K. **Source:** Chuong et al. 2017 + TE-derived regulatory catalogs. **Build:** hg19 -> liftOver. **Partitioning:** None. **Indexes:** GiST on (chr_id, coord), B-tree on te_family.

#### C6. `evolution.selection_sweeps`

Regions under recent positive selection, per population.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| population | TEXT | 'AFR', 'EUR', 'EAS', 'SAS', 'AMR' |
| ihs_max | REAL | Max |iHS| in region |
| xpehh_score | REAL | Cross-population EHH |
| fst_vs_global | REAL | Population differentiation |
| candidate_gene | TEXT | |
| sweep_type | TEXT | 'hard', 'soft', 'incomplete' |

**Rows:** ~100K. **Source:** selscan on 1000 Genomes Phase 3 / precomputed scans. **Build:** hg19 -> liftOver or recompute on hg38 1000G. **Partitioning:** LIST by build. **Indexes:** GiST on (chr_id, coord), B-tree on population.

### D. `variation` Schema — 2 Tables

#### D1. `variation.clinvar_variants`

Pathogenic and likely pathogenic human disease variants.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| variation_id | INT | ClinVar VariationID |
| rsid | TEXT | dbSNP rsID (nullable) |
| ref_allele | TEXT | |
| alt_allele | TEXT | |
| clinical_significance | TEXT | 'pathogenic', 'likely_pathogenic' |
| review_status | TEXT | ClinVar star rating |
| disease | TEXT | Associated condition |
| gene_symbol | TEXT | |
| molecular_consequence | TEXT | 'missense', 'frameshift', 'nonsense', etc. |
| origin | TEXT | 'germline', 'somatic', 'both' |

**Rows:** ~150K (filtered: pathogenic + likely pathogenic only). **Source:** `https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz` (hg38 native, updated monthly). **Partitioning:** LIST by build, then LIST by chr_id. **Indexes:** GiST on (chr_id, coord), B-tree on gene_symbol, B-tree on clinical_significance. **License:** Public domain (NCBI). **Citation:** Landrum et al. 2018 NAR.

#### D2. `variation.gwas_associations`

Genome-wide significant trait associations from published GWAS.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| rsid | TEXT | |
| trait | TEXT | Disease/trait name |
| p_value | DOUBLE PRECISION | |
| odds_ratio | REAL | Nullable |
| beta | REAL | Effect size (nullable) |
| mapped_gene | TEXT | |
| risk_allele | TEXT | |
| study_accession | TEXT | GWAS Catalog study ID |
| pmid | TEXT | PubMed ID |
| sample_size | INT | |

**Rows:** ~500K (p < 5e-8). **Source:** `https://www.ebi.ac.uk/gwas/api/search/downloads/full` (hg38 coordinates in current releases). **Partitioning:** LIST by build, then LIST by chr_id. **Indexes:** GiST on (chr_id, coord), B-tree on trait, B-tree on mapped_gene. **License:** Open access (EBI). **Citation:** Buniello et al. 2019 NAR.

### E. `qtl` Schema — 2 Tables

#### E1. `qtl.eqtls`

Significant cis-eQTLs from GTEx — variants that control gene expression.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | Variant position |
| coord | INT4RANGE | GENERATED |
| variant_id | TEXT | chr_pos_ref_alt_b38 format |
| gene_id | TEXT | Ensembl gene ID (ENSG) |
| gene_symbol | TEXT | Resolved symbol |
| tissue | TEXT | GTEx tissue name |
| tss_distance | INT | Variant-to-TSS distance |
| effect_size | REAL | Slope (beta) |
| p_value | DOUBLE PRECISION | Nominal p-value |
| q_value | REAL | FDR-corrected |

**Rows:** ~2M (significant pairs, deduplicated per gene-tissue, q < 0.05). **Source:** GTEx v8 `GTEx_Analysis_v8_eQTL.tar` — 49 per-tissue files of significant variant-gene pairs (hg38 native, publicly available). **Partitioning:** LIST by build, then HASH by chr_id (4 partitions). **Indexes:** GiST on (chr_id, coord), B-tree on gene_symbol, B-tree on tissue. **License:** Open access (significant results). **Citation:** GTEx Consortium 2020 Science.

**Ingestion note:** Parse variant_id (format: `chr1_12345_A_G_b38`) to extract chr, pos, ref, alt. Map gene_id (ENSG) to symbol via GENCODE v44 annotation already in gene.features.

#### E2. `qtl.meqtls`

Significant cis-meQTLs — variants that control DNA methylation levels.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | SNP position |
| coord | INT4RANGE | GENERATED |
| snp_rsid | TEXT | |
| cpg_probe_id | TEXT | Illumina 450K probe ID |
| beta | REAL | Effect size |
| se | REAL | Standard error |
| p_value | DOUBLE PRECISION | |
| allele_freq | REAL | |
| cis_trans | TEXT | 'cis' or 'trans' |
| distance | INT | SNP-CpG distance (bp) |

**Rows:** ~190K (significant cis-meQTLs). **Source:** GoDMC (`http://mqtldb.godmc.org.uk/downloads` or Zenodo). **Build:** hg19 — need liftOver for SNP positions; CpG positions via probe.coordinates already in DB. **Partitioning:** LIST by build. **Indexes:** GiST on (chr_id, coord), B-tree on cpg_probe_id. **License:** Open access. **Citation:** Min et al. 2021 Nat Genet 53:1311.

### F. `nuclear` Schema — 4 Tables

#### F1. `nuclear.lads`

Lamina-associated domains — heterochromatic genome at the nuclear periphery.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| lad_type | TEXT | 'constitutive' or 'facultative' |
| cell_type | TEXT | |
| damid_score | REAL | DamID enrichment (nullable) |

**Rows:** ~1.5K (constitutive LADs). **Source:** Kind et al. 2015 (Cell) / Meuleman et al. 2013. **Build:** hg19 -> liftOver. Also check 4DN portal for hg38. **Partitioning:** None (tiny table). **Indexes:** GiST on (chr_id, coord). **Citation:** Guelen et al. 2008 Nature, Kind et al. 2015 Cell.

#### F2. `nuclear.nads`

Nucleolus-associated domains.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| cell_type | TEXT | |
| enrichment_score | REAL | |

**Rows:** ~500. **Source:** Dillinger et al. 2017 (Genome Research). **Build:** hg19 -> liftOver. **Partitioning:** None. **Indexes:** GiST on (chr_id, coord). **Citation:** Dillinger et al. 2017 Genome Res.

#### F3. `nuclear.dmvs`

DNA Methylation Valleys — deeply hypomethylated regions, almost always at developmental master regulators.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| length_kb | REAL | |
| mean_methylation | REAL | Near-zero |
| nearest_gene | TEXT | |
| developmental_tf | BOOLEAN | Overlaps known dev TF |

**Rows:** ~1.5K. **Source:** Xie et al. 2013 (Cell) Table S1 or derive from Roadmap WGBS. **Build:** hg19 -> liftOver. **Partitioning:** None. **Indexes:** GiST on (chr_id, coord). **Citation:** Xie et al. 2013 Cell 153:1134.

#### F4. `nuclear.super_enhancers`

Master regulatory regions defined by exceptional H3K27ac signal.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| cell_type | TEXT | |
| se_rank | INT | Rank within cell type |
| constituent_count | INT | Number of constituent enhancers |
| target_gene | TEXT | |
| h3k27ac_signal | REAL | |

**Rows:** ~80K across cell types. **Source:** dbSUPER (`https://asntech.org/dbsuper/`). **Build:** hg19 -> liftOver. **Partitioning:** LIST by build. **Indexes:** GiST on (chr_id, coord), B-tree on cell_type. **Citation:** Khan & Zhang 2016 NAR.

### G. `regulatory` Schema Extension — 1 Table

#### G1. `regulatory.enhancer_gene_links`

Activity-by-Contact model predictions linking enhancers to their target genes.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT GENERATED | PK |
| layer_id | UUID | FK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos, end_pos | INT | Enhancer coordinates |
| coord | INT4RANGE | GENERATED |
| target_gene | TEXT | |
| target_gene_tss | INT | |
| cell_type | TEXT | |
| abc_score | REAL | Activity-by-Contact score |
| distance | INT | Enhancer-TSS distance (bp) |
| class | TEXT | 'intergenic', 'genic', 'promoter' |

**Rows:** ~500K (ABC > 0.02, top predictions). **Source:** Nasser et al. 2021 (Nature 593:238). **Build:** hg19 -> liftOver. **Partitioning:** LIST by build, then LIST by chr_id. **Indexes:** GiST on (chr_id, coord), B-tree on target_gene. **Citation:** Nasser et al. 2021 Nature.

### H. `ref` Schema Extension — 2 Tables

#### H1. `ref.imprinted_genes`

| Column | Type | Notes |
|--------|------|-------|
| gene_symbol | TEXT | PK |
| expressed_allele | TEXT | 'maternal', 'paternal' |
| imprint_status | TEXT | 'confirmed', 'predicted' |
| chromosome | TEXT | |
| associated_icr | TEXT | FK to imprinted_icrs (nullable) |

**Rows:** ~150. **Source:** geneimprint.com + Monk et al. 2019 Nat Rev Genet.

#### H2. `ref.imprinted_icrs`

| Column | Type | Notes |
|--------|------|-------|
| icr_name | TEXT | PK |
| build | genome_build | |
| chr_id | SMALLINT | FK |
| start_pos | INT | |
| end_pos | INT | |
| coord | INT4RANGE | GENERATED |
| methylated_allele | TEXT | 'maternal', 'paternal' |
| regulated_genes | TEXT[] | Array of gene symbols |

**Rows:** ~50. **Source:** Court et al. 2014 Genome Research (hg19 -> liftOver). **Indexes:** GiST on (chr_id, coord).

---

## On-Demand Computation Engine

### Problem

The 10.5bp AA/TT periodicity signal — critical for nucleosome positioning — vanishes at 1kb resolution (Phase 1 external validation confirmed this). Sub-1kb biophysics requires either storing 10-30x more rows or computing on the fly.

### Solution: New API Endpoint

**Endpoint:** `GET /v1/compute/{build}/{region}`

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `resolution` | INT | 100 | Window size in bp: 1, 10, 50, 100, 147, 500, 1000 |
| `tracks` | TEXT | all | Comma-separated track names, or "all" |
| `include_methylated` | BOOL | false | Also compute methylated-state NN parameters |
| `step` | INT | = resolution | Step size (for overlapping windows) |

**Max region:** 100 kb. At 1bp resolution on 100kb = 100K windows, computed in ~1-2 seconds.

**Computable tracks (from sequence only):**
- `gc_content` — GC fraction
- `cpg_density` — CpG count per bp
- `cpg_obs_exp` — CpG observed/expected ratio
- `stacking_dg37` — SantaLucia 1998 nearest-neighbor stacking free energy
- `melting_temp` — Predicted Tm
- `delta_h`, `delta_s` — Enthalpy and entropy of melting
- `curvature` — Dinucleotide wedge model curvature
- `groove_width` (mgw_mean) — Minor groove width from pentamer lookup
- `prot_mean` — Propeller twist from pentamer lookup
- `roll_mean` — Roll angle from pentamer lookup
- `helt_mean` — Helix twist from pentamer lookup
- `periodicity_power` — 10.5bp AA/TT periodicity (FFT on dinucleotide signal)
- `dinucleotide_entropy` — Shannon entropy of dinucleotide composition
- `kmer_complexity` — Linguistic complexity
- `g4_density` — G-quadruplex regex hit density
- `meth_delta_g` — Stacking energy change upon full CpG methylation
- `meth_delta_tm` — Tm change upon full CpG methylation

**Response format:** Same GRanges JSON envelope as `query_region`:
```json
{
  "status": "complete",
  "data": {
    "seqnames": ["chr17", "chr17", ...],
    "ranges": { "start": [7668402, 7668502, ...], "end": [7668502, 7668602, ...] },
    "strand": ["*", "*", ...],
    "mcols": {
      "gc_content": [0.52, 0.48, ...],
      "stacking_dg37": [-1.67, -1.52, ...],
      ...
    }
  },
  "resolution_bp": 100,
  "computed_from": "reference_sequence"
}
```

**Implementation:** Factor the biophysics computation code from the ingestion pipeline (`biophysics_tracks.py` engine + `dnashape.py` pentamer tables + NN parameter lookup) into a shared library `src/polymer_genomics/compute/biophysics_engine.py`. Both the ingestion pipeline and the API endpoint call the same engine. The API endpoint fetches sequence via `get_sequence`, passes to engine, returns GRanges.

**MCP tool:** `compute_region_biophysics` already exists. Extend it to use this shared engine with a `resolution` parameter.

---

## Cross-Reference Query Recipes

Add to existing `/v1/query/recipes` endpoint.

### New Recipes

| Recipe | Description | Layers Crossed |
|--------|-------------|----------------|
| `archaic_divergent_methylation` | Regions where archaic methylation differs from modern + full biophysics | archaic_methylation x biophysics |
| `recently_selected_regulatory` | Selection sweeps overlapping ENCODE cCREs | selection_sweep x encode_ccre |
| `introgressed_te_landscape` | TEs located within Neanderthal introgression segments | archaic_introgression x repeatmasker |
| `har_biophysics` | HARs with complete 64-column biophysical + evolutionary portrait | accelerated_region x biophysics |
| `clinvar_material_channel` | Pathogenic variants with biophysics + conservation context | clinvar x biophysics x conservation |
| `eqtl_biophysics` | eQTL variants annotated with biophysical properties of variant site | eqtl x biophysics |
| `meqtl_probe_physics` | meQTL variant + target probe biophysics + clock membership | meqtl x probe x biophysics x clocks |
| `deep_time_probe` | Any probe: conservation depth, archaic methylation, selection, TE context | probe x evolution layers |
| `exapted_te_regulatory` | Exapted TEs with their enhancer-gene links | te_exaptation x enhancer_gene |
| `frozen_vs_accelerated` | UCEs vs HARs: side-by-side biophysical comparison | ultraconserved x accelerated_region x biophysics |
| `nuclear_geography` | Full nuclear compartment portrait: LAD/NAD/DMV + compartment + replication | lad x nad x dmv x hic_compartment x biophysics |
| `gwas_to_mechanism` | GWAS hit -> eQTL -> gene -> pathway -> biophysics (full causal chain) | gwas x eqtl x expression x pathways x biophysics |

### Implementation

Each recipe is a multi-layer intersect query defined in `src/polymer_genomics/queries/recipes.py`. The existing recipe infrastructure handles layer resolution, field selection, and GRanges assembly. New recipes follow the same pattern.

---

## Storage Estimate

| Category | Raw Data | With Indexes | Notes |
|----------|----------|-------------|-------|
| 5 new biophysics columns | 60 MB | 60 MB | No new indexes needed (existing GiST covers) |
| TE age columns | 42 MB | 42 MB | Same |
| evolution.archaic_segments | 5 MB | 15 MB | GiST + B-tree |
| evolution.archaic_methylation | 50 MB | 150 MB | GiST + B-tree, partitioned |
| evolution.accelerated_regions | 300 KB | 1 MB | Tiny |
| evolution.ultraconserved_elements | 50 KB | 200 KB | Tiny |
| evolution.te_exaptation | 2 MB | 6 MB | |
| evolution.selection_sweeps | 10 MB | 30 MB | |
| variation.clinvar_variants | 30 MB | 90 MB | Partitioned, 3 indexes |
| variation.gwas_associations | 100 MB | 300 MB | Partitioned, 3 indexes |
| qtl.eqtls | 200 MB | 600 MB | Partitioned, 3 indexes (largest table) |
| qtl.meqtls | 19 MB | 57 MB | |
| nuclear.lads | 150 KB | 500 KB | Tiny |
| nuclear.nads | 50 KB | 200 KB | Tiny |
| nuclear.dmvs | 150 KB | 500 KB | Tiny |
| nuclear.super_enhancers | 8 MB | 24 MB | |
| regulatory.enhancer_gene_links | 50 MB | 150 MB | Partitioned |
| ref.imprinted_genes | 15 KB | 15 KB | |
| ref.imprinted_icrs | 5 KB | 10 KB | |
| **TOTAL** | **~577 MB** | **~1.5 GB** | |

**Current database:** 14 GB / 20 GB.
**After expansion:** ~15.5 GB / 40 GB (volume upgrade $3/mo).
**Headroom:** 24.5 GB free for future growth.

---

## Ingestion Pipeline — Build Order

### Tier 9: Deep Time Foundation (Steps 54-61)

Easy wins. hg38 native or pure derivation. No liftOver needed. ~1-2 days.

| Step | Module | Pattern | Source | Rows | Est. Time |
|------|--------|---------|--------|------|-----------|
| 54 | `zoonomia_conservation` | B (UPDATE) | Zoonomia BigWig (UCSC hg38) | UPDATE 3M | 1-2h |
| 55 | `recombination_rate` | B (UPDATE) | deCODE via UCSC (hg38) | UPDATE 3M | 30m |
| 56 | `ultraconserved_elements` | A (INSERT) | UCSC Table Browser (hg38) | 481 | 10m |
| 57 | `clinvar_variants` | A (INSERT) | NCBI ClinVar VCF (hg38) | ~150K | 30m |
| 58 | `gwas_associations` | A (INSERT) | NHGRI-EBI GWAS Catalog (hg38) | ~500K | 30m |
| 59 | `te_age_estimation` | B (UPDATE) | Derived from existing milliDiv | UPDATE 5.3M | 15m |
| 60 | `ancestral_alleles` | C (REF) | Ensembl EPO FASTA (hg38) | Ref data | 30m |
| 61 | `imprinted_genes` | C (REF) | geneimprint + Court 2014 | ~200 | 10m |

**Dependencies:** None. All independent of each other and existing tiers.
**Migrations needed:** `004_evolutionary_physics_columns.sql` (biophysics cols), `005_evolution_schema.sql` (UCE table), `006_variation_schema.sql` (ClinVar + GWAS tables), `007_te_age_columns.sql` (repeats cols), `008_ref_imprinting.sql` (ref tables).

### Tier 10: Evolutionary Dynamics (Steps 62-68)

Requires liftOver toolchain (hg19 -> hg38) or computation. ~3-5 days.

| Step | Module | Pattern | Source | Rows | Est. Time |
|------|--------|---------|--------|------|-----------|
| 62 | `human_accelerated_regions` | A (INSERT) | Doan 2016 + liftOver | ~3K | 1h |
| 63 | `archaic_introgression` | A (INSERT) | Browning 2018 + liftOver | ~50K | 2h |
| 64 | `background_selection` | B (UPDATE) | McVicker B-scores + liftOver | UPDATE 3M | 2h |
| 65 | `mutation_rate` | B (UPDATE) | Roulette (hg38 native) | UPDATE 3M | 2h |
| 66 | `lads` | A (INSERT) | Kind 2015 + liftOver / 4DN | ~1.5K | 1h |
| 67 | `super_enhancers` | A (INSERT) | dbSUPER + liftOver | ~80K | 2h |
| 68 | `dmvs` | A (INSERT) | Xie 2013 + liftOver | ~1.5K | 1h |

**Dependencies:** Tier 9 migrations must be applied first (evolution schema exists). liftOver chain file needed: `hg19ToHg38.over.chain.gz` from UCSC.
**Migrations needed:** `009_nuclear_schema.sql` (LADs, NADs, DMVs, SEs).

### Tier 11: Causal Links (Steps 69-73)

Larger datasets, more parsing complexity. ~1-2 weeks.

| Step | Module | Pattern | Source | Rows | Est. Time |
|------|--------|---------|--------|------|-----------|
| 69 | `eqtls` | A (INSERT) | GTEx v8 49 tissue files (hg38) | ~2M | 4-6h |
| 70 | `meqtls` | A (INSERT) | GoDMC + liftOver | ~190K | 2h |
| 71 | `enhancer_gene_links` | A (INSERT) | Nasser 2021 ABC + liftOver | ~500K | 3h |
| 72 | `te_exaptation` | A (INSERT) | Chuong 2017 + catalogs | ~20K | 2h |
| 73 | `archaic_methylation` | A (INSERT) | Gokhman 2014/2020 SI + liftOver | ~500K | 4h |

**Dependencies:** evolution and qtl schemas from Tier 10 migrations.
**Migrations needed:** `010_qtl_schema.sql` (eQTLs, meQTLs), `011_enhancer_gene.sql` (regulatory extension).

### Tier 12: Advanced / Computed (Steps 74-78)

Selection sweep computation, on-demand engine, recipe queries. ~2-3 weeks.

| Step | Module | Pattern | Source | Rows | Est. Time |
|------|--------|---------|--------|------|-----------|
| 74 | `selection_sweeps` | A (INSERT) | selscan / precomputed | ~100K | 1-2 days |
| 75 | `nads` | A (INSERT) | Dillinger 2017 SI + liftOver | ~500 | 1h |
| 76 | `on_demand_engine` | API | Factor biophysics computation | -- | 2-3 days |
| 77 | `cross_reference_recipes` | API | 12 new recipe queries | -- | 2-3 days |
| 78 | `5hmc_maps` | A (INSERT) | GEO deposits + liftOver | ~500K | 1 day |

**Dependencies:** All prior tiers complete. Biophysics engine refactored.

---

## Migration File Summary

| Migration | Creates | Dependencies |
|-----------|---------|-------------|
| `004_evolutionary_physics_columns.sql` | 5 new cols on biophysics.sequence_properties | None |
| `005_evolution_schema.sql` | evolution schema + 6 tables (archaic_segments, archaic_methylation, accelerated_regions, ultraconserved_elements, te_exaptation, selection_sweeps) + layer_type enums | None |
| `006_variation_schema.sql` | variation schema + 2 tables (clinvar_variants, gwas_associations) + layer_type enums | None |
| `007_te_age_columns.sql` | 2 new cols on annotation.repeats (estimated_age_mya, age_class) | None |
| `008_ref_imprinting.sql` | 2 new tables in ref (imprinted_genes, imprinted_icrs) | None |
| `009_nuclear_schema.sql` | nuclear schema + 4 tables (lads, nads, dmvs, super_enhancers) + layer_type enums | None |
| `010_qtl_schema.sql` | qtl schema + 2 tables (eqtls, meqtls) + layer_type enums | None |
| `011_enhancer_gene.sql` | regulatory.enhancer_gene_links table + layer_type enum | None |

All migrations are independent (no inter-migration dependencies) and idempotent (IF NOT EXISTS, ADD VALUE IF NOT EXISTS).

---

## API Changes Summary

### New Endpoint
- `GET /v1/compute/{build}/{region}` — on-demand biophysics at arbitrary resolution

### Extended Endpoints (automatic via layer system)
- `GET /v1/regions/{build}/{region}` — 16 new layer types queryable
- `GET /v1/query/recipes` — 12 new cross-domain recipes
- `GET /v1/correlate/{build}/{region}` — new layers available for correlation

### New Gene-Centric Endpoints (optional, convenience)
- `GET /v1/genes/{build}/{symbol}/evolution` — evolutionary context (HARs, UCEs, introgression, selection)
- `GET /v1/genes/{build}/{symbol}/variants` — ClinVar + GWAS for gene region
- `GET /v1/genes/{build}/{symbol}/qtls` — eQTLs + meQTLs

### New MCP Tools (extend existing server)
- `compute_region_biophysics` — extend with `resolution` parameter
- `lookup_gene_evolution` — gene evolutionary context
- `lookup_gene_variants` — gene disease variants
- `lookup_gene_qtls` — gene QTLs

---

## What This Becomes

After all 4 tiers:

| Metric | Before | After |
|--------|--------|-------|
| Queryable layers | 28 | 44+ (41 achieved) |
| Biophysics columns per window | 59 | 64 (achieved) |
| Feature tables | ~15 | ~31 (~25 achieved) |
| Schemas | 8 | 12 (achieved) |
| Cross-domain recipes | 5 | 17 |
| Temporal depth | PhyloP 100-way only | Archaic methylation, introgression, HARs, UCEs, TE ages, selection sweeps, B-scores, Zoonomia 241-way |
| Causal links | None | eQTLs, meQTLs, enhancer-gene, GWAS |
| Disease context | None | ClinVar pathogenic, GWAS catalog |
| Nuclear geography | TADs + compartments | + LADs, NADs, DMVs, super-enhancers |
| Resolution | 1kb only | 1bp-1kb on demand |
| Storage | 14 GB | ~15.5 GB |
| Monthly cost increase | $0 | ~$3 (volume expansion) |

The Rosetta Stone whose inscriptions run backward through deep time. One query, one coordinate, the full history of the genome at that position.

---

## Citations

All datasets require proper attribution. Key citations:

- Zoonomia: Zoonomia Consortium 2023 Science 380:eabn3943
- McVicker B-scores: McVicker et al. 2009 PLoS Genet
- deCODE recombination: Halldorsson et al. 2019 Science
- Roulette mutation rates: Seplyarskiy et al. 2023 Nature
- ClinVar: Landrum et al. 2018 NAR
- GWAS Catalog: Buniello et al. 2019 NAR
- GTEx eQTLs: GTEx Consortium 2020 Science
- GoDMC meQTLs: Min et al. 2021 Nat Genet 53:1311
- ABC enhancer-gene: Nasser et al. 2021 Nature 593:238
- HARs: Doan et al. 2016 Cell
- UCEs: Bejerano et al. 2004 Science 304:1321
- Archaic introgression: Browning et al. 2018 Cell
- Archaic methylation: Gokhman et al. 2014 Science 344:523; Gokhman et al. 2020 Science 369:eaay3788
- LADs: Guelen et al. 2008 Nature; Kind et al. 2015 Cell
- NADs: Dillinger et al. 2017 Genome Res
- DMVs: Xie et al. 2013 Cell 153:1134
- Super-enhancers: Khan & Zhang 2016 NAR (dbSUPER)
- TE exaptation: Chuong et al. 2017 Nat Rev Genet
- Imprinting: Monk et al. 2019 Nat Rev Genet; Court et al. 2014 Genome Res
- 5hmC: Lister et al. 2013 Science (brain)
- Selection: selscan (Szpiech & Hernandez 2014 Mol Biol Evol)
