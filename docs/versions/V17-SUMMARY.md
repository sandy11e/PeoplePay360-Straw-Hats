# STEP 17: Leave Management

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(leave): add leave management workflow`

---

## Overview

STEP 17 implemented leave management for PeoplePay360, encompassing configurable leave types, annual employee leave allocations, real-time balance calculations, leave request submission, and transactional approval/rejection/cancellation workflows.

**Key Highlights:**
- **Configurable Leave Types**: Distinct types (e.g., Annual, Sick, Maternity) with active flags, paid/unpaid status, and unique code constraints.
- **Annual Leave Allocations**: Multi-year allocations per employee and leave type with unique composite indexing `(employeeId, leaveTypeId, year)`.
- **Fraction-Safe Decimal Precision**: Uses `Decimal(5, 2)` across allocations, requests, and balance calculations to prevent floating-point inaccuracies when handling half-day (`0.50`) leaves.
- **Schedule-Aware Requested Days Calculation**: Calculates requested working days server-side by checking the employee's active weekly work schedule (or standard Monday–Friday weekdays), omitting non-working days.
- **Overlapping Request Protection**: Automatically rejects leave requests that overlap with existing `PENDING` or `APPROVED` requests for the same employee.
- **Corporate Governance & Separation of Duties**: Strictly prevents HR managers and administrators from approving or rejecting their own leave requests (`403 SELF_APPROVAL_NOT_ALLOWED`).
- **Transactional Approvals**: Interactive Prisma transaction verifies `PENDING` status, checks remaining balance (`allocatedDays - usedDays >= requestedDays`), increments `usedDays`, and records the approving user ID and timestamp to prevent double-approval or race conditions.
- **Restoring Availability on Cancellation**: Cancelling an `APPROVED` leave request automatically decrements `usedDays` on the allocation within a transaction, returning the days back to the employee's available balance.
- **Role-Based Access Control**:
  - `ADMIN` & `HR_MANAGER`: Manage leave types, allocations, and review requests.
  - `PAYROLL_MANAGER` & `PAYROLL_USER`: Read-only access to all leave requests and employee leave balances.
  - `EMPLOYEE`: Self-service request submission, view own balances, view own requests, and cancel own requests.

---

## Database Schema & Migration

### Migration
- **Name:** `add_leave_management`
- **Migration Directory:** `apps/api/prisma/migrations/20260905144118_add_leave_management/migration.sql`

### 1. Enum: `LeaveRequestStatus`

```prisma
enum LeaveRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}
```

### 2. Model: `LeaveType`

```prisma
model LeaveType {
  id          String   @id @default(uuid()) @db.Uuid
  code        String   @unique @db.VarChar(30)
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  isPaid      Boolean  @default(true) @map("is_paid")
  isActive    Boolean  @default(true) @map("is_active")

  allocations LeaveAllocation[]
  requests    LeaveRequest[]

  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@map("leave_types")
}
```

### 3. Model: `LeaveAllocation`

```prisma
model LeaveAllocation {
  id            String    @id @default(uuid()) @db.Uuid

  employeeId    String    @map("employee_id") @db.Uuid
  employee      Employee  @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  leaveTypeId   String    @map("leave_type_id") @db.Uuid
  leaveType     LeaveType @relation(fields: [leaveTypeId], references: [id], onDelete: Restrict)

  year          Int
  allocatedDays Decimal   @map("allocated_days") @db.Decimal(5, 2)
  usedDays      Decimal   @default(0) @map("used_days") @db.Decimal(5, 2)

  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@unique([employeeId, leaveTypeId, year])
  @@index([employeeId])
  @@index([leaveTypeId])
  @@index([year])
  @@map("leave_allocations")
}
```

### 4. Model: `LeaveRequest`

```prisma
model LeaveRequest {
  id               String             @id @default(uuid()) @db.Uuid

  employeeId       String             @map("employee_id") @db.Uuid
  employee         Employee           @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  leaveTypeId      String             @map("leave_type_id") @db.Uuid
  leaveType        LeaveType          @relation(fields: [leaveTypeId], references: [id], onDelete: Restrict)

  startDate        DateTime           @map("start_date") @db.Date
  endDate          DateTime           @map("end_date") @db.Date
  requestedDays    Decimal            @map("requested_days") @db.Decimal(5, 2)

  reason           String?            @db.VarChar(500)
  status           LeaveRequestStatus @default(PENDING)

  reviewedByUserId String?            @map("reviewed_by_user_id") @db.Uuid
  reviewedByUser   User?              @relation("LeaveReviewedBy", fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  reviewedAt       DateTime?          @map("reviewed_at") @db.Timestamptz(3)
  reviewComment    String?            @map("review_comment") @db.VarChar(500)

  createdAt        DateTime           @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt        DateTime           @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([employeeId])
  @@index([leaveTypeId])
  @@index([status])
  @@index([startDate])
  @@index([endDate])
  @@map("leave_requests")
}
```

---

## Business Rules & Invariants

| Rule | Description | Error Response |
| :--- | :--- | :--- |
| **Active Employee Only** | Only employees with `employmentStatus: ACTIVE` can submit leave requests. | `400 EMPLOYEE_NOT_ACTIVE` |
| **Self Submission** | Regular employees can only submit requests for their own linked employee account. | `403 FORBIDDEN` |
| **Active Leave Type** | Requests can only be made against active leave types (`isActive: true`). | `400 INACTIVE_LEAVE_TYPE` |
| **Overlapping Leave Protection** | Rejects requests that overlap with existing `PENDING` or `APPROVED` requests. | `409 OVERLAPPING_LEAVE_REQUEST` |
| **Balance Sufficiency** | Validates `availableDays >= requestedDays` at submission and at approval. | `400 INSUFFICIENT_LEAVE_BALANCE` |
| **Separation of Duties** | Requesters who have `ADMIN` or `HR_MANAGER` roles cannot approve or reject their own requests. | `403 SELF_APPROVAL_NOT_ALLOWED` |
| **Double Approval Prevention** | Approval is only allowed if current status is `PENDING`. | `409 INVALID_STATUS_FOR_APPROVAL` |
| **Transactional Restoration** | Cancelling an `APPROVED` request decrements `usedDays` on the allocation atomically. | N/A (Balance Restored) |
| **Half-Day Leave** | Half-day leave (`isHalfDay: true`) requires `startDate === endDate` and sets `requestedDays = 0.50`. | `400 VALIDATION_ERROR` |

---

## API Endpoints

### 1. `POST /api/v1/leave-types`
Create a new leave type.
- **Access:** `ADMIN`, `HR_MANAGER`
- **Request Body:** `{ "code": "ANNUAL", "name": "Annual Leave", "isPaid": true, "description": "Recreation" }`
- **Response (201):** `{ "leaveType": { ... } }`

### 2. `GET /api/v1/leave-types`
List leave types (employees default to active only).
- **Access:** Authenticated
- **Response (200):** `{ "leaveTypes": [ ... ] }`

### 3. `PATCH /api/v1/leave-types/:id`
Update a leave type.
- **Access:** `ADMIN`, `HR_MANAGER`
- **Response (200):** `{ "leaveType": { ... } }`

### 4. `POST /api/v1/leave-allocations`
Allocate days for an employee, leave type, and year.
- **Access:** `ADMIN`, `HR_MANAGER`
- **Request Body:** `{ "employeeId": "...", "leaveTypeId": "...", "year": 2026, "allocatedDays": 20 }`
- **Response (201):** `{ "leaveAllocation": { ... } }`

### 5. `GET /api/v1/employees/:employeeId/leave-balances`
Get leave balances for an employee in a given year.
- **Access:** `ADMIN`, `HR_MANAGER`, `PAYROLL_*`, or self
- **Query:** `?year=2026`
- **Response (200):**
  ```json
  {
    "employeeId": "060d4ff5-f5b2-4d7a-b286-90209dfb3988",
    "year": 2026,
    "balances": [
      {
        "id": "...",
        "leaveTypeId": "...",
        "leaveType": { "id": "...", "code": "ANNUAL", "name": "Annual Leave", "isPaid": true },
        "year": 2026,
        "allocatedDays": 20,
        "usedDays": 3,
        "pendingDays": 0,
        "availableDays": 17
      }
    ]
  }
  ```

### 6. `POST /api/v1/leave-requests`
Submit a leave request.
- **Access:** Authenticated (scoped to self for employees)
- **Request Body:**
  ```json
  {
    "leaveTypeId": "...",
    "startDate": "2026-09-09",
    "endDate": "2026-09-11",
    "reason": "Family vacation",
    "isHalfDay": false
  }
  ```
- **Response (201):** `{ "leaveRequest": { "requestedDays": 3, "status": "PENDING", ... } }`

### 7. `GET /api/v1/leave-requests`
List leave requests with pagination and filters (`from`, `to`, `employeeId`, `leaveTypeId`, `status`, `year`).
- **Access:** `ADMIN`, `HR_MANAGER`, `PAYROLL_*` (all requests) or `EMPLOYEE` (scoped to self)
- **Response (200):** `{ "leaveRequests": [ ... ], "pagination": { ... } }`

### 8. `GET /api/v1/leave-requests/:id`
Retrieve a single leave request.
- **Access:** Management/Payroll or request owner
- **Response (200):** `{ "leaveRequest": { ... } }`

### 9. `POST /api/v1/leave-requests/:id/approve`
Approve a pending leave request (transactional balance deduction).
- **Access:** `ADMIN`, `HR_MANAGER` (requester cannot approve own request)
- **Request Body:** `{ "comment": "Approved by HR" }`
- **Response (200):** `{ "leaveRequest": { "status": "APPROVED", ... } }`

### 10. `POST /api/v1/leave-requests/:id/reject`
Reject a pending leave request.
- **Access:** `ADMIN`, `HR_MANAGER` (requester cannot reject own request)
- **Request Body:** `{ "comment": "Project deadline conflict" }`
- **Response (200):** `{ "leaveRequest": { "status": "REJECTED", ... } }`

### 11. `POST /api/v1/leave-requests/:id/cancel`
Cancel a pending or approved leave request (approved leaves automatically restore allocation days).
- **Access:** Request owner or `ADMIN` / `HR_MANAGER`
- **Response (200):** `{ "leaveRequest": { "status": "CANCELLED", ... } }`

---

## Verification & Test Results

Executed automated end-to-end verification via `apps/api/src/scripts/verify-leave.ts`:

```
=== STARTING LEAVE MANAGEMENT VERIFICATION ===
[Test Server] Listening on http://localhost:55744/api/v1

[TEST 1] Leave Type creation & duplicate prevention
Annual Leave Type Created: 201, Code: ANNUAL_1788619523405
Duplicate code status: 409, Code: LEAVE_TYPE_CODE_EXISTS
✔ TEST 1 PASSED

[TEST 2] Leave Allocation by HR
Allocated 20 annual days to empA: 201
✔ TEST 2 PASSED

[TEST 3] Check Leave Balances & Permissions
Balances fetched: 200, Items: 2
✔ TEST 3 PASSED

[TEST 4] Submit Leave Request Validations
Inactive employee status: 400, Code: EMPLOYEE_NOT_ACTIVE
Spoofed submission status: 403
Insufficient balance status: 400, Code: INSUFFICIENT_LEAVE_BALANCE
✔ TEST 4 PASSED

[TEST 5] Successful Leave Request Submission
Leave Request Created: 201, requestedDays: 3, Status: PENDING
✔ TEST 5 PASSED

[TEST 6] Overlapping Request Rejection
Overlapping request status: 409, Code: OVERLAPPING_LEAVE_REQUEST
✔ TEST 6 PASSED

[TEST 7] Separation of Duties (Requester cannot approve own request)
Self-approval status: 403, Code: SELF_APPROVAL_NOT_ALLOWED
Admin approving HR request status: 200, Status: APPROVED
✔ TEST 7 PASSED (Self-approval strictly prevented)

[TEST 8] Transactional Approval of Employee A's Request
Approved status: 200, Reviewer: HR_MANAGER
Used days: 3, Available: 17
Double approval status: 409, Code: INVALID_STATUS_FOR_APPROVAL
✔ TEST 8 PASSED

[TEST 9] Approved Leave Cancellation & Balance Restoration
Cancellation status: 200, Status: CANCELLED
Restored used days: 0, Available: 20
✔ TEST 9 PASSED (Balance restored perfectly)

[TEST 10] Rejection Workflow
Rejection status: 200, Comment: Quarter-end closing, cannot approve
✔ TEST 10 PASSED

[TEST 11] Half-Day Leave Support (0.50 Decimal)
Half-day requestedDays: 0.5
Balance after half-day: usedDays = 0.5, available = 19.5
✔ TEST 11 PASSED (Half-day exact decimal precision verified)

[TEST 12] List Requests with Filters and Role Scoping
Employee A total visible requests: 3
Payroll total visible requests: 4
✔ TEST 12 PASSED

=======================================================
🎉 ALL 12 LEAVE MANAGEMENT TESTS PASSED SUCCESSFULLY!
=======================================================
```

---

## Code Quality Gates
- **Prisma Migration**: `20260905144118_add_leave_management` created and applied cleanly.
- **TypeScript Typecheck**: `npm run typecheck --workspace=@peoplepay360/api` passed with 0 errors.
- **Production Build**: `npm run build --workspace=@peoplepay360/api` built successfully.
- **Recommended Commit**: `feat(leave): add leave management workflow`
