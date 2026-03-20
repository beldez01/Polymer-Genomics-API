-- Fix ALL epigenetic clock data corruption
-- Root cause: dual-loading bug — embedded "representative" probes loaded first,
-- then TSV probes with ON CONFLICT DO NOTHING. Embedded values won for overlaps,
-- and non-overlapping embedded probes inflated counts.
--
-- Run via: fly postgres connect -a polymer-db < scripts/fix_all_clocks.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 1: Wipe all clock coefficients and reload from TSV only
-- This is the safest approach — ensures no embedded probe contamination
-- ═══════════════════════════════════════════════════════════════════════

-- Show current state
SELECT clock_name, count(*) AS n_probes
FROM ref.clock_coefficients
GROUP BY clock_name
ORDER BY clock_name;

-- Delete ALL coefficients (will be re-ingested from TSV-only)
DELETE FROM ref.clock_coefficients;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 2: Fix PhenoAge PMID in metadata
-- Wrong: 29507958 → Correct: 29676998
-- ═══════════════════════════════════════════════════════════════════════

UPDATE ref.clock_metadata
SET pmid = '29676998',
    source_citation = 'Levine 2018 Aging 10:573-591'
WHERE clock_name = 'phenoage_2018';

-- Verify metadata
SELECT clock_name, n_probes, pmid FROM ref.clock_metadata ORDER BY clock_name;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- STEP 3: Re-ingest from TSV only
-- Run AFTER this SQL completes:
--   uv run python -m polymer_genomics.ingest.epigenetic_clocks --data-dir data/clocks
--
-- Expected counts after re-ingestion:
--   horvath_2013:    353 (NOTE: TSV is missing 10 published probes — see TODO)
--   hannum_2013:      71
--   phenoage_2018:   513
--   grimage_2019:   1030
--   dunedinpace_2022: 173
--   Total:          2140
--
-- TODO: Regenerate horvath_2013.tsv from Horvath 2013 Table S3 (PMID 24138928)
--       to include the 10 missing probes (cg16867657/ELOVL2, cg06639320/FHL2,
--       cg21572722/ELOVL2, cg24724428/ELOVL2, cg10501210/C1orf132,
--       cg07553761/TRIM59, cg04875128/OTUD7A, cg14556683/PDLIM3,
--       cg08097417/LHFPL4, cg27320127/SCGN)
-- ═══════════════════════════════════════════════════════════════════════
