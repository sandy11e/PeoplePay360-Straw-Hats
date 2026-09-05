import { Request, Response, Router } from "express"

import { AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import {
  PAYROLL_MANAGE_ACCESS,
  PAYROLL_READ_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { extractClientInfo, recordAuditLog } from "../audit/audit.service.js"

import {
  calculatePayrun,
  cancelPayrun,
  createPayrun,
  getPayrunById,
  getPayrunEmployees,
  listPayruns,
  PayrollError,
  validatePayrun,
} from "./payroll-engine.service.js"
import {
  createPayrunSchema,
  payrunIdParamSchema,
  payrunQuerySchema,
} from "./payroll.schema.js"

export const payrollRouter = Router()

function handlePayrollError(error: unknown, response: Response) {
  if (error instanceof PayrollError) {
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

// POST /api/v1/payruns
// Create a new payrun period in DRAFT status (ADMIN / PAYROLL_MANAGER only)
payrollRouter.post(
  "/payruns",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsed = createPayrunSchema.safeParse(request.body)

      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payrun creation data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const payrun = await createPayrun({
        code: parsed.data.code,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        createdByUserId: auth.userId,
      })

      response.status(201).json({ payrun })
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)

// GET /api/v1/payruns
// List payruns with filters and pagination (ADMIN / PAYROLL_MANAGER / PAYROLL_USER)
payrollRouter.get(
  "/payruns",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = payrunQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const result = await listPayruns(parsed.data)
      response.status(200).json(result)
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)

// GET /api/v1/payruns/:id
// Get single payrun details
payrollRouter.get(
  "/payruns/:id",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = payrunIdParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payrun ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const payrun = await getPayrunById(paramParsed.data.id)
      response.status(200).json({ payrun })
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)

// POST /api/v1/payruns/:id/calculate
// Calculate or recalculate payrun for eligible employees (ADMIN / PAYROLL_MANAGER / PAYROLL_USER)
payrollRouter.post(
  "/payruns/:id/calculate",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = payrunIdParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payrun ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const auth = response.locals.auth as AuthContext
      const payrun = await calculatePayrun(paramParsed.data.id)

      const clientInfo = extractClientInfo(request)
      await recordAuditLog({
        actorUserId: auth.userId,
        action: "PAYRUN_CALCULATED",
        entityType: "Payrun",
        entityId: payrun.id,
        metadata: {
          code: payrun.code,
          periodStart: payrun.periodStart,
          periodEnd: payrun.periodEnd,
          status: payrun.status,
          employeeCount: payrun._count?.items ?? 0,
        },
        ...clientInfo,
      })

      response.status(200).json({ payrun })
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)

// POST /api/v1/payruns/:id/validate
// Validate payrun, locking it to be immutable (ADMIN / PAYROLL_MANAGER only; PAYROLL_USER forbidden)
payrollRouter.post(
  "/payruns/:id/validate",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const paramParsed = payrunIdParamSchema.safeParse(request.params)

      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payrun ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const payrun = await validatePayrun(paramParsed.data.id, auth.userId)

      const clientInfo = extractClientInfo(request)
      await recordAuditLog({
        actorUserId: auth.userId,
        action: "PAYRUN_VALIDATED",
        entityType: "Payrun",
        entityId: payrun.id,
        metadata: {
          code: payrun.code,
          status: payrun.status,
          validatedAt: payrun.validatedAt,
        },
        ...clientInfo,
      })

      response.status(200).json({ payrun })
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)

// POST /api/v1/payruns/:id/cancel
// Cancel payrun (ADMIN / PAYROLL_MANAGER only)
payrollRouter.post(
  "/payruns/:id/cancel",
  requireAuth,
  requireRole(...PAYROLL_MANAGE_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = payrunIdParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payrun ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const payrun = await cancelPayrun(paramParsed.data.id)
      response.status(200).json({ payrun })
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)

// GET /api/v1/payruns/:id/employees
// Get calculated employee records for a payrun
payrollRouter.get(
  "/payruns/:id/employees",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = payrunIdParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payrun ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const result = await getPayrunEmployees(paramParsed.data.id)
      response.status(200).json(result)
    } catch (error) {
      handlePayrollError(error, response)
    }
  },
)
