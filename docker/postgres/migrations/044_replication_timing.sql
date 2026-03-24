-- 044_replication_timing.sql
-- Replication Timing Layer: ENCODE Repli-seq wavelet-smoothed signal, 1kb bins.
-- Source: ENCODE Consortium (CC BY 4.0), Hansen et al. 2010.

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS repli_gm12878 real,
    ADD COLUMN IF NOT EXISTS repli_k562 real;

COMMENT ON COLUMN biophysics.sequence_properties.repli_gm12878 IS 'Replication timing wavelet-smoothed signal, GM12878 (ENCODE Repli-seq)';
COMMENT ON COLUMN biophysics.sequence_properties.repli_k562 IS 'Replication timing wavelet-smoothed signal, K562 (ENCODE Repli-seq)';
