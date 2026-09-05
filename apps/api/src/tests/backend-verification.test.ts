import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import request from "supertest"
import bcrypt from "bcryptjs"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  ContractStatus,
  DayOfWeek,
  EmploymentStatus,
  LeaveRequestStatus,
  PaymentStatus,
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

function getCookies(res: request.Response): string[] {
  const sc = res.headers["set-cookie"]
  if (!sc) return []
  return Array.isArray(sc) ? sc : [String(sc)]
}

describe("Step 24: Complete PeoplePay360 Backend Verification", () => {
  const timestamp = Date.now()
  const TEST_PREFIX = `v24_${timestamp}`

  // Test users across all 5 roles
  let adminUser: any
  let hrUser: any
  let payrollManagerUser: any
  let payrollUser: any
  let employeeUserA: any
  let employeeUserB: any

  // Tokens
  let adminToken: string
  let hrToken: string
  let payrollManagerToken: string
  let payrollUserToken: string
  let employeeTokenA: string
  let employeeTokenB: string

  // Created entity IDs for flow
  let departmentId: string
  let positionId: string
  let employeeAId: string
  let employeeBId: string
  let contractId: string
  let scheduleId: string
  let leaveTypeId: string
  let leaveRequestId: string
  let structureId: string
  let payrunId: string
  let payslipId: string

  before(async () => {
    // 1. Create clean test users
    const defaultPasswordHash = await bcrypt.hash("Password123!", 10)

    adminUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_admin@example.com`,
        passwordHash: defaultPasswordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    })

    hrUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_hr@example.com`,
        passwordHash: defaultPasswordHash,
        role: UserRole.HR_MANAGER,
        isActive: true,
      },
    })

    payrollManagerUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_prmgr@example.com`,
        passwordHash: defaultPasswordHash,
        role: UserRole.PAYROLL_MANAGER,
        isActive: true,
      },
    })

    payrollUser = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_pruser@example.com`,
        passwordHash: defaultPasswordHash,
        role: UserRole.PAYROLL_USER,
        isActive: true,
      },
    })

    employeeUserA = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_empa@example.com`,
        passwordHash: defaultPasswordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    })

    employeeUserB = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}_empb@example.com`,
        passwordHash: defaultPasswordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
      },
    })

    // Generate tokens
    adminToken = await createAccessToken({ userId: adminUser.id, role: adminUser.role })
    hrToken = await createAccessToken({ userId: hrUser.id, role: hrUser.role })
    payrollManagerToken = await createAccessToken({ userId: payrollManagerUser.id, role: payrollManagerUser.role })
    payrollUserToken = await createAccessToken({ userId: payrollUser.id, role: payrollUser.role })
    employeeTokenA = await createAccessToken({ userId: employeeUserA.id, role: employeeUserA.role })
    employeeTokenB = await createAccessToken({ userId: employeeUserB.id, role: employeeUserB.role })
  })

  after(async () => {
    // Cleanup created test records
    try {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorUserId: adminUser?.id },
            { actorUserId: hrUser?.id },
            { actorUserId: payrollManagerUser?.id },
          ],
        },
      })

      if (payrunId) {
        await prisma.payslipLine.deleteMany({ where: { payslip: { payrunId } } })
        await prisma.payslipDelivery.deleteMany({ where: { payslip: { payrunId } } })
        await prisma.payslip.deleteMany({ where: { payrunId } })
        await prisma.payrunEmployee.deleteMany({ where: { payrunId } })
        await prisma.payrun.deleteMany({ where: { id: payrunId } })
      }

      if (structureId) {
        await prisma.employeeSalaryStructureAssignment.deleteMany({ where: { structureId } })
        await prisma.salaryRule.deleteMany({ where: { structureId } })
        await prisma.salaryStructure.deleteMany({ where: { id: structureId } })
      }

      if (leaveTypeId) {
        await prisma.leaveRequest.deleteMany({ where: { leaveTypeId } })
        await prisma.leaveAllocation.deleteMany({ where: { leaveTypeId } })
        await prisma.leaveType.deleteMany({ where: { id: leaveTypeId } })
      }

      if (employeeAId || employeeBId) {
        const empIds = [employeeAId, employeeBId].filter(Boolean)
        await prisma.attendance.deleteMany({ where: { employeeId: { in: empIds } } })
        await prisma.employeeScheduleAssignment.deleteMany({ where: { employeeId: { in: empIds } } })
        await prisma.employeeContract.deleteMany({ where: { employeeId: { in: empIds } } })
        await prisma.employee.deleteMany({ where: { id: { in: empIds } } })
      }

      if (scheduleId) {
        await prisma.workScheduleDay.deleteMany({ where: { scheduleId } })
        await prisma.workSchedule.deleteMany({ where: { id: scheduleId } })
      }

      if (positionId) {
        await prisma.jobPosition.deleteMany({ where: { id: positionId } })
      }

      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } })
      }

      const testUserIds = [
        adminUser?.id,
        hrUser?.id,
        payrollManagerUser?.id,
        payrollUser?.id,
        employeeUserA?.id,
        employeeUserB?.id,
      ].filter(Boolean)

      await prisma.refreshToken.deleteMany({ where: { userId: { in: testUserIds } } })
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } })
    } catch (e) {
      console.error("Cleanup error (ignored):", e)
    }
  })

  // -------------------------------------------------------------
  // 1. AUTH & SESSION TESTS
  // -------------------------------------------------------------
  describe("1. Authentication & Session Security", () => {
    it("should authenticate with valid credentials and return access token + refresh cookie", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: adminUser.email,
          password: "Password123!",
        })

      assert.equal(res.status, 200)
      assert.ok(res.body.accessToken)
      assert.equal(res.body.user.email, adminUser.email)
      assert.equal(res.body.user.role, "ADMIN")

      // Verify refresh cookie set
      const cookies = getCookies(res)
      assert.ok(cookies.some((c: string) => c.includes("pp360_refresh_token")))
    })

    it("should reject login with incorrect password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: adminUser.email,
          password: "WrongPassword!",
        })

      assert.equal(res.status, 401)
      assert.equal(res.body.error.code, "INVALID_CREDENTIALS")
    })

    it("should reject login with non-existent email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent.user@example.com",
          password: "Password123!",
        })

      assert.equal(res.status, 401)
      assert.equal(res.body.error.code, "INVALID_CREDENTIALS")
    })

    it("should perform refresh token rotation and issue new tokens", async () => {
      // 1. Login to get refresh cookie
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: hrUser.email,
          password: "Password123!",
        })

      const cookies = getCookies(loginRes)
      const refreshCookie = cookies.find((c: string) => c.includes("pp360_refresh_token"))

      // 2. Call refresh endpoint
      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookie!)

      assert.equal(refreshRes.status, 200)
      assert.ok(refreshRes.body.accessToken)

      // 3. Verify cookie was rotated
      const newCookies = getCookies(refreshRes)
      assert.ok(newCookies.some((c: string) => c.includes("pp360_refresh_token")))
    })

    it("should detect refresh token reuse and revoke the entire token family", async () => {
      // 1. Login to get initial refresh token
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: employeeUserA.email,
          password: "Password123!",
        })

      const initialCookie = getCookies(loginRes).find((c: string) => c.includes("pp360_refresh_token"))

      // 2. Rotate once
      const rotateRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", initialCookie!)

      assert.equal(rotateRes.status, 200)

      // 3. Replay initial cookie (token reuse attack)
      const reuseRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", initialCookie!)

      assert.equal(reuseRes.status, 401)
      assert.equal(reuseRes.body.error.code, "REFRESH_TOKEN_REUSED")
    })

    it("should return authenticated user profile on GET /api/v1/auth/me", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${adminToken}`)

      assert.equal(res.status, 200)
      assert.equal(res.body.user.id, adminUser.id)
      assert.equal(res.body.user.email, adminUser.email)
      assert.equal(res.body.user.role, "ADMIN")
    })

    it("should immediately block deactivated users from making authenticated API calls", async () => {
      // Create temporary user
      const tempUser = await prisma.user.create({
        data: {
          email: `${TEST_PREFIX}_temp_deactivate@example.com`,
          passwordHash: "dummyHash",
          role: UserRole.EMPLOYEE,
          isActive: true,
        },
      })

      const tempToken = await createAccessToken({ userId: tempUser.id, role: tempUser.role })

      // Verify active
      const resBefore = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tempToken}`)
      assert.equal(resBefore.status, 200)

      // Deactivate user in DB
      await prisma.user.update({
        where: { id: tempUser.id },
        data: { isActive: false },
      })

      // Try access with unexpired token
      const resAfter = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tempToken}`)

      assert.equal(resAfter.status, 401)
      assert.equal(resAfter.body.error.code, "ACCOUNT_DISABLED")

      await prisma.user.delete({ where: { id: tempUser.id } })
    })
  })

  // -------------------------------------------------------------
  // 2. CRITICAL END-TO-END BUSINESS FLOW (Admin -> Payroll -> Payslip)
  // -------------------------------------------------------------
  describe("2. End-to-End Core Lifecycle Flow", () => {
    it("Step A: Admin creates Department and Job Position", async () => {
      const depRes = await request(app)
        .post("/api/v1/departments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: `DEP_${timestamp}`,
          name: `Engineering ${timestamp}`,
          description: "Core Product Engineering",
        })

      assert.equal(depRes.status, 201)
      departmentId = depRes.body.department.id

      const posRes = await request(app)
        .post("/api/v1/job-positions")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: `POS_${timestamp}`,
          title: `Senior Engineer ${timestamp}`,
          departmentId,
        })

      assert.equal(posRes.status, 201)
      positionId = posRes.body.jobPosition.id
    })

    it("Step B: Admin creates Employee and links to User A", async () => {
      const empRes = await request(app)
        .post("/api/v1/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeCode: `EMP_${timestamp}_A`,
          firstName: "John",
          lastName: "Doe",
          workEmail: `johndoe_${timestamp}@peoplepay360.local`,
          joiningDate: "2026-01-01",
          departmentId,
          jobPositionId: positionId,
          userId: employeeUserA.id,
        })

      assert.equal(empRes.status, 201)
      employeeAId = empRes.body.employee.id
      assert.equal(empRes.body.employee.employmentStatus, "ACTIVE")

      // Also create Employee B for tenant isolation checks
      const empBRes = await request(app)
        .post("/api/v1/employees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeCode: `EMP_${timestamp}_B`,
          firstName: "Jane",
          lastName: "Smith",
          workEmail: `janesmith_${timestamp}@peoplepay360.local`,
          joiningDate: "2026-01-01",
          departmentId,
          jobPositionId: positionId,
          userId: employeeUserB.id,
        })

      assert.equal(empBRes.status, 201)
      employeeBId = empBRes.body.employee.id
    })

    it("Step C: Create Contract and activate it", async () => {
      const contractRes = await request(app)
        .post("/api/v1/contracts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          contractNumber: `CTR_${timestamp}`,
          employeeId: employeeAId,
          startDate: "2026-01-01",
          baseSalary: "8500.00",
          currency: "USD",
        })

      assert.equal(contractRes.status, 201)
      contractId = contractRes.body.contract.id
      assert.equal(contractRes.body.contract.status, "DRAFT")

      // Transition contract status to ACTIVE
      const activateRes = await request(app)
        .patch(`/api/v1/contracts/${contractId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: ContractStatus.ACTIVE })

      assert.equal(activateRes.status, 200)
      assert.equal(activateRes.body.contract.status, "ACTIVE")
    })

    it("Step D: Create Work Schedule and assign to Employee A", async () => {
      const days = [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
        DayOfWeek.SATURDAY,
        DayOfWeek.SUNDAY,
      ].map((dayOfWeek) => ({
        dayOfWeek,
        isWorkingDay: dayOfWeek !== DayOfWeek.SATURDAY && dayOfWeek !== DayOfWeek.SUNDAY,
        startTime: dayOfWeek !== DayOfWeek.SATURDAY && dayOfWeek !== DayOfWeek.SUNDAY ? "09:00" : null,
        endTime: dayOfWeek !== DayOfWeek.SATURDAY && dayOfWeek !== DayOfWeek.SUNDAY ? "17:00" : null,
        breakMinutes: dayOfWeek !== DayOfWeek.SATURDAY && dayOfWeek !== DayOfWeek.SUNDAY ? 60 : 0,
      }))

      const scheduleRes = await request(app)
        .post("/api/v1/work-schedules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: `SCH_${timestamp}`,
          name: "Standard 40h",
          timezone: "UTC",
          days,
        })

      assert.equal(scheduleRes.status, 201)
      scheduleId = scheduleRes.body.schedule.id

      // Assign schedule to Employee A
      const assignRes = await request(app)
        .post(`/api/v1/employees/${employeeAId}/work-schedules`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          scheduleId,
          effectiveFrom: "2026-01-01",
        })

      assert.equal(assignRes.status, 201)
    })

    it("Step E: Employee A performs Attendance check-in & check-out", async () => {
      // Check in
      const inRes = await request(app)
        .post("/api/v1/attendance/check-in")
        .set("Authorization", `Bearer ${employeeTokenA}`)
        .send({ notes: "Web self check-in" })

      assert.equal(inRes.status, 201)
      assert.equal(inRes.body.attendance.employeeId, employeeAId)
      assert.equal(inRes.body.attendance.status, "PRESENT")

      // Check out
      const outRes = await request(app)
        .post("/api/v1/attendance/check-out")
        .set("Authorization", `Bearer ${employeeTokenA}`)
        .send({ notes: "Finished day" })

      assert.equal(outRes.status, 200)
      assert.ok(outRes.body.attendance.checkOutAt)
      assert.ok(outRes.body.attendance.workedMinutes !== null)
    })

    it("Step F: Leave Type, Allocation, Request, and Approval Workflow", async () => {
      // 1. Create Leave Type
      const typeRes = await request(app)
        .post("/api/v1/leave-types")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: `ANNUAL_${timestamp}`,
          name: "Annual Paid Leave",
          isPaid: true,
        })

      assert.equal(typeRes.status, 201)
      leaveTypeId = typeRes.body.leaveType.id

      // 2. Allocate 20 days
      const allocRes = await request(app)
        .post("/api/v1/leave-allocations")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          employeeId: employeeAId,
          leaveTypeId,
          year: 2026,
          allocatedDays: 20,
        })

      assert.equal(allocRes.status, 201)

      // 3. Employee A requests 2 days
      const reqRes = await request(app)
        .post("/api/v1/leave-requests")
        .set("Authorization", `Bearer ${employeeTokenA}`)
        .send({
          employeeId: employeeAId,
          leaveTypeId,
          startDate: "2026-03-10",
          endDate: "2026-03-11",
          reason: "Vacation",
        })

      assert.equal(reqRes.status, 201)
      leaveRequestId = reqRes.body.leaveRequest.id
      assert.equal(reqRes.body.leaveRequest.status, LeaveRequestStatus.PENDING)

      // 4. HR approves request
      const approveRes = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/approve`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ comment: "Approved by HR" })

      assert.equal(approveRes.status, 200)
      assert.equal(approveRes.body.leaveRequest.status, LeaveRequestStatus.APPROVED)
    })

    it("Step G: Salary Structure, Rules, and Assignment", async () => {
      // 1. Create structure
      const structRes = await request(app)
        .post("/api/v1/salary-structures")
        .set("Authorization", `Bearer ${payrollManagerToken}`)
        .send({
          code: `STR_${timestamp}`,
          name: "Standard Tech Compensation",
        })

      assert.equal(structRes.status, 201)
      structureId = structRes.body.salaryStructure.id

      // 2. Add Fixed Earning Rule: Housing Allowance $1,000
      const rule1Res = await request(app)
        .post(`/api/v1/salary-structures/${structureId}/rules`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)
        .send({
          code: "HOUSING",
          name: "Housing Allowance",
          category: SalaryRuleCategory.EARNING,
          calculationType: SalaryRuleCalculationType.FIXED,
          amount: 1000,
          sequence: 1,
        })

      assert.equal(rule1Res.status, 201)

      // 3. Add Percentage Deduction Rule: Income Tax 10% on Gross
      const rule2Res = await request(app)
        .post(`/api/v1/salary-structures/${structureId}/rules`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)
        .send({
          code: "TAX",
          name: "Income Tax",
          category: SalaryRuleCategory.DEDUCTION,
          calculationType: SalaryRuleCalculationType.PERCENTAGE,
          percentage: 10,
          base: SalaryRuleBase.GROSS_EARNINGS,
          sequence: 2,
        })

      assert.equal(rule2Res.status, 201)

      // 4. Assign structure to Employee A
      const assignRes = await request(app)
        .post(`/api/v1/employees/${employeeAId}/salary-structures`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)
        .send({
          structureId: structureId,
          effectiveFrom: "2026-01-01",
        })

      assert.equal(assignRes.status, 201)
    })

    it("Step H: Payroll Run Lifecycle (Create -> Calculate -> Validate)", async () => {
      // 1. Create Payrun
      const createRes = await request(app)
        .post("/api/v1/payruns")
        .set("Authorization", `Bearer ${payrollManagerToken}`)
        .send({
          code: `PR_${timestamp}`,
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
        })

      assert.equal(createRes.status, 201)
      payrunId = createRes.body.payrun.id
      assert.equal(createRes.body.payrun.status, "DRAFT")

      // 2. Calculate Payroll
      const calcRes = await request(app)
        .post(`/api/v1/payruns/${payrunId}/calculate`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)

      assert.equal(calcRes.status, 200)
      assert.equal(calcRes.body.payrun.status, "CALCULATED")

      // Check calculation items
      const itemsRes = await request(app)
        .get(`/api/v1/payruns/${payrunId}/employees`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)

      assert.equal(itemsRes.status, 200)
      assert.ok(itemsRes.body.items.length > 0)
      const empItem = itemsRes.body.items.find((i: any) => i.employeeId === employeeAId)
      assert.ok(empItem, "Expected calculation for Employee A")

      // Invariants: Base: 8500 + Housing: 1000 = Gross: 9500; Tax 10% = Deduction: 950; Net: 8550
      assert.equal(Number(empItem.grossAmount), 9500)
      assert.equal(Number(empItem.deductionAmount), 950)
      assert.equal(Number(empItem.netAmount), 8550)

      // 3. Validate Payrun (Locks payrun immutably)
      const valRes = await request(app)
        .post(`/api/v1/payruns/${payrunId}/validate`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)

      assert.equal(valRes.status, 200)
      assert.equal(valRes.body.payrun.status, "VALIDATED")
    })

    it("Step I: Generate Payslips and Verify Immutability Snapshot", async () => {
      const genRes = await request(app)
        .post(`/api/v1/payruns/${payrunId}/payslips`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)

      assert.equal(genRes.status, 201)
      assert.ok(genRes.body.data.count >= 1)

      const payslip = genRes.body.data.payslips.find((p: any) => p.employeeId === employeeAId)
      assert.ok(payslip, "Expected payslip for Employee A")
      payslipId = payslip.id

      assert.equal(payslip.status, "FINAL")
      assert.equal(payslip.paymentStatus, "UNPAID")
      assert.equal(Number(payslip.netAmount), 8550)
      assert.ok(payslip.lines.length >= 2, "Expected salary rule line snapshots")
    })

    it("Step J: Payslip PDF Streaming and Payment Status Update", async () => {
      // 1. Stream PDF
      const pdfRes = await request(app)
        .get(`/api/v1/payslips/${payslipId}/pdf`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)

      assert.equal(pdfRes.status, 200)
      assert.equal(pdfRes.headers["content-type"], "application/pdf")
      // Check PDF magic header %PDF-
      const pdfMagic = Buffer.isBuffer(pdfRes.body)
        ? pdfRes.body.toString("ascii", 0, 5)
        : String(pdfRes.text || "").slice(0, 5)
      assert.equal(pdfMagic, "%PDF-")

      // 2. Update Payment Status to PAID
      const statusRes = await request(app)
        .patch(`/api/v1/payslips/${payslipId}/payment-status`)
        .set("Authorization", `Bearer ${payrollManagerToken}`)
        .send({ paymentStatus: PaymentStatus.PAID })

      assert.equal(statusRes.status, 200)
      assert.equal(statusRes.body.data.paymentStatus, "PAID")
    })

    it("Step K: Verify Dashboards and Audit Log Traceability", async () => {
      // HR Dashboard
      const hrDash = await request(app)
        .get("/api/v1/dashboard/hr")
        .set("Authorization", `Bearer ${hrToken}`)

      assert.equal(hrDash.status, 200)
      assert.ok(hrDash.body.data.totalEmployees >= 2)
      assert.equal(hrDash.body.data.grossPayroll, undefined, "HR dashboard must NOT contain salary data")

      // Payroll Dashboard
      const prDash = await request(app)
        .get("/api/v1/dashboard/payroll")
        .set("Authorization", `Bearer ${payrollManagerToken}`)

      assert.equal(prDash.status, 200)
      assert.ok(prDash.body.data.latestPayrun)

      // Audit Logs (ADMIN ONLY)
      const auditRes = await request(app)
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${adminToken}`)

      assert.equal(auditRes.status, 200)
      assert.ok(Array.isArray(auditRes.body.auditLogs))
      assert.ok(auditRes.body.auditLogs.length > 0)
    })
  })

  // -------------------------------------------------------------
  // 3. RBAC & LEAST PRIVILEGE BOUNDARY TESTS
  // -------------------------------------------------------------
  describe("3. Role-Based Access Control (RBAC) Least Privilege", () => {
    it("EMPLOYEE cannot access admin, HR, or payroll calculation endpoints", async () => {
      // Forbidden: Users administration
      const resUsers = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${employeeTokenA}`)
      assert.equal(resUsers.status, 403)

      // Forbidden: Audit logs
      const resAudit = await request(app)
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${employeeTokenA}`)
      assert.equal(resAudit.status, 403)

      // Forbidden: Payroll calculation
      const resCalc = await request(app)
        .post(`/api/v1/payruns/${payrunId}/calculate`)
        .set("Authorization", `Bearer ${employeeTokenA}`)
      assert.equal(resCalc.status, 403)

      // Forbidden: Payroll dashboard
      const resDash = await request(app)
        .get("/api/v1/dashboard/payroll")
        .set("Authorization", `Bearer ${employeeTokenA}`)
      assert.equal(resDash.status, 403)
    })

    it("HR_MANAGER cannot access payroll calculations, payrun validation, or audit logs", async () => {
      // Forbidden: Payrun validation
      const resVal = await request(app)
        .post(`/api/v1/payruns/${payrunId}/validate`)
        .set("Authorization", `Bearer ${hrToken}`)
      assert.equal(resVal.status, 403)

      // Forbidden: Payroll Dashboard
      const resDash = await request(app)
        .get("/api/v1/dashboard/payroll")
        .set("Authorization", `Bearer ${hrToken}`)
      assert.equal(resDash.status, 403)

      // Forbidden: Audit logs
      const resAudit = await request(app)
        .get("/api/v1/audit-logs")
        .set("Authorization", `Bearer ${hrToken}`)
      assert.equal(resAudit.status, 403)
    })

    it("PAYROLL_USER cannot validate payruns or approve leave requests", async () => {
      // Forbidden: Payrun validation (restricted to ADMIN and PAYROLL_MANAGER)
      const resVal = await request(app)
        .post(`/api/v1/payruns/${payrunId}/validate`)
        .set("Authorization", `Bearer ${payrollUserToken}`)
      assert.equal(resVal.status, 403)

      // Forbidden: Leave approval
      const resLeave = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestId}/approve`)
        .set("Authorization", `Bearer ${payrollUserToken}`)
        .send({ comment: "unauthorized" })
      assert.equal(resLeave.status, 403)
    })
  })

  // -------------------------------------------------------------
  // 4. TENANT & CROSS-USER ISOLATION TESTS
  // -------------------------------------------------------------
  describe("4. Cross-User Data Isolation", () => {
    it("Employee B cannot access Employee A's payslips", async () => {
      // Direct access attempt
      const res = await request(app)
        .get(`/api/v1/payslips/${payslipId}`)
        .set("Authorization", `Bearer ${employeeTokenB}`)

      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, "FORBIDDEN")
    })

    it("Employee B cannot access Employee A's leave requests", async () => {
      const res = await request(app)
        .get(`/api/v1/leave-requests/${leaveRequestId}`)
        .set("Authorization", `Bearer ${employeeTokenB}`)

      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, "FORBIDDEN")
    })

    it("Employee A can view their own payslip through self-service", async () => {
      const res = await request(app)
        .get(`/api/v1/me/payslips/${payslipId}`)
        .set("Authorization", `Bearer ${employeeTokenA}`)

      assert.equal(res.status, 200)
      assert.equal(res.body.data.id, payslipId)
      assert.equal(res.body.data.employeeId, employeeAId)
    })
  })

  // -------------------------------------------------------------
  // 5. SECURITY HARDENING & ERROR RESILIENCE
  // -------------------------------------------------------------
  describe("5. Security Hardening & Robustness", () => {
    it("should reject malformed UUID parameters with 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .get("/api/v1/employees/not-a-valid-uuid")
        .set("Authorization", `Bearer ${adminToken}`)

      assert.equal(res.status, 400)
      assert.ok(
        res.body.error.code === "INVALID_EMPLOYEE_ID" || res.body.error.code === "VALIDATION_ERROR",
      )
    })

    it("should handle malformed JSON bodies without leaking stack traces", async () => {
      const res = await request(app)
        .post("/api/v1/departments")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Content-Type", "application/json")
        .send("{ bad_json: invalid ")

      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, "MALFORMED_JSON")
      assert.equal(res.body.error.stack, undefined)
    })

    it("should return clean 409 for duplicate unique resource creation", async () => {
      // Re-create existing department code
      const res = await request(app)
        .post("/api/v1/departments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          code: `DEP_${timestamp}`,
          name: `Duplicate Dep ${timestamp}`,
        })

      assert.equal(res.status, 409)
      assert.ok(
        res.body.error.code === "DEPARTMENT_EXISTS" || res.body.error.code === "CONFLICT",
      )
      // Ensure no raw SQL statements are leaked
      assert.ok(!JSON.stringify(res.body).includes("SELECT * FROM"))
    })

    it("should prevent admin from modifying their own role (role escalation safeguard)", async () => {
      const res = await request(app)
        .patch(`/api/v1/users/${adminUser.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "EMPLOYEE" })

      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, "ROLE_MODIFICATION_RESTRICTED")
    })
  })
})
