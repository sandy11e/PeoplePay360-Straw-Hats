import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  AttendanceSource,
  AttendanceStatus,
  DayOfWeek,
  EmploymentStatus,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING ATTENDANCE MANAGEMENT VERIFICATION ===")

  // 1. Start ephemeral HTTP server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`

  console.log(`[Test Server] Listening on ${baseUrl}`)

  // 2. Setup database records for tests
  let dept = await prisma.department.findFirst()
  if (!dept) {
    dept = await prisma.department.create({
      data: { code: "ATT-DEP", name: "Attendance Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "ATT-POS", title: "Attendance Position" },
    })
  }

  // Active User + Employee
  const activeUser = await prisma.user.upsert({
    where: { email: "active.att.emp@example.com" },
    update: { isActive: true },
    create: {
      email: "active.att.emp@example.com",
      passwordHash: "dummyhash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const activeEmployee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-ATT-001" },
    update: {
      userId: activeUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-ATT-001",
      firstName: "Active",
      lastName: "Attendee",
      workEmail: "active.att.emp@example.com",
      joiningDate: new Date("2025-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: activeUser.id,
    },
  })

  // Inactive User + Employee
  const inactiveUser = await prisma.user.upsert({
    where: { email: "inactive.att.emp@example.com" },
    update: { isActive: true },
    create: {
      email: "inactive.att.emp@example.com",
      passwordHash: "dummyhash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const inactiveEmployee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-ATT-002" },
    update: {
      userId: inactiveUser.id,
      employmentStatus: EmploymentStatus.TERMINATED,
    },
    create: {
      employeeCode: "EMP-ATT-002",
      firstName: "Terminated",
      lastName: "Worker",
      workEmail: "inactive.att.emp@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.TERMINATED,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: inactiveUser.id,
    },
  })

  // Unlinked User (no employee record)
  const unlinkedUser = await prisma.user.upsert({
    where: { email: "unlinked.user@example.com" },
    update: { isActive: true },
    create: {
      email: "unlinked.user@example.com",
      passwordHash: "dummyhash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  // Clean previous attendances for our test employees
  await prisma.attendance.deleteMany({
    where: { employeeId: { in: [activeEmployee.id, inactiveEmployee.id] } },
  })

  // 3. Tokens
  const adminToken = await createAccessToken({
    userId: "00000000-0000-0000-0000-000000000001",
    role: UserRole.ADMIN,
  })

  const hrToken = await createAccessToken({
    userId: "00000000-0000-0000-0000-000000000002",
    role: UserRole.HR_MANAGER,
  })

  const payrollToken = await createAccessToken({
    userId: "00000000-0000-0000-0000-000000000003",
    role: UserRole.PAYROLL_USER,
  })

  const activeEmpToken = await createAccessToken({
    userId: activeUser.id,
    role: UserRole.EMPLOYEE,
  })

  const inactiveEmpToken = await createAccessToken({
    userId: inactiveUser.id,
    role: UserRole.EMPLOYEE,
  })

  const unlinkedUserToken = await createAccessToken({
    userId: unlinkedUser.id,
    role: UserRole.EMPLOYEE,
  })

  // Helper fetch with auth
  async function api(path: string, options: RequestInit = {}, token = adminToken) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
    const data = await res.json()
    return { status: res.status, data }
  }

  try {
    // --- TEST 1: Unlinked user self check-in rejected ---
    console.log("\n[TEST 1] Unlinked user self check-in rejection")
    const resUnlinked = await api("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ notes: "Unlinked user checking in" }),
    }, unlinkedUserToken)

    console.log(`Status: ${resUnlinked.status}, Code: ${resUnlinked.data?.error?.code}`)
    if (resUnlinked.status !== 400 || resUnlinked.data?.error?.code !== "USER_NOT_LINKED_TO_EMPLOYEE") {
      throw new Error("Expected 400 USER_NOT_LINKED_TO_EMPLOYEE")
    }
    console.log("✔ TEST 1 PASSED")

    // --- TEST 2: Inactive employee self check-in rejected ---
    console.log("\n[TEST 2] Inactive employee self check-in rejection")
    const resInactive = await api("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ notes: "Inactive worker" }),
    }, inactiveEmpToken)

    console.log(`Status: ${resInactive.status}, Code: ${resInactive.data?.error?.code}`)
    if (resInactive.status !== 400 || resInactive.data?.error?.code !== "EMPLOYEE_NOT_ACTIVE") {
      throw new Error("Expected 400 EMPLOYEE_NOT_ACTIVE")
    }
    console.log("✔ TEST 2 PASSED")

    // --- TEST 3: Active employee self check-in ---
    console.log("\n[TEST 3] Active employee self check-in")
    const checkInTime = new Date("2026-09-05T08:50:00Z")
    const resCheckIn = await api("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({
        notes: "Morning shift check-in",
        checkInAt: checkInTime.toISOString(),
      }),
    }, activeEmpToken)

    console.log(`Status: ${resCheckIn.status}, Attendance ID: ${resCheckIn.data?.attendance?.id}, Status: ${resCheckIn.data?.attendance?.status}`)
    if (resCheckIn.status !== 201 || !resCheckIn.data?.attendance?.id) {
      throw new Error("Expected 201 Created with attendance record")
    }
    if (resCheckIn.data.attendance.checkOutAt !== null || resCheckIn.data.attendance.workedMinutes !== null) {
      throw new Error("checkOutAt and workedMinutes should be null on check-in")
    }
    console.log("✔ TEST 3 PASSED")

    // --- TEST 4: Open session conflict (cannot have multiple open sessions) ---
    console.log("\n[TEST 4] Open session conflict prevention")
    const resConflict = await api("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({ notes: "Duplicate check-in attempt" }),
    }, activeEmpToken)

    console.log(`Status: ${resConflict.status}, Code: ${resConflict.data?.error?.code}`)
    if (resConflict.status !== 409 || resConflict.data?.error?.code !== "ATTENDANCE_SESSION_ALREADY_OPEN") {
      throw new Error("Expected 409 ATTENDANCE_SESSION_ALREADY_OPEN")
    }
    console.log("✔ TEST 4 PASSED")

    // --- TEST 5: Active employee self check-out ---
    console.log("\n[TEST 5] Active employee self check-out")
    const checkOutTime = new Date("2026-09-05T17:20:00Z") // 8 hours 30 mins = 510 mins
    const resCheckOut = await api("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({
        notes: "Shift complete",
        checkOutAt: checkOutTime.toISOString(),
      }),
    }, activeEmpToken)

    console.log(`Status: ${resCheckOut.status}, workedMinutes: ${resCheckOut.data?.attendance?.workedMinutes}`)
    if (resCheckOut.status !== 200 || resCheckOut.data?.attendance?.workedMinutes !== 510) {
      throw new Error(`Expected 200 with workedMinutes = 510, got ${resCheckOut.data?.attendance?.workedMinutes}`)
    }
    console.log("✔ TEST 5 PASSED")

    // --- TEST 6: Check-out when no open session exists ---
    console.log("\n[TEST 6] Check-out without open session rejection")
    const resCheckOutNoSession = await api("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({ notes: "Ghost checkout" }),
    }, activeEmpToken)

    console.log(`Status: ${resCheckOutNoSession.status}, Code: ${resCheckOutNoSession.data?.error?.code}`)
    if (resCheckOutNoSession.status !== 404 || resCheckOutNoSession.data?.error?.code !== "NO_ACTIVE_ATTENDANCE_SESSION") {
      throw new Error("Expected 404 NO_ACTIVE_ATTENDANCE_SESSION")
    }
    console.log("✔ TEST 6 PASSED")

    // --- TEST 7: Work schedule integration & Late detection ---
    console.log("\n[TEST 7] Work schedule integration & Late arrival status")
    // Clean up or create standard schedule
    const schedCode = "ATT-STANDARD-SCHED"
    let sched = await prisma.workSchedule.findUnique({ where: { code: schedCode } })
    if (!sched) {
      sched = await prisma.workSchedule.create({
        data: {
          code: schedCode,
          name: "Standard Attendance Schedule",
          timezone: "UTC",
          days: {
            create: [
              { dayOfWeek: DayOfWeek.MONDAY, isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60, expectedMinutes: 420 },
              { dayOfWeek: DayOfWeek.TUESDAY, isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60, expectedMinutes: 420 },
              { dayOfWeek: DayOfWeek.WEDNESDAY, isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60, expectedMinutes: 420 },
              { dayOfWeek: DayOfWeek.THURSDAY, isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60, expectedMinutes: 420 },
              { dayOfWeek: DayOfWeek.FRIDAY, isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60, expectedMinutes: 420 },
              { dayOfWeek: DayOfWeek.SATURDAY, isWorkingDay: false, breakMinutes: 0, expectedMinutes: 0 },
              { dayOfWeek: DayOfWeek.SUNDAY, isWorkingDay: false, breakMinutes: 0, expectedMinutes: 0 },
            ],
          },
        },
      })
    }

    // Assign schedule to active employee effective 2026-09-01
    await prisma.employeeScheduleAssignment.deleteMany({
      where: { employeeId: activeEmployee.id },
    })
    await prisma.employeeScheduleAssignment.create({
      data: {
        employeeId: activeEmployee.id,
        scheduleId: sched.id,
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
      },
    })

    // 2026-09-07 is a Monday. Expected start is 09:00.
    // Check in at 09:35 -> Should be LATE!
    const lateCheckInTime = new Date("2026-09-07T09:35:00.000Z")
    const resLate = await api("/attendance/check-in", {
      method: "POST",
      body: JSON.stringify({
        notes: "Late arrival due to traffic",
        checkInAt: lateCheckInTime.toISOString(),
      }),
    }, activeEmpToken)

    console.log(`Status: ${resLate.status}, Attendance Status: ${resLate.data?.attendance?.status}`)
    if (resLate.status !== 201 || resLate.data?.attendance?.status !== "LATE") {
      throw new Error(`Expected status LATE, got ${resLate.data?.attendance?.status}`)
    }

    // Close session
    await api("/attendance/check-out", {
      method: "POST",
      body: JSON.stringify({
        checkOutAt: new Date("2026-09-07T17:00:00.000Z").toISOString(),
      }),
    }, activeEmpToken)
    console.log("✔ TEST 7 PASSED (Schedule evaluated LATE correctly)")

    // --- TEST 8: Manual attendance creation by HR Manager ---
    console.log("\n[TEST 8] Manual attendance creation by HR_MANAGER")
    const manualCheckIn = new Date("2026-09-08T09:00:00.000Z")
    const manualCheckOut = new Date("2026-09-08T18:00:00.000Z") // 9 hours = 540 mins

    const resManual = await api("/attendance/manual", {
      method: "POST",
      body: JSON.stringify({
        employeeId: activeEmployee.id,
        attendanceDate: "2026-09-08",
        checkInAt: manualCheckIn.toISOString(),
        checkOutAt: manualCheckOut.toISOString(),
        status: AttendanceStatus.PRESENT,
        source: AttendanceSource.MANUAL,
        notes: "Adjusted by HR",
        workedMinutes: 99999, // Should be ignored/computed server-side
      }),
    }, hrToken)

    console.log(`Status: ${resManual.status}, Attendance ID: ${resManual.data?.attendance?.id}, workedMinutes: ${resManual.data?.attendance?.workedMinutes}`)
    if (resManual.status !== 201) {
      throw new Error(`Expected 201 Created, got ${resManual.status}`)
    }
    if (resManual.data.attendance.workedMinutes !== 540) {
      throw new Error(`Client workedMinutes was not ignored! Expected 540, got ${resManual.data.attendance.workedMinutes}`)
    }
    const manualRecordId = resManual.data.attendance.id
    console.log("✔ TEST 8 PASSED (Server-side calculation enforced)")

    // --- TEST 9: Manual creation validation: checkOutAt cannot precede checkInAt ---
    console.log("\n[TEST 9] Manual creation time range validation")
    const resInvalidRange = await api("/attendance/manual", {
      method: "POST",
      body: JSON.stringify({
        employeeId: activeEmployee.id,
        attendanceDate: "2026-09-09",
        checkInAt: "2026-09-09T17:00:00.000Z",
        checkOutAt: "2026-09-09T09:00:00.000Z", // Precedes checkInAt!
      }),
    }, hrToken)

    console.log(`Status: ${resInvalidRange.status}, Message: ${JSON.stringify(resInvalidRange.data?.error)}`)
    if (resInvalidRange.status !== 400) {
      throw new Error("Expected 400 for checkOutAt < checkInAt")
    }
    console.log("✔ TEST 9 PASSED")

    // --- TEST 10: Attendance update by Admin (PATCH /api/v1/attendance/:id) ---
    console.log("\n[TEST 10] Attendance update by ADMIN")
    const updatedCheckOut = new Date("2026-09-08T19:00:00.000Z") // 10 hours = 600 mins
    const resPatch = await api(`/attendance/${manualRecordId}`, {
      method: "PATCH",
      body: JSON.stringify({
        checkOutAt: updatedCheckOut.toISOString(),
        notes: "Updated overtime hours",
      }),
    }, adminToken)

    console.log(`Status: ${resPatch.status}, Recalculated workedMinutes: ${resPatch.data?.attendance?.workedMinutes}`)
    if (resPatch.status !== 200 || resPatch.data?.attendance?.workedMinutes !== 600) {
      throw new Error(`Expected 200 with workedMinutes = 600, got ${resPatch.data?.attendance?.workedMinutes}`)
    }
    console.log("✔ TEST 10 PASSED")

    // --- TEST 11: Single Attendance Retrieval (GET /api/v1/attendance/:id) ---
    console.log("\n[TEST 11] Single attendance retrieval")
    const resGet = await api(`/attendance/${manualRecordId}`, { method: "GET" }, activeEmpToken)
    console.log(`Status: ${resGet.status}, Notes: ${resGet.data?.attendance?.notes}`)
    if (resGet.status !== 200 || resGet.data?.attendance?.id !== manualRecordId) {
      throw new Error("Expected 200 with attendance record")
    }
    console.log("✔ TEST 11 PASSED")

    // --- TEST 12: List Attendances with filters and pagination (GET /api/v1/attendance) ---
    console.log("\n[TEST 12] List Attendances with filters and pagination")
    const resList = await api("/attendance?from=2026-09-05&to=2026-09-08&page=1&pageSize=10", {
      method: "GET",
    }, payrollToken) // Payroll role can read

    console.log(`Status: ${resList.status}, Total: ${resList.data?.pagination?.total}, Items: ${resList.data?.attendance?.length}`)
    if (resList.status !== 200 || resList.data?.pagination?.total < 3) {
      throw new Error("Expected 200 with attendance list")
    }
    console.log("✔ TEST 12 PASSED")

    // --- TEST 13: Employee subroute (GET /api/v1/employees/:employeeId/attendance) ---
    console.log("\n[TEST 13] Employee subroute GET /api/v1/employees/:employeeId/attendance")
    const resEmpRoute = await api(`/employees/${activeEmployee.id}/attendance?from=2026-09-01`, {
      method: "GET",
    }, activeEmpToken)

    console.log(`Status: ${resEmpRoute.status}, Total: ${resEmpRoute.data?.pagination?.total}`)
    if (resEmpRoute.status !== 200 || resEmpRoute.data?.pagination?.total < 3) {
      throw new Error("Expected 200 with employee attendance list")
    }
    console.log("✔ TEST 13 PASSED")

    // --- TEST 14: Role permissions security checks ---
    console.log("\n[TEST 14] Role permissions security checks")
    // Payroll role attempting manual creation -> 403
    const resPayrollManual = await api("/attendance/manual", {
      method: "POST",
      body: JSON.stringify({
        employeeId: activeEmployee.id,
        attendanceDate: "2026-09-10",
        checkInAt: "2026-09-10T09:00:00.000Z",
      }),
    }, payrollToken)

    console.log(`Payroll manual creation status: ${resPayrollManual.status}`)
    if (resPayrollManual.status !== 403) {
      throw new Error(`Expected 403 for Payroll manual creation, got ${resPayrollManual.status}`)
    }

    // Employee role attempting PATCH -> 403
    const resEmpPatch = await api(`/attendance/${manualRecordId}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: "Employee trying to edit" }),
    }, activeEmpToken)

    console.log(`Employee PATCH status: ${resEmpPatch.status}`)
    if (resEmpPatch.status !== 403) {
      throw new Error(`Expected 403 for Employee PATCH, got ${resEmpPatch.status}`)
    }

    // Employee role attempting to query other employee's records -> 403
    const resOtherEmp = await api(`/employees/${inactiveEmployee.id}/attendance`, {
      method: "GET",
    }, activeEmpToken)

    console.log(`Employee accessing other employee status: ${resOtherEmp.status}`)
    if (resOtherEmp.status !== 403) {
      throw new Error(`Expected 403 for Employee accessing another employee's records, got ${resOtherEmp.status}`)
    }
    console.log("✔ TEST 14 PASSED (Role security boundaries strictly enforced)")

    console.log("\n=======================================================")
    console.log("🎉 ALL 14 ATTENDANCE MANAGEMENT TESTS PASSED SUCCESSFULLY!")
    console.log("=======================================================")
  } finally {
    server.close()
    await prisma.$disconnect()
  }
}

runVerification().catch((error) => {
  console.error("❌ VERIFICATION FAILED:", error)
  process.exit(1)
})
