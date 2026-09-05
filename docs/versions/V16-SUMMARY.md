# STEP 16: Attendance Management

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(attendance): add attendance tracking`

---

## Overview

STEP 16 implemented employee attendance tracking for PeoplePay360 based on real check-in and check-out events. The implementation provides a reusable service layer architected for web self-service and future Kiosk / QR integrations, automatic arrival status evaluation (`PRESENT` vs `LATE`) based on active work schedules, manual attendance adjustments for administrators, and role-based access controls.

**Key Highlights:**
- **Real-Time Check-In / Check-Out**: Employees can record arrival and departure times directly via the API.
- **Single Open Session Constraint**: Strictly enforces that an employee can have at most one active open attendance session (`checkOutAt: null`) both in the application service layer and with a PostgreSQL partial unique index.
- **Strict Server-Side Duration Calculation**: `workedMinutes` is strictly computed by the server (`Math.max(0, Math.floor((checkOutAt - checkInAt) / 60000))`). Any client-supplied `workedMinutes` is ignored.
- **Work Schedule Integration & Late Arrival Detection**: Automatically evaluates the employee's assigned work schedule for the attendance date and marks arrival as `LATE` if check-in time exceeds the expected start time; otherwise `PRESENT`.
- **Reusable Service Layer**: Decoupled service layer (`attendance.service.ts`) designed so future Kiosk or QR integrations call the same core validation and persistence methods without duplicate business logic. No insecure QR secrets were added in this step.
- **Manual Adjustments by Management**: `ADMIN` and `HR_MANAGER` roles can record manual attendance entries or adjust existing records (with server-side time range validation and worked minutes recalculation).
- **Role-Based Access Control**:
  - `EMPLOYEE`: Self-service check-in, check-out, and read access restricted to their own attendance records.
  - `PAYROLL_MANAGER` & `PAYROLL_USER`: Read-only access to all attendance records with date and employee filtering.
  - `ADMIN` & `HR_MANAGER`: Full management, manual entries, and record modifications.

---

## Database Schema & Migration

### Migration
- **Name:** `add_attendance`
- **Migration Directory:** `apps/api/prisma/migrations/20260905135513_add_attendance/migration.sql`

### 1. Enum: `AttendanceStatus`

```prisma
enum AttendanceStatus {
  PRESENT
  LATE
  ABSENT
  HALF_DAY
  ON_LEAVE
}
```

### 2. Enum: `AttendanceSource`

```prisma
enum AttendanceSource {
  WEB
  KIOSK
  MANUAL
}
```

### 3. Model: `Attendance`

```prisma
model Attendance {
  id             String           @id @default(uuid()) @db.Uuid

  employeeId     String           @map("employee_id") @db.Uuid
  employee       Employee         @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  attendanceDate DateTime         @map("attendance_date") @db.Date

  checkInAt      DateTime         @map("check_in_at") @db.Timestamptz(3)
  checkOutAt     DateTime?        @map("check_out_at") @db.Timestamptz(3)

  workedMinutes  Int?             @map("worked_minutes")

  status         AttendanceStatus @default(PRESENT)
  source         AttendanceSource @default(WEB)

  notes          String?          @db.VarChar(500)

  createdAt      DateTime         @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime         @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([employeeId])
  @@index([attendanceDate])
  @@index([status])
  @@index([checkInAt])
  @@map("attendances")
}
```

### 4. Database Partial Unique Index

To guarantee database integrity against concurrent race conditions, the migration enforces a partial unique index on open sessions:
```sql
CREATE UNIQUE INDEX "unique_open_attendance_per_employee" ON "attendances"("employee_id") WHERE "check_out_at" IS NULL;
```

---

## Business Logic & Invariants

| Rule | Description | Error Response |
| :--- | :--- | :--- |
| **Active Employee Required** | Only employees with `employmentStatus: ACTIVE` can check in. | `400 EMPLOYEE_NOT_ACTIVE` |
| **Linked User Account** | The authenticated user must be linked to an employee profile for self-service operations. | `400 USER_NOT_LINKED_TO_EMPLOYEE` |
| **Single Open Session** | An employee cannot check in if an open session already exists (`checkOutAt === null`). | `409 ATTENDANCE_SESSION_ALREADY_OPEN` |
| **Session Required for Check-Out** | Checking out requires an active open session. | `404 NO_ACTIVE_ATTENDANCE_SESSION` |
| **Valid Time Range** | `checkOutAt` must be greater than or equal to `checkInAt`. | `400 INVALID_TIME_RANGE` |
| **Server-Computed Duration** | Client-provided `workedMinutes` is completely ignored and strictly recalculated server-side. | N/A (Server Overrides) |
| **Schedule-Based Late Status** | If an employee checks in after their scheduled start time on a working day, status is set to `LATE`. | N/A (Status = `LATE`) |
| **Role Restriction on Edits** | Only `ADMIN` and `HR_MANAGER` can invoke `POST /manual` or `PATCH /:id`. | `403 FORBIDDEN` |

---

## API Endpoints

### 1. `POST /api/v1/attendance/check-in`
Self-service check-in for the authenticated employee.

- **Access:** Authenticated user with linked active employee.
- **Request Body:**
  ```json
  {
    "source": "WEB",
    "notes": "Morning arrival",
    "checkInAt": "2026-09-05T08:55:00.000Z" // Optional, defaults to now
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "attendance": {
      "id": "dce4cb85-8232-44d0-a919-1e1633d460d7",
      "employeeId": "060d4ff5-f5b2-4d7a-b286-90209dfb3988",
      "attendanceDate": "2026-09-05T00:00:00.000Z",
      "checkInAt": "2026-09-05T08:55:00.000Z",
      "checkOutAt": null,
      "workedMinutes": null,
      "status": "PRESENT",
      "source": "WEB",
      "notes": "Morning arrival",
      "createdAt": "2026-09-05T08:55:00.000Z",
      "updatedAt": "2026-09-05T08:55:00.000Z"
    }
  }
  ```

---

### 2. `POST /api/v1/attendance/check-out`
Self-service check-out closing the active open session.

- **Access:** Authenticated user with linked active employee.
- **Request Body:**
  ```json
  {
    "notes": "Shift complete",
    "checkOutAt": "2026-09-05T17:25:00.000Z" // Optional, defaults to now
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "attendance": {
      "id": "dce4cb85-8232-44d0-a919-1e1633d460d7",
      "employeeId": "060d4ff5-f5b2-4d7a-b286-90209dfb3988",
      "attendanceDate": "2026-09-05T00:00:00.000Z",
      "checkInAt": "2026-09-05T08:55:00.000Z",
      "checkOutAt": "2026-09-05T17:25:00.000Z",
      "workedMinutes": 510,
      "status": "PRESENT",
      "source": "WEB",
      "notes": "Shift complete",
      "createdAt": "2026-09-05T08:55:00.000Z",
      "updatedAt": "2026-09-05T17:25:00.000Z"
    }
  }
  ```

---

### 3. `GET /api/v1/attendance`
List attendance records with filters and pagination.

- **Access:** `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER` (all records) or `EMPLOYEE` (scoped to self).
- **Query Parameters:**
  - `from` (YYYY-MM-DD): Filter start date.
  - `to` (YYYY-MM-DD): Filter end date.
  - `employeeId` (UUID): Filter by specific employee.
  - `status` (`PRESENT`, `LATE`, `ABSENT`, `HALF_DAY`, `ON_LEAVE`).
  - `page` (integer, default 1).
  - `pageSize` (integer, default 20, max 100).
- **Response (200 OK):**
  ```json
  {
    "attendance": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 42,
      "totalPages": 3
    }
  }
  ```

---

### 4. `GET /api/v1/attendance/:id`
Retrieve a single attendance record by ID.

- **Access:** Management/Payroll roles or the linked employee owner.
- **Response (200 OK):**
  ```json
  {
    "attendance": {
      "id": "dce4cb85-8232-44d0-a919-1e1633d460d7",
      "employeeId": "060d4ff5-f5b2-4d7a-b286-90209dfb3988",
      "attendanceDate": "2026-09-05T00:00:00.000Z",
      "checkInAt": "2026-09-05T08:55:00.000Z",
      "checkOutAt": "2026-09-05T17:25:00.000Z",
      "workedMinutes": 510,
      "status": "PRESENT",
      "source": "WEB",
      "notes": "Shift complete"
    }
  }
  ```

---

### 5. `POST /api/v1/attendance/manual`
Create or override attendance records manually.

- **Access:** `ADMIN`, `HR_MANAGER` only.
- **Request Body:**
  ```json
  {
    "employeeId": "060d4ff5-f5b2-4d7a-b286-90209dfb3988",
    "attendanceDate": "2026-09-08",
    "checkInAt": "2026-09-08T09:00:00.000Z",
    "checkOutAt": "2026-09-08T18:00:00.000Z",
    "status": "PRESENT",
    "source": "MANUAL",
    "notes": "Approved overtime shift"
  }
  ```
- **Response (201 Created):** Attendance record with server-computed `workedMinutes`.

---

### 6. `PATCH /api/v1/attendance/:id`
Modify an existing attendance record.

- **Access:** `ADMIN`, `HR_MANAGER` only.
- **Request Body:** Partial update fields (`checkInAt`, `checkOutAt`, `status`, `notes`, etc.).
- **Response (200 OK):** Updated attendance record with recalculated `workedMinutes`.

---

### 7. `GET /api/v1/employees/:employeeId/attendance`
Get attendance records for a specific employee.

- **Access:** `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER`, or the linked employee themselves.
- **Response (200 OK):** Paginated attendance list for the employee.

---

## Verification & Test Results

Executed automated end-to-end verification via `apps/api/src/scripts/verify-attendance.ts`:

```
=== STARTING ATTENDANCE MANAGEMENT VERIFICATION ===
[Test Server] Listening on http://localhost:63557/api/v1

[TEST 1] Unlinked user self check-in rejection
Status: 400, Code: USER_NOT_LINKED_TO_EMPLOYEE
✔ TEST 1 PASSED

[TEST 2] Inactive employee self check-in rejection
Status: 400, Code: EMPLOYEE_NOT_ACTIVE
✔ TEST 2 PASSED

[TEST 3] Active employee self check-in
Status: 201, Attendance ID: dce4cb85-8232-44d0-a919-1e1633d460d7, Status: PRESENT
✔ TEST 3 PASSED

[TEST 4] Open session conflict prevention
Status: 409, Code: ATTENDANCE_SESSION_ALREADY_OPEN
✔ TEST 4 PASSED

[TEST 5] Active employee self check-out
Status: 200, workedMinutes: 510
✔ TEST 5 PASSED

[TEST 6] Check-out without open session rejection
Status: 404, Code: NO_ACTIVE_ATTENDANCE_SESSION
✔ TEST 6 PASSED

[TEST 7] Work schedule integration & Late arrival status
Status: 201, Attendance Status: LATE
✔ TEST 7 PASSED (Schedule evaluated LATE correctly)

[TEST 8] Manual attendance creation by HR_MANAGER
Status: 201, Attendance ID: 7cd9e912-2049-4f26-bea9-e1da0cad968e, workedMinutes: 540
✔ TEST 8 PASSED (Server-side calculation enforced)

[TEST 9] Manual creation time range validation
Status: 400, Message: {"code":"VALIDATION_ERROR","message":"Invalid manual attendance data","details":{"formErrors":[],"fieldErrors":{"checkOutAt":["checkOutAt cannot precede checkInAt"]}}}
✔ TEST 9 PASSED

[TEST 10] Attendance update by ADMIN
Status: 200, Recalculated workedMinutes: 600
✔ TEST 10 PASSED

[TEST 11] Single attendance retrieval
Status: 200, Notes: Updated overtime hours
✔ TEST 11 PASSED

[TEST 12] List Attendances with filters and pagination
Status: 200, Total: 3, Items: 3
✔ TEST 12 PASSED

[TEST 13] Employee subroute GET /api/v1/employees/:employeeId/attendance
Status: 200, Total: 3
✔ TEST 13 PASSED

[TEST 14] Role permissions security checks
Payroll manual creation status: 403
Employee PATCH status: 403
Employee accessing other employee status: 403
✔ TEST 14 PASSED (Role security boundaries strictly enforced)

=======================================================
🎉 ALL 14 ATTENDANCE MANAGEMENT TESTS PASSED SUCCESSFULLY!
=======================================================
```

---

## Code Quality Gates
- **Prisma Migration**: `20260905135513_add_attendance` applied with partial unique index.
- **TypeScript Typecheck**: `npm run typecheck --workspace=@peoplepay360/api` passed with 0 errors.
- **Production Build**: `npm run build --workspace=@peoplepay360/api` compiled successfully.
- **Recommended Commit**: `feat(attendance): add attendance tracking`
