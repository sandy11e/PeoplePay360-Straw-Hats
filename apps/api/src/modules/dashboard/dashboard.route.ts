import { Request, Response, Router } from "express"

import { AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  PAYROLL_READ_ACCESS,
  requireRole,
} from "../../auth/auth.roles.js"
import { dashboardRecentQuerySchema } from "./dashboard.schema.js"
import {
  DashboardError,
  getEmployeeDashboardSummary,
  getHrDashboardSummary,
  getPayrollDashboardSummary,
  getRoleAwareDashboard,
} from "./dashboard.service.js"

export const dashboardRouter = Router()

function handleDashboardError(error: unknown, response: Response) {
  if (error instanceof DashboardError) {
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

// GET /api/v1/dashboard/hr
// HR Metrics: Employee counts, attendance today, leave requests, department counts (ADMIN, HR_MANAGER)
// Confidential: No salary/compensation data is leaked.
dashboardRouter.get(
  "/dashboard/hr",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = dashboardRecentQuerySchema.safeParse(request.query)
      const limit = parsed.success ? parsed.data.limit : 5
      const result = await getHrDashboardSummary(limit)

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handleDashboardError(error, response)
    }
  },
)

// GET /api/v1/dashboard/payroll
// Payroll Metrics: Latest payrun, payrun status counts, totals, unpaid payslips, warnings (ADMIN, PAYROLL roles)
dashboardRouter.get(
  "/dashboard/payroll",
  requireAuth,
  requireRole(...PAYROLL_READ_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = dashboardRecentQuerySchema.safeParse(request.query)
      const limit = parsed.success ? parsed.data.limit : 10
      const result = await getPayrollDashboardSummary(limit)

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handleDashboardError(error, response)
    }
  },
)

// GET /api/v1/dashboard/me
// Employee Self-Service Dashboard: Profile, monthly attendance, leave balances, latest payslip
dashboardRouter.get(
  "/dashboard/me",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const result = await getEmployeeDashboardSummary(auth.userId)

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handleDashboardError(error, response)
    }
  },
)

// GET /api/v1/dashboard
// Unified role-aware dashboard entrypoint
dashboardRouter.get(
  "/dashboard",
  requireAuth,
  async (_request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const result = await getRoleAwareDashboard({
        userId: auth.userId,
        role: auth.role,
      })

      response.status(200).json({
        data: result,
      })
    } catch (error) {
      handleDashboardError(error, response)
    }
  },
)
