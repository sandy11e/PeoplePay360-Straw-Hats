import { Request, Response, Router } from "express"

import { AuthContext, requireAuth } from "../../auth/auth.middleware.js"
import { HR_ACCESS, requireRole } from "../../auth/auth.roles.js"
import { UserRole } from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"

import {
  attendanceIdParamSchema,
  attendanceListQuerySchema,
  checkInBodySchema,
  checkOutBodySchema,
  manualAttendanceSchema,
  updateAttendanceSchema,
} from "./attendance.schema.js"
import {
  AttendanceError,
  createManualAttendance,
  getAttendanceById,
  listAttendances,
  performCheckIn,
  performCheckOut,
  updateAttendance,
} from "./attendance.service.js"

export const attendanceRouter = Router()

const MANAGEMENT_AND_PAYROLL_ROLES = [
  UserRole.ADMIN,
  UserRole.HR_MANAGER,
  UserRole.PAYROLL_MANAGER,
  UserRole.PAYROLL_USER,
]

// Helper to get linked employee for authenticated user
async function getLinkedEmployee(userId: string) {
  return prisma.employee.findUnique({
    where: { userId },
    select: { id: true, employmentStatus: true },
  })
}

// Helper to format error responses
function handleAttendanceError(error: unknown, response: Response) {
  if (error instanceof AttendanceError) {
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

// POST /api/v1/attendance/check-in
// Self-service employee check-in
attendanceRouter.post(
  "/check-in",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const employee = await getLinkedEmployee(auth.userId)

      if (!employee) {
        response.status(400).json({
          error: {
            code: "USER_NOT_LINKED_TO_EMPLOYEE",
            message: "User must be linked to an employee profile to record attendance.",
          },
        })
        return
      }

      const parsed = checkInBodySchema.safeParse(request.body)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid check-in data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const record = await performCheckIn({
        employeeId: employee.id,
        source: parsed.data.source,
        notes: parsed.data.notes,
        checkInAt: parsed.data.checkInAt,
      })

      response.status(201).json({
        attendance: record,
      })
    } catch (error) {
      handleAttendanceError(error, response)
    }
  },
)

// POST /api/v1/attendance/check-out
// Self-service employee check-out
attendanceRouter.post(
  "/check-out",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const employee = await getLinkedEmployee(auth.userId)

      if (!employee) {
        response.status(400).json({
          error: {
            code: "USER_NOT_LINKED_TO_EMPLOYEE",
            message: "User must be linked to an employee profile to record attendance.",
          },
        })
        return
      }

      const parsed = checkOutBodySchema.safeParse(request.body)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid check-out data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const record = await performCheckOut({
        employeeId: employee.id,
        notes: parsed.data.notes,
        checkOutAt: parsed.data.checkOutAt,
      })

      response.status(200).json({
        attendance: record,
      })
    } catch (error) {
      handleAttendanceError(error, response)
    }
  },
)

// POST /api/v1/attendance/manual
// Create manual attendance record (ADMIN / HR_MANAGER only)
attendanceRouter.post(
  "/manual",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const parsed = manualAttendanceSchema.safeParse(request.body)
      if (!parsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid manual attendance data",
            details: parsed.error.flatten(),
          },
        })
        return
      }

      const record = await createManualAttendance(parsed.data)

      response.status(201).json({
        attendance: record,
      })
    } catch (error) {
      handleAttendanceError(error, response)
    }
  },
)

// GET /api/v1/attendance
// List attendance records with date range, employee, status filters and pagination
attendanceRouter.get(
  "/",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const parsed = attendanceListQuerySchema.safeParse(request.query)

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

      // If user is a regular employee, they can only view their own records
      if (auth.role === UserRole.EMPLOYEE) {
        const employee = await getLinkedEmployee(auth.userId)
        if (!employee) {
          response.status(400).json({
            error: {
              code: "USER_NOT_LINKED_TO_EMPLOYEE",
              message: "User must be linked to an employee profile to view attendance.",
            },
          })
          return
        }

        if (filter.employeeId && filter.employeeId !== employee.id) {
          response.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "Employees can only view their own attendance records.",
            },
          })
          return
        }

        filter.employeeId = employee.id
      }

      const result = await listAttendances(filter)
      response.status(200).json(result)
    } catch (error) {
      handleAttendanceError(error, response)
    }
  },
)

// GET /api/v1/attendance/:id
// Get single attendance record
attendanceRouter.get(
  "/:id",
  requireAuth,
  async (request: Request, response: Response) => {
    try {
      const auth = response.locals.auth as AuthContext
      const paramParsed = attendanceIdParamSchema.safeParse(request.params)

      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid attendance ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const record = await getAttendanceById(paramParsed.data.id)

      // Role authorization
      if (auth.role === UserRole.EMPLOYEE) {
        const employee = await getLinkedEmployee(auth.userId)
        if (!employee || record.employeeId !== employee.id) {
          response.status(403).json({
            error: {
              code: "FORBIDDEN",
              message: "You do not have permission to view this attendance record.",
            },
          })
          return
        }
      }

      response.status(200).json({
        attendance: record,
      })
    } catch (error) {
      handleAttendanceError(error, response)
    }
  },
)

// PATCH /api/v1/attendance/:id
// Update attendance record (ADMIN / HR_MANAGER only)
attendanceRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    try {
      const paramParsed = attendanceIdParamSchema.safeParse(request.params)
      if (!paramParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid attendance ID parameter",
            details: paramParsed.error.flatten(),
          },
        })
        return
      }

      const bodyParsed = updateAttendanceSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        response.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid update data",
            details: bodyParsed.error.flatten(),
          },
        })
        return
      }

      const record = await updateAttendance({
        id: paramParsed.data.id,
        ...bodyParsed.data,
      })

      response.status(200).json({
        attendance: record,
      })
    } catch (error) {
      handleAttendanceError(error, response)
    }
  },
)

// Handler for GET /api/v1/employees/:employeeId/attendance
export async function getEmployeeAttendanceHandler(
  request: Request,
  response: Response,
) {
  try {
    const auth = response.locals.auth as AuthContext
    const employeeId = request.params.employeeId as string

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

    // Role check: Admin, HR, Payroll or linked Employee
    const isManagementOrPayroll = (MANAGEMENT_AND_PAYROLL_ROLES as readonly UserRole[]).includes(auth.role)
    const isSelf = employee.userId === auth.userId

    if (!isManagementOrPayroll && !isSelf) {
      response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to view attendance records for this employee.",
        },
      })
      return
    }

    const queryParsed = attendanceListQuerySchema.safeParse(request.query)
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

    const result = await listAttendances({
      ...queryParsed.data,
      employeeId,
    })

    response.status(200).json(result)
  } catch (error) {
    handleAttendanceError(error, response)
  }
}
