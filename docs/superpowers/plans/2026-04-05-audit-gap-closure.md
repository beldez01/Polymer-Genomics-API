# Audit Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps identified in the 2026-04-05 cross-layer audit: missing INTERSECT/CORRELATION/PROFILE/AGGREGATION wiring, expose 4 DB-only layers, fix slow endpoints, fix transposome family lookup.

**Architecture:** Pure wiring work — no new DB tables needed. Add entries to existing registries, write query functions for 4 unwired DB tables, add DB indexes for slow endpoints, add caching for validation.

**Tech Stack:** Python/FastAPI, asyncpg, PostgreSQL

---

### Task 1: Add 15 missing layers to INTERSECT_TABLES

**Files:**
- Modify: `src/polymer_genomics/routers/intersect.py`

Add these entries to `INTERSECT_TABLES` dict. All use `"id_col": "layer_id"`.

- [ ] **Step 1: Add gene_model, probe, isochore, methylation entries**

```python
# Add after existing entries in INTERSECT_TABLES:
"gene_model": {
    "table": "gene.features",
    "id_col": "layer_id",
    "fields": {"feature_type", "gene_name", "gene_type", "strand"},
},
"probe": {
    "table": "probe.coordinates",
    "id_col": "layer_id",
    "fields": {"probe_id", "platform"},
},
"isochore": {
    "table": "ref.isochores",
    "id_col": "layer_id",
    "fields": {"gc_content", "isochore_class"},
},
"methylation": {
    "table": "ref.methylation_reference",
    "id_col": "layer_id",
    "fields": {"gran", "mono", "nk", "bcell", "cd4t", "cd8t"},
},
```

- [ ] **Step 2: Add gene_cost, expression, constraint, protein entries**

```python
"gene_cost": {
    "table": "bioenergetics.gene_costs",
    "id_col": "layer_id",
    "fields": {"ecpa_b20", "c_protein", "cai", "mean_tpm"},
},
"expression": {
    "table": "expression.gene_tpm",
    "id_col": "layer_id",
    "fields": {"median_tpm", "max_tpm", "n_tissues_detected"},
},
"constraint": {
    "table": "conservation.gene_constraint",
    "id_col": "layer_id",
    "fields": {"pli", "loeuf", "mis_z", "syn_z"},
},
"protein_abundance": {
    "table": "bioenergetics.protein_abundance",
    "id_col": "layer_id",
    "fields": {"abundance_ppm"},
},
"protein_turnover": {
    "table": "bioenergetics.protein_turnover",
    "id_col": "layer_id",
    "fields": {"half_life_hours", "k_degradation"},
},
"protein_properties": {
    "table": "bioenergetics.protein_properties",
    "id_col": "layer_id",
    "fields": {"pi", "instability_index", "aliphatic_index", "gravy"},
},
"protein_evolution": {
    "table": "conservation.protein_evolution",
    "id_col": "layer_id",
    "fields": {"dn", "ds", "omega"},
},
"protein_atlas": {
    "table": "proteomics.tissue_expression",
    "id_col": "layer_id",
    "fields": {"tissue", "level", "reliability"},
},
```

- [ ] **Step 3: Add histone_mark, gwas, fragility, archaic_introgression entries**

```python
"histone_mark": {
    "table": "regulatory.histone_peaks",
    "id_col": "layer_id",
    "fields": {"mark_type", "cell_type", "signal_value", "p_value"},
},
"gwas": {
    "table": "annotation.gwas_associations",
    "id_col": "layer_id",
    "fields": {"trait", "p_value", "odds_ratio", "risk_allele"},
},
"fragility": {
    "table": "fragility.composite_score",
    "id_col": "layer_id",
    "fields": {"fragility_score", "nonb_component", "curvature_component"},
},
"archaic_introgression": {
    "table": "evolution.archaic_segments",
    "id_col": "layer_id",
    "fields": {"source_species", "population", "posterior_prob"},
},
```

- [ ] **Step 4: Verify intersect compiles**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "from polymer_genomics.routers.intersect import INTERSECT_TABLES; print(f'{len(INTERSECT_TABLES)} intersect layers')"`
Expected: 43+ intersect layers, no import error

---

### Task 2: Add 4 missing layers to _COUNT_TABLES (profile)

**Files:**
- Modify: `src/polymer_genomics/routers/profile.py`

- [ ] **Step 1: Add cpg_island and archaic_introgression to _COUNT_TABLES**

Add these entries to the `_COUNT_TABLES` dict:

```python
"cpg_island": "cpg.islands",
"archaic_introgression": "evolution.archaic_segments",
```

Note: `onco_events` and `dmc1_hotspots` are structurally incompatible (no `layer_id`/`coord` columns) — skip them for profile.

- [ ] **Step 2: Verify profile compiles**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "from polymer_genomics.routers.profile import _COUNT_TABLES; print(f'{len(_COUNT_TABLES)} profile layers')"`
Expected: 46 profile layers

---

### Task 3: Add cpg_island + archaic_introgression to CORRELATION_REGISTRY

**Files:**
- Modify: `src/polymer_genomics/correlation.py`

- [ ] **Step 1: Add cpg_island entry**

```python
"cpg_island": {
    "table": "cpg.islands",
    "pos_col": "start_pos",
    "mode": "count",
    "fields": {
        "density": "count(*)::float / $7",
        "count": "count(*)",
        "avg_gc": "avg(gc_content)",
    },
},
```

- [ ] **Step 2: Add archaic_introgression entry**

```python
"archaic_introgression": {
    "table": "evolution.archaic_segments",
    "pos_col": "start_pos",
    "mode": "count",
    "fields": {
        "density": "count(*)::float / $7",
        "count": "count(*)",
    },
},
```

---

### Task 4: Write query functions for 4 DB-only correlation layers

These tables exist in DB and CORRELATION_REGISTRY but have no query functions, so they can't be accessed via `/v1/regions/` or proximity.

**Files:**
- Create: `src/polymer_genomics/queries/signal.py`
- Modify: `src/polymer_genomics/queries/_registry.py`

- [ ] **Step 1: Create signal.py with 4 query functions**

Create `src/polymer_genomics/queries/signal.py`:

```python
"""Query functions for signal-level data layers (TF binding, WGBS, accessibility, mutation density)."""


def region_tf_binding_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  ctcf_gm12878, sp1_gm12878, yy1_gm12878, polr2a_gm12878,
                  ezh2_gm12878, suz12_gm12878, rest_gm12878,
                  ctcf_k562, spi1_k562, gata2_k562, runx1_k562,
                  tal1_k562, sp1_k562, polr2a_k562, ezh2_k562
           FROM regulatory.tf_binding_signal
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_tf_binding(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }


def region_wgbs_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  hsc, cmp, gmp, monocyte, neutrophil, eosinophil,
                  b_naive, b_memory, t_naive, t_memory, nk, erythroid,
                  mean_beta, beta_variance
           FROM methylation.wgbs_1kb
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_wgbs(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }


def region_accessibility_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  dnase_gm12878, dnase_k562, atac_hsc, atac_monocyte
           FROM regulatory.accessibility_signal
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_accessibility(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }


def region_mutation_density_query(build, chr_id, start, end, layer_id, limit):
    return (
        """SELECT start_pos, end_pos,
                  pan_cancer_rate, snv_rate, indel_rate,
                  liver_rate, lung_rate, skin_rate, blood_rate
           FROM annotation.mutation_density
           WHERE build = $1::genome_build AND chr_id = $2
             AND coord && int4range($3, $4) AND layer_id = $5
           ORDER BY start_pos LIMIT $6""",
        [build, chr_id, start, end, layer_id, limit],
    )


def _convert_mutation_density(row):
    return {
        "start": row["start_pos"] + 1,
        "end": row["end_pos"],
        **{k: float(row[k]) if row[k] is not None else None
           for k in row.keys() if k not in ("start_pos", "end_pos")},
    }
```

- [ ] **Step 2: Register all 4 in TRACK_REGISTRY**

Add to `src/polymer_genomics/queries/_registry.py`:

```python
from polymer_genomics.queries.signal import (
    region_tf_binding_query, _convert_tf_binding,
    region_wgbs_query, _convert_wgbs,
    region_accessibility_query, _convert_accessibility,
    region_mutation_density_query, _convert_mutation_density,
)
```

And add entries to TRACK_REGISTRY dict:

```python
"tf_binding": {
    "query_fn": region_tf_binding_query,
    "convert_fn": _convert_tf_binding,
},
"wgbs": {
    "query_fn": region_wgbs_query,
    "convert_fn": _convert_wgbs,
},
"accessibility": {
    "query_fn": region_accessibility_query,
    "convert_fn": _convert_accessibility,
},
"mutation_density": {
    "query_fn": region_mutation_density_query,
    "convert_fn": _convert_mutation_density,
},
```

- [ ] **Step 3: Add to _COUNT_TABLES in profile.py**

```python
"tf_binding": "regulatory.tf_binding_signal",
"wgbs": "methylation.wgbs_1kb",
"accessibility": "regulatory.accessibility_signal",
"mutation_density": "annotation.mutation_density",
```

- [ ] **Step 4: Add to INTERSECT_TABLES**

```python
"tf_binding": {
    "table": "regulatory.tf_binding_signal",
    "id_col": "layer_id",
    "fields": {"ctcf_gm12878", "sp1_gm12878", "polr2a_gm12878", "ezh2_gm12878", "ctcf_k562"},
},
"wgbs": {
    "table": "methylation.wgbs_1kb",
    "id_col": "layer_id",
    "fields": {"hsc", "cmp", "gmp", "monocyte", "neutrophil", "mean_beta", "beta_variance"},
},
"accessibility": {
    "table": "regulatory.accessibility_signal",
    "id_col": "layer_id",
    "fields": {"dnase_gm12878", "dnase_k562", "atac_hsc", "atac_monocyte"},
},
"mutation_density": {
    "table": "annotation.mutation_density",
    "id_col": "layer_id",
    "fields": {"pan_cancer_rate", "snv_rate", "indel_rate", "liver_rate", "lung_rate", "skin_rate", "blood_rate"},
},
```

- [ ] **Step 5: Verify imports**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "from polymer_genomics.queries._registry import TRACK_REGISTRY; print(f'{len(TRACK_REGISTRY)} tracks')"`
Expected: 52 tracks (was 48)

---

### Task 5: Add missing aggregation branches

**Files:**
- Modify: `src/polymer_genomics/routers/aggregation.py`

Add branches for layer types not yet covered. Use the simple count/density pattern.

- [ ] **Step 1: Add remaining layer type branches**

Add before `return None` in `_aggregation_query()`:

```python
elif layer_type in (
    "histone_mark", "gwas", "breakpoint", "fragility",
    "herv", "tad_domain", "hic_compartment", "insulation_score",
    "ultraconserved", "accelerated_region", "archaic_introgression",
    "selection_sweep", "te_exaptation", "archaic_methylation",
    "enhancer_gene", "structural_variant", "tcga_methylation",
    "nad", "dmv", "tfbs",
    "gene_model", "probe", "isochore", "methylation",
    "gene_cost", "expression", "constraint",
    "protein_abundance", "protein_turnover", "protein_properties",
    "protein_evolution", "protein_atlas",
    "cpg_island", "tf_binding", "wgbs", "accessibility", "mutation_density",
):
    # Generic count/density aggregation for remaining layers
    from polymer_genomics.routers.profile import _COUNT_TABLES
    table = _COUNT_TABLES.get(layer_type)
    if table is None:
        return None
    return f"""
        SELECT floor(t.start_pos / $6) * $6 AS bin_start,
               count(*) AS count,
               count(*)::float / $6 AS density
        FROM {table} t
        WHERE t.build = $1::genome_build
          AND t.chr_id = $2
          AND t.coord && int4range($3, $4)
          AND t.layer_id = $5
        GROUP BY bin_start
        ORDER BY bin_start
    """
```

---

### Task 6: Fix slow endpoints

**Files:**
- Modify: `src/polymer_genomics/routers/reference.py`
- Run SQL on Fly DB for protein_atlas indexes

- [ ] **Step 1: Add caching for /v1/reference/validation**

Add cache at top of reference.py (after existing imports):

```python
import time as _time

_validation_cache: dict[str, tuple[float, dict]] = {}
_VALIDATION_TTL = 3600  # 1 hour
```

Modify the `get_validation_report` function to check cache before running and store result after.

- [ ] **Step 2: Add DB indexes for protein_atlas**

Run on Fly DB:
```sql
CREATE INDEX IF NOT EXISTS idx_tissue_expression_gene_symbol
    ON proteomics.tissue_expression (UPPER(gene_symbol));
CREATE INDEX IF NOT EXISTS idx_subcellular_location_gene_symbol
    ON proteomics.subcellular_location (UPPER(gene_symbol));
```

- [ ] **Step 3: Add layer filtering to proximity endpoint**

In `src/polymer_genomics/routers/proximity.py`, add an optional `layers` query parameter so clients can request a subset instead of all 48 layers.

---

### Task 7: Fix transposome family lookup + audit command

**Files:**
- Modify: `.claude/commands/audit.md`

- [ ] **Step 1: Fix audit test URL**

Change `family/L1HS` to `family/LINE_L1HS` in audit.md:

```
curl ... "https://api.polymerbio.org/v1/transposome/family/LINE_L1HS"
```

---

### Task 8: Deploy and verify

- [ ] **Step 1: Deploy to Fly**

```bash
fly deploy
```

- [ ] **Step 2: Run key verification curls**

Test profile, correlate, intersect, aggregation on the live API.
