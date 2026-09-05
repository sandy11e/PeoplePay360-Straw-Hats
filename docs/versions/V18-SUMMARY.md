# STEP 18: Salary Structures and Rules

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(payroll): add salary structures and rules`

---

## Overview

STEP 18 implemented salary structures, earning and deduction rules, and employee salary structure assignments for PeoplePay360. As payroll-critical code, the entire subsystem is built on declarative, deterministic models with zero dynamic code execution (`no eval()`), exact monetary precision via PostgreSQL `Decimal` and Prisma `Decimal`, and assignment overlap prevention.

**Key Highlights:**
- **Reusable Salary Structures**: Configurable templates defining compensation packages across an organization.
- **Declarative & Deterministic Rules**: Rules specify `EARNING` or `DEDUCTION` categories, and `FIXED` amount or `PERCENTAGE` calculation types referencing explicit bases (`BASE_SALARY` or `GROSS_EARNINGS`). No executable formula code, JavaScript execution, or user-supplied scripts are permitted.
- **Sequence-Based Execution**: Rules execute in strictly positive ascending `sequence` order, enabling deterministic multi-tier earnings and deduction calculations.
- **Zero Floating-Point Arithmetic**: All monetary amounts, percentages, and intermediate calculations use PostgreSQL `Decimal` and Prisma `Decimal`, completely avoiding IEEE-754 floating-point drift.
- **Employee Assignment Overlap Protection**: Strict date-range conflict detection prevents an employee from having concurrent salary structure assignments. Supports optional `closePrevious: true` to automatically end-date ongoing open assignments to the day before the new assignment.
- **Role-Based Access Control**:
  - `ADMIN` & `PAYROLL_MANAGER`: Create, update structures, rules, and employee assignments.
  - `PAYROLL_USER`: Read-only access to structures, rules, and employee assignments.
  - `HR_MANAGER`: Read-only access to employee assignments (for personnel records); strictly forbidden from creating or modifying payroll structures and rules.
  - `EMPLOYEE`: No arbitrary access.

---

## Database Schema & Migration

### Migration
- **Name:** `add_salary_structures`
- **Migration Directory:** `apps/api/prisma/migrations/20260905145116_add_salary_structures/migration.sql`

### 1. Enums

```prisma
enum SalaryRuleCategory {
  EARNING
  DEDUCTION
}

enum SalaryRuleCalculationType {
  FIXED
  PERCENTAGE
}

enum SalaryRuleBase {
  BASE_SALARY
  GROSS_EARNINGS
}
```

### 2. Model: `SalaryStructure`

```prisma
model SalaryStructure {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique @db.VarChar(30)
  name        String   @db.VarChar(120)
  description String?  @db.VarChar(500)
  isActive    Boolean  @default(true) @map("is_active")

  rules       SalaryRule[]
  assignments EmployeeSalaryStructureAssignment[]

  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@map("salary_structures")
}
```

### 3. Model: `SalaryRule`

```prisma
model SalaryRule {
  id              String                    @id @default(uuid()) @db.Uuid

  structureId     String                    @map("structure_id") @db.Uuid
  structure       SalaryStructure           @relation(fields: [structureId], references: [id], onDelete: Cascade)

  code            String                    @db.VarChar(30)
  name            String                    @db.VarChar(120)
  category        SalaryRuleCategory
  calculationType SalaryRuleCalculationType @map("calculation_type")

  amount          Decimal?                  @db.Decimal(12, 2)
  percentage      Decimal?                  @db.Decimal(5, 2)
  base            SalaryRuleBase?

  sequence        Int
  isTaxable       Boolean                   @default(true) @map("is_taxable")
  isActive        Boolean                   @default(true) @map("is_active")

  createdAt       DateTime                  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime                  @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@unique([structureId, code])
  @@index([structureId])
  @@index([category])
  @@index([sequence])
  @@map("salary_rules")
}
```

### 4. Model: `EmployeeSalaryStructureAssignment`

```prisma
model EmployeeSalaryStructureAssignment {
  id            String          @id @default(uuid()) @db.Uuid

  employeeId    String          @map("employee_id") @db.Uuid
  employee      Employee        @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  structureId   String          @map("structure_id") @db.Uuid
  structure     SalaryStructure @relation(fields: [structureId], references: [id], onDelete: Restrict)

  effectiveFrom DateTime        @map("effective_from") @db.Date
  effectiveTo   DateTime?       @map("effective_to") @db.Date

  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime        @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([employeeId])
  @@index([structureId])
  @@index([effectiveFrom])
  @@index([effectiveTo])
  @@map("employee_salary_structure_assignments")
}
```

---

## Business Rules & Safety Invariants

| Rule | Description | Error Code |
| :--- | :--- | :--- |
| **No Dynamic Code** | No user-submitted formulas or `eval()` execution. Rules are purely declarative. | N/A |
| **Unique Rule Code** | Rule code must be unique within a salary structure. | `409 RULE_CODE_EXISTS_IN_STRUCTURE` |
| **Fixed Amount Bounds** | When `calculationType === FIXED`, `amount >= 0` is required; `percentage` and `base` must be omitted. | `400 VALIDATION_ERROR` |
| **Percentage Bounds** | When `calculationType === PERCENTAGE`, `percentage > 0 && percentage <= 100` and `base` (`BASE_SALARY` or `GROSS_EARNINGS`) are required. | `400 VALIDATION_ERROR` |
| **Positive Sequence** | `sequence` must be a positive integer (`sequence >= 1`) to ensure deterministic rule ordering. | `400 VALIDATION_ERROR` |
| **Active Structure for Assignment** | Only active salary structures (`isActive === true`) can be assigned to employees. | `400 STRUCTURE_INACTIVE` |
| **Assignment Overlap Prevention** | An employee cannot have overlapping salary structure assignments across active dates. | `409 SALARY_STRUCTURE_ASSIGNMENT_OVERLAP` |
| **Automatic Closure** | Optional `closePrevious = true` sets the previous ongoing assignment's `effectiveTo` to the day before `effectiveFrom`. | N/A |
| **HR Modification Prohibition** | `HR_MANAGER` may read assignments, but receives `403 FORBIDDEN` if attempting to modify structures, rules, or assignments. | `403 FORBIDDEN` |

---

## API Endpoints

### 1. `POST /api/v1/salary-structures`
Create a new salary structure.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`
- **Request Body:**
  ```json
  {
    "code": "TECH_STD",
    "name": "Standard Engineering Salary Structure",
    "description": "Base salary, HRA, and statutory deductions",
    "isActive": true
  }
  ```
- **Response (201):** `{ "salaryStructure": { ... } }`

---

### 2. `GET /api/v1/salary-structures`
List all salary structures with pagination and rule/assignment counts.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER`
- **Query:** `?isActive=true&page=1&pageSize=20`
- **Response (200):** `{ "salaryStructures": [ ... ], "pagination": { ... } }`

---

### 3. `GET /api/v1/salary-structures/:id`
Get salary structure by ID with rules sorted by `sequence` ascending.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER`
- **Response (200):** `{ "salaryStructure": { "rules": [ ... ], ... } }`

---

### 4. `PATCH /api/v1/salary-structures/:id`
Update a salary structure's metadata.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`
- **Request Body:** `{ "name": "...", "description": "...", "isActive": true }`
- **Response (200):** `{ "salaryStructure": { ... } }`

---

### 5. `POST /api/v1/salary-structures/:id/rules`
Add an earning or deduction rule to a salary structure.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`
- **Request Body (Fixed Earning Example):**
  ```json
  {
    "code": "BASIC",
    "name": "Basic Salary",
    "category": "EARNING",
    "calculationType": "FIXED",
    "amount": 50000.00,
    "sequence": 1,
    "isTaxable": true
  }
  ```
- **Request Body (Percentage Deduction Example):**
  ```json
  {
    "code": "PF_EMPLOYEE",
    "name": "Provident Fund (Employee)",
    "category": "DEDUCTION",
    "calculationType": "PERCENTAGE",
    "percentage": 12.00,
    "base": "BASE_SALARY",
    "sequence": 4,
    "isTaxable": false
  }
  ```
- **Response (201):** `{ "salaryRule": { ... } }`

---

### 6. `PATCH /api/v1/salary-rules/:id`
Update an existing salary rule.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`
- **Request Body:** Partial rule update fields.
- **Response (200):** `{ "salaryRule": { ... } }`

---

### 7. `POST /api/v1/employees/:employeeId/salary-structures`
Assign a salary structure to an employee.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`
- **Request Body:**
  ```json
  {
    "structureId": "602e373d-538a-4320-a5f3-31b2d68cfaeb",
    "effectiveFrom": "2026-07-01",
    "effectiveTo": null,
    "closePrevious": true
  }
  ```
- **Response (201):** `{ "assignment": { ... } }`

---

### 8. `GET /api/v1/employees/:employeeId/salary-structures`
Get all historical and active salary structure assignments for an employee.
- **Access:** `ADMIN`, `PAYROLL_MANAGER`, `PAYROLL_USER`, `HR_MANAGER`
- **Response (200):** `{ "employeeId": "...", "assignments": [ ... ] }`

---

## Verification & Test Results

Executed automated end-to-end verification via `apps/api/src/scripts/verify-salary-structures.ts`:

```
=== STARTING SALARY STRUCTURES AND RULES VERIFICATION ===
[Test Server] Listening on http://localhost:49733/api/v1

[TEST 1] Salary Structure Creation & Permission Checks
Structure Created: 201, Code: TECH_STD_1788620143333
Duplicate structure code status: 409, Code: STRUCTURE_CODE_EXISTS
HR creating structure status: 403
✔ TEST 1 PASSED

[TEST 2] Salary Structure Listing & Retrieval
Payroll User list structures: 200, Count: 1
Employee listing structures status: 403
✔ TEST 2 PASSED

[TEST 3] Salary Structure Update
Updated structure description status: 200
✔ TEST 3 PASSED

[TEST 4] Salary Rule Creation (Fixed & Percentage Rules)
Rule 1 BASIC created: 201, Amount: 50000
Rule 2 HRA created: 201, Percentage: 40%
Rule 4 PF_EMPLOYEE created: 201
✔ TEST 4 PASSED

[TEST 5] Salary Rule Safety & Validation Checks
Duplicate rule code status: 409, Code: RULE_CODE_EXISTS_IN_STRUCTURE
✔ TEST 5 PASSED

[TEST 6] Patch Salary Rule
Updated HRA percentage to 45%: 200, Percentage: 45
✔ TEST 6 PASSED

[TEST 7] Assign Structure to Employee & Inactive Check
Inactive assignment status: 400, Code: STRUCTURE_INACTIVE
Active assignment status: 201, ID: 602e373d-538a-4320-a5f3-31b2d68cfaeb
✔ TEST 7 PASSED

[TEST 8] Assignment Overlap Prevention
Overlap assignment status: 409, Code: SALARY_STRUCTURE_ASSIGNMENT_OVERLAP
✔ TEST 8 PASSED

[TEST 9] Auto-Closure of Previous Assignment with closePrevious = true
Assigned with closePrevious: 201
First assignment effectiveTo closed at: 2026-06-30
✔ TEST 9 PASSED

[TEST 10] Retrieval of Employee Assignments & Role Permissions
HR reading employee assignments: 200, Count: 2
HR attempting assignment creation status: 403
✔ TEST 10 PASSED

[TEST 11] Deterministic Decimal Calculation (Zero JS Float Math)
Base Salary: 50000
Gross Earnings: 137500
Total Deductions: 6200
Net Salary: 131300
✔ TEST 11 PASSED (Exact Decimal calculation verified without floating point drift)

=======================================================
🎉 ALL 11 SALARY STRUCTURE AND RULES TESTS PASSED!
=======================================================
```

---

## Code Quality Gates
- **Prisma Migration**: `20260905145116_add_salary_structures` applied cleanly.
- **TypeScript Typecheck**: `npm run typecheck --workspace=@peoplepay360/api` passed with 0 errors.
- **Production Build**: `npm run build --workspace=@peoplepay360/api` compiled successfully.
- **Recommended Commit**: `feat(payroll): add salary structures and rules`
