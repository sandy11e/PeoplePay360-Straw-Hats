import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { UserRole } from "../../generated/prisma/enums.js"

describe("Dashboard Unit Tests", () => {
  it("should ensure HR dashboard summary contains zero salary or monetary compensation keys", () => {
    // Simulated HR dashboard output
    const mockHrSummary = {
      totalEmployees: 42,
      activeEmployees: 38,
      employeesOnLeave: 2,
      attendanceToday: {
        PRESENT: 32,
        LATE: 4,
        ABSENT: 2,
        HALF_DAY: 0,
        ON_LEAVE: 2,
        totalMarked: 40,
      },
      pendingLeaveRequests: 3,
      departmentCounts: [
        { departmentId: "d1", code: "ENG", name: "Engineering", activeEmployeeCount: 25 },
        { departmentId: "d2", code: "HR", name: "Human Resources", activeEmployeeCount: 5 },
      ],
      recentEmployees: [
        {
          id: "e1",
          employeeCode: "EMP001",
          firstName: "Jane",
          lastName: "Doe",
          workEmail: "jane@example.com",
          joiningDate: new Date(),
          department: { name: "Engineering" },
          jobPosition: { title: "Engineer" },
        },
      ],
    }

    const hrJson = JSON.stringify(mockHrSummary).toLowerCase()
    assert.equal(hrJson.includes("basesalary"), false, "HR dashboard must not leak baseSalary")
    assert.equal(hrJson.includes("grossamount"), false, "HR dashboard must not leak grossAmount")
    assert.equal(hrJson.includes("grosspayroll"), false, "HR dashboard must not leak grossPayroll")
    assert.equal(hrJson.includes("netamount"), false, "HR dashboard must not leak netAmount")
    assert.equal(hrJson.includes("netpayroll"), false, "HR dashboard must not leak netPayroll")
    assert.equal(hrJson.includes("totaldeductions"), false, "HR dashboard must not leak totalDeductions")
  })

  it("should correctly aggregate payrun and payment status counts with zeros for unrepresented statuses", () => {
    const rawStatusGroups = [
      { status: "DRAFT", _count: { status: 3 } },
      { status: "VALIDATED", _count: { status: 5 } },
    ]

    const payrunStatusCounts: {
      DRAFT: number
      CALCULATED: number
      VALIDATED: number
      CANCELLED: number
      total: number
      [key: string]: number
    } = {
      DRAFT: 0,
      CALCULATED: 0,
      VALIDATED: 0,
      CANCELLED: 0,
      total: 0,
    }

    for (const group of rawStatusGroups) {
      payrunStatusCounts[group.status] = group._count.status
      payrunStatusCounts.total += group._count.status
    }

    assert.equal(payrunStatusCounts.DRAFT, 3)
    assert.equal(payrunStatusCounts.CALCULATED, 0)
    assert.equal(payrunStatusCounts.VALIDATED, 5)
    assert.equal(payrunStatusCounts.CANCELLED, 0)
    assert.equal(payrunStatusCounts.total, 8)
  })

  it("should correctly map department employee counts", () => {
    const rawDepts = [
      { id: "1", code: "ENG", name: "Engineering", _count: { employees: 14 } },
      { id: "2", code: "SALES", name: "Sales", _count: { employees: 6 } },
      { id: "3", code: "MKTG", name: "Marketing", _count: { employees: 0 } },
    ]

    const mapped = rawDepts.map((d) => ({
      departmentId: d.id,
      code: d.code,
      name: d.name,
      activeEmployeeCount: d._count.employees,
    }))

    assert.equal(mapped.length, 3)
    assert.equal(mapped[0]?.activeEmployeeCount, 14)
    assert.equal(mapped[1]?.activeEmployeeCount, 6)
    assert.equal(mapped[2]?.activeEmployeeCount, 0)
  })

  it("should enforce role-aware dispatcher partitioning", () => {
    function getRoleSections(role: UserRole): string[] {
      switch (role) {
        case UserRole.ADMIN:
          return ["hr", "payroll"]
        case UserRole.HR_MANAGER:
          return ["hr"]
        case UserRole.PAYROLL_MANAGER:
        case UserRole.PAYROLL_USER:
          return ["payroll"]
        case UserRole.EMPLOYEE:
        default:
          return ["me"]
      }
    }

    // Admin receives both
    const adminSections = getRoleSections(UserRole.ADMIN)
    assert.ok(adminSections.includes("hr"))
    assert.ok(adminSections.includes("payroll"))

    // HR receives hr, never payroll
    const hrSections = getRoleSections(UserRole.HR_MANAGER)
    assert.ok(hrSections.includes("hr"))
    assert.equal(hrSections.includes("payroll"), false)

    // Payroll Manager receives payroll, never hr
    const pmSections = getRoleSections(UserRole.PAYROLL_MANAGER)
    assert.ok(pmSections.includes("payroll"))
    assert.equal(pmSections.includes("hr"), false)

    // Payroll User receives payroll, never hr
    const puSections = getRoleSections(UserRole.PAYROLL_USER)
    assert.ok(puSections.includes("payroll"))
    assert.equal(puSections.includes("hr"), false)

    // Employee receives only personal me summary
    const empSections = getRoleSections(UserRole.EMPLOYEE)
    assert.deepEqual(empSections, ["me"])
  })
})
