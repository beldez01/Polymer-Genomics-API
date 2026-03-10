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
-- Index on evidence_class for filtered queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_layers_evidence_class
    ON registry.layers (evidence_class)
    WHERE evidence_class IS NOT NULL;
