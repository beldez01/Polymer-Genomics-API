-- Fix CpG islands query bug: both cpg_sites and cpg_islands had
-- layer_type='cpg', causing island queries to hit cpg.sites instead.
-- Adds 'cpg_island' as a distinct layer_type.

ALTER TYPE layer_type ADD VALUE IF NOT EXISTS 'cpg_island';

UPDATE registry.layers
   SET layer_type = 'cpg_island'
 WHERE layer_key = 'cpg_islands';
