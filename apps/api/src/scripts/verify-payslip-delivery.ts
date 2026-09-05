import http from "node:http"
import { AddressInfo } from "node:net"

import { app } from "../app.js"
import { createAccessToken } from "../auth/auth.tokens.js"
import {
  ContractStatus,
  DeliveryStatus,
  EmploymentStatus,
  PaymentStatus,
  PayslipStatus,
  SalaryRuleBase,
  SalaryRuleCalculationType,
  SalaryRuleCategory,
  UserRole,
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

async function runVerification(): Promise<void> {
  console.log("=== STARTING PAYSLIP PDF AND EMAIL DELIVERY VERIFICATION ===")

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
      data: { code: "PDF-DEP", name: "PDF Delivery Dept" },
    })
  }

  let pos = await prisma.jobPosition.findFirst()
  if (!pos) {
    pos = await prisma.jobPosition.create({
      data: { code: "PDF-POS", title: "PDF Delivery Position" },
    })
  }

  // Users
  const adminUser = await prisma.user.upsert({
    where: { email: "admin.pdf@example.com" },
    update: { isActive: true },
    create: {
      email: "admin.pdf@example.com",
      passwordHash: "hash",
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  const pmUser = await prisma.user.upsert({
    where: { email: "pm.pdf@example.com" },
    update: { isActive: true },
    create: {
      email: "pm.pdf@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_MANAGER,
      isActive: true,
    },
  })

  const puUser = await prisma.user.upsert({
    where: { email: "pu.pdf@example.com" },
    update: { isActive: true },
    create: {
      email: "pu.pdf@example.com",
      passwordHash: "hash",
      role: UserRole.PAYROLL_USER,
      isActive: true,
    },
  })

  const empAUser = await prisma.user.upsert({
    where: { email: "emp.a.pdf@example.com" },
    update: { isActive: true },
    create: {
      email: "emp.a.pdf@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  const empBUser = await prisma.user.upsert({
    where: { email: "emp.b.pdf@example.com" },
    update: { isActive: true },
    create: {
      email: "emp.b.pdf@example.com",
      passwordHash: "hash",
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  })

  // Employee A: Alice
  const empA = await prisma.employee.upsert({
    where: { employeeCode: "EMP-PDF-A" },
    update: {
      userId: empAUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-PDF-A",
      firstName: "Alice",
      lastName: "Delivery",
      workEmail: "alice.pdf@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empAUser.id,
    },
  })

  // Employee B: Bob
  const empB = await prisma.employee.upsert({
    where: { employeeCode: "EMP-PDF-B" },
    update: {
      userId: empBUser.id,
      employmentStatus: EmploymentStatus.ACTIVE,
    },
    create: {
      employeeCode: "EMP-PDF-B",
      firstName: "Bob",
      lastName: "Delivery",
      workEmail: "bob.pdf@example.com",
      joiningDate: new Date("2024-01-01"),
      employmentStatus: EmploymentStatus.ACTIVE,
      departmentId: dept.id,
      jobPositionId: pos.id,
      userId: empBUser.id,
    },
  })

  // Contracts
  await prisma.employeeContract.upsert({
    where: { contractNumber: "CNT-PDF-A" },
    update: {
      status: ContractStatus.ACTIVE,
      baseSalary: 7500.0,
    },
    create: {
      contractNumber: "CNT-PDF-A",
      employeeId: empA.id,
      startDate: new Date("2024-01-01"),
      baseSalary: 7500.0,
      currency: "USD",
      status: ContractStatus.ACTIVE,
    },
  })

  await prisma.employeeContract.upsert({
    where: { contractNumber: "CNT-PDF-B" },
    update: {
      status: ContractStatus.ACTIVE,
      baseSalary: 8500.0,
    },
    create: {
      contractNumber: "CNT-PDF-B",
      employeeId: empB.id,
      startDate: new Date("2024-01-01"),
      baseSalary: 8500.0,
      currency: "USD",
      status: ContractStatus.ACTIVE,
    },
  })

  // Salary Structure
  const structureCode = `STR-PDF-${Date.now()}`
  const structure = await prisma.salaryStructure.create({
    data: {
      code: structureCode,
      name: "Executive PDF Structure",
      isActive: true,
      rules: {
        create: [
          {
            code: "ALLOWANCE",
            name: "Executive Allowance",
            category: SalaryRuleCategory.EARNING,
            calculationType: SalaryRuleCalculationType.FIXED,
            amount: 500.0,
            sequence: 1,
          },
          {
            code: "TAX",
            name: "Income Tax Withholding",
            category: SalaryRuleCategory.DEDUCTION,
            calculationType: SalaryRuleCalculationType.PERCENTAGE,
            percentage: 15.0,
            base: SalaryRuleBase.BASE_SALARY,
            sequence: 2,
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

  // Auth tokens
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

    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/pdf")) {
      const buffer = Buffer.from(await res.arrayBuffer())
      return {
        status: res.status,
        contentType,
        headers: res.headers,
        buffer,
      }
    }

    const text = await res.text()
    try {
      return { status: res.status, contentType, data: JSON.parse(text) }
    } catch {
      return { status: res.status, contentType, data: text }
    }
  }

  // Clean previous test payruns with PR-PDF- prefix
  const existingTestPayruns = await prisma.payrun.findMany({
    where: { code: { startsWith: "PR-PDF-" } },
    select: { id: true },
  })
  if (existingTestPayruns.length > 0) {
    const ids = existingTestPayruns.map((p) => p.id)
    await prisma.payslipDelivery.deleteMany({
      where: { payslip: { payrunId: { in: ids } } },
    })
    await prisma.payslipLine.deleteMany({
      where: { payslip: { payrunId: { in: ids } } },
    })
    await prisma.payslip.deleteMany({ where: { payrunId: { in: ids } } })
    await prisma.payrunEmployee.deleteMany({ where: { payrunId: { in: ids } } })
    await prisma.payrun.deleteMany({ where: { id: { in: ids } } })
  }

  // Setup fresh payrun
  const payrunCode = `PR-PDF-${Date.now()}`
  const createPayrunRes = await api(
    "POST",
    "/payruns",
    {
      code: payrunCode,
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
    },
    adminToken,
  )
  if (createPayrunRes.status !== 201) {
    throw new Error(`Failed to create payrun: ${JSON.stringify(createPayrunRes)}`)
  }
  const payrunId = createPayrunRes.data.payrun.id

  // Calculate payrun
  await api("POST", `/payruns/${payrunId}/calculate`, {}, pmToken)

  // Generate DRAFT payslips
  const genRes = await api(
    "POST",
    `/payruns/${payrunId}/payslips`,
    { status: PayslipStatus.DRAFT },
    pmToken,
  )
  if (genRes.status !== 201) {
    throw new Error(`Failed to generate draft payslips: ${JSON.stringify(genRes)}`)
  }
  const aliceSlip = genRes.data.data.payslips.find(
    (p: any) => p.employeeId === empA.id,
  )
  const aliceSlipId = aliceSlip.id

  try {
    // ----------------------------------------------------
    // TEST 1: PDF Generation Rejection on Draft Payslips
    // ----------------------------------------------------
    console.log("\n[TEST 1] PDF Generation Rejection on Draft Payslips")
    const draftPdfRes = await api(
      "GET",
      `/payslips/${aliceSlipId}/pdf`,
      null,
      empAToken,
    )
    console.log(
      `Draft PDF response status: ${draftPdfRes.status}, Code: ${draftPdfRes.data?.error?.code}`,
    )
    if (
      draftPdfRes.status !== 400 ||
      draftPdfRes.data?.error?.code !== "PAYSLIP_NOT_FINALIZED"
    ) {
      throw new Error("Expected 400 PAYSLIP_NOT_FINALIZED when downloading draft PDF")
    }
    console.log("✔ TEST 1 PASSED")

    // ----------------------------------------------------
    // TEST 2: Finalize Payslip and Download PDF with Correct Headers
    // ----------------------------------------------------
    console.log("\n[TEST 2] Finalize Payslip and Download PDF with Correct Headers")
    // Finalize Alice's payslip
    await api(
      "PATCH",
      `/payslips/${aliceSlipId}/payment-status`,
      { paymentStatus: PaymentStatus.PROCESSING, status: PayslipStatus.FINAL },
      pmToken,
    )

    const finalPdfRes = await api(
      "GET",
      `/payslips/${aliceSlipId}/pdf`,
      null,
      empAToken,
    )
    console.log(
      `Final PDF status: ${finalPdfRes.status}, Content-Type: ${finalPdfRes.contentType}, Buffer size: ${finalPdfRes.buffer?.length}`,
    )
    if (finalPdfRes.status !== 200) {
      throw new Error(`Expected 200 on PDF download, got ${finalPdfRes.status}`)
    }
    if (!finalPdfRes.contentType.includes("application/pdf")) {
      throw new Error(`Expected Content-Type application/pdf, got ${finalPdfRes.contentType}`)
    }
    const pdfMagic = finalPdfRes.buffer?.toString("utf-8", 0, 5)
    if (pdfMagic !== "%PDF-") {
      throw new Error(`Invalid PDF header: expected %PDF-, got ${pdfMagic}`)
    }
    console.log("✔ TEST 2 PASSED")

    // ----------------------------------------------------
    // TEST 3: RBAC & Employee Isolation on PDF Route
    // ----------------------------------------------------
    console.log("\n[TEST 3] RBAC & Employee Isolation on PDF Route")
    // Bob attempting to download Alice's PDF -> 403
    const bobSpyPdf = await api(
      "GET",
      `/payslips/${aliceSlipId}/pdf`,
      null,
      empBToken,
    )
    console.log(
      `Bob attempting to download Alice's PDF: ${bobSpyPdf.status}, Code: ${bobSpyPdf.data?.error?.code}`,
    )
    if (bobSpyPdf.status !== 403) {
      throw new Error("Expected 403 when Bob attempts to download Alice's PDF")
    }

    // Payroll User downloading Alice's PDF -> 200
    const puPdfRes = await api(
      "GET",
      `/payslips/${aliceSlipId}/pdf`,
      null,
      puToken,
    )
    console.log(`Payroll User downloading Alice's PDF: ${puPdfRes.status}`)
    if (puPdfRes.status !== 200 || !puPdfRes.contentType.includes("application/pdf")) {
      throw new Error("Payroll User should be authorized to download PDF")
    }
    console.log("✔ TEST 3 PASSED")

    // ----------------------------------------------------
    // TEST 4: Single Email Delivery with Audit Record
    // ----------------------------------------------------
    console.log("\n[TEST 4] Single Email Delivery with Audit Record")
    // Employee attempting to trigger email delivery -> 403
    const empTriggerRes = await api(
      "POST",
      `/payslips/${aliceSlipId}/email`,
      {},
      empAToken,
    )
    console.log(`Employee triggering email: ${empTriggerRes.status}`)
    if (empTriggerRes.status !== 403) {
      throw new Error("Expected 403 when Employee triggers email dispatch")
    }

    // Payroll Manager triggers email delivery -> 200
    const pmSendRes = await api(
      "POST",
      `/payslips/${aliceSlipId}/email`,
      {},
      pmToken,
    )
    console.log(
      `Email sent status: ${pmSendRes.status}, Delivery ID: ${pmSendRes.data?.data?.deliveryId}, Delivery Status: ${pmSendRes.data?.data?.status}`,
    )
    if (
      pmSendRes.status !== 200 ||
      pmSendRes.data?.data?.status !== DeliveryStatus.SENT
    ) {
      throw new Error("Failed to deliver single payslip email")
    }

    // Check DB audit record
    const deliveryRecord = await prisma.payslipDelivery.findUnique({
      where: { id: pmSendRes.data.data.deliveryId },
    })
    if (!deliveryRecord || deliveryRecord.status !== DeliveryStatus.SENT || !deliveryRecord.sentAt) {
      throw new Error("Delivery record not verified in database")
    }
    console.log(
      `Verified DB Audit: Recipient=${deliveryRecord.recipient}, Status=${deliveryRecord.status}, SentAt=${deliveryRecord.sentAt.toISOString()}`,
    )
    console.log("✔ TEST 4 PASSED")

    // ----------------------------------------------------
    // TEST 5: Bulk Email Delivery for Payrun
    // ----------------------------------------------------
    console.log("\n[TEST 5] Bulk Email Delivery for Payrun")
    // Finalize all remaining payslips in payrun
    await prisma.payslip.updateMany({
      where: { payrunId },
      data: { status: PayslipStatus.FINAL },
    })

    const bulkRes = await api(
      "POST",
      `/payruns/${payrunId}/email-payslips`,
      {},
      adminToken,
    )
    console.log(
      `Bulk delivery status: ${bulkRes.status}, Total: ${bulkRes.data?.data?.total}, Sent: ${bulkRes.data?.data?.sent}, Failed: ${bulkRes.data?.data?.failed}`,
    )
    if (
      bulkRes.status !== 200 ||
      bulkRes.data?.data?.total < 2 ||
      bulkRes.data?.data?.sent < 2
    ) {
      throw new Error("Bulk delivery failed or count mismatch")
    }

    // Check that DB has audit records for all payslips
    const allDeliveries = await prisma.payslipDelivery.findMany({
      where: { payslip: { payrunId } },
    })
    console.log(`Total delivery records recorded for payrun: ${allDeliveries.length}`)
    if (allDeliveries.length < 2) {
      throw new Error("Expected at least 2 delivery records in database")
    }
    console.log("✔ TEST 5 PASSED")

    console.log("\n=======================================================")
    console.log("🎉 ALL 5 PDF AND EMAIL DELIVERY INTEGRATION TESTS PASSED!")
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
