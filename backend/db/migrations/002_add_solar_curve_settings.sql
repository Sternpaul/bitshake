-- Insert default solar curve settings if they don't exist
INSERT INTO settings (key, value) VALUES
    ('solar_east_capacity', '800'),
    ('solar_south_capacity', '650'),
    ('solar_east_peak_hour', '9.5'),
    ('solar_south_peak_hour', '12.5'),
    ('solar_east_curve_width', '3.0'),
    ('solar_south_curve_width', '3.0')
ON CONFLICT (key) DO NOTHING;
