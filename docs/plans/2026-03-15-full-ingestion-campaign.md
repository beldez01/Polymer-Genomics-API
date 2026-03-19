# Full Ingestion Campaign — 2026-03-15

## STATUS: SUBSTANTIALLY COMPLETE (2026-03-15)

**32 tables loaded. 19 GB. ~57M rows. 49 biophysics columns. 27 registered layers with full epistemic metadata.**

Completed in single session: Tiers 1-5 (foundation, gene fabric, biophysics, regulatory, new Phase 2/3.5 code).

### Completed:
- [x] All Tier 1-5 ingestions (32 tables with data)
- [x] `queries.py` — already had all 20 new columns (prior session)
- [x] MCP tool descriptions — already updated with L1/Green's/extended (prior session)
- [x] Docker shm_size increased to 256MB (docker-compose.yml)
- [x] VACUUM ANALYZE on all large tables (biophysics, repeats, chromatin, conservation, etc.)
- [x] Registry row counts and epistemic metadata (evidence_class, tier) for all 27 layers
- [x] 3 new migrations (038-040) + 3 new ingestion scripts written and executed

### Remaining:
- [x] Melting domains — complete (verified 2026-03-17)
- [ ] Protein properties/turnover/evolution — need external data files (UniProt, Mathieson, Ensembl)
- [ ] GTEx expression — need portal login for GCT download
- [ ] Conservation (PhyloP/PhastCons) — need ~12 GB BigWig download

## Objective

Load ALL data layers into the PolymerGenomicsAPI database. This plan fills every empty table, writes new ingestion code for Phase 2 (L1) and Phase 3.5 (Green's function), and expands the biophysics surface with Phase 1 extended tracks.

## Constraints

- **NO variant annotations** (ClinVar, gnomAD variants, eQTLs) — deferred
- **NO nucleosome wrapping** (Phase 3 L2) — needs external validation first
- Database: Fly.io PostgreSQL 16, currently 14 GB / 20 GB volume
- Estimated final size: ~17.2 GB (expand to 30 GB before Tier 4)

## Current State (5 layers loaded)

| Layer | Table | Status |
|-------|-------|--------|
| Chromosomes | ref.chromosomes | Loaded |
| Gene models | gene.features | Loaded (GENCODE v44) |
| CpG sites + islands | cpg.sites, cpg.islands | Loaded |
| Probes | probe.coordinates | Loaded (450K/EPIC/v2) |
| Isochores | ref.isochores | Loaded |

Everything else: migrations exist, ingestion scripts exist, query code exists — but tables are empty.

---

## Pre-Flight Checklist

Before any ingestion:

- [ ] All 36 migrations applied (002–037)
- [ ] Docker Compose running (local) or Fly proxy active (production)
- [ ] Verify DB connection: `uv run python -c "import asyncio; from polymer_genomics.db import get_pool; ..."`
- [ ] Inventory missing data files (see Data File Status below)

---

## TIER 1: Foundation (~2 min, <1 MB)

No external data needed. All values embedded in Python scripts.

| Step | Layer | Script | Command | Rows | Migration |
|------|-------|--------|---------|------|-----------|
| 6 | Reference constants | `reference_constants.py` | `uv run python -m polymer_genomics.ingest.reference_constants` | ~130 | 018 |
| 7 | SBS spectrum | `sbs_spectrum.py` | `uv run python -m polymer_genomics.ingest.sbs_spectrum` | 96 | 025 |
| 8 | Epigenetic clocks | `epigenetic_clocks.py` | `uv run python -m polymer_genomics.ingest.epigenetic_clocks --data-dir data/clocks` | ~1,400 | 026 |
| 9 | Gene aliases | `gene_aliases.py` | `uv run python -m polymer_genomics.ingest.gene_aliases` | ~200K | 032 |
| 10 | Breakpoints | `breakpoints.py` | `uv run python -m polymer_genomics.ingest.breakpoints` | ~50 | 029 |

**Verification:**
```sql
SELECT count(*) FROM reference.nn_thermodynamics;       -- 48
SELECT count(*) FROM reference.dinucleotide_properties;  -- 16
SELECT count(*) FROM reference.amino_acid_properties;    -- 20
SELECT count(*) FROM reference.physical_constants;       -- ~35
SELECT count(*) FROM reference.sbs_spectrum;             -- 96
SELECT count(*) FROM ref.clock_metadata;                 -- 6+
SELECT count(*) FROM ref.clock_coefficients;             -- ~1400
SELECT count(*) FROM gene.aliases;                       -- ~150-250K
SELECT count(*) FROM fragility.breakpoints;              -- ~50
```

---

## TIER 2: Gene Annotation Fabric (~30-60 min, ~415 MB)

| Step | Layer | Script | Data File | File Status | Rows | Migration |
|------|-------|--------|-----------|-------------|------|-----------|
| 11 | Gene costs | `gene_costs.py` | `reference_gene_cost_table_v3.tsv` | PRESENT (Research/data/) | ~20K | 003, 010 |
| 12 | Expression | `expression.py` | GTEx v10 median TPM GCT | **MISSING** | ~56K | 004 |
| 13 | Gene constraint | `gene_constraint.py` | `gnomad.v2.1.1.lof_metrics.by_gene.txt` | PRESENT (data/gnomad/) | ~20K | 011 |
| 14 | Gene pathways | `gene_pathways.py` | `NCBI2Reactome_All_Levels.txt` | PRESENT (data/reactome/) | ~100K | 013 |
| 15 | Gene sets | `gene_sets.py` | `h.all.v2024.1.Hs.symbols.gmt` | PRESENT (data/msigdb/) | ~3K | 014 |
| 16 | Protein abundance | `protein_abundance.py` | PaxDb TSVs (11 tissues) | PRESENT (data/paxdb/) | ~100K | 007 |
| 17 | Protein atlas | `protein_atlas.py` | HPA normal_tissue + subcellular | PRESENT (data/hpa/) | ~1M | 015 |
| 18 | Protein properties | `protein_properties.py` | `uniprot_protparam_properties.tsv` | **MISSING** | ~20K | 009 |
| 19 | Protein turnover | `protein_turnover.py` | `mathieson_2018_protein_halflife.tsv` | **MISSING** | ~5K | 008 |
| 20 | Protein evolution | `protein_evolution.py` | `human_mouse_dnds.tsv` | **MISSING** | ~20K | 012 |

### Missing Data Files — Tier 2

1. **GTEx GCT** (~500 MB): Download from GTEx Portal (requires login)
   - File: `GTEx_Analysis_2022-06-06_v10_RNASeQCv1.1.9_gene_median_tpm.gct.gz`
   - Place at: `data/gtex/`

2. **UniProt ProtParam** (generate from BioMart or UniProt API)
   - Place at: `data/uniprot_protparam_properties.tsv`

3. **Mathieson 2018 half-life** (supplementary data, PMID 29414762)
   - Place at: `data/mathieson_2018_protein_halflife.tsv`

4. **Ensembl dN/dS** (BioMart export: human-mouse orthologs with dN/dS)
   - Place at: `data/ensembl/human_mouse_dnds.tsv`

> **Strategy**: Run steps 11, 13–17 immediately (all data present). Defer 12, 18–20 until files acquired.

**Verification:**
```sql
SELECT count(*) FROM bioenergetics.gene_costs;           -- ~20K
SELECT count(*) FROM expression.gene_tpm;                -- ~56K
SELECT count(*) FROM conservation.gene_constraint;       -- ~20K
SELECT count(*) FROM annotation.gene_pathways;           -- ~100K
SELECT count(*) FROM annotation.gene_sets;               -- ~3K
SELECT count(*) FROM bioenergetics.protein_abundance;    -- ~100K
SELECT count(*) FROM proteomics.tissue_expression;       -- ~1M
SELECT count(*) FROM proteomics.subcellular_location;    -- ~13K
```

---

## TIER 3: Biophysics — The Moat (~60-120 min, ~600 MB)

**CRITICAL ORDERING**: Step 21 must complete FIRST. Steps 22–24 UPDATE the rows it creates.

| Step | Layer | Script | Data Source | Status | Rows | Migration |
|------|-------|--------|-------------|--------|------|-----------|
| 21 | Biophysics L0 | `biophysics_tracks.py` | Phase 1 BigWig (7 files) | PRESENT | ~3.1M INSERT | 019 |
| 22 | DNA shape | `dnashape.py` | Phase 1 BigWig (4 shape files) | PRESENT | ~3.1M UPDATE | 028 |
| 23 | Methyl DNA shape | `methyl_dnashape.py` | Phase 1 BigWig (4 delta files) | PRESENT | ~3.1M UPDATE | 031 |
| 24 | Melting domains | `melting_domains.py` | Computes from hg38.fa | PRESENT | ~3.1M UPDATE | 036 |
| 25 | Methylation ref | `methylation.py` | `methylation_reference_hg38.csv` | PRESENT | ~850K | 002 |

**Data paths:**
- Phase 1: `~/Desktop/Polymer_Evolution/phase1/output/window_1000/`
- Shape: Same dir (dnashape_mgw.bw, dnashape_prot.bw, etc.)
- FASTA: `data/hg38.fa`

**Notes:**
- `melting_domains.py` is CPU-intensive (Poland-Scheraga from FASTA, 30-60 min)
- Run `VACUUM ANALYZE biophysics.sequence_properties` after all updates complete

**Verification:**
```sql
SELECT count(*) FROM biophysics.sequence_properties;                                -- ~3.1M
SELECT count(*) FROM biophysics.sequence_properties WHERE mgw_mean IS NOT NULL;     -- ~3.1M
SELECT count(*) FROM biophysics.sequence_properties WHERE delta_roll IS NOT NULL;   -- ~3.1M
SELECT count(*) FROM biophysics.sequence_properties WHERE bubble_propensity IS NOT NULL; -- ~3.1M
SELECT count(*) FROM ref.methylation_reference;                                     -- ~850K
```

---

## TIER 4: Regulatory & Genomic Context (~2-4 hr, ~1.95 GB)

> **Before starting Tier 4**: Expand Fly.io volume to 30 GB
> `fly volumes extend <vol_id> --size 30 -a polymer-db`

| Step | Layer | Script | Data Source | Status | Rows | Migration |
|------|-------|--------|-------------|--------|------|-----------|
| 26 | Conservation | `conservation.py` | PhyloP + PhastCons BigWig | **MISSING** (~12 GB download) | ~3.1M | 006 |
| 27 | Regulatory | `regulatory.py` | ENCODE cCRE V4 BED | PRESENT (Research/data/encode/) | ~926K | 005 |
| 28 | Chromatin state | `chromatin_state.py` | ChromHMM 15-state BEDs | PRESENT (data/chromhmm/) | ~4.5M | 016 |
| 29 | Repeats | `repeats.py` | RepeatMasker rmsk.txt | PRESENT (data/repeatmasker/) | ~5.5M | 017 |
| 30 | HERV loci | `herv_loci.py` | Telescope HERV GTF | PRESENT (data/herv/) | ~15K | 034 |
| 31 | Probe-repeat xref | `probe_repeat_xref.py` | Computed (requires step 29) | N/A | ~200K | 035 |
| 32 | Non-B DNA | `nonb_dna.py` | Computes from hg38.fa | PRESENT | ~3.1M | 030 |
| 33 | Histone marks | `histone_marks.py` | ENCODE narrowPeak files | PRESENT (data/encode/histone/) | ~500K | 021 |
| 34 | GWAS catalog | `gwas_catalog.py` | EBI GWAS TSV | PRESENT (data/gwas/) | ~400K | 022 |
| 35 | Fragility composite | `fragility_composite.py` | Computed (requires 10, 21, 32) | N/A | ~3.1M | 037 |

### Missing Data Files — Tier 4

1. **PhyloP BigWig** (~9 GB):
   ```bash
   curl -O https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw
   ```

2. **PhastCons BigWig** (~3 GB):
   ```bash
   curl -O https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phastCons100way/hg38.phastCons100way.bw
   ```

3. **bigWigAverageOverBed binary** (if not already installed):
   ```bash
   # macOS ARM:
   curl -O https://hgdownload.soe.ucsc.edu/admin/exe/macOSX.arm64/bigWigAverageOverBed
   chmod +x bigWigAverageOverBed
   ```

> **Strategy**: Run steps 27–30, 33–34 immediately (data present). Start conservation BigWig downloads in background. Steps 31 and 35 are computed from loaded data.

**Ordering constraints:**
- Step 31 (probe_repeat_xref) requires step 29 (repeats)
- Step 35 (fragility_composite) requires steps 10, 21, 32

**Verification:**
```sql
SELECT count(*) FROM conservation.scores;            -- ~3.1M
SELECT count(*) FROM regulatory.ccre;                -- ~926K
SELECT count(*) FROM regulatory.chromatin_state;     -- ~4.5M
SELECT count(*) FROM annotation.repeats;             -- ~5.5M
SELECT count(*) FROM annotation.herv_loci;           -- ~15K
SELECT count(*) FROM probe.repeat_xref;              -- ~200K
SELECT count(*) FROM fragility.nonb_dna;             -- ~3.1M
SELECT count(*) FROM regulatory.histone_peaks;       -- ~500K
SELECT count(*) FROM annotation.gwas_associations;   -- ~400K
SELECT count(*) FROM fragility.composite_score;      -- ~3.1M
```

---

## TIER 5: New Code — Phase 2 L1 + Phase 3.5 + Phase 1 Extras (~200 MB)

### 5A. Phase 2 L1 Methylation Perturbation (10 tracks)

**Source**: `/Users/zbb2/Desktop/Polymer_Evolution/phase2/output/window_1000/`

**New files to create:**

1. **Migration `038_methylation_perturbation.sql`:**
```sql
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS cpg_count real,
    ADD COLUMN IF NOT EXISTS cpg_density real,
    ADD COLUMN IF NOT EXISTS cpg_obs_exp real,
    ADD COLUMN IF NOT EXISTS meth_delta_g real,
    ADD COLUMN IF NOT EXISTS meth_delta_tm real,
    ADD COLUMN IF NOT EXISTS meth_sensitivity real,
    ADD COLUMN IF NOT EXISTS methylation_capacity real,
    ADD COLUMN IF NOT EXISTS demethylation_cost real,
    ADD COLUMN IF NOT EXISTS oxidation_depth real,
    ADD COLUMN IF NOT EXISTS taut_relaxed real;
```

2. **Ingestion script `ingest/methylation_perturbation.py`:**
   - Clone pattern from `dnashape.py` (UPDATE-via-temp-table)
   - 10 BigWig files → 10 columns on existing biophysics rows
   - Requires step 21 (biophysics_tracks) to have populated the table first

**BigWig→Column mapping:**
| BigWig file | DB column |
|-------------|-----------|
| cpg_count.bw | cpg_count |
| cpg_density.bw | cpg_density |
| cpg_obs_exp.bw | cpg_obs_exp |
| meth_delta_G.bw | meth_delta_g |
| meth_delta_Tm.bw | meth_delta_tm |
| meth_sensitivity.bw | meth_sensitivity |
| methylation_capacity.bw | methylation_capacity |
| demethylation_cost.bw | demethylation_cost |
| oxidation_depth.bw | oxidation_depth |
| taut_relaxed.bw | taut_relaxed |

### 5B. Phase 3.5 Green's Function (4 tracks)

**Source**: `/Users/zbb2/Desktop/Polymer_Evolution/phase3_5/output/window_1000/`

**New files to create:**

1. **Migration `039_greens_function.sql`:**
```sql
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS correlation_length real,
    ADD COLUMN IF NOT EXISTS integrated_response real,
    ADD COLUMN IF NOT EXISTS perturbation_reach real,
    ADD COLUMN IF NOT EXISTS response_asymmetry real;
```

2. **Ingestion script `ingest/greens_function.py`:**
   - Same UPDATE-via-temp-table pattern
   - 4 BigWig files → 4 columns

### 5C. Phase 1 Extended Tracks (6 tracks)

**Source**: `/Users/zbb2/Desktop/Polymer_Evolution/phase1/output/window_1000/`

**New files to create:**

1. **Migration `040_extended_biophysics.sql`:**
```sql
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS deformability real,
    ADD COLUMN IF NOT EXISTS g4_density real,
    ADD COLUMN IF NOT EXISTS g4_max_score real,
    ADD COLUMN IF NOT EXISTS kmer_complexity real,
    ADD COLUMN IF NOT EXISTS dinucleotide_entropy real,
    ADD COLUMN IF NOT EXISTS dominant_period real;
```

2. **Ingestion script `ingest/extended_biophysics.py`:**
   - Same UPDATE pattern, 6 BigWig files → 6 columns

### 5D. Code Changes Required

1. **`queries.py`** — Update `region_biophysics_query()` SELECT list and `_convert_biophysics()` to include all 20 new columns (10 L1 + 4 Green's + 6 extended)

2. **`mcp/server.py`** — Update MCP tool descriptions for `compute_region_biophysics` and `query_region` to mention new available fields

3. **Registry** — Register new layer versions or update existing `sequence_biophysics_l0` metadata to reflect expanded column set

4. **Run `VACUUM ANALYZE biophysics.sequence_properties`** after all Tier 5 updates

**Verification:**
```sql
SELECT count(*) FROM biophysics.sequence_properties WHERE cpg_count IS NOT NULL;          -- ~3.1M
SELECT count(*) FROM biophysics.sequence_properties WHERE correlation_length IS NOT NULL;  -- ~3.1M
SELECT count(*) FROM biophysics.sequence_properties WHERE deformability IS NOT NULL;       -- ~3.1M
```

---

## Storage Summary

| Tier | Est. Storage | Cumulative |
|------|-------------|------------|
| Current (5 layers) | 14.0 GB | 14.0 GB |
| Tier 1 (foundation) | ~12 MB | 14.0 GB |
| Tier 2 (gene fabric) | ~415 MB | 14.4 GB |
| Tier 3 (biophysics) | ~600 MB | 15.0 GB |
| Tier 4 (regulatory) | ~1.95 GB | 17.0 GB |
| Tier 5 (new code) | ~200 MB | 17.2 GB |
| **Total** | | **~17.2 GB / 20 GB** |

> Expand volume to 30 GB before Tier 4 for safety margin.

---

## Execution Strategy

### What can run NOW (all data present):
- All of Tier 1
- Tier 2 steps 11, 13, 14, 15, 16, 17 (skip 12, 18-20 until files acquired)
- All of Tier 3
- Tier 4 steps 27, 28, 29, 30, 33, 34 (skip 26 until BigWig downloaded)
- Tier 4 steps 31, 35 (computed, after dependencies)

### What needs data files first:
- Step 12 (GTEx GCT) — requires portal login
- Steps 18-20 (UniProt, Mathieson, Ensembl) — need download/generation
- Step 26 (conservation) — 12 GB BigWig download

### What needs NEW CODE:
- Steps 36-38 (Tier 5) — 3 migrations + 3 ingestion scripts + queries.py update

### Parallelism opportunities:
- Tier 1 steps are independent (can run concurrently)
- Tier 2 steps are independent (can run concurrently)
- Tier 3 step 21 must complete before 22-24 (sequential chain)
- Tier 4 steps 27-30, 32-34 are independent; 31 depends on 29; 35 depends on 10+21+32

---

## Data File Status Summary

### PRESENT (21 sources)
- [x] data/clocks/ (7 TSVs)
- [x] data/reactome/ (2 files)
- [x] data/msigdb/ (GMT)
- [x] data/paxdb/ (11 TSVs)
- [x] data/hpa/ (2 TSVs)
- [x] data/gnomad/ (constraint file)
- [x] data/chromhmm/ (15 BEDs)
- [x] data/repeatmasker/rmsk.txt
- [x] data/herv/ (GTF)
- [x] data/encode/histone/ (18 narrowPeak)
- [x] data/gwas/ (catalog TSV)
- [x] data/methylation_reference_hg38.csv
- [x] data/hg38.fa + .fai
- [x] Research/data/encode/encodeCcreCombined.bed
- [x] Research/data/output/reference_gene_cost_table_v3.tsv
- [x] Phase 1 BigWig (37 files at 1kb)
- [x] Phase 2 BigWig (10 files at 1kb)
- [x] Phase 3.5 BigWig (4 files at 1kb)

### MISSING (6 sources)
- [ ] GTEx v10 median TPM GCT (~500 MB, portal login)
- [ ] hg38.phyloP100way.bw (~9 GB, UCSC)
- [ ] hg38.phastCons100way.bw (~3 GB, UCSC)
- [ ] uniprot_protparam_properties.tsv (generate)
- [ ] mathieson_2018_protein_halflife.tsv (supplementary)
- [ ] ensembl human_mouse_dnds.tsv (BioMart)

---

## Post-Ingestion Checklist

- [ ] All verification queries return expected row counts
- [ ] `VACUUM ANALYZE` on large tables (biophysics, repeats, chromatin_state)
- [ ] Update `registry.layers` — verify all layer_keys active
- [ ] Test MCP tools: `list_layers`, `query_region`, `lookup_gene_expression`, etc.
- [ ] Test API endpoints: `/v1/layers`, `/v1/regions/hg38/chr17:7668402-7687550?layers=biophysics`
- [ ] Update `ingest_all.sh` to include all 38 steps
- [ ] Update CLAUDE.md / ROADMAP.md to reflect loaded state
