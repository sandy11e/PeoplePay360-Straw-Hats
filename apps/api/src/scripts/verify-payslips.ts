import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  ContractStatus,
  EmploymentStatus,
  PaymentStatus,
  PayrunStatus,
  PayslipStatus,
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING PAYSLIP SUBSYSTEM VERIFICATION ===")

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
      data: { code: "PS-DEP", name: "Payslip Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "PS-POS", title: "Payslip Position" },
    })
  }

  // Users
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.ps@example.com" },
    update: { isActive: true },
    create: {
      email: "admin.ps@example.com",
      passwordHash: "hash",
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  const pmUser = await prisma.user.upsert({
    where: { email: "pm.ps@example.com" },
    update: { isActive: true },
    create: {
      email: "pm.ps@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_MANAGER,
      isActive: true,
    },
  })

  const puUser = await prisma.user.upsert({
    where: { email: "pu.ps@example.com" },
    update: { isActive: true },
    create: {
      email: "pu.ps@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_USER,
      isActive: true,
    },
  })

  const empAUser = await prisma.user.upsert({
    where: { email: "emp.a.ps@example.com" },
    update: { isActive: true },
    create: {
      email: "emp.a.ps@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const empBUser = await prisma.user.upsert({
    where: { email: "emp.b.ps@example.com" },
    update: { isActive: true },
    create: {
      email: "emp.b.ps@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  // Employee A: Alice
  const empA = await prisma.employee.upsert({
    where: { employeeCode: "EMP-PS-A" },
    update: {
      userId: empAUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-PS-A",
      firstName: "Alice",
      lastName: "Payroll",
      workEmail: "alice.ps@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empAUser.id,
    },
  })

  // Employee B: Bob
  const empB = await prisma.employee.upsert({
    where: { employeeCode: "EMP-PS-B" },
    update: {
      userId: empBUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-PS-B",
      firstName: "Bob",
      lastName: "Payroll",
      workEmail: "bob.ps@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empBUser.id,
    },
  })

  // Setup contracts
  await prisma.employeeContract.upsert({
    where: { contractNumber: "CNT-PS-A" },
    update: {
      status: ContractStatus.ACTIVE,
      baseSalary: 5000.0,
    },
    create: {
      contractNumber: "CNT-PS-A",
      employeeId: empA.id,
      startDate: new Date("2024-01-01"),
      baseSalary: 5000.0,
      currency: "USD",
      status: ContractStatus.ACTIVE,
    },
  })

  await prisma.employeeContract.upsert({
    where: { contractNumber: "CNT-PS-B" },
    update: {
      status: ContractStatus.ACTIVE,
      baseSalary: 6000.0,
    },
    create: {
      contractNumber: "CNT-PS-B",
      employeeId: empB.id,
      startDate: new Date("2024-01-01"),
      baseSalary: 6000.0,
      currency: "USD",
      status: ContractStatus.ACTIVE,
    },
  })

  // Salary Structure with Rules for Alice
  const structureCode = `STR-PS-${Date.now()}`
  const structure = await prisma.salaryStructure.create({
    data: {
      code: structureCode,
      name: "Engineering Payslip Structure",
      isActive: true,
      rules: {
        create: [
          {
            code: "TRANSPORT",
            name: "Transport Allowance",
            category: SalaryRuleCategory.EARNING,
            calculationType: SalaryRuleCalculationType.FIXED,
            amount: 250.0,
            sequence: 1,
          },
          {
            code: "PERF_BONUS",
            name: "Performance Bonus",
            category: SalaryRuleCategory.EARNING,
            calculationType: SalaryRuleCalculationType.PERCENTAGE,
            percentage: 10.0,
            base: SalaryRuleBase.BASE_SALARY,
            sequence: 2,
          },
          {
            code: "PENSION",
            name: "Pension Contribution",
            category: SalaryRuleCategory.DEDUCTION,
            calculationType: SalaryRuleCalculationType.PERCENTAGE,
            percentage: 5.0,
            base: SalaryRuleBase.BASE_SALARY,
            sequence: 3,
          },
        ],
      },
    },
  })

  // Assign structure to Alice
  await prisma.employeeSalaryStructureAssignment.create({
    data: {
      employeeId: empA.id,
      structureId: structure.id,
      effectiveFrom: new Date("2024-01-01"),
    },
  })

  // Setup Auth Tokens
  const adminToken = await createAccessToken({
    userId: adminUser.id,
    role: adminUser.role,
  })
  const pmToken = await createAccessToken({
    userId: pmUser.id,
    role: pmUser.role,
  })
  const puToken = await createAccessToken({
    userId: puUser.id,
    role: puUser.role,
  })
  const empAToken = await createAccessToken({
    userId: empAUser.id,
    role: empAUser.role,
  })
  const empBToken = await createAccessToken({
    userId: empBUser.id,
    role: empBUser.role,
  })

  // Helper fetch function
  async function api(
    method: string,
    endpoint: string,
    body?: any,
    token?: string,
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    })

    const text = await res.text()
    try {
      return { status: res.status, data: JSON.parse(text) }
    } catch {
      return { status: res.status, data: text }
    }
  }

  // Clean up any previous test payruns with PR-PS- code prefix
  const existingTestPayruns = await prisma.payrun.findMany({
    where: { code: { startsWith: "PR-PS-" } },
    select: { id: true },
  })
  if (existingTestPayruns.length > 0) {
    const ids = existingTestPayruns.map((p) => p.id)
    await prisma.payslipLine.deleteMany({ where: { payslip: { payrunId: { in: ids } } } })
    await prisma.payslip.deleteMany({ where: { payrunId: { in: ids } } })
    await prisma.payrunEmployee.deleteMany({ where: { payrunId: { in: ids } } })
    await prisma.payrun.deleteMany({ where: { id: { in: ids } } })
  }

  // Seed Payrun and calculate it
  const payrunCode = `PR-PS-${Date.now()}`
  const createPayrunRes = await api(
    "POST",
    "/payruns",
    {
      code: payrunCode,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
    },
    adminToken,
  )
  if (createPayrunRes.status !== 201) {
    throw new Error(`Failed to create payrun: ${JSON.stringify(createPayrunRes)}`)
  }
  const payrunId = createPayrunRes.data.payrun.id

  // Calculate payrun
  const calcRes = await api("POST", `/payruns/${payrunId}/calculate`, {}, pmToken)
  if (calcRes.status !== 200) {
    throw new Error(`Failed to calculate payrun: ${JSON.stringify(calcRes)}`)
  }
  console.log(`[Setup] Payrun ${payrunCode} calculated successfully.`)

  try {
    // ----------------------------------------------------
    // TEST 1: Generate Payslips from Payrun
    // ----------------------------------------------------
    console.log("\n[TEST 1] Generate Payslips from Payrun (ADMIN / PAYROLL_MANAGER)")
    const genRes = await api(
      "POST",
      `/payruns/${payrunId}/payslips`,
      {},
      pmToken,
    )
    if (genRes.status !== 201) {
      throw new Error(`Failed to generate payslips: ${JSON.stringify(genRes)}`)
    }
    console.log(`Payslips generated: ${genRes.status}, Count: ${genRes.data.data.count}`)

    // Check lines and amounts for Alice's payslip
    const aliceSlip = genRes.data.data.payslips.find(
      (p: any) => p.employeeId === empA.id,
    )
    if (!aliceSlip) throw new Error("Alice's payslip not found in generated payslips")

    console.log(
      `Alice Payslip: ${aliceSlip.payslipNumber}, Base: ${aliceSlip.baseSalary}, Gross: ${aliceSlip.grossAmount}, Net: ${aliceSlip.netAmount}, Lines: ${aliceSlip.lines?.length}`,
    )
    if (aliceSlip.lines.length !== 3) {
      throw new Error(`Expected 3 lines on Alice's payslip, got ${aliceSlip.lines.length}`)
    }
    if (parseFloat(aliceSlip.grossAmount) !== 5750) {
      throw new Error(`Expected gross 5750, got ${aliceSlip.grossAmount}`)
    }
    if (parseFloat(aliceSlip.netAmount) !== 5500) {
      throw new Error(`Expected net 5500, got ${aliceSlip.netAmount}`)
    }
    console.log("✔ TEST 1 PASSED")

    // ----------------------------------------------------
    // TEST 2: Duplicate Payslip Prevention & Draft Overwrite
    // ----------------------------------------------------
    console.log("\n[TEST 2] Duplicate Payslip Prevention & Draft Overwrite")
    const dupRes = await api(
      "POST",
      `/payruns/${payrunId}/payslips`,
      {},
      pmToken,
    )
    console.log(`Duplicate generation status: ${dupRes.status}, Code: ${dupRes.data.error?.code}`)
    if (dupRes.status !== 409 || dupRes.data.error?.code !== "PAYSLIPS_ALREADY_GENERATED") {
      throw new Error("Expected 409 PAYSLIPS_ALREADY_GENERATED on duplicate generation")
    }

    // Overwrite draft payslips
    const overwriteRes = await api(
      "POST",
      `/payruns/${payrunId}/payslips`,
      { overwriteDrafts: true },
      adminToken,
    )
    console.log(`Overwrite drafts status: ${overwriteRes.status}, Count: ${overwriteRes.data.data.count}`)
    if (overwriteRes.status !== 201) {
      throw new Error("Expected 201 on overwrite drafts")
    }
    console.log("✔ TEST 2 PASSED")

    // ----------------------------------------------------
    // TEST 3: Employee Isolation & RBAC Reading
    // ----------------------------------------------------
    console.log("\n[TEST 3] Employee Isolation & Self-Service Payslip Access")
    // Alice viewing /me/payslips
    const aliceMySlips = await api("GET", "/me/payslips", null, empAToken)
    console.log(`Alice /me/payslips count: ${aliceMySlips.data.data?.length}`)
    if (aliceMySlips.status !== 200 || !aliceMySlips.data.data || aliceMySlips.data.data.length < 1) {
      throw new Error("Alice could not retrieve her own payslips")
    }

    const currentPayrunSlip = aliceMySlips.data.data.find((p: any) => p.payrun?.id === payrunId) || aliceMySlips.data.data[0]
    const aliceSlipId = currentPayrunSlip.id

    // Alice viewing her own payslip by ID (/me/payslips/:id)
    const aliceSingleSlip = await api("GET", `/me/payslips/${aliceSlipId}`, null, empAToken)
    console.log(`Alice /me/payslips/:id status: ${aliceSingleSlip.status}`)
    if (aliceSingleSlip.status !== 200) {
      throw new Error("Alice could not retrieve her own single payslip")
    }

    // Bob attempting to view Alice's payslip via /me/payslips/:id
    const bobSpyMeRes = await api("GET", `/me/payslips/${aliceSlipId}`, null, empBToken)
    console.log(`Bob spying on Alice (/me/payslips/:id): ${bobSpyMeRes.status}, Code: ${bobSpyMeRes.data.error?.code}`)
    if (bobSpyMeRes.status !== 403) {
      throw new Error("Expected 403 when Bob attempts to view Alice's payslip via /me")
    }

    // Bob attempting to view Alice's payslip via /payslips/:id
    const bobSpyDirectRes = await api("GET", `/payslips/${aliceSlipId}`, null, empBToken)
    console.log(`Bob spying on Alice (/payslips/:id): ${bobSpyDirectRes.status}, Code: ${bobSpyDirectRes.data.error?.code}`)
    if (bobSpyDirectRes.status !== 403) {
      throw new Error("Expected 403 when Bob attempts to view Alice's payslip via /payslips/:id")
    }

    // Payroll User accessing Alice's payslip
    const puReadRes = await api("GET", `/payslips/${aliceSlipId}`, null, puToken)
    console.log(`Payroll User reading Alice's payslip: ${puReadRes.status}`)
    if (puReadRes.status !== 200) {
      throw new Error("Payroll user should be able to view payslip")
    }
    console.log("✔ TEST 3 PASSED")

    // ----------------------------------------------------
    // TEST 4: Payment Status Transition & Finalization
    // ----------------------------------------------------
    console.log("\n[TEST 4] Payment Status Transition & Finalization")
    // Employee attempting to update payment status: forbidden
    const empUpdateRes = await api(
      "PATCH",
      `/payslips/${aliceSlipId}/payment-status`,
      { paymentStatus: PaymentStatus.PAID },
      empAToken,
    )
    console.log(`Employee updating payment status: ${empUpdateRes.status}`)
    if (empUpdateRes.status !== 403) {
      throw new Error("Expected 403 when Employee attempts to update payment status")
    }

    // Payroll Manager transitioning paymentStatus to PROCESSING and status to FINAL
    const finalizeRes = await api(
      "PATCH",
      `/payslips/${aliceSlipId}/payment-status`,
      {
        paymentStatus: PaymentStatus.PROCESSING,
        status: PayslipStatus.FINAL,
      },
      pmToken,
    )
    console.log(
      `Finalized payslip status: ${finalizeRes.status}, Status: ${finalizeRes.data.data.status}, PaymentStatus: ${finalizeRes.data.data.paymentStatus}`,
    )
    if (
      finalizeRes.status !== 200 ||
      finalizeRes.data.data.status !== PayslipStatus.FINAL ||
      finalizeRes.data.data.paymentStatus !== PaymentStatus.PROCESSING
    ) {
      throw new Error("Failed to finalize and update payment status")
    }

    // Update to PAID
    const paidRes = await api(
      "PATCH",
      `/payslips/${aliceSlipId}/payment-status`,
      { paymentStatus: PaymentStatus.PAID },
      adminToken,
    )
    console.log(`Paid status: ${paidRes.status}, PaymentStatus: ${paidRes.data.data.paymentStatus}`)
    if (paidRes.status !== 200 || paidRes.data.data.paymentStatus !== PaymentStatus.PAID) {
      throw new Error("Failed to update payment status to PAID")
    }
    console.log("✔ TEST 4 PASSED")

    // ----------------------------------------------------
    // TEST 5: Immutability of Finalized Payslips
    // ----------------------------------------------------
    console.log("\n[TEST 5] Immutability of Finalized Payslips")
    const regenerateFinalRes = await api(
      "POST",
      `/payruns/${payrunId}/payslips`,
      { overwriteDrafts: true },
      adminToken,
    )
    console.log(
      `Regenerate against finalized payrun status: ${regenerateFinalRes.status}, Code: ${regenerateFinalRes.data.error?.code}`,
    )
    if (
      regenerateFinalRes.status !== 409 ||
      regenerateFinalRes.data.error?.code !== "PAYSLIPS_ALREADY_FINALIZED"
    ) {
      throw new Error("Expected 409 PAYSLIPS_ALREADY_FINALIZED when overwriting finalized payslips")
    }
    console.log("✔ TEST 5 PASSED")

    // ----------------------------------------------------
    // TEST 6: Snapshot Immunity from Subsequent Salary Rule Changes
    // ----------------------------------------------------
    console.log("\n[TEST 6] Snapshot Immunity from Subsequent Salary Rule Changes")
    // Find the transport rule and modify its amount
    const transportRule = await prisma.salaryRule.findFirst({
      where: { structureId: structure.id, code: "TRANSPORT" },
    })
    if (transportRule) {
      await prisma.salaryRule.update({
        where: { id: transportRule.id },
        data: {
          name: "Subsidized Transportation",
          amount: 999.0, // Modified from 250
        },
      })
    }

    // Retrieve Alice's payslip again
    const freshSlip = await api("GET", `/payslips/${aliceSlipId}`, null, pmToken)
    const freshLines = freshSlip.data.data.lines
    const freshTransport = freshLines.find((l: any) => l.salaryRuleCode === "TRANSPORT")

    console.log(
      `Historical rule in payslip: ${freshTransport.salaryRuleName}, Amount: ${freshTransport.amount}`,
    )
    if (freshTransport.salaryRuleName !== "Transport Allowance") {
      throw new Error("Snapshot was corrupted by salary rule name change!")
    }
    if (parseFloat(freshTransport.amount) !== 250) {
      throw new Error("Snapshot was corrupted by salary rule amount change!")
    }
    console.log("✔ TEST 6 PASSED")

    console.log("\n=======================================================")
    console.log("🎉 ALL 6 PAYSLIP SUBSYSTEM INTEGRATION TESTS PASSED!")
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
