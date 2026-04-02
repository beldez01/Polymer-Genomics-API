# Rosetta Stone Expansion — Tier 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Tier 9 of the Rosetta Stone expansion — the "easy wins" that are hg38-native or pure derivation, adding 6 new layers and 5 biophysics columns.

**Architecture:** Each task is an independent workstream producing a migration SQL file, an ingestion Python module, and a query function + registry entry. All follow existing patterns in the codebase. GWAS already exists (migration 022, `annotation.gwas_associations`) — skip it.

**Tech Stack:** PostgreSQL 16, Python 3.12, asyncpg, FastAPI, pyBigWig, UCSC bigWigAverageOverBed

**Spec:** `docs/superpowers/specs/2026-04-02-rosetta-stone-expansion-design.md`

---

## File Map

### Migrations (new files in `docker/postgres/migrations/`)
- `055_evolutionary_physics_columns.sql` — 5 new REAL columns on biophysics.sequence_properties
- `056_evolution_schema.sql` — evolution schema + ultraconserved_elements table
- `057_variation_schema.sql` — variation schema + clinvar_variants table
- `058_te_age_columns.sql` — 2 new columns on annotation.repeats
- `059_ref_imprinting.sql` — ref.imprinted_genes + ref.imprinted_icrs tables

### Ingestion modules (new files in `src/polymer_genomics/ingest/`)
- `clinvar.py` — ClinVar VCF parser + bulk loader
- `ultraconserved.py` — UCSC UCE BED loader
- `te_ages.py` — Derive age from existing milliDiv column
- `imprinting.py` — Small reference table loader
- `zoonomia_conservation.py` — Zoonomia BigWig → biophysics column UPDATE
- `recombination_rate.py` — deCODE recombRate → biophysics column UPDATE

### Query modules (modify existing + new)
- New: `src/polymer_genomics/queries/evolution.py` — UCE query + converter
- New: `src/polymer_genomics/queries/variation.py` — ClinVar query + converter
- Modify: `src/polymer_genomics/queries/annotation.py` — add repeat_age fields (already in schema)
- Modify: `src/polymer_genomics/queries/_registry.py` — add new layer types
- Modify: `src/polymer_genomics/ingest/partitions.py` — add new schemas/tables to whitelist

---

## Task 1: ClinVar Variants (variation.clinvar_variants)

Independent workstream. Creates the `variation` schema and ClinVar pathogenic variant table.

**Files:**
- Create: `docker/postgres/migrations/057_variation_schema.sql`
- Create: `src/polymer_genomics/ingest/clinvar.py`
- Create: `src/polymer_genomics/queries/variation.py`
- Modify: `src/polymer_genomics/queries/_registry.py`
- Modify: `src/polymer_genomics/ingest/partitions.py`

**Context:**
- Follow Pattern A (INSERT into new table). See `repeats.py` for the exact pattern.
- ClinVar VCF: `https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh38/clinvar.vcf.gz` (hg38 native, ~80 MB)
- Filter for CLNSIG containing 'Pathogenic' or 'Likely_pathogenic'
- Use CLNREVSTAT for review quality stars
- Parse VCF INFO fields: CLNSIG, CLNDN, MC, GENEINFO, CLNREVSTAT, ORIGIN
- ~150K rows after filtering

- [ ] **Step 1: Write migration `057_variation_schema.sql`**

```sql
BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'clinvar';
COMMIT;

BEGIN;
CREATE SCHEMA IF NOT EXISTS variation;
GRANT USAGE ON SCHEMA variation TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA variation GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA variation GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

CREATE TABLE IF NOT EXISTS variation.clinvar_variants (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    layer_id        uuid NOT NULL REFERENCES registry.layers(id),
    build           genome_build NOT NULL,
    chr_id          smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos       int NOT NULL,
    end_pos         int NOT NULL,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    variation_id    int,
    rsid            text,
    ref_allele      text,
    alt_allele      text,
    clinical_significance text NOT NULL,
    review_status   text,
    disease         text,
    gene_symbol     text,
    molecular_consequence text,
    origin          text,
    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

CREATE TABLE IF NOT EXISTS variation.clinvar_variants_hg38
    PARTITION OF variation.clinvar_variants FOR VALUES IN ('hg38')
    PARTITION BY LIST (chr_id);

-- Create per-chromosome sub-partitions (1-25)
DO $$ BEGIN
FOR i IN 1..25 LOOP
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS variation.clinvar_variants_hg38_chr%s
         PARTITION OF variation.clinvar_variants_hg38 FOR VALUES IN (%s)',
        i, i
    );
END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinvar_range ON variation.clinvar_variants USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_clinvar_gene ON variation.clinvar_variants (gene_symbol);
CREATE INDEX IF NOT EXISTS idx_clinvar_layer_build ON variation.clinvar_variants (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA variation TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA variation TO ingest_writer;
COMMIT;
```

- [ ] **Step 2: Write ingestion module `src/polymer_genomics/ingest/clinvar.py`**

Follow the `repeats.py` pattern exactly. Key implementation details:
- Download ClinVar VCF from NCBI FTP if not present locally
- Parse VCF lines (skip headers starting with `#`)
- Extract chr, pos, ref, alt from columns 0-4
- Parse INFO field for CLNSIG, CLNDN, MC, GENEINFO, CLNREVSTAT, ORIGIN
- Filter: only keep rows where CLNSIG contains 'Pathogenic' or 'Likely_pathogenic'
- Map chromosome names: 1→chr1, X→chrX, etc. using CHR_NAME_TO_ID
- Coordinates: VCF is 1-based; convert to 0-based half-open (start_pos = pos - 1, end_pos = pos - 1 + len(ref))
- Register layer: layer_key="clinvar_v1", layer_type="clinvar", source="NCBI ClinVar GRCh38", license_class="open_access"
- Batch load via COPY protocol, BATCH_SIZE=10_000

COLUMNS list:
```python
COLUMNS = [
    "layer_id", "build", "chr_id", "start_pos", "end_pos",
    "variation_id", "rsid", "ref_allele", "alt_allele",
    "clinical_significance", "review_status", "disease",
    "gene_symbol", "molecular_consequence", "origin",
]
```

- [ ] **Step 3: Write query function in `src/polymer_genomics/queries/variation.py`**

```python
"""ClinVar and variation-related queries."""
from polymer_genomics.queries._common import db_to_api

def region_clinvar_query() -> str:
    return """
        SELECT cv.start_pos, cv.end_pos,
               cv.variation_id, cv.rsid, cv.ref_allele, cv.alt_allele,
               cv.clinical_significance, cv.review_status,
               cv.disease, cv.gene_symbol, cv.molecular_consequence, cv.origin
        FROM variation.clinvar_variants cv
        WHERE cv.build = $1::genome_build
          AND cv.chr_id = $2
          AND cv.coord && int4range($3, $4)
          AND cv.layer_id = $5
        ORDER BY cv.start_pos
        LIMIT $6
    """

def _convert_clinvar(rows: list[dict]) -> dict:
    return {
        "seqnames": [], "ranges": {"start": [], "end": []}, "strand": [],
        "mcols": {
            "variation_id": [], "rsid": [], "ref_allele": [], "alt_allele": [],
            "clinical_significance": [], "review_status": [],
            "disease": [], "gene_symbol": [], "molecular_consequence": [], "origin": [],
        },
    }
```

Note: The converter should follow the exact pattern of `_convert_gwas` or `_convert_repeats` in `annotation.py` — read those first and match the GRanges assembly pattern. The skeleton above shows the structure; implement the row-iteration loop matching existing converters.

- [ ] **Step 4: Register in `_registry.py` and add to `partitions.py` whitelist**

Add to `_registry.py`:
```python
from polymer_genomics.queries.variation import region_clinvar_query, _convert_clinvar

# In TRACK_REGISTRY:
"clinvar": {
    "query_fn": region_clinvar_query,
    "convert_fn": _convert_clinvar,
},
```

Add to `partitions.py` ALLOWED_SCHEMAS: `"variation"`
Add to `partitions.py` ALLOWED_TABLES: `"clinvar_variants"`

- [ ] **Step 5: Commit**

```bash
git add docker/postgres/migrations/057_variation_schema.sql \
        src/polymer_genomics/ingest/clinvar.py \
        src/polymer_genomics/queries/variation.py \
        src/polymer_genomics/queries/_registry.py \
        src/polymer_genomics/ingest/partitions.py
git commit -m "feat: add ClinVar pathogenic variant ingestion and query layer"
```

---

## Task 2: Ultraconserved Elements (evolution.ultraconserved_elements)

Independent workstream. Creates the `evolution` schema and UCE table.

**Files:**
- Create: `docker/postgres/migrations/056_evolution_schema.sql`
- Create: `src/polymer_genomics/ingest/ultraconserved.py`
- Create: `src/polymer_genomics/queries/evolution.py`
- Modify: `src/polymer_genomics/queries/_registry.py`
- Modify: `src/polymer_genomics/ingest/partitions.py`

**Context:**
- 481 rows. Tiny table. No partitioning needed.
- Download from UCSC Table Browser: group=Comparative Genomics, track=Ultra Conserved, table=ultraCons, output format=BED
- Or use UCSC MySQL: `mysql --user=genome --host=genome-mysql.soe.ucsc.edu -A -D hg38 -e "SELECT * FROM ultraCons"`
- BED format: chr, start, end, name (format: uce.N), score, type (exonic/intronic/intergenic)
- Coordinates: UCSC BED is already 0-based half-open (matches internal format)

- [ ] **Step 1: Write migration `056_evolution_schema.sql`**

```sql
BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'ultraconserved';
COMMIT;

BEGIN;
CREATE SCHEMA IF NOT EXISTS evolution;
GRANT USAGE ON SCHEMA evolution TO api_reader, ingest_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA evolution GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA evolution GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

CREATE TABLE IF NOT EXISTS evolution.ultraconserved_elements (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    uce_name    text,
    length_bp   int,
    category    text
);

CREATE INDEX IF NOT EXISTS idx_uce_range ON evolution.ultraconserved_elements USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_uce_layer ON evolution.ultraconserved_elements (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA evolution TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA evolution TO ingest_writer;
COMMIT;
```

- [ ] **Step 2: Write ingestion module `src/polymer_genomics/ingest/ultraconserved.py`**

Follow Pattern A (`repeats.py`). Download UCE BED from UCSC. Parse 481 rows. Register layer: layer_key="ultraconserved_v1", layer_type="ultraconserved". Bulk load via COPY.

COLUMNS:
```python
COLUMNS = ["layer_id", "build", "chr_id", "start_pos", "end_pos", "uce_name", "length_bp", "category"]
```

- [ ] **Step 3: Write query function in `src/polymer_genomics/queries/evolution.py`**

```python
"""Evolution and deep-time queries: UCEs, HARs, introgression, etc."""
from polymer_genomics.queries._common import db_to_api

def region_ultraconserved_query() -> str:
    return """
        SELECT u.start_pos, u.end_pos,
               u.uce_name, u.length_bp, u.category
        FROM evolution.ultraconserved_elements u
        WHERE u.build = $1::genome_build
          AND u.chr_id = $2
          AND u.coord && int4range($3, $4)
          AND u.layer_id = $5
        ORDER BY u.start_pos
        LIMIT $6
    """

def _convert_ultraconserved(rows: list[dict]) -> dict:
    # Follow the same GRanges pattern as existing converters
    ...
```

- [ ] **Step 4: Register in `_registry.py`, add to `partitions.py`**

Add `"evolution"` to ALLOWED_SCHEMAS, `"ultraconserved_elements"` to ALLOWED_TABLES.
Add `"ultraconserved"` entry to TRACK_REGISTRY.

- [ ] **Step 5: Commit**

---

## Task 3: TE Age Estimation (column addition to annotation.repeats)

Independent workstream. Derives TE insertion ages from existing RepeatMasker divergence.

**Files:**
- Create: `docker/postgres/migrations/058_te_age_columns.sql`
- Create: `src/polymer_genomics/ingest/te_ages.py`

**Context:**
- Pure derivation from existing `divergence_pct` column on `annotation.repeats`
- Formula: `estimated_age_mya = (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6`
- age_class: 'ancient' (>100 Mya), 'old' (25-100), 'recent' (5-25), 'young' (<5)
- ~5.3M rows to UPDATE
- Check first: the repeats query already references `repeat_age` — verify if this column exists and what it contains. If it already has age data, this task may be a no-op or just needs the age_class classification.

- [ ] **Step 1: Write migration `058_te_age_columns.sql`**

```sql
ALTER TABLE annotation.repeats
    ADD COLUMN IF NOT EXISTS estimated_age_mya real,
    ADD COLUMN IF NOT EXISTS age_class text;
```

- [ ] **Step 2: Write ingestion module `src/polymer_genomics/ingest/te_ages.py`**

Follow Pattern B (UPDATE existing rows). BUT since this is a pure derivation from existing columns, no staging table needed — just a direct UPDATE:

```python
async def main():
    conn = await get_ingest_connection(admin=True)
    # Check if already populated
    sample = await conn.fetchval(
        "SELECT estimated_age_mya FROM annotation.repeats WHERE estimated_age_mya IS NOT NULL LIMIT 1"
    )
    if sample is not None:
        print("TE ages already computed. Skipping.")
        return
    
    result = await conn.execute("""
        UPDATE annotation.repeats SET
            estimated_age_mya = (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6,
            age_class = CASE
                WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 100 THEN 'ancient'
                WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 25  THEN 'old'
                WHEN (divergence_pct / 100.0) / (2 * 2.2e-9) / 1e6 > 5   THEN 'recent'
                ELSE 'young'
            END
        WHERE divergence_pct IS NOT NULL
    """)
    print(f"Updated: {result}")
```

- [ ] **Step 3: Commit**

---

## Task 4: Imprinted Genes Reference Tables

Independent workstream. Tiny reference tables for imprinting.

**Files:**
- Create: `docker/postgres/migrations/059_ref_imprinting.sql`
- Create: `src/polymer_genomics/ingest/imprinting.py`

**Context:**
- ~150 imprinted genes, ~50 ICRs
- Data embedded inline (Pattern C, like `epigenetic_clocks.py`)
- Source: curated from geneimprint.com, Monk et al. 2019
- These are lookup tables — no layer registration needed (same as ref.chromosomes)

- [ ] **Step 1: Write migration `059_ref_imprinting.sql`**

```sql
CREATE TABLE IF NOT EXISTS ref.imprinted_genes (
    gene_symbol     text PRIMARY KEY,
    expressed_allele text NOT NULL,  -- 'maternal' or 'paternal'
    imprint_status  text NOT NULL,   -- 'confirmed' or 'predicted'
    chromosome      text,
    associated_icr  text
);

CREATE TABLE IF NOT EXISTS ref.imprinted_icrs (
    icr_name        text PRIMARY KEY,
    build           genome_build NOT NULL,
    chr_id          smallint REFERENCES ref.chromosomes(chr_id),
    start_pos       int,
    end_pos         int,
    coord           int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    methylated_allele text,  -- 'maternal' or 'paternal'
    regulated_genes text[]
);

CREATE INDEX IF NOT EXISTS idx_icr_range ON ref.imprinted_icrs USING GiST (chr_id, coord);
GRANT SELECT ON ref.imprinted_genes TO api_reader;
GRANT SELECT ON ref.imprinted_icrs TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ref.imprinted_genes TO ingest_writer;
GRANT SELECT, INSERT, UPDATE ON ref.imprinted_icrs TO ingest_writer;
```

- [ ] **Step 2: Write ingestion module with embedded data**

Follow Pattern C (`epigenetic_clocks.py`). Embed the well-known imprinted genes inline:
- H19 (maternal), IGF2 (paternal), SNRPN (paternal), KCNQ1OT1 (paternal), MEG3 (maternal), PEG3 (paternal), MEST (paternal), GRB10 (maternal), PLAGL1 (paternal), DLK1 (paternal), etc.
- For ICRs, embed key coordinates from Court et al. 2014 (convert hg19 to hg38 manually for the ~50 known ICRs, or flag as TODO for liftOver)
- Use ON CONFLICT DO NOTHING for idempotency

- [ ] **Step 3: Commit**

---

## Task 5: Evolutionary Physics Columns (Zoonomia + Recombination Rate)

Independent workstream. Adds 5 new columns to biophysics.sequence_properties and populates 2 of them (Zoonomia + recomb rate). The remaining 3 (B-scores, mutation rate) are deferred to Tier 10 due to data complexity.

**Files:**
- Create: `docker/postgres/migrations/055_evolutionary_physics_columns.sql`
- Create: `src/polymer_genomics/ingest/zoonomia_conservation.py`
- Create: `src/polymer_genomics/ingest/recombination_rate.py`

**Context:**
- Migration adds all 5 columns at once (cheap ALTER TABLE)
- Zoonomia: Two BigWig files (~12 GB total download), process with bigWigAverageOverBed into 1kb means, UPDATE via staging table (Pattern B like `dnashape.py` or `replication_timing.py`)
- Recombination rate: UCSC recombRate.txt.gz (~small), parse into per-window means, UPDATE via staging
- Both follow the conservation.py / replication_timing.py pattern exactly

- [ ] **Step 1: Write migration `055_evolutionary_physics_columns.sql`**

```sql
ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS phylop_241way_mean    real,
    ADD COLUMN IF NOT EXISTS phastcons_241way_mean real,
    ADD COLUMN IF NOT EXISTS b_score_mean          real,
    ADD COLUMN IF NOT EXISTS recomb_rate_cmmb      real,
    ADD COLUMN IF NOT EXISTS mutation_rate_mean    real;
```

- [ ] **Step 2: Write `zoonomia_conservation.py`**

Follow `conservation.py` exactly (same pattern — BigWig → bigWigAverageOverBed → staging → UPDATE):
- Download `hg38.phyloP241way.bw` and `hg38.phastCons241way.bw` from UCSC
- Generate 1kb windows BED (reuse `_generate_windows_bed` from conservation.py or factor out)
- Run bigWigAverageOverBed for each track
- Parse output, create staging table with (chr_id, start_pos, phylop_241way_mean, phastcons_241way_mean)
- UPDATE biophysics.sequence_properties FROM staging
- Validate with assert_rows_updated

- [ ] **Step 3: Write `recombination_rate.py`**

Similar to Pattern B but from a TSV instead of BigWig:
- Download `https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/recombRate.txt.gz`
- Format: bin, chrom, chromStart, chromEnd, name, decodeAvg, decodeFemale, decodeMale, marshfieldAvg, marshfieldFemale, marshfieldMale, genethonAvg, genethonFemale, genethonMale
- Use `decodeAvg` column (deCODE sex-averaged rate in cM/Mb)
- For each 1kb window, compute mean recombination rate from overlapping intervals
- Load into staging, UPDATE biophysics.sequence_properties

- [ ] **Step 4: Commit**

---

## Task 6: Ancestral Alleles Reference (Ensembl EPO)

Independent workstream. Downloads and stores ancestral allele FASTA for variant annotation.

**Files:**
- Create: `src/polymer_genomics/ingest/ancestral_alleles.py`
- Create: `data/reference/ancestral_alleles/` (download target)

**Context:**
- Download `https://ftp.ensembl.org/pub/current_fasta/ancestral_alleles/homo_sapiens_ancestor_GRCh38.tar.gz`
- ~1 GB compressed, ~3 GB uncompressed
- Per-chromosome FASTA: uppercase = high confidence, lowercase = low confidence
- NOT a database table — stored as reference FASTA for use by the on-demand computation engine and variant annotation
- Register as a bulk download layer (storage_type='object_storage')

- [ ] **Step 1: Write download + extraction script**
- [ ] **Step 2: Register layer in registry.layers (storage_type='object_storage')**
- [ ] **Step 3: Commit**

---

## Integration Checklist

After all tasks merge, verify:

- [ ] All migrations apply cleanly: `scripts/run_prod_migrations.py`
- [ ] All new schemas/tables queryable via `/v1/regions/{build}/{region}?layers=clinvar_v1`
- [ ] UCE query returns 481 rows genome-wide
- [ ] ClinVar query returns ~150K pathogenic variants
- [ ] TE ages populated on all 5.3M repeats
- [ ] Zoonomia columns non-NULL on biophysics windows
- [ ] Recombination rate non-NULL on biophysics windows
- [ ] Imprinted genes/ICRs reference tables populated
