import {
  DayOfWeek,
  EmploymentStatus,
  LeaveRequestStatus,
  UserRole,
} from "../../generated/prisma/enums.js"
import { Prisma } from "../../generated/prisma/client.js"
import { prisma } from "../../lib/prisma.js"
import { getDayOfWeekFromDate } from "../attendance/attendance.service.js"

export class LeaveError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "LeaveError"
  }
}

// Convert YYYY-MM-DD string to UTC midnight Date
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

// Format Date to YYYY-MM-DD string
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Calculate requested working days server-side
export async function calculateRequestedDays(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  isHalfDay: boolean = false,
): Promise<Prisma.Decimal> {
  if (isHalfDay) {
    return new Prisma.Decimal("0.50")
  }

  // Fetch active schedule assignments covering the leave dates
  const assignments = await prisma.employeeScheduleAssignment.findMany({
    where: {
      employeeId,
      effectiveFrom: { lte: endDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: startDate } },
      ],
      schedule: {
        isActive: true,
      },
    },
    include: {
      schedule: {
        include: {
          days: true,
        },
      },
    },
    orderBy: { effectiveFrom: "desc" },
  })

  let workingDaysCount = 0
  const currentDate = new Date(startDate.getTime())

  while (currentDate <= endDate) {
    // Determine active schedule on currentDate
    const activeAssignment = assignments.find((a) => {
      const from = a.effectiveFrom
      const to = a.effectiveTo
      return from <= currentDate && (!to || to >= currentDate)
    })

    if (activeAssignment?.schedule) {
      const timezone = activeAssignment.schedule.timezone || "UTC"
      const dayOfWeek = getDayOfWeekFromDate(currentDate, timezone)
      const scheduleDay = activeAssignment.schedule.days.find((d) => d.dayOfWeek === dayOfWeek)

      if (scheduleDay?.isWorkingDay) {
        workingDaysCount += 1
      }
    } else {
      // Fallback: Monday through Friday are working days
      const utcDay = currentDate.getUTCDay()
      if (utcDay >= 1 && utcDay <= 5) {
        workingDaysCount += 1
      }
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  if (workingDaysCount === 0) {
    throw new LeaveError(
      400,
      "NO_WORKING_DAYS_IN_RANGE",
      "The selected date range does not contain any working days according to the employee's work schedule.",
    )
  }

  return new Prisma.Decimal(workingDaysCount)
}

// -------------------------------------------------------------
// LEAVE TYPE SERVICES
// -------------------------------------------------------------

export interface CreateLeaveTypeParams {
  code: string
  name: string
  description?: string | null | undefined
  isPaid?: boolean | undefined
  isActive?: boolean | undefined
}

export async function createLeaveType(params: CreateLeaveTypeParams) {
  const existing = await prisma.leaveType.findUnique({
    where: { code: params.code },
  })

  if (existing) {
    throw new LeaveError(
      409,
      "LEAVE_TYPE_CODE_EXISTS",
      `A leave type with code '${params.code}' already exists.`,
    )
  }

  return prisma.leaveType.create({
    data: {
      code: params.code,
      name: params.name,
      description: params.description ?? null,
      isPaid: params.isPaid ?? true,
      isActive: params.isActive ?? true,
    },
  })
}

export interface UpdateLeaveTypeParams {
  id: string
  name?: string | undefined
  description?: string | null | undefined
  isPaid?: boolean | undefined
  isActive?: boolean | undefined
}

export async function updateLeaveType(params: UpdateLeaveTypeParams) {
  const { id, ...data } = params

  const existing = await prisma.leaveType.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new LeaveError(404, "LEAVE_TYPE_NOT_FOUND", "Leave type not found")
  }

  const updateData: Record<string, any> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.isPaid !== undefined) updateData.isPaid = data.isPaid
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  return prisma.leaveType.update({
    where: { id },
    data: updateData,
  })
}

export async function listLeaveTypes(isActiveOnly?: boolean) {
  const where = isActiveOnly ? { isActive: true } : {}
  return prisma.leaveType.findMany({
    where,
    orderBy: { code: "asc" },
  })
}

// -------------------------------------------------------------
// LEAVE ALLOCATION SERVICES
// -------------------------------------------------------------

export interface CreateLeaveAllocationParams {
  employeeId: string
  leaveTypeId: string
  year: number
  allocatedDays: number
}

export async function createLeaveAllocation(params: CreateLeaveAllocationParams) {
  const { employeeId, leaveTypeId, year, allocatedDays } = params

  // Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employmentStatus: true },
  })

  if (!employee) {
    throw new LeaveError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  // Verify leave type exists
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  })

  if (!leaveType) {
    throw new LeaveError(404, "LEAVE_TYPE_NOT_FOUND", "Leave type not found")
  }

  const allocatedDecimal = new Prisma.Decimal(allocatedDays)

  // Upsert allocation for employee/type/year
  return prisma.leaveAllocation.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
    update: {
      allocatedDays: allocatedDecimal,
    },
    create: {
      employeeId,
      leaveTypeId,
      year,
      allocatedDays: allocatedDecimal,
      usedDays: new Prisma.Decimal(0),
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
        },
      },
      leaveType: true,
    },
  })
}

// -------------------------------------------------------------
// LEAVE REQUEST SERVICES
// -------------------------------------------------------------

export interface CreateLeaveRequestParams {
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string | null | undefined
  isHalfDay?: boolean | undefined
}

export async function createLeaveRequest(params: CreateLeaveRequestParams) {
  const { employeeId, leaveTypeId, reason, isHalfDay } = params
  const startDate = parseDateOnly(params.startDate)
  const endDate = parseDateOnly(params.endDate)

  // 1. Verify employee exists and is active
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employmentStatus: true },
  })

  if (!employee) {
    throw new LeaveError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  if (employee.employmentStatus !== EmploymentStatus.ACTIVE) {
    throw new LeaveError(
      400,
      "EMPLOYEE_NOT_ACTIVE",
      `Cannot submit leave request for employee with status ${employee.employmentStatus}. Only ACTIVE employees can request leave.`,
    )
  }

  // 2. Verify leave type exists and is active
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  })

  if (!leaveType) {
    throw new LeaveError(404, "LEAVE_TYPE_NOT_FOUND", "Leave type not found")
  }

  if (!leaveType.isActive) {
    throw new LeaveError(400, "INACTIVE_LEAVE_TYPE", "Cannot request leave for an inactive leave type.")
  }

  // 3. Reject overlapping approved or pending requests
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  })

  if (overlapping) {
    throw new LeaveError(
      409,
      "OVERLAPPING_LEAVE_REQUEST",
      `Employee already has a ${overlapping.status.toLowerCase()} leave request overlapping this period (${formatDateOnly(overlapping.startDate)} to ${formatDateOnly(overlapping.endDate)}).`,
    )
  }

  // 4. Calculate requested days server-side
  const requestedDays = await calculateRequestedDays(
    employeeId,
    startDate,
    endDate,
    isHalfDay,
  )

  // 5. Verify allocation and sufficient balance for the request year
  const requestYear = startDate.getUTCFullYear()
  const allocation = await prisma.leaveAllocation.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year: requestYear,
      },
    },
  })

  if (!allocation) {
    throw new LeaveError(
      400,
      "NO_LEAVE_ALLOCATION",
      `No leave allocation found for employee and leave type '${leaveType.name}' for year ${requestYear}.`,
    )
  }

  const availableDays = allocation.allocatedDays.minus(allocation.usedDays)
  if (availableDays.lessThan(requestedDays)) {
    throw new LeaveError(
      400,
      "INSUFFICIENT_LEAVE_BALANCE",
      `Insufficient leave balance. Requested: ${requestedDays.toString()} days, Available: ${availableDays.toString()} days.`,
    )
  }

  // 6. Create leave request
  return prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      requestedDays,
      reason: reason ?? null,
      status: LeaveRequestStatus.PENDING,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
        },
      },
      leaveType: true,
    },
  })
}

// -------------------------------------------------------------
// APPROVAL & REJECTION WORKFLOWS (TRANSACTIONAL)
// -------------------------------------------------------------

export interface ReviewLeaveRequestParams {
  id: string
  reviewerUserId: string
  comment?: string | null | undefined
}

export async function approveLeaveRequest(params: ReviewLeaveRequestParams) {
  const { id, reviewerUserId, comment } = params

  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, userId: true },
        },
      },
    })

    if (!request) {
      throw new LeaveError(404, "LEAVE_REQUEST_NOT_FOUND", "Leave request not found")
    }

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new LeaveError(
        409,
        "INVALID_STATUS_FOR_APPROVAL",
        `Only PENDING leave requests can be approved. Current status: ${request.status}.`,
      )
    }

    // Separation of Duties: Requester cannot approve own request
    if (request.employee.userId === reviewerUserId) {
      throw new LeaveError(
        403,
        "SELF_APPROVAL_NOT_ALLOWED",
        "Requesters cannot approve their own leave requests.",
      )
    }

    const year = request.startDate.getUTCFullYear()
    const allocation = await tx.leaveAllocation.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      },
    })

    if (!allocation) {
      throw new LeaveError(
        400,
        "NO_LEAVE_ALLOCATION",
        `No leave allocation found for year ${year} during approval.`,
      )
    }

    const availableDays = allocation.allocatedDays.minus(allocation.usedDays)
    if (availableDays.lessThan(request.requestedDays)) {
      throw new LeaveError(
        400,
        "INSUFFICIENT_LEAVE_BALANCE",
        `Insufficient leave balance for approval. Requested: ${request.requestedDays.toString()}, Available: ${availableDays.toString()}.`,
      )
    }

    // 1. Increment usedDays on allocation
    await tx.leaveAllocation.update({
      where: { id: allocation.id },
      data: {
        usedDays: {
          increment: request.requestedDays,
        },
      },
    })

    // 2. Update request status to APPROVED
    return tx.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.APPROVED,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        reviewComment: comment ?? null,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
          },
        },
        leaveType: true,
        reviewedByUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    })
  })
}

export async function rejectLeaveRequest(params: ReviewLeaveRequestParams) {
  const { id, reviewerUserId, comment } = params

  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, userId: true },
      },
    },
  })

  if (!request) {
    throw new LeaveError(404, "LEAVE_REQUEST_NOT_FOUND", "Leave request not found")
  }

  if (request.status !== LeaveRequestStatus.PENDING) {
    throw new LeaveError(
      409,
      "INVALID_STATUS_FOR_REJECTION",
      `Only PENDING leave requests can be rejected. Current status: ${request.status}.`,
    )
  }

  // Separation of Duties: Requester cannot reject own request
  if (request.employee.userId === reviewerUserId) {
    throw new LeaveError(
      403,
      "SELF_APPROVAL_NOT_ALLOWED",
      "Requesters cannot reject their own leave requests.",
    )
  }

  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: LeaveRequestStatus.REJECTED,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
      reviewComment: comment ?? null,
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
        },
      },
      leaveType: true,
      reviewedByUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  })
}

export interface CancelLeaveRequestParams {
  id: string
  userId: string
  userRole: UserRole
}

export async function cancelLeaveRequest(params: CancelLeaveRequestParams) {
  const { id, userId, userRole } = params

  return prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, userId: true },
        },
      },
    })

    if (!request) {
      throw new LeaveError(404, "LEAVE_REQUEST_NOT_FOUND", "Leave request not found")
    }

    const isOwner = request.employee.userId === userId
    const isManagement = userRole === UserRole.ADMIN || userRole === UserRole.HR_MANAGER

    if (!isOwner && !isManagement) {
      throw new LeaveError(
        403,
        "FORBIDDEN",
        "You do not have permission to cancel this leave request.",
      )
    }

    if (request.status === LeaveRequestStatus.CANCELLED) {
      throw new LeaveError(409, "ALREADY_CANCELLED", "This leave request is already cancelled.")
    }

    if (request.status === LeaveRequestStatus.REJECTED) {
      throw new LeaveError(409, "CANNOT_CANCEL_REJECTED", "Cannot cancel a rejected leave request.")
    }

    // If request was approved, restore usedDays in allocation
    if (request.status === LeaveRequestStatus.APPROVED) {
      const year = request.startDate.getUTCFullYear()
      await tx.leaveAllocation.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        data: {
          usedDays: {
            decrement: request.requestedDays,
          },
        },
      })
    }

    return tx.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.CANCELLED,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
          },
        },
        leaveType: true,
      },
    })
  })
}

// -------------------------------------------------------------
// QUERY SERVICES
// -------------------------------------------------------------

export async function getLeaveRequestById(id: string) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
          userId: true,
        },
      },
      leaveType: true,
      reviewedByUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  })

  if (!request) {
    throw new LeaveError(404, "LEAVE_REQUEST_NOT_FOUND", "Leave request not found")
  }

  return request
}

export interface ListLeaveRequestsFilterParams {
  employeeId?: string | undefined
  leaveTypeId?: string | undefined
  status?: LeaveRequestStatus | undefined
  year?: number | undefined
  from?: string | undefined
  to?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export async function listLeaveRequests(filter: ListLeaveRequestsFilterParams) {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: any = {}

  if (filter.employeeId) {
    where.employeeId = filter.employeeId
  }

  if (filter.leaveTypeId) {
    where.leaveTypeId = filter.leaveTypeId
  }

  if (filter.status) {
    where.status = filter.status
  }

  if (filter.year) {
    where.startDate = {
      gte: new Date(Date.UTC(filter.year, 0, 1)),
      lte: new Date(Date.UTC(filter.year, 11, 31)),
    }
  }

  if (filter.from || filter.to) {
    where.startDate = where.startDate || {}
    if (filter.from) {
      where.startDate.gte = parseDateOnly(filter.from)
    }
    if (filter.to) {
      where.startDate.lte = parseDateOnly(filter.to)
    }
  }

  const [records, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
            userId: true,
          },
        },
        leaveType: true,
        reviewedByUser: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ])

  return {
    leaveRequests: records,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

// Get leave balances for an employee in a given year
export async function getEmployeeLeaveBalances(employeeId: string, year?: number) {
  const targetYear = year ?? new Date().getUTCFullYear()

  // Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, userId: true },
  })

  if (!employee) {
    throw new LeaveError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  const allocations = await prisma.leaveAllocation.findMany({
    where: {
      employeeId,
      year: targetYear,
    },
    include: {
      leaveType: true,
    },
    orderBy: { leaveType: { code: "asc" } },
  })

  // Calculate pending days for each leave type
  const pendingRequests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      status: LeaveRequestStatus.PENDING,
      startDate: {
        gte: new Date(Date.UTC(targetYear, 0, 1)),
        lte: new Date(Date.UTC(targetYear, 11, 31)),
      },
    },
    select: {
      leaveTypeId: true,
      requestedDays: true,
    },
  })

  const pendingDaysMap = new Map<string, Prisma.Decimal>()
  for (const req of pendingRequests) {
    const current = pendingDaysMap.get(req.leaveTypeId) ?? new Prisma.Decimal(0)
    pendingDaysMap.set(req.leaveTypeId, current.plus(req.requestedDays))
  }

  const balances = allocations.map((alloc) => {
    const pendingDays = pendingDaysMap.get(alloc.leaveTypeId) ?? new Prisma.Decimal(0)
    const availableDays = alloc.allocatedDays.minus(alloc.usedDays)

    return {
      id: alloc.id,
      leaveTypeId: alloc.leaveTypeId,
      leaveType: {
        id: alloc.leaveType.id,
        code: alloc.leaveType.code,
        name: alloc.leaveType.name,
        isPaid: alloc.leaveType.isPaid,
        isActive: alloc.leaveType.isActive,
      },
      year: alloc.year,
      allocatedDays: alloc.allocatedDays.toNumber(),
      usedDays: alloc.usedDays.toNumber(),
      pendingDays: pendingDays.toNumber(),
      availableDays: availableDays.toNumber(),
    }
  })

  return {
    employeeId,
    year: targetYear,
    balances,
  }
}
