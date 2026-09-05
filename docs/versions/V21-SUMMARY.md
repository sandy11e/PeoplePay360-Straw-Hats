# STEP 21: Payslip PDF and Email Delivery

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(payslip): add pdf and email delivery`

---

## Overview

STEP 21 implemented the **Payslip PDF and Email Delivery** subsystem for PeoplePay360. This subsystem generates official, professional PDF statements from immutable payslip snapshots and provides secure, audited single and bulk email delivery to employees.

**Key Highlights:**
- **In-Memory Vector PDF Generation**: Generates high-fidelity, corporate-grade PDF documents using `pdfkit` purely in memory as Buffers. No temporary files are written to disk, and no browser automation processes (like Puppeteer/Chromium) are spawned.
- **Zero Recalculation Principle**: PDF rendering strictly consumes the finalized payslip and line item records as stored in the database. Payroll amounts and rules are never re-evaluated during document generation.
- **Strict Finalization Guard**: PDFs and email dispatches are permitted only for payslips in `FINAL` status. Attempts to generate PDFs or dispatch emails for `DRAFT` payslips are rejected with `400 PAYSLIP_NOT_FINALIZED`.
- **Safe Filenames & Content-Type**: File downloads use headers `Content-Type: application/pdf` and `Content-Disposition: inline; filename="payslip-..."` with filenames sanitized via regex to eliminate path traversal and invalid characters.
- **Email Service Abstraction**: Built on top of `nodemailer`. SMTP configuration is parsed from environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) with zero hardcoded credentials. Automatically falls back to in-memory mock delivery when SMTP is unconfigured or running in test suites.
- **Delivery Auditing & Provider Confirmation**: Every email dispatch creates a `PayslipDelivery` record in `PENDING` status. The record is only transitioned to `SENT` (with `sentAt` timestamp) once the underlying mail transport confirms successful send. If delivery fails, it is marked `FAILED` with the provider's `errorMessage`.
- **Bulk Email Error Resilience**: Bulk payrun email delivery processes independent recipients in an isolated try-catch loop. A failure for a single recipient (e.g., bounced address or network glitch) does not abort the batch. The endpoint returns aggregate counts (`total`, `sent`, `failed`) and itemized results.
- **RBAC & Employee Isolation**:
  - `GET /api/v1/payslips/:id/pdf`: Accessible by `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER`, or the authenticated `EMPLOYEE` owning the payslip. Unauthorized access returns `403 FORBIDDEN`.
  - `POST /api/v1/payslips/:id/email`: Restricted to `ADMIN` and `PAYROLL_MANAGER`.
  - `POST /api/v1/payruns/:id/email-payslips`: Restricted to `ADMIN` and `PAYROLL_MANAGER`.

---

## Database Schema & Migration

### Migration
- **Name:** `add_payslip_delivery`
- **Migration Directory:** `apps/api/prisma/migrations/20260905151928_add_payslip_delivery/migration.sql`

### 1. Enums

```prisma
enum DeliveryChannel {
  EMAIL
}

enum DeliveryStatus {
  PENDING
  SENT
  FAILED
}
```

### 2. Model: `PayslipDelivery`

```prisma
model PayslipDelivery {
  id           String          @id @default(uuid()) @db.Uuid

  payslipId    String          @map("payslip_id") @db.Uuid
  payslip      Payslip         @relation(fields: [payslipId], references: [id], onDelete: Cascade)

  recipient    String          @db.VarChar(320)
  channel      DeliveryChannel @default(EMAIL)
  status       DeliveryStatus  @default(PENDING)

  sentAt       DateTime?       @map("sent_at") @db.Timestamptz(3)
  errorMessage String?         @map("error_message") @db.VarChar(1000)

  createdAt    DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([payslipId])
  @@index([status])
  @@index([channel])
  @@map("payslip_deliveries")
}
```

---

## Environment Configuration

SMTP configuration in `apps/api/src/config/env.ts`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `SMTP_HOST` | `string?` | `undefined` | SMTP server hostname |
| `SMTP_PORT` | `number?` | `587` | SMTP server port |
| `SMTP_USER` | `string?` | `undefined` | SMTP username |
| `SMTP_PASSWORD` | `string?` | `undefined` | SMTP password (never logged or exposed) |
| `SMTP_FROM` | `string?` | `noreply@peoplepay360.com` | Default sender email address |

---

## API Endpoints

All endpoints are mounted under `/api/v1`.

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/payslips/:id/pdf` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER`, `EMPLOYEE` (own) | Download/stream payslip PDF in memory (`Content-Type: application/pdf`) |
| `POST` | `/payslips/:id/email` | `ADMIN`, `PAYROLL_MANAGER` | Dispatch single payslip PDF to employee email with audit logging |
| `POST` | `/payruns/:id/email-payslips` | `ADMIN`, `PAYROLL_MANAGER` | Bulk email delivery for all finalized payslips in payrun with resilience |

---

## Automated Unit Tests

Automated unit tests in `src/modules/payslips/payslip-delivery.test.ts`:

```
✔ Payslip PDF and Email Delivery Unit Tests > should generate a valid PDF buffer starting with %PDF- magic bytes
✔ Payslip PDF and Email Delivery Unit Tests > should sanitize unsafe characters from payslip filename to prevent path traversal
✔ Payslip PDF and Email Delivery Unit Tests > should send email via EmailService abstraction in mock/test mode
✔ Payslip PDF and Email Delivery Unit Tests > should capture and report delivery error without crashing
✔ Payslip PDF and Email Delivery Unit Tests > should continue bulk processing when an individual recipient fails
```

Full automated unit test suite:
```
✔ Payroll Engine Unit Tests (8 passed)
✔ Payslip PDF and Email Delivery Unit Tests (5 passed)
✔ Payslip Unit Tests (7 passed)
Total tests: 20 passed, 0 failed
```

---

## Integration Verification Results

End-to-end integration verified via `apps/api/src/scripts/verify-payslip-delivery.ts`:

1. **PDF Draft Rejection**: Calling `GET /payslips/:id/pdf` on a `DRAFT` payslip returned `400 PAYSLIP_NOT_FINALIZED`.
2. **Finalized PDF Download**:
   - Finalized payslip.
   - Calling `GET /payslips/:id/pdf` returned `200 OK`.
   - Verified `Content-Type: application/pdf`, `Content-Disposition` with safe filename, and `%PDF-` buffer magic bytes.
3. **RBAC & Ownership Protection**:
   - Employee B attempting to download Employee A's PDF received `403 FORBIDDEN`.
   - Payroll User downloading Employee A's PDF succeeded with `200 OK`.
4. **Single Email Delivery**:
   - Employee triggering email dispatch received `403 FORBIDDEN`.
   - Payroll Manager dispatched email (`200 OK`).
   - Verified database audit record in `PayslipDelivery`: `status: SENT`, recipient, and valid `sentAt` timestamp.
5. **Bulk Email Delivery**:
   - Dispatched bulk emails for payrun (`200 OK`).
   - Verified summary: `total: 10`, `sent: 10`, `failed: 0`.
   - Verified audit records generated in database for every recipient.

---

## Quality Gates Verification

| Check | Command | Result |
| :--- | :--- | :--- |
| **Unit Tests** | `npm test` | ✅ 20 / 20 tests passed |
| **Delivery Integration Suite** | `npx tsx src/scripts/verify-payslip-delivery.ts` | ✅ 5 / 5 scenarios passed |
| **Payslip Integration Suite** | `npx tsx src/scripts/verify-payslips.ts` | ✅ 6 / 6 scenarios passed |
| **TypeScript Typecheck** | `npm run typecheck --workspace=@peoplepay360/api` | ✅ 0 errors |
| **Production Build** | `npm run build --workspace=@peoplepay360/api` | ✅ 0 errors |
| **Monorepo Build** | `npm run build` | ✅ 0 errors across `api` and `web` |
