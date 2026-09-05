import { Request, Response, Router } from "express"

import { AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import {
  PAYROLL_MANAGE_ACCESS,
  PAYROLL_READ_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { PayslipStatus } from "../../generated/prisma/enums.js"
import {
  generatePayslipsForPayrun,
  getMyPayslipById,
  getPayslipById,
  listMyPayslips,
  listPayslipsForPayrun,
  PayslipError,
  updatePaymentStatus,
} from "./payslip.service.js"
import {
  generatePayslipPdf,
  getSafePayslipFilename,
} from "./payslip-pdf.service.js"
import {
  deliverPayrunPayslipsBulk,
  deliverPayslipEmail,
} from "./payslip-delivery.service.js"
import {
  generatePayslipsSchema,
  listMyPayslipsQuerySchema,
  listPayrunPayslipsQuerySchema,
  updatePaymentStatusSchema,
} from "./payslip.schema.js"

export const payslipRouter = Router()

function handlePayslipError(error: unknown, response: Response) {
  if (error instanceof PayslipError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    })
    return
  }

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    },
  })
}

// POST /api/v1/payruns/:id/payslips
// Generate immutable payslip records from calculated/validated payruns (ADMIN / PAYROLL_MANAGER only)
payslipRouter.post(
  "/payruns/:id/payslips",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsed = generatePayslipsSchema.safeParse(request.body ?? {})

      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid generate payslips request body",
            details: parsed.error.issues,
          },
        })
        return
      }

      const result = await generatePayslipsForPayrun(
        String(request.params.id),
        parsed.data,
        auth.userId,
      )

      response.status(201).json({
        data: result,
      })
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// GET /api/v1/payruns/:id/payslips
// List payslips for a specific payrun (ADMIN, PAYROLL_MANAGER, PAYROLL_USER)
payslipRouter.get(
  "/payruns/:id/payslips",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsedQuery = listPayrunPayslipsQuerySchema.safeParse(request.query)

      if (!parsedQuery.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsedQuery.error.issues,
          },
        })
        return
      }

      const result = await listPayslipsForPayrun(
        String(request.params.id),
        parsedQuery.data,
      )

      response.status(200).json(result)
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// GET /api/v1/me/payslips
// Get authenticated employee's own payslips list
payslipRouter.get(
  "/me/payslips",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsedQuery = listMyPayslipsQuerySchema.safeParse(request.query)

      if (!parsedQuery.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsedQuery.error.issues,
          },
        })
        return
      }

      const result = await listMyPayslips(auth.userId, parsedQuery.data)

      response.status(200).json(result)
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// GET /api/v1/me/payslips/:id
// Get single payslip for authenticated employee (isolated self-access)
payslipRouter.get(
  "/me/payslips/:id",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const result = await getMyPayslipById(String(request.params.id), auth.userId)

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// GET /api/v1/payslips/:id
// Get payslip details by ID (Payroll roles can access any; employees only their own)
payslipRouter.get(
  "/payslips/:id",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const result = await getPayslipById(String(request.params.id), {
        userId: auth.userId,
        role: auth.role,
      })

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// PATCH /api/v1/payslips/:id/payment-status
// Update payment status (ADMIN / PAYROLL_MANAGER only)
payslipRouter.patch(
  "/payslips/:id/payment-status",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsed = updatePaymentStatusSchema.safeParse(request.body)

      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid update payment status request body",
            details: parsed.error.issues,
          },
        })
        return
      }

      const result = await updatePaymentStatus(
        String(request.params.id),
        parsed.data,
        auth.userId,
      )

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// GET /api/v1/payslips/:id/pdf
// Download or stream official finalized payslip PDF (Protected by RBAC & ownership)
payslipRouter.get(
  "/payslips/:id/pdf",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const payslip = await getPayslipById(String(request.params.id), {
        userId: auth.userId,
        role: auth.role,
      })

      if (payslip.status !== PayslipStatus.FINAL) {
        response.status(400).json({
          error: {
            code: "PAYSLIP_NOT_FINALIZED",
            message: "PDF can only be generated for finalized payslips.",
          },
        })
        return
      }

      const pdfBuffer = await generatePayslipPdf(payslip)
      const filename = getSafePayslipFilename(payslip.payslipNumber)

      response.setHeader("Content-Type", "application/pdf")
      response.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      )
      response.setHeader("Content-Length", pdfBuffer.length)
      response.status(200).send(pdfBuffer)
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// POST /api/v1/payslips/:id/email
// Deliver single finalized payslip via email with PDF attachment (ADMIN / PAYROLL_MANAGER)
payslipRouter.post(
  "/payslips/:id/email",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const result = await deliverPayslipEmail(
        String(request.params.id),
        auth.userId,
      )

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)

// POST /api/v1/payruns/:id/email-payslips
// Bulk email delivery for all finalized payslips in a payrun (ADMIN / PAYROLL_MANAGER)
payslipRouter.post(
  "/payruns/:id/email-payslips",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const result = await deliverPayrunPayslipsBulk(
        String(request.params.id),
        auth.userId,
      )

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handlePayslipError(error, response)
    }
  },
)
