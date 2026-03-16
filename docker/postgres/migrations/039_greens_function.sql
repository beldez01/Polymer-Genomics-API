-- Phase 3.5: Green's function response tracks
-- 4 columns added to biophysics.sequence_properties

ALTER TABLE biophysics.sequence_properties
    ADD COLUMN IF NOT EXISTS correlation_length real,
    ADD COLUMN IF NOT EXISTS integrated_response real,
    ADD COLUMN IF NOT EXISTS perturbation_reach real,
    ADD COLUMN IF NOT EXISTS response_asymmetry real;

COMMENT ON COLUMN biophysics.sequence_properties.correlation_length IS 'Correlation length xi (kb) — perturbation propagation distance';
COMMENT ON COLUMN biophysics.sequence_properties.integrated_response IS 'Total mechanical connectedness of window';
COMMENT ON COLUMN biophysics.sequence_properties.perturbation_reach IS 'Distance-weighted broadcast range (kb^2)';
COMMENT ON COLUMN biophysics.sequence_properties.response_asymmetry IS 'Directional bias of perturbation propagation';
