# UI Design Prompts for Zanari App Redesign

This document contains comprehensive design prompts for redesigning key screens and modals in the Zanari fintech mobile application.

---

## Brand and Colors

**Primary:**
- `#1B4332` (Deep Forest Green)

**Accents:**
- `#52B788` (Vibrant Green - CTAs, success states)
- `#2D6A4F` (Medium Forest Green)
- `#40916C` (Teal Green)
- `#B7E4C7` (Light Mint - on-primary text, hints)
- `#95D5B2` (Pale Green - placeholders)

**Surfaces:**
- `#FFFFFF` (White - cards, modal backgrounds)
- `#F8F9FA` (Light Gray - screen backgrounds)

**Text:**
- `#333333` (Dark Gray - primary text on light)
- `#666666` (Medium Gray - secondary text)
- `#999999` (Light Gray - tertiary text)
- On-primary surfaces: `#B7E4C7` or `#FFFFFF`

**Status Colors:**
- Success: `#52B788`
- Error: `#FF6B6B`
- Warning: `#FFA500`
- Info: `#E3F2FD`

**Overlays:**
- Dark: `rgba(0, 0, 0, 0.5)`
- Light green: `rgba(183, 228, 199, 0.1)` to `rgba(183, 228, 199, 0.3)`

---

## 1. PIN Setup Screen

### Goal
Secure, user-friendly two-step PIN creation with real-time security validation for new users or first-time PIN setup.

### Content

**Step 1: Create PIN**
- Title: "Create your PIN"
- Subtitle: "Choose a secure 4-digit PIN to protect your account"
- 4-dot PIN display (empty → filled as typed)
- Security indicator showing "✓ Secure PIN" or "⚠ Choose a stronger PIN"
- Numeric keypad (1-9, 0, backspace)
- Security tips panel:
  - "Security Tips:" header
  - "Avoid sequential numbers (1234)"
  - "Don't use repeated digits (1111)"
  - "Avoid common patterns"
- Continue button

**Step 2: Confirm PIN**
- Title: "Confirm your PIN"
- Subtitle: "Re-enter your PIN to confirm"
- 4-dot PIN display
- Same keypad
- "Complete Setup" button

### States
- Default: Empty dots, keypad enabled, Continue disabled
- Entering: Dots fill progressively, security indicator appears (Step 1)
- Valid: Security shows green checkmark, Continue enabled
- Invalid: Security shows warning, Continue enabled but will alert
- Confirming: Step 2 active, dots empty
- Mismatch: Alert shown, confirmation field clears, returns to confirm state
- Loading: "Setting up..." on button, all inputs disabled

### Interactions
- `onNumberPress`: Fill next dot, update security validation (Step 1)
- `onBackspace`: Clear last dot
- `onContinue`: Validate PIN → advance to Step 2, or validate match → complete setup
- `onBack`: Step 2 → Step 1 (clears confirmation), or exit flow

### Validation Rules
- Exactly 4 digits
- No sequential (1234, 4321, etc.)
- No repeated (1111, 2222, etc.)
- Not in common list: 1234, 0000, 1111-9999, 1212, 0987, 4321

### UX
- Dark forest green background throughout
- Back button: rounded with light green overlay
- Large touch targets (70px keypad buttons)
- Centered layout with clear hierarchy
- Real-time feedback on security
- Haptic vibration on mismatch
- Security tips visible only on Step 1

---

## 2. PIN Entry Screen

### Goal
Authenticate returning users with PIN verification, attempt tracking, and progressive lockout protection.

### Content
- Logo section: Large "Z" in circle, "Zanari" app name
- Title: "Enter your PIN"
- Subtitle (dynamic):
  - Normal: "Enter your 4-digit PIN to continue"
  - Attempts: "[X] attempts remaining"
  - Locked: "Account locked. Try again in [countdown]" (red, bold)
- PIN input component (4 dots, secure entry, auto-focus)
- "Verifying…" text (during verification)
- "Forgot PIN?" link button

### States
- Default: PIN input enabled, clear instruction
- Entering: Dots fill, auto-submit on 4th digit
- Verifying: "Verifying…" shows, input disabled
- Error: Red error text, attempts counter, input clears
- Locked: Input disabled, countdown timer, red lock message
- Unlocked: Lock expires, error clears, input re-enables

### Error Messages
- Incorrect: "Incorrect PIN. Please try again."
- Locked: "Too many attempts. Try again in [time]."

### Lock Behavior
- Max 3 attempts before lockout
- Progressive delays: 30s → 1m → 5m → 30m
- Countdown formats: "Xs", "Xm Ys", "Xh Ym"
- Updates every second
- Auto-unlocks when timer reaches 0

### Interactions
- `onPinComplete`: Auto-submit when 4 digits entered
- `onBack`: Show logout confirmation dialog
- `onForgotPin`: Show reset confirmation (requires logout)

### Dialog Alerts
- **Logout**: "Are you sure you want to log out? You will need to sign in again." (Cancel | Log Out)
- **Forgot PIN**: "To reset your PIN, you need to log out and log back in. This will verify your identity with OTP. Continue?" (Cancel | Log Out)

### UX
- Dark forest green background
- Logo prominent with shadow elevation
- High contrast white text
- Secure keyboard entry
- Clear error messaging with haptic feedback
- Back button triggers confirmation (prevent accidental logout)

---

## 3. Payment Screen

### Goal
Versatile payment interface supporting merchant payments (till number) and wallet top-ups (M-Pesa/Card), with PIN authorization.

### Content

**Common Elements:**
- Header: Back button, title ("Make Payment" or "Top Up Wallet")
- Amount section: "KES" prefix, large numeric input, hint text
- Payment mode toggle/indication
- Payment method selector: M-Pesa, Airtel Money, Debit Card, Wallet Balance
- Round-up savings section with "NEW" badge, description, example calculation
- Primary CTA button

**Payment Mode:**
- Available balance display ("Available: [amount]")
- Merchant details: Till number input, optional description
- Hint: "Enter amount between KES 10 - KES 500,000"

**Top-up Mode:**
- Top-up details: Optional note input
- Hint: "Enter amount to add to your wallet (KES 10 - KES 500,000)"
- Info text: "💡 You'll pay with [method] to add money to your wallet"

### Payment Methods
Each option card shows:
- Icon (emoji placeholder: 📱 M-Pesa, 💰 Airtel, 💳 Card, 👛 Wallet)
- Name and description
- Radio button (selected = filled green dot)

### States
- Default: Empty amount, no method selected, CTA disabled
- Entering: Amount formats with commas as typed
- Valid: Amount in range, method selected, CTA enabled
- Insufficient (Payment): Alert offers top-up option
- Invalid Till: Alert shows example format
- Loading: "Processing..." on button
- PIN Modal: Overlays for authorization

### Interactions
- `onAmountChange`: Format with commas, validate range
- `onMethodSelect`: Highlight selected, enable CTA when valid
- `onScanQR`: Show "coming soon" alert
- `onPayPress`: Validate → show PIN modal → process payment/top-up
- `onBack`: Return to previous screen

### Validation
- Amount: 10 ≤ amount ≤ 500,000
- Till number: 4-10 digits (payment mode)
- Payment method: Required
- Balance: Must be sufficient (payment mode)

### PIN Modal (Appears on Pay/Top-up)
- Title: "Authorize payment" or "Authorize top-up"
- 4-digit PIN input
- Error handling with attempts counter
- Lock protection with countdown
- Cancel and success callbacks

### UX
- Dark forest green background
- Scrollable content for all fields
- Real-time amount formatting
- Inline validation feedback
- Clear balance display (payment mode)
- Prominent CTA with dynamic text: "Pay KES [amount]" or "Add KES [amount] to Wallet"
- Round-up section educates on micro-savings

---

## 4. KYC Upload Screen

### Goal
Guide users through identity verification by uploading required documents (National ID, Passport, Selfie) with progress tracking and status monitoring.

### Content

**Header:**
- Title: "KYC Verification"
- Subtitle: "Complete your identity verification"

**Progress Indicator:**
- Horizontal bar showing completion: "[X] of [Y] required documents uploaded"
- Visual fill based on uploaded/required ratio

**Status Banner (conditional):**
- Shows when not "draft"
- Icons and text: 📄 Draft, ⏳ Pending, 👁 Under Review, ✓ Approved, ✗ Rejected
- Color-coded: Green (approved), Red (rejected), Orange (pending/review), Gray (draft)

**Information Card:**
- Blue background (`#E3F2FD`)
- "📋 What you need to know" header
- Bullet list: clarity, size limit (5MB), formats (JPG/PNG/PDF), validity, review time (1-3 days)

**Document Type Cards (3):**
1. **National ID** (Required): 🪪 icon, "Government-issued national identification", examples
2. **Passport** (Optional): 🛂 icon, "Valid passport for identification", examples
3. **Selfie** (Required): 🤳 icon, "A clear photo of yourself", examples

Each card shows:
- Icon, title, required badge (if applicable)
- Description
- "Accepted documents:" with examples
- "Uploaded Documents:" list (if any):
  - File name, size, upload date
  - Status badge (colored)
  - Delete button (🗑️)
- Upload button ("📷 Upload Document" or "+ Upload Another")

**Submit Section:**
- Large button: "✓ Submit for Review" (enabled) or "Upload [X] more document(s)" (disabled)
- Only shown in "draft" state

### States
- Draft: Can upload/delete, submit enabled when complete
- Uploading: Loading overlay with spinner and "Uploading document..."
- Submitted: Status banner shows "Pending", upload buttons disabled
- Under Review: Orange status, monitoring phase
- Approved: Green status, verification complete
- Rejected: Red status, can reupload specific documents

### Modals
- **Upload Dialog**: "Take Photo" | "Choose from Gallery" | Cancel
- **Delete Dialog**: Confirmation for document removal
- **Submit Confirmation**: Warning about inability to modify during review
- **Loading Overlay**: Spinner with status text

### Interactions
- `onUpload`: Show source picker → capture/select → upload via signed URL → refresh list
- `onDelete`: Confirm → remove document → update progress
- `onSubmit`: Confirm → submit all → change status → show success

### Document Configuration
- **National ID** (required): Front/back, Digital ID
- **Passport** (optional): Bio-data page
- **Selfie** (required): Clear photo holding ID

### Validation
- At least 2 required documents
- Files under 5MB
- Valid formats (JPG/PNG/PDF)
- Cannot submit during upload
- Cannot modify after submission

### UX
- Light gray background with white cards
- Progress bar prominent at top
- Clear status communication with icons + color
- Upload/delete actions require confirmation
- Loading states block interaction
- Scrollable for smaller screens
- Status badges use color + icons for accessibility

---

## 5. PIN Verification Modal

### Goal
Reusable PIN authorization modal for sensitive actions (payments, transfers, settings changes) with attempt tracking and lockout protection.

### Content
- Title (dynamic): "Enter your PIN", "Authorize payment", "Authorize top-up", etc.
- Subtitle (dynamic): Instruction text or lock message
- PIN input: 4-digit dots, secure entry, auto-focus
- Error message (conditional): Red text below input
- Attempts indicator: "[X] attempts remaining" (shown after failures)
- "Verifying…" text (during API call)
- Cancel button

### States
- Default: Input enabled, clear instruction
- Entering: Dots fill as typed
- Verifying: "Verifying…" shows, input disabled, cancel disabled
- Error: Red message, attempts counter, input clears and re-enables
- Locked: Lock message in subtitle (red), countdown timer, input disabled
- Success: Modal closes, parent receives token

### Lock Countdown
- Updates every second
- Formats: "Xs", "Xm Ys", "Xh Ym"
- Displayed in subtitle and error message
- Clears when lock expires

### Interactions
- `onPinComplete`: Auto-submit when 4 digits entered
- `onCancel`: Close modal, fire cancel callback
- Lock expiration: Auto-clear error, re-enable input

### Security Features
- Max 3 attempts before lockout
- Progressive delays: 30s → 1m → 5m → 30m
- Local PIN hashing for fast verification
- Persisted attempt counter across sessions
- Auto-clear input after each attempt
- Modal blocks background interaction

### Props
```typescript
interface PinVerificationModalProps {
  visible: boolean
  title?: string
  subtitle?: string
  onSuccess: (token: string) => void
  onCancel: () => void
}
```

### UX
- Semi-transparent dark overlay
- White card centered with shadow
- Keyboard-avoiding behavior
- High contrast for error messages
- Large cancel button (min 44px touch target)
- Haptic feedback on errors

---

## Visual and UX Guidance

### Typography
- **Headings:** Bold, 18-28px (screen titles, modal titles)
- **Subheadings:** Semi-bold, 16-18px (section titles)
- **Body:** Regular, 14-16px (descriptions, labels)
- **Small/Hints:** Regular, 12-14px (helper text, metadata)
- **Buttons:** Semi-bold, 15-18px

System fonts: SF Pro (iOS), Roboto (Android), fallback weights: 400, 600, 700

### Spacing
- Extra small: 4px
- Small: 8px
- Medium: 12px
- Large: 16px
- Extra large: 24px
- Section spacing: 32px

### Border Radius
- Small: 8px
- Medium: 12px
- Large: 16px
- Circular: 50%

### Touch Targets
- Minimum: 44×44px (iOS standard)
- Recommended: 48×48px
- Adequate spacing between interactive elements

### CTAs
- Primary: `#52B788` (vibrant green) with white text
- Disabled: Faded green with faded white text
- Destructive: Red text for critical actions
- Loading: Spinner or text state ("Processing...", "Verifying…")

### Inputs
- High contrast fields with clear focus states
- Validation feedback inline (red for errors, green for success)
- Helpful placeholders and labels
- Numeric keyboard for PIN/amount inputs

### Accessibility
- **WCAG AA contrast:** Minimum 4.5:1 for normal text
- **Touch targets:** 44×44px minimum
- **Focus indicators:** Visible on keyboard navigation
- **Screen reader:** Semantic labels for all controls
- **Reduce motion:** Option for animation-sensitive users
- **Error messaging:** Clear, polite, actionable

### Loading and Feedback
- Inline spinners or text states (no blocking overlays except critical operations)
- Minimum 400ms display for perceived reliability
- Haptic/audio feedback on errors
- Success animations (green checkmark)
- Error animations (subtle shake)

### Modals
- Fade in/out (200-300ms)
- Slight scale on entry
- Dark overlay blocks interaction
- Keyboard-aware positioning
- Dismissible via explicit action only

---

## Deliverables

For each screen, provide:

1. **High-fidelity mockups** (375×812px for iPhone X baseline)
2. **Multiple state artboards:**
   - Default/empty
   - Filled/active
   - Loading
   - Error
   - Success
   - Disabled
3. **Interactive prototype** showing state transitions
4. **Component library** with reusable elements (buttons, inputs, cards, modals)
5. **Specifications:**
   - Color hex codes
   - Typography scale (sizes, weights)
   - Spacing values
   - Border radius
   - Shadow/elevation
6. **Responsive considerations** for safe area insets, keyboard, scrollable regions
7. **Rationale** summarizing color usage, hierarchy, input affordances, accessibility choices

---

**END OF DOCUMENT**
