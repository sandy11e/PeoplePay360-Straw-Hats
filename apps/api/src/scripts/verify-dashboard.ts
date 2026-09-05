import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  AttendanceSource,
  AttendanceStatus,
  EmploymentStatus,
  LeaveRequestStatus,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING DASHBOARD AND REPORTING APIS VERIFICATION ===")

  // 1. Ephemeral server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`

  console.log(`[Test Server] Listening on ${baseUrl}`)

  // 2. Setup database entities
  let dept = await prisma.department.findFirst()
  if (!dept) {
    dept = await prisma.department.create({
      data: { code: "DASH-DEP", name: "Dashboard Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "DASH-POS", title: "Dashboard Position" },
    })
  }

  let leaveType = await prisma.leaveType.findFirst()
  if (!leaveType) {
    leaveType = await prisma.leaveType.create({
      data: {
        code: "ANNUAL",
        name: "Annual Leave",
        isPaid: true,
      },
    })
  }

  // Users
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.dash@example.com" },
    update: { isActive: true },
    create: {
      email: "admin.dash@example.com",
      passwordHash: "hash",
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  const hrUser = await prisma.user.upsert({
    where: { email: "hr.dash@example.com" },
    update: { isActive: true },
    create: {
      email: "hr.dash@example.com",
      passwordHash: "hash",
      role: UserRole.HR_MANAGER,
      isActive: true,
    },
  })

  const pmUser = await prisma.user.upsert({
    where: { email: "pm.dash@example.com" },
    update: { isActive: true },
    create: {
      email: "pm.dash@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_MANAGER,
      isActive: true,
    },
  })

  const puUser = await prisma.user.upsert({
    where: { email: "pu.dash@example.com" },
    update: { isActive: true },
    create: {
      email: "pu.dash@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_USER,
      isActive: true,
    },
  })

  const empUser = await prisma.user.upsert({
    where: { email: "emp.dash@example.com" },
    update: { isActive: true },
    create: {
      email: "emp.dash@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  // Employee: Alice Dashboard
  const emp = await prisma.employee.upsert({
    where: { employeeCode: "EMP-DASH-01" },
    update: {
      userId: empUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-DASH-01",
      firstName: "Alice",
      lastName: "Dashboard",
      workEmail: "alice.dash@example.com",
      joiningDate: new Date("2024-01-15"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empUser.id,
    },
  })

  // Attendance for today
  const todayDate = new Date(`${new Date().toISOString().split("T")[0]}T00:00:00.000Z`)
  await prisma.attendance.upsert({
    where: {
      id: "00000000-0000-0000-0000-000000000001",
    },
    update: {
      attendanceDate: todayDate,
      status: AttendanceStatus.PRESENT,
    },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      employeeId: emp.id,
      attendanceDate: todayDate,
      checkInAt: new Date(),
      status: AttendanceStatus.PRESENT,
      source: AttendanceSource.WEB,
    },
  })

  // Pending leave request
  await prisma.leaveRequest.create({
    data: {
      employeeId: emp.id,
      leaveTypeId: leaveType.id,
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-05"),
      requestedDays: 5,
      status: LeaveRequestStatus.PENDING,
      reason: "Holiday break",
    },
  })

  // Tokens
  const adminToken = await createAccessToken({ userId: adminUser.id, role: adminUser.role })
  const hrToken = await createAccessToken({ userId: hrUser.id, role: hrUser.role })
  const pmToken = await createAccessToken({ userId: pmUser.id, role: pmUser.role })
  const puToken = await createAccessToken({ userId: puUser.id, role: puUser.role })
  const empToken = await createAccessToken({ userId: empUser.id, role: empUser.role })

  async function api(method: string, endpoint: string, token?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${baseUrl}${endpoint}`, { method, headers })
    const text = await res.text()
    try {
      return { status: res.status, data: JSON.parse(text) }
    } catch {
      return { status: res.status, data: text }
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: HR Dashboard (GET /dashboard/hr) & Privacy Isolation
    // ----------------------------------------------------
    console.log("\n[TEST 1] HR Dashboard & Privacy Isolation")
    // HR Manager access -> 200
    const hrRes = await api("GET", "/dashboard/hr", hrToken)
    console.log(`HR Manager accessing /dashboard/hr: ${hrRes.status}`)
    if (hrRes.status !== 200) {
      throw new Error(`Expected 200 for HR Manager on /dashboard/hr, got ${hrRes.status}`)
    }

    const hrData = hrRes.data.data
    console.log(
      `HR Metrics: Total Employees: ${hrData.totalEmployees}, Active: ${hrData.activeEmployees}, Today Marked: ${hrData.attendanceToday?.totalMarked}, Pending Leaves: ${hrData.pendingLeaveRequests}, Depts: ${hrData.departmentCounts?.length}`,
    )

    // Verify zero salary leakage
    const hrString = JSON.stringify(hrData).toLowerCase()
    if (
      hrString.includes("basesalary") ||
      hrString.includes("grosspayroll") ||
      hrString.includes("netpayroll") ||
      hrString.includes("totaldeductions")
    ) {
      throw new Error("HR Dashboard leaked confidential compensation fields!")
    }
    console.log("Verified zero salary/compensation data leaked in HR dashboard.")

    // Unauthorized role checks
    const empHrRes = await api("GET", "/dashboard/hr", empToken)
    console.log(`Employee accessing /dashboard/hr: ${empHrRes.status}`)
    if (empHrRes.status !== 403) {
      throw new Error("Expected 403 for Employee on /dashboard/hr")
    }

    const puHrRes = await api("GET", "/dashboard/hr", puToken)
    console.log(`Payroll User accessing /dashboard/hr: ${puHrRes.status}`)
    if (puHrRes.status !== 403) {
      throw new Error("Expected 403 for Payroll User on /dashboard/hr")
    }
    console.log("✔ TEST 1 PASSED")

    // ----------------------------------------------------
    // TEST 2: Payroll Dashboard (GET /dashboard/payroll) & Access Guards
    // ----------------------------------------------------
    console.log("\n[TEST 2] Payroll Dashboard & Access Guards")
    // Payroll User access -> 200
    const puPayrollRes = await api("GET", "/dashboard/payroll", puToken)
    console.log(`Payroll User accessing /dashboard/payroll: ${puPayrollRes.status}`)
    if (puPayrollRes.status !== 200) {
      throw new Error(`Expected 200 for Payroll User on /dashboard/payroll, got ${puPayrollRes.status}`)
    }

    const prData = puPayrollRes.data.data
    console.log(
      `Payroll Metrics: Latest Payrun: ${prData.latestPayrun?.code || "None"}, Validated Gross: ${prData.grossPayroll}, Net: ${prData.netPayroll}, Unpaid Slips: ${prData.unpaidPayslipsCount}, Warnings Count: ${prData.recentPayrollWarnings?.length}`,
    )

    // Payroll Manager access -> 200
    const pmPayrollRes = await api("GET", "/dashboard/payroll", pmToken)
    if (pmPayrollRes.status !== 200) throw new Error("Expected 200 for Payroll Manager")

    // Admin access -> 200
    const adminPayrollRes = await api("GET", "/dashboard/payroll", adminToken)
    if (adminPayrollRes.status !== 200) throw new Error("Expected 200 for Admin")

    // HR Manager access -> 403 (Confidentiality enforced)
    const hrPayrollRes = await api("GET", "/dashboard/payroll", hrToken)
    console.log(`HR Manager accessing /dashboard/payroll: ${hrPayrollRes.status}`)
    if (hrPayrollRes.status !== 403) {
      throw new Error("Expected 403 for HR Manager on /dashboard/payroll (salary protection)")
    }

    // Employee access -> 403
    const empPayrollRes = await api("GET", "/dashboard/payroll", empToken)
    console.log(`Employee accessing /dashboard/payroll: ${empPayrollRes.status}`)
    if (empPayrollRes.status !== 403) {
      throw new Error("Expected 403 for Employee on /dashboard/payroll")
    }
    console.log("✔ TEST 2 PASSED")

    // ----------------------------------------------------
    // TEST 3: Employee Self-Service Dashboard (GET /dashboard/me)
    // ----------------------------------------------------
    console.log("\n[TEST 3] Employee Self-Service Dashboard (GET /dashboard/me)")
    const meRes = await api("GET", "/dashboard/me", empToken)
    console.log(`Employee accessing /dashboard/me: ${meRes.status}`)
    if (meRes.status !== 200) {
      throw new Error(`Expected 200 on /dashboard/me, got ${meRes.status}`)
    }

    const meData = meRes.data.data
    console.log(
      `Employee Me: Code: ${meData.profile.employeeCode}, Name: ${meData.profile.firstName} ${meData.profile.lastName}`,
    )
    console.log(
      `Attendance Today: ${meData.attendanceSummary.today?.status || "None"}, Recent Leave Requests: ${meData.leaveSummary.recentRequests.length}`,
    )
    if (meData.profile.employeeCode !== "EMP-DASH-01") {
      throw new Error("Employee profile mismatch on /dashboard/me")
    }
    console.log("✔ TEST 3 PASSED")

    // ----------------------------------------------------
    // TEST 4: Unified Role-Aware Dashboard (GET /dashboard)
    // ----------------------------------------------------
    console.log("\n[TEST 4] Unified Role-Aware Dashboard (GET /dashboard)")
    // Admin gets both hr and payroll
    const adminUniRes = await api("GET", "/dashboard", adminToken)
    console.log(
      `Admin /dashboard: ${adminUniRes.status}, Has HR: ${Boolean(adminUniRes.data.data.hr)}, Has Payroll: ${Boolean(adminUniRes.data.data.payroll)}`,
    )
    if (!adminUniRes.data.data.hr || !adminUniRes.data.data.payroll) {
      throw new Error("Admin unified dashboard must include both HR and Payroll")
    }

    // HR Manager gets only hr
    const hrUniRes = await api("GET", "/dashboard", hrToken)
    console.log(
      `HR Manager /dashboard: ${hrUniRes.status}, Has HR: ${Boolean(hrUniRes.data.data.hr)}, Has Payroll: ${Boolean(hrUniRes.data.data.payroll)}`,
    )
    if (!hrUniRes.data.data.hr || hrUniRes.data.data.payroll) {
      throw new Error("HR Manager unified dashboard must include HR only, no Payroll")
    }

    // Payroll Manager gets only payroll
    const pmUniRes = await api("GET", "/dashboard", pmToken)
    console.log(
      `Payroll Manager /dashboard: ${pmUniRes.status}, Has HR: ${Boolean(pmUniRes.data.data.hr)}, Has Payroll: ${Boolean(pmUniRes.data.data.payroll)}`,
    )
    if (pmUniRes.data.data.hr || !pmUniRes.data.data.payroll) {
      throw new Error("Payroll Manager unified dashboard must include Payroll only, no HR")
    }

    // Employee gets only me
    const empUniRes = await api("GET", "/dashboard", empToken)
    console.log(
      `Employee /dashboard: ${empUniRes.status}, Has Me: ${Boolean(empUniRes.data.data.me)}`,
    )
    if (!empUniRes.data.data.me) {
      throw new Error("Employee unified dashboard must include personal summary")
    }
    console.log("✔ TEST 4 PASSED")

    console.log("\n=======================================================")
    console.log("🎉 ALL 4 DASHBOARD AND REPORTING TESTS PASSED!")
    console.log("=======================================================")
  } finally {
    server.close()
  }
}

runVerification()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error("Verification failed:", err)
    process.exit(1)
  })
