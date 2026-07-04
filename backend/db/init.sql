-- ============================================================
-- Bitshake Smart Meter Dashboard — Database Schema
-- PostgreSQL + TimescaleDB
-- ============================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- Raw meter readings (hypertable — auto-partitioned by time)
-- ============================================================
CREATE TABLE IF NOT EXISTS meter_readings (
    time            TIMESTAMPTZ NOT NULL,
    total_import    DOUBLE PRECISION,   -- 1-0:1.8.0 Total consumption (kWh)
    total_export    DOUBLE PRECISION,   -- 1-0:2.8.0 Total feed-in (kWh)
    power_current   DOUBLE PRECISION,   -- 1-0:16.7.0 Instantaneous power (W)
    power_l1        DOUBLE PRECISION,   -- 1-0:36.7.0 Phase 1 power (W)
    power_l2        DOUBLE PRECISION,   -- 1-0:56.7.0 Phase 2 power (W)
    power_l3        DOUBLE PRECISION,   -- 1-0:76.7.0 Phase 3 power (W)
    solar_energy_daily DOUBLE PRECISION,
    solar_energy_total DOUBLE PRECISION
);

SELECT create_hypertable('meter_readings', 'time', if_not_exists => TRUE);

-- Index for fast latest-reading queries
CREATE INDEX IF NOT EXISTS idx_readings_time_desc ON meter_readings (time DESC);

-- ============================================================
-- User-configurable settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value) VALUES
    ('electricity_price', '0.35'),
    ('enable_feedin_tariff', 'false'),
    ('feedin_tariff', '0.00'),
    ('currency', 'EUR'),
    ('dashboard_refresh_seconds', '10')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Dashboard user (for login)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Continuous Aggregates — pre-computed for fast dashboard queries
-- ============================================================

-- Hourly aggregation
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

-- Daily aggregation
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

-- Auto-refresh policies (refresh every hour for hourly, every day for daily)
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

-- ============================================================
-- Data retention policy — keep all data forever
-- Aggregated data (hourly/daily views) stays forever
-- ============================================================
