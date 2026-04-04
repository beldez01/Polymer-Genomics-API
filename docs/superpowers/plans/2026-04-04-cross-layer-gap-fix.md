# Cross-Layer Gap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all database layers into every routing engine (intersect, correlation, profile, aggregation) and add MCP tools for all uncovered API endpoints.

**Architecture:** Pure additive changes to 4 routing dicts + 1 MCP server file. No new tables, no new API endpoints, no schema changes. Each routing dict is a Python dict mapping layer_type strings to table/field specs. MCP tools are thin wrappers calling existing API endpoints via `_get()`/`_post()`.

**Tech Stack:** Python/FastAPI (API routing), Python/FastMCP (MCP tools), asyncpg (DB queries)

**Key files:**
- `src/polymer_genomics/routers/intersect.py` — `INTERSECT_TABLES` dict (line 52)
- `src/polymer_genomics/correlation.py` — `CORRELATION_REGISTRY` dict (line 35)
- `src/polymer_genomics/routers/profile.py` — `_COUNT_TABLES` dict (line 171)
- `src/polymer_genomics/routers/aggregation.py` — `_aggregation_query()` function (line 19)
- `mcp/polymer_genomics_mcp/server.py` — MCP tool definitions (after line 1724)

---

## Task 1: Add 15 Layers to INTERSECT_TABLES

**Files:**
- Modify: `src/polymer_genomics/routers/intersect.py:52-135`

- [ ] **Step 1: Add the new entries to INTERSECT_TABLES**

Open `src/polymer_genomics/routers/intersect.py` and add these entries inside the `INTERSECT_TABLES` dict, after the `"insulation_score"` entry (line 134), before the closing `}`:

```python
    # ── Rosetta Stone Tier 9+ layers ───────────────────────────────
    "clinvar": {
        "table": "variation.clinvar_variants",
        "id_col": "layer_id",
        "fields": {"clinical_significance", "review_status", "molecular_consequence", "origin"},
    },
    "eqtl": {
        "table": "qtl.eqtls",
        "id_col": "layer_id",
        "fields": {"tissue", "effect_size", "p_value", "q_value", "tss_distance"},
    },
    "meqtl": {
        "table": "qtl.meqtls",
        "id_col": "layer_id",
        "fields": {"beta", "se", "p_value", "allele_freq", "cis_trans", "distance"},
    },
    "lad": {
        "table": "nuclear.lads",
        "id_col": "layer_id",
        "fields": {"lad_type", "cell_type", "damid_score"},
    },
    "nad": {
        "table": "nuclear.nads",
        "id_col": "layer_id",
        "fields": {"cell_type", "enrichment_score"},
    },
    "dmv": {
        "table": "nuclear.dmvs",
        "id_col": "layer_id",
        "fields": {"length_kb", "mean_methylation", "nearest_gene", "developmental_tf"},
    },
    "super_enhancer": {
        "table": "nuclear.super_enhancers",
        "id_col": "layer_id",
        "fields": {"cell_type", "se_rank", "constituent_count", "h3k27ac_signal", "target_gene"},
    },
    "enhancer_gene": {
        "table": "regulatory.enhancer_gene_links",
        "id_col": "layer_id",
        "fields": {"target_gene", "cell_type", "abc_score", "distance", "class"},
    },
    "ultraconserved": {
        "table": "evolution.ultraconserved_elements",
        "id_col": "layer_id",
        "fields": {"uce_name", "length_bp", "category"},
    },
    "archaic_methylation": {
        "table": "evolution.archaic_methylation",
        "id_col": "layer_id",
        "fields": {"species", "methylation_level", "confidence", "direction_vs_modern"},
    },
    "structural_variant": {
        "table": "structural_variation.structural_variants",
        "id_col": "layer_id",
        "fields": {"sv_type", "sv_length", "allele_freq", "source"},
    },
    "tcga_methylation": {
        "table": "tcga.methylation_summary",
        "id_col": "layer_id",
        "fields": {"cancer_type", "mean_beta", "delta_beta", "n_samples"},
    },
    "selection_sweep": {
        "table": "evolution.selection_sweeps",
        "id_col": "layer_id",
        "fields": {"sweep_type", "score", "population"},
    },
    "accelerated_region": {
        "table": "evolution.accelerated_regions",
        "id_col": "layer_id",
        "fields": {"har_name", "length_bp", "acceleration_score"},
    },
    "te_exaptation": {
        "table": "evolution.te_exaptations",
        "id_col": "layer_id",
        "fields": {"repeat_class", "repeat_family", "exaptation_type"},
    },
```

**IMPORTANT:** The table names above must match the actual DB tables. Before adding, verify each table exists by checking the query file imported in `queries/_registry.py`. For example, `region_clinvar_query` in `queries/variation.py` contains the actual SQL with the real table name. If the table name differs, use the one from the query file.

- [ ] **Step 2: Verify the edit by checking Python syntax**

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "from polymer_genomics.routers.intersect import INTERSECT_TABLES; print(f'{len(INTERSECT_TABLES)} layers in INTERSECT_TABLES')"
```
Expected: `28 layers in INTERSECT_TABLES` (13 existing + 15 new)

- [ ] **Step 3: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add src/polymer_genomics/routers/intersect.py
git commit -m "feat: add 15 layers to INTERSECT_TABLES (clinvar, QTLs, nuclear, evolution)"
```

---

## Task 2: Add 16 Layers to CORRELATION_REGISTRY

**Files:**
- Modify: `src/polymer_genomics/correlation.py:35-407`

- [ ] **Step 1: Add the new entries to CORRELATION_REGISTRY**

Open `src/polymer_genomics/correlation.py` and add these entries inside the `CORRELATION_REGISTRY` dict, after the `"insulation_score"` entry (line 406), before the closing `}`:

```python
    # ── Rosetta Stone Tier 9+ layers ───────────────────────────────
    "clinvar": {
        "table": "variation.clinvar_variants",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "eqtl": {
        "table": "qtl.eqtls",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "mean_effect_size": "avg(effect_size)",
        },
    },
    "meqtl": {
        "table": "qtl.meqtls",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "mean_beta": "avg(beta)",
        },
    },
    "lad": {
        "table": "nuclear.lads",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "nad": {
        "table": "nuclear.nads",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "dmv": {
        "table": "nuclear.dmvs",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "super_enhancer": {
        "table": "nuclear.super_enhancers",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "mean_h3k27ac": "avg(h3k27ac_signal)",
        },
    },
    "enhancer_gene": {
        "table": "regulatory.enhancer_gene_links",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
            "mean_abc_score": "avg(abc_score)",
        },
    },
    "ultraconserved": {
        "table": "evolution.ultraconserved_elements",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "archaic_methylation": {
        "table": "evolution.archaic_methylation",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "methylation_level": "avg(methylation_level)",
        },
    },
    "structural_variant": {
        "table": "structural_variation.structural_variants",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "tcga_methylation": {
        "table": "tcga.methylation_summary",
        "pos_col": "start_pos",
        "mode": "continuous",
        "fields": {
            "mean_beta": "avg(mean_beta)",
            "mean_delta_beta": "avg(delta_beta)",
        },
    },
    "selection_sweep": {
        "table": "evolution.selection_sweeps",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "accelerated_region": {
        "table": "evolution.accelerated_regions",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "te_exaptation": {
        "table": "evolution.te_exaptations",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
    "tfbs": {
        "table": "regulatory.tf_binding_signal",
        "pos_col": "start_pos",
        "mode": "count",
        "fields": {
            "density": "count(*)::float / $7",
            "count": "count(*)",
        },
    },
```

**IMPORTANT:** Same caveat as Task 1 — verify table names by reading the actual query files in `queries/`. The `pos_col` must match the column name used in the table (usually `start_pos` but check).

- [ ] **Step 2: Verify the edit**

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "from polymer_genomics.correlation import CORRELATION_REGISTRY; print(f'{len(CORRELATION_REGISTRY)} layers in CORRELATION_REGISTRY')"
```
Expected: `47 layers in CORRELATION_REGISTRY` (31 existing + 16 new)

- [ ] **Step 3: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add src/polymer_genomics/correlation.py
git commit -m "feat: add 16 layers to CORRELATION_REGISTRY (clinvar, QTLs, nuclear, evolution, tfbs)"
```

---

## Task 3: Add 18 Layers to _COUNT_TABLES (Profile Engine)

**Files:**
- Modify: `src/polymer_genomics/routers/profile.py:171-197`

- [ ] **Step 1: Add the new entries to _COUNT_TABLES**

Open `src/polymer_genomics/routers/profile.py` and add these entries inside the `_COUNT_TABLES` dict, after `"insulation_score"` (line 196), before the closing `}`:

```python
    # ── Rosetta Stone Tier 9+ layers ───────────────────────────────
    "clinvar": "variation.clinvar_variants",
    "eqtl": "qtl.eqtls",
    "meqtl": "qtl.meqtls",
    "lad": "nuclear.lads",
    "nad": "nuclear.nads",
    "dmv": "nuclear.dmvs",
    "super_enhancer": "nuclear.super_enhancers",
    "enhancer_gene": "regulatory.enhancer_gene_links",
    "ultraconserved": "evolution.ultraconserved_elements",
    "archaic_methylation": "evolution.archaic_methylation",
    "protein_turnover": "bioenergetics.protein_turnover",
    "protein_properties": "bioenergetics.protein_properties",
    "protein_evolution": "conservation.protein_evolution",
    "structural_variant": "structural_variation.structural_variants",
    "tcga_methylation": "tcga.methylation_summary",
    "selection_sweep": "evolution.selection_sweeps",
    "accelerated_region": "evolution.accelerated_regions",
    "te_exaptation": "evolution.te_exaptations",
```

**IMPORTANT:** The table names here are for COUNT queries (simple `SELECT count(*) FROM table WHERE ...`). The `_count_sql_for_type()` function at line 200 constructs the SQL generically. Verify each table name by cross-referencing with the query files — if the table doesn't have `start_pos`/`end_pos`/`coord`/`chr_id`/`build`/`layer_id` columns, the generic count query won't work and you'll need to check if it should be excluded (like gene_set, pathway, etc. which are gene-level, not positional).

- [ ] **Step 2: Verify the edit**

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "
from polymer_genomics.routers.profile import _COUNT_TABLES
print(f'{len(_COUNT_TABLES)} layers in _COUNT_TABLES')
"
```
Expected: `44 layers in _COUNT_TABLES` (26 existing + 18 new)

- [ ] **Step 3: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add src/polymer_genomics/routers/profile.py
git commit -m "feat: add 18 layers to _COUNT_TABLES for region profiles"
```

---

## Task 4: Add 11 Layers to Aggregation Engine

**Files:**
- Modify: `src/polymer_genomics/routers/aggregation.py:19-91`

- [ ] **Step 1: Add new elif branches to _aggregation_query()**

Open `src/polymer_genomics/routers/aggregation.py` and add these branches inside `_aggregation_query()`, after the `gene_cost` branch (line 90) and before `return None` (line 91):

```python
    elif layer_type == "biophysics":
        return """
            SELECT floor(b.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   avg(b.gc_content) AS mean_gc,
                   avg(b.stacking_dg37) AS mean_dg37,
                   avg(b.melting_temp) AS mean_tm,
                   avg(b.curvature) AS mean_curvature
            FROM biophysics.sequence_properties b
            WHERE b.build = $1::genome_build
              AND b.chr_id = $2
              AND b.coord && int4range($3, $4)
              AND b.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "conservation":
        return """
            SELECT floor(c.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   avg(c.phylop_mean) AS mean_phylop,
                   avg(c.phastcons_mean) AS mean_phastcons
            FROM conservation.scores c
            WHERE c.build = $1::genome_build
              AND c.chr_id = $2
              AND c.coord && int4range($3, $4)
              AND c.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "repeat":
        return """
            SELECT floor(r.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM annotation.repeats r
            WHERE r.build = $1::genome_build
              AND r.chr_id = $2
              AND r.coord && int4range($3, $4)
              AND r.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "regulatory":
        return """
            SELECT floor(c.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM regulatory.ccre c
            WHERE c.build = $1::genome_build
              AND c.chr_id = $2
              AND c.coord && int4range($3, $4)
              AND c.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "nonb_dna":
        return """
            SELECT floor(n.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   avg(n.total_nonb_density) AS mean_nonb_density,
                   avg(n.g4_density) AS mean_g4_density
            FROM fragility.nonb_dna n
            WHERE n.build = $1::genome_build
              AND n.chr_id = $2
              AND n.coord && int4range($3, $4)
              AND n.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "clinvar":
        return """
            SELECT floor(v.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM variation.clinvar_variants v
            WHERE v.build = $1::genome_build
              AND v.chr_id = $2
              AND v.coord && int4range($3, $4)
              AND v.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "eqtl":
        return """
            SELECT floor(e.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM qtl.eqtls e
            WHERE e.build = $1::genome_build
              AND e.chr_id = $2
              AND e.coord && int4range($3, $4)
              AND e.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "meqtl":
        return """
            SELECT floor(m.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM qtl.meqtls m
            WHERE m.build = $1::genome_build
              AND m.chr_id = $2
              AND m.coord && int4range($3, $4)
              AND m.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "chromatin_state":
        return """
            SELECT floor(cs.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM regulatory.chromatin_states cs
            WHERE cs.build = $1::genome_build
              AND cs.chr_id = $2
              AND cs.coord && int4range($3, $4)
              AND cs.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "lad":
        return """
            SELECT floor(l.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density
            FROM nuclear.lads l
            WHERE l.build = $1::genome_build
              AND l.chr_id = $2
              AND l.coord && int4range($3, $4)
              AND l.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
    elif layer_type == "super_enhancer":
        return """
            SELECT floor(se.start_pos / $6) * $6 AS bin_start,
                   count(*) AS count,
                   count(*)::float / $6 AS density,
                   avg(se.h3k27ac_signal) AS mean_h3k27ac
            FROM nuclear.super_enhancers se
            WHERE se.build = $1::genome_build
              AND se.chr_id = $2
              AND se.coord && int4range($3, $4)
              AND se.layer_id = $5
            GROUP BY bin_start
            ORDER BY bin_start
        """
```

- [ ] **Step 2: Verify the edit**

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && python -c "
from polymer_genomics.routers.aggregation import _aggregation_query
supported = []
for lt in ['cpg','isochore','gene_model','probe','gene_cost','biophysics','conservation','repeat','regulatory','nonb_dna','clinvar','eqtl','meqtl','chromatin_state','lad','super_enhancer']:
    if _aggregation_query(lt) is not None:
        supported.append(lt)
print(f'{len(supported)} layers support aggregation: {supported}')
"
```
Expected: `16 layers support aggregation`

- [ ] **Step 3: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add src/polymer_genomics/routers/aggregation.py
git commit -m "feat: add 11 layers to aggregation engine (biophysics, conservation, repeats, ccre, nonb, clinvar, QTLs, chromatin, LADs, SEs)"
```

---

## Task 5: Add 9 HLA MCP Tools

**Files:**
- Modify: `mcp/polymer_genomics_mcp/server.py` (after line ~1724, before TE methylation section)

- [ ] **Step 1: Add HLA tools to server.py**

Open `mcp/polymer_genomics_mcp/server.py` and add this block after the `transposome_family` tool (after line ~1723) and before the `# ── TE Methylation Analysis` comment:

```python
# ── HLA Allele Biophysics ──────────────────────────────────────────────


@mcp.tool()
async def lookup_hla_loci() -> dict:
    """List HLA loci with allele counts and mean biophysics.

    Returns the 6 transplant-relevant loci (HLA-A, -B, -C, -DRB1, -DQB1, -DPB1)
    with total allele counts, genomic allele counts, and mean biophysical
    properties for both coding and non-coding regions.
    """
    return await _get("/v1/hla/loci")


@mcp.tool()
async def lookup_hla_alleles(
    locus: str,
    allele_group: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Browse HLA alleles for a locus with biophysics summaries.

    Returns paginated allele list with per-allele biophysical properties.

    Args:
        locus: HLA locus (e.g., 'HLA-A', 'A', 'HLA-DRB1').
        allele_group: Filter by 1st field (e.g., '02' for A*02 alleles).
        limit: Max results per page (default 50).
        offset: Pagination offset.
    """
    params = {"limit": str(limit), "offset": str(offset)}
    if allele_group:
        params["allele_group"] = allele_group
    return await _get(f"/v1/hla/alleles/{locus}", params)


@mcp.tool()
async def lookup_hla_allele(
    allele_name: str,
) -> dict:
    """Get full biophysics for a specific HLA allele.

    Returns complete biophysical profile including coding and non-coding
    region properties (GC, stacking dG37, melting temp) for one allele.

    Args:
        allele_name: Full allele name (e.g., 'A*01:01:01:01', 'B*07:02:01').
    """
    return await _get(f"/v1/hla/allele/{allele_name}")


@mcp.tool()
async def lookup_hla_distributions(
    locus: str,
) -> dict:
    """Get biophysical distribution statistics for an HLA locus.

    Returns histogram bins (30), percentiles, and summary stats for all
    biophysical metrics across all genomic alleles at the locus. Used for
    contextualizing individual allele values.

    Args:
        locus: HLA locus (e.g., 'HLA-A', 'A').
    """
    return await _get(f"/v1/hla/distributions/{locus}")


@mcp.tool()
async def compare_hla_alleles(
    alleles: list[str],
    focus: str = "noncoding",
) -> dict:
    """Compare biophysical properties of 2-10 HLA alleles.

    Returns per-allele biophysics plus pairwise delta tables. When
    focus='noncoding', deltas emphasize intron and UTR differences.
    First allele is the reference for delta computation.

    Args:
        alleles: List of 2-10 allele names (e.g., ['A*01:01:01:01', 'A*02:01:01:01']).
        focus: Delta focus area: 'noncoding' (default), 'full', or 'coding'.
    """
    return await _post("/v1/hla/compare", {"alleles": alleles, "focus": focus})


@mcp.tool()
async def hla_match_score(
    donor: dict[str, dict],
    recipient: dict[str, dict],
) -> dict:
    """Compute biophysical mismatch score for donor-recipient HLA matching.

    Beyond protein-level matching, computes non-coding biophysical divergence
    that may correlate with expression mismatch (Bettens et al. 2022).

    Args:
        donor: Donor genotype as {locus: {allele_1: str, allele_2: str}}.
        recipient: Recipient genotype, same format.
    """
    return await _post("/v1/hla/match-score", {"donor": donor, "recipient": recipient})


@mcp.tool()
async def hla_noncoding_divergence(
    locus: str,
    allele_group: str,
    protein: str,
) -> dict:
    """Analyze non-coding divergence among protein-identical HLA alleles.

    Given a locus + protein (e.g., HLA-A*02:01), finds all alleles encoding
    the same protein and ranks by non-coding biophysical divergence.

    Args:
        locus: HLA locus (e.g., 'HLA-A').
        allele_group: 1st field (e.g., '02').
        protein: 2nd field (e.g., '01').
    """
    return await _post("/v1/hla/noncoding-divergence", {
        "locus": locus, "allele_group": allele_group, "protein": protein,
    })


@mcp.tool()
async def hla_expression_correlation(
    locus: str | None = None,
    focus: str = "noncoding",
) -> dict:
    """Correlate HLA biophysical properties with expression class.

    Groups alleles by IMGT expression suffix (normal, null, low, etc.) and
    computes Cohen's d effect sizes. Tests whether material-channel properties
    predict expression phenotype.

    Args:
        locus: Filter by locus (e.g., 'A'). None for all loci.
        focus: Metric set: 'noncoding' (default), 'full', or 'both'.
    """
    params = {"focus": focus}
    if locus:
        params["locus"] = locus
    return await _get("/v1/hla/expression-correlation", params)


@mcp.tool()
async def hla_expression_within_protein(
    locus: str | None = None,
    min_alleles: int = 3,
) -> dict:
    """Test whether non-coding biophysics predict expression within protein-identical alleles.

    The strongest test: among alleles encoding the SAME protein, do those with
    expression suffixes (L, Q, S) have different non-coding biophysics?

    Args:
        locus: Filter by locus. None for all.
        min_alleles: Minimum alleles per protein group (default 3).
    """
    params = {"min_alleles": str(min_alleles)}
    if locus:
        params["locus"] = locus
    return await _get("/v1/hla/expression-within-protein", params)
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/mcp && python -c "import polymer_genomics_mcp.server; print('MCP server imports OK')"
```
Expected: `MCP server imports OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add mcp/polymer_genomics_mcp/server.py
git commit -m "feat: add 9 HLA MCP tools (loci, alleles, compare, match-score, divergence, expression)"
```

---

## Task 6: Add 6 Remaining MCP Tools (Transposome, Design, Layers)

**Files:**
- Modify: `mcp/polymer_genomics_mcp/server.py`

- [ ] **Step 1: Add remaining MCP tools**

Add after the HLA tools block (or wherever appropriate based on existing grouping):

```python
# ── Additional Coverage Tools ──────────────────────────────────────────


@mcp.tool()
async def lookup_transposome_probe_mapping(
    platform: str = "epic_v2",
    build: str = "hg38",
) -> dict:
    """Get full probe-to-TE family mapping for a platform.

    Returns all probes that overlap transposable elements, grouped by
    TE family, with divergence and evolutionary age data.

    Args:
        platform: Array platform ('epic_v2', 'epic_v1', '450k').
        build: Genome build ('hg38' or 'hg37').
    """
    return await _get("/v1/transposome/probe-te-mapping", {"platform": platform, "build": build}, build=build)


@mcp.tool()
async def lookup_transposome_reference_methylation() -> dict:
    """Get reference methylation ranges per TE family.

    Returns curated reference beta ranges [low, high], primary silencing
    mechanism, and reactivation score for each TE family.
    """
    return await _get("/v1/transposome/reference-methylation")


@mcp.tool()
async def compare_constructs(
    constructs: list[dict],
    salt_mm: float = 150.0,
    analysis: str = "full",
) -> dict:
    """Compare biophysical properties of 2-10 synthetic DNA constructs.

    Each construct has parts [{name, sequence, role}]. Returns per-construct
    evaluation plus delta comparison table.

    Args:
        constructs: List of 2-10 construct dicts, each with 'name' and 'parts' keys.
        salt_mm: Salt concentration in mM (default 150).
        analysis: Analysis depth ('full' or 'summary').
    """
    return await _post("/v1/design/construct/compare", {
        "constructs": constructs, "salt_mm": salt_mm, "analysis": analysis,
    })


@mcp.tool()
async def lookup_layer_license(
    layer_key: str,
) -> dict:
    """Get license, citation, and source info for a data layer.

    Returns the license class, license URI, citation string, source URL,
    and ODbL compliance flag for the specified layer.

    Args:
        layer_key: Layer identifier (e.g., 'probe_epic_v2', 'cpg_sites_hg38').
    """
    return await _get(f"/v1/layers/{layer_key}/license")


@mcp.tool()
async def platform_feature_counts(
    build: str = "hg38",
) -> dict:
    """Get authoritative feature counts for the platform.

    Returns total protein-coding genes, CpG sites, probes, and other
    feature counts for the specified genome build.

    Args:
        build: Genome build ('hg38' or 'hg37').
    """
    return await _get(f"/v1/layers/summary/{build}", build=build)


@mcp.tool()
async def get_tile(
    build: str,
    chr_name: str,
    resolution: str,
    tile_index: int,
    layers: str | None = None,
) -> dict:
    """Get pre-tiled data for genome browser visualization.

    Returns GRanges data for a specific tile (fixed-size genomic window)
    at a given resolution. Tiles are immutable and cacheable.

    Args:
        build: Genome build ('hg38' or 'hg37').
        chr_name: Chromosome name (e.g., 'chr17').
        resolution: Tile resolution ('1k', '10k', '100k', '1M').
        tile_index: Zero-based tile index within the chromosome.
        layers: Comma-separated layer types to include.
    """
    params = {}
    if layers:
        params["layers"] = layers
    return await _get(f"/v1/tiles/{build}/{chr_name}/tile/{resolution}/{tile_index}", params, build=build)
```

- [ ] **Step 2: Verify syntax**

Run:
```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/mcp && python -c "import polymer_genomics_mcp.server; print('MCP server imports OK')"
```
Expected: `MCP server imports OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add mcp/polymer_genomics_mcp/server.py
git commit -m "feat: add 6 MCP tools (transposome mapping, construct compare, layer license, feature counts, tiles)"
```

---

## Task 7: Verify Table Names Against Actual DB Queries

This is a critical validation task. The table names used in Tasks 1-4 must match the actual SQL in the query files.

**Files:**
- Read-only: `src/polymer_genomics/queries/*.py`

- [ ] **Step 1: For each new layer added in Tasks 1-4, read the corresponding query file and verify the table name**

Check each query file imported in `_registry.py`:

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
# For each new layer, grep the actual table name from its query function:
grep -n "FROM\|JOIN" src/polymer_genomics/queries/variation.py    # clinvar
grep -n "FROM\|JOIN" src/polymer_genomics/queries/qtl.py          # eqtl, meqtl
grep -n "FROM\|JOIN" src/polymer_genomics/queries/nuclear.py      # lad, nad, dmv, super_enhancer
grep -n "FROM\|JOIN" src/polymer_genomics/queries/evolution.py    # ultraconserved, archaic_methylation, etc.
grep -n "FROM\|JOIN" src/polymer_genomics/queries/regulatory.py   # enhancer_gene, tfbs
grep -n "FROM\|JOIN" src/polymer_genomics/queries/structural_variation.py
grep -n "FROM\|JOIN" src/polymer_genomics/queries/tcga.py
```

- [ ] **Step 2: Fix any table name mismatches**

If the actual table name in the query file differs from what was added in Tasks 1-4, update the entries to match. Common patterns:
- `chromatin_state` table might be `regulatory.chromatin_state` (singular) vs `regulatory.chromatin_states` (plural)
- Evolution tables might use different naming conventions

- [ ] **Step 3: Commit fixes if any**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add -u
git commit -m "fix: correct table names in routing dicts to match actual DB schema"
```

---

## Task 8: Deploy and Run Smoke Tests

- [ ] **Step 1: Run existing smoke tests locally**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/smoke_test.py -v
```
Expected: 24/24 passing (no regressions)

- [ ] **Step 2: Deploy to Fly.io**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && fly deploy
```
Wait for deployment to complete.

- [ ] **Step 3: Verify new intersect layers work**

```bash
# Test one new intersect layer (clinvar)
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"build":"hg38","region":"chr17:7668402-7687550","filters":[{"layer":"clinvar","op":"overlaps"}]}' \
  "https://api.polymerbio.org/v1/query/intersect" | python3 -m json.tool | head -20
```

- [ ] **Step 4: Verify new correlation layers work**

```bash
# Test clinvar correlation
curl -s "https://api.polymerbio.org/v1/correlate/hg38/chr17:7668402-7687550?layer_a=biophysics&layer_b=clinvar&stat=pearson_r&field_a=gc_content&field_b=density" | python3 -m json.tool
```

- [ ] **Step 5: Verify new aggregation layers work**

```bash
# Test biophysics aggregation
curl -s "https://api.polymerbio.org/v1/aggregation/hg38/chr17:7668402-7687550?resolution=1000" | python3 -m json.tool | head -20
```

- [ ] **Step 6: Verify HLA MCP tools work**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI/mcp && echo '{"method":"tools/list"}' | uv run python -m polymer_genomics_mcp.server 2>/dev/null | python3 -m json.tool | grep -c "name"
```
Expected: 60 tools (was 54, +6 misc tools; HLA adds 9 but some may be counted differently — just verify count increased)

- [ ] **Step 7: Run /audit to verify gaps are closed**

Run the `/audit` slash command and verify:
- INTERSECT shows 28/48 (was 13)
- CORRELATION shows 47/48 (was 31)
- PROFILE shows 44/48 (was 26)
- AGGREGATION shows 16/48 (was 5)
- MCP tools cover all API endpoints

- [ ] **Step 8: Commit any final fixes**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI
git add -u
git commit -m "chore: post-deploy verification fixes"
```

---

## Task Summary

| Task | What | Files | New Items |
|------|------|-------|-----------|
| 1 | Intersect engine | `routers/intersect.py` | +15 layers |
| 2 | Correlation engine | `correlation.py` | +16 layers |
| 3 | Profile engine | `routers/profile.py` | +18 layers |
| 4 | Aggregation engine | `routers/aggregation.py` | +11 layers |
| 5 | HLA MCP tools | `mcp/server.py` | +9 tools |
| 6 | Other MCP tools | `mcp/server.py` | +6 tools |
| 7 | Table name verification | read-only queries/ | fixes |
| 8 | Deploy + smoke test | deploy | verification |

**Parallelism:** Tasks 1-4 modify different files and can run in parallel. Tasks 5-6 both modify server.py so must be sequential (or combined). Task 7 depends on 1-4. Task 8 depends on all.
