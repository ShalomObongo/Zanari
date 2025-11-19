-- Add created_at/updated_at columns for KYC documents to match domain model
ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Keep updated_at in sync automatically
DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON kyc_documents;

CREATE TRIGGER update_kyc_documents_updated_at
BEFORE UPDATE ON kyc_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
