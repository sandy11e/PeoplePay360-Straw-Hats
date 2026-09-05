import { Request, Response, Router } from "express"

import { AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import { HR_ACCESS, requireRole } from "../../auth/auth.roles.js"
import { UserRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { extractClientInfo, recordAuditLog } from "../audit/audit.service.js"

import {
  createLeaveAllocationSchema,
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  employeeIdParamSchema,
  leaveBalancesQuerySchema,
  leaveRequestListQuerySchema,
  reviewLeaveRequestSchema,
  updateLeaveTypeSchema,
  uuidParamSchema,
} from "./leave.schema.js"
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveAllocation,
  createLeaveRequest,
  createLeaveType,
  getEmployeeLeaveBalances,
  getLeaveRequestById,
  LeaveError,
  listLeaveRequests,
  listLeaveTypes,
  rejectLeaveRequest,
  updateLeaveType,
} from "./leave.service.js"

export const leaveRouter = Router()

const MANAGEMENT_AND_PAYROLL_ROLES = [
  UserRole.ADMIN,
  UserRole.HR_MANAGER,
  UserRole.PAYROLL_MANAGER,
  UserRole.PAYROLL_USER,
] as const

function handleLeaveError(error: unknown, response: Response) {
  if (error instanceof LeaveError) {
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

// -------------------------------------------------------------
// LEAVE TYPE ROUTES
// -------------------------------------------------------------

// POST /api/v1/leave-types
// Create a new leave type (ADMIN / HR_MANAGER only)
leaveRouter.post(
  "/leave-types",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = createLeaveTypeSchema.safeParse(request.body)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave type data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const leaveType = await createLeaveType(parsed.data)
      response.status(201).json({ leaveType })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// GET /api/v1/leave-types
// List all leave types
leaveRouter.get(
  "/leave-types",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const isManagement = auth.role === UserRole.ADMIN || auth.role === UserRole.HR_MANAGER
      const isActiveOnly = request.query.isActive !== undefined
        ? request.query.isActive === "true"
        : !isManagement // Employees default to active only

      const leaveTypes = await listLeaveTypes(isActiveOnly)
      response.status(200).json({ leaveTypes })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// PATCH /api/v1/leave-types/:id
// Update a leave type (ADMIN / HR_MANAGER only)
leaveRouter.patch(
  "/leave-types/:id",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = uuidParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave type ID",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = updateLeaveTypeSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave type update data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const leaveType = await updateLeaveType({
        id: paramParsed.data.id,
        ...bodyParsed.data,
      })

      response.status(200).json({ leaveType })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// -------------------------------------------------------------
// LEAVE ALLOCATION ROUTES
// -------------------------------------------------------------

// POST /api/v1/leave-allocations
// Allocate leave days to an employee for a year (ADMIN / HR_MANAGER only)
leaveRouter.post(
  "/leave-allocations",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = createLeaveAllocationSchema.safeParse(request.body)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave allocation data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const allocation = await createLeaveAllocation(parsed.data)
      response.status(201).json({ leaveAllocation: allocation })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// -------------------------------------------------------------
// LEAVE REQUEST ROUTES
// -------------------------------------------------------------

// POST /api/v1/leave-requests
// Submit a leave request
leaveRouter.post(
  "/leave-requests",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsed = createLeaveRequestSchema.safeParse(request.body)

      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave request data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      let employeeId = parsed.data.employeeId

      // If user is a regular EMPLOYEE, enforce self-only
      if (auth.role === UserRole.EMPLOYEE) {
        const employee = await prisma.employee.findUnique({
          where: { userId: auth.userId },
          select: { id: true },
        })

        if (!employee) {
          response.status(400).json({
            error: {
              code: "USER_NOT_LINKED_TO_EMPLOYEE",
              message: "User must be linked to an employee profile to submit leave requests.",
            },
          })
          return
        }

        if (employeeId && employeeId !== employee.id) {
          response.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "Employees can only submit leave requests for themselves.",
            },
          })
          return
        }

        employeeId = employee.id
      } else if (!employeeId) {
        // Admin or HR submitting without employeeId: default to linked employee
        const employee = await prisma.employee.findUnique({
          where: { userId: auth.userId },
          select: { id: true },
        })

        if (!employee) {
          response.status(400).json({
            error: {
              code: "EMPLOYEE_ID_REQUIRED",
              message: "employeeId is required when user is not linked to an employee profile.",
            },
          })
          return
        }

        employeeId = employee.id
      }

      const leaveRequest = await createLeaveRequest({
        employeeId,
        leaveTypeId: parsed.data.leaveTypeId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        reason: parsed.data.reason,
        isHalfDay: parsed.data.isHalfDay,
      })

      response.status(201).json({ leaveRequest })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// GET /api/v1/leave-requests
// List leave requests with filters and pagination
leaveRouter.get(
  "/leave-requests",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsed = leaveRequestListQuerySchema.safeParse(request.query)

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

      const filter = { ...parsed.data }

      // If user is a regular EMPLOYEE or query explicitly requests self/me
      const isSelfRequested = request.query.self === "true" || request.query.me === "true"
      if (auth.role === UserRole.EMPLOYEE || isSelfRequested) {
        const employee = await prisma.employee.findUnique({
          where: { userId: auth.userId },
          select: { id: true },
        })

        if (!employee) {
          response.status(200).json({
            leaveRequests: [],
            pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
          })
          return
        }

        if (auth.role === UserRole.EMPLOYEE && filter.employeeId && filter.employeeId !== employee.id) {
          response.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "Employees can only view their own leave requests.",
            },
          })
          return
        }

        filter.employeeId = employee.id
      }

      const result = await listLeaveRequests(filter)
      response.status(200).json(result)
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// GET /api/v1/leave-requests/me
// Personal leave requests for the authenticated user (works across all roles)
leaveRouter.get(
  "/leave-requests/me",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const employee = await prisma.employee.findUnique({
        where: { userId: auth.userId },
        select: { id: true },
      })

      if (!employee) {
        response.status(200).json({
          leaveRequests: [],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
        })
        return
      }

      const parsed = leaveRequestListQuerySchema.safeParse(request.query)
      const filter = parsed.success ? { ...parsed.data } : { page: 1, pageSize: 50 }
      filter.employeeId = employee.id

      const result = await listLeaveRequests(filter)
      response.status(200).json(result)
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// GET /api/v1/leave-balances/me and /api/v1/leave-allocations
// Personal leave balances/allocations for the authenticated user
async function getMyLeaveBalancesHandler(request: Request, response: Response) {
  try {
    const auth = response.locals.auth as AuthContext
    const employee = await prisma.employee.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    })

    if (!employee) {
      response.status(200).json({ balances: [] })
      return
    }

    const targetYear = request.query.year
      ? parseInt(request.query.year as string)
      : new Date().getUTCFullYear()

    const result = await getEmployeeLeaveBalances(employee.id, targetYear)
    response.status(200).json({
      balances: result.balances.map((b) => ({
        leaveTypeId: b.leaveTypeId,
        code: b.leaveType.code,
        name: b.leaveType.name,
        isPaid: b.leaveType.isPaid,
        year: b.year,
        allocatedDays: b.allocatedDays,
        usedDays: b.usedDays,
        remainingDays: b.availableDays,
      })),
    })
  } catch (error) {
    handleLeaveError(error, response)
  }
}

leaveRouter.get("/leave-balances/me", requireAuth, getMyLeaveBalancesHandler)
leaveRouter.get("/leave-allocations/me", requireAuth, getMyLeaveBalancesHandler)
leaveRouter.get("/leave-allocations", requireAuth, getMyLeaveBalancesHandler)

// GET /api/v1/leave-requests/:id
// Get single leave request
leaveRouter.get(
  "/leave-requests/:id",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const paramParsed = uuidParamSchema.safeParse(request.params)

      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave request ID",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const leaveRequest = await getLeaveRequestById(paramParsed.data.id)

      // Role check: Employee can only view own request
      if (auth.role === UserRole.EMPLOYEE && leaveRequest.employee.userId !== auth.userId) {
        response.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view this leave request.",
          },
        })
        return
      }

      response.status(200).json({ leaveRequest })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// POST /api/v1/leave-requests/:id/approve
// Approve a leave request (ADMIN / HR_MANAGER only; requester cannot approve own request)
leaveRouter.post(
  "/leave-requests/:id/approve",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const paramParsed = uuidParamSchema.safeParse(request.params)

      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave request ID",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = reviewLeaveRequestSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid review data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const approved = await approveLeaveRequest({
        id: paramParsed.data.id,
        reviewerUserId: auth.userId,
        comment: bodyParsed.data.comment,
      })

      const clientInfo = extractClientInfo(request)
      await recordAuditLog({
        actorUserId: auth.userId,
        action: "LEAVE_REQUEST_APPROVED",
        entityType: "LeaveRequest",
        entityId: approved.id,
        metadata: {
          employeeId: approved.employeeId,
          leaveTypeId: approved.leaveTypeId,
          requestedDays: approved.requestedDays.toString(),
          comment: bodyParsed.data.comment ?? null,
        },
        ...clientInfo,
      })

      response.status(200).json({ leaveRequest: approved })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// POST /api/v1/leave-requests/:id/reject
// Reject a leave request (ADMIN / HR_MANAGER only; requester cannot reject own request)
leaveRouter.post(
  "/leave-requests/:id/reject",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const paramParsed = uuidParamSchema.safeParse(request.params)

      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave request ID",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = reviewLeaveRequestSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid review data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const rejected = await rejectLeaveRequest({
        id: paramParsed.data.id,
        reviewerUserId: auth.userId,
        comment: bodyParsed.data.comment,
      })

      const clientInfo = extractClientInfo(request)
      await recordAuditLog({
        actorUserId: auth.userId,
        action: "LEAVE_REQUEST_REJECTED",
        entityType: "LeaveRequest",
        entityId: rejected.id,
        metadata: {
          employeeId: rejected.employeeId,
          leaveTypeId: rejected.leaveTypeId,
          requestedDays: rejected.requestedDays.toString(),
          comment: bodyParsed.data.comment ?? null,
        },
        ...clientInfo,
      })

      response.status(200).json({ leaveRequest: rejected })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// POST /api/v1/leave-requests/:id/cancel
// Cancel a leave request (Owner or ADMIN / HR_MANAGER)
leaveRouter.post(
  "/leave-requests/:id/cancel",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const paramParsed = uuidParamSchema.safeParse(request.params)

      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid leave request ID",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const cancelled = await cancelLeaveRequest({
        id: paramParsed.data.id,
        userId: auth.userId,
        userRole: auth.role,
      })

      response.status(200).json({ leaveRequest: cancelled })
    } catch (error) {
      handleLeaveError(error, response)
    }
  },
)

// Handler for GET /api/v1/employees/:employeeId/leave-balances
export async function getEmployeeLeaveBalancesHandler(
  request: Request,
  response: Response,
) {
  try {
    const auth = response.locals.auth as AuthContext
    const paramParsed = employeeIdParamSchema.safeParse(request.params)

    if (!paramParsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid employee ID parameter",
          details: paramParsed.error.flatten(),
        },
      })
      return
    }

    const employeeId = paramParsed.data.employeeId

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, userId: true },
    })

    if (!employee) {
      response.status(404).json({
        error: {
          code: "EMPLOYEE_NOT_FOUND",
          message: "Employee not found",
        },
      })
      return
    }

    // Role check: Management/Payroll or linked employee
    const isManagementOrPayroll = (MANAGEMENT_AND_PAYROLL_ROLES as readonly UserRole[]).includes(auth.role)
    const isSelf = employee.userId === auth.userId

    if (!isManagementOrPayroll && !isSelf) {
      response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to view leave balances for this employee.",
        },
      })
      return
    }

    const queryParsed = leaveBalancesQuerySchema.safeParse(request.query)
    if (!queryParsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: queryParsed.error.flatten(),
        },
      })
      return
    }

    const result = await getEmployeeLeaveBalances(employeeId, queryParsed.data.year)
    response.status(200).json(result)
  } catch (error) {
    handleLeaveError(error, response)
  }
}
