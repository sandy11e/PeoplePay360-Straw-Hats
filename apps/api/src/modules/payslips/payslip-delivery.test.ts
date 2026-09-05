import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  SalaryRuleCategory,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"
import {
  generatePayslipPdf,
  getSafePayslipFilename,
  PayslipPdfData,
} from "./payslip-pdf.service.js"
import { emailService } from "../../services/email.service.js"

describe("Payslip PDF and Email Delivery Unit Tests", () => {
  it("should generate a valid PDF buffer starting with %PDF- magic bytes", async () => {
    const mockPayslip: PayslipPdfData = {
      id: "ps-test-1",
      payslipNumber: "PS-PR-2026-09-EMP001",
      periodStart: new Date("2026-09-01"),
      periodEnd: new Date("2026-09-30"),
      baseSalary: new Prisma.Decimal("5000.00"),
      grossAmount: new Prisma.Decimal("5750.00"),
      totalDeductions: new Prisma.Decimal("350.00"),
      netAmount: new Prisma.Decimal("5400.00"),
      status: "FINAL",
      paymentStatus: "UNPAID",
      employee: {
        employeeCode: "EMP001",
        firstName: "Jane",
        middleName: "A.",
        lastName: "Doe",
        workEmail: "jane.doe@example.com",
        department: { name: "Engineering" },
        jobPosition: { title: "Senior Developer" },
      },
      lines: [
        {
          salaryRuleCode: "TRANSPORT",
          salaryRuleName: "Transport Allowance",
          category: SalaryRuleCategory.EARNING,
          amount: new Prisma.Decimal("250.00"),
          sequence: 1,
        },
        {
          salaryRuleCode: "PERF_BONUS",
          salaryRuleName: "Performance Bonus",
          category: SalaryRuleCategory.EARNING,
          amount: new Prisma.Decimal("500.00"),
          sequence: 2,
        },
        {
          salaryRuleCode: "PENSION",
          salaryRuleName: "Pension Contribution",
          category: SalaryRuleCategory.DEDUCTION,
          amount: new Prisma.Decimal("250.00"),
          sequence: 3,
        },
        {
          salaryRuleCode: "INSURANCE",
          salaryRuleName: "Health Insurance",
          category: SalaryRuleCategory.DEDUCTION,
          amount: new Prisma.Decimal("100.00"),
          sequence: 4,
        },
      ],
    }

    const pdfBuffer = await generatePayslipPdf(mockPayslip)

    assert.ok(Buffer.isBuffer(pdfBuffer), "PDF output should be a Buffer")
    assert.ok(pdfBuffer.length > 1000, "PDF buffer should contain generated content")

    // Verify PDF header magic bytes
    const pdfHeader = pdfBuffer.toString("utf-8", 0, 5)
    assert.equal(pdfHeader, "%PDF-", "Generated buffer must have valid %PDF- magic bytes")
  })

  it("should sanitize unsafe characters from payslip filename to prevent path traversal", () => {
    const rawNumber1 = "PS-PR-2026-09-EMP001"
    assert.equal(getSafePayslipFilename(rawNumber1), "payslip-PS-PR-2026-09-EMP001.pdf")

    const rawNumberUnsafe = "../../etc/passwd..PS/001:danger*test"
    const safeName = getSafePayslipFilename(rawNumberUnsafe)
    assert.equal(safeName.includes("/"), false, "Filename must not contain /")
    assert.equal(safeName.includes(".."), false, "Filename must not contain ..")
    assert.equal(safeName.includes(":"), false, "Filename must not contain :")
    assert.equal(safeName.includes("*"), false, "Filename must not contain *")
  })

  it("should send email via EmailService abstraction in mock/test mode", async () => {
    const result = await emailService.sendEmail({
      to: "recipient@example.com",
      subject: "Your Payslip Statement",
      text: "Please find your payslip attached.",
    })

    assert.equal(result.success, true)
    assert.ok(result.messageId, "Should return a messageId")
  })

  it("should capture and report delivery error without crashing", async () => {
    const result = await emailService.sendEmail({
      to: "invalid-simulated-bounce@example.com",
      subject: "Test Simulated Failure",
      text: "This email should fail gracefully.",
    })

    assert.equal(result.success, false)
    assert.ok(result.error?.includes("Simulated SMTP delivery failure"))
  })

  it("should continue bulk processing when an individual recipient fails", async () => {
    const mockRecipients = [
      { email: "alice@example.com", payslipId: "ps-1" },
      { email: "invalid-simulated-bounce@example.com", payslipId: "ps-2" },
      { email: "charlie@example.com", payslipId: "ps-3" },
    ]

    const results = []
    let sent = 0
    let failed = 0

    for (const recipient of mockRecipients) {
      const sendResult = await emailService.sendEmail({
        to: recipient.email,
        subject: "Bulk Test",
        text: "Bulk test content",
      })

      if (sendResult.success) {
        sent++
        results.push({ email: recipient.email, status: "SENT" })
      } else {
        failed++
        results.push({ email: recipient.email, status: "FAILED", error: sendResult.error })
      }
    }

    assert.equal(results.length, 3)
    assert.equal(sent, 2)
    assert.equal(failed, 1)
    assert.equal(results[1]?.status, "FAILED")
    assert.equal(results[2]?.status, "SENT")
  })
})
