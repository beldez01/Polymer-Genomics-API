-- Deduplicate probe.map_edges: remove redundant crossmap rows where the same
-- (dst_platform, dst_probe_id, build) destination is reachable from multiple
-- source platforms under the same src_probe_id.
--
-- Root cause: a probe like cg00000029 exists on both 450k and epic_v1, and
-- both create coord_overlap edges to epic_v2's cg00000029_TC21.  The API
-- query on src_probe_id returns the destination twice (once per source
-- platform), which looks like a duplicate to the caller.
--
-- This script keeps only one edge per (src_probe_id, dst_platform,
-- dst_probe_id, build) group, preferring exact_id over coord_overlap and
-- keeping the row with the lowest id.
--
-- Run with: fly postgres connect -a polymer-db < scripts/deduplicate_crossmap.sql
--   or:     psql $DATABASE_URL < scripts/deduplicate_crossmap.sql

BEGIN;

-- Show how many duplicates exist before cleanup.
SELECT 'duplicate_groups' AS label, count(*) AS n
FROM (
    SELECT src_probe_id, dst_platform, dst_probe_id, build
    FROM probe.map_edges
    GROUP BY src_probe_id, dst_platform, dst_probe_id, build
    HAVING count(*) > 1
) sub;

-- Delete duplicate edges, keeping the one with the best method (exact_id
-- preferred) and lowest id as tiebreaker.
DELETE FROM probe.map_edges
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY src_probe_id, dst_platform, dst_probe_id, build
                   ORDER BY
                       CASE method WHEN 'exact_id' THEN 0
                                   WHEN 'coord_overlap' THEN 1
                                   WHEN 'liftover' THEN 2
                                   WHEN 'sequence_match' THEN 3
                       END,
                       id
               ) AS rn
        FROM probe.map_edges
    ) ranked
    WHERE rn > 1
);

-- Verify: no duplicates remain.
SELECT 'remaining_duplicates' AS label, count(*) AS n
FROM (
    SELECT src_probe_id, dst_platform, dst_probe_id, build
    FROM probe.map_edges
    GROUP BY src_probe_id, dst_platform, dst_probe_id, build
    HAVING count(*) > 1
) sub;

COMMIT;
