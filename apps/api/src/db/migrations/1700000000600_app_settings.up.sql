CREATE TABLE app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('admin_notification_email', NULL)
ON CONFLICT DO NOTHING;
