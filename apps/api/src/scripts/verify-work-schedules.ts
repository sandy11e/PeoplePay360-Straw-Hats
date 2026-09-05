import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import { DayOfWeek, EmploymentStatus, UserRole } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING WORK SCHEDULE VERIFICATION ===")

  // 1. Start ephemeral HTTP server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`

  console.log(`[Test Server] Listening on ${baseUrl}`)

  // 2. Generate tokens for different roles
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

  const employeeToken = await createAccessToken({
    userId: "00000000-0000-0000-0000-000000000004",
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
    // 3. Setup test employee, department, position if needed
    let dept = await prisma.department.findFirst()
    if (!dept) {
      dept = await prisma.department.create({
        data: { code: "TEST-DEP", name: "Test Department" },
      })
    }

    let pos = await prisma.jobPosition.findFirst()
    if (!pos) {
      pos = await prisma.jobPosition.create({
        data: { code: "TEST-POS", title: "Test Position" },
      })
    }

    const testEmpCode = `TEST-EMP-${Date.now()}`
    const employee = await prisma.employee.create({
      data: {
        employeeCode: testEmpCode,
        firstName: "Test",
        lastName: "Worker",
        workEmail: `${testEmpCode.toLowerCase()}@example.com`,
        joiningDate: new Date("2026-01-01"),
        employmentStatus: EmploymentStatus.ACTIVE,
        departmentId: dept.id,
        jobPositionId: pos.id,
      },
    })
    console.log(`[Setup] Created test employee ${employee.id}`)

    // 4. Test Schedule Validation Errors
    console.log("\n--- Testing Schedule Validation Rules ---")

    // 4a. Missing weekday (only 6 days provided)
    const resMissingDay = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: "INVALID_6DAYS",
        name: "Missing Sunday",
        days: [
          { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "SATURDAY", isWorkingDay: false },
        ],
      }),
    })
    console.log(`[Validation] Missing day rejected (status: ${resMissingDay.status})`, resMissingDay.data.error?.message ?? resMissingDay.data.error?.fields)
    if (resMissingDay.status !== 400) throw new Error("Expected 400 for missing day")

    // 4b. End time before start time
    const resEndBeforeStart = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: "INVALID_TIME",
        name: "End Before Start",
        days: [
          { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "17:00", endTime: "09:00", breakMinutes: 0 },
          { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "SATURDAY", isWorkingDay: false },
          { dayOfWeek: "SUNDAY", isWorkingDay: false },
        ],
      }),
    })
    console.log(`[Validation] End time <= start time rejected (status: ${resEndBeforeStart.status})`)
    if (resEndBeforeStart.status !== 400) throw new Error("Expected 400 for end time <= start time")

    // 4c. Negative break minutes
    const resNegBreak = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: "INVALID_BREAK",
        name: "Negative Break",
        days: [
          { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: -30 },
          { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 0 },
          { dayOfWeek: "SATURDAY", isWorkingDay: false },
          { dayOfWeek: "SUNDAY", isWorkingDay: false },
        ],
      }),
    })
    console.log(`[Validation] Negative break minutes rejected (status: ${resNegBreak.status})`)
    if (resNegBreak.status !== 400) throw new Error("Expected 400 for negative break")

    // 4d. Non-working day with work hours
    const resNonWorkingWithHours = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: "INVALID_NON_WORK",
        name: "Non Working With Hours",
        days: [
          { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "SATURDAY", isWorkingDay: false, startTime: "10:00" },
          { dayOfWeek: "SUNDAY", isWorkingDay: false },
        ],
      }),
    })
    console.log(`[Validation] Non-working day carrying work hours rejected (status: ${resNonWorkingWithHours.status})`)
    if (resNonWorkingWithHours.status !== 400) throw new Error("Expected 400 for non-working with hours")

    // 5. Successful Work Schedule Creation (40h Standard Week)
    console.log("\n--- Creating Valid Standard 40h Work Schedule ---")
    const validScheduleCode = `STD_40H_${Date.now()}`
    const resCreate = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: validScheduleCode,
        name: "Standard 40 Hour Week",
        timezone: "America/New_York",
        isActive: true,
        days: [
          { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "17:00", breakMinutes: 60 },
          { dayOfWeek: "SATURDAY", isWorkingDay: false },
          { dayOfWeek: "SUNDAY", isWorkingDay: false },
        ],
      }),
    }, hrToken)

    console.log(`[Create Schedule] Status: ${resCreate.status}`)
    if (resCreate.status !== 201) throw new Error(`Failed to create schedule: ${JSON.stringify(resCreate.data)}`)

    const createdSchedule = resCreate.data.schedule
    console.log(`[Create Schedule] ID: ${createdSchedule.id}, Code: ${createdSchedule.code}`)
    console.log(`[Create Schedule] Days count: ${createdSchedule.days.length}`)
    
    // Verify expected work duration safely calculated: (17:00 - 09:00 = 480m) - 60m break = 420m per working day
    const monday = createdSchedule.days.find((d: any) => d.dayOfWeek === "MONDAY")
    const saturday = createdSchedule.days.find((d: any) => d.dayOfWeek === "SATURDAY")
    console.log(`[Calculation Check] Monday expectedMinutes: ${monday.expectedMinutes} (expected: 420)`)
    console.log(`[Calculation Check] Saturday expectedMinutes: ${saturday.expectedMinutes} (expected: 0)`)
    if (monday.expectedMinutes !== 420 || saturday.expectedMinutes !== 0) {
      throw new Error("expectedMinutes calculation incorrect")
    }

    // 6. Test Unique Code constraint
    const resDupCode = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: validScheduleCode,
        name: "Duplicate Code Attempt",
        days: createdSchedule.days,
      }),
    })
    console.log(`[Validation] Duplicate code rejected (status: ${resDupCode.status}, code: ${resDupCode.data.error?.code})`)
    if (resDupCode.status !== 409) throw new Error("Expected 409 for duplicate code")

    // 7. Create Inactive Schedule for testing assignment rule
    const inactiveCode = `INACT_${Date.now()}`
    const resInactive = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: inactiveCode,
        name: "Inactive Schedule",
        isActive: false,
        days: [
          { dayOfWeek: "MONDAY", isWorkingDay: true, startTime: "08:00", endTime: "16:00", breakMinutes: 30 },
          { dayOfWeek: "TUESDAY", isWorkingDay: true, startTime: "08:00", endTime: "16:00", breakMinutes: 30 },
          { dayOfWeek: "WEDNESDAY", isWorkingDay: true, startTime: "08:00", endTime: "16:00", breakMinutes: 30 },
          { dayOfWeek: "THURSDAY", isWorkingDay: true, startTime: "08:00", endTime: "16:00", breakMinutes: 30 },
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "08:00", endTime: "16:00", breakMinutes: 30 },
          { dayOfWeek: "SATURDAY", isWorkingDay: false },
          { dayOfWeek: "SUNDAY", isWorkingDay: false },
        ],
      }),
    })
    const inactiveSchedule = resInactive.data.schedule

    // 8. GET work schedules
    console.log("\n--- Testing GET /work-schedules & GET /work-schedules/:id ---")
    const resList = await api(`/work-schedules?search=${validScheduleCode}`, {}, payrollToken)
    console.log(`[List Schedules] Status: ${resList.status}, total found: ${resList.data.pagination.total}`)
    if (resList.status !== 200 || resList.data.schedules.length === 0) throw new Error("GET /work-schedules failed")

    const resGetOne = await api(`/work-schedules/${createdSchedule.id}`, {}, payrollToken)
    console.log(`[Get Schedule By ID] Status: ${resGetOne.status}, schedule: ${resGetOne.data.schedule.name}`)
    if (resGetOne.status !== 200) throw new Error("GET /work-schedules/:id failed")

    // 9. PATCH /work-schedules/:id
    console.log("\n--- Testing PATCH /work-schedules/:id ---")
    const resPatch = await api(`/work-schedules/${createdSchedule.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "Updated 40 Hour Week",
        days: [
          { dayOfWeek: "FRIDAY", isWorkingDay: true, startTime: "09:00", endTime: "15:00", breakMinutes: 30 },
        ],
      }),
    }, hrToken)
    console.log(`[PATCH Schedule] Status: ${resPatch.status}`)
    const updatedFriday = resPatch.data.schedule.days.find((d: any) => d.dayOfWeek === "FRIDAY")
    // (15:00 - 09:00 = 360m) - 30m break = 330m
    console.log(`[PATCH Schedule] Friday updated expectedMinutes: ${updatedFriday.expectedMinutes} (expected: 330)`)
    if (updatedFriday.expectedMinutes !== 330) throw new Error("Friday expectedMinutes not updated correctly")

    // 10. Schedule Assignment & Overlap Protection
    console.log("\n--- Testing Schedule Assignment & Overlap Rules ---")

    // 10a. Assignment to non-existent employee
    const resNonExistentEmp = await api(`/employees/00000000-0000-0000-0000-000000000000/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2026-01-01",
      }),
    })
    console.log(`[Assignment] Non-existent employee rejected (status: ${resNonExistentEmp.status})`)
    if (resNonExistentEmp.status !== 404) throw new Error("Expected 404 for non-existent employee")

    // 10b. Assignment of inactive schedule
    const resAssignInactive = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: inactiveSchedule.id,
        effectiveFrom: "2026-01-01",
      }),
    })
    console.log(`[Assignment] Inactive schedule assignment rejected (status: ${resAssignInactive.status}, code: ${resAssignInactive.data.error?.code})`)
    if (resAssignInactive.status !== 400 || resAssignInactive.data.error?.code !== "SCHEDULE_INACTIVE") {
      throw new Error("Expected 400 SCHEDULE_INACTIVE for inactive schedule")
    }

    // 10c. First valid assignment: [2026-01-01 to 2026-06-30]
    const resAssign1 = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-06-30",
      }),
    }, hrToken)
    console.log(`[Assignment 1] Initial assignment created (status: ${resAssign1.status})`)
    if (resAssign1.status !== 201) throw new Error(`Failed to assign schedule: ${JSON.stringify(resAssign1.data)}`)

    // 10d. Overlapping assignment attempt [2026-04-01 to 2026-08-31]
    const resOverlap = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2026-04-01",
        effectiveTo: "2026-08-31",
      }),
    })
    console.log(`[Assignment Overlap] Overlapping assignment rejected (status: ${resOverlap.status}, code: ${resOverlap.data.error?.code})`)
    if (resOverlap.status !== 409 || resOverlap.data.error?.code !== "SCHEDULE_ASSIGNMENT_OVERLAP") {
      throw new Error("Expected 409 SCHEDULE_ASSIGNMENT_OVERLAP")
    }

    // 10e. Non-overlapping contiguous assignment: [2026-07-01 to null (open-ended)]
    const resAssign2 = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2026-07-01",
        // effectiveTo is null (ongoing)
      }),
    })
    console.log(`[Assignment 2] Ongoing assignment created (status: ${resAssign2.status})`)
    if (resAssign2.status !== 201) throw new Error("Failed to assign open-ended schedule")

    // 10f. Overlapping with open-ended assignment [2026-09-01 to null] WITHOUT closePrevious
    const resOverlapOngoing = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2026-09-01",
      }),
    })
    console.log(`[Assignment Overlap] Overlap with ongoing assignment rejected (status: ${resOverlapOngoing.status}, code: ${resOverlapOngoing.data.error?.code})`)
    if (resOverlapOngoing.status !== 409) throw new Error("Expected 409 for overlap with ongoing assignment")

    // 10g. Assignment with closePrevious: true -> closes previous ongoing assignment and preserves history!
    const resAssign3 = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2026-09-01",
        closePrevious: true,
      }),
    })
    console.log(`[Assignment 3 with closePrevious] Successfully assigned (status: ${resAssign3.status})`)
    if (resAssign3.status !== 201) throw new Error("Failed assignment with closePrevious: true")

    // 11. Historical Preservation Check
    console.log("\n--- Checking Historical Schedule Assignments ---")
    const resEmployeeSchedules = await api(`/employees/${employee.id}/work-schedules`, {}, payrollToken)
    console.log(`[Employee Assignments] Total records: ${resEmployeeSchedules.data.assignments.length}`)
    // We expect exactly 3 assignments:
    // 1) 2026-09-01 to null
    // 2) 2026-07-01 to 2026-08-31 (closed automatically by closePrevious)
    // 3) 2026-01-01 to 2026-06-30
    if (resEmployeeSchedules.data.assignments.length !== 3) {
      throw new Error(`Expected 3 historical assignments, got ${resEmployeeSchedules.data.assignments.length}`)
    }
    console.log("[Employee Assignments] Historical assignments preserved:")
    for (const a of resEmployeeSchedules.data.assignments) {
      console.log(`  - ID: ${a.id}, From: ${a.effectiveFrom}, To: ${a.effectiveTo ?? "Indefinite"}, Schedule: ${a.schedule.code}`)
    }

    // 12. Permissions check
    console.log("\n--- Checking Role Permissions ---")
    // Employee trying to create schedule
    const resEmpCreate = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: "EMP_FORBIDDEN",
        name: "Forbidden",
        days: createdSchedule.days,
      }),
    }, employeeToken)
    console.log(`[Permissions] Employee creating schedule rejected (status: ${resEmpCreate.status})`)
    if (resEmpCreate.status !== 403) throw new Error("Expected 403 for employee creating schedule")

    // Payroll trying to create schedule
    const resPayrollCreate = await api("/work-schedules", {
      method: "POST",
      body: JSON.stringify({
        code: "PAYROLL_FORBIDDEN",
        name: "Forbidden",
        days: createdSchedule.days,
      }),
    }, payrollToken)
    console.log(`[Permissions] Payroll creating schedule rejected (status: ${resPayrollCreate.status})`)
    if (resPayrollCreate.status !== 403) throw new Error("Expected 403 for payroll creating schedule")

    // Employee trying to assign schedule
    const resEmpAssign = await api(`/employees/${employee.id}/work-schedules`, {
      method: "POST",
      body: JSON.stringify({
        scheduleId: createdSchedule.id,
        effectiveFrom: "2027-01-01",
      }),
    }, employeeToken)
    console.log(`[Permissions] Employee assigning schedule rejected (status: ${resEmpAssign.status})`)
    if (resEmpAssign.status !== 403) throw new Error("Expected 403 for employee assigning schedule")

    console.log("\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")

    // Cleanup test data
    console.log("\n[Cleanup] Cleaning up test records...")
    await prisma.employeeScheduleAssignment.deleteMany({ where: { employeeId: employee.id } })
    await prisma.workScheduleDay.deleteMany({ where: { scheduleId: { in: [createdSchedule.id, inactiveSchedule.id] } } })
    await prisma.workSchedule.deleteMany({ where: { id: { in: [createdSchedule.id, inactiveSchedule.id] } } })
    await prisma.employee.delete({ where: { id: employee.id } })
    console.log("[Cleanup] Done.")

  } finally {
    server.close()
    await prisma.$disconnect()
  }
}

runVerification()
  .catch((err) => {
    console.error("\n❌ VERIFICATION FAILED:", err)
    process.exit(1)
  })
