-- Ensure KYC documents have created_at/updated_at columns required by the API layer
ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Maintain updated_at automatically for future updates
DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON kyc_documents;

CREATE TRIGGER update_kyc_documents_updated_at
BEFORE UPDATE ON kyc_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
