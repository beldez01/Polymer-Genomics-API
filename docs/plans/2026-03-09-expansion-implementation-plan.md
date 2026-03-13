# Expansion Blueprint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Expansion Blueprint Design — epistemic schema, moat layers, API expansion, UI enhancements — transforming Polymer Genomics into the most rigorous, physically grounded genomics reference platform.

**Architecture:** PostgreSQL schema extension via migration (new ENUMs + ALTER TABLE on `registry.layers`), FastAPI endpoint updates to surface epistemic metadata in responses, MCP tool filtering by evidence class, and new data layers ingested through the established `TRACK_REGISTRY` pattern.

**Tech Stack:** PostgreSQL 16 (GiST-indexed partitioned tables), FastAPI + asyncpg, FastMCP, Next.js viewer, pytest (440+ existing tests)

**Design Doc:** `docs/plans/2026-03-09-expansion-blueprint-design.md` (approved)

---

## Phase 1A: Epistemic Foundation

### Task 1: Create Epistemic ENUMs Migration

**Files:**
- Create: `docker/postgres/migrations/023_epistemic_schema.sql`

**Step 1: Write the migration SQL**

```sql
-- 023_epistemic_schema.sql
-- Epistemic schema extension for registry.layers
-- Adds evidence class, biological ontology, and validation metadata

-- ============================================================
-- New ENUMs
-- ============================================================

CREATE TYPE polymer_evidence_class AS ENUM (
    'M',  -- measured: direct experimental observation
    'R',  -- reference_parameter: published constant
    'D',  -- deterministic_transform: reproducible computation
    'S',  -- statistical_model: measured data + model assumptions
    'K',  -- curated_knowledge: expert-assembled semantic object
    'H',  -- hypothesis_driven: theory-led, not yet validated
    'L'   -- learned_estimate: ML/statistical model output
);

CREATE TYPE polymer_tier AS ENUM (
    'intrinsic',    -- sequence-determined, equilibrium physics
    'constrained',  -- chemically modified, capacity intrinsic
    'active'        -- non-equilibrium, requires free energy flux
);

CREATE TYPE polymer_equilibrium_regime AS ENUM (
    'equilibrium',
    'non_equilibrium',
    'mixed'
);

CREATE TYPE polymer_statefulness AS ENUM (
    'reference_static',       -- same for all humans given same build
    'sample_specific',        -- varies by cell type/tissue/individual
    'contextual_predicted'    -- model-generated for specific context
);

CREATE TYPE polymer_validation_status AS ENUM (
    'canonical',               -- reference parameters (SantaLucia, Olson)
    'externally_benchmarked',  -- tested against independent gold standard
    'externally_validated',    -- reproduced by independent group
    'internally_validated',    -- tested within platform
    'partially_validated',     -- some aspects confirmed
    'unvalidated'              -- no validation performed
);

CREATE TYPE polymer_interpretability AS ENUM (
    'direct',
    'mechanistic',
    'semi_interpretable',
    'opaque'
);

-- ============================================================
-- ALTER registry.layers — add epistemic columns
-- ============================================================

-- Primary classification
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS evidence_class polymer_evidence_class,
    ADD COLUMN IF NOT EXISTS tier polymer_tier,
    ADD COLUMN IF NOT EXISTS equilibrium_regime polymer_equilibrium_regime,
    ADD COLUMN IF NOT EXISTS statefulness polymer_statefulness;

-- Provenance modifiers
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS is_composite BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS source_count SMALLINT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS derived_from_classes polymer_evidence_class[];

-- Validation
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS validation_status polymer_validation_status,
    ADD COLUMN IF NOT EXISTS uncertainty_available BOOLEAN DEFAULT false;

-- Interpretability
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS interpretability polymer_interpretability;

-- Context conditions (anti-handwaving)
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS context_conditions JSONB;

-- H-class safeguards (nullable, required when evidence_class = 'H')
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS hypothesis_banner BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS falsification_path TEXT,
    ADD COLUMN IF NOT EXISTS benchmark_plan TEXT,
    ADD COLUMN IF NOT EXISTS closest_lower_class_proxy polymer_evidence_class;

-- L-class readiness (nullable, required when evidence_class = 'L')
ALTER TABLE registry.layers
    ADD COLUMN IF NOT EXISTS model_family TEXT,
    ADD COLUMN IF NOT EXISTS model_version TEXT,
    ADD COLUMN IF NOT EXISTS training_domain TEXT;

-- ============================================================
-- Partial index: H-class must have safeguards
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_layers_evidence_class
    ON registry.layers (evidence_class)
    WHERE evidence_class IS NOT NULL;

-- ============================================================
-- GRANTS for new columns (inherited by existing table grants)
-- ============================================================
-- No explicit grants needed — existing table-level grants cover new columns
```

**Step 2: Verify the migration is syntactically valid**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && docker compose exec postgres psql -U admin -d polymer_genomics -f /docker-entrypoint-initdb.d/migrations/023_epistemic_schema.sql`

This runs against the local dev DB only. Expected: all statements succeed with no errors.

**Step 3: Commit**

```bash
git add docker/postgres/migrations/023_epistemic_schema.sql
git commit -m "feat: add epistemic schema migration (023)

New ENUMs: polymer_evidence_class, polymer_tier, polymer_equilibrium_regime,
polymer_statefulness, polymer_validation_status, polymer_interpretability.
Adds 20 columns to registry.layers for epistemic metadata."
```

---

### Task 2: Classify Existing Layers

**Files:**
- Create: `docker/postgres/migrations/024_classify_existing_layers.sql`

**Step 1: Write the classification migration**

This UPDATE sets epistemic metadata on every existing layer based on the classification table in the design doc (Section 1.9).

```sql
-- 024_classify_existing_layers.sql
-- Backfill epistemic metadata on all existing registry.layers rows

-- Gene models (GENCODE)
UPDATE registry.layers SET
    evidence_class = 'K',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M','S','K']::polymer_evidence_class[],
    source_count = 3,
    validation_status = 'externally_benchmarked',
    interpretability = 'direct'
WHERE layer_key = 'gencode_v44';

-- CpG sites
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'direct'
WHERE layer_key = 'cpg_sites';

-- Probes (EPIC v2, v1, 450K)
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'internally_validated',
    interpretability = 'direct'
WHERE layer_key IN ('probe_epic_v2', 'probe_epic_v1', 'probe_450k');

-- Isochores
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['D']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'internally_validated',
    interpretability = 'mechanistic'
WHERE layer_key = 'isochores_hg38';

-- Methylation reference (Salas)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'constrained',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'methylation_atlas';

-- GTEx expression
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'gtex_v10';

-- ENCODE cCREs
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key = 'encode_ccre_v4';

-- PhyloP/PhastCons conservation
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'semi_interpretable',
    context_conditions = '{"alignment": "100way_vertebrate", "method": "phyloFit_neutral_model"}'::jsonb
WHERE layer_key = 'phylop_phastcons_100way';

-- Gene costs (Akashi-Gojobori)
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['R','M']::polymer_evidence_class[],
    source_count = 2,
    validation_status = 'externally_validated',
    interpretability = 'mechanistic'
WHERE layer_key = 'gene_costs';

-- Gene constraint (gnomAD pLI/LOEUF)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'semi_interpretable'
WHERE layer_key = 'gene_constraint';

-- Protein abundance (PaxDb)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'protein_abundance';

-- Protein turnover (SILAC)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'protein_turnover';

-- Protein properties
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M','R']::polymer_evidence_class[],
    source_count = 2,
    validation_status = 'externally_validated',
    interpretability = 'mechanistic'
WHERE layer_key = 'protein_properties';

-- Protein evolution (dN/dS)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key = 'protein_evolution';

-- Protein atlas (HPA)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'protein_atlas';

-- Chromatin state (ChromHMM)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'sample_specific',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable',
    context_conditions = '{"model": "ChromHMM_15state", "marks": ["H3K4me3","H3K27ac","H3K27me3","H3K9me3","H3K36me3"]}'::jsonb
WHERE layer_key = 'chromatin_state';

-- Repeats (RepeatMasker)
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key = 'repeats_hg38';

-- Biophysics tracks (sequence_biophysics_l0)
UPDATE registry.layers SET
    evidence_class = 'D',
    tier = 'intrinsic',
    equilibrium_regime = 'equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    derived_from_classes = ARRAY['R']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_benchmarked',
    interpretability = 'mechanistic',
    context_conditions = '{"temperature": "37C", "salt": "1M_NaCl", "species": "human", "window_size": "1kb"}'::jsonb
WHERE layer_key = 'sequence_biophysics_l0';

-- Histone marks (ENCODE)
UPDATE registry.layers SET
    evidence_class = 'M',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'sample_specific',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key LIKE 'histone_%';

-- GWAS catalog
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'mixed',
    equilibrium_regime = 'mixed',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M']::polymer_evidence_class[],
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'semi_interpretable'
WHERE layer_key = 'gwas_catalog';

-- Reactome pathways
UPDATE registry.layers SET
    evidence_class = 'K',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'reactome_pathways';

-- MSigDB Hallmark gene sets
UPDATE registry.layers SET
    evidence_class = 'K',
    tier = 'active',
    equilibrium_regime = 'non_equilibrium',
    statefulness = 'reference_static',
    is_composite = false,
    source_count = 1,
    validation_status = 'externally_validated',
    interpretability = 'direct'
WHERE layer_key = 'msigdb_hallmark';

-- Gene profiles
UPDATE registry.layers SET
    evidence_class = 'S',
    tier = 'mixed',
    equilibrium_regime = 'mixed',
    statefulness = 'reference_static',
    is_composite = true,
    derived_from_classes = ARRAY['M','D','S']::polymer_evidence_class[],
    source_count = 3,
    validation_status = 'unvalidated',
    interpretability = 'semi_interpretable'
WHERE layer_key = 'gene_profiles';
```

**Step 2: Run migration on local dev DB**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && docker compose exec postgres psql -U admin -d polymer_genomics -f /docker-entrypoint-initdb.d/migrations/024_classify_existing_layers.sql`

Expected: UPDATE statements succeed (some may update 0 rows if layer_key doesn't match — that's OK for layers not yet ingested).

**Step 3: Verify classifications**

Run: `docker compose exec postgres psql -U admin -d polymer_genomics -c "SELECT layer_key, evidence_class, tier, validation_status FROM registry.layers WHERE evidence_class IS NOT NULL ORDER BY evidence_class, layer_key"`

Expected: Each existing layer shows its classification.

**Step 4: Commit**

```bash
git add docker/postgres/migrations/024_classify_existing_layers.sql
git commit -m "feat: classify all existing layers with epistemic metadata (024)"
```

---

### Task 3: Update Layers API to Return Epistemic Metadata

**Files:**
- Modify: `src/polymer_genomics/routers/layers.py:34-46` (list_layers response)
- Modify: `src/polymer_genomics/routers/layers.py:82-94` (get_layer response)
- Modify: `tests/test_layers.py` (add epistemic field tests)

**Step 1: Write failing tests**

Add to `tests/test_layers.py`:

```python
async def test_get_layer_includes_epistemic_fields(client, seed_layers):
    resp = await client.get("/v1/layers/probe_epic_v2")
    assert resp.status_code == 200
    body = resp.json()
    # Epistemic fields should be present (may be null for unseeded layers)
    for field in ("evidence_class", "tier", "equilibrium_regime", "statefulness",
                  "validation_status", "interpretability", "is_composite"):
        assert field in body, f"Missing epistemic field: {field}"


async def test_list_layers_includes_epistemic_fields(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    assert len(layers) >= 1
    for layer in layers:
        assert "evidence_class" in layer


async def test_list_layers_filter_by_evidence_class(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38&evidence_class=D")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    for layer in layers:
        if layer["evidence_class"] is not None:
            assert layer["evidence_class"] == "D"


async def test_list_layers_filter_by_tier(client, seed_layers):
    resp = await client.get("/v1/layers?build=hg38&tier=intrinsic")
    assert resp.status_code == 200
    layers = resp.json()["layers"]
    for layer in layers:
        if layer["tier"] is not None:
            assert layer["tier"] == "intrinsic"
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_layers.py -v -k "epistemic or evidence_class or tier"`

Expected: FAIL — fields not in response, `evidence_class` param not accepted.

**Step 3: Update seed_layers fixture**

In `tests/conftest.py:147-165`, update the INSERT to include epistemic columns:

```python
    await conn.execute("""
        INSERT INTO registry.layers
            (layer_key, version, name, layer_type, genome_build,
             source, license_class, storage_type, row_count, is_active, is_default,
             evidence_class, tier, equilibrium_regime, statefulness,
             validation_status, interpretability, is_composite)
        VALUES
            ('probe_epic_v2', '1.0', 'EPIC v2 Probes', 'probe', 'hg38',
             'derived:Illumina', 'derived', 'postgres', 935000, true, true,
             'D', 'intrinsic', 'equilibrium', 'reference_static',
             'internally_validated', 'direct', false),
            ('cpg_sites', '1.0', 'CpG Sites', 'cpg', 'hg38',
             'computed', 'public_domain', 'postgres', 28300000, true, true,
             'D', 'intrinsic', 'equilibrium', 'reference_static',
             'externally_benchmarked', 'direct', false),
            ('gencode_v44', '1.0', 'GENCODE v44', 'gene_model', 'hg38',
             'gencodegenes.org', 'public_domain', 'postgres', 2700000, true, true,
             'K', 'intrinsic', 'equilibrium', 'reference_static',
             'externally_benchmarked', 'direct', true),
            ('gtex_v10', '1.0', 'GTEx v10 Expression', 'expression', 'hg38',
             'GTEx v10', 'public_domain', 'postgres', 56000, true, true,
             'M', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'direct', false),
            ('encode_ccre_v4', '1.0', 'ENCODE cCREs V4', 'regulatory', 'hg38',
             'ENCODE SCREEN V4', 'public_domain', 'postgres', 926535, true, true,
             'S', 'active', 'non_equilibrium', 'reference_static',
             'externally_validated', 'semi_interpretable', true),
            ('phylop_phastcons_100way', '1.0', 'PhyloP+PhastCons 100-way', 'conservation', 'hg38',
             'UCSC 100-way', 'public_domain', 'postgres', 3100000, true, true,
             'S', 'intrinsic', 'equilibrium', 'reference_static',
             'externally_benchmarked', 'semi_interpretable', false)
        ON CONFLICT (layer_key, version) DO NOTHING
    """)
```

**Step 4: Update `list_layers` endpoint**

In `src/polymer_genomics/routers/layers.py`, modify the function signature (line 9) to accept new filter params:

```python
@router.get("")
async def list_layers(
    type: str | None = Query(None),
    build: str | None = Query(None),
    active: bool = Query(True),
    evidence_class: str | None = Query(None),
    tier: str | None = Query(None),
    min_validation: str | None = Query(None),
):
```

Add filter clauses after the existing ones (after line 30):

```python
        if evidence_class:
            query += f" AND evidence_class = ${idx}::polymer_evidence_class"
            params.append(evidence_class)
            idx += 1
        if tier:
            query += f" AND tier = ${idx}::polymer_tier"
            params.append(tier)
            idx += 1
```

Update the response dict (lines 34-46) to include epistemic fields:

```python
    layers = [
        {
            "layer_key": r["layer_key"],
            "version": r["version"],
            "name": r["name"],
            "type": r["layer_type"],
            "build": r["genome_build"],
            "license_class": r["license_class"],
            "row_count": r["row_count"],
            "is_default": r["is_default"],
            "evidence_class": r["evidence_class"],
            "tier": r["tier"],
            "equilibrium_regime": r["equilibrium_regime"],
            "statefulness": r["statefulness"],
            "validation_status": r["validation_status"],
            "interpretability": r["interpretability"],
            "is_composite": r["is_composite"],
        }
        for r in rows
    ]
```

Update `get_layer` response dict (lines 82-94):

```python
    return {
        "layer_key": row["layer_key"],
        "version": row["version"],
        "name": row["name"],
        "type": row["layer_type"],
        "build": row["genome_build"],
        "source": row["source"],
        "license_class": row["license_class"],
        "row_count": row["row_count"],
        "content_hash": row["content_hash"],
        "is_default": row["is_default"],
        "metadata": row["metadata"],
        "evidence_class": row["evidence_class"],
        "tier": row["tier"],
        "equilibrium_regime": row["equilibrium_regime"],
        "statefulness": row["statefulness"],
        "validation_status": row["validation_status"],
        "interpretability": row["interpretability"],
        "is_composite": row["is_composite"],
        "context_conditions": row["context_conditions"],
        "hypothesis_banner": row["hypothesis_banner"],
        "falsification_path": row["falsification_path"],
    }
```

**Step 5: Run tests**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_layers.py -v`

Expected: All tests pass including new epistemic field tests.

**Step 6: Commit**

```bash
git add src/polymer_genomics/routers/layers.py tests/test_layers.py tests/conftest.py
git commit -m "feat: surface epistemic metadata in layers API responses

list_layers and get_layer now return evidence_class, tier, equilibrium_regime,
statefulness, validation_status, interpretability, is_composite.
New filter params: evidence_class, tier, min_validation."
```

---

### Task 4: Add Epistemic Metadata to Region Query Response Envelope

**Files:**
- Modify: `src/polymer_genomics/routers/regions.py:73-76` (SELECT columns)
- Modify: `src/polymer_genomics/routers/regions.py:104-112` (layers_resolved construction)

**Step 1: Write failing test**

Add to `tests/test_regions.py` (or create if needed):

```python
async def test_region_query_layers_resolved_has_epistemic_fields(client, seed_genomic_data):
    resp = await client.get("/v1/regions/hg38/chr16:70699900-70700000?layers=cpg_sites")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["layers_resolved"]) >= 1
    lr = body["layers_resolved"][0]
    assert "evidence_class" in lr
    assert "tier" in lr
    assert "validation_status" in lr
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_regions.py -v -k "epistemic"`

Expected: FAIL — `evidence_class` not in layers_resolved dict.

**Step 3: Update region query to fetch and include epistemic columns**

In `src/polymer_genomics/routers/regions.py`, update the SELECT at line 74 and 80:

Change:
```python
"""SELECT id, layer_key, version, layer_type, content_hash
   FROM registry.active_layers WHERE layer_key = ANY($1)"""
```

To:
```python
"""SELECT id, layer_key, version, layer_type, content_hash,
          evidence_class, tier, validation_status, context_conditions
   FROM registry.active_layers WHERE layer_key = ANY($1)"""
```

(Same change for the non-filtered query at line 80.)

Update `layers_resolved.append` at lines 104-112:

```python
            layers_resolved.append(
                {
                    "layer_key": lr["layer_key"],
                    "version": lr["version"],
                    "layer_id": str(lr["id"]),
                    "content_hash": lr["content_hash"],
                    "evidence_class": lr["evidence_class"],
                    "tier": lr["tier"],
                    "validation_status": lr["validation_status"],
                    "context_conditions": lr["context_conditions"],
                    "status": "ok",
                }
            )
```

**Step 4: Run tests**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/test_regions.py -v`

Expected: All pass.

**Step 5: Commit**

```bash
git add src/polymer_genomics/routers/regions.py tests/test_regions.py
git commit -m "feat: include epistemic metadata in region query layers_resolved"
```

---

### Task 5: Update MCP `list_layers` Tool with Epistemic Filtering

**Files:**
- Modify: `mcp/polymer_genomics_mcp/server.py:112-131` (list_layers tool)

**Step 1: Update MCP list_layers signature and docstring**

```python
@mcp.tool()
async def list_layers(
    build: str = "hg38",
    layer_type: str | None = None,
    evidence_class: str | None = None,
    tier: str | None = None,
) -> dict:
    """List available genomic data layers.

    Returns metadata about registered annotation layers including epistemic
    classification (evidence_class, tier, validation_status). Use this to
    discover what data is available before querying.

    Use this when you need to check what data is loaded, confirm a layer_key
    exists, filter by evidence quality, or see row counts before a large query.

    Args:
        build: Genome build ('hg38' or 'hg37'). Defaults to 'hg38'.
        layer_type: Optional filter by type ('cpg', 'gene_model', 'probe', etc.).
        evidence_class: Optional filter by epistemic class ('M','R','D','S','K','H','L').
        tier: Optional filter by biological tier ('intrinsic','constrained','active').
    """
    params = {"build": build}
    if layer_type:
        params["type"] = layer_type
    if evidence_class:
        params["evidence_class"] = evidence_class
    if tier:
        params["tier"] = tier
    return await _get("/v1/layers", params)
```

**Step 2: Run MCP server locally to verify no import errors**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI/mcp && uv run python -c "from polymer_genomics_mcp.server import mcp; print('OK')"`

Expected: `OK`

**Step 3: Commit**

```bash
git add mcp/polymer_genomics_mcp/server.py
git commit -m "feat: add evidence_class and tier filtering to MCP list_layers"
```

---

### Task 6: Run Full Test Suite

**Step 1: Run all tests**

Run: `cd /Users/zbb2/Desktop/PolymerGenomicsAPI && uv run pytest tests/ -v --tb=short`

Expected: All 440+ tests pass (some may be skipped if they require production DB).

**Step 2: Fix any failures introduced by the epistemic columns**

The seed_layers fixture change may affect tests that check exact response shapes. Look for:
- Tests checking `len(body.keys())` on layer responses (now more keys)
- Tests doing `assert body == {...}` exact match on layer responses

Fix by updating expectations to include new fields.

**Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix: update test expectations for epistemic metadata fields"
```

---

## Phase 1B: Quick Moat Wins

### Task 7: SBS Thermodynamic Spectrum Layer

**Files:**
- Create: `docker/postgres/migrations/025_sbs_spectrum.sql`
- Create: `src/polymer_genomics/ingest/sbs_spectrum.py`
- Create: `tests/test_sbs_spectrum.py`

**Step 1: Write failing test**

```python
# tests/test_sbs_spectrum.py
async def test_sbs_spectrum_query(client, seed_sbs_data):
    resp = await client.get("/v1/regions/hg38/chr16:70699900-70700000?layers=sbs_spectrum")
    assert resp.status_code == 200
    body = resp.json()
    assert "sbs_spectrum" in body["data"]
```

**Step 2: Write migration**

```sql
-- 025_sbs_spectrum.sql
-- SBS 96-channel thermodynamic spectrum
-- Maps COSMIC trinucleotide mutation contexts to SantaLucia stacking dG perturbation

CREATE SCHEMA IF NOT EXISTS mutation;

CREATE TABLE mutation.sbs_spectrum (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trinuc_ref  char(3) NOT NULL,     -- e.g. 'ACA'
    trinuc_alt  char(3) NOT NULL,     -- e.g. 'AAA' (middle base mutated)
    sbs_channel text NOT NULL,         -- e.g. 'C>A' in trinuc context
    cosmic_label text NOT NULL,        -- e.g. 'A[C>A]A'
    dg_ref      real NOT NULL,         -- stacking dG of ref trinucleotide (kcal/mol)
    dg_alt      real NOT NULL,         -- stacking dG of alt trinucleotide (kcal/mol)
    delta_dg    real NOT NULL,         -- dG_alt - dG_ref (energy perturbation)
    UNIQUE (trinuc_ref, trinuc_alt)
);

-- This is a reference lookup table (96 rows), no partitioning needed
-- Evidence class: D (deterministic from SantaLucia NN parameters)
```

**Step 3: Write ingestion script**

The ingestion script computes all 96 channels from the SantaLucia nearest-neighbor parameters already in the database (reference.nn_parameters). Each trinucleotide has two stacking steps; the total stacking energy is the sum of both NN pairs.

```python
# src/polymer_genomics/ingest/sbs_spectrum.py
"""Compute and ingest the SBS 96-channel thermodynamic spectrum.

For each of the 96 COSMIC trinucleotide mutation channels (e.g., A[C>A]A),
computes the stacking free energy perturbation (delta_dG) using SantaLucia
nearest-neighbor parameters.
"""
```

Full implementation: iterate over 4 flanking_5p × 6 mutation_types × 4 flanking_3p = 96 channels. For each, compute dG_ref (sum of two NN steps in ref trinuc) and dG_alt (sum of two NN steps in alt trinuc). delta_dG = dG_alt - dG_ref.

**Step 4: Register layer and commit**

Register `sbs_spectrum` in `TRACK_REGISTRY` and insert into `registry.layers` with:
- `evidence_class = 'D'`, `tier = 'intrinsic'`, `validation_status = 'externally_benchmarked'`

```bash
git add docker/postgres/migrations/025_sbs_spectrum.sql src/polymer_genomics/ingest/sbs_spectrum.py tests/test_sbs_spectrum.py
git commit -m "feat: add SBS 96-channel thermodynamic spectrum layer (025)"
```

---

### Task 8: Epigenetic Clock Coefficients Layer

**Files:**
- Create: `docker/postgres/migrations/026_epigenetic_clocks.sql`
- Create: `src/polymer_genomics/ingest/epigenetic_clocks.py`

**Step 1: Write migration**

```sql
-- 026_epigenetic_clocks.sql
-- Epigenetic clock probe coefficients as queryable CpG annotations

CREATE TABLE ref.clock_coefficients (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    probe_id    text NOT NULL,
    clock_name  text NOT NULL,        -- 'horvath', 'hannum', 'phenoage', 'grimage', 'dunedinpace'
    coefficient real NOT NULL,
    intercept   real,                  -- clock-level intercept (same for all probes in clock)
    source_doi  text NOT NULL,
    UNIQUE (probe_id, clock_name)
);

CREATE INDEX idx_clock_probe ON ref.clock_coefficients (probe_id);
CREATE INDEX idx_clock_name ON ref.clock_coefficients (clock_name);

-- Evidence class: R (published reference parameters)
-- Tier: constrained (methylation is L1)
-- Statefulness: reference_static (coefficients don't change)
```

**Step 2: Write ingestion script**

Source probe weights from published supplementary tables:
- Horvath 2013 (353 CpGs, DOI: 10.1186/gb-2013-14-10-r115)
- Hannum 2013 (71 CpGs, DOI: 10.1016/j.molcel.2012.10.016)
- Levine PhenoAge 2018 (513 CpGs, DOI: 10.18632/aging.101414)
- Lu GrimAge 2019 (1030 CpGs, DOI: 10.18632/aging.101684)
- Belsky DunedinPACE 2022 (173 CpGs, DOI: 10.7554/eLife.73420)

Cross-map probe IDs to platform (450K/EPIC v1/EPIC v2) using existing `probe.map_edges`.

**Step 3: Add MCP tool `lookup_clock_probes`**

```python
@mcp.tool()
async def lookup_clock_probes(
    clock_name: str,
    build: str = "hg38",
) -> dict:
    """Look up epigenetic clock probe coefficients.

    Returns probe IDs, coefficients, and genomic coordinates for a specified
    epigenetic clock. Use this to find which CpGs contribute to age prediction
    and cross-reference with other layers.

    Args:
        clock_name: Clock name ('horvath', 'hannum', 'phenoage', 'grimage', 'dunedinpace').
        build: Genome build. Defaults to 'hg38'.
    """
```

**Step 4: Commit**

```bash
git add docker/postgres/migrations/026_epigenetic_clocks.sql src/polymer_genomics/ingest/epigenetic_clocks.py
git commit -m "feat: add epigenetic clock coefficients layer (026)"
```

---

### Task 9: Metabolic Burden with Turnover

**Files:**
- Create: `src/polymer_genomics/ingest/metabolic_burden.py`
- Modify: gene cost endpoint to include computed burden

**Step 1: Design**

Metabolic burden = biosynthetic_cost × expression_TPM × turnover_rate. This is a cross-layer derived quantity:
- biosynthetic_cost from `bioenergetics.gene_costs` (D-class)
- expression from `expression.gene_tpm` (M-class)
- turnover from `protein.turnover` (M-class)

Compute per-gene, per-tissue where all three are available. Store as a new column or materialized view.

**Step 2: Write migration**

```sql
-- 027_metabolic_burden.sql
-- Pre-computed metabolic burden: cost × expression × turnover

ALTER TABLE bioenergetics.gene_costs
    ADD COLUMN IF NOT EXISTS metabolic_burden_liver real,
    ADD COLUMN IF NOT EXISTS metabolic_burden_blood real,
    ADD COLUMN IF NOT EXISTS metabolic_burden_brain real,
    ADD COLUMN IF NOT EXISTS metabolic_burden_kidney real,
    ADD COLUMN IF NOT EXISTS metabolic_burden_max real,
    ADD COLUMN IF NOT EXISTS metabolic_burden_max_tissue text;
```

**Step 3: Write computation and ingestion**

Join gene_costs × gene_tpm × protein_turnover, compute burden for key tissues, UPDATE into gene_costs.

**Step 4: Commit**

```bash
git add docker/postgres/migrations/027_metabolic_burden.sql src/polymer_genomics/ingest/metabolic_burden.py
git commit -m "feat: add metabolic burden computation (027)"
```

---

## Phase 1C: Biophysical Depth

### Task 10: DNAshapeR Tracks (MGW, ProT, Roll, HelT)

**Files:**
- Create: `docker/postgres/migrations/028_dnashape.sql`
- Create: `src/polymer_genomics/ingest/dnashape.py`
- Create: `scripts/compute_dnashape.R`

**Step 1: Write migration**

```sql
-- 028_dnashape.sql
-- DNA shape features (DNAshapeR predictions) at 1kb resolution

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS mgw_mean real,       -- minor groove width (Å)
    ADD COLUMN IF NOT EXISTS prot_mean real,       -- propeller twist (°)
    ADD COLUMN IF NOT EXISTS roll_mean real,       -- roll angle (°)
    ADD COLUMN IF NOT EXISTS helt_mean real;       -- helix twist (°)

-- Evidence class: D (deterministic from pentamer lookup tables)
-- Source: Rohs et al. 2009, Zhou et al. 2013 (DNAshapeR)
```

**Step 2: Write R computation script**

Uses DNAshapeR (Bioconductor) to predict 4 shape features from sequence, then averages per 1kb window.

**Step 3: Write Python ingestion**

Reads R output CSV, UPDATEs existing `biophysics.sequence_properties` rows.

**Step 4: Commit**

```bash
git add docker/postgres/migrations/028_dnashape.sql scripts/compute_dnashape.R src/polymer_genomics/ingest/dnashape.py
git commit -m "feat: add DNAshapeR tracks (MGW, ProT, Roll, HelT) (028)"
```

---

## Phase 1D: Mutation Physics + Fragility

### Task 11: Breakpoint Catalog (K-class)

**Files:**
- Create: `docker/postgres/migrations/029_breakpoints.sql`
- Create: `src/polymer_genomics/ingest/breakpoints.py`

**Step 1: Write migration**

```sql
-- 029_breakpoints.sql
-- Curated breakpoint/fragile site catalog

CREATE SCHEMA IF NOT EXISTS fragility;

CREATE TABLE fragility.breakpoints (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    breakpoint_type text NOT NULL,  -- 'fragile_site', 'translocation', 'constitutional'
    name        text,               -- e.g. 'FRA3B', 'BCR-ABL'
    gene_a      text,               -- gene on one side
    gene_b      text,               -- gene on other side (for translocations)
    source      text NOT NULL,      -- 'HumCFS', 'COSMIC_SV', 'Mitelman'
    source_id   text,               -- external accession
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

CREATE TABLE fragility.breakpoints_hg38 PARTITION OF fragility.breakpoints
    FOR VALUES IN ('hg38') PARTITION BY HASH (chr_id);
CREATE TABLE fragility.breakpoints_hg38_p0 PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE fragility.breakpoints_hg38_p1 PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE fragility.breakpoints_hg38_p2 PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE fragility.breakpoints_hg38_p3 PARTITION OF fragility.breakpoints_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX idx_breakpoints_coord ON fragility.breakpoints USING GiST (chr_id, coord);

-- Evidence class: K (curated knowledge)
-- Tier: intrinsic (sequence-determined fragility)
```

**Step 2: Write ingestion**

Sources: HumCFS database (~120 common fragile sites), COSMIC SV (~1500 recurrent translocations), liftOver to hg38 where needed.

**Step 3: Register in TRACK_REGISTRY and commit**

```bash
git add docker/postgres/migrations/029_breakpoints.sql src/polymer_genomics/ingest/breakpoints.py
git commit -m "feat: add breakpoint/fragile site catalog layer (029)"
```

---

### Task 12: Non-B DNA Structure Predictions (D-class)

**Files:**
- Create: `docker/postgres/migrations/030_nonb_dna.sql`
- Create: `src/polymer_genomics/ingest/nonb_dna.py`
- Create: `scripts/compute_nonb_dna.py`

**Step 1: Write migration**

```sql
-- 030_nonb_dna.sql
-- Non-B DNA structure predictions at 1kb resolution

CREATE TABLE fragility.nonb_dna (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    layer_id    uuid NOT NULL REFERENCES registry.layers(id),
    build       genome_build NOT NULL,
    chr_id      smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos   int NOT NULL,
    end_pos     int NOT NULL,
    coord       int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    g4_score    real,       -- G-quadruplex propensity (G4Hunter)
    z_score     real,       -- Z-DNA propensity (ZHunt)
    cruciform   real,       -- inverted repeat / hairpin density
    r_loop      real,       -- R-loop forming potential (GC skew + G-clustering)
    PRIMARY KEY (id, build, chr_id)
) PARTITION BY LIST (build);

-- Partitioning: same HASH(4) pattern
-- ...

CREATE INDEX idx_nonb_coord ON fragility.nonb_dna USING GiST (chr_id, coord);

-- Evidence class: D (deterministic from sequence algorithms)
-- Tier: intrinsic
```

**Step 2: Write computation**

G4Hunter: sliding window, score based on G/C runs (Bedrat et al. 2016).
Z-DNA: alternating purine-pyrimidine stretches (Ho et al. 1986).
Cruciform: inverted repeat detection with stem >= 6bp.
R-loop: GC skew + G-clustering on non-template strand.

All deterministic from sequence — no model fitting.

**Step 3: Commit**

```bash
git add docker/postgres/migrations/030_nonb_dna.sql src/polymer_genomics/ingest/nonb_dna.py scripts/compute_nonb_dna.py
git commit -m "feat: add non-B DNA structure predictions layer (030)"
```

---

## Phase 2B: API Power (Cross-Layer Intersection)

### Task 13: Cross-Layer Intersection Endpoint

**Files:**
- Create: `src/polymer_genomics/routers/intersect.py`
- Modify: `src/polymer_genomics/main.py` (register router)
- Create: `tests/test_intersect.py`

**Step 1: Write failing test**

```python
# tests/test_intersect.py
async def test_intersect_basic(client, seed_genomic_data, seed_conservation_data):
    resp = await client.post("/v1/query/intersect", json={
        "build": "hg38",
        "region": "chr16:70699000-70702000",
        "filters": [
            {"layer": "cpg", "op": "overlaps"},
            {"layer": "conservation", "field": "phylop_mean", "op": ">", "value": 0.5}
        ],
        "return_layers": ["cpg_sites"]
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "intersections" in body["data"]
```

**Step 2: Implement intersection router**

The endpoint accepts a POST body with:
- `build`: genome build
- `region`: chromosomal region
- `filters`: array of layer filter objects
- `return_layers`: which layers to annotate the intersecting positions with

Core logic: for each filter, run a GiST range query, then intersect the result sets server-side using `int4range && int4range` operators.

**Step 3: Add MCP tool `intersect_layers`**

```python
@mcp.tool()
async def intersect_layers(
    build: str,
    region: str,
    filters: list[dict],
    return_layers: list[str] | None = None,
) -> dict:
    """Find genomic positions satisfying multiple cross-layer conditions.

    The killer feature: no other genomics API offers this. Specify conditions
    across different annotation layers and get positions that satisfy ALL of them.

    Example: find CpG islands with low stacking energy AND high conservation.

    Args:
        build: Genome build ('hg38' or 'hg37').
        region: Genomic region 'chr16:70000000-71000000'.
        filters: List of filter objects, each with 'layer', 'op', and optionally 'field'/'value'.
        return_layers: Optional list of layer keys to annotate intersecting positions with.
    """
```

**Step 4: Run tests and commit**

```bash
git add src/polymer_genomics/routers/intersect.py src/polymer_genomics/main.py tests/test_intersect.py mcp/polymer_genomics_mcp/server.py
git commit -m "feat: add cross-layer intersection endpoint + MCP tool"
```

---

## Phase 2C: UI Enhancements

### Task 14: Evidence Class Badges on Tracks

**Files:**
- Create: `viewer/src/components/EvidenceBadge.tsx`
- Modify: `viewer/src/components/tracks/TrackStack.tsx` (add badge to each track label)

**Step 1: Create badge component**

A small pill badge showing the evidence class letter (M/R/D/S/K/H/L) with class-specific colors:
- M = green (measured)
- R = blue (reference)
- D = teal (deterministic)
- S = amber (statistical)
- K = purple (curated)
- H = red dashed border (hypothesis — visually distinct)
- L = gray (learned)

**Step 2: Fetch epistemic metadata**

The viewer already fetches `layers_resolved` from region queries. Add `evidence_class` to the track metadata in the Zustand store.

**Step 3: Commit**

```bash
git add viewer/src/components/EvidenceBadge.tsx viewer/src/components/tracks/TrackStack.tsx
git commit -m "feat: add evidence class badges to track labels in viewer"
```

---

### Task 15: SVG/PNG Export with Figure Legend

**Files:**
- Create: `viewer/src/components/ExportButton.tsx`
- Modify: `viewer/src/components/HeaderBar.tsx` (add export button)

**Step 1: Implement export**

Uses `html2canvas` or direct SVG serialization of the current viewport. Auto-generates a legend including:
- Coordinates and build
- Active layers with evidence classes
- Source citations
- Timestamp

**Step 2: Commit**

```bash
git add viewer/src/components/ExportButton.tsx viewer/src/components/HeaderBar.tsx
git commit -m "feat: add SVG/PNG export with auto-generated figure legend"
```

---

## Deployment Sequence

### Task 16: Deploy Phase 1A to Production

**Step 1: Run migrations on Fly.io Postgres**

```bash
fly proxy 5433:5432 -a polymer-db &
psql -h localhost -p 5433 -U postgres -d polymer_genomics -f docker/postgres/migrations/023_epistemic_schema.sql
psql -h localhost -p 5433 -U postgres -d polymer_genomics -f docker/postgres/migrations/024_classify_existing_layers.sql
```

**Step 2: Deploy API**

```bash
cd /Users/zbb2/Desktop/PolymerGenomicsAPI && fly deploy
```

**Step 3: Verify**

```bash
curl https://api.polymerbio.org/v1/layers | jq '.layers[0] | {layer_key, evidence_class, tier}'
```

Expected: epistemic fields present in response.

**Step 4: Deploy viewer**

```bash
cd viewer && vercel --prod
```

---

## Summary

| Task | Component | Phase | Effort |
|------|-----------|-------|--------|
| 1 | Epistemic ENUMs migration | 1A | 30 min |
| 2 | Classify existing layers | 1A | 30 min |
| 3 | Layers API + tests | 1A | 1-2 hrs |
| 4 | Region query envelope | 1A | 30 min |
| 5 | MCP list_layers filtering | 1A | 15 min |
| 6 | Full test suite pass | 1A | 30 min |
| 7 | SBS Thermodynamic Spectrum | 1B | 1 day |
| 8 | Epigenetic clock coefficients | 1B | 1 day |
| 9 | Metabolic burden | 1B | 2-3 days |
| 10 | DNAshapeR tracks | 1C | 3-5 days |
| 11 | Breakpoint catalog | 1D | 2-3 days |
| 12 | Non-B DNA predictions | 1D | 3-5 days |
| 13 | Cross-layer intersection | 2B | 5-7 days |
| 14 | Evidence class badges | 2C | 1 day |
| 15 | SVG/PNG export | 2C | 2-3 days |
| 16 | Production deployment | — | 1 hr |

**Total Phase 1A (Epistemic Foundation): ~1 day**
**Total Wave 1 (Moat): ~6-8 weeks**
**Total Wave 2 (Strategic Depth): ~4-6 weeks**
