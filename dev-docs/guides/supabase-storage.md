# Supabase Storage & RLS Configuration

Complete guide for configuring Row Level Security (RLS) policies for the KYC document storage bucket.

**Project:** Zanari2  
**Supabase Project ID:** razxakoknasqvafsxzxl  
**Storage Bucket:** `kyc`

---

## 📋 Overview

The `kyc` storage bucket is used to store Know Your Customer (KYC) documents uploaded by users during identity verification. Proper RLS policies ensure users can only access their own documents.

**Security Requirements:**
- Users can only view/upload/update their own documents
- File paths follow pattern: `{user_id}/{document_type}/{filename}`
- Supported file types: JPEG, PNG, PDF
- Maximum file size: 10MB per document

---

## ✅ Current Status

- ✅ Bucket `kyc` created via Management API
- ✅ File size limit: 10MB
- ✅ Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`
- ⏳ RLS policies need manual configuration in dashboard

---

## 🔧 RLS Policy Configuration

### Option 1: Via Supabase Dashboard (Recommended)

#### Steps:

1. **Access Storage Settings**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard/project/razxakoknasqvafsxzxl)
   - Navigate to **Storage** → **Policies** (or click **Policies** under the `kyc` bucket)

2. **Add SELECT Policy (View Documents)**
   - Click **New Policy** under the `kyc` bucket
   - Select **Create policy from scratch**
   - Fill in:
     ```
     Policy Name: Users can view their own documents
     Allowed Operation: SELECT
     Target Roles: authenticated
     USING expression: 
       (storage.foldername(name))[1] = auth.uid()::text
     ```
   - Click **Review** → **Save Policy**

3. **Add INSERT Policy (Upload Documents)**
   - Click **New Policy**
   - Fill in:
     ```
     Policy Name: Users can upload their own documents
     Allowed Operation: INSERT
     Target Roles: authenticated
     WITH CHECK expression:
       (storage.foldername(name))[1] = auth.uid()::text
     ```
   - Click **Review** → **Save Policy**

4. **Add UPDATE Policy (Replace Documents)**
   - Click **New Policy**
   - Fill in:
     ```
     Policy Name: Users can update their own documents
     Allowed Operation: UPDATE
     Target Roles: authenticated
     USING expression:
       (storage.foldername(name))[1] = auth.uid()::text
     WITH CHECK expression:
       (storage.foldername(name))[1] = auth.uid()::text
     ```
   - Click **Review** → **Save Policy**

5. **Add DELETE Policy (Remove Documents)**
   - Click **New Policy**
   - Fill in:
     ```
     Policy Name: Users can delete their own documents
     Allowed Operation: DELETE
     Target Roles: authenticated
     USING expression:
       (storage.foldername(name))[1] = auth.uid()::text
     ```
   - Click **Review** → **Save Policy**

---

### Option 2: Via SQL Editor (Alternative)

If you prefer SQL, you can also create these policies via the **SQL Editor**:

```sql
-- Policy 1: Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can upload their own documents
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can update their own documents
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**To Execute:**
1. Go to **SQL Editor** in Supabase Dashboard
2. Paste the SQL above
3. Click **Run** (⌘+Enter or Ctrl+Enter)
4. Verify all 4 policies created successfully

---

## 🧪 Testing RLS Policies

### Test 1: Upload Document

```typescript
import { supabase } from './config/supabase';

// User must be authenticated
const { data: { user } } = await supabase.auth.getUser();

if (!user) throw new Error('Not authenticated');

// Upload document
const file = {
  uri: 'file:///path/to/national_id.jpg',
  name: 'national_id.jpg',
  type: 'image/jpeg'
};

const filePath = `${user.id}/national_id/national_id_front.jpg`;

const { data, error } = await supabase.storage
  .from('kyc')
  .upload(filePath, file);

if (error) {
  console.error('Upload failed:', error);
} else {
  console.log('Upload successful:', data);
}
```

### Test 2: Retrieve Document URL

```typescript
// Get public URL for uploaded document
const { data } = supabase.storage
  .from('kyc')
  .getPublicUrl(`${user.id}/national_id/national_id_front.jpg`);

console.log('Document URL:', data.publicUrl);

// Note: This URL still respects RLS policies when accessed
```

### Test 3: Download Document

```typescript
// Download document (respects RLS)
const { data, error } = await supabase.storage
  .from('kyc')
  .download(`${user.id}/national_id/national_id_front.jpg`);

if (error) {
  console.error('Download failed:', error);
} else {
  console.log('Downloaded blob:', data);
}
```

### Test 4: Verify Access Denied for Other Users

```typescript
// Try to access another user's document (should fail)
const otherUserId = '00000000-0000-0000-0000-000000000000';

const { data, error } = await supabase.storage
  .from('kyc')
  .download(`${otherUserId}/national_id/national_id_front.jpg`);

// Should return error: "new row violates row-level security policy"
console.assert(error !== null, 'RLS should block access to other users files');
```

---

## 📁 File Path Convention

All KYC documents must follow this path structure:

```
{user_id}/{document_type}/{filename}
```

**Examples:**

```
550e8400-e29b-41d4-a716-446655440000/national_id/id_front.jpg
550e8400-e29b-41d4-a716-446655440000/national_id/id_back.jpg
550e8400-e29b-41d4-a716-446655440000/passport/passport_photo_page.pdf
550e8400-e29b-41d4-a716-446655440000/proof_of_address/utility_bill.pdf
```

**Document Types:**
- `national_id` - National ID cards
- `passport` - Passport documents
- `drivers_license` - Driver's licenses
- `proof_of_address` - Utility bills, bank statements
- `selfie` - Selfie with ID for verification

---

## 🔐 Security Considerations

### 1. Private Bucket Configuration

The `kyc` bucket should be **private** (not public):
- ✅ Ensures RLS policies are enforced
- ✅ Documents require authentication to access
- ❌ Public buckets bypass RLS entirely

**Verify in Dashboard:**
- Storage → kyc bucket → Settings
- **Public bucket** toggle should be **OFF**

### 2. File Size Validation

```typescript
// Client-side validation before upload
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
  throw new Error('File exceeds 10MB limit');
}
```

### 3. MIME Type Validation

```typescript
// Validate file type before upload
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.');
}
```

### 4. Filename Sanitization

```typescript
// Sanitize filename to prevent path traversal
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Remove special chars
    .replace(/\.+/g, '.') // Collapse multiple dots
    .replace(/^\./, '') // Remove leading dot
    .slice(0, 100); // Limit length
}

const safeName = sanitizeFilename(userProvidedFilename);
const filePath = `${user.id}/national_id/${safeName}`;
```

---

## 📊 Monitoring & Maintenance

### Storage Usage

Monitor bucket usage via SQL:

```sql
-- Get total storage used per user
SELECT 
  (storage.foldername(name))[1] as user_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'kyc'
GROUP BY user_id
ORDER BY total_bytes DESC;
```

### Recent Uploads

```sql
-- View recent KYC uploads
SELECT 
  name,
  created_at,
  metadata->>'mimetype' as mime_type,
  pg_size_pretty((metadata->>'size')::bigint) as file_size
FROM storage.objects
WHERE bucket_id = 'kyc'
ORDER BY created_at DESC
LIMIT 20;
```

### Failed Upload Attempts

Check Supabase logs for RLS violations:
1. Go to **Logs** → **Postgres**
2. Filter by `severity: ERROR`
3. Look for "new row violates row-level security policy"

---

## 🆘 Troubleshooting

### Error: "new row violates row-level security policy"

**Cause:** User trying to upload to path that doesn't match their user ID

**Solution:** Ensure file path starts with `{user.id}/`

```typescript
// ❌ WRONG - Missing user ID
const filePath = 'national_id/id_front.jpg';

// ✅ CORRECT - Includes user ID
const filePath = `${user.id}/national_id/id_front.jpg`;
```

### Error: "Bucket not found"

**Cause:** Bucket name mismatch or bucket doesn't exist

**Solution:** Verify bucket name is exactly `kyc` (case-sensitive)

```typescript
// ❌ WRONG - Incorrect bucket name
await supabase.storage.from('KYC').upload(...);

// ✅ CORRECT
await supabase.storage.from('kyc').upload(...);
```

### Error: "JWT expired"

**Cause:** User's authentication token expired

**Solution:** Refresh the session before upload

```typescript
const { data: { session }, error } = await supabase.auth.refreshSession();

if (error || !session) {
  // Re-authenticate user
  await supabase.auth.signOut();
  // Redirect to login
}
```

### Error: "Payload too large"

**Cause:** File exceeds 10MB limit

**Solution:** Compress image or reject file

```typescript
// For React Native, use react-native-image-resizer
import ImageResizer from 'react-native-image-resizer';

const resizedImage = await ImageResizer.createResizedImage(
  imageUri,
  1920, // max width
  1920, // max height
  'JPEG',
  80, // quality
  0, // rotation
  null,
  false,
  { mode: 'contain', onlyScaleDown: true }
);

// Now upload resizedImage.uri
```

---

## 📝 Integration Checklist

Before going to production:

- [ ] RLS policies created for SELECT, INSERT, UPDATE, DELETE
- [ ] Tested file upload with authenticated user
- [ ] Tested access denial for other users' files
- [ ] Verified bucket is private (not public)
- [ ] Implemented file size validation (10MB limit)
- [ ] Implemented MIME type validation (JPEG, PNG, PDF)
- [ ] Implemented filename sanitization
- [ ] Set up monitoring for storage usage
- [ ] Documented file path conventions for team
- [ ] Tested file deletion/replacement flow

---

## 🔗 Related Resources

- **Supabase Storage Docs:** https://supabase.com/docs/guides/storage
- **RLS Overview:** https://supabase.com/docs/guides/auth/row-level-security
- **Storage RLS Examples:** https://supabase.com/docs/guides/storage/security/access-control
- **React Native File Upload:** https://supabase.com/docs/reference/javascript/storage-from-upload

---

**Setup Complete! 🎉**

Once RLS policies are configured, your KYC document storage will be secure and production-ready.
