-- Migration 002: Add unique index on (src_probe_id, dst_platform, dst_probe_id, build)
-- to prevent duplicate crossmap destinations from different source platforms.
--
-- Prerequisite: run scripts/deduplicate_crossmap.sql first to remove existing dupes.
--
-- The existing UNIQUE constraint on (src_platform, src_probe_id, dst_platform,
-- dst_probe_id, build) allows the same destination to appear twice when
-- src_probe_id exists on multiple source platforms (e.g. 450k and epic_v1 both
-- mapping cg00000029 -> epic_v2/cg00000029_TC21).  This new index prevents that.

CREATE UNIQUE INDEX IF NOT EXISTS idx_map_edges_unique_dest
    ON probe.map_edges (src_probe_id, dst_platform, dst_probe_id, build);
