-- Additional infrastructure tables for backend services

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_sessions_contact CHECK ((email IS NOT NULL) <> (phone IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

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

CREATE TRIGGER update_auth_sessions_updated_at
  BEFORE UPDATE ON auth_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
