-- Fix: Remove 10 spurious probes from horvath_2013 clock
-- These probes were double-loaded from embedded representative list
-- but are NOT in the original Horvath 2013 Table S3 (353 CpGs)
--
-- Root cause: ingestion script ran first without --data-dir (loading 15 embedded
-- probes), then re-ran with --data-dir (353 TSV probes). ON CONFLICT DO NOTHING
-- preserved 10 embedded probes not in the TSV, giving 363 total.
--
-- The 10 spurious probes have fabricated coefficients and must be removed.
-- Run via: fly postgres connect -a polymer-db < scripts/fix_horvath_probes.sql

BEGIN;

-- Verify current state
SELECT count(*) AS before_count
FROM ref.clock_coefficients
WHERE clock_name = 'horvath_2013';

-- Delete the 10 spurious probes
DELETE FROM ref.clock_coefficients
WHERE clock_name = 'horvath_2013'
  AND probe_id IN (
    'cg04875128',
    'cg06639320',
    'cg07553761',
    'cg08097417',
    'cg10501210',
    'cg14556683',
    'cg16867657',
    'cg21572722',
    'cg24724428',
    'cg27320127'
  );

-- Verify result
SELECT count(*) AS after_count
FROM ref.clock_coefficients
WHERE clock_name = 'horvath_2013';

-- Should show: before=363, after=353

-- IMPORTANT: cg16867657 (ELOVL2) IS a real Horvath probe but is MISSING
-- from the horvath_2013.tsv source file. The TSV needs to be regenerated
-- from the original Horvath 2013 Genome Biology Table S3 (PMID 24138928).
-- Until then, the clock will have 353 probes but be missing cg16867657.
--
-- TODO: Regenerate horvath_2013.tsv from Horvath 2013 Table S3
-- and re-ingest to get the correct 353 probes with correct coefficients.

COMMIT;
