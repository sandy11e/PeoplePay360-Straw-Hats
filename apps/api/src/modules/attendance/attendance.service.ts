import {
  AttendanceSource,
  AttendanceStatus,
  DayOfWeek,
  EmploymentStatus,
} from "../../generated/prisma/enums.js"
import { prisma } from "../../lib/prisma.js"
import { parseTimeToMinutes } from "../work-schedules/work-schedule.schema.js"

export class AttendanceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "AttendanceError"
  }
}

// Convert JavaScript getUTCDay() index to Prisma DayOfWeek enum
export function getDayOfWeekFromDate(date: Date, timezone: string = "UTC"): DayOfWeek {
  const dayIndex = getDayOfWeekIndexInTimezone(date, timezone)
  const mapping: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY,
    1: DayOfWeek.MONDAY,
    2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY,
    4: DayOfWeek.THURSDAY,
    5: DayOfWeek.FRIDAY,
    6: DayOfWeek.SATURDAY,
  }
  return mapping[dayIndex] ?? DayOfWeek.MONDAY
}

// Get day of week index (0=Sun, 1=Mon, ..., 6=Sat) in specified timezone
function getDayOfWeekIndexInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    })
    const dayStr = formatter.format(date)
    switch (dayStr) {
      case "Sun":
        return 0
      case "Mon":
        return 1
      case "Tue":
        return 2
      case "Wed":
        return 3
      case "Thu":
        return 4
      case "Fri":
        return 5
      case "Sat":
        return 6
      default:
        return date.getUTCDay()
    }
  } catch {
    return date.getUTCDay()
  }
}

// Get minutes from midnight for a timestamp in a given timezone
export function getMinutesFromMidnight(date: Date, timezone: string = "UTC"): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    const formatted = formatter.format(date)
    const [h, m] = formatted.split(":").map(Number)
    return (h ?? 0) * 60 + (m ?? 0)
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes()
  }
}

// Calculate attendance date (midnight UTC) from timestamp
export function getAttendanceDateFromTimestamp(timestamp: Date): Date {
  return new Date(
    Date.UTC(
      timestamp.getUTCFullYear(),
      timestamp.getUTCMonth(),
      timestamp.getUTCDate(),
    ),
  )
}

// Calculate worked minutes server-side
export function calculateWorkedMinutes(checkInAt: Date, checkOutAt: Date): number {
  return Math.max(0, Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / (1000 * 60)))
}

export interface EvaluateStatusParams {
  employeeId: string
  checkInAt: Date
  attendanceDate: Date
}

// Evaluate expected start time from work schedule assignment and determine PRESENT vs LATE
export async function evaluateAttendanceStatus(
  params: EvaluateStatusParams,
): Promise<AttendanceStatus> {
  const { employeeId, checkInAt, attendanceDate } = params

  const assignment = await prisma.employeeScheduleAssignment.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: attendanceDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: attendanceDate } },
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

  if (!assignment || !assignment.schedule) {
    return AttendanceStatus.PRESENT
  }

  const timezone = assignment.schedule.timezone || "UTC"
  const dayOfWeek = getDayOfWeekFromDate(checkInAt, timezone)
  const scheduleDay = assignment.schedule.days.find((d) => d.dayOfWeek === dayOfWeek)

  if (!scheduleDay || !scheduleDay.isWorkingDay || !scheduleDay.startTime) {
    return AttendanceStatus.PRESENT
  }

  const expectedStartMinutes = parseTimeToMinutes(scheduleDay.startTime)
  const actualCheckInMinutes = getMinutesFromMidnight(checkInAt, timezone)

  if (actualCheckInMinutes > expectedStartMinutes) {
    return AttendanceStatus.LATE
  }

  return AttendanceStatus.PRESENT
}

export interface CheckInParams {
  employeeId: string
  source?: AttendanceSource | undefined
  notes?: string | null | undefined
  checkInAt?: Date | undefined
}

// Reusable Check-In service function (used by Web API and future Kiosk/QR integrations)
export async function performCheckIn(params: CheckInParams) {
  const { employeeId, source = AttendanceSource.WEB, notes } = params
  const checkInAt = params.checkInAt ?? new Date()

  // 1. Validate employee exists and is active
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employmentStatus: true },
  })

  if (!employee) {
    throw new AttendanceError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  if (employee.employmentStatus !== EmploymentStatus.ACTIVE) {
    throw new AttendanceError(
      400,
      "EMPLOYEE_NOT_ACTIVE",
      `Cannot record check-in for employee with status ${employee.employmentStatus}. Only ACTIVE employees may check in.`,
    )
  }

  // 2. Validate no open attendance session exists
  const existingOpenSession = await prisma.attendance.findFirst({
    where: {
      employeeId,
      checkOutAt: null,
    },
  })

  if (existingOpenSession) {
    throw new AttendanceError(
      409,
      "ATTENDANCE_SESSION_ALREADY_OPEN",
      "Employee already has an open attendance session. Please check out before checking in again.",
    )
  }

  // 3. Determine attendance date and status based on schedule
  const attendanceDate = getAttendanceDateFromTimestamp(checkInAt)
  const status = await evaluateAttendanceStatus({
    employeeId,
    checkInAt,
    attendanceDate,
  })

  // 4. Create attendance record
  return prisma.attendance.create({
    data: {
      employeeId,
      attendanceDate,
      checkInAt,
      status,
      source,
      notes: notes ?? null,
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
    },
  })
}

export interface CheckOutParams {
  employeeId: string
  source?: AttendanceSource | undefined
  notes?: string | null | undefined
  checkOutAt?: Date | undefined
}

// Reusable Check-Out service function (used by Web API and future Kiosk/QR integrations)
export async function performCheckOut(params: CheckOutParams) {
  const { employeeId, notes } = params
  const checkOutAt = params.checkOutAt ?? new Date()

  // 1. Validate employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employmentStatus: true },
  })

  if (!employee) {
    throw new AttendanceError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  // 2. Find active open session
  const openSession = await prisma.attendance.findFirst({
    where: {
      employeeId,
      checkOutAt: null,
    },
    orderBy: { checkInAt: "desc" },
  })

  if (!openSession) {
    throw new AttendanceError(
      404,
      "NO_ACTIVE_ATTENDANCE_SESSION",
      "No active attendance session found to check out.",
    )
  }

  // 3. Ensure checkOutAt cannot precede checkInAt
  if (checkOutAt < openSession.checkInAt) {
    throw new AttendanceError(
      400,
      "INVALID_TIME_RANGE",
      "checkOutAt cannot precede checkInAt",
    )
  }

  // 4. Server-side worked minutes calculation
  const workedMinutes = calculateWorkedMinutes(openSession.checkInAt, checkOutAt)

  // 5. Update record
  return prisma.attendance.update({
    where: { id: openSession.id },
    data: {
      checkOutAt,
      workedMinutes,
      notes: notes !== undefined ? notes : openSession.notes,
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
    },
  })
}

export interface CreateManualAttendanceParams {
  employeeId: string
  attendanceDate: Date
  checkInAt: Date
  checkOutAt?: Date | null | undefined
  status?: AttendanceStatus | undefined
  source?: AttendanceSource | undefined
  notes?: string | null | undefined
}

// Manual Attendance creation (restricted to Admin / HR Manager)
export async function createManualAttendance(params: CreateManualAttendanceParams) {
  const {
    employeeId,
    attendanceDate,
    checkInAt,
    checkOutAt,
    source = AttendanceSource.MANUAL,
    notes,
  } = params

  // 1. Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  })

  if (!employee) {
    throw new AttendanceError(404, "EMPLOYEE_NOT_FOUND", "Employee not found")
  }

  // 2. Validate time range if checkOutAt is provided
  if (checkOutAt && checkOutAt < checkInAt) {
    throw new AttendanceError(
      400,
      "INVALID_TIME_RANGE",
      "checkOutAt cannot precede checkInAt",
    )
  }

  // 3. If session is being created as open (no checkOutAt), verify no open session already exists
  if (!checkOutAt) {
    const existingOpenSession = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkOutAt: null,
      },
    })

    if (existingOpenSession) {
      throw new AttendanceError(
        409,
        "ATTENDANCE_SESSION_ALREADY_OPEN",
        "Employee already has an open attendance session.",
      )
    }
  }

  // 4. Server-side workedMinutes calculation (strictly server-side)
  const workedMinutes = checkOutAt
    ? calculateWorkedMinutes(checkInAt, checkOutAt)
    : null

  // 5. Determine status
  let status = params.status
  if (!status) {
    status = await evaluateAttendanceStatus({
      employeeId,
      checkInAt,
      attendanceDate,
    })
  }

  return prisma.attendance.create({
    data: {
      employeeId,
      attendanceDate,
      checkInAt,
      checkOutAt: checkOutAt ?? null,
      workedMinutes,
      status,
      source,
      notes: notes ?? null,
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
    },
  })
}

export interface UpdateAttendanceParams {
  id: string
  attendanceDate?: Date | undefined
  checkInAt?: Date | undefined
  checkOutAt?: Date | null | undefined
  status?: AttendanceStatus | undefined
  source?: AttendanceSource | undefined
  notes?: string | null | undefined
}

// Manual Attendance update (restricted to Admin / HR Manager)
export async function updateAttendance(params: UpdateAttendanceParams) {
  const { id, ...data } = params

  const existing = await prisma.attendance.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new AttendanceError(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found")
  }

  const effectiveCheckInAt = data.checkInAt ?? existing.checkInAt
  const effectiveCheckOutAt =
    data.checkOutAt !== undefined ? data.checkOutAt : existing.checkOutAt

  // 1. Validate time range
  if (effectiveCheckOutAt && effectiveCheckOutAt < effectiveCheckInAt) {
    throw new AttendanceError(
      400,
      "INVALID_TIME_RANGE",
      "checkOutAt cannot precede checkInAt",
    )
  }

  // 2. If setting checkOutAt to null, verify another open session doesn't exist
  if (effectiveCheckOutAt === null && existing.checkOutAt !== null) {
    const anotherOpenSession = await prisma.attendance.findFirst({
      where: {
        employeeId: existing.employeeId,
        checkOutAt: null,
        id: { not: id },
      },
    })

    if (anotherOpenSession) {
      throw new AttendanceError(
        409,
        "ATTENDANCE_SESSION_ALREADY_OPEN",
        "Employee already has another open attendance session.",
      )
    }
  }

  // 3. Server-side workedMinutes recalculation
  const workedMinutes = effectiveCheckOutAt
    ? calculateWorkedMinutes(effectiveCheckInAt, effectiveCheckOutAt)
    : null

  const updateData: Record<string, any> = {}
  if (data.attendanceDate !== undefined) updateData.attendanceDate = data.attendanceDate
  if (data.checkInAt !== undefined) updateData.checkInAt = data.checkInAt
  if (data.checkOutAt !== undefined) updateData.checkOutAt = data.checkOutAt
  if (data.status !== undefined) updateData.status = data.status
  if (data.source !== undefined) updateData.source = data.source
  if (data.notes !== undefined) updateData.notes = data.notes
  if (effectiveCheckOutAt !== undefined) updateData.workedMinutes = workedMinutes

  return prisma.attendance.update({
    where: { id },
    data: updateData,
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
    },
  })
}

// Get single attendance record by ID
export async function getAttendanceById(id: string) {
  const record = await prisma.attendance.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          workEmail: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!record) {
    throw new AttendanceError(404, "ATTENDANCE_NOT_FOUND", "Attendance record not found")
  }

  return record
}

export interface ListAttendanceFilterParams {
  from?: string | undefined
  to?: string | undefined
  employeeId?: string | undefined
  status?: AttendanceStatus | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

// List attendance records with date range, employee, status filters and pagination
export async function listAttendances(filter: ListAttendanceFilterParams) {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: any = {}

  if (filter.employeeId) {
    where.employeeId = filter.employeeId
  }

  if (filter.status) {
    where.status = filter.status
  }

  if (filter.from || filter.to) {
    where.attendanceDate = {}
    if (filter.from) {
      where.attendanceDate.gte = new Date(`${filter.from}T00:00:00.000Z`)
    }
    if (filter.to) {
      where.attendanceDate.lte = new Date(`${filter.to}T00:00:00.000Z`)
    }
  }

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: [{ checkInAt: "desc" }, { createdAt: "desc" }],
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
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.attendance.count({ where }),
  ])

  return {
    attendance: records,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}
