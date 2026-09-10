ALTER TABLE users
  ADD COLUMN token_version int NOT NULL DEFAULT 0;

CREATE TABLE password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_resets_user_id_idx    ON password_resets (user_id);
CREATE INDEX password_resets_expires_at_idx ON password_resets (expires_at);
