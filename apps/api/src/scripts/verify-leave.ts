import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  EmploymentStatus,
  LeaveRequestStatus,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING LEAVE MANAGEMENT VERIFICATION ===")

  // 1. Ephemeral test server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`

  console.log(`[Test Server] Listening on ${baseUrl}`)

  // 2. Setup database records
  let dept = await prisma.department.findFirst()
  if (!dept) {
    dept = await prisma.department.create({
      data: { code: "LEAVE-DEP", name: "Leave Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "LEAVE-POS", title: "Leave Position" },
    })
  }

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.leave@example.com" },
    update: { isActive: true },
    create: {
      email: "admin.leave@example.com",
      passwordHash: "hash",
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  // HR Manager user WITH linked employee (to test self-approval prevention)
  const hrUser = await prisma.user.upsert({
    where: { email: "hr.leave@example.com" },
    update: { isActive: true },
    create: {
      email: "hr.leave@example.com",
      passwordHash: "hash",
      role: UserRole.HR_MANAGER,
      isActive: true,
    },
  })

  const hrEmployee = await prisma.employee.upsert({
    where: { employeeCode: "EMP-HR-001" },
    update: {
      userId: hrUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-HR-001",
      firstName: "HR",
      lastName: "Leader",
      workEmail: "hr.leave@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: hrUser.id,
    },
  })

  // Employee A
  const empUserA = await prisma.user.upsert({
    where: { email: "empa.leave@example.com" },
    update: { isActive: true },
    create: {
      email: "empa.leave@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const empA = await prisma.employee.upsert({
    where: { employeeCode: "EMP-LV-001" },
    update: {
      userId: empUserA.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-LV-001",
      firstName: "Alice",
      lastName: "Leave",
      workEmail: "empa.leave@example.com",
      joiningDate: new Date("2025-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empUserA.id,
    },
  })

  // Employee B
  const empUserB = await prisma.user.upsert({
    where: { email: "empb.leave@example.com" },
    update: { isActive: true },
    create: {
      email: "empb.leave@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const empB = await prisma.employee.upsert({
    where: { employeeCode: "EMP-LV-002" },
    update: {
      userId: empUserB.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-LV-002",
      firstName: "Bob",
      lastName: "Leave",
      workEmail: "empb.leave@example.com",
      joiningDate: new Date("2025-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empUserB.id,
    },
  })

  // Inactive Employee
  const inactiveEmpUser = await prisma.user.upsert({
    where: { email: "inactive.leave@example.com" },
    update: { isActive: true },
    create: {
      email: "inactive.leave@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const inactiveEmp = await prisma.employee.upsert({
    where: { employeeCode: "EMP-LV-INACT" },
    update: {
      userId: inactiveEmpUser.id,
      employmentStatus: EmploymentStatus.TERMINATED,
    },
    create: {
      employeeCode: "EMP-LV-INACT",
      firstName: "Inactive",
      lastName: "Person",
      workEmail: "inactive.leave@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.TERMINATED,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: inactiveEmpUser.id,
    },
  })

  // Payroll user
  const payrollUser = await prisma.user.upsert({
    where: { email: "payroll.leave@example.com" },
    update: { isActive: true },
    create: {
      email: "payroll.leave@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_USER,
      isActive: true,
    },
  })

  // Clean previous leave data for test employees
  await prisma.leaveRequest.deleteMany({
    where: { employeeId: { in: [empA.id, empB.id, hrEmployee.id, inactiveEmp.id] } },
  })
  await prisma.leaveAllocation.deleteMany({
    where: { employeeId: { in: [empA.id, empB.id, hrEmployee.id, inactiveEmp.id] } },
  })

  // Tokens
  const adminToken = await createAccessToken({ userId: adminUser.id, role: UserRole.ADMIN })
  const hrToken = await createAccessToken({ userId: hrUser.id, role: UserRole.HR_MANAGER })
  const empAToken = await createAccessToken({ userId: empUserA.id, role: UserRole.EMPLOYEE })
  const empBToken = await createAccessToken({ userId: empUserB.id, role: UserRole.EMPLOYEE })
  const inactiveToken = await createAccessToken({ userId: inactiveEmpUser.id, role: UserRole.EMPLOYEE })
  const payrollToken = await createAccessToken({ userId: payrollUser.id, role: UserRole.PAYROLL_USER })

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
    // --- TEST 1: Leave Type creation & management ---
    console.log("\n[TEST 1] Leave Type creation & duplicate prevention")
    const annualCode = `ANNUAL_${Date.now()}`
    const sickCode = `SICK_${Date.now()}`

    const resTypeAnnual = await api("/leave-types", {
      method: "POST",
      body: JSON.stringify({
        code: annualCode,
        name: "Annual Leave",
        description: "Paid annual recreation leave",
        isPaid: true,
      }),
    }, hrToken)

    console.log(`Annual Leave Type Created: ${resTypeAnnual.status}, Code: ${resTypeAnnual.data?.leaveType?.code}`)
    if (resTypeAnnual.status !== 201) throw new Error("Expected 201 for annual leave type creation")
    const annualLeaveTypeId = resTypeAnnual.data.leaveType.id

    const resTypeSick = await api("/leave-types", {
      method: "POST",
      body: JSON.stringify({
        code: sickCode,
        name: "Sick Leave",
        description: "Medical sick leave",
        isPaid: true,
      }),
    }, hrToken)
    if (resTypeSick.status !== 201) throw new Error("Expected 201 for sick leave type creation")
    const sickLeaveTypeId = resTypeSick.data.leaveType.id

    // Duplicate code check -> 409
    const resDupType = await api("/leave-types", {
      method: "POST",
      body: JSON.stringify({
        code: annualCode,
        name: "Duplicate Annual",
      }),
    }, hrToken)
    console.log(`Duplicate code status: ${resDupType.status}, Code: ${resDupType.data?.error?.code}`)
    if (resDupType.status !== 409) throw new Error("Expected 409 for duplicate leave type code")

    // Employee cannot create leave type -> 403
    const resEmpCreateType = await api("/leave-types", {
      method: "POST",
      body: JSON.stringify({ code: "EMP_TYPE", name: "Unauthorized" }),
    }, empAToken)
    if (resEmpCreateType.status !== 403) throw new Error("Expected 403 for employee creating leave type")
    console.log("✔ TEST 1 PASSED")

    // --- TEST 2: Leave Allocation ---
    console.log("\n[TEST 2] Leave Allocation by HR")
    const resAllocAnnual = await api("/leave-allocations", {
      method: "POST",
      body: JSON.stringify({
        employeeId: empA.id,
        leaveTypeId: annualLeaveTypeId,
        year: 2026,
        allocatedDays: 20,
      }),
    }, hrToken)

    console.log(`Allocated 20 annual days to empA: ${resAllocAnnual.status}`)
    if (resAllocAnnual.status !== 201 || Number(resAllocAnnual.data?.leaveAllocation?.allocatedDays) !== 20) {
      throw new Error("Expected 201 with 20 allocated days")
    }

    // Allocate 10 sick days to empA
    await api("/leave-allocations", {
      method: "POST",
      body: JSON.stringify({
        employeeId: empA.id,
        leaveTypeId: sickLeaveTypeId,
        year: 2026,
        allocatedDays: 10,
      }),
    }, hrToken)

    // Allocate 15 annual days to HR Employee
    await api("/leave-allocations", {
      method: "POST",
      body: JSON.stringify({
        employeeId: hrEmployee.id,
        leaveTypeId: annualLeaveTypeId,
        year: 2026,
        allocatedDays: 15,
      }),
    }, adminToken)
    console.log("✔ TEST 2 PASSED")

    // --- TEST 3: Check Leave Balances ---
    console.log("\n[TEST 3] Check Leave Balances & Permissions")
    const resBalances = await api(`/employees/${empA.id}/leave-balances?year=2026`, {
      method: "GET",
    }, empAToken)

    console.log(`Balances fetched: ${resBalances.status}, Items: ${resBalances.data?.balances?.length}`)
    if (resBalances.status !== 200 || resBalances.data.balances.length < 2) {
      throw new Error("Expected 200 with at least 2 balance records")
    }

    const annualBal = resBalances.data.balances.find((b: any) => b.leaveTypeId === annualLeaveTypeId)
    if (annualBal.allocatedDays !== 20 || annualBal.usedDays !== 0 || annualBal.availableDays !== 20) {
      throw new Error(`Unexpected initial balance state: ${JSON.stringify(annualBal)}`)
    }

    // Other employee trying to view Emp A's balances -> 403
    const resForbiddenBalances = await api(`/employees/${empA.id}/leave-balances`, {
      method: "GET",
    }, empBToken)
    if (resForbiddenBalances.status !== 403) throw new Error("Expected 403 when employee views other employee balance")
    console.log("✔ TEST 3 PASSED")

    // --- TEST 4: Submit Leave Request Validations ---
    console.log("\n[TEST 4] Submit Leave Request Validations")
    // Inactive employee cannot request leave -> 400
    const resInactiveReq = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-09",
        endDate: "2026-09-11",
      }),
    }, inactiveToken)
    console.log(`Inactive employee status: ${resInactiveReq.status}, Code: ${resInactiveReq.data?.error?.code}`)
    if (resInactiveReq.status !== 400 || resInactiveReq.data?.error?.code !== "EMPLOYEE_NOT_ACTIVE") {
      throw new Error("Expected 400 EMPLOYEE_NOT_ACTIVE")
    }

    // Employee A submitting for Employee B -> 403
    const resSpoofReq = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        employeeId: empB.id,
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-09",
        endDate: "2026-09-11",
      }),
    }, empAToken)
    console.log(`Spoofed submission status: ${resSpoofReq.status}`)
    if (resSpoofReq.status !== 403) throw new Error("Expected 403 for employee requesting for someone else")

    // Invalid date order: endDate < startDate -> 400
    const resInvalidDates = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-15",
        endDate: "2026-09-10",
      }),
    }, empAToken)
    if (resInvalidDates.status !== 400) throw new Error("Expected 400 for endDate < startDate")

    // Insufficient balance: requested 25 days with only 10 available -> 400
    const resInsufficient = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: sickLeaveTypeId,
        startDate: "2026-10-01",
        endDate: "2026-11-05", // Over 25 working days
      }),
    }, empAToken)
    console.log(`Insufficient balance status: ${resInsufficient.status}, Code: ${resInsufficient.data?.error?.code}`)
    if (resInsufficient.status !== 400 || resInsufficient.data?.error?.code !== "INSUFFICIENT_LEAVE_BALANCE") {
      throw new Error("Expected 400 INSUFFICIENT_LEAVE_BALANCE")
    }
    console.log("✔ TEST 4 PASSED")

    // --- TEST 5: Successful Submission & Server-Side Days Calculation ---
    console.log("\n[TEST 5] Successful Leave Request Submission")
    // Wednesday 2026-09-09 to Friday 2026-09-11 = 3 working days
    const resSubmit = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-09",
        endDate: "2026-09-11",
        reason: "Family vacation trip",
      }),
    }, empAToken)

    console.log(`Leave Request Created: ${resSubmit.status}, requestedDays: ${resSubmit.data?.leaveRequest?.requestedDays}, Status: ${resSubmit.data?.leaveRequest?.status}`)
    if (resSubmit.status !== 201 || Number(resSubmit.data?.leaveRequest?.requestedDays) !== 3) {
      throw new Error(`Expected 201 with 3 requestedDays, got ${resSubmit.data?.leaveRequest?.requestedDays}`)
    }
    const requestId1 = resSubmit.data.leaveRequest.id
    console.log("✔ TEST 5 PASSED")

    // --- TEST 6: Overlapping Request Rejection ---
    console.log("\n[TEST 6] Overlapping Request Rejection")
    // Try to request Thursday 2026-09-10 to Monday 2026-09-14 (overlaps existing pending 09-09 to 09-11)
    const resOverlap = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-10",
        endDate: "2026-09-14",
      }),
    }, empAToken)

    console.log(`Overlapping request status: ${resOverlap.status}, Code: ${resOverlap.data?.error?.code}`)
    if (resOverlap.status !== 409 || resOverlap.data?.error?.code !== "OVERLAPPING_LEAVE_REQUEST") {
      throw new Error("Expected 409 OVERLAPPING_LEAVE_REQUEST")
    }
    console.log("✔ TEST 6 PASSED")

    // --- TEST 7: Separation of Duties - Self-Approval Prohibition ---
    console.log("\n[TEST 7] Separation of Duties (Requester cannot approve own request)")
    // HR Manager requests leave for their own employee profile
    const resHrReq = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-21",
        endDate: "2026-09-23",
        reason: "HR Personal leave",
      }),
    }, hrToken)

    const hrRequestId = resHrReq.data.leaveRequest.id

    // HR Manager attempts to approve their OWN request -> Expect 403 SELF_APPROVAL_NOT_ALLOWED
    const resSelfApprove = await api(`/leave-requests/${hrRequestId}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment: "Self approval attempt" }),
    }, hrToken)

    console.log(`Self-approval status: ${resSelfApprove.status}, Code: ${resSelfApprove.data?.error?.code}`)
    if (resSelfApprove.status !== 403 || resSelfApprove.data?.error?.code !== "SELF_APPROVAL_NOT_ALLOWED") {
      throw new Error("Expected 403 SELF_APPROVAL_NOT_ALLOWED")
    }

    // Admin approves HR's request -> 200 OK
    const resAdminApproveHr = await api(`/leave-requests/${hrRequestId}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment: "Approved by Admin" }),
    }, adminToken)

    console.log(`Admin approving HR request status: ${resAdminApproveHr.status}, Status: ${resAdminApproveHr.data?.leaveRequest?.status}`)
    if (resAdminApproveHr.status !== 200 || resAdminApproveHr.data?.leaveRequest?.status !== "APPROVED") {
      throw new Error("Expected 200 APPROVED")
    }
    console.log("✔ TEST 7 PASSED (Self-approval strictly prevented)")

    // --- TEST 8: Transactional Approval & Double Approval Prevention ---
    console.log("\n[TEST 8] Transactional Approval of Employee A's Request")
    const resApproveEmpA = await api(`/leave-requests/${requestId1}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment: "Approved by HR" }),
    }, hrToken)

    console.log(`Approved status: ${resApproveEmpA.status}, Reviewer: ${resApproveEmpA.data?.leaveRequest?.reviewedByUser?.role}`)
    if (resApproveEmpA.status !== 200 || resApproveEmpA.data.leaveRequest.status !== "APPROVED") {
      throw new Error("Expected 200 APPROVED")
    }

    // Verify usedDays incremented on allocation
    const resBalAfterApprove = await api(`/employees/${empA.id}/leave-balances?year=2026`, {
      method: "GET",
    }, empAToken)
    const annualBalAfter = resBalAfterApprove.data.balances.find((b: any) => b.leaveTypeId === annualLeaveTypeId)
    console.log(`Used days: ${annualBalAfter.usedDays}, Available: ${annualBalAfter.availableDays}`)
    if (annualBalAfter.usedDays !== 3 || annualBalAfter.availableDays !== 17) {
      throw new Error(`Expected usedDays = 3, availableDays = 17, got ${JSON.stringify(annualBalAfter)}`)
    }

    // Double approval attempt -> 409
    const resDoubleApprove = await api(`/leave-requests/${requestId1}/approve`, {
      method: "POST",
    }, hrToken)
    console.log(`Double approval status: ${resDoubleApprove.status}, Code: ${resDoubleApprove.data?.error?.code}`)
    if (resDoubleApprove.status !== 409) throw new Error("Expected 409 for double approval")
    console.log("✔ TEST 8 PASSED")

    // --- TEST 9: Approved Leave Cancellation & Balance Restoration ---
    console.log("\n[TEST 9] Approved Leave Cancellation & Balance Restoration")
    const resCancel = await api(`/leave-requests/${requestId1}/cancel`, {
      method: "POST",
    }, empAToken)

    console.log(`Cancellation status: ${resCancel.status}, Status: ${resCancel.data?.leaveRequest?.status}`)
    if (resCancel.status !== 200 || resCancel.data?.leaveRequest?.status !== "CANCELLED") {
      throw new Error("Expected 200 CANCELLED")
    }

    // Verify usedDays restored back to 0!
    const resBalRestored = await api(`/employees/${empA.id}/leave-balances?year=2026`, {
      method: "GET",
    }, empAToken)
    const annualBalRestored = resBalRestored.data.balances.find((b: any) => b.leaveTypeId === annualLeaveTypeId)
    console.log(`Restored used days: ${annualBalRestored.usedDays}, Available: ${annualBalRestored.availableDays}`)
    if (annualBalRestored.usedDays !== 0 || annualBalRestored.availableDays !== 20) {
      throw new Error(`Expected usedDays = 0, availableDays = 20, got ${JSON.stringify(annualBalRestored)}`)
    }
    console.log("✔ TEST 9 PASSED (Balance restored perfectly)")

    // --- TEST 10: Rejection Workflow ---
    console.log("\n[TEST 10] Rejection Workflow")
    const resSubmit2 = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-09-28",
        endDate: "2026-09-29",
        reason: "Personal day",
      }),
    }, empAToken)
    const requestId2 = resSubmit2.data.leaveRequest.id

    const resReject = await api(`/leave-requests/${requestId2}/reject`, {
      method: "POST",
      body: JSON.stringify({ comment: "Quarter-end closing, cannot approve" }),
    }, hrToken)

    console.log(`Rejection status: ${resReject.status}, Comment: ${resReject.data?.leaveRequest?.reviewComment}`)
    if (resReject.status !== 200 || resReject.data?.leaveRequest?.status !== "REJECTED") {
      throw new Error("Expected 200 REJECTED")
    }
    console.log("✔ TEST 10 PASSED")

    // --- TEST 11: Half-Day Leave Support ---
    console.log("\n[TEST 11] Half-Day Leave Support (0.50 Decimal)")
    const resHalfDay = await api("/leave-requests", {
      method: "POST",
      body: JSON.stringify({
        leaveTypeId: annualLeaveTypeId,
        startDate: "2026-10-05",
        endDate: "2026-10-05",
        isHalfDay: true,
        reason: "Dentist appointment afternoon",
      }),
    }, empAToken)

    console.log(`Half-day requestedDays: ${resHalfDay.data?.leaveRequest?.requestedDays}`)
    if (resHalfDay.status !== 201 || Number(resHalfDay.data?.leaveRequest?.requestedDays) !== 0.5) {
      throw new Error("Expected 0.5 requestedDays")
    }

    const halfDayId = resHalfDay.data.leaveRequest.id
    await api(`/leave-requests/${halfDayId}/approve`, { method: "POST" }, hrToken)

    const resBalHalfDay = await api(`/employees/${empA.id}/leave-balances?year=2026`, {
      method: "GET",
    }, empAToken)
    const annualBalHalfDay = resBalHalfDay.data.balances.find((b: any) => b.leaveTypeId === annualLeaveTypeId)
    console.log(`Balance after half-day: usedDays = ${annualBalHalfDay.usedDays}, available = ${annualBalHalfDay.availableDays}`)
    if (annualBalHalfDay.usedDays !== 0.5 || annualBalHalfDay.availableDays !== 19.5) {
      throw new Error("Failed precision for half-day deduction")
    }
    console.log("✔ TEST 11 PASSED (Half-day exact decimal precision verified)")

    // --- TEST 12: List Requests with Filters and Role Scoping ---
    console.log("\n[TEST 12] List Requests with Filters and Role Scoping")
    // Employee query: only sees own
    const resEmpList = await api("/leave-requests", { method: "GET" }, empAToken)
    console.log(`Employee A total visible requests: ${resEmpList.data?.pagination?.total}`)
    for (const req of resEmpList.data.leaveRequests) {
      if (req.employeeId !== empA.id) throw new Error("Employee saw another employee's request!")
    }

    // Payroll role: sees all
    const resPayrollList = await api("/leave-requests?page=1&pageSize=10", { method: "GET" }, payrollToken)
    console.log(`Payroll total visible requests: ${resPayrollList.data?.pagination?.total}`)
    if (resPayrollList.status !== 200 || resPayrollList.data.pagination.total < 3) {
      throw new Error("Expected Payroll to see all employee requests")
    }

    // Payroll cannot approve -> 403
    const resPayrollApprove = await api(`/leave-requests/${halfDayId}/approve`, { method: "POST" }, payrollToken)
    if (resPayrollApprove.status !== 403) throw new Error("Expected 403 for Payroll approving leave")
    console.log("✔ TEST 12 PASSED")

    console.log("\n=======================================================")
    console.log("🎉 ALL 12 LEAVE MANAGEMENT TESTS PASSED SUCCESSFULLY!")
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
