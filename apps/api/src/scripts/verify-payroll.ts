import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  ContractStatus,
  EmploymentStatus,
  PayrunStatus,
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING PAYROLL ENGINE AND PAYRUNS VERIFICATION ===")

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
      data: { code: "PR-DEP", name: "Payroll Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "PR-POS", title: "Payroll Position" },
    })
  }

  // Users
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.pr@example.com" },
    update: { isActive: true },
    create: { email: "admin.pr@example.com", passwordHash: "hash", role: UserRole.ADMIN, isActive: true },
  })

  const pmUser = await prisma.user.upsert({
    where: { email: "pm.pr@example.com" },
    update: { isActive: true },
    create: { email: "pm.pr@example.com", passwordHash: "hash", role: UserRole.PAYROLL_MANAGER, isActive: true },
  })

  const puUser = await prisma.user.upsert({
    where: { email: "pu.pr@example.com" },
    update: { isActive: true },
    create: { email: "pu.pr@example.com", passwordHash: "hash", role: UserRole.PAYROLL_USER, isActive: true },
  })

  const hrUser = await prisma.user.upsert({
    where: { email: "hr.pr@example.com" },
    update: { isActive: true },
    create: { email: "hr.pr@example.com", passwordHash: "hash", role: UserRole.HR_MANAGER, isActive: true },
  })

  const empUser = await prisma.user.upsert({
    where: { email: "emp.pr@example.com" },
    update: { isActive: true },
    create: { email: "emp.pr@example.com", passwordHash: "hash", role: UserRole.EMPLOYEE, isActive: true },
  })

  // Employee 1: Full active setup (contract + structure)
  const emp1 = await prisma.employee.upsert({
    where: { employeeCode: "EMP-PR-001" },
    update: { employmentStatus: EmploymentStatus.ACTIVE },
    create: {
      employeeCode: "EMP-PR-001",
      firstName: "Full",
      lastName: "Payroll",
      workEmail: "full.pr@example.com",
      joiningDate: new Date("2025-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
    },
  })

  // Active contract for Employee 1 (Base Salary: 50,000)
  await prisma.employeeContract.deleteMany({ where: { employeeId: emp1.id } })
  await prisma.employeeContract.create({
    data: {
      contractNumber: `CNT-PR-001-${Date.now()}`,
      employeeId: emp1.id,
      startDate: new Date("2025-01-01"),
      baseSalary: 50000.0,
      currency: "USD",
      status: ContractStatus.ACTIVE,
    },
  })

  // Salary Structure for Employee 1
  const structCode = `PR_STRUCT_${Date.now()}`
  const structure = await prisma.salaryStructure.create({
    data: {
      code: structCode,
      name: "Payroll Test Structure",
      isActive: true,
      rules: {
        create: [
          {
            code: "BASIC_PAY",
            name: "Basic Pay Component",
            category: SalaryRuleCategory.EARNING,
            calculationType: SalaryRuleCalculationType.FIXED,
            amount: 50000.0,
            sequence: 1,
          },
          {
            code: "HRA",
            name: "House Rent Allowance",
            category: SalaryRuleCategory.EARNING,
            calculationType: SalaryRuleCalculationType.PERCENTAGE,
            percentage: 40.0,
            base: SalaryRuleBase.BASE_SALARY,
            sequence: 2,
          },
          {
            code: "PF",
            name: "Provident Fund",
            category: SalaryRuleCategory.DEDUCTION,
            calculationType: SalaryRuleCalculationType.PERCENTAGE,
            percentage: 12.0,
            base: SalaryRuleBase.BASE_SALARY,
            sequence: 3,
          },
        ],
      },
    },
  })

  // Assign structure to Employee 1
  await prisma.employeeSalaryStructureAssignment.deleteMany({ where: { employeeId: emp1.id } })
  await prisma.employeeSalaryStructureAssignment.create({
    data: {
      employeeId: emp1.id,
      structureId: structure.id,
      effectiveFrom: new Date("2025-01-01"),
    },
  })

  // Employee 2: Missing structure setup (to test warnings)
  const emp2 = await prisma.employee.upsert({
    where: { employeeCode: "EMP-PR-002" },
    update: { employmentStatus: EmploymentStatus.ACTIVE },
    create: {
      employeeCode: "EMP-PR-002",
      firstName: "Warning",
      lastName: "Case",
      workEmail: "warning.pr@example.com",
      joiningDate: new Date("2025-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
    },
  })
  await prisma.employeeSalaryStructureAssignment.deleteMany({ where: { employeeId: emp2.id } })

  // Tokens
  const adminToken = await createAccessToken({ userId: adminUser.id, role: UserRole.ADMIN })
  const pmToken = await createAccessToken({ userId: pmUser.id, role: UserRole.PAYROLL_MANAGER })
  const puToken = await createAccessToken({ userId: puUser.id, role: UserRole.PAYROLL_USER })
  const hrToken = await createAccessToken({ userId: hrUser.id, role: UserRole.HR_MANAGER })
  const empToken = await createAccessToken({ userId: empUser.id, role: UserRole.EMPLOYEE })

  async function api(path: string, options: RequestInit = {}, token = pmToken) {
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
    // --- TEST 1: Payrun Creation & Validations ---
    console.log("\n[TEST 1] Payrun Creation & Validation")
    const payrunCode = `PAYRUN-2026-09-${Date.now()}`
    const resCreate = await api("/payruns", {
      method: "POST",
      body: JSON.stringify({
        code: payrunCode,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
      }),
    }, pmToken)

    console.log(`Payrun Created: ${resCreate.status}, Code: ${resCreate.data?.payrun?.code}, Status: ${resCreate.data?.payrun?.status}`)
    if (resCreate.status !== 201 || resCreate.data?.payrun?.status !== "DRAFT") {
      throw new Error("Expected 201 with DRAFT status for new payrun")
    }
    const payrunId = resCreate.data.payrun.id

    // Duplicate period conflict -> 409
    const resDupPeriod = await api("/payruns", {
      method: "POST",
      body: JSON.stringify({
        code: `PAYRUN-DUP-${Date.now()}`,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
      }),
    }, pmToken)
    console.log(`Duplicate period status: ${resDupPeriod.status}, Code: ${resDupPeriod.data?.error?.code}`)
    if (resDupPeriod.status !== 409 || resDupPeriod.data?.error?.code !== "PAYRUN_PERIOD_CONFLICT") {
      throw new Error("Expected 409 PAYRUN_PERIOD_CONFLICT")
    }

    // Invalid dates (periodEnd < periodStart) -> 400
    const resBadDates = await api("/payruns", {
      method: "POST",
      body: JSON.stringify({
        code: `BAD-DATES-${Date.now()}`,
        periodStart: "2026-09-30",
        periodEnd: "2026-09-01",
      }),
    }, pmToken)
    if (resBadDates.status !== 400) throw new Error("Expected 400 for periodEnd < periodStart")
    console.log("✔ TEST 1 PASSED")

    // --- TEST 2: Payrun Calculation by PAYROLL_USER (Least Privilege Operation) ---
    console.log("\n[TEST 2] Payrun Calculation by PAYROLL_USER")
    const resCalc = await api(`/payruns/${payrunId}/calculate`, {
      method: "POST",
    }, puToken) // PAYROLL_USER calculates draft

    console.log(`Calculated Payrun: ${resCalc.status}, Status: ${resCalc.data?.payrun?.status}, Total Net: ${resCalc.data?.payrun?.totalNet}`)
    if (resCalc.status !== 200 || resCalc.data?.payrun?.status !== "CALCULATED") {
      throw new Error("Expected 200 with CALCULATED status")
    }

    // Inspect items
    const resItems = await api(`/payruns/${payrunId}/employees`, {
      method: "GET",
    }, puToken)
    console.log(`Calculated Employee Records: ${resItems.status}, Count: ${resItems.data?.items?.length}`)
    if (resItems.status !== 200 || resItems.data.items.length < 2) {
      throw new Error("Expected 200 with calculated employee records")
    }

    const emp1Record = resItems.data.items.find((i: any) => i.employeeId === emp1.id)
    const emp2Record = resItems.data.items.find((i: any) => i.employeeId === emp2.id)

    // Employee 1: Base 50000 + Basic 50000 + HRA 20000 (40%) - PF 6000 (12%)
    // Gross: 120000, Deduction: 6000, Net: 114000
    console.log(`Emp 1 Net: ${emp1Record.netAmount}, WarningCount: ${emp1Record.warningCount}`)
    if (Number(emp1Record.netAmount) !== 114000 || emp1Record.warningCount !== 0) {
      throw new Error(`Expected Emp 1 Net = 114000 and 0 warnings, got ${emp1Record.netAmount}`)
    }
    if (!emp1Record.contractSnapshot || !emp1Record.salaryStructureSnapshot) {
      throw new Error("Snapshots must be populated for immutable auditability")
    }

    // Employee 2: Warnings recorded without silent corruption
    console.log(`Emp 2 Net: ${emp2Record.netAmount}, WarningCount: ${emp2Record.warningCount}`)
    if (emp2Record.warningCount === 0 || Number(emp2Record.netAmount) !== 0) {
      throw new Error("Expected Emp 2 to have warnings and safe 0 net amount")
    }
    console.log("✔ TEST 2 PASSED (Snapshots & warnings verified)")

    // --- TEST 3: Repeatable Calculation ---
    console.log("\n[TEST 3] Repeatable Calculation in CALCULATED Status")
    const resRecalc = await api(`/payruns/${payrunId}/calculate`, {
      method: "POST",
    }, pmToken)
    console.log(`Recalculated status: ${resRecalc.status}`)
    if (resRecalc.status !== 200 || resRecalc.data?.payrun?.status !== "CALCULATED") {
      throw new Error("Expected repeatable calculation to succeed")
    }
    console.log("✔ TEST 3 PASSED")

    // --- TEST 4: Validation Role Restrictions (PAYROLL_USER Forbidden) ---
    console.log("\n[TEST 4] Validation Role Restrictions")
    // PAYROLL_USER attempts validation -> 403 Forbidden
    const resPuValidate = await api(`/payruns/${payrunId}/validate`, {
      method: "POST",
    }, puToken)
    console.log(`PAYROLL_USER validate status: ${resPuValidate.status}`)
    if (resPuValidate.status !== 403) throw new Error("Expected 403 for PAYROLL_USER validating payrun")

    // PAYROLL_MANAGER validates -> 200 OK
    const resPmValidate = await api(`/payruns/${payrunId}/validate`, {
      method: "POST",
    }, pmToken)
    console.log(`PAYROLL_MANAGER validate status: ${resPmValidate.status}, Status: ${resPmValidate.data?.payrun?.status}`)
    if (resPmValidate.status !== 200 || resPmValidate.data?.payrun?.status !== "VALIDATED") {
      throw new Error("Expected 200 with VALIDATED status")
    }
    console.log("✔ TEST 4 PASSED")

    // --- TEST 5: Immutability of Validated Payrun ---
    console.log("\n[TEST 5] Immutability of Validated Payrun")
    // Attempting recalculation on VALIDATED payrun -> 409
    const resRecalcValidated = await api(`/payruns/${payrunId}/calculate`, {
      method: "POST",
    }, pmToken)
    console.log(`Recalculate validated payrun status: ${resRecalcValidated.status}, Code: ${resRecalcValidated.data?.error?.code}`)
    if (resRecalcValidated.status !== 409 || resRecalcValidated.data?.error?.code !== "PAYRUN_ALREADY_VALIDATED") {
      throw new Error("Expected 409 PAYRUN_ALREADY_VALIDATED")
    }

    // Attempting cancellation on VALIDATED payrun -> 409
    const resCancelValidated = await api(`/payruns/${payrunId}/cancel`, {
      method: "POST",
    }, pmToken)
    console.log(`Cancel validated payrun status: ${resCancelValidated.status}, Code: ${resCancelValidated.data?.error?.code}`)
    if (resCancelValidated.status !== 409 || resCancelValidated.data?.error?.code !== "PAYRUN_ALREADY_VALIDATED") {
      throw new Error("Expected 409 PAYRUN_ALREADY_VALIDATED")
    }
    console.log("✔ TEST 5 PASSED (Validated payrun is strictly immutable)")

    // --- TEST 6: Payrun Cancellation in DRAFT ---
    console.log("\n[TEST 6] Payrun Cancellation in DRAFT")
    const resDraftPayrun = await api("/payruns", {
      method: "POST",
      body: JSON.stringify({
        code: `CANCEL-DRAFT-${Date.now()}`,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
      }),
    }, pmToken)
    const cancelPayrunId = resDraftPayrun.data.payrun.id

    const resCancel = await api(`/payruns/${cancelPayrunId}/cancel`, {
      method: "POST",
    }, pmToken)
    console.log(`Cancelled draft payrun: ${resCancel.status}, Status: ${resCancel.data?.payrun?.status}`)
    if (resCancel.status !== 200 || resCancel.data?.payrun?.status !== "CANCELLED") {
      throw new Error("Expected 200 with CANCELLED status")
    }
    console.log("✔ TEST 6 PASSED")

    // --- TEST 7: Role Security Boundaries ---
    console.log("\n[TEST 7] Role Security Boundaries")
    // Employee attempting to read payruns -> 403
    const resEmpPayruns = await api("/payruns", { method: "GET" }, empToken)
    if (resEmpPayruns.status !== 403) throw new Error("Expected 403 for employee reading payruns")

    // HR Manager attempting to calculate payrun -> 403
    const resHrCalc = await api(`/payruns/${payrunId}/calculate`, { method: "POST" }, hrToken)
    if (resHrCalc.status !== 403) throw new Error("Expected 403 for HR calculating payrun")
    console.log("✔ TEST 7 PASSED (Role boundaries strictly verified)")

    console.log("\n=======================================================")
    console.log("🎉 ALL 7 PAYROLL INTEGRATION SCENARIOS PASSED!")
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
