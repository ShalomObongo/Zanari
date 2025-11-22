# Module: KYC (Know Your Customer)

This module handles identity verification, ensuring compliance with financial regulations. It manages document uploads, status tracking, and access control based on verification levels.

## User Journey

1.  **Prompt**: New users or those hitting transaction limits are prompted to "Verify Identity".
2.  **Document Selection**: User chooses a document type (National ID, Passport) and is required to take a Selfie.
3.  **Upload**:
    -   User takes a photo or picks from the gallery.
    -   The app uploads the file securely to the backend.
4.  **Review**: The status changes to "Pending Review".
5.  **Approval/Rejection**:
    -   **Approved**: User gets a notification, and limits are lifted.
    -   **Rejected**: User gets feedback (e.g., "Image blurry") and can retry.

## Backend Implementation

### Service: `KYCService` (`api/src/services/KYCService.ts`)
Manages the `kyc_documents` records.

-   **`uploadDocument(input)`**:
    -   Creates a record with status `uploaded`.
    -   Generates a secure file path.
    -   Prevents duplicate uploads of the same type if already approved.
-   **`updateStatus(input)`**:
    -   Transitions status (`uploaded` -> `processing` -> `approved`/`rejected`).
    -   Triggers notifications via `NotificationService`.
-   **`listDocuments(userId)`**: Returns all documents for the user.

### Routes (`api/src/routes/kyc.ts`)
Handles the HTTP interface and secure URL generation.

-   **`POST /kyc/documents`**:
    -   **Rate Limiting**: Tracks attempts per document type (Max 3).
    -   **Validation**: Checks MIME type (JPEG/PNG/PDF) and file size (Max 10MB).
    -   **Signed URLs**: Returns a `signed_upload_url` for the frontend to upload the binary data directly to storage (Supabase Storage), bypassing the API server for the heavy lift.
    -   **Audit Trail**: Captures IP, Device Model, and Geo-location.

### Data Model

-   **`kyc_documents` Table**:
    -   `document_type`: Enum (`national_id`, `passport`, `selfie`).
    -   `status`: Enum (`uploaded`, `processing`, `approved`, `rejected`).
    -   `file_path`: Path in storage bucket.
    -   `verification_notes`: Feedback from admin/system.
    -   `encrypted`: Boolean flag (files are encrypted at rest).

## Frontend Implementation

### Screen: `KYCUploadScreen` (`src/screens/kyc/KYCUploadScreen.tsx`)
A comprehensive UI for managing the verification process.

-   **Progress Tracking**: Shows "X of Y required documents uploaded".
-   **Status Banner**: Displays current state (Draft, Under Review, Approved, Rejected).
-   **Upload Logic**:
    -   Uses `expo-image-picker` for Camera/Gallery access.
    -   Requests a signed URL from the backend.
    -   (In a full implementation) Uploads the binary to the signed URL.
-   **Submission**: Once required docs (ID + Selfie) are present, the user clicks "Submit for Review", locking the documents from further edits.

### State Integration
-   **`authStore`**: Tracks the user's overall `kyc_status` (`not_started`, `pending`, `approved`).
-   **Access Control**: Certain features (e.g., high-value transfers) check `user.kyc_status` before proceeding.

## API Endpoints

-   `GET /kyc/documents`: List uploaded docs and their status.
-   `POST /kyc/documents`: Initiate an upload (get signed URL).
