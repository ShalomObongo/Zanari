-- Ensure backend-only support tables exist for PIN validation and retry queue

CREATE TABLE IF NOT EXISTS pin_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_tokens_user_id ON pin_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_pin_tokens_expires_at ON pin_tokens(expires_at);

CREATE TABLE IF NOT EXISTS retry_jobs (
  id TEXT PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retry_jobs_run_at ON retry_jobs(run_at);
