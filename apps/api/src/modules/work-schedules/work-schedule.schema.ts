import { z } from "zod"

import { DayOfWeek } from "../../generated/prisma/enums.js"

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const ALL_DAYS_OF_WEEK = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
] as const

export const DAY_ORDER: Record<DayOfWeek, number> = {
  [DayOfWeek.MONDAY]: 1,
  [DayOfWeek.TUESDAY]: 2,
  [DayOfWeek.WEDNESDAY]: 3,
  [DayOfWeek.THURSDAY]: 4,
  [DayOfWeek.FRIDAY]: 5,
  [DayOfWeek.SATURDAY]: 6,
  [DayOfWeek.SUNDAY]: 7,
}

// Convert "HH:mm" to minutes from midnight
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(":")
  const hours = Number(parts[0] ?? 0)
  const minutes = Number(parts[1] ?? 0)
  return hours * 60 + minutes
}

// Calculate expected work duration safely in minutes
export function calculateExpectedMinutes(
  isWorkingDay: boolean,
  startTime?: string | null,
  endTime?: string | null,
  breakMinutes: number = 0,
): number {
  if (!isWorkingDay || !startTime || !endTime) {
    return 0
  }

  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  const duration = end - start

  return Math.max(0, duration - breakMinutes)
}

// UUID validator
export const uuidSchema = z.string().uuid("Invalid UUID")

// Work schedule code normalizer
export const scheduleCodeSchema = z
  .string()
  .trim()
  .min(2, "Code must be at least 2 characters")
  .max(30, "Code cannot exceed 30 characters")
  .transform((val) => val.toUpperCase())

// Date validator
export const dateStringSchema = z
  .string()
  .regex(datePattern, "Date must use YYYY-MM-DD format")
  .transform((val) => new Date(`${val}T00:00:00.000Z`))

// Work schedule day schema
export const workScheduleDaySchema = z
  .object({
    dayOfWeek: z.nativeEnum(DayOfWeek),
    isWorkingDay: z.boolean().default(true),
    startTime: z
      .string()
      .regex(timePattern, "Start time must use HH:mm 24-hour format (e.g. 09:00)")
      .nullable()
      .optional(),
    endTime: z
      .string()
      .regex(timePattern, "End time must use HH:mm 24-hour format (e.g. 17:00)")
      .nullable()
      .optional(),
    breakMinutes: z
      .number()
      .int("Break minutes must be an integer")
      .min(0, "Break minutes cannot be negative")
      .default(0),
  })
  .superRefine((data, ctx) => {
    if (data.isWorkingDay) {
      if (!data.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Working day requires start time",
          path: ["startTime"],
        })
      }

      if (!data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Working day requires end time",
          path: ["endTime"],
        })
      }

      if (data.startTime && data.endTime) {
        const start = parseTimeToMinutes(data.startTime)
        const end = parseTimeToMinutes(data.endTime)

        if (end <= start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End time must logically follow start time",
            path: ["endTime"],
          })
        } else {
          const shiftDuration = end - start
          if (data.breakMinutes >= shiftDuration) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Break minutes cannot exceed or equal total work duration",
              path: ["breakMinutes"],
            })
          }
        }
      }
    } else {
      // Non-working day validations
      if (data.startTime !== undefined && data.startTime !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-working day should not carry work hours",
          path: ["startTime"],
        })
      }

      if (data.endTime !== undefined && data.endTime !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-working day should not carry work hours",
          path: ["endTime"],
        })
      }

      if (data.breakMinutes && data.breakMinutes > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Non-working day should not carry break minutes",
          path: ["breakMinutes"],
        })
      }
    }
  })

// Create work schedule schema
export const createWorkScheduleSchema = z
  .object({
    code: scheduleCodeSchema,
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120, "Name cannot exceed 120 characters"),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .default("UTC"),
    isActive: z.boolean().default(true),
    days: z
      .array(workScheduleDaySchema)
      .min(7, "Schedule must contain exactly 7 days")
      .max(7, "Schedule must contain exactly 7 days"),
  })
  .superRefine((data, ctx) => {
    const presentDays = new Set(data.days.map((d) => d.dayOfWeek))
    for (const day of ALL_DAYS_OF_WEEK) {
      if (!presentDays.has(day)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Schedule is missing entry for ${day}. Exactly one entry per weekday is required.`,
          path: ["days"],
        })
      }
    }

    if (presentDays.size !== 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Schedule contains duplicate day entries",
        path: ["days"],
      })
    }
  })

// Update work schedule schema
export const updateWorkScheduleSchema = z
  .object({
    code: scheduleCodeSchema.optional(),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120, "Name cannot exceed 120 characters")
      .optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .optional(),
    isActive: z.boolean().optional(),
    days: z
      .array(workScheduleDaySchema)
      .min(1)
      .max(7)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.days) {
      const seenDays = new Set<DayOfWeek>()
      for (const day of data.days) {
        if (seenDays.has(day.dayOfWeek)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate entry for ${day.dayOfWeek} in days update`,
            path: ["days"],
          })
        }
        seenDays.add(day.dayOfWeek)
      }
    }
  })

// Query schema for work schedules
export const workScheduleQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  search: z.string().trim().optional(),
})

// Assign schedule to employee schema
export const assignScheduleSchema = z
  .object({
    scheduleId: uuidSchema,
    effectiveFrom: dateStringSchema,
    effectiveTo: z
      .string()
      .regex(datePattern, "End date must use YYYY-MM-DD format")
      .transform((val) => new Date(`${val}T00:00:00.000Z`))
      .nullable()
      .optional(),
    closePrevious: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
        return false
      }
      return true
    },
    {
      message: "Effective to date must be greater than or equal to effective from date",
      path: ["effectiveTo"],
    },
  )

// Query schema for employee schedule assignments
export const employeeScheduleQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  activeOnly: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
})

export const scheduleIdParamSchema = z.object({
  id: uuidSchema,
})

export const employeeIdParamSchema = z.object({
  employeeId: uuidSchema,
})
