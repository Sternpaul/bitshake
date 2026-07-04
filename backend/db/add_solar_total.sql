-- 1. Add the new column
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS solar_energy_total DOUBLE PRECISION;

-- 2. Drop existing policies (automatically dropped when dropping the views, but safe to drop explicitly)
-- The views must be dropped to alter their definition
DROP MATERIALIZED VIEW IF EXISTS hourly_energy CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_energy CASCADE;

-- 3. Recreate hourly_energy
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_energy
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time)                             AS bucket,
    AVG(power_current)                                      AS avg_power,
    MAX(power_current)                                      AS max_power,
    MIN(power_current)                                      AS min_power,
    LAST(total_import, time) - FIRST(total_import, time)    AS consumed_kwh,
    LAST(total_export, time) - FIRST(total_export, time)    AS exported_kwh,
    LAST(solar_energy_total, time) - FIRST(solar_energy_total, time) AS generated_kwh,
    COUNT(*)                                                AS sample_count
FROM meter_readings
GROUP BY bucket
WITH NO DATA;

-- 4. Recreate daily_energy
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_energy
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time)                              AS bucket,
    AVG(power_current)                                      AS avg_power,
    MAX(power_current)                                      AS max_power,
    MIN(power_current)                                      AS min_power,
    LAST(total_import, time) - FIRST(total_import, time)    AS consumed_kwh,
    LAST(total_export, time) - FIRST(total_export, time)    AS exported_kwh,
    LAST(solar_energy_total, time) - FIRST(solar_energy_total, time) AS generated_kwh,
    COUNT(*)                                                AS sample_count
FROM meter_readings
GROUP BY bucket
WITH NO DATA;

-- 5. Add back the refresh policies
SELECT add_continuous_aggregate_policy('hourly_energy',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => TRUE
);

SELECT add_continuous_aggregate_policy('daily_energy',
    start_offset    => INTERVAL '3 days',
    end_offset      => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists   => TRUE
);

-- 6. Manually refresh the views right now so the data is available immediately!
CALL refresh_continuous_aggregate('hourly_energy', NULL, NULL);
CALL refresh_continuous_aggregate('daily_energy', NULL, NULL);
