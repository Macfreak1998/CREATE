DROP TABLE IF EXISTS password_resets;
ALTER TABLE users DROP COLUMN IF EXISTS token_version;
