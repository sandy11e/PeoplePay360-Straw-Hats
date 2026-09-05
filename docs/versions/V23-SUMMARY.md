# STEP 23: Audit Logging and Security Hardening

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(audit): add audit logging and api hardening`

---

## Overview

STEP 23 implemented the **Audit Logging and Security Hardening** subsystem for PeoplePay360. This subsystem establishes complete traceability of sensitive administrative, HR, contract, and payroll operations, guarantees append-only audit data immutability, and hardens the API against information leakage, privilege escalation, and session hijacking.

**Key Highlights:**
- **AuditLog Model & Migration**: Normalized relational model with actor tracing, entity identification, action classification, client IP/UserAgent capture, and sanitized JSON metadata.
- **Append-Only Architecture**: Strictly no `UPDATE` or `DELETE` endpoints for audit logs through APIs.
- **Strict Secret Omission**: Zero logging of plaintext passwords, password hashes, access JWTs, refresh tokens, refresh token hashes, SMTP credentials, `DATABASE_URL`, or `JWT_SECRET`.
- **Comprehensive Action Instrumentation**: Audited user creation, role changes, activation toggles, password resets, employee updates, employment status changes, contract creation/updates/status changes, leave approval/rejection, salary rule creation/updates, payrun calculation/validation, payslip payment status updates, and email deliveries.
- **Centralized Security Error Middleware**: Generic sanitized 500 errors to clients, suppression of stack traces in production, and mapping of Prisma unique (`P2002`), foreign key (`P2003`), and not-found (`P2025`) errors to standard HTTP status codes without leaking SQL queries or table schema.
- **Immediate Inactive User Invalidation**: Real-time database verification of `user.isActive` in `requireAuth` immediately blocks deactivated accounts from using unexpired access tokens.
- **Role Escalation Protection**: Prevents administrative self-role changes and unauthorized escalation.
- **Graceful Shutdown**: Intercepts `SIGINT` and `SIGTERM` signals to cleanly close the HTTP server and await `prisma.$disconnect()`.

---

## Database Schema & Migration

### Migration
- **Name:** `add_audit_logs`
- **Migration Directory:** `apps/api/prisma/migrations/20260905154409_add_audit_logs/migration.sql`

### Prisma Model:
```prisma
model AuditLog {
  id          String    @id @default(uuid()) @db.Uuid

  actorUserId String?   @map("actor_user_id") @db.Uuid
  actorUser   User?     @relation("UserAuditLogs", fields: [actorUserId], references: [id], onDelete: SetNull)

  action      String    @db.VarChar(100)
  entityType  String    @map("entity_type") @db.VarChar(50)
  entityId    String?   @map("entity_id") @db.VarChar(100)

  metadata    Json?
  ipAddress   String?   @map("ip_address") @db.VarChar(45)
  userAgent   String?   @map("user_agent") @db.VarChar(500)

  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([actorUserId])
  @@index([action])
  @@index([entityType])
  @@index([entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## Audited Actions Matrix

| Domain | Action Code | Entity Type | Trigger | Safe Metadata Recorded |
| :--- | :--- | :--- | :--- | :--- |
| **Users** | `USER_CREATED` | `User` | User creation via POST `/users` | `email`, `role`, `isActive` |
| **Users** | `USER_ROLE_CHANGED` | `User` | Admin modifying user role | `previousRole`, `newRole` |
| **Users** | `USER_DEACTIVATED` / `USER_REACTIVATED` | `User` | Toggling `isActive` | `email`, `previousActive`, `newActive` |
| **Users** | `PASSWORD_RESET` | `User` | Admin resetting password | `email`, `initiatedByAdmin` (NO passwords/hashes) |
| **Employees** | `EMPLOYEE_UPDATED` | `Employee` | Updating employee details | `employeeCode`, `updatedFields` |
| **Employees** | `EMPLOYMENT_STATUS_CHANGED` | `Employee` | Updating employment status | `employeeCode`, `previousStatus`, `newStatus` |
| **Contracts** | `CONTRACT_CREATED` | `EmployeeContract` | Creating draft contract | `contractNumber`, `employeeId`, `startDate`, `status` |
| **Contracts** | `CONTRACT_UPDATED` | `EmployeeContract` | Modifying contract parameters | `contractNumber`, `updatedFields` |
| **Contracts** | `CONTRACT_STATUS_CHANGED` | `EmployeeContract` | Transitioning contract status | `contractNumber`, `previousStatus`, `newStatus` |
| **Leave** | `LEAVE_REQUEST_APPROVED` | `LeaveRequest` | HR/Admin approving leave | `employeeId`, `leaveTypeId`, `requestedDays`, `comment` |
| **Leave** | `LEAVE_REQUEST_REJECTED` | `LeaveRequest` | HR/Admin rejecting leave | `employeeId`, `leaveTypeId`, `requestedDays`, `comment` |
| **Salary Rules** | `SALARY_RULE_CREATED` | `SalaryRule` | Adding rule to structure | `structureId`, `code`, `name`, `category`, `calculationType` |
| **Salary Rules** | `SALARY_RULE_UPDATED` | `SalaryRule` | Modifying existing rule | `structureId`, `code`, `name`, `updatedFields` |
| **Payroll** | `PAYRUN_CALCULATED` | `Payrun` | Calculating payrun | `code`, `periodStart`, `periodEnd`, `status`, `employeeCount` |
| **Payroll** | `PAYRUN_VALIDATED` | `Payrun` | Locking payrun | `code`, `status`, `validatedAt` |
| **Payslips** | `PAYSLIP_PAYMENT_STATUS_UPDATED` | `Payslip` | Changing payment status | `payslipNumber`, `paymentStatus` |
| **Payslips** | `PAYSLIP_EMAIL_SENT` | `Payslip` | Sending individual payslip | `recipient`, `status`, `deliveryId` |
| **Payslips** | `PAYSLIP_BULK_EMAIL_COMPLETED` | `Payrun` | Delivering batch payrun emails | `total`, `sent`, `failed` |

---

## API Endpoints

All endpoints are mounted under `/api/v1`.

| Endpoint | Method | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `/audit-logs` | `GET` | `ADMIN` ONLY | Paginated and filtered query of system audit logs |
| `/audit-logs/*` | `PUT`, `PATCH`, `DELETE` | **NONE** | Excluded by design (Returns `404 NOT_FOUND`) |

### Supported Audit Log Filters:
- `page`: Page index (default: `1`)
- `pageSize`: Items per page (default: `20`, max: `100`)
- `action`: Exact string filter on action code (e.g. `USER_ROLE_CHANGED`)
- `entityType`: Exact string filter on entity type (e.g. `User`, `Employee`)
- `entityId`: Exact string filter on entity ID
- `actorUserId`: UUID filter for specific performing user
- `startDate`: Filter logs created on or after date/datetime
- `endDate`: Filter logs created on or before date/datetime

---

## Security Hardening Details

1. **Zero Secret Leakage**:
   `sanitizeAuditMetadata` recursively traverses all metadata values. Any key matching `/password/i`, `/token/i`, `/jwt/i`, `/secret/i`, `/cookie/i`, `/database_url/i`, `/smtp/i`, or `/credentials/i` is immediately stripped. String values resembling JWT tokens or database connection URIs are redacted with `[REDACTED_SECRET]`.
2. **Centralized Error Middleware**:
   - `P2002` (Prisma unique constraint failure) returns `409 CONFLICT` without dumping raw database constraints, columns, or table names.
   - `P2025` (Record not found) returns `404 NOT_FOUND`.
   - `P2003` (Foreign key constraint violation) returns `409 FOREIGN_KEY_VIOLATION`.
   - Malformed JSON returns `400 MALFORMED_JSON`.
   - Oversized payloads return `413 PAYLOAD_TOO_LARGE`.
   - 500 errors log server-side but return generic `{ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } }` without stack traces.
3. **Session & Auth Security**:
   - `requireAuth` verifies `user.isActive` against the database in real-time, instantly blocking deactivated accounts even if their JWT access token has not expired.
   - Refresh token reuse continues to invalidate the entire token family.
4. **Graceful Shutdown**:
   - On `SIGTERM` / `SIGINT`, the HTTP server closes all connections and awaits `prisma.$disconnect()` before terminating the process.

---

## Verification & Automated Testing

### Unit Tests
Automated unit tests in `apps/api/src/modules/audit/audit.test.ts`:
- ✅ Sensitive key detection across casing, delimiters, and naming conventions.
- ✅ Deep object and array stripping of credentials.
- ✅ Redaction of raw JWT strings and database URIs placed in safe key names.
- ✅ Client info extraction with safe truncation (IPv6 / User-Agent).
- ✅ Append-only architecture enforcement (absence of `PUT`, `PATCH`, `DELETE` routes).
- ✅ Error middleware mapping (`P2002`, `P2025`, `400 MALFORMED_JSON`, `413 PAYLOAD_TOO_LARGE`, `500` stack trace suppression).

### Integration Test Script
Run with `npx tsx src/scripts/verify-audit.ts`:
- ✅ Test 1: RBAC on `GET /api/v1/audit-logs` (ADMIN allowed, HR/Employee rejected).
- ✅ Test 2: Append-only protection (mutation routes rejected with `404`).
- ✅ Test 3: User creation audited without passwords or password hashes.
- ✅ Test 4: Role escalation protection (self role change blocked) and role change audited.
- ✅ Test 5: User deactivation audited and token instantly rejected (`ACCOUNT_DISABLED`).
- ✅ Test 6: Password reset audited without leaking credentials.
- ✅ Test 7: Error middleware sanitization and SQL/Prisma masking verified.
