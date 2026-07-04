-- Add Solar columns if they don't exist
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_power DOUBLE PRECISION;
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_energy_daily DOUBLE PRECISION;
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_energy_total DOUBLE PRECISION;
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_estimated_power DOUBLE PRECISION;
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_estimated_daily DOUBLE PRECISION;
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_estimated_total DOUBLE PRECISION;
