-- 054_te_materialized_views.sql
-- Materialized views for the transposome explorer.
-- Aggregates RepeatMasker elements and probe-repeat cross-reference
-- into family-level summaries used by /v1/transposome/ endpoints.
--
-- Run after: 017_repeats.sql, 033_repeats_enrichment.sql,
--            035_probe_repeat_xref.sql (+ xref ingest)
--
-- To refresh after re-ingesting repeats or probes:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY annotation.te_family_summary;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY annotation.te_probe_counts;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY annotation.te_chr_density;

BEGIN;

-- ── 1. Family-level summary from RepeatMasker ──────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS annotation.te_family_summary AS
SELECT
    r.repeat_class,
    r.repeat_family,
    count(*)::int                          AS copy_count,
    sum(upper(r.coord) - lower(r.coord))   AS total_bp,
    round(avg(r.divergence_pct)::numeric, 2) AS avg_divergence,
    percentile_cont(0.5) WITHIN GROUP (
        ORDER BY upper(r.coord) - lower(r.coord)
    )::int                                 AS median_length
FROM annotation.repeats r
WHERE r.build = 'hg38'
GROUP BY r.repeat_class, r.repeat_family
ORDER BY sum(upper(r.coord) - lower(r.coord)) DESC
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_te_family_summary_pk
    ON annotation.te_family_summary (repeat_class, COALESCE(repeat_family, ''));

GRANT SELECT ON annotation.te_family_summary TO api_reader;

-- ── 2. Probe counts per TE family per platform ─────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS annotation.te_probe_counts AS
SELECT
    x.repeat_class,
    x.repeat_family,
    count(*) FILTER (WHERE x.platform = 'probe_epic_v2')::int AS epic_v2_probes,
    count(*) FILTER (WHERE x.platform = 'probe_epic_v1')::int AS epic_v1_probes,
    count(*) FILTER (WHERE x.platform = 'probe_450k')::int    AS "450k_probes"
FROM probe.repeat_xref x
WHERE x.build = 'hg38'
GROUP BY x.repeat_class, x.repeat_family
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_te_probe_counts_pk
    ON annotation.te_probe_counts (repeat_class, COALESCE(repeat_family, ''));

GRANT SELECT ON annotation.te_probe_counts TO api_reader;

-- ── 3. Per-chromosome density per TE family ─────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS annotation.te_chr_density AS
SELECT
    r.repeat_class,
    r.repeat_family,
    c.chr_name,
    round(
        sum(upper(r.coord) - lower(r.coord))::numeric
        / NULLIF(c.length_hg38, 0) * 1000,
        3
    ) AS density   -- bp per kb
FROM annotation.repeats r
JOIN ref.chromosomes c ON c.chr_id = r.chr_id
WHERE r.build = 'hg38'
GROUP BY r.repeat_class, r.repeat_family, c.chr_name, c.length_hg38
WITH DATA;

CREATE INDEX IF NOT EXISTS idx_te_chr_density_lookup
    ON annotation.te_chr_density (repeat_class, repeat_family);

GRANT SELECT ON annotation.te_chr_density TO api_reader;

COMMIT;
