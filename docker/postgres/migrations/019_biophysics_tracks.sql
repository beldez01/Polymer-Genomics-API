-- 019_biophysics_tracks.sql
-- Sequence Biophysical Properties Layer (Polymer Evolution Phase 1, 1kb bins).
-- 7 pre-computed tracks: GC, stacking energy, melting temp, curvature, groove width, dipole, periodicity.

BEGIN;

-- 1. Extend the layer_type enum
ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'biophysics';

COMMIT;

-- New transaction (enum values are visible only after COMMIT)
BEGIN;

-- 2. Create biophysics schema
CREATE SCHEMA IF NOT EXISTS biophysics;
GRANT USAGE ON SCHEMA biophysics TO api_reader, ingest_writer;

-- 3. Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA biophysics
    GRANT SELECT ON TABLES TO api_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA biophysics
    GRANT SELECT, INSERT, UPDATE ON TABLES TO ingest_writer;

-- 4. Sequence properties table (partitioned, ~3.1M rows for hg38)
--    1kb-binned biophysical properties from Polymer Evolution Phase 1.
--    Sources: SantaLucia 1998 (stacking), Bolshoy 1991 (curvature), El Hassan 1997 (groove).
CREATE TABLE IF NOT EXISTS biophysics.sequence_properties (
    id                bigint GENERATED ALWAYS AS IDENTITY,
    layer_id          uuid NOT NULL REFERENCES registry.layers(id),
    build             genome_build NOT NULL,

    -- Genomic coordinates (0-based half-open, 1kb bins)
    chr_id            smallint NOT NULL REFERENCES ref.chromosomes(chr_id),
    start_pos         int NOT NULL,
    end_pos           int NOT NULL,
    coord             int4range GENERATED ALWAYS AS (int4range(start_pos, end_pos)) STORED,

    -- Biophysical properties (mean over 1kb window)
    gc_content        real,       -- GC fraction [0, 1]
    stacking_dg37     real,       -- Stacking free energy kcal/mol (SantaLucia 1998)
    melting_temp       real,       -- Predicted melting temperature, degrees C
    curvature         real,       -- Intrinsic curvature rad/bp (Bolshoy 1991)
    groove_width      real,       -- Minor groove width, Angstroms (El Hassan 1997)
    dipole_density    real,       -- Dipole moment density, Debye
    periodicity_power real,       -- 10.5bp periodicity FFT power

    PRIMARY KEY (build, chr_id, id)
) PARTITION BY LIST (build);

-- hg38 partition, sub-partitioned by chromosome hash
CREATE TABLE IF NOT EXISTS biophysics.sequence_properties_hg38
    PARTITION OF biophysics.sequence_properties
    FOR VALUES IN ('hg38')
    PARTITION BY HASH (chr_id);

-- 4 hash sub-partitions
CREATE TABLE IF NOT EXISTS biophysics.sequence_properties_hg38_p0
    PARTITION OF biophysics.sequence_properties_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE IF NOT EXISTS biophysics.sequence_properties_hg38_p1
    PARTITION OF biophysics.sequence_properties_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE IF NOT EXISTS biophysics.sequence_properties_hg38_p2
    PARTITION OF biophysics.sequence_properties_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE IF NOT EXISTS biophysics.sequence_properties_hg38_p3
    PARTITION OF biophysics.sequence_properties_hg38
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_biophysics_range
    ON biophysics.sequence_properties USING GiST (chr_id, coord);

CREATE INDEX IF NOT EXISTS idx_biophysics_layer_build
    ON biophysics.sequence_properties (layer_id, build);

-- 6. Explicit grants
GRANT SELECT ON biophysics.sequence_properties TO api_reader;
GRANT SELECT, INSERT, UPDATE ON biophysics.sequence_properties TO ingest_writer;
GRANT SELECT ON biophysics.sequence_properties_hg38 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON biophysics.sequence_properties_hg38 TO ingest_writer;
GRANT SELECT ON biophysics.sequence_properties_hg38_p0 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON biophysics.sequence_properties_hg38_p0 TO ingest_writer;
GRANT SELECT ON biophysics.sequence_properties_hg38_p1 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON biophysics.sequence_properties_hg38_p1 TO ingest_writer;
GRANT SELECT ON biophysics.sequence_properties_hg38_p2 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON biophysics.sequence_properties_hg38_p2 TO ingest_writer;
GRANT SELECT ON biophysics.sequence_properties_hg38_p3 TO api_reader;
GRANT SELECT, INSERT, UPDATE ON biophysics.sequence_properties_hg38_p3 TO ingest_writer;

COMMIT;
