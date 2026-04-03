# Rosetta Stone Tiers 10-11 Data Ingestion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load data into the 12 empty Tier 10-11 tables, re-ingest ClinVar with fixed filter, and fix the viewer build — completing the Rosetta Stone expansion to 50+ queryable layers.

**Architecture:** Each task creates an ingestion module following established Pattern A (INSERT) or Pattern B (UPDATE). All modules use `get_ingest_connection(admin=True)`, batch COPY, liftOver where needed. Schemas and tables already exist from migrations 060-063. Query functions and registry entries already wired.

**Tech Stack:** Python 3.12, asyncpg, /tmp/liftOver (UCSC binary), /tmp/bigWigAverageOverBed, hg19ToHg38.over.chain.gz (already downloaded)

**Prerequisites:**
- Fly proxy: `fly proxy 15432:5432 -a polymer-db &`
- Env vars: `POSTGRES_HOST=localhost POSTGRES_PORT=15432 POSTGRES_DB=polymer_genomics_api POSTGRES_ADMIN_USER=postgres POSTGRES_PASSWORD=bO29tk86jPrNOnf`
- Tools: `/tmp/liftOver` and `/tmp/bigWigAverageOverBed` (already installed)
- Chain file: `data/downloads/hg19ToHg38.over.chain.gz` (already downloaded)

---

## Group A: Direct Downloads (can execute immediately)

### Task 1: GTEx v8 eQTLs (qtl.eqtls)

The biggest single dataset. 49 tissue files, ~2.9M significant variant-gene pairs per tissue = ~143M total. We load the **lead eQTL per gene per tissue** (strongest effect) to keep it manageable (~2-3M rows).

**Files:**
- Create: `src/polymer_genomics/ingest/eqtls.py`

**Data:** `data/downloads/GTEx_v8_eQTL.tar` (1.5 GB, already downloaded)

- [ ] **Step 1: Extract tar**

```bash
cd data/downloads && tar xf GTEx_v8_eQTL.tar
ls GTEx_Analysis_v8_eQTL/*.signif_variant_gene_pairs.txt.gz | wc -l
# Expected: 49
```

- [ ] **Step 2: Write ingestion module `src/polymer_genomics/ingest/eqtls.py`**

Key logic:
- For each of 49 `*.v8.signif_variant_gene_pairs.txt.gz` files:
  - Extract tissue name from filename: `Adipose_Subcutaneous.v8.signif...` → `Adipose_Subcutaneous`
  - Parse TSV: columns are `variant_id, gene_id, tss_distance, ma_samples, ma_count, maf, pval_nominal, slope, slope_se, pval_nominal_threshold, min_pval_nominal, pval_beta`
  - Parse `variant_id` format `chr1_64764_C_T_b38` → chr=chr1, pos=64764, ref=C, alt=T
  - Map gene_id (ENSG with version, e.g., `ENSG00000227232.5`) — strip version suffix for gene_symbol lookup
  - Gene symbol resolution: query `gene.features` for ENSG → symbol, or use a prebuilt mapping
  - Coordinates: variant_id positions are 1-based → 0-based half-open (start=pos-1, end=pos)
  - **Deduplication:** For each (gene_id, tissue), keep only the variant with the smallest `pval_nominal` (lead eQTL)
  - COLUMNS: `layer_id, build, chr_id, start_pos, end_pos, variant_id, gene_id, gene_symbol, tissue, tss_distance, effect_size (=slope), p_value (=pval_nominal), q_value (=pval_beta)`

Register layer: `layer_key="gtex_eqtl_v8"`, `layer_type="eqtl"`, source="GTEx v8 (GTEx Consortium 2020 Science)", license="open_access"

Pattern: Follow `clinvar.py` for structure. Use `conn.copy_records_to_table("eqtls", schema_name="qtl")`.

BATCH_SIZE = 50_000. Process all 49 tissues sequentially. Print progress per tissue.

- [ ] **Step 3: Build ENSG→symbol mapping**

Before loading eQTLs, build a lookup dict from the existing gene.features table:
```python
rows = await conn.fetch("SELECT DISTINCT gene_id, gene_symbol FROM gene.features WHERE build='hg38'::genome_build AND gene_id IS NOT NULL")
ensg_to_symbol = {r["gene_id"]: r["gene_symbol"] for r in rows}
# Strip version: "ENSG00000227232.5" → "ENSG00000227232"
```

For variant_id parsing:
```python
def parse_variant_id(vid: str) -> tuple[str, int, str, str] | None:
    # chr1_64764_C_T_b38
    parts = vid.split("_")
    if len(parts) < 5: return None
    chrom = parts[0]  # already has "chr" prefix
    pos = int(parts[1])
    ref = parts[2]
    alt = parts[3]
    return (chrom, pos, ref, alt)
```

- [ ] **Step 4: Run ingestion**

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=15432 POSTGRES_DB=polymer_genomics_api \
POSTGRES_ADMIN_USER=postgres POSTGRES_PASSWORD=bO29tk86jPrNOnf \
GTEX_DIR=data/downloads/GTEx_Analysis_v8_eQTL \
uv run python -m polymer_genomics.ingest.eqtls
```

Expected: ~2-3M rows (lead eQTL per gene per tissue), ~30-60 min.

- [ ] **Step 5: Verify and commit**

```bash
# Verify via DB
# SELECT count(*) FROM qtl.eqtls;
# SELECT tissue, count(*) FROM qtl.eqtls GROUP BY tissue ORDER BY count DESC LIMIT 5;
git add src/polymer_genomics/ingest/eqtls.py
git commit -m "feat: add GTEx v8 eQTL ingestion (lead variant per gene-tissue)"
```

---

### Task 2: GoDMC meQTLs (qtl.meqtls)

**Files:**
- Create: `src/polymer_genomics/ingest/meqtls.py`

**Data:** Download `http://fileserve.mrcieu.ac.uk/mqtl/assoc_meta_all.csv.gz` (5.9 GB) and `http://fileserve.mrcieu.ac.uk/mqtl/snps.csv.gz` (204 MB)

- [ ] **Step 1: Download data**

```bash
curl -L -o data/downloads/godmc_assoc_meta_all.csv.gz "http://fileserve.mrcieu.ac.uk/mqtl/assoc_meta_all.csv.gz"
curl -L -o data/downloads/godmc_snps.csv.gz "http://fileserve.mrcieu.ac.uk/mqtl/snps.csv.gz"
```

- [ ] **Step 2: Write ingestion module `src/polymer_genomics/ingest/meqtls.py`**

Key logic:
- The SNP file (`snps.csv.gz`) maps SNP names to rsIDs and hg19 positions: `snp, chr, pos, effect_allele, other_allele`
- The association file (`assoc_meta_all.csv.gz`) has: `cpg, snp, beta, se, pval, n, cistrans, effect_allele, other_allele, eaf`
- Join: parse SNP file into dict {snp_name: (rsid, chr, pos)}
- Filter: keep only `cistrans == "cis"` (cis-meQTLs)
- Filter by significance: `pval < 1e-8` (genome-wide significant)
- **Deduplicate:** keep lead SNP per CpG probe (smallest p-value)
- Coordinates are hg19 → need liftOver. Use `/tmp/liftOver` with chain file.
- After liftOver: `start_pos = pos_hg38 - 1, end_pos = pos_hg38` (SNP = 1bp)
- distance = abs(snp_pos - cpg_pos) — compute from hg19 coords before liftOver

COLUMNS: `layer_id, build, chr_id, start_pos, end_pos, snp_rsid, cpg_probe_id, beta, se, p_value, allele_freq (=eaf), cis_trans, distance`

Register layer: `layer_key="godmc_meqtl_v1"`, `layer_type="meqtl"`

- [ ] **Step 3: Run ingestion**

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=15432 POSTGRES_DB=polymer_genomics_api \
POSTGRES_ADMIN_USER=postgres POSTGRES_PASSWORD=bO29tk86jPrNOnf \
uv run python -m polymer_genomics.ingest.meqtls
```

Expected: ~100-200K rows (lead cis-meQTL per CpG).

- [ ] **Step 4: Commit**

---

### Task 3: ClinVar Re-ingestion (fix filter)

The filter fix is already committed. Need to truncate existing data and re-ingest.

**Files:** No new files — `src/polymer_genomics/ingest/clinvar.py` already has the fix.

- [ ] **Step 1: Truncate existing ClinVar data**

```python
# Via fly proxy connection
await conn.execute("DELETE FROM variation.clinvar_variants WHERE layer_id = (SELECT id FROM registry.layers WHERE layer_key = 'clinvar_v1' AND version = '1.0.hg38')")
```

- [ ] **Step 2: Re-run ingestion**

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=15432 POSTGRES_DB=polymer_genomics_api \
POSTGRES_ADMIN_USER=postgres POSTGRES_PASSWORD=bO29tk86jPrNOnf \
uv run python -m polymer_genomics.ingest.clinvar
```

Expected: ~332K rows (185K Pathogenic + 111K Likely_pathogenic + 37K Pathogenic/Likely_pathogenic, no Conflicting)

- [ ] **Step 3: Verify**

```sql
SELECT clinical_significance, count(*) FROM variation.clinvar_variants GROUP BY clinical_significance ORDER BY count DESC;
-- Should show NO "Conflicting_classifications_of_pathogenicity"
```

---

### Task 4: Archaic Introgression (evolution.archaic_segments)

**Files:**
- Create: `src/polymer_genomics/ingest/archaic_introgression.py`

**Data:** Browning et al. 2018 SPrime output from Mendeley: `https://data.mendeley.com/datasets/y7hyt83vxr/1`

- [ ] **Step 1: Download data**

Navigate to `https://data.mendeley.com/datasets/y7hyt83vxr/1` in browser. Download the SPrime output files. They should be BED-like files with introgressed segments per population. Save to `data/downloads/browning2018/`.

If direct download URLs are available:
```bash
mkdir -p data/downloads/browning2018
# Download each population file (URLs from Mendeley page)
```

- [ ] **Step 2: Write ingestion module**

Key logic:
- SPrime output format: `CHROM, START, END, SCORE, NSNPS` per segment per population
- Parse population from filename
- Coordinates are hg19 → liftOver to hg38
- `source_species = "neanderthal"` (SPrime detects Neanderthal introgression)
- `segment_length_kb = (end - start) / 1000`
- `posterior_prob = score` (normalized if needed)

COLUMNS: `layer_id, build, chr_id, start_pos, end_pos, source_species, population, posterior_prob, segment_length_kb, snp_count`

Register: `layer_key="archaic_introgression_browning_v1"`, `layer_type="archaic_introgression"`

- [ ] **Step 3: Run, verify, commit**

Expected: ~50K segments across EUR, EAS, SAS populations.

---

## Group B: Browser-Required Downloads (user must download supplementary tables)

### Task 5: Human Accelerated Regions (evolution.accelerated_regions)

**Files:**
- Create: `src/polymer_genomics/ingest/accelerated_regions.py`

**Data:** User must download Doan et al. 2016 Cell Table S1 from:
`https://www.cell.com/fulltext/S0092-8674(16)31169-2` → Supplemental Information → mmc2 (Excel)

Save to: `data/downloads/doan2016_hars.xlsx`

- [ ] **Step 1: User downloads supplementary Excel from Cell**

The file contains ~2,737 HARs with hg19 coordinates. Columns include: HAR name, chr, start, end, conservation score, nearest gene, category.

- [ ] **Step 2: Write ingestion module**

Key logic:
- Parse Excel (use `openpyxl` — add to dev dependencies if needed, or convert to TSV first)
- Extract columns: HAR_name, chr, start, end, acceleration_score, conservation_score, nearest_gene, distance_to_gene, category
- Coordinates are hg19 → liftOver to hg38
- Follow the liftOver pattern from `super_enhancers.py` (write BED, run /tmp/liftOver, parse output)

Register: `layer_key="hars_doan_v1"`, `layer_type="accelerated_region"`

- [ ] **Step 3: Run, verify, commit**

Expected: ~2,700 HARs after liftOver.

---

### Task 6: DNA Methylation Valleys (nuclear.dmvs)

**Files:**
- Create: `src/polymer_genomics/ingest/dmvs.py`

**Data:** Two options:
1. User downloads Xie et al. 2013 Cell Table S from `https://www.cell.com/fulltext/S0092-8674(13)00464-9`
2. **Alternative (preferred):** Derive DMVs from existing Roadmap WGBS data or use published coordinates

If using supplementary: Save to `data/downloads/xie2013_dmvs.xlsx`

- [ ] **Step 1: User downloads or we derive**

If deriving: DMVs are regions ≥5kb with mean methylation <0.15. Can compute from WGBS BigWig if available, or use the published ~1,220 DMV coordinates from Table S.

- [ ] **Step 2: Write ingestion module**

Key logic:
- Parse Excel/TSV for DMV coordinates (hg19)
- LiftOver to hg38
- Compute `length_kb = (end - start) / 1000`
- Look up nearest gene from existing `gene.features` table
- `developmental_tf`: check if nearest gene is in a known developmental TF list (HOX, PAX, SOX, FOX, TBX, etc.)

COLUMNS: `layer_id, build, chr_id, start_pos, end_pos, length_kb, mean_methylation, nearest_gene, developmental_tf`

Register: `layer_key="dmvs_xie_v1"`, `layer_type="dmv"`

- [ ] **Step 3: Run, verify, commit**

Expected: ~1,200 DMVs.

---

### Task 7: Archaic Methylation (evolution.archaic_methylation)

**Files:**
- Create: `src/polymer_genomics/ingest/archaic_methylation.py`

**Data:** User must download from:
- Gokhman et al. 2014 Science: `https://www.science.org/doi/10.1126/science.1250368` → Supplementary Tables S1-S3
- Gokhman et al. 2020 Cell: `https://www.cell.com/cell/fulltext/S0092-8674(19)30954-7` → Supplementary tables

Save to: `data/downloads/gokhman2014_dmrs.xlsx` and `data/downloads/gokhman2020_dmrs.xlsx`

- [ ] **Step 1: User downloads supplementary from Science and Cell**

2014 paper: ~1,500 DMRs (Neanderthal vs modern human, plus Denisovan)
2020 paper: ~443 Denisovan-derived morphological DMRs

- [ ] **Step 2: Write ingestion module**

Key logic:
- Parse both Excel files
- Coordinates are hg19 → liftOver
- Combine into single table with `species` column (neanderthal, denisovan)
- `direction_vs_modern`: hyper if archaic > modern, hypo if archaic < modern
- `confidence`: from paper's classification

COLUMNS: `layer_id, build, chr_id, start_pos, end_pos, species, methylation_level, confidence, dmr_id, direction_vs_modern`

Register: `layer_key="archaic_methylation_gokhman_v1"`, `layer_type="archaic_methylation"`

- [ ] **Step 3: Run, verify, commit**

Expected: ~2,000 DMRs total.

---

## Group C: Derived / Processed Data

### Task 8: LADs — Constitutive Lamina-Associated Domains (nuclear.lads)

**Files:**
- Create: `src/polymer_genomics/ingest/lads.py`

**Data:** GEO GSE22428 — `https://ftp.ncbi.nlm.nih.gov/geo/series/GSE22nnn/GSE22428/suppl/GSE22428_HMM_state_calls_per_probe.txt.gz` (19.6 MB)

- [ ] **Step 1: Download data**

```bash
curl -L -o data/downloads/GSE22428_HMM_state_calls.txt.gz \
  "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE22nnn/GSE22428/suppl/GSE22428_HMM_state_calls_per_probe.txt.gz"
```

- [ ] **Step 2: Write ingestion module**

Key logic:
- Parse HMM state calls: each probe has LAD/iLAD calls across multiple cell types
- **Constitutive LADs (cLADs):** probes called as LAD in ALL (or ≥80%) of cell types
- Merge adjacent cLAD probes into contiguous regions (gap tolerance: 50kb)
- Coordinates are hg18 → liftOver hg18→hg19→hg38 (or direct hg18→hg38 if chain available)
- Alternative: download `hg18ToHg38.over.chain.gz` from UCSC

COLUMNS: `layer_id, build, chr_id, start_pos, end_pos, lad_type (='constitutive'), cell_type (='consensus'), damid_score`

Register: `layer_key="lads_meuleman_v1"`, `layer_type="lad"`

- [ ] **Step 3: Run, verify, commit**

Expected: ~1,000-1,500 constitutive LADs covering ~35% of genome.

---

### Task 9: NADs — Nucleolus-Associated Domains (nuclear.nads)

**Files:**
- Create: `src/polymer_genomics/ingest/nads.py`

**Data:** Dillinger et al. 2017 Genome Research supplementary, or search 4DN portal.

- [ ] **Step 1: Acquire NAD data**

Check `https://data.4dnucleome.org/` for curated NAD tracks. Alternatively, extract from Dillinger 2017 supplementary tables.

This is the least standardized dataset. If no clean BED is available, skip for now and revisit.

- [ ] **Step 2: Write ingestion module (if data available)**

Simple BED parser + liftOver. Same pattern as LADs but smaller (~500 domains).

---

### Task 10: Selection Sweeps (evolution.selection_sweeps)

**Files:**
- Create: `src/polymer_genomics/ingest/selection_sweeps.py`

**Data:** Precomputed iHS and XP-EHH scans from 1000 Genomes.

- [ ] **Step 1: Acquire precomputed selection scan data**

Best source: `https://github.com/ngarud/1000Genomes_Selection` or precomputed from selscan.

Alternative: use the iHS/Fst data already computed in population genetics databases.

If no clean precomputed source: compute from 1000 Genomes Phase 3 hg38 VCFs using selscan (complex, defer).

- [ ] **Step 2: Write ingestion module**

Parse precomputed outlier regions (top 1% |iHS|) per population.
BED format: chr, start, end, population, ihs_max, candidate_gene.

Register: `layer_key="selection_1kg_v1"`, `layer_type="selection_sweep"`

---

### Task 11: TE Exaptation (evolution.te_exaptation)

**Files:**
- Create: `src/polymer_genomics/ingest/te_exaptation.py`

**Data:** Curated from multiple sources:
- Chuong et al. 2017 Nat Rev Genet (review, Table 1 has key examples)
- ENCODE cCREs overlapping RepeatMasker elements (can derive!)
- Published exaptation catalogs

- [ ] **Step 1: Derive exapted TEs from existing data**

The fastest approach: query existing `annotation.repeats` × `regulatory.ccre` overlap to find TEs that overlap ENCODE regulatory elements. This gives a computationally-derived exaptation catalog.

```sql
SELECT r.repeat_name, r.repeat_family, r.start_pos, r.end_pos, r.chr_id,
       c.ccre_class, c.encode_label
FROM annotation.repeats r
JOIN regulatory.ccre c ON r.chr_id = c.chr_id AND r.coord && c.coord
WHERE r.build = 'hg38'::genome_build AND c.build = 'hg38'::genome_build
```

- [ ] **Step 2: Write ingestion module**

Can be done entirely from existing DB data — no external download needed.

Register: `layer_key="te_exaptation_encode_v1"`, `layer_type="te_exaptation"`

---

## Group D: Housekeeping

### Task 12: Viewer Build Fix

**Files:**
- Modify: `viewer/src/components/KaryotypeOverview.tsx` (or wherever the prop type error is)

- [ ] **Step 1: Diagnose build error**

```bash
cd viewer && npm run build 2>&1 | grep "Error" | head -10
```

The error is a prop type mismatch in `KaryotypeOverview` — `chrAgg` is being passed as `chrIsochores` but the types don't match.

- [ ] **Step 2: Fix the type mismatch**

Read the component props interface, check what `chrAgg` actually contains vs what `chrIsochores` expects. Fix the type or the prop name.

- [ ] **Step 3: Build and deploy**

```bash
cd viewer && npm run build && vercel --prod
```

---

### Task 13: Deploy and Verify All Layers

- [ ] **Step 1: Push all code**

```bash
git push origin main
```

- [ ] **Step 2: Deploy API**

```bash
fly deploy
```

- [ ] **Step 3: Verify via API**

```bash
API_KEY="..." 
curl -s -H "X-API-Key: $API_KEY" "https://api.polymerbio.org/v1/layers" | python3 -c "
import sys, json
d = json.load(sys.stdin)
layers = d.get('data',{}).get('layers',[])
print(f'Total layers: {len(layers)}')
for l in layers:
    k = l.get('layer_key','')
    if any(x in k for x in ['eqtl','meqtl','introgression','har','dmv','lad','sweep','exapt','archaic_meth']):
        print(f'  NEW: {k}')
"
```

- [ ] **Step 4: Test cross-layer query**

```bash
# TP53 region with all new layers
curl -s -H "X-API-Key: $API_KEY" \
  "https://api.polymerbio.org/v1/regions/hg38/chr17:7668402-7687550?layers=clinvar_v1,ultraconserved_v1,super_enhancers_dbsuper_v1,gtex_eqtl_v8"
```

---

## Execution Priority

| Order | Task | Rows | Time Est | Dependency |
|-------|------|------|----------|------------|
| 1 | Task 1: GTEx eQTLs | ~2-3M | 30-60 min | Data downloaded |
| 2 | Task 3: ClinVar re-ingest | ~332K | 5 min | Filter already fixed |
| 3 | Task 11: TE exaptation | ~50K+ | 15 min | Derived from existing data |
| 4 | Task 2: GoDMC meQTLs | ~200K | 30 min | 5.9 GB download |
| 5 | Task 4: Archaic introgression | ~50K | 15 min | Mendeley download |
| 6 | Task 8: LADs | ~1.5K | 10 min | GEO download |
| 7 | Task 5: HARs | ~2.7K | 10 min | Browser download |
| 8 | Task 6: DMVs | ~1.2K | 10 min | Browser download |
| 9 | Task 7: Archaic methylation | ~2K | 10 min | Browser download |
| 10 | Task 9: NADs | ~500 | 10 min | 4DN portal |
| 11 | Task 10: Selection sweeps | ~100K | TBD | May need computation |
| 12 | Task 12: Viewer fix | - | 15 min | - |
| 13 | Task 13: Deploy + verify | - | 10 min | All above |

**Tasks 1, 3, 11 can start immediately.** Tasks 2, 4, 8 need downloads. Tasks 5-7, 9 need browser access for journal supplementary tables.
