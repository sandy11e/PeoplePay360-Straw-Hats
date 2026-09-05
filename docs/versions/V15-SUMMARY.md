# STEP 15: Work Schedule Management

**Date Completed:** 2026-09-05  
**Status:** ✅ Complete  
**Commit Message:** `feat(schedule): add employee work schedules`

---

## Overview

STEP 15 implemented a reusable work schedule management and assignment system for PeoplePay360. Work schedules define weekly templates covering standard business hours, shift timings, and expected work duration across all seven weekdays (`MONDAY` through `SUNDAY`). Schedules are assignable to employees with strict date-overlap protection while preserving historical schedule assignments.

**Key Highlights:**
- **Relational Work Schedule Architecture**: Normalized schema separating schedules, daily timing templates, and employee assignment records.
- **7-Day Schedule Integrity**: Exactly one entry per weekday per schedule.
- **Safe Working Hour & Duration Rules**: Strict validation that working days have start/end times (`HH:mm`), end logically follows start, break minutes are non-negative and do not exceed shift length, and `expectedMinutes` is computed automatically.
- **Non-Working Day Sanitization**: Non-working days strictly disallow work hours and break minutes (`expectedMinutes = 0`).
- **Conflict-Free Assignments**: Algorithmically prevents overlapping schedule assignments for the same employee across open and bounded date ranges.
- **Historical Assignment Preservation**: Schedule reassignments preserve past assignments; optional `closePrevious` flag automatically bounds previous open-ended assignments.
- **Role-Based Access Control**:
  - `ADMIN` & `HR_MANAGER`: Create, update schedules and assign them to employees.
  - `PAYROLL_MANAGER` & `PAYROLL_USER`: Read-only access to work schedules and employee assignments.
  - `EMPLOYEE`: Access restricted (personal schedule view planned for future phase).

---

## Database Schema & Migration

### Migration
- **Name:** `add_work_schedules`
- **Migration Directory:** `apps/api/prisma/migrations/20260905134942_add_work_schedules/migration.sql`

### 1. Enum: `DayOfWeek`

```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}
```

### 2. Model: `WorkSchedule`

```prisma
model WorkSchedule {
  id        String   @id @default(uuid()) @db.Uuid
  code      String   @unique @db.VarChar(30)
  name      String   @db.VarChar(120)
  timezone  String   @default("UTC") @db.VarChar(50)
  isActive  Boolean  @default(true) @map("is_active")

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  days        WorkScheduleDay[]
  assignments EmployeeScheduleAssignment[]

  @@map("work_schedules")
}
```

### 3. Model: `WorkScheduleDay`

```prisma
model WorkScheduleDay {
  id              String       @id @default(uuid()) @db.Uuid
  scheduleId      String       @map("schedule_id") @db.Uuid
  schedule        WorkSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)

  dayOfWeek       DayOfWeek    @map("day_of_week")
  isWorkingDay    Boolean      @default(true) @map("is_working_day")

  startTime       String?      @map("start_time") @db.VarChar(5)
  endTime         String?      @map("end_time") @db.VarChar(5)

  breakMinutes    Int          @default(0) @map("break_minutes")
  expectedMinutes Int          @default(0) @map("expected_minutes")

  @@unique([scheduleId, dayOfWeek])
  @@index([scheduleId])
  @@map("work_schedule_days")
}
```

### 4. Model: `EmployeeScheduleAssignment`

```prisma
model EmployeeScheduleAssignment {
  id            String       @id @default(uuid()) @db.Uuid
  employeeId    String       @map("employee_id") @db.Uuid
  employee      Employee     @relation(fields: [employeeId], references: [id], onDelete: Restrict)

  scheduleId    String       @map("schedule_id") @db.Uuid
  schedule      WorkSchedule @relation(fields: [scheduleId], references: [id], onDelete: Restrict)

  effectiveFrom DateTime     @map("effective_from") @db.Date
  effectiveTo   DateTime?    @map("effective_to") @db.Date

  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime     @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([employeeId])
  @@index([scheduleId])
  @@index([effectiveFrom])
  @@index([effectiveTo])
  @@map("employee_schedule_assignments")
}
```

---

## Business Logic & Validation Rules

### 1. Work Schedule Day Validation
- **Time Format:** 24-hour clock string matching `/^([01]\d|2[0-3]):[0-5]\d$/` (e.g. `"09:00"`, `"17:30"`).
- **Working Days (`isWorkingDay: true`):**
  - Requires valid `startTime` and `endTime`.
  - `endTime` must logically follow `startTime` (`endMinutes > startMinutes`).
  - `breakMinutes` must be $\ge 0$ and strictly less than total duration (`endMinutes - startMinutes`).
  - `expectedMinutes` is calculated safely:  
    $$\text{expectedMinutes} = (\text{endMinutes} - \text{startMinutes}) - \text{breakMinutes}$$
- **Non-Working Days (`isWorkingDay: false`):**
  - `startTime` and `endTime` must not be provided or must be `null`.
  - `breakMinutes` must be $0$.
  - `expectedMinutes` is automatically $0$.

### 2. Schedule Creation Integrity
- Schedulers must submit an array of exactly 7 days.
- Every enum entry in `DayOfWeek` (`MONDAY` ... `SUNDAY`) must appear exactly once.
- Duplicate day definitions are rejected with a 400 validation error.

### 3. Schedule Assignment & Overlap Protection
When assigning a schedule via `POST /api/v1/employees/:employeeId/work-schedules`:
- **Entity Existence:** Employee and WorkSchedule must both exist (returns 404 if not found).
- **Active Schedule Check:** The schedule must have `isActive: true`. Inactive schedules are rejected with `400 SCHEDULE_INACTIVE`.
- **Date Consistency:** `effectiveTo` (if specified) must be $\ge$ `effectiveFrom`.
- **Overlap Prevention Algorithm:**
  Two date intervals $[A_{\text{from}}, A_{\text{to}}]$ and $[B_{\text{from}}, B_{\text{to}}]$ overlap if and only if:
  $$B_{\text{from}} \le (A_{\text{to}} \text{ or } \infty) \quad \text{AND} \quad (B_{\text{to}} \text{ or } \infty) \ge A_{\text{from}}$$
  Any overlap results in `409 SCHEDULE_ASSIGNMENT_OVERLAP`.
- **Historical Preservation & `closePrevious` Option:**
  - Standard assignment rejects conflicts to prevent unintentional overwriting.
  - Specifying `closePrevious: true` identifies an existing open-ended assignment (`effectiveTo: null`) starting before the new assignment, and automatically closes it at:
    $$\text{effectiveTo}_{\text{previous}} = \text{newEffectiveFrom} - 1\text{ day}$$
  - The historical record remains stored in the database for auditing and payroll back-calculations.

---

## Role-Based Access Control

| Action / Endpoint | Allowed Roles | Forbidden Roles |
| :--- | :--- | :--- |
| `POST /api/v1/work-schedules` | `ADMIN`, `HR_MANAGER` | `PAYROLL_*`, `EMPLOYEE` |
| `GET /api/v1/work-schedules` | `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER` | `EMPLOYEE` |
| `GET /api/v1/work-schedules/:id` | `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER` | `EMPLOYEE` |
| `PATCH /api/v1/work-schedules/:id` | `ADMIN`, `HR_MANAGER` | `PAYROLL_*`, `EMPLOYEE` |
| `POST /api/v1/employees/:id/work-schedules` | `ADMIN`, `HR_MANAGER` | `PAYROLL_*`, `EMPLOYEE` |
| `GET /api/v1/employees/:id/work-schedules` | `ADMIN`, `HR_MANAGER`, `PAYROLL_MANAGER`, `PAYROLL_USER` | `EMPLOYEE` |

---

## API Documentation

### 1. Create Work Schedule
- **URL:** `POST /api/v1/work-schedules`
- **Auth:** Bearer Token (`ADMIN`, `HR_MANAGER`)
- **Request Body:**
  ```json
  {
    "code": "STD_40H",
    "name": "Standard 40 Hour Week",
    "timezone": "America/New_York",
    "isActive": true,
    "days": [
      { "dayOfWeek": "MONDAY", "isWorkingDay": true, "startTime": "09:00", "endTime": "17:00", "breakMinutes": 60 },
      { "dayOfWeek": "TUESDAY", "isWorkingDay": true, "startTime": "09:00", "endTime": "17:00", "breakMinutes": 60 },
      { "dayOfWeek": "WEDNESDAY", "isWorkingDay": true, "startTime": "09:00", "endTime": "17:00", "breakMinutes": 60 },
      { "dayOfWeek": "THURSDAY", "isWorkingDay": true, "startTime": "09:00", "endTime": "17:00", "breakMinutes": 60 },
      { "dayOfWeek": "FRIDAY", "isWorkingDay": true, "startTime": "09:00", "endTime": "17:00", "breakMinutes": 60 },
      { "dayOfWeek": "SATURDAY", "isWorkingDay": false },
      { "dayOfWeek": "SUNDAY", "isWorkingDay": false }
    ]
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "schedule": {
      "id": "3e231672-89f8-41c9-890e-552b649b5413",
      "code": "STD_40H",
      "name": "Standard 40 Hour Week",
      "timezone": "America/New_York",
      "isActive": true,
      "createdAt": "2026-09-05T13:49:50.000Z",
      "updatedAt": "2026-09-05T13:49:50.000Z",
      "days": [
        {
          "id": "...",
          "scheduleId": "3e231672-89f8-41c9-890e-552b649b5413",
          "dayOfWeek": "MONDAY",
          "isWorkingDay": true,
          "startTime": "09:00",
          "endTime": "17:00",
          "breakMinutes": 60,
          "expectedMinutes": 420
        },
        ...
        {
          "id": "...",
          "scheduleId": "3e231672-89f8-41c9-890e-552b649b5413",
          "dayOfWeek": "SUNDAY",
          "isWorkingDay": false,
          "startTime": null,
          "endTime": null,
          "breakMinutes": 0,
          "expectedMinutes": 0
        }
      ]
    }
  }
  ```

### 2. List Work Schedules
- **URL:** `GET /api/v1/work-schedules?page=1&pageSize=20&isActive=true&search=STD`
- **Auth:** Bearer Token (`ADMIN`, `HR_MANAGER`, `PAYROLL_*`)
- **Response:** `200 OK`
  ```json
  {
    "schedules": [
      {
        "id": "3e231672-89f8-41c9-890e-552b649b5413",
        "code": "STD_40H",
        "name": "Standard 40 Hour Week",
        "timezone": "America/New_York",
        "isActive": true,
        "days": [ ... ],
        "_count": { "assignments": 1 }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
  ```

### 3. Get Work Schedule by ID
- **URL:** `GET /api/v1/work-schedules/:id`
- **Auth:** Bearer Token (`ADMIN`, `HR_MANAGER`, `PAYROLL_*`)
- **Response:** `200 OK` (with days sorted Monday through Sunday)

### 4. Update Work Schedule
- **URL:** `PATCH /api/v1/work-schedules/:id`
- **Auth:** Bearer Token (`ADMIN`, `HR_MANAGER`)
- **Request Body:**
  ```json
  {
    "name": "Summer Standard 40H Week",
    "days": [
      {
        "dayOfWeek": "FRIDAY",
        "isWorkingDay": true,
        "startTime": "08:00",
        "endTime": "14:00",
        "breakMinutes": 0
      }
    ]
  }
  ```
- **Response:** `200 OK`

### 5. Assign Work Schedule to Employee
- **URL:** `POST /api/v1/employees/:employeeId/work-schedules`
- **Auth:** Bearer Token (`ADMIN`, `HR_MANAGER`)
- **Request Body:**
  ```json
  {
    "scheduleId": "3e231672-89f8-41c9-890e-552b649b5413",
    "effectiveFrom": "2026-07-01",
    "effectiveTo": null,
    "closePrevious": true
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "assignment": {
      "id": "f145b312-2a94-4d54-b99f-b19df6af4f90",
      "employeeId": "8d65b36f-dd5f-415a-9fd9-c9e508a2be8b",
      "scheduleId": "3e231672-89f8-41c9-890e-552b649b5413",
      "effectiveFrom": "2026-07-01T00:00:00.000Z",
      "effectiveTo": null,
      "createdAt": "2026-09-05T13:51:00.000Z",
      "updatedAt": "2026-09-05T13:51:00.000Z",
      "schedule": {
        "id": "3e231672-89f8-41c9-890e-552b649b5413",
        "code": "STD_40H",
        "name": "Standard 40 Hour Week",
        "timezone": "America/New_York",
        "isActive": true
      }
    }
  }
  ```

### 6. Get Employee Schedule Assignments
- **URL:** `GET /api/v1/employees/:employeeId/work-schedules?activeOnly=false`
- **Auth:** Bearer Token (`ADMIN`, `HR_MANAGER`, `PAYROLL_*`)
- **Response:** `200 OK` (returns full assignment history with schedules and daily timings)

---

## Verification & Quality Gates

1. **TypeScript Typecheck:**
   - Command: `npm run typecheck --workspace=@peoplepay360/api`
   - Result: Passed with zero errors.
2. **Build Verification:**
   - Command: `npm run build --workspace=@peoplepay360/api`
   - Result: Successfully compiled `dist/` bundle.
3. **End-to-End Suite (`verify-work-schedules.ts`):**
   - Validated 7-day schedule creation and `expectedMinutes` calculation.
   - Validated rejection of missing weekdays (400).
   - Validated rejection of invalid shift timings: `endTime <= startTime` (400).
   - Validated rejection of negative break minutes (400).
   - Validated rejection of non-working days carrying work hours (400).
   - Validated duplicate code uniqueness constraint (409).
   - Validated rejection of assignments using inactive schedules (`SCHEDULE_INACTIVE`, 400).
   - Validated rejection of overlapping employee schedule assignments (`SCHEDULE_ASSIGNMENT_OVERLAP`, 409).
   - Validated automatic closing of open-ended assignments with `closePrevious: true`.
   - Validated preservation of historical assignment timelines.
   - Validated role-based permissions for Admin, HR Manager, Payroll, and Employee roles.
