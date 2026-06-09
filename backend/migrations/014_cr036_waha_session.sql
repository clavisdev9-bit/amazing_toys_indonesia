-- CR-036: Seed wa_waha_session key in system_settings.
-- Additive only — DO NOT drop or rename existing rows.
INSERT INTO system_settings (key, value, updated_at)
VALUES ('wa_waha_session', '"default"', NOW())
ON CONFLICT (key) DO NOTHING;
