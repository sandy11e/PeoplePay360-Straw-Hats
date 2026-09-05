import { Request, Response, Router } from "express"

import { requireAuth } from "../../auth/auth.middleware.js"
import {
  HR_ACCESS,
  requireRole,
  SCHEDULE_READ_ACCESS,
} from "../../auth/auth.roles.js"
import { prisma } from "../../lib/prisma.js"
import {
  assignScheduleSchema,
  calculateExpectedMinutes,
  createWorkScheduleSchema,
  DAY_ORDER,
  employeeIdParamSchema,
  employeeScheduleQuerySchema,
  scheduleIdParamSchema,
  updateWorkScheduleSchema,
  workScheduleQuerySchema,
} from "./work-schedule.schema.js"

export const workScheduleRouter = Router()

// Helper to sort schedule days Mon-Sun
function sortDays<T extends { dayOfWeek: keyof typeof DAY_ORDER }>(days: T[]): T[] {
  return [...days].sort((a, b) => DAY_ORDER[a.dayOfWeek] - DAY_ORDER[b.dayOfWeek])
}

// POST /api/v1/work-schedules
// Create a new work schedule with 7 days (ADMIN / HR_MANAGER)
workScheduleRouter.post(
  "/",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    const parsed = createWorkScheduleSchema.safeParse(request.body)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid work schedule data",
          fields: parsed.error.flatten().fieldErrors,
        },
      })
      return
    }

    const { code, name, timezone, isActive, days } = parsed.data

    // Check if schedule code already exists
    const existingSchedule = await prisma.workSchedule.findUnique({
      where: { code },
    })

    if (existingSchedule) {
      response.status(409).json({
        error: {
          code: "SCHEDULE_CODE_EXISTS",
          message: `Work schedule with code "${code}" already exists`,
        },
      })
      return
    }

    // Create schedule with its 7 days in a transaction
    const schedule = await prisma.$transaction(async (tx) => {
      return tx.workSchedule.create({
        data: {
          code,
          name,
          timezone,
          isActive,
          days: {
            create: days.map((day) => {
              const isWorkingDay = day.isWorkingDay
              const startTime = isWorkingDay ? day.startTime ?? null : null
              const endTime = isWorkingDay ? day.endTime ?? null : null
              const breakMinutes = isWorkingDay ? day.breakMinutes : 0
              const expectedMinutes = calculateExpectedMinutes(
                isWorkingDay,
                startTime,
                endTime,
                breakMinutes,
              )

              return {
                dayOfWeek: day.dayOfWeek,
                isWorkingDay,
                startTime,
                endTime,
                breakMinutes,
                expectedMinutes,
              }
            }),
          },
        },
        include: {
          days: true,
        },
      })
    })

    response.status(201).json({
      schedule: {
        ...schedule,
        days: sortDays(schedule.days),
      },
    })
  },
)

// GET /api/v1/work-schedules
// List work schedules (ADMIN / HR_MANAGER / PAYROLL_*)
workScheduleRouter.get(
  "/",
  requireAuth,
  requireRole(...SCHEDULE_READ_ACCESS),
  async (request: Request, response: Response) => {
    const parsed = workScheduleQuerySchema.safeParse(request.query)

    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          fields: parsed.error.flatten().fieldErrors,
        },
      })
      return
    }

    const { page, pageSize, isActive, search } = parsed.data
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ]
    }

    const [schedules, total] = await Promise.all([
      prisma.workSchedule.findMany({
        where,
        include: {
          days: true,
          _count: {
            select: {
              assignments: true,
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: {
          name: "asc",
        },
      }),
      prisma.workSchedule.count({ where }),
    ])

    const formattedSchedules = schedules.map((schedule) => ({
      ...schedule,
      days: sortDays(schedule.days),
    }))

    response.status(200).json({
      schedules: formattedSchedules,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  },
)

// GET /api/v1/work-schedules/:id
// Get a work schedule by ID (ADMIN / HR_MANAGER / PAYROLL_*)
workScheduleRouter.get(
  "/:id",
  requireAuth,
  requireRole(...SCHEDULE_READ_ACCESS),
  async (request: Request, response: Response) => {
    const parsedParams = scheduleIdParamSchema.safeParse(request.params)

    if (!parsedParams.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid work schedule ID",
          fields: parsedParams.error.flatten().fieldErrors,
        },
      })
      return
    }

    const { id } = parsedParams.data

    const schedule = await prisma.workSchedule.findUnique({
      where: { id },
      include: {
        days: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    if (!schedule) {
      response.status(404).json({
        error: {
          code: "SCHEDULE_NOT_FOUND",
          message: "Work schedule not found",
        },
      })
      return
    }

    response.status(200).json({
      schedule: {
        ...schedule,
        days: sortDays(schedule.days),
      },
    })
  },
)

// PATCH /api/v1/work-schedules/:id
// Update a work schedule and optionally its days (ADMIN / HR_MANAGER)
workScheduleRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...HR_ACCESS),
  async (request: Request, response: Response) => {
    const parsedParams = scheduleIdParamSchema.safeParse(request.params)

    if (!parsedParams.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid work schedule ID",
          fields: parsedParams.error.flatten().fieldErrors,
        },
      })
      return
    }

    const parsedBody = updateWorkScheduleSchema.safeParse(request.body)

    if (!parsedBody.success) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid work schedule update data",
          fields: parsedBody.error.flatten().fieldErrors,
        },
      })
      return
    }

    const { id } = parsedParams.data
    const { code, name, timezone, isActive, days } = parsedBody.data

    // Check if schedule exists
    const existing = await prisma.workSchedule.findUnique({
      where: { id },
    })

    if (!existing) {
      response.status(404).json({
        error: {
          code: "SCHEDULE_NOT_FOUND",
          message: "Work schedule not found",
        },
      })
      return
    }

    // If code is being updated, verify it is unique
    if (code && code !== existing.code) {
      const codeConflict = await prisma.workSchedule.findUnique({
        where: { code },
      })

      if (codeConflict) {
        response.status(409).json({
          error: {
            code: "SCHEDULE_CODE_EXISTS",
            message: `Work schedule with code "${code}" already exists`,
          },
        })
        return
      }
    }

    // Execute update in a transaction
    const updatedSchedule = await prisma.$transaction(async (tx) => {
      // If days are provided, update each day
      if (days && days.length > 0) {
        for (const day of days) {
          const isWorkingDay = day.isWorkingDay
          const startTime = isWorkingDay ? day.startTime ?? null : null
          const endTime = isWorkingDay ? day.endTime ?? null : null
          const breakMinutes = isWorkingDay ? day.breakMinutes : 0
          const expectedMinutes = calculateExpectedMinutes(
            isWorkingDay,
            startTime,
            endTime,
            breakMinutes,
          )

          await tx.workScheduleDay.upsert({
            where: {
              scheduleId_dayOfWeek: {
                scheduleId: id,
                dayOfWeek: day.dayOfWeek,
              },
            },
            update: {
              isWorkingDay,
              startTime,
              endTime,
              breakMinutes,
              expectedMinutes,
            },
            create: {
              scheduleId: id,
              dayOfWeek: day.dayOfWeek,
              isWorkingDay,
              startTime,
              endTime,
              breakMinutes,
              expectedMinutes,
            },
          })
        }
      }

      return tx.workSchedule.update({
        where: { id },
        data: {
          ...(code !== undefined && { code }),
          ...(name !== undefined && { name }),
          ...(timezone !== undefined && { timezone }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          days: true,
        },
      })
    })

    response.status(200).json({
      schedule: {
        ...updatedSchedule,
        days: sortDays(updatedSchedule.days),
      },
    })
  },
)

// Handlers for employee schedule assignments to be mounted on employeeRouter
// POST /api/v1/employees/:employeeId/work-schedules
export async function assignEmployeeScheduleHandler(
  request: Request,
  response: Response,
): Promise<void> {
  const parsedParams = employeeIdParamSchema.safeParse(request.params)

  if (!parsedParams.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid employee ID",
        fields: parsedParams.error.flatten().fieldErrors,
      },
    })
    return
  }

  const parsedBody = assignScheduleSchema.safeParse(request.body)

  if (!parsedBody.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid schedule assignment data",
        fields: parsedBody.error.flatten().fieldErrors,
      },
    })
    return
  }

  const { employeeId } = parsedParams.data
  const { scheduleId, effectiveFrom, effectiveTo, closePrevious } = parsedBody.data

  // 1. Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
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

  // 2. Verify schedule exists
  const schedule = await prisma.workSchedule.findUnique({
    where: { id: scheduleId },
  })

  if (!schedule) {
    response.status(404).json({
      error: {
        code: "WORK_SCHEDULE_NOT_FOUND",
        message: "Work schedule not found",
      },
    })
    return
  }

  // 3. Schedule must be active for new assignments
  if (!schedule.isActive) {
    response.status(400).json({
      error: {
        code: "SCHEDULE_INACTIVE",
        message: "Cannot assign an inactive work schedule",
      },
    })
    return
  }

  // 4. Overlap detection & historical preservation logic
  let previousToCloseId: string | null = null
  let previousEffectiveToDate: Date | null = null

  if (closePrevious) {
    // Look for an existing open-ended assignment that started before effectiveFrom
    const openAssignment = await prisma.employeeScheduleAssignment.findFirst({
      where: {
        employeeId,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      orderBy: { effectiveFrom: "desc" },
    })

    if (openAssignment) {
      previousToCloseId = openAssignment.id
      // Set end date to one day prior to effectiveFrom
      previousEffectiveToDate = new Date(effectiveFrom.getTime() - 24 * 60 * 60 * 1000)
    }
  }

  // Check for any overlapping assignment for this employee
  const conflictingAssignment = await prisma.employeeScheduleAssignment.findFirst({
    where: {
      employeeId,
      ...(previousToCloseId ? { id: { not: previousToCloseId } } : {}),
      AND: [
        ...(effectiveTo ? [{ effectiveFrom: { lte: effectiveTo } }] : []),
        {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: effectiveFrom } },
          ],
        },
      ],
    },
    include: {
      schedule: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  })

  if (conflictingAssignment) {
    response.status(409).json({
      error: {
        code: "SCHEDULE_ASSIGNMENT_OVERLAP",
        message: "Employee already has a work schedule assigned for this time period",
        details: {
          conflictingAssignmentId: conflictingAssignment.id,
          effectiveFrom: conflictingAssignment.effectiveFrom,
          effectiveTo: conflictingAssignment.effectiveTo,
          scheduleCode: conflictingAssignment.schedule.code,
        },
      },
    })
    return
  }

  // Create the new assignment inside a transaction, closing previous if requested
  const assignment = await prisma.$transaction(async (tx) => {
    if (previousToCloseId && previousEffectiveToDate) {
      await tx.employeeScheduleAssignment.update({
        where: { id: previousToCloseId },
        data: { effectiveTo: previousEffectiveToDate },
      })
    }

    return tx.employeeScheduleAssignment.create({
      data: {
        employeeId,
        scheduleId,
        effectiveFrom,
        effectiveTo: effectiveTo ?? null,
      },
      include: {
        schedule: {
          select: {
            id: true,
            code: true,
            name: true,
            timezone: true,
            isActive: true,
          },
        },
      },
    })
  })

  response.status(201).json({
    assignment,
  })
}

// GET /api/v1/employees/:employeeId/work-schedules
export async function getEmployeeSchedulesHandler(
  request: Request,
  response: Response,
): Promise<void> {
  const parsedParams = employeeIdParamSchema.safeParse(request.params)

  if (!parsedParams.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid employee ID",
        fields: parsedParams.error.flatten().fieldErrors,
      },
    })
    return
  }

  const parsedQuery = employeeScheduleQuerySchema.safeParse(request.query)

  if (!parsedQuery.success) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters",
        fields: parsedQuery.error.flatten().fieldErrors,
      },
    })
    return
  }

  const { employeeId } = parsedParams.data
  const { page, pageSize, activeOnly } = parsedQuery.data

  // Check if employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
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

  const skip = (page - 1) * pageSize
  const now = new Date()

  const where: Record<string, unknown> = {
    employeeId,
  }

  if (activeOnly) {
    where.effectiveFrom = { lte: now }
    where.OR = [
      { effectiveTo: null },
      { effectiveTo: { gte: now } },
    ]
  }

  const [assignments, total] = await Promise.all([
    prisma.employeeScheduleAssignment.findMany({
      where,
      include: {
        schedule: {
          select: {
            id: true,
            code: true,
            name: true,
            timezone: true,
            isActive: true,
            days: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: {
        effectiveFrom: "desc",
      },
    }),
    prisma.employeeScheduleAssignment.count({ where }),
  ])

  const formattedAssignments = assignments.map((assignment) => ({
    ...assignment,
    schedule: {
      ...assignment.schedule,
      days: sortDays(assignment.schedule.days),
    },
  }))

  response.status(200).json({
    assignments: formattedAssignments,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}
