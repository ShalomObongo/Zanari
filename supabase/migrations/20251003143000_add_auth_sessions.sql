-- Create table to persist OTP authentication sessions for phone/email login flows
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NULL,
  phone TEXT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_sessions_contact_check CHECK (
    (email IS NOT NULL AND phone IS NULL)
    OR (email IS NULL AND phone IS NOT NULL)
  )
);

-- Ensure recently inserted sessions are easy to query
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_email ON auth_sessions (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_phone ON auth_sessions (phone) WHERE phone IS NOT NULL;

-- Maintain updated_at automatically
CREATE TRIGGER update_auth_sessions_updated_at
  BEFORE UPDATE ON auth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auth sessions are server-managed only; disable RLS to avoid unexpected client access requirements
ALTER TABLE auth_sessions DISABLE ROW LEVEL SECURITY;
