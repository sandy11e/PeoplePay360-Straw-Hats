# STEP 19: Payroll Engine and Payruns

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(payroll): add payroll calculation engine`

---

## Overview

STEP 19 implemented the core **Payroll Engine and Payruns** subsystem for PeoplePay360. This phase is payroll-critical: all calculations are strictly deterministic, testable, and auditable.

**Key Highlights:**
- **Deterministic Pure Calculation Engine**: A dedicated calculation function `calculateEmployeePayroll` evaluates ordered earnings and deductions using pure mathematical logic and zero dynamic code execution (`no eval()`).
- **Complete Monetary Precision (No Floating-Point)**: Built entirely using PostgreSQL `Decimal` and Prisma `Decimal`. All intermediate amounts, percentages, base salaries, gross earnings, total deductions, and net pay are computed and rounded to 2 decimal places using fixed-point arithmetic (`Decimal.ROUND_HALF_UP`), eliminating IEEE-754 precision loss.
- **Historical Immutability & Audit Snapshots**: Contract terms and active salary structure rules are permanently snapshotted into JSON columns (`contractSnapshot` and `salaryStructureSnapshot`) alongside itemized breakdown line items (`lineItems`). Future changes to salary rules or employee contracts never mutate previously calculated or validated payruns.
- **Payrun Lifecycle & State Machine**:
  - `DRAFT`: Initial period definition (`periodStart <= periodEnd`).
  - `CALCULATED`: Populated with calculated employee payroll records, line items, and aggregate totals. Repeatable calculations are allowed in both `DRAFT` and `CALCULATED` states.
  - `VALIDATED`: Approved and locked. Validated payruns are strictly immutable; recalculation and cancellation are forbidden.
  - `CANCELLED`: Voided payrun. Only non-validated payruns can be cancelled.
- **Fault-Tolerant Warning System**: Missing contracts or unassigned salary structures do not silently corrupt the payrun. Instead, structured warnings are recorded per employee (`warnings` array and `warningCount`), gross/deduction/net are safely set to `0.00`, and the entire payrun transaction proceeds cleanly.
- **Least-Privilege Role-Based Access Control**:
  - `ADMIN`: Full access to create, calculate, validate, and cancel payruns.
  - `PAYROLL_MANAGER`: Create, calculate, and validate payruns.
  - `PAYROLL_USER`: Read-only access and operational draft calculation; strictly forbidden from validating payruns.
  - `HR_MANAGER` / `EMPLOYEE`: Access restricted.

---

## Database Schema & Migration

### Migration
- **Name:** `add_payruns`
- **Migration Directory:** `apps/api/prisma/migrations/20260905150104_add_payruns/migration.sql`

### 1. Enums

```prisma
enum PayrunStatus {
  DRAFT
  CALCULATED
  VALIDATED
  CANCELLED
}
```

### 2. Model: `Payrun`

```prisma
model Payrun {
  id              String         @id @default(uuid()) @db.Uuid
  code            String         @unique @db.VarChar(50)
  periodStart     DateTime       @map("period_start") @db.Date
  periodEnd       DateTime       @map("period_end") @db.Date
  status          PayrunStatus   @default(DRAFT)

  createdByUserId String         @map("created_by_user_id") @db.Uuid
  createdByUser   User           @relation("PayrunCreatedBy", fields: [createdByUserId], references: [id], onDelete: Restrict)

  calculatedAt    DateTime?      @map("calculated_at") @db.Timestamptz(3)
  validatedAt     DateTime?      @map("validated_at") @db.Timestamptz(3)
  validatedByUserId String?      @map("validated_by_user_id") @db.Uuid
  validatedByUser User?          @relation("PayrunValidatedBy", fields: [validatedByUserId], references: [id], onDelete: Restrict)

  totalGross      Decimal        @default(0.00) @map("total_gross") @db.Decimal(14, 2)
  totalDeductions Decimal        @default(0.00) @map("total_deductions") @db.Decimal(14, 2)
  totalNet        Decimal        @default(0.00) @map("total_net") @db.Decimal(14, 2)
  employeeCount   Int            @default(0) @map("employee_count")

  employees       PayrunEmployee[]

  createdAt       DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([status])
  @@index([periodStart])
  @@index([periodEnd])
  @@map("payruns")
}
```

### 3. Model: `PayrunEmployee`

```prisma
model PayrunEmployee {
  id                      String          @id @default(uuid()) @db.Uuid

  payrunId                String          @map("payrun_id") @db.Uuid
  payrun                  Payrun          @relation(fields: [payrunId], references: [id], onDelete: Cascade)

  employeeId              String          @map("employee_id") @db.Uuid
  employee                Employee        @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  contractId              String?         @map("contract_id") @db.Uuid
  contractSnapshot        Json?           @map("contract_snapshot")

  salaryStructureId       String?         @map("salary_structure_id") @db.Uuid
  salaryStructureSnapshot Json?           @map("salary_structure_snapshot")

  baseSalary              Decimal         @default(0.00) @map("base_salary") @db.Decimal(12, 2)
  grossAmount             Decimal         @default(0.00) @map("gross_amount") @db.Decimal(12, 2)
  deductionAmount         Decimal         @default(0.00) @map("deduction_amount") @db.Decimal(12, 2)
  netAmount               Decimal         @default(0.00) @map("net_amount") @db.Decimal(12, 2)

  lineItems               Json?           @map("line_items")
  warnings                Json?           @map("warnings")
  warningCount            Int             @default(0) @map("warning_count")

  calculatedAt            DateTime        @default(now()) @map("calculated_at") @db.Timestamptz(3)
  createdAt               DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt               DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@unique([payrunId, employeeId])
  @@index([payrunId])
  @@index([employeeId])
  @@map("payrun_employees")
}
```

---

## Business Rules & Safety Invariants

| Rule | Description | Error Code / Behavior |
| :--- | :--- | :--- |
| **Valid Period Range** | `periodStart` must be less than or equal to `periodEnd`. | `400 INVALID_PERIOD_RANGE` |
| **Duplicate Period Prevention** | Active (non-cancelled) payruns cannot overlap the exact same payroll period range. | `409 PAYRUN_PERIOD_CONFLICT` |
| **Repeatable Calculation** | Calculations can be executed repeatedly on `DRAFT` or `CALCULATED` payruns. Existing `PayrunEmployee` records are purged and recreated within a single database transaction. | N/A |
| **Strict Immutability** | Once `VALIDATED`, a payrun cannot be recalculated or cancelled. | `409 PAYRUN_ALREADY_VALIDATED` |
| **Cancelled Guard** | Cancelled payruns cannot be calculated or validated. | `409 PAYRUN_ALREADY_CANCELLED` |
| **Validation Prerequisite** | A payrun must be in `CALCULATED` status with at least one employee record before it can be validated. | `400 PAYRUN_NOT_CALCULATED` / `400 PAYRUN_EMPTY` |
| **Zero IEEE-754 Drift** | All monetary amounts use Prisma `Decimal`. Percentage earnings and deductions round half-up to 2 decimal places. `net = gross - deductions`. | Enforced via `Decimal` library |
| **Snapshot Isolation** | Full contract details and salary rules are snapshotted into JSON columns at calculation time. Future edits to contracts or structures do not affect historical calculations. | Enforced in Service |
| **Structured Warnings** | Missing active contract or salary structure produces auditable warnings (`NO_ACTIVE_CONTRACT`, `NO_SALARY_STRUCTURE_ASSIGNMENT`), setting amounts to `0.00` rather than aborting the payrun. | Recorded in `warnings` JSON |
| **Least Privilege Validation** | `PAYROLL_USER` can calculate draft payruns, but only `ADMIN` or `PAYROLL_MANAGER` can validate. | `403 FORBIDDEN` |

---

## API Endpoints

All endpoints are prefixed with `/api/v1/payruns`.

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/payruns` | `ADMIN`, `PAYROLL_MANAGER` | Create a new payrun in `DRAFT` status |
| `GET` | `/payruns` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER` | List payruns with pagination and status filter |
| `GET` | `/payruns/:id` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER` | Get payrun summary by ID |
| `POST` | `/payruns/:id/calculate` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER` | Calculate payroll for all active employees |
| `POST` | `/payruns/:id/validate` | `ADMIN`, `PAYROLL_MANAGER` | Validate and lock payrun into immutable state |
| `POST` | `/payruns/:id/cancel` | `ADMIN`, `PAYROLL_MANAGER` | Cancel non-validated payrun |
| `GET` | `/payruns/:id/employees` | `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER` | List calculated employee payrun records with breakdown |

---

## Automated Unit Tests

A comprehensive suite of automated unit tests was implemented in `src/modules/payroll/payroll-engine.test.ts` using Node.js's native test runner (`node --import tsx --test`).

```
✔ Payroll Engine > fixed earning adds correctly to gross (2.59ms)
✔ Payroll Engine > percentage earning calculates correctly from base salary (0.42ms)
✔ Payroll Engine > fixed deduction subtracts correctly from gross (0.41ms)
✔ Payroll Engine > percentage deduction calculates correctly from gross earnings (0.42ms)
✔ Payroll Engine > net = gross - deductions invariant holds across complex rules (0.43ms)
✔ Payroll Engine > decimal precision rounds half-up without floating-point drift (0.49ms)
✔ Payroll Engine > missing contract returns zero amounts and records warning (0.35ms)
✔ Payroll Engine > missing salary structure assignment returns base salary without rules and records warning (0.42ms)

ℹ tests 8
ℹ suites 1
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

---

## Integration Verification Results

End-to-end integration was verified via `apps/api/src/scripts/verify-payroll.ts`:

1. **Payrun Creation**: Created payrun `PR-2026-09` for period `2026-09-01` to `2026-09-30`. Verified initial `DRAFT` status and total zeros.
2. **Duplicate Period Prevention**: Attempted to create a duplicate payrun for the exact same dates; verified rejection with `409 PAYRUN_PERIOD_CONFLICT`.
3. **Invalid Date Range Guard**: Attempted to create a payrun with `periodStart > periodEnd`; verified rejection with `400 INVALID_PERIOD_RANGE`.
4. **Payroll Calculation**:
   - Seeded employee with active contract (Base Salary: $5,000.00).
   - Seeded salary structure with fixed earning (Transport Allowance: $250.00), percentage earning (Performance Bonus: 10% = $500.00), percentage deduction (Pension Contribution: 5% of base = $250.00), and fixed deduction (Health Insurance: $100.00).
   - Calculated payroll: Verified `Gross = $5,750.00`, `Deductions = $350.00`, `Net = $5,400.00`.
   - Verified audit snapshots in `contractSnapshot`, `salaryStructureSnapshot`, and `lineItems`.
5. **Repeatable Calculation**: Recalculated on the same payrun; verified clean replacement without duplicate records or orphan entries.
6. **Payrun Validation**: Validated payrun; verified transition to `VALIDATED`, assignment of `validatedAt` and `validatedByUserId`.
7. **Immutability Invariant**: Attempted recalculation on validated payrun; verified rejection with `409 PAYRUN_ALREADY_VALIDATED`. Attempted cancellation; verified rejection with `409 PAYRUN_ALREADY_VALIDATED`.

---

## Quality Gates Verification

| Check | Command | Result |
| :--- | :--- | :--- |
| **Unit Tests** | `npm test` | ✅ 8 / 8 tests passed |
| **TypeScript Typecheck** | `npm run typecheck --workspace=@peoplepay360/api` | ✅ 0 errors |
| **Production Build** | `npm run build --workspace=@peoplepay360/api` | ✅ 0 errors |
