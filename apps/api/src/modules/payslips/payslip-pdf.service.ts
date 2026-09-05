import PDFDocument from "pdfkit"
import { SalaryRuleCategory } from "../../generated/prisma/enums.js"

export interface PayslipPdfData {
  id: string
  payslipNumber: string
  periodStart: Date | string
  periodEnd: Date | string
  baseSalary: { toString: () => string } | string | number
  grossAmount: { toString: () => string } | string | number
  totalDeductions: { toString: () => string } | string | number
  netAmount: { toString: () => string } | string | number
  status: string
  paymentStatus: string
  employee: {
    employeeCode: string
    firstName: string
    middleName?: string | null
    lastName: string
    workEmail: string
    department?: { name: string } | null
    jobPosition?: { title: string } | null
  }
  lines: Array<{
    salaryRuleCode: string
    salaryRuleName: string
    category: SalaryRuleCategory | string
    amount: { toString: () => string } | string | number
    sequence: number
  }>
}

export function getSafePayslipFilename(payslipNumber: string): string {
  const sanitized = payslipNumber.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `payslip-${sanitized}.pdf`
}

function formatDateOnly(date: Date | string): string {
  if (typeof date === "string") {
    return date.split("T")[0] || date
  }
  return date.toISOString().split("T")[0] || ""
}

export async function generatePayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 45, size: "A4" })
      const chunks: Buffer[] = []

      doc.on("data", (chunk: Buffer) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", (err: Error) => reject(err))

      const primaryColor = "#1E293B" // Slate 800
      const secondaryColor = "#475569" // Slate 600
      const accentColor = "#0284C7" // Sky 600
      const borderColor = "#CBD5E1" // Slate 300
      const lightBg = "#F8FAFC" // Slate 50

      // --- 1. HEADER ---
      doc.rect(45, 45, 505, 55).fill(lightBg)
      doc.rect(45, 45, 505, 55).stroke(borderColor)

      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .fillColor(accentColor)
        .text("PEOPLEPAY360", 60, 58)

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text("Official Employee Pay Statement", 60, 80)

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(data.payslipNumber, 320, 58, { align: "right", width: 215 })

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(secondaryColor)
        .text(
          `Period: ${formatDateOnly(data.periodStart)} to ${formatDateOnly(data.periodEnd)}`,
          320,
          80,
          { align: "right", width: 215 },
        )

      doc.moveDown(2)

      // --- 2. EMPLOYEE & STATEMENT DETAILS ---
      const detailsTop = 115
      doc.rect(45, detailsTop, 505, 75).stroke(borderColor)

      const col1 = 60
      const col2 = 320

      // Left Column: Employee Info
      const fullName = [data.employee.firstName, data.employee.middleName, data.employee.lastName]
        .filter(Boolean)
        .join(" ")

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(secondaryColor)
        .text("EMPLOYEE DETAILS", col1, detailsTop + 10)

      doc
        .font("Helvetica")
        .fillColor(primaryColor)
        .text(`Name: ${fullName}`, col1, detailsTop + 25)
        .text(`Code: ${data.employee.employeeCode}`, col1, detailsTop + 39)
        .text(`Email: ${data.employee.workEmail}`, col1, detailsTop + 53)

      // Right Column: Position & Status
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(secondaryColor)
        .text("POSITION & STATUS", col2, detailsTop + 10)

      doc
        .font("Helvetica")
        .fillColor(primaryColor)
        .text(`Department: ${data.employee.department?.name || "N/A"}`, col2, detailsTop + 25)
        .text(`Position: ${data.employee.jobPosition?.title || "N/A"}`, col2, detailsTop + 39)
        .text(`Status: ${data.status} | Payment: ${data.paymentStatus}`, col2, detailsTop + 53)

      // --- 3. EARNINGS & DEDUCTIONS BREAKDOWN ---
      let y = 205

      const earnings = data.lines.filter(
        (l) => l.category === SalaryRuleCategory.EARNING || l.category === "EARNING",
      )
      const deductions = data.lines.filter(
        (l) => l.category === SalaryRuleCategory.DEDUCTION || l.category === "DEDUCTION",
      )

      // Table Header
      doc.rect(45, y, 505, 20).fill("#E2E8F0")
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text("CATEGORY / RULE CODE", 55, y + 5)
        .text("DESCRIPTION", 190, y + 5)
        .text("AMOUNT (USD)", 430, y + 5, { align: "right", width: 105 })

      y += 20

      // Base Salary Line
      doc.rect(45, y, 505, 18).stroke(borderColor)
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(primaryColor)
        .text("BASE", 55, y + 5)
        .text("Base Contract Salary", 190, y + 5)
        .text(`$${parseFloat(data.baseSalary.toString()).toFixed(2)}`, 430, y + 5, {
          align: "right",
          width: 105,
        })
      y += 18

      // Additional Earnings
      for (const item of earnings) {
        doc.rect(45, y, 505, 18).stroke(borderColor)
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(primaryColor)
          .text(item.salaryRuleCode, 55, y + 5)
          .text(item.salaryRuleName, 190, y + 5)
          .text(`$${parseFloat(item.amount.toString()).toFixed(2)}`, 430, y + 5, {
            align: "right",
            width: 105,
          })
        y += 18
      }

      // Deductions
      for (const item of deductions) {
        doc.rect(45, y, 505, 18).stroke(borderColor)
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#DC2626") // Red for deduction
          .text(item.salaryRuleCode, 55, y + 5)
          .text(item.salaryRuleName, 190, y + 5)
          .text(`-$${parseFloat(item.amount.toString()).toFixed(2)}`, 430, y + 5, {
            align: "right",
            width: 105,
          })
        y += 18
      }

      y += 15

      // --- 4. SUMMARY BOX ---
      doc.rect(45, y, 505, 80).fill(lightBg)
      doc.rect(45, y, 505, 80).stroke(borderColor)

      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(primaryColor)
        .text(`Base Salary:`, 60, y + 12)
        .text(`$${parseFloat(data.baseSalary.toString()).toFixed(2)}`, 160, y + 12)

        .text(`Gross Earnings:`, 60, y + 30)
        .text(`$${parseFloat(data.grossAmount.toString()).toFixed(2)}`, 160, y + 30)

        .text(`Total Deductions:`, 60, y + 48)
        .text(`-$${parseFloat(data.totalDeductions.toString()).toFixed(2)}`, 160, y + 48)

      // Net Pay Highlight Box
      doc.rect(310, y + 10, 225, 60).fill("#0284C7")
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#FFFFFF")
        .text("NET TAKE-HOME PAY", 325, y + 20)
        .fontSize(18)
        .text(`$${parseFloat(data.netAmount.toString()).toFixed(2)}`, 325, y + 40)

      // --- 5. FOOTER & AUDIT NOTICE ---
      const footerY = 730
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#94A3B8")
        .text(
          "This document is a deterministic, immutable snapshot generated by PeoplePay360.",
          45,
          footerY,
          { align: "center", width: 505 },
        )
        .text("Confidential — For intended recipient only.", 45, footerY + 12, {
          align: "center",
          width: 505,
        })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
