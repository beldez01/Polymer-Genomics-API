-- 060_evolution_tier10.sql
-- Tier 10 evolution tables: HARs, archaic introgression, selection sweeps, TE exaptation

BEGIN;
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'accelerated_region';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'archaic_introgression';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'selection_sweep';
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'te_exaptation';
COMMIT;

BEGIN;

-- Human Accelerated Regions (Doan et al. 2016)
CREATE TABLE IF NOT EXISTS evolution.accelerated_regions (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,
    chr_id              smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos           int NOT NULL,
    end_pos             int NOT NULL,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    har_name            text,
    acceleration_score  real,
    conservation_score  real,
    nearest_gene        text,
    distance_to_gene    int,
    category            text  -- coding, noncoding, enhancer
);

CREATE INDEX IF NOT EXISTS idx_har_range
    ON evolution.accelerated_regions USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_har_layer
    ON evolution.accelerated_regions (layer_id, build);

-- Archaic introgression segments (Browning et al. 2018)
CREATE TABLE IF NOT EXISTS evolution.archaic_segments (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,
    chr_id              smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos           int NOT NULL,
    end_pos             int NOT NULL,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    source_species      text NOT NULL,  -- neanderthal, denisovan
    population          text,           -- EUR, EAS, SAS, etc.
    posterior_prob       real,
    segment_length_kb   real,
    snp_count           int
);

CREATE INDEX IF NOT EXISTS idx_archaic_range
    ON evolution.archaic_segments USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_archaic_species
    ON evolution.archaic_segments (source_species);
CREATE INDEX IF NOT EXISTS idx_archaic_layer
    ON evolution.archaic_segments (layer_id, build);

-- Selection sweeps (selscan / 1000 Genomes)
CREATE TABLE IF NOT EXISTS evolution.selection_sweeps (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,
    chr_id              smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos           int NOT NULL,
    end_pos             int NOT NULL,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    population          text,           -- AFR, EUR, EAS, SAS, AMR
    ihs_max             real,
    xpehh_score         real,
    fst_vs_global       real,
    candidate_gene      text,
    sweep_type          text            -- hard, soft, incomplete
);

CREATE INDEX IF NOT EXISTS idx_sweep_range
    ON evolution.selection_sweeps USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_sweep_pop
    ON evolution.selection_sweeps (population);
CREATE INDEX IF NOT EXISTS idx_sweep_layer
    ON evolution.selection_sweeps (layer_id, build);

-- TE exaptation catalog (Chuong et al. 2017)
CREATE TABLE IF NOT EXISTS evolution.te_exaptation (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id            uuid NOT NULL REFERENCES registry.layers(id),
    build               genome_build NOT NULL,
    chr_id              smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos           int NOT NULL,
    end_pos             int NOT NULL,
    coord               int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,
    te_name             text,
    te_family           text,
    te_age_mya          real,
    regulatory_function text,   -- enhancer, promoter, insulator, splice_site
    target_gene         text,
    evidence            text,   -- experimental, computational, both
    source_study        text
);

CREATE INDEX IF NOT EXISTS idx_exapt_range
    ON evolution.te_exaptation USING GiST (chr_id, coord);
CREATE INDEX IF NOT EXISTS idx_exapt_family
    ON evolution.te_exaptation (te_family);
CREATE INDEX IF NOT EXISTS idx_exapt_layer
    ON evolution.te_exaptation (layer_id, build);

GRANT SELECT ON ALL TABLES IN SCHEMA evolution TO api_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA evolution TO ingest_writer;

COMMIT;
