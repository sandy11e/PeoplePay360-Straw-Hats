import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  EmploymentStatus,
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
  UserRole,
} from "../generated/prisma/enums.js"
import { Prisma } from "../generated/prisma/client.js"
import { prisma } from "../lib/prisma.js"
import { calculateSalaryBreakdown } from "../modules/salary-structures/salary-structure.service.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING SALARY STRUCTURES AND RULES VERIFICATION ===")

  // 1. Ephemeral server
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://localhost:${port}/api/v1`

  console.log(`[Test Server] Listening on ${baseUrl}`)

  // 2. Setup DB entities
  let dept = await prisma.department.findFirst()
  if (!dept) {
    dept = await prisma.department.create({
      data: { code: "PAY-DEP", name: "Payroll Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "PAY-POS", title: "Payroll Position" },
    })
  }

  // Users for different roles
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.sal@example.com" },
    update: { isActive: true },
    create: {
      email: "admin.sal@example.com",
      passwordHash: "hash",
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  const payrollManagerUser = await prisma.user.upsert({
    where: { email: "pm.sal@example.com" },
    update: { isActive: true },
    create: {
      email: "pm.sal@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_MANAGER,
      isActive: true,
    },
  })

  const payrollUser = await prisma.user.upsert({
    where: { email: "pu.sal@example.com" },
    update: { isActive: true },
    create: {
      email: "pu.sal@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_USER,
      isActive: true,
    },
  })

  const hrUser = await prisma.user.upsert({
    where: { email: "hr.sal@example.com" },
    update: { isActive: true },
    create: {
      email: "hr.sal@example.com",
      passwordHash: "hash",
      role: UserRole.HR_MANAGER,
      isActive: true,
    },
  })

  const empUser = await prisma.user.upsert({
    where: { email: "emp.sal@example.com" },
    update: { isActive: true },
    create: {
      email: "emp.sal@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const testEmp = await prisma.employee.upsert({
    where: { employeeCode: "EMP-SAL-001" },
    update: {
      userId: empUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-SAL-001",
      firstName: "Sarah",
      lastName: "Salary",
      workEmail: "emp.sal@example.com",
      joiningDate: new Date("2025-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empUser.id,
    },
  })

  // Clean previous salary data
  await prisma.employeeSalaryStructureAssignment.deleteMany({
    where: { employeeId: testEmp.id },
  })

  // Tokens
  const adminToken = await createAccessToken({ userId: adminUser.id, role: UserRole.ADMIN })
  const pmToken = await createAccessToken({ userId: payrollManagerUser.id, role: UserRole.PAYROLL_MANAGER })
  const puToken = await createAccessToken({ userId: payrollUser.id, role: UserRole.PAYROLL_USER })
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
    // --- TEST 1: Salary Structure Creation & Permissions ---
    console.log("\n[TEST 1] Salary Structure Creation & Permission Checks")
    const structCode = `TECH_STD_${Date.now()}`
    const resCreateStruct = await api("/salary-structures", {
      method: "POST",
      body: JSON.stringify({
        code: structCode,
        name: "Standard Engineering Salary Structure",
        description: "Includes basic, HRA, special allowance, and statutory deductions",
        isActive: true,
      }),
    }, pmToken) // Payroll Manager creates

    console.log(`Structure Created: ${resCreateStruct.status}, Code: ${resCreateStruct.data?.salaryStructure?.code}`)
    if (resCreateStruct.status !== 201) throw new Error("Expected 201 for salary structure creation")
    const structureId = resCreateStruct.data.salaryStructure.id

    // Duplicate code check -> 409
    const resDupCode = await api("/salary-structures", {
      method: "POST",
      body: JSON.stringify({
        code: structCode,
        name: "Duplicate Structure",
      }),
    }, pmToken)
    console.log(`Duplicate structure code status: ${resDupCode.status}, Code: ${resDupCode.data?.error?.code}`)
    if (resDupCode.status !== 409 || resDupCode.data?.error?.code !== "STRUCTURE_CODE_EXISTS") {
      throw new Error("Expected 409 STRUCTURE_CODE_EXISTS")
    }

    // HR Manager attempting to create salary structure -> 403 Forbidden
    const resHrForbidden = await api("/salary-structures", {
      method: "POST",
      body: JSON.stringify({
        code: `HR_FORBIDDEN_${Date.now()}`,
        name: "Unauthorized HR Structure",
      }),
    }, hrToken)
    console.log(`HR creating structure status: ${resHrForbidden.status}`)
    if (resHrForbidden.status !== 403) throw new Error("Expected 403 for HR creating salary structure")

    // Payroll User attempting to create salary structure -> 403 Forbidden
    const resPuForbidden = await api("/salary-structures", {
      method: "POST",
      body: JSON.stringify({
        code: `PU_FORBIDDEN_${Date.now()}`,
        name: "Unauthorized PU Structure",
      }),
    }, puToken)
    if (resPuForbidden.status !== 403) throw new Error("Expected 403 for Payroll User creating salary structure")
    console.log("✔ TEST 1 PASSED")

    // --- TEST 2: Salary Structure Listing & Reading ---
    console.log("\n[TEST 2] Salary Structure Listing & Retrieval")
    // Payroll user can read
    const resListStruct = await api("/salary-structures", { method: "GET" }, puToken)
    console.log(`Payroll User list structures: ${resListStruct.status}, Count: ${resListStruct.data?.salaryStructures?.length}`)
    if (resListStruct.status !== 200 || resListStruct.data?.salaryStructures?.length < 1) {
      throw new Error("Expected 200 with structures list for Payroll User")
    }

    // Read by ID
    const resGetStruct = await api(`/salary-structures/${structureId}`, { method: "GET" }, puToken)
    if (resGetStruct.status !== 200 || resGetStruct.data?.salaryStructure?.id !== structureId) {
      throw new Error("Expected 200 with structure details")
    }

    // Regular employee attempting to list structures -> 403
    const resEmpList = await api("/salary-structures", { method: "GET" }, empToken)
    console.log(`Employee listing structures status: ${resEmpList.status}`)
    if (resEmpList.status !== 403) throw new Error("Expected 403 for employee accessing salary structures")
    console.log("✔ TEST 2 PASSED")

    // --- TEST 3: Salary Structure Patching ---
    console.log("\n[TEST 3] Salary Structure Update")
    const resPatchStruct = await api(`/salary-structures/${structureId}`, {
      method: "PATCH",
      body: JSON.stringify({
        description: "Updated description for engineering salary structure",
      }),
    }, adminToken)
    console.log(`Updated structure description status: ${resPatchStruct.status}`)
    if (resPatchStruct.status !== 200 || resPatchStruct.data?.salaryStructure?.description !== "Updated description for engineering salary structure") {
      throw new Error("Expected 200 with updated description")
    }
    console.log("✔ TEST 3 PASSED")

    // --- TEST 4: Salary Rule Creation & Ordering ---
    console.log("\n[TEST 4] Salary Rule Creation (Fixed & Percentage Rules)")
    // Rule 1: BASIC (Fixed)
    const resRule1 = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "BASIC",
        name: "Basic Salary",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: 50000.0,
        sequence: 1,
        isTaxable: true,
      }),
    }, pmToken)
    console.log(`Rule 1 BASIC created: ${resRule1.status}, Amount: ${resRule1.data?.salaryRule?.amount}`)
    if (resRule1.status !== 201) throw new Error("Expected 201 for BASIC rule")

    // Rule 2: HRA (Percentage of BASE_SALARY)
    const resRule2 = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "HRA",
        name: "House Rent Allowance",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        percentage: 40.0,
        base: SalaryRuleBase.BASE_SALARY,
        sequence: 2,
        isTaxable: true,
      }),
    }, pmToken)
    console.log(`Rule 2 HRA created: ${resRule2.status}, Percentage: ${resRule2.data?.salaryRule?.percentage}%`)
    if (resRule2.status !== 201) throw new Error("Expected 201 for HRA rule")

    // Rule 3: SPECIAL_ALLOWANCE (Fixed)
    const resRule3 = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "SPECIAL_ALLOWANCE",
        name: "Special Allowance",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: 15000.0,
        sequence: 3,
        isTaxable: true,
      }),
    }, pmToken)
    if (resRule3.status !== 201) throw new Error("Expected 201 for SPECIAL_ALLOWANCE rule")

    // Rule 4: PF_EMPLOYEE (Percentage of BASE_SALARY)
    const resRule4 = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "PF_EMPLOYEE",
        name: "Provident Fund (Employee)",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        percentage: 12.0,
        base: SalaryRuleBase.BASE_SALARY,
        sequence: 4,
        isTaxable: false,
      }),
    }, pmToken)
    console.log(`Rule 4 PF_EMPLOYEE created: ${resRule4.status}`)
    if (resRule4.status !== 201) throw new Error("Expected 201 for PF_EMPLOYEE rule")

    // Rule 5: PROF_TAX (Fixed)
    const resRule5 = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "PROF_TAX",
        name: "Professional Tax",
        category: SalaryRuleCategory.DEDUCTION,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: 200.0,
        sequence: 5,
        isTaxable: false,
      }),
    }, pmToken)
    if (resRule5.status !== 201) throw new Error("Expected 201 for PROF_TAX rule")
    const ruleHraId = resRule2.data.salaryRule.id
    console.log("✔ TEST 4 PASSED")

    // --- TEST 5: Salary Rule Validations & Safety ---
    console.log("\n[TEST 5] Salary Rule Safety & Validation Checks")
    // Duplicate rule code in structure -> 409
    const resDupRule = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "BASIC",
        name: "Duplicate Basic",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: 1000,
        sequence: 10,
      }),
    }, pmToken)
    console.log(`Duplicate rule code status: ${resDupRule.status}, Code: ${resDupRule.data?.error?.code}`)
    if (resDupRule.status !== 409 || resDupRule.data?.error?.code !== "RULE_CODE_EXISTS_IN_STRUCTURE") {
      throw new Error("Expected 409 RULE_CODE_EXISTS_IN_STRUCTURE")
    }

    // Percentage without base -> 400
    const resNoBase = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "NO_BASE",
        name: "No Base Rule",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        percentage: 10,
        sequence: 11,
      }),
    }, pmToken)
    if (resNoBase.status !== 400) throw new Error("Expected 400 for percentage without base")

    // Percentage > 100 -> 400
    const resExcessivePct = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "HIGH_PCT",
        name: "High Percentage",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.PERCENTAGE,
        percentage: 150,
        base: SalaryRuleBase.BASE_SALARY,
        sequence: 12,
      }),
    }, pmToken)
    if (resExcessivePct.status !== 400) throw new Error("Expected 400 for percentage > 100")

    // Non-positive sequence (0) -> 400
    const resBadSeq = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "BAD_SEQ",
        name: "Bad Sequence",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: 1000,
        sequence: 0,
      }),
    }, pmToken)
    if (resBadSeq.status !== 400) throw new Error("Expected 400 for sequence < 1")

    // HR Manager attempting to add rule -> 403
    const resHrAddRule = await api(`/salary-structures/${structureId}/rules`, {
      method: "POST",
      body: JSON.stringify({
        code: "HR_RULE",
        name: "HR Unauthorized Rule",
        category: SalaryRuleCategory.EARNING,
        calculationType: SalaryRuleCalculationType.FIXED,
        amount: 1000,
        sequence: 15,
      }),
    }, hrToken)
    if (resHrAddRule.status !== 403) throw new Error("Expected 403 for HR adding salary rule")
    console.log("✔ TEST 5 PASSED")

    // --- TEST 6: Patch Salary Rule ---
    console.log("\n[TEST 6] Patch Salary Rule")
    const resPatchRule = await api(`/salary-rules/${ruleHraId}`, {
      method: "PATCH",
      body: JSON.stringify({
        percentage: 45.0,
      }),
    }, pmToken)
    console.log(`Updated HRA percentage to 45%: ${resPatchRule.status}, Percentage: ${resPatchRule.data?.salaryRule?.percentage}`)
    if (resPatchRule.status !== 200 || Number(resPatchRule.data?.salaryRule?.percentage) !== 45) {
      throw new Error("Expected 200 with percentage = 45")
    }
    console.log("✔ TEST 6 PASSED")

    // --- TEST 7: Assign Structure to Employee & Inactive Rejection ---
    console.log("\n[TEST 7] Assign Structure to Employee & Inactive Check")
    // Create an inactive structure
    const inactiveStruct = await prisma.salaryStructure.create({
      data: {
        code: `INACT_${Date.now()}`,
        name: "Inactive Salary Structure",
        isActive: false,
      },
    })

    // Attempting to assign inactive structure -> 400 STRUCTURE_INACTIVE
    const resInactAssign = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "POST",
      body: JSON.stringify({
        structureId: inactiveStruct.id,
        effectiveFrom: "2026-01-01",
      }),
    }, pmToken)
    console.log(`Inactive assignment status: ${resInactAssign.status}, Code: ${resInactAssign.data?.error?.code}`)
    if (resInactAssign.status !== 400 || resInactAssign.data?.error?.code !== "STRUCTURE_INACTIVE") {
      throw new Error("Expected 400 STRUCTURE_INACTIVE")
    }

    // Successful assignment of active structure starting 2026-01-01 (ongoing)
    const resAssign1 = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "POST",
      body: JSON.stringify({
        structureId,
        effectiveFrom: "2026-01-01",
      }),
    }, pmToken)
    console.log(`Active assignment status: ${resAssign1.status}, ID: ${resAssign1.data?.assignment?.id}`)
    if (resAssign1.status !== 201 || !resAssign1.data?.assignment?.id) {
      throw new Error("Expected 201 for salary structure assignment")
    }
    console.log("✔ TEST 7 PASSED")

    // --- TEST 8: Overlap Prevention ---
    console.log("\n[TEST 8] Assignment Overlap Prevention")
    // Attempting another assignment overlapping with ongoing 2026-01-01
    const resOverlap = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "POST",
      body: JSON.stringify({
        structureId,
        effectiveFrom: "2026-06-01",
      }),
    }, pmToken)
    console.log(`Overlap assignment status: ${resOverlap.status}, Code: ${resOverlap.data?.error?.code}`)
    if (resOverlap.status !== 409 || resOverlap.data?.error?.code !== "SALARY_STRUCTURE_ASSIGNMENT_OVERLAP") {
      throw new Error("Expected 409 SALARY_STRUCTURE_ASSIGNMENT_OVERLAP")
    }
    console.log("✔ TEST 8 PASSED")

    // --- TEST 9: Auto-Closure of Previous Assignment (closePrevious = true) ---
    console.log("\n[TEST 9] Auto-Closure of Previous Assignment with closePrevious = true")
    // Second structure
    const secondStruct = await prisma.salaryStructure.create({
      data: {
        code: `TECH_SR_${Date.now()}`,
        name: "Senior Engineering Structure",
        isActive: true,
      },
    })

    const resClosePrev = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "POST",
      body: JSON.stringify({
        structureId: secondStruct.id,
        effectiveFrom: "2026-07-01",
        closePrevious: true,
      }),
    }, pmToken)
    console.log(`Assigned with closePrevious: ${resClosePrev.status}`)
    if (resClosePrev.status !== 201) throw new Error("Expected 201 for closePrevious assignment")

    // Verify first assignment was closed on 2026-06-30
    const firstAssignUpdated = await prisma.employeeSalaryStructureAssignment.findFirst({
      where: { employeeId: testEmp.id, structureId },
    })
    const effectiveToStr = firstAssignUpdated?.effectiveTo?.toISOString().slice(0, 10)
    console.log(`First assignment effectiveTo closed at: ${effectiveToStr}`)
    if (effectiveToStr !== "2026-06-30") {
      throw new Error(`Expected effectiveTo to be 2026-06-30, got ${effectiveToStr}`)
    }
    console.log("✔ TEST 9 PASSED")

    // --- TEST 10: Retrieval of Employee Assignments & HR Read Permission ---
    console.log("\n[TEST 10] Retrieval of Employee Assignments & Role Permissions")
    // HR Manager can read employee assignments
    const resHrReadAssign = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "GET",
    }, hrToken)
    console.log(`HR reading employee assignments: ${resHrReadAssign.status}, Count: ${resHrReadAssign.data?.assignments?.length}`)
    if (resHrReadAssign.status !== 200 || resHrReadAssign.data?.assignments?.length !== 2) {
      throw new Error("Expected 200 with 2 historical assignments for HR Manager")
    }

    // HR Manager cannot create assignments -> 403
    const resHrAssignPost = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "POST",
      body: JSON.stringify({
        structureId: secondStruct.id,
        effectiveFrom: "2027-01-01",
      }),
    }, hrToken)
    console.log(`HR attempting assignment creation status: ${resHrAssignPost.status}`)
    if (resHrAssignPost.status !== 403) throw new Error("Expected 403 for HR creating assignment")

    // Employee cannot read salary structures -> 403
    const resEmpReadAssign = await api(`/employees/${testEmp.id}/salary-structures`, {
      method: "GET",
    }, empToken)
    if (resEmpReadAssign.status !== 403) throw new Error("Expected 403 for employee reading assignments")
    console.log("✔ TEST 10 PASSED")

    // --- TEST 11: Deterministic Decimal Calculation (Zero Float Drift) ---
    console.log("\n[TEST 11] Deterministic Decimal Calculation (Zero JS Float Math)")
    const rules = await prisma.salaryRule.findMany({
      where: { structureId, isActive: true },
      orderBy: { sequence: "asc" },
    })

    const baseSalary = new Prisma.Decimal("50000.00")
    const breakdown = calculateSalaryBreakdown(baseSalary, rules)

    console.log(`Base Salary: ${breakdown.baseSalary.toString()}`)
    console.log(`Gross Earnings: ${breakdown.grossEarnings.toString()}`)
    console.log(`Total Deductions: ${breakdown.totalDeductions.toString()}`)
    console.log(`Net Salary: ${breakdown.netSalary.toString()}`)

    // Detailed verification:
    // Earnings:
    // - Initial baseSalary: 50,000.00
    // - Rule 1 (BASIC Fixed): 50,000.00 -> grossEarnings becomes 100,000.00
    // - Rule 2 (HRA 45% of 50,000): 22,500.00 -> grossEarnings becomes 122,500.00
    // - Rule 3 (SPECIAL_ALLOWANCE Fixed): 15,000.00 -> grossEarnings becomes 137,500.00
    // Total Gross Earnings = 137,500.00
    // Deductions:
    // - Rule 4 (PF 12% of 50,000): 6,000.00
    // - Rule 5 (PROF_TAX Fixed): 200.00
    // Total Deductions = 6,200.00
    // Net Salary = 137,500.00 - 6,200.00 = 131,300.00
    if (!breakdown.grossEarnings.equals(new Prisma.Decimal("137500.00"))) {
      throw new Error(`Gross earnings mismatch: expected 137500.00, got ${breakdown.grossEarnings.toString()}`)
    }
    if (!breakdown.totalDeductions.equals(new Prisma.Decimal("6200.00"))) {
      throw new Error(`Total deductions mismatch: expected 6200.00, got ${breakdown.totalDeductions.toString()}`)
    }
    if (!breakdown.netSalary.equals(new Prisma.Decimal("131300.00"))) {
      throw new Error(`Net salary mismatch: expected 131300.00, got ${breakdown.netSalary.toString()}`)
    }
    console.log("✔ TEST 11 PASSED (Exact Decimal calculation verified without floating point drift)")

    console.log("\n=======================================================")
    console.log("🎉 ALL 11 SALARY STRUCTURE AND RULES TESTS PASSED!")
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
