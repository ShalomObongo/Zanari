-- Seed script to create KYC storage bucket with RLS policies

-- Create KYC storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc',
  'kyc',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own KYC documents
CREATE POLICY "Users can upload own KYC documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own KYC documents
CREATE POLICY "Users can view own KYC documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own KYC documents
CREATE POLICY "Users can update own KYC documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own KYC documents
CREATE POLICY "Users can delete own KYC documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Service role has full access to all KYC documents
CREATE POLICY "Service role has full access to KYC"
ON storage.objects
TO service_role
USING (bucket_id = 'kyc')
WITH CHECK (bucket_id = 'kyc');
