-- 033_repeats_enrichment.sql
-- Enrich existing RepeatMasker layer with evolutionary age classification,
-- activity status, and ERV superfamily annotations.
-- Backfills ~5.6M rows in annotation.repeats (no new rows).

BEGIN;

-- 1. Create age classification enum
DO $$ BEGIN
    CREATE TYPE repeat_age_class AS ENUM ('young', 'intermediate', 'ancient');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add new columns
ALTER TABLE annotation.repeats
    ADD COLUMN IF NOT EXISTS repeat_age    repeat_age_class,
    ADD COLUMN IF NOT EXISTS is_active     boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS superfamily   text;

COMMIT;

-- New transaction for backfill (enum visible after COMMIT)
BEGIN;

-- 3. Backfill repeat_age from repeat_name patterns
-- LINE elements
UPDATE annotation.repeats SET repeat_age = 'young'
WHERE repeat_class = 'LINE' AND repeat_name ~ '^L1HS$|^L1PA[0-9]';

UPDATE annotation.repeats SET repeat_age = 'intermediate'
WHERE repeat_class = 'LINE' AND repeat_name ~ '^L1PB' AND repeat_age IS NULL;

UPDATE annotation.repeats SET repeat_age = 'ancient'
WHERE repeat_class = 'LINE' AND repeat_name ~ '^(L1M|L2|L3|CR1)' AND repeat_age IS NULL;

-- SINE elements
UPDATE annotation.repeats SET repeat_age = 'young'
WHERE repeat_class = 'SINE' AND repeat_name ~ '^AluY';

UPDATE annotation.repeats SET repeat_age = 'intermediate'
WHERE repeat_class = 'SINE' AND repeat_name ~ '^AluS' AND repeat_age IS NULL;

UPDATE annotation.repeats SET repeat_age = 'ancient'
WHERE repeat_class = 'SINE' AND repeat_name ~ '^(AluJ|MIR)' AND repeat_age IS NULL;

-- LTR elements
UPDATE annotation.repeats SET repeat_age = 'young'
WHERE repeat_class = 'LTR' AND repeat_name ~ '^(HERV-K|LTR5)';

UPDATE annotation.repeats SET repeat_age = 'intermediate'
WHERE repeat_class = 'LTR' AND repeat_family IN ('ERV1', 'ERVK')
    AND repeat_age IS NULL;

UPDATE annotation.repeats SET repeat_age = 'ancient'
WHERE repeat_class = 'LTR' AND repeat_family IN ('ERVL', 'ERVL-MaLR')
    AND repeat_age IS NULL;

-- DNA transposons are all ancient
UPDATE annotation.repeats SET repeat_age = 'ancient'
WHERE repeat_class = 'DNA' AND repeat_age IS NULL;

-- 4. Backfill superfamily for ERV elements
UPDATE annotation.repeats SET superfamily = repeat_family
WHERE repeat_class = 'LTR' AND repeat_family LIKE 'ERV%';

-- HML2 special case (HERV-K subfamily)
UPDATE annotation.repeats SET superfamily = 'ERVK-HML2'
WHERE repeat_class = 'LTR' AND repeat_name ~ '^(HERV-K|LTR5_Hs|LTR5A|LTR5B)';

-- 5. Backfill is_active: full-length, low-divergence L1HS elements
UPDATE annotation.repeats SET is_active = true
WHERE repeat_class = 'LINE'
    AND repeat_name = 'L1HS'
    AND divergence_pct < 1.0
    AND (end_pos - start_pos) > 6000;

-- 6. Indexes on new columns
CREATE INDEX IF NOT EXISTS idx_repeats_age
    ON annotation.repeats (repeat_age);

CREATE INDEX IF NOT EXISTS idx_repeats_active
    ON annotation.repeats (is_active)
    WHERE is_active = true;

COMMIT;
