# STEP 20: Payslip Generation and Employee Self-Service

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(payroll): add payslip generation`

---

## Overview

STEP 20 implemented the **Payslip Generation and Employee Self-Service** subsystem for PeoplePay360. This component bridges payroll engine outputs to verifiable, auditable, and immutable payslip documents that employees can securely view.

**Key Highlights:**
- **Immutable Historical Snapshots**: Payslips permanently snapshot all financial figures (`baseSalary`, `grossAmount`, `totalDeductions`, `netAmount`) and itemized breakdown lines (`PayslipLine`: `salaryRuleCode`, `salaryRuleName`, `category`, `amount`, `sequence`). Future changes or deletions of salary rules and contracts do not alter existing payslips.
- **Strict Employee Isolation**: Authenticated employees can access only their own payslips via `/api/v1/me/payslips` and `/api/v1/me/payslips/:id`. Direct attempts to access another employee's payslip via `/api/v1/payslips/:id` or `/api/v1/me/payslips/:id` are rejected with `403 FORBIDDEN`.
- **Deterministic Numbering & Duplicate Prevention**: Payslip numbers follow the deterministic format `PS-${payrun.code}-${employee.employeeCode}`. Duplicate payslips for the same employee in the same payrun are prevented both by database constraint (`@@unique([payrunId, employeeId])`) and service layer guards.
- **Lifecycle & Status Transition**:
  - `DRAFT`: Generated from payrun calculations, editable/regenerable with `overwriteDrafts: true`.
  - `FINAL`: Locked payslip. Cannot be regenerated or deleted.
  - Payment Status: `UNPAID` ➔ `PROCESSING` ➔ `PAID` / `FAILED`. Only `ADMIN` and `PAYROLL_MANAGER` can modify payment status. Financial amounts and line items are never touched during status transitions.
- **Zero IEEE-754 Floating-Point Math**: Built strictly using PostgreSQL `Decimal` and Prisma `Decimal`.
- **Role-Based Access Control**:
  - `ADMIN` & `PAYROLL_MANAGER`: Generate payslips, view all payslips, update payment status, finalize payslips.
  - `PAYROLL_USER`: Read-only access to all payrun and employee payslips.
  - `EMPLOYEE`: Access strictly scoped to their own payslips.

---

## Database Schema & Migration

### Migration
- **Name:** `add_payslips`
- **Migration Directory:** `apps/api/prisma/migrations/20260905151133_add_payslips/migration.sql`

### 1. Enums

```prisma
enum PaymentStatus {
  UNPAID
  PROCESSING
  PAID
  FAILED
}

enum PayslipStatus {
  DRAFT
  FINAL
}
```

### 2. Model: `Payslip`

```prisma
model Payslip {
  id              String         @id @default(uuid()) @db.Uuid
  payslipNumber   String         @unique @map("payslip_number") @db.VarChar(100)

  payrunId        String         @map("payrun_id") @db.Uuid
  payrun          Payrun         @relation(fields: [payrunId], references: [id], onDelete: Restrict)

  employeeId      String         @map("employee_id") @db.Uuid
  employee        Employee       @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  periodStart     DateTime       @map("period_start") @db.Date
  periodEnd       DateTime       @map("period_end") @db.Date

  baseSalary      Decimal        @map("base_salary") @db.Decimal(12, 2)
  grossAmount     Decimal        @map("gross_amount") @db.Decimal(12, 2)
  totalDeductions Decimal        @map("total_deductions") @db.Decimal(12, 2)
  netAmount       Decimal        @map("net_amount") @db.Decimal(12, 2)

  status          PayslipStatus  @default(DRAFT)
  paymentStatus   PaymentStatus  @default(UNPAID) @map("payment_status")

  lines           PayslipLine[]

  generatedAt     DateTime       @default(now()) @map("generated_at") @db.Timestamptz(3)
  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@unique([payrunId, employeeId])
  @@index([payrunId])
  @@index([employeeId])
  @@index([status])
  @@index([paymentStatus])
  @@index([periodStart])
  @@index([periodEnd])
  @@map("payslips")
}
```

### 3. Model: `PayslipLine`

```prisma
model PayslipLine {
  id             String             @id @default(uuid()) @db.Uuid

  payslipId      String             @map("payslip_id") @db.Uuid
  payslip        Payslip            @relation(fields: [payslipId], references: [id], onDelete: Cascade)

  salaryRuleCode String             @map("salary_rule_code") @db.VarChar(30)
  salaryRuleName String             @map("salary_rule_name") @db.VarChar(120)
  category       SalaryRuleCategory
  amount         Decimal            @db.Decimal(12, 2)
  sequence       Int

  createdAt      DateTime           @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([payslipId])
  @@index([category])
  @@index([sequence])
  @@map("payslip_lines")
}
```

---

## Business Rules & Invariants

| Rule | Description | Error Code / Behavior |
| :--- | :--- | :--- |
| **Payrun Calculation Prerequisite** | Payslips can only be generated for payruns in `CALCULATED` or `VALIDATED` status. `DRAFT` or `CANCELLED` payruns are rejected. | `400 PAYRUN_NOT_CALCULATED` / `400 PAYRUN_CANCELLED` |
| **Duplicate Prevention** | Payslips cannot be regenerated for an already processed payrun unless `overwriteDrafts: true` is passed for draft payslips. | `409 PAYSLIPS_ALREADY_GENERATED` |
| **Finalized Immutability** | Payslips in `FINAL` status cannot be overwritten or recalculated. | `409 PAYSLIPS_ALREADY_FINALIZED` |
| **Employee Self-Service Isolation** | Authenticated employees may only view their own payslips via `/api/v1/me/payslips` or `/api/v1/me/payslips/:id`. Attempting to access another employee's payslip returns forbidden. | `403 FORBIDDEN` |
| **Role-Based General Access** | `ADMIN`, `PAYROLL_MANAGER`, and `PAYROLL_USER` can view any payslip. | Handled via RBAC |
| **Payment Status Updates** | Only `ADMIN` and `PAYROLL_MANAGER` can change `paymentStatus` or transition `status: FINAL`. Financial figures are never modified during payment status updates. | `403 FORBIDDEN` |
| **Snapshot Independence** | Line items copy rule codes, rule names, and amounts. Future salary rule modifications have zero effect on existing payslips. | Enforced via isolated copy |

---

## API Endpoints

All endpoints are mounted under `/api/v1`.

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/payruns/:id/payslips` | `ADMIN`, `PAYROLL_MANAGER` | Generate payslips for a calculated or validated payrun |
| `GET` | `/payruns/:id/payslips` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER` | List payslips for a payrun with pagination & search |
| `GET` | `/payslips/:id` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER`, `EMPLOYEE` (own) | Get payslip details and lines by ID |
| `GET` | `/me/payslips` | Any user with linked `Employee` | List employee's own payslips |
| `GET` | `/me/payslips/:id` | Any user with linked `Employee` | Get single employee's own payslip |
| `PATCH` | `/payslips/:id/payment-status` | `ADMIN`, `PAYROLL_MANAGER` | Update payment status (`UNPAID`, `PROCESSING`, `PAID`, `FAILED`) and finalize |

---

## Automated Unit Tests

Automated unit tests in `src/modules/payslips/payslip.test.ts`:

```
✔ Payslip Unit Tests > should faithfully map and snapshot salary rule line items into payslip lines
✔ Payslip Unit Tests > should enforce mathematical invariant: netAmount = grossAmount - totalDeductions
✔ Payslip Unit Tests > should preserve exact Decimal precision without IEEE-754 floating-point drift
✔ Payslip Unit Tests > should enforce employee isolation: employees cannot view another employee's payslip
✔ Payslip Unit Tests > should ensure future salary rule edits do not alter snapshotted payslips
✔ Payslip Unit Tests > should prevent duplicate generation and protect finalized payslips
✔ Payslip Unit Tests > should ensure payment status transitions do not mutate financial amounts
```

Total test suite across payroll & payslips:
```
✔ Payroll Engine Unit Tests (8 passed)
✔ Payslip Unit Tests (7 passed)
Total tests: 15 passed, 0 failed
```

---

## Integration Verification Results

End-to-end integration verified via `apps/api/src/scripts/verify-payslips.ts`:

1. **Payslip Generation**: Generated payslips for payrun. Verified count, unique number `PS-PR-PS-...-EMP-PS-A`, gross ($5,750), net ($5,500), and 3 breakdown lines.
2. **Duplicate Prevention**: Re-generating without `overwriteDrafts` returned `409 PAYSLIPS_ALREADY_GENERATED`. Re-generating with `overwriteDrafts: true` replaced drafts successfully.
3. **Employee Isolation**:
   - Alice retrieved her own payslips via `/me/payslips` and `/me/payslips/:id`.
   - Bob attempting to view Alice's payslip via `/me/payslips/:id` received `403 FORBIDDEN`.
   - Bob attempting to view Alice's payslip via `/payslips/:id` received `403 FORBIDDEN`.
   - Payroll User reading Alice's payslip succeeded with `200 OK`.
4. **Payment Status Transition**:
   - Employee updating payment status received `403 FORBIDDEN`.
   - Payroll Manager transitioned status to `PROCESSING` and `FINAL` (`200 OK`).
   - Updated status to `PAID` (`200 OK`).
5. **Finalized Immutability**:
   - Overwrite attempts against finalized payslips returned `409 PAYSLIPS_ALREADY_FINALIZED`.
6. **Snapshot Immunity**:
   - Modified underlying salary rule in the database.
   - Re-fetched payslip: Verified line item preserved historical rule name and amount without corruption.

---

## Quality Gates Verification

| Check | Command | Result |
| :--- | :--- | :--- |
| **Unit Tests** | `npm test` | ✅ 15 / 15 tests passed |
| **Integration Suite** | `npx tsx src/scripts/verify-payslips.ts` | ✅ 6 / 6 scenarios passed |
| **TypeScript Typecheck** | `npm run typecheck --workspace=@peoplepay360/api` | ✅ 0 errors |
| **Production Build** | `npm run build --workspace=@peoplepay360/api` | ✅ 0 errors |
| **Monorepo Build** | `npm run build` | ✅ 0 errors across `api` and `web` |
