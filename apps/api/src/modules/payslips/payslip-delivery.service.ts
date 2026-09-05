import {
  DeliveryChannel,
  DeliveryStatus,
  PayslipStatus,
} from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { emailService } from "../../services/email.service.js"
import {
  generatePayslipPdf,
  getSafePayslipFilename,
} from "./payslip-pdf.service.js"
import { PayslipError } from "./payslip.service.js"

function formatDateOnly(date: Date | string): string {
  if (typeof date === "string") return date.split("T")[0] || date
  return date.toISOString().split("T")[0] || ""
}

export async function deliverPayslipEmail(
  payslipId: string,
  _adminUserId: string,
) {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          middleName: true,
          lastName: true,
          workEmail: true,
          department: { select: { name: true } },
          jobPosition: { select: { title: true } },
        },
      },
      lines: {
        orderBy: [{ sequence: "asc" }],
      },
      payrun: {
        select: { code: true },
      },
    },
  })

  if (!payslip) {
    throw new PayslipError(404, "PAYSLIP_NOT_FOUND", "Payslip not found")
  }

  if (payslip.status !== PayslipStatus.FINAL) {
    throw new PayslipError(
      400,
      "PAYSLIP_NOT_FINALIZED",
      "Cannot email a payslip that is not in FINAL status. Finalize the payslip first.",
    )
  }

  const recipient = payslip.employee.workEmail
  const filename = getSafePayslipFilename(payslip.payslipNumber)

  // 1. Generate PDF in memory (never recalculates payroll)
  const pdfBuffer = await generatePayslipPdf(payslip)

  // 2. Create Delivery record in PENDING status
  const delivery = await prisma.payslipDelivery.create({
    data: {
      payslipId: payslip.id,
      recipient,
      channel: DeliveryChannel.EMAIL,
      status: DeliveryStatus.PENDING,
    },
  })

  // 3. Send email with PDF attachment
  const subject = `Your Payslip for Period ${formatDateOnly(payslip.periodStart)} to ${formatDateOnly(payslip.periodEnd)} [${payslip.payslipNumber}]`
  const text = `Hello ${payslip.employee.firstName},\n\nYour payslip for ${formatDateOnly(payslip.periodStart)} to ${formatDateOnly(payslip.periodEnd)} has been generated.\n\nSummary:\n- Gross Pay: $${parseFloat(payslip.grossAmount.toString()).toFixed(2)}\n- Total Deductions: $${parseFloat(payslip.totalDeductions.toString()).toFixed(2)}\n- Net Pay: $${parseFloat(payslip.netAmount.toString()).toFixed(2)}\n\nPlease find your official PDF statement attached.\n\nRegards,\nPeoplePay360 Payroll Team`

  const sendResult = await emailService.sendEmail({
    to: recipient,
    subject,
    text,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  })

  // 4. Update delivery audit record upon provider confirmation
  if (sendResult.success) {
    const updated = await prisma.payslipDelivery.update({
      where: { id: delivery.id },
      data: {
        status: DeliveryStatus.SENT,
        sentAt: new Date(),
      },
    })
    return {
      success: true,
      deliveryId: updated.id,
      recipient,
      status: DeliveryStatus.SENT,
      sentAt: updated.sentAt,
    }
  } else {
    const updated = await prisma.payslipDelivery.update({
      where: { id: delivery.id },
      data: {
        status: DeliveryStatus.FAILED,
        errorMessage: sendResult.error || "Email delivery failed",
      },
    })
    return {
      success: false,
      deliveryId: updated.id,
      recipient,
      status: DeliveryStatus.FAILED,
      error: updated.errorMessage,
    }
  }
}

export async function deliverPayrunPayslipsBulk(
  payrunId: string,
  _adminUserId: string,
) {
  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    select: { id: true, code: true },
  })

  if (!payrun) {
    throw new PayslipError(404, "PAYRUN_NOT_FOUND", "Payrun not found")
  }

  const finalPayslips = await prisma.payslip.findMany({
    where: {
      payrunId,
      status: PayslipStatus.FINAL,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          middleName: true,
          lastName: true,
          workEmail: true,
          department: { select: { name: true } },
          jobPosition: { select: { title: true } },
        },
      },
      lines: {
        orderBy: [{ sequence: "asc" }],
      },
    },
  })

  if (finalPayslips.length === 0) {
    throw new PayslipError(
      400,
      "NO_FINALIZED_PAYSLIPS",
      "No finalized payslips found for this payrun. Finalize payslips before email delivery.",
    )
  }

  const results = []
  let sentCount = 0
  let failedCount = 0

  for (const payslip of finalPayslips) {
    const recipient = payslip.employee.workEmail
    const filename = getSafePayslipFilename(payslip.payslipNumber)

    try {
      // 1. Generate PDF
      const pdfBuffer = await generatePayslipPdf(payslip)

      // 2. Audit record in PENDING
      const delivery = await prisma.payslipDelivery.create({
        data: {
          payslipId: payslip.id,
          recipient,
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.PENDING,
        },
      })

      // 3. Dispatch email
      const subject = `Your Payslip for Period ${formatDateOnly(payslip.periodStart)} to ${formatDateOnly(payslip.periodEnd)} [${payslip.payslipNumber}]`
      const text = `Hello ${payslip.employee.firstName},\n\nYour payslip for ${formatDateOnly(payslip.periodStart)} to ${formatDateOnly(payslip.periodEnd)} has been generated.\n\nSummary:\n- Net Pay: $${parseFloat(payslip.netAmount.toString()).toFixed(2)}\n\nPlease find your official PDF statement attached.\n\nRegards,\nPeoplePay360 Payroll Team`

      const sendResult = await emailService.sendEmail({
        to: recipient,
        subject,
        text,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      })

      if (sendResult.success) {
        await prisma.payslipDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.SENT,
            sentAt: new Date(),
          },
        })
        sentCount++
        results.push({
          payslipId: payslip.id,
          employeeCode: payslip.employee.employeeCode,
          recipient,
          status: DeliveryStatus.SENT,
          deliveryId: delivery.id,
        })
      } else {
        await prisma.payslipDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DeliveryStatus.FAILED,
            errorMessage: sendResult.error || "Email delivery failed",
          },
        })
        failedCount++
        results.push({
          payslipId: payslip.id,
          employeeCode: payslip.employee.employeeCode,
          recipient,
          status: DeliveryStatus.FAILED,
          deliveryId: delivery.id,
          error: sendResult.error,
        })
      }
    } catch (itemError) {
      // Handle unforeseen generation or DB failure for this specific item without aborting batch
      failedCount++
      const errorMsg = itemError instanceof Error ? itemError.message : "Delivery failed"
      results.push({
        payslipId: payslip.id,
        employeeCode: payslip.employee.employeeCode,
        recipient,
        status: DeliveryStatus.FAILED,
        error: errorMsg,
      })
    }
  }

  return {
    payrunId: payrun.id,
    payrunCode: payrun.code,
    total: finalPayslips.length,
    sent: sentCount,
    failed: failedCount,
    results,
  }
}
